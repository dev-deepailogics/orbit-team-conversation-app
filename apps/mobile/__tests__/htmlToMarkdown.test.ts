import { htmlToMarkdown } from '../src/features/chat/htmlToMarkdown';
import { isSafeHref, normalizeUrl } from '../src/features/chat/link';

// Shapes follow the serializer in react-native-enriched-html (ios/htmlParser/HtmlParser.mm).
const doc = (body: string) => `<html>\n${body}\n</html>`;

test('inline styles', () => {
  expect(htmlToMarkdown(doc('<p>a <b>b</b> <i>i</i> <s>s</s> <code>c</code> <u>u</u></p>'))).toBe('a **b** *i* ~~s~~ `c` u');
  expect(htmlToMarkdown(doc('<p>see <a href="https://x.io">docs</a></p>'))).toBe('see [docs](https://x.io)');
  expect(htmlToMarkdown(doc('<p>1 &lt; 2 &amp; 3</p>'))).toContain('1 < 2 & 3');
});

test('blocks', () => {
  expect(htmlToMarkdown(doc('<h1>Title</h1>\n<h2>Sub</h2>'))).toBe('# Title\n\n## Sub');
  expect(htmlToMarkdown(doc('<ul>\n<li>one</li>\n<li>two</li>\n</ul>'))).toBe('- one\n- two');
  expect(htmlToMarkdown(doc('<ol>\n<li>one</li>\n<li>two</li>\n</ol>'))).toBe('1. one\n2. two');
  expect(htmlToMarkdown(doc('<blockquote>\n<p>quoted</p>\n</blockquote>'))).toBe('> quoted');
});

test('code block keeps lines and does not format their contents', () => {
  const md = htmlToMarkdown(doc('<codeblock>\n<p>const a = 1;</p>\n<p>if (a &lt; 2) {}</p>\n</codeblock>'));
  expect(md).toBe('```\nconst a = 1;\nif (a < 2) {}\n```');
  expect(htmlToMarkdown(doc('<codeblock>\nx <b>y</b>\n</codeblock>'))).toContain('```\nx y\n```');
});

test('paragraphs, empty doc and zero-width spaces', () => {
  expect(htmlToMarkdown(doc('<p>one</p>\n<p>two</p>'))).toBe('one\n\ntwo');
  expect(htmlToMarkdown('<html>\n<p></p>\n</html>')).toBe('');
  expect(htmlToMarkdown(doc('<p>​hi</p>'))).toBe('hi');
});

test('links: normalization and safe schemes', () => {
  expect(normalizeUrl('example.com')).toBe('https://example.com');
  expect(normalizeUrl('data:text/html,hi')).toBeNull();
  expect(normalizeUrl('a b.com')).toBeNull();
  expect(normalizeUrl('word')).toBeNull();
  expect(isSafeHref('https://x.io')).toBe(true);
  expect(isSafeHref('file:///etc/passwd')).toBe(false);
});
