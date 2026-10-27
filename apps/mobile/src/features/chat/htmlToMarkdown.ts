import { NodeHtmlMarkdown } from 'node-html-markdown';

// The server and web store messages as markdown (see htmlToMarkdown in apps/web/.../RichTextEditor.tsx),
// but react-native-enriched-html emits HTML. Underline has no markdown form, so only its text survives.
const converter = new NodeHtmlMarkdown({
  bulletMarker: '-',
  strongDelimiter: '**',
  emDelimiter: '*',
  codeFence: '```',
  maxConsecutiveNewlines: 2,
});

// The editor's custom <codeblock> holds one line per row; turn it into a standard <pre><code>.
const CODEBLOCK = /<codeblock>([\s\S]*?)<\/codeblock>/g;

export function htmlToMarkdown(html: string): string {
  const prepared = html
    .replace(/​/g, '')
    .replace(CODEBLOCK, (_, inner: string) => {
      const lines = inner
        .replace(/<\/p>\s*<p[^>]*>/g, '\n')
        .replace(/<\/?p[^>]*>/g, '')
        .replace(/<br\s*\/?>/g, '\n')
        .trim();
      return `<pre><code>${lines}</code></pre>`;
    });
  return converter.translate(prepared).trim();
}
