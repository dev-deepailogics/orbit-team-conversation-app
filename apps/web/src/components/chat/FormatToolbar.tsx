'use client';

import React from 'react';
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

interface FormatToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  content: string;
  setContent: (val: string | ((prev: string) => string)) => void;
  className?: string;
}

export const FormatToolbar: React.FC<FormatToolbarProps> = ({
  textareaRef,
  content,
  setContent,
  className = '',
}) => {
  // Wrap selected text or insert markers at cursor
  const applyWrap = (prefix: string, suffix: string = prefix, defaultPlaceholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;

    if (start !== end) {
      const selected = current.slice(start, end);
      const isWrapped =
        selected.startsWith(prefix) &&
        selected.endsWith(suffix) &&
        selected.length >= prefix.length + suffix.length;

      const replacement = isWrapped
        ? selected.slice(prefix.length, selected.length - suffix.length)
        : `${prefix}${selected}${suffix}`;

      const updated = current.slice(0, start) + replacement + current.slice(end);
      setContent(updated);

      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(
            start,
            start + replacement.length
          );
        }
      }, 0);
    } else {
      const placeholder = defaultPlaceholder;
      const insertion = `${prefix}${placeholder}${suffix}`;
      const updated = current.slice(0, start) + insertion + current.slice(end);
      setContent(updated);

      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(
            start + prefix.length,
            start + prefix.length + placeholder.length
          );
        }
      }, 0);
    }
  };

  // Line prefix toggle (for headings, lists, quotes)
  const applyLinePrefix = (prefix: string, regexToStrip: RegExp = /^(#{1,3}\s*|[-*•]\s*|\d+\.\s*|>\s*)/) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;

    const lineStart = current.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    let lineEnd = current.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = current.length;

    const selectedBlock = current.slice(lineStart, lineEnd);
    const lines = selectedBlock.split('\n');

    const allHavePrefix = lines.every((l) => l.startsWith(prefix));

    const updatedLines = lines.map((line, idx) => {
      if (allHavePrefix) {
        return line.replace(regexToStrip, '');
      } else {
        const cleaned = line.replace(regexToStrip, '');
        const actualPrefix = prefix === '1. ' ? `${idx + 1}. ` : prefix;
        return `${actualPrefix}${cleaned}`;
      }
    });

    const replacement = updatedLines.join('\n');
    const updated = current.slice(0, lineStart) + replacement + current.slice(lineEnd);
    setContent(updated);

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(lineStart, lineStart + replacement.length);
      }
    }, 0);
  };

  // Code Block
  const applyCodeBlock = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const selected = current.slice(start, end);

    const replacement = selected ? `\`\`\`\n${selected}\n\`\`\`` : '```\n// code here\n```';
    const updated = current.slice(0, start) + replacement + current.slice(end);
    setContent(updated);

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        if (selected) {
          textarea.setSelectionRange(start + 4, start + 4 + selected.length);
        } else {
          textarea.setSelectionRange(start + 4, start + 16);
        }
      }
    }, 0);
  };

  // Link
  const applyLink = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const selected = current.slice(start, end);

    const replacement = selected ? `[${selected}](https://)` : '[link title](https://example.com)';
    const updated = current.slice(0, start) + replacement + current.slice(end);
    setContent(updated);

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        if (selected) {
          textarea.setSelectionRange(start + selected.length + 3, start + replacement.length - 1);
        } else {
          textarea.setSelectionRange(start + 1, start + 11);
        }
      }
    }, 0);
  };

  const tools = [
    {
      label: 'Bold (Ctrl+B)',
      icon: Bold,
      action: () => applyWrap('**', '**', 'bold text'),
    },
    {
      label: 'Italic (Ctrl+I)',
      icon: Italic,
      action: () => applyWrap('*', '*', 'italic text'),
    },
    {
      label: 'Strikethrough',
      icon: Strikethrough,
      action: () => applyWrap('~~', '~~', 'strikethrough text'),
    },
    { divider: true },
    {
      label: 'Heading 1',
      icon: Heading1,
      action: () => applyLinePrefix('# '),
    },
    {
      label: 'Heading 2',
      icon: Heading2,
      action: () => applyLinePrefix('## '),
    },
    { divider: true },
    {
      label: 'Bullet List',
      icon: List,
      action: () => applyLinePrefix('- '),
    },
    {
      label: 'Numbered List',
      icon: ListOrdered,
      action: () => applyLinePrefix('1. '),
    },
    {
      label: 'Quote',
      icon: Quote,
      action: () => applyLinePrefix('> '),
    },
    { divider: true },
    {
      label: 'Inline Code',
      icon: Code,
      action: () => applyWrap('`', '`', 'code'),
    },
    {
      label: 'Code Block',
      icon: FileCode,
      action: applyCodeBlock,
    },
    {
      label: 'Link',
      icon: LinkIcon,
      action: applyLink,
    },
  ];

  return (
    <div className={`flex items-center gap-0.5 px-2 py-1 bg-[#1C1F23]/80 border-b border-gray-800/60 overflow-x-auto select-none ${className}`}>
      {tools.map((item, idx) => {
        if (item.divider) {
          return <span key={idx} className="w-px h-4 bg-gray-700/60 mx-1 shrink-0" />;
        }
        const Icon = item.icon!;
        return (
          <button
            key={idx}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={item.action}
            title={item.label}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-lg transition active:scale-95 shrink-0"
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
};
