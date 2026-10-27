import MarkdownIt from 'markdown-it';

// Inverse of features/chat/htmlToMarkdown: lets the rich editor open text that is stored as markdown.
// html:false escapes raw tags so stored text can't inject markup into the editor.
const md = new MarkdownIt({ html: false, breaks: true });

const FENCE = /<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/g;

export function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return '';
  return (
    md
      .render(markdown)
      // The editor's code block is <codeblock> with one <p> per line, not <pre><code>.
      .replace(FENCE, (_, code: string) => {
        const lines = code.replace(/\n$/, '').split('\n');
        return `<codeblock>${lines.map(l => `<p>${l}</p>`).join('')}</codeblock>`;
      })
      .replace(/<li>\s*<p>([\s\S]*?)<\/p>\s*<\/li>/g, '<li>$1</li>') // loose-list paragraphs
      .trim()
  );
}
