// markdown-it ships no types and is only used by lib/markdownToHtml.
declare module 'markdown-it' {
  interface Options {
    html?: boolean;
    breaks?: boolean;
    linkify?: boolean;
  }
  export default class MarkdownIt {
    constructor(options?: Options);
    render(src: string): string;
  }
}
