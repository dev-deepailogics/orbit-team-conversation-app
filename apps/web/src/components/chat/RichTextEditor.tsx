'use client';

import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code,
  FileCode,
  Link as LinkIcon,
} from 'lucide-react';

export interface RichTextEditorRef {
  insertEmoji: (emoji: string) => void;
  getMarkdown: () => string;
  getText: () => string;
  clear: () => void;
  focus: () => void;
  setMarkdown: (md: string) => void;
}

interface RichTextEditorProps {
  initialValue?: string;
  placeholder?: string;
  showToolbar?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onTyping?: (text: string) => void;
  onSubmit?: () => void;
  minHeight?: string;
  className?: string;
}

function getInlineFormattingParent(node: Node | null, rootEl: HTMLElement): HTMLElement | null {
  const inlineTags = new Set(['code', 'b', 'strong', 'i', 'em', 's', 'strike', 'del', 'a', 'u']);
  let curr: Node | null = node;
  while (curr && curr !== rootEl) {
    if (curr.nodeType === Node.ELEMENT_NODE) {
      const tag = (curr as HTMLElement).tagName.toLowerCase();
      if (inlineTags.has(tag)) {
        return curr as HTMLElement;
      }
    }
    curr = curr.parentNode;
  }
  return null;
}

function isCursorAtEndOfNode(range: Range, inlineEl: HTMLElement): boolean {
  if (!range.collapsed) return false;
  try {
    const testRange = document.createRange();
    testRange.selectNodeContents(inlineEl);
    testRange.setStart(range.endContainer, range.endOffset);
    return testRange.toString().replace(/\u200B/g, '').length === 0;
  } catch (err) {
    return false;
  }
}

function isCursorAtStartOfNode(range: Range, inlineEl: HTMLElement): boolean {
  if (!range.collapsed) return false;
  try {
    const testRange = document.createRange();
    testRange.selectNodeContents(inlineEl);
    testRange.setEnd(range.startContainer, range.startOffset);
    return testRange.toString().replace(/\u200B/g, '').length === 0;
  } catch (err) {
    return false;
  }
}

// Convert live DOM tree from contentEditable to clean markdown
export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  function nodeToMd(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || '').replace(/\u200B/g, '');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const children = Array.from(el.childNodes).map(nodeToMd).join('').replace(/\u200B/g, '');

    switch (tag) {
      case 'b':
      case 'strong':
        return children.trim() ? `**${children.trim()}**` : '';
      case 'i':
      case 'em':
        return children.trim() ? `*${children.trim()}*` : '';
      case 's':
      case 'strike':
      case 'del':
        return children.trim() ? `~~${children.trim()}~~` : '';
      case 'h1':
        return `\n# ${children.trim()}\n`;
      case 'h2':
        return `\n## ${children.trim()}\n`;
      case 'h3':
        return `\n### ${children.trim()}\n`;
      case 'code':
        if (el.parentElement?.tagName.toLowerCase() === 'pre') {
          return children;
        }
        return children.trim() ? `\`${children.trim()}\`` : '';
      case 'pre':
        return `\n\`\`\`\n${children.trim()}\n\`\`\`\n`;
      case 'blockquote': {
        const lines = children.trim().split('\n');
        return `\n${lines.map((l) => `> ${l}`).join('\n')}\n`;
      }
      case 'ul':
        return `\n${children.trim()}\n`;
      case 'ol':
        return `\n${children.trim()}\n`;
      case 'li':
        return `- ${children.trim()}\n`;
      case 'a':
        return `[${children.trim()}](${el.getAttribute('href') || ''})`;
      case 'p':
      case 'div':
        return children ? `\n${children}` : '\n';
      case 'br':
        return '\n';
      default:
        return children;
    }
  }

  const rawMd = Array.from(doc.body.childNodes).map(nodeToMd).join('');
  return rawMd
    .replace(/\u200B/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function markdownToHtml(md: string): string {
  if (!md) return '';
  const lines = md.split('\n');
  const htmlLines = lines.map((line) => {
    let safe = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    if (safe.startsWith('### ')) {
      return `<h3>${safe.slice(4)}</h3>`;
    }
    if (safe.startsWith('## ')) {
      return `<h2>${safe.slice(3)}</h2>`;
    }
    if (safe.startsWith('# ')) {
      return `<h1>${safe.slice(2)}</h1>`;
    }
    if (safe.startsWith('&gt; ') || safe.startsWith('> ')) {
      return `<blockquote>${safe.replace(/^(&gt;|>)\s*/, '')}</blockquote>`;
    }
    if (safe.startsWith('- ') || safe.startsWith('* ')) {
      return `<ul><li>${safe.slice(2)}</li></ul>`;
    }
    safe = safe.replace(/\*\*\*(.*?)\*\*\*/g, '<b><i>$1</i></b>');
    safe = safe.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    safe = safe.replace(/\*(.*?)\*/g, '<i>$1</i>');
    safe = safe.replace(/~~(.*?)~~/g, '<del>$1</del>');
    safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
    safe = safe.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    if (!safe.trim()) return '<br>';
    return `<div>${safe}</div>`;
  });

  return htmlLines.join('');
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  (
    {
      initialValue,
      placeholder = 'Type a message...',
      showToolbar = true,
      onKeyDown,
      onTyping,
      onSubmit,
      minHeight = '60px',
      className = '',
    },
    ref
  ) => {
    const editorRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      if (initialValue !== undefined && editorRef.current) {
        editorRef.current.innerHTML = markdownToHtml(initialValue);
      }
    }, [initialValue]);

    useImperativeHandle(ref, () => ({
      insertEmoji: (emoji: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        editor.focus();
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode(emoji);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          editor.innerHTML += emoji;
        }

        if (onTyping) {
          onTyping(editor.innerText);
        }
      },
      getMarkdown: () => {
        if (!editorRef.current) return '';
        return htmlToMarkdown(editorRef.current.innerHTML);
      },
      getText: () => {
        return (editorRef.current?.innerText || '').replace(/\u200B/g, '').trim();
      },
      setMarkdown: (md: string) => {
        if (editorRef.current) {
          editorRef.current.innerHTML = markdownToHtml(md);
        }
      },
      clear: () => {
        if (editorRef.current) {
          editorRef.current.innerHTML = '';
        }
      },
      focus: () => {
        editorRef.current?.focus();
      },
    }));

    // Live Formatting Handlers
    const executeCommand = (command: string, value: string | undefined = undefined) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      document.execCommand(command, false, value);
      if (onTyping) onTyping(editor.innerText.replace(/\u200B/g, ''));
    };

    const handleFormatHeading = (level: 1 | 2) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const tag = level === 1 ? 'H1' : 'H2';
      const anchorNode = sel.anchorNode;
      const parentEl = anchorNode?.nodeType === Node.ELEMENT_NODE
        ? (anchorNode as HTMLElement)
        : anchorNode?.parentElement;

      if (parentEl && parentEl.tagName === tag) {
        document.execCommand('formatBlock', false, '<div>');
      } else {
        document.execCommand('formatBlock', false, `<${tag}>`);
      }

      if (onTyping) onTyping(editor.innerText.replace(/\u200B/g, ''));
    };

    const handleFormatInlineCode = () => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      const selectedText = range.toString();

      if (selectedText) {
        // Check if already in a code tag
        const parent = sel.anchorNode?.parentElement;
        if (parent && parent.tagName.toLowerCase() === 'code') {
          const textNode = document.createTextNode(parent.textContent || '');
          parent.parentNode?.replaceChild(textNode, parent);
        } else {
          const codeEl = document.createElement('code');
          codeEl.className =
            'bg-[#2C3136] text-[#ECB22E] px-1.5 py-0.5 rounded font-mono text-xs border border-gray-700/60 font-medium';
          codeEl.textContent = selectedText;
          range.deleteContents();
          range.insertNode(codeEl);

          // Add trailing empty text node so right arrow immediately steps into normal text
          const postNode = document.createTextNode('\u200B');
          codeEl.parentNode?.insertBefore(postNode, codeEl.nextSibling);

          range.setStartAfter(codeEl);
          range.setEndAfter(codeEl);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } else {
        const codeEl = document.createElement('code');
        codeEl.className =
          'bg-[#2C3136] text-[#ECB22E] px-1.5 py-0.5 rounded font-mono text-xs border border-gray-700/60 font-medium';
        codeEl.textContent = 'code';
        range.insertNode(codeEl);

        const postNode = document.createTextNode('\u200B');
        codeEl.parentNode?.insertBefore(postNode, codeEl.nextSibling);

        range.selectNodeContents(codeEl);
        sel.removeAllRanges();
        sel.addRange(range);
      }

      if (onTyping) onTyping(editor.innerText.replace(/\u200B/g, ''));
    };

    const handleFormatCodeBlock = () => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      const selectedText = range.toString();

      const pre = document.createElement('pre');
      pre.className =
        'bg-[#141618] border border-gray-700/80 rounded-lg p-2.5 my-1.5 font-mono text-xs text-gray-200 block overflow-x-auto';
      const code = document.createElement('code');
      code.textContent = selectedText || '// type code here';
      pre.appendChild(code);

      range.deleteContents();
      range.insertNode(pre);

      // Create a newline after pre for easy continuation
      const p = document.createElement('div');
      p.innerHTML = '<br>';
      pre.parentNode?.insertBefore(p, pre.nextSibling);

      range.selectNodeContents(code);
      sel.removeAllRanges();
      sel.addRange(range);

      if (onTyping) onTyping(editor.innerText.replace(/\u200B/g, ''));
    };

    const handleFormatLink = () => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();

      const sel = window.getSelection();
      const selectedText = sel?.toString();
      const url = prompt('Enter URL:', 'https://');
      if (url) {
        if (selectedText) {
          document.execCommand('createLink', false, url);
        } else {
          document.execCommand('insertHTML', false, `<a href="${url}" target="_blank" class="text-blue-400 hover:underline">${url}</a>`);
        }
      }
      if (onTyping) onTyping(editor.innerText.replace(/\u200B/g, ''));
    };

    const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      const editor = editorRef.current;

      // 1. Arrow Right Escape from inline formatting tags (code, b, strong, i, em, s, a, etc.)
      if (e.key === 'ArrowRight' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && editor) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const inlineEl = getInlineFormattingParent(range.endContainer, editor);
          if (inlineEl && isCursorAtEndOfNode(range, inlineEl)) {
            e.preventDefault();
            let nextNode = inlineEl.nextSibling;
            if (!nextNode || nextNode.nodeType !== Node.TEXT_NODE) {
              const textNode = document.createTextNode('\u200B');
              inlineEl.parentNode?.insertBefore(textNode, inlineEl.nextSibling);
              nextNode = textNode;
            }
            const newRange = document.createRange();
            if (nextNode.nodeType === Node.TEXT_NODE) {
              const text = nextNode.textContent || '';
              const offset = text.startsWith('\u200B') ? 1 : 0;
              newRange.setStart(nextNode, offset);
              newRange.setEnd(nextNode, offset);
            } else {
              newRange.setStartAfter(inlineEl);
              newRange.setEndAfter(inlineEl);
            }
            sel.removeAllRanges();
            sel.addRange(newRange);
            return;
          }
        }
      }

      // 2. Arrow Left Escape from start of inline formatting tags
      if (e.key === 'ArrowLeft' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && editor) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const inlineEl = getInlineFormattingParent(range.startContainer, editor);
          if (inlineEl && isCursorAtStartOfNode(range, inlineEl)) {
            e.preventDefault();
            let prevNode = inlineEl.previousSibling;
            if (!prevNode || prevNode.nodeType !== Node.TEXT_NODE) {
              const textNode = document.createTextNode('\u200B');
              inlineEl.parentNode?.insertBefore(textNode, inlineEl);
              prevNode = textNode;
            }
            const newRange = document.createRange();
            newRange.setStart(prevNode, 0);
            newRange.setEnd(prevNode, 0);
            sel.removeAllRanges();
            sel.addRange(newRange);
            return;
          }
        }
      }

      // 3. Live delimiter conversion on typing closing backtick `
      if (e.key === '`' && !e.ctrlKey && !e.metaKey && editor) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          if (range.collapsed && range.startContainer.nodeType === Node.TEXT_NODE) {
            const textNode = range.startContainer;
            const fullText = textNode.textContent || '';
            const beforeCursor = fullText.slice(0, range.startOffset);
            const lastBacktickIdx = beforeCursor.lastIndexOf('`');

            if (lastBacktickIdx !== -1) {
              const codeText = beforeCursor.slice(lastBacktickIdx + 1);
              if (codeText.length > 0 && !codeText.includes('\n')) {
                e.preventDefault();
                const textBefore = beforeCursor.slice(0, lastBacktickIdx);
                const textAfter = fullText.slice(range.startOffset);

                const codeEl = document.createElement('code');
                codeEl.className =
                  'bg-[#2C3136] text-[#ECB22E] px-1.5 py-0.5 rounded font-mono text-xs border border-gray-700/60 font-medium';
                codeEl.textContent = codeText;

                const parent = textNode.parentNode;
                if (parent) {
                  const frag = document.createDocumentFragment();
                  if (textBefore) frag.appendChild(document.createTextNode(textBefore));
                  frag.appendChild(codeEl);
                  const postNode = document.createTextNode('\u200B' + textAfter);
                  frag.appendChild(postNode);

                  parent.replaceChild(frag, textNode);

                  const newRange = document.createRange();
                  newRange.setStart(postNode, 1);
                  newRange.setEnd(postNode, 1);
                  sel.removeAllRanges();
                  sel.addRange(newRange);

                  if (onTyping) onTyping(editor.innerText.replace(/\u200B/g, ''));
                  return;
                }
              }
            }
          }
        }
      }

      // 4. Space after inline code tag OR space after "- / * / •" to create bullet list
      if (e.key === ' ' && !e.shiftKey && !e.ctrlKey && !e.metaKey && editor) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const inlineEl = getInlineFormattingParent(range.endContainer, editor);

          // If at end of code tag, exit code tag and insert regular space
          if (inlineEl && inlineEl.tagName.toLowerCase() === 'code' && isCursorAtEndOfNode(range, inlineEl)) {
            e.preventDefault();
            let nextNode = inlineEl.nextSibling;
            if (!nextNode || nextNode.nodeType !== Node.TEXT_NODE) {
              const textNode = document.createTextNode(' ');
              inlineEl.parentNode?.insertBefore(textNode, inlineEl.nextSibling);
              nextNode = textNode;
            } else {
              nextNode.textContent = ' ' + (nextNode.textContent || '').replace(/^\u200B/, '');
            }
            const newRange = document.createRange();
            newRange.setStart(nextNode, 1);
            newRange.setEnd(nextNode, 1);
            sel.removeAllRanges();
            sel.addRange(newRange);
            if (onTyping) onTyping(editor.innerText.replace(/\u200B/g, ''));
            return;
          }

          // Auto-convert "- " / "• " / "* " into bullet list
          const node = sel.anchorNode;
          const parentLi = node instanceof HTMLElement ? node.closest('li') : node?.parentElement?.closest('li');
          if (!parentLi) {
            const text = node?.textContent || '';
            const offset = sel.anchorOffset;
            if ((text === '-' || text === '•' || text === '*') && offset === 1) {
              e.preventDefault();
              if (node && node.nodeType === Node.TEXT_NODE) {
                node.textContent = '';
              }
              document.execCommand('insertUnorderedList');
              if (onTyping) onTyping(editor.innerText.replace(/\u200B/g, ''));
              return;
            }
          }
        }
      }

      // 5. Enter key handling: Continue bullet lists on next line OR submit message
      if (e.key === 'Enter') {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && editor) {
          const range = sel.getRangeAt(0);
          const node = sel.anchorNode;
          const parentLi = node instanceof HTMLElement ? node.closest('li') : node?.parentElement?.closest('li');

          if (parentLi && editor.contains(parentLi)) {
            e.preventDefault();
            const liRawText = parentLi.textContent?.replace(/\u200B/g, '').trim() || '';

            // If empty bullet: exit bullet list
            if (!liRawText) {
              const parentList = parentLi.parentElement; // <ul> or <ol>
              parentLi.remove();
              const newDiv = document.createElement('div');
              newDiv.innerHTML = '<br>';
              if (parentList && parentList.nextSibling) {
                parentList.parentNode?.insertBefore(newDiv, parentList.nextSibling);
              } else if (parentList && parentList.parentNode) {
                parentList.parentNode.appendChild(newDiv);
              } else {
                editor.appendChild(newDiv);
              }
              const newRange = document.createRange();
              newRange.setStart(newDiv, 0);
              newRange.setEnd(newDiv, 0);
              sel.removeAllRanges();
              sel.addRange(newRange);
            } else {
              // Create next bullet <li>
              const newLi = document.createElement('li');
              const splitRange = document.createRange();
              splitRange.selectNodeContents(parentLi);
              splitRange.setStart(range.endContainer, range.endOffset);
              const trailingFrag = splitRange.extractContents();

              if (trailingFrag.textContent?.trim() || trailingFrag.childNodes.length > 0) {
                newLi.appendChild(trailingFrag);
              } else {
                newLi.innerHTML = '<br>';
              }

              parentLi.parentNode?.insertBefore(newLi, parentLi.nextSibling);

              const newRange = document.createRange();
              newRange.setStart(newLi, 0);
              newRange.setEnd(newLi, 0);
              sel.removeAllRanges();
              sel.addRange(newRange);
            }

            if (onTyping) onTyping(editor.innerText.replace(/\u200B/g, ''));
            return;
          }
        }

        // Outside list: Shift+Enter inserts newline, plain Enter submits
        if (!e.shiftKey) {
          e.preventDefault();
          if (onSubmit) onSubmit();
          return;
        }
      }

      // Keyboard Formatting Shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          executeCommand('bold');
          return;
        }
        if (e.key === 'i' || e.key === 'I') {
          e.preventDefault();
          executeCommand('italic');
          return;
        }
        if (e.key === 'u' || e.key === 'U') {
          e.preventDefault();
          executeCommand('underline');
          return;
        }
        if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          handleFormatInlineCode();
          return;
        }
      }

      if (onKeyDown) {
        onKeyDown(e);
      }
    };

    const handleInput = () => {
      if (editorRef.current && onTyping) {
        onTyping(editorRef.current.innerText.replace(/\u200B/g, ''));
      }
    };

    return (
      <div className={`flex flex-col w-full ${className}`}>
        {/* Live Format Toolbar */}
        {showToolbar && (
          <div className="flex items-center gap-0.5 px-2.5 py-1.5 bg-[#1C1F23]/90 border-b border-gray-800/60 overflow-x-auto select-none">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCommand('bold')}
              title="Bold (Ctrl+B)"
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-lg transition active:scale-95"
            >
              <Bold size={14} />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCommand('italic')}
              title="Italic (Ctrl+I)"
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-lg transition active:scale-95"
            >
              <Italic size={14} />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCommand('strikeThrough')}
              title="Strikethrough"
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-lg transition active:scale-95"
            >
              <Strikethrough size={14} />
            </button>

            <span className="w-px h-4 bg-gray-700/60 mx-1 shrink-0" />

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleFormatHeading(1)}
              title="Heading 1"
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-lg transition active:scale-95"
            >
              <Heading1 size={14} />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleFormatHeading(2)}
              title="Heading 2"
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-lg transition active:scale-95"
            >
              <Heading2 size={14} />
            </button>

            <span className="w-px h-4 bg-gray-700/60 mx-1 shrink-0" />

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCommand('insertUnorderedList')}
              title="Bullet List"
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-lg transition active:scale-95"
            >
              <List size={14} />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCommand('insertOrderedList')}
              title="Numbered List"
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-lg transition active:scale-95"
            >
              <ListOrdered size={14} />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCommand('formatBlock', '<blockquote>')}
              title="Blockquote"
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-lg transition active:scale-95"
            >
              <Quote size={14} />
            </button>

            <span className="w-px h-4 bg-gray-700/60 mx-1 shrink-0" />

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleFormatInlineCode}
              title="Inline Code"
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-lg transition active:scale-95"
            >
              <Code size={14} />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleFormatCodeBlock}
              title="Code Block"
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-lg transition active:scale-95"
            >
              <FileCode size={14} />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleFormatLink}
              title="Link"
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-lg transition active:scale-95"
            >
              <LinkIcon size={14} />
            </button>
          </div>
        )}

        {/* Live ContentEditable Typing Area */}
        <div className="relative w-full">
          <div
            ref={editorRef}
            contentEditable
            onKeyDown={handleEditorKeyDown}
            onInput={handleInput}
            style={{ minHeight }}
            data-placeholder={placeholder}
            className="w-full bg-transparent px-4 py-3 text-sm text-white focus:outline-none overflow-y-auto max-h-60 leading-relaxed font-sans empty:before:content-[attr(data-placeholder)] empty:before:text-gray-500 empty:before:pointer-events-none [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-white [&_h1]:my-1 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-white [&_h2]:my-1 [&_b]:font-bold [&_b]:text-white [&_strong]:font-bold [&_strong]:text-white [&_i]:italic [&_i]:text-gray-200 [&_ul]:list-disc [&_ul]:list-inside [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:my-1 [&_blockquote]:border-l-4 [&_blockquote]:border-slack-green [&_blockquote]:bg-[#222529]/60 [&_blockquote]:px-2.5 [&_blockquote]:py-1 [&_blockquote]:my-1 [&_blockquote]:rounded-r [&_blockquote]:italic [&_blockquote]:text-gray-300 [&_a]:text-blue-400 [&_a]:underline"
          />
        </div>
      </div>
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor';
