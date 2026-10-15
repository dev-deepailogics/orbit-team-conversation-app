'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  FileCode,
  Table as TableIcon,
  Image as ImageIcon,
  Minus,
  Sparkles,
  Upload,
  Plus,
  Trash2,
  Copy,
  Check,
  MoreVertical,
  GripVertical,
  AlignLeft,
  ChevronDown,
  X,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../lib/api';

export type BlockType =
  | 'p'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'number'
  | 'todo'
  | 'callout'
  | 'quote'
  | 'code'
  | 'table'
  | 'image'
  | 'divider';

export interface NotionBlock {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  emoji?: string;
  language?: string;
  tableData?: string[][]; // [row][col]
  imageUrl?: string;
  caption?: string;
}

interface NotionEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

// Generate unique ID
function uid(): string {
  return 'b_' + Math.random().toString(36).substring(2, 9);
}

// ==========================================
// Parser: Markdown String -> NotionBlock[]
// ==========================================
export function parseMarkdownToBlocks(md: string): NotionBlock[] {
  if (!md || !md.trim()) {
    return [{ id: uid(), type: 'p', content: '' }];
  }

  const lines = md.split('\n');
  const blocks: NotionBlock[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let codeLang = '';
  let inTable = false;
  let tableLines: string[] = [];

  const flushCode = () => {
    if (codeLines.length > 0) {
      blocks.push({
        id: uid(),
        type: 'code',
        content: codeLines.join('\n'),
        language: codeLang || 'javascript',
      });
      codeLines = [];
      codeLang = '';
    }
  };

  const flushTable = () => {
    if (tableLines.length > 0) {
      const rows = tableLines.map((l) =>
        l
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim())
      );
      // Filter out markdown separator line (e.g. ---|---)
      const dataRows = rows.filter(
        (r) => !r.every((c) => /^[-:]+$/.test(c.replace(/\s/g, '')))
      );
      if (dataRows.length > 0) {
        blocks.push({
          id: uid(),
          type: 'table',
          content: '',
          tableData: dataRows,
        });
      }
      tableLines = [];
    }
  };

  lines.forEach((line) => {
    // Code blocks
    if (line.startsWith('```')) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        inCode = true;
        codeLang = line.replace('```', '').trim();
      }
      return;
    }

    if (inCode) {
      codeLines.push(line);
      return;
    }

    // Tables
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      inTable = true;
      tableLines.push(line);
      return;
    } else if (inTable) {
      flushTable();
      inTable = false;
    }

    // Dividers
    if (line.trim() === '---') {
      blocks.push({ id: uid(), type: 'divider', content: '' });
      return;
    }

    // Image: ![caption](url)
    const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)/);
    if (imgMatch) {
      blocks.push({
        id: uid(),
        type: 'image',
        content: '',
        caption: imgMatch[1] || '',
        imageUrl: imgMatch[2] || '',
      });
      return;
    }

    // Callout: > 💡 Tip: ... or > 💡 ...
    if (line.startsWith('> 💡') || line.startsWith('> 🚀') || line.startsWith('> ⚠️') || line.startsWith('> ℹ️')) {
      const emoji = line.substring(2, 4);
      const text = line.replace(/^>\s*..\s*/, '').trim();
      blocks.push({
        id: uid(),
        type: 'callout',
        content: text,
        emoji,
      });
      return;
    }

    // Blockquote: > ...
    if (line.startsWith('> ')) {
      blocks.push({
        id: uid(),
        type: 'quote',
        content: line.substring(2),
      });
      return;
    }

    // Headings
    if (line.startsWith('### ')) {
      blocks.push({ id: uid(), type: 'h3', content: line.substring(4) });
      return;
    }
    if (line.startsWith('## ')) {
      blocks.push({ id: uid(), type: 'h2', content: line.substring(3) });
      return;
    }
    if (line.startsWith('# ')) {
      blocks.push({ id: uid(), type: 'h1', content: line.substring(2) });
      return;
    }

    // Todo / Checklist: - [ ] or - [x]
    if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
      blocks.push({
        id: uid(),
        type: 'todo',
        checked: line.startsWith('- [x] '),
        content: line.substring(6),
      });
      return;
    }

    // Bullet List: - ... or * ...
    if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({ id: uid(), type: 'bullet', content: line.substring(2) });
      return;
    }

    // Numbered List: 1. ...
    const numMatch = line.match(/^(\d+)\.\s(.*)/);
    if (numMatch) {
      blocks.push({ id: uid(), type: 'number', content: numMatch[2] });
      return;
    }

    // Blank line
    if (!line.trim()) {
      return;
    }

    // Normal paragraph
    blocks.push({ id: uid(), type: 'p', content: line });
  });

  if (inCode) flushCode();
  if (inTable) flushTable();

  return blocks.length > 0 ? blocks : [{ id: uid(), type: 'p', content: '' }];
}

// ==========================================
// Serializer: NotionBlock[] -> Markdown String
// ==========================================
export function serializeBlocksToMarkdown(blocks: NotionBlock[]): string {
  const parts: string[] = [];

  blocks.forEach((b) => {
    switch (b.type) {
      case 'h1':
        parts.push(`# ${b.content}`);
        break;
      case 'h2':
        parts.push(`## ${b.content}`);
        break;
      case 'h3':
        parts.push(`### ${b.content}`);
        break;
      case 'p':
        parts.push(b.content);
        break;
      case 'bullet':
        parts.push(`- ${b.content}`);
        break;
      case 'number':
        parts.push(`1. ${b.content}`);
        break;
      case 'todo':
        parts.push(`- [${b.checked ? 'x' : ' '}] ${b.content}`);
        break;
      case 'callout':
        parts.push(`> ${b.emoji || '💡'} ${b.content}`);
        break;
      case 'quote':
        parts.push(`> ${b.content}`);
        break;
      case 'code':
        parts.push(`\`\`\`${b.language || 'javascript'}\n${b.content}\n\`\`\``);
        break;
      case 'divider':
        parts.push('---');
        break;
      case 'image':
        if (b.imageUrl) {
          parts.push(`![${b.caption || 'Image'}](${b.imageUrl})`);
        }
        break;
      case 'table':
        if (b.tableData && b.tableData.length > 0) {
          const header = b.tableData[0];
          const rows = b.tableData.slice(1);
          const colCount = Math.max(...b.tableData.map((r) => r.length), 1);

          let mdTable = '| ' + Array.from({ length: colCount }, (_, i) => header[i] || `Col ${i + 1}`).join(' | ') + ' |\n';
          mdTable += '| ' + Array.from({ length: colCount }, () => '---').join(' | ') + ' |\n';
          rows.forEach((row) => {
            mdTable += '| ' + Array.from({ length: colCount }, (_, i) => row[i] || '').join(' | ') + ' |\n';
          });
          parts.push(mdTable.trim());
        }
        break;
    }
  });

  return parts.join('\n\n');
}

export const NotionEditor: React.FC<NotionEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write on the sheet directly, or type \'/\' for blocks...',
  readOnly = false,
}) => {
  const [blocks, setBlocks] = useState<NotionBlock[]>(() => parseMarkdownToBlocks(value));
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  // Slash commands popup state
  const [slashMenu, setSlashMenu] = useState<{
    blockId: string;
    query: string;
    index: number;
  } | null>(null);

  // Upload input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetImageBlockId = useRef<string | null>(null);

  // Synchronize internal blocks if external value changes (e.g. project doc switched)
  const isInternalChange = useRef(false);
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    setBlocks(parseMarkdownToBlocks(value));
  }, [value]);

  // Notify parent of block updates
  const updateBlocks = useCallback(
    (newBlocks: NotionBlock[]) => {
      isInternalChange.current = true;
      setBlocks(newBlocks);
      const serialized = serializeBlocksToMarkdown(newBlocks);
      onChange(serialized);
    },
    [onChange]
  );

  // Update specific block
  const setBlockContent = (id: string, updates: Partial<NotionBlock>) => {
    const next = blocks.map((b) => (b.id === id ? { ...b, ...updates } : b));
    updateBlocks(next);
  };

  const lastFocusedBlockRef = useRef<string | null>(null);

  // Insert new block directly after cursor or target block
  const insertBlockAfter = (targetId?: string | null, type: BlockType = 'p', initialContent = '') => {
    let anchorId = targetId || lastFocusedBlockRef.current || activeBlockId;
    let index = -1;

    if (anchorId) {
      index = blocks.findIndex((b) => b.id === anchorId);
    }
    if (index === -1) {
      index = blocks.length - 1;
    }

    const currentBlock = blocks[index];

    // If current block at cursor is an empty paragraph, transform it directly into the requested block
    if (currentBlock && currentBlock.type === 'p' && !currentBlock.content.trim()) {
      convertBlockType(currentBlock.id, type);
      return;
    }

    const newBlock: NotionBlock = {
      id: uid(),
      type,
      content: initialContent,
      checked: false,
      emoji: '💡',
      tableData:
        type === 'table'
          ? [
              ['Column 1', 'Column 2', 'Column 3'],
              ['Row 1', 'Data', 'Notes'],
              ['Row 2', 'Data', 'Notes'],
            ]
          : undefined,
    };

    const next = [...blocks];
    next.splice(index + 1, 0, newBlock);
    updateBlocks(next);
    lastFocusedBlockRef.current = newBlock.id;
    setActiveBlockId(newBlock.id);

    // Focus newly created block
    setTimeout(() => {
      const el = document.getElementById(`input-${newBlock.id}`);
      if (el) el.focus();
    }, 40);
  };

  // Remove block
  const deleteBlock = (id: string) => {
    if (blocks.length <= 1) {
      updateBlocks([{ id: uid(), type: 'p', content: '' }]);
      return;
    }
    const index = blocks.findIndex((b) => b.id === id);
    const prevBlock = blocks[index - 1] || blocks[index + 1];
    const next = blocks.filter((b) => b.id !== id);
    updateBlocks(next);

    if (prevBlock) {
      setActiveBlockId(prevBlock.id);
      setTimeout(() => {
        const el = document.getElementById(`input-${prevBlock.id}`);
        if (el) el.focus();
      }, 30);
    }
  };

  // Convert block type
  const convertBlockType = (id: string, type: BlockType) => {
    const next = blocks.map((b) => {
      if (b.id !== id) return b;
      return {
        ...b,
        type,
        content: b.content.replace(/^\//, ''),
        emoji: type === 'callout' ? (b.emoji || '💡') : b.emoji,
        tableData:
          type === 'table' && !b.tableData
            ? [
                ['Column 1', 'Column 2', 'Column 3'],
                ['Row 1 Cell 1', 'Row 1 Cell 2', 'Row 1 Cell 3'],
                ['Row 2 Cell 1', 'Row 2 Cell 2', 'Row 2 Cell 3'],
              ]
            : b.tableData,
      };
    });
    updateBlocks(next);
    setSlashMenu(null);

    setTimeout(() => {
      const el = document.getElementById(`input-${id}`);
      if (el) el.focus();
    }, 30);
  };

  // Keyboard navigation on a block
  const handleBlockKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
    block: NotionBlock,
    index: number
  ) => {
    // If slash menu is open
    if (slashMenu && slashMenu.blockId === block.id) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashMenu((prev) => (prev ? { ...prev, index: (prev.index + 1) % slashOptions.length } : null));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashMenu((prev) => (prev ? { ...prev, index: (prev.index - 1 + slashOptions.length) % slashOptions.length } : null));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = slashOptions[slashMenu.index];
        if (selected) {
          convertBlockType(block.id, selected.type);
        }
        return;
      }
      if (e.key === 'Escape') {
        setSlashMenu(null);
        return;
      }
    }

    // Press Enter to create new block
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const target = e.currentTarget;
      const selectionStart = target.selectionStart ?? block.content.length;
      const beforeText = block.content.slice(0, selectionStart);
      const afterText = block.content.slice(selectionStart);

      // If in list or todo, continue the same type
      if (block.type === 'bullet' || block.type === 'number' || block.type === 'todo') {
        if (!block.content.trim()) {
          // If empty list item, convert to normal paragraph
          convertBlockType(block.id, 'p');
          return;
        }
        setBlockContent(block.id, { content: beforeText });
        insertBlockAfter(block.id, block.type, afterText);
      } else {
        setBlockContent(block.id, { content: beforeText });
        insertBlockAfter(block.id, 'p', afterText);
      }
      return;
    }

    // Press Backspace in empty block to delete or convert
    if (e.key === 'Backspace' && !block.content) {
      if (block.type !== 'p') {
        e.preventDefault();
        convertBlockType(block.id, 'p');
      } else if (blocks.length > 1) {
        e.preventDefault();
        deleteBlock(block.id);
      }
      return;
    }

    // Arrow Up / Down navigation
    if (e.key === 'ArrowUp' && index > 0) {
      const prevBlock = blocks[index - 1];
      const el = document.getElementById(`input-${prevBlock.id}`);
      if (el) el.focus();
    }
    if (e.key === 'ArrowDown' && index < blocks.length - 1) {
      const nextBlock = blocks[index + 1];
      const el = document.getElementById(`input-${nextBlock.id}`);
      if (el) el.focus();
    }
  };

  // Monitor text for '/'
  const handleBlockInput = (id: string, text: string) => {
    setBlockContent(id, { content: text });

    if (text.startsWith('/')) {
      const query = text.substring(1).toLowerCase();
      setSlashMenu({ blockId: id, query, index: 0 });
    } else {
      setSlashMenu(null);
    }
  };

  // Image Upload Handler
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetImageBlockId.current) return;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/api/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.fileUrl) {
        setBlockContent(targetImageBlockId.current, {
          imageUrl: res.data.fileUrl,
          caption: file.name,
        });
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to upload image');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Slash menu block options
  const allSlashOptions: { type: BlockType; title: string; desc: string; icon: any }[] = [
    { type: 'p', title: 'Text', desc: 'Plain writing text block', icon: AlignLeft },
    { type: 'h1', title: 'Heading 1', desc: 'Large section heading', icon: Heading1 },
    { type: 'h2', title: 'Heading 2', desc: 'Medium section heading', icon: Heading2 },
    { type: 'h3', title: 'Heading 3', desc: 'Small section heading', icon: Heading3 },
    { type: 'todo', title: 'To-do List', desc: 'Interactive task checkbox', icon: CheckSquare },
    { type: 'bullet', title: 'Bulleted List', desc: 'Simple bullet point list', icon: List },
    { type: 'number', title: 'Numbered List', desc: 'Numbered step list', icon: ListOrdered },
    { type: 'table', title: 'Table', desc: 'Interactive sheet table with cells', icon: TableIcon },
    { type: 'callout', title: 'Callout', desc: 'Standout box with emoji accent', icon: Sparkles },
    { type: 'quote', title: 'Quote', desc: 'Styled quotation block', icon: Quote },
    { type: 'code', title: 'Code Block', desc: 'Syntax highlighted code container', icon: FileCode },
    { type: 'image', title: 'Picture / Image', desc: 'Upload or embed image on sheet', icon: ImageIcon },
    { type: 'divider', title: 'Divider', desc: 'Horizontal line separator', icon: Minus },
  ];

  const slashOptions = allSlashOptions.filter((opt) =>
    slashMenu?.query
      ? opt.title.toLowerCase().includes(slashMenu.query) || opt.desc.toLowerCase().includes(slashMenu.query)
      : true
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-text">
      {/* Hidden File Input for Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUploadFile}
        className="hidden"
      />

      {/* ========================================== */}
      {/* 1. Floating WYSIWYG Formatting Toolbar     */}
      {/* ========================================== */}
      {!readOnly && (
        <div
          className="border-b px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto shrink-0 select-none shadow-sm"
          style={{
            backgroundColor: 'var(--theme-bg-surface)',
            borderColor: 'var(--theme-border)',
          }}
        >
          {/* Quick Insert Blocks */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-50 mr-1 hidden sm:inline"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              Insert on Sheet:
            </span>

            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertBlockAfter(lastFocusedBlockRef.current || activeBlockId, 'h1')}
              title="Add Heading 1 at cursor"
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition flex items-center gap-1 text-xs font-bold"
            >
              <Heading1 size={15} />
              <span className="hidden md:inline text-[11px]">H1</span>
            </button>

            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertBlockAfter(lastFocusedBlockRef.current || activeBlockId, 'h2')}
              title="Add Heading 2 at cursor"
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition flex items-center gap-1 text-xs font-bold"
            >
              <Heading2 size={15} />
              <span className="hidden md:inline text-[11px]">H2</span>
            </button>

            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertBlockAfter(lastFocusedBlockRef.current || activeBlockId, 'todo')}
              title="Add To-do Task at cursor"
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition flex items-center gap-1 text-xs"
            >
              <CheckSquare size={15} className="text-emerald-400" />
              <span className="hidden md:inline text-[11px]">To-do</span>
            </button>

            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertBlockAfter(lastFocusedBlockRef.current || activeBlockId, 'bullet')}
              title="Add Bulleted List at cursor"
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition"
            >
              <List size={15} />
            </button>

            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertBlockAfter(lastFocusedBlockRef.current || activeBlockId, 'table')}
              title="Add Interactive Table at cursor"
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition flex items-center gap-1 text-xs"
            >
              <TableIcon size={15} className="text-blue-400" />
              <span className="hidden md:inline text-[11px]">Table</span>
            </button>

            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertBlockAfter(lastFocusedBlockRef.current || activeBlockId, 'image')}
              title="Add Picture / Image at cursor"
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition flex items-center gap-1 text-xs"
            >
              <ImageIcon size={15} className="text-pink-400" />
              <span className="hidden md:inline text-[11px]">Picture</span>
            </button>

            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertBlockAfter(lastFocusedBlockRef.current || activeBlockId, 'callout')}
              title="Add Callout Box at cursor"
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition flex items-center gap-1 text-xs"
            >
              <Sparkles size={15} className="text-amber-400" />
              <span className="hidden md:inline text-[11px]">Callout</span>
            </button>

            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertBlockAfter(lastFocusedBlockRef.current || activeBlockId, 'quote')}
              title="Add Quote at cursor"
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition"
            >
              <Quote size={15} />
            </button>

            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertBlockAfter(lastFocusedBlockRef.current || activeBlockId, 'code')}
              title="Add Code Block at cursor"
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition"
            >
              <FileCode size={15} />
            </button>

            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertBlockAfter(lastFocusedBlockRef.current || activeBlockId, 'divider')}
              title="Add Divider at cursor"
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition"
            >
              <Minus size={15} />
            </button>
          </div>

          <div className="text-[11px] opacity-60 font-medium hidden lg:flex items-center gap-1"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            <span>Type</span>
            <kbd className="px-1.5 py-0.5 rounded border text-[10px] bg-black/10 dark:bg-white/10">/</kbd>
            <span>anywhere to insert blocks</span>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 2. WYSIWYG Document Canvas Sheet           */}
      {/* ========================================== */}
      <div
        className="flex-1 overflow-y-auto px-4 sm:px-8 md:px-12 py-6 space-y-1 relative"
        onClick={() => {
          if (blocks.length === 0) {
            insertBlockAfter('', 'p');
          }
        }}
      >
        {blocks.map((block, index) => (
          <div
            key={block.id}
            className="group relative flex items-start gap-2 -ml-6 pl-6 py-0.5 rounded-lg transition-all"
            onClick={() => {
              lastFocusedBlockRef.current = block.id;
              setActiveBlockId(block.id);
            }}
          >
            {/* Left Gutter Controls (Appears on Hover) */}
            {!readOnly && (
              <div className="absolute left-0 top-1 opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5 select-none z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    insertBlockAfter(block.id, 'p');
                  }}
                  title="Add block below"
                  className="p-0.5 rounded opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
                >
                  <Plus size={13} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteBlock(block.id);
                  }}
                  title="Delete block"
                  className="p-0.5 rounded text-red-400 opacity-60 hover:opacity-100 hover:bg-red-500/10"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}

            {/* Block Body Rendered Directly on Sheet */}
            <div className="flex-1 min-w-0">
              {/* Heading 1 */}
              {block.type === 'h1' && (
                <AutoGrowingInput
                  id={`input-${block.id}`}
                  value={block.content}
                  onChange={(val) => handleBlockInput(block.id, val)}
                  onKeyDown={(e) => handleBlockKeyDown(e, block, index)}
                  onFocus={() => {
                    lastFocusedBlockRef.current = block.id;
                    setActiveBlockId(block.id);
                  }}
                  placeholder="Heading 1"
                  readOnly={readOnly}
                  className="text-2xl md:text-3xl font-extrabold tracking-tight mt-4 mb-1 border-b pb-1"
                />
              )}

              {/* Heading 2 */}
              {block.type === 'h2' && (
                <AutoGrowingInput
                  id={`input-${block.id}`}
                  value={block.content}
                  onChange={(val) => handleBlockInput(block.id, val)}
                  onKeyDown={(e) => handleBlockKeyDown(e, block, index)}
                  onFocus={() => {
                    lastFocusedBlockRef.current = block.id;
                    setActiveBlockId(block.id);
                  }}
                  placeholder="Heading 2"
                  readOnly={readOnly}
                  className="text-xl md:text-2xl font-bold tracking-tight mt-3 mb-1"
                />
              )}

              {/* Heading 3 */}
              {block.type === 'h3' && (
                <AutoGrowingInput
                  id={`input-${block.id}`}
                  value={block.content}
                  onChange={(val) => handleBlockInput(block.id, val)}
                  onKeyDown={(e) => handleBlockKeyDown(e, block, index)}
                  onFocus={() => {
                    lastFocusedBlockRef.current = block.id;
                    setActiveBlockId(block.id);
                  }}
                  placeholder="Heading 3"
                  readOnly={readOnly}
                  className="text-base md:text-lg font-bold tracking-tight mt-2 mb-0.5"
                />
              )}

              {/* Paragraph */}
              {block.type === 'p' && (
                <AutoGrowingInput
                  id={`input-${block.id}`}
                  value={block.content}
                  onChange={(val) => handleBlockInput(block.id, val)}
                  onKeyDown={(e) => handleBlockKeyDown(e, block, index)}
                  onFocus={() => {
                    lastFocusedBlockRef.current = block.id;
                    setActiveBlockId(block.id);
                  }}
                  placeholder={index === 0 ? placeholder : 'Write text directly on sheet or type \'/\'...'}
                  readOnly={readOnly}
                  className="text-sm md:text-base leading-relaxed py-0.5"
                />
              )}

              {/* To-do / Checklist (Interactive Checkbox on Sheet) */}
              {block.type === 'todo' && (
                <div className="flex items-start gap-2.5 py-0.5">
                  <input
                    type="checkbox"
                    checked={block.checked || false}
                    onChange={(e) => setBlockContent(block.id, { checked: e.target.checked })}
                    className="mt-1.5 rounded cursor-pointer accent-emerald-500 w-4 h-4"
                  />
                  <AutoGrowingInput
                    id={`input-${block.id}`}
                    value={block.content}
                    onChange={(val) => handleBlockInput(block.id, val)}
                    onKeyDown={(e) => handleBlockKeyDown(e, block, index)}
                    onFocus={() => {
                      lastFocusedBlockRef.current = block.id;
                      setActiveBlockId(block.id);
                    }}
                    placeholder="To-do task"
                    readOnly={readOnly}
                    className={`text-sm md:text-base leading-relaxed flex-1 ${
                      block.checked ? 'line-through opacity-50' : ''
                    }`}
                  />
                </div>
              )}

              {/* Bullet List */}
              {block.type === 'bullet' && (
                <div className="flex items-start gap-2.5 py-0.5">
                  <span className="text-lg leading-none mt-1 opacity-70 select-none">•</span>
                  <AutoGrowingInput
                    id={`input-${block.id}`}
                    value={block.content}
                    onChange={(val) => handleBlockInput(block.id, val)}
                    onKeyDown={(e) => handleBlockKeyDown(e, block, index)}
                    onFocus={() => {
                      lastFocusedBlockRef.current = block.id;
                      setActiveBlockId(block.id);
                    }}
                    placeholder="List item"
                    readOnly={readOnly}
                    className="text-sm md:text-base leading-relaxed flex-1"
                  />
                </div>
              )}

              {/* Numbered List */}
              {block.type === 'number' && (
                <div className="flex items-start gap-2 py-0.5">
                  <span className="text-xs font-semibold mt-1 opacity-70 select-none w-5 text-right shrink-0">
                    {index + 1}.
                  </span>
                  <AutoGrowingInput
                    id={`input-${block.id}`}
                    value={block.content}
                    onChange={(val) => handleBlockInput(block.id, val)}
                    onKeyDown={(e) => handleBlockKeyDown(e, block, index)}
                    onFocus={() => {
                      lastFocusedBlockRef.current = block.id;
                      setActiveBlockId(block.id);
                    }}
                    placeholder="Numbered step"
                    readOnly={readOnly}
                    className="text-sm md:text-base leading-relaxed flex-1"
                  />
                </div>
              )}

              {/* Callout Box (Editable Directly on Sheet) */}
              {block.type === 'callout' && (
                <div
                  className="p-3.5 my-2 rounded-xl border flex items-start gap-3 shadow-sm transition"
                  style={{
                    backgroundColor: 'var(--theme-bg-surface)',
                    borderColor: 'var(--theme-border)',
                    borderLeftWidth: '4px',
                    borderLeftColor: 'var(--theme-primary)',
                  }}
                >
                  <span className="text-xl shrink-0 select-none">{block.emoji || '💡'}</span>
                  <AutoGrowingInput
                    id={`input-${block.id}`}
                    value={block.content}
                    onChange={(val) => handleBlockInput(block.id, val)}
                    onKeyDown={(e) => handleBlockKeyDown(e, block, index)}
                    onFocus={() => {
                      lastFocusedBlockRef.current = block.id;
                      setActiveBlockId(block.id);
                    }}
                    placeholder="Important note or callout message..."
                    readOnly={readOnly}
                    className="text-sm leading-relaxed flex-1"
                  />
                </div>
              )}

              {/* Blockquote */}
              {block.type === 'quote' && (
                <div
                  className="border-l-4 pl-3.5 py-1 my-2 rounded-r italic"
                  style={{
                    borderLeftColor: 'var(--theme-primary)',
                    backgroundColor: 'var(--theme-bg-surface)',
                    color: 'var(--theme-text-muted)',
                  }}
                >
                  <AutoGrowingInput
                    id={`input-${block.id}`}
                    value={block.content}
                    onChange={(val) => handleBlockInput(block.id, val)}
                    onKeyDown={(e) => handleBlockKeyDown(e, block, index)}
                    onFocus={() => {
                      lastFocusedBlockRef.current = block.id;
                      setActiveBlockId(block.id);
                    }}
                    placeholder="Quotation..."
                    readOnly={readOnly}
                    className="text-sm leading-relaxed italic"
                  />
                </div>
              )}

              {/* Code Block (Directly Editable on Sheet) */}
              {block.type === 'code' && (
                <div
                  className="rounded-xl border p-3 my-2 font-mono text-xs overflow-hidden"
                  style={{
                    backgroundColor: 'var(--theme-bg-surface)',
                    borderColor: 'var(--theme-border)',
                  }}
                >
                  <div
                    className="flex items-center justify-between pb-2 mb-2 border-b opacity-60 text-[10px]"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    <input
                      type="text"
                      value={block.language || 'javascript'}
                      onChange={(e) => setBlockContent(block.id, { language: e.target.value })}
                      onFocus={() => {
                        lastFocusedBlockRef.current = block.id;
                        setActiveBlockId(block.id);
                      }}
                      className="bg-transparent font-mono focus:outline-none w-24"
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(block.content)}
                      className="hover:opacity-100 flex items-center gap-1 transition"
                    >
                      <Copy size={11} /> Copy
                    </button>
                  </div>
                  <textarea
                    id={`input-${block.id}`}
                    value={block.content}
                    onChange={(e) => setBlockContent(block.id, { content: e.target.value })}
                    onFocus={() => {
                      lastFocusedBlockRef.current = block.id;
                      setActiveBlockId(block.id);
                    }}
                    placeholder="// Write code here..."
                    rows={Math.max(block.content.split('\n').length, 3)}
                    readOnly={readOnly}
                    className="w-full bg-transparent resize-none font-mono focus:outline-none text-xs leading-relaxed"
                    style={{ color: 'var(--theme-text-primary)' }}
                  />
                </div>
              )}

              {/* Interactive Sheet Table (Click in any cell to edit directly) */}
              {block.type === 'table' && (
                <InteractiveSheetTable
                  data={block.tableData || [['Header 1', 'Header 2'], ['Cell 1', 'Cell 2']]}
                  onChange={(newData) => setBlockContent(block.id, { tableData: newData })}
                  onFocus={() => {
                    lastFocusedBlockRef.current = block.id;
                    setActiveBlockId(block.id);
                  }}
                  readOnly={readOnly}
                />
              )}

              {/* Picture / Image Block (Rendered directly on sheet) */}
              {block.type === 'image' && (
                <InteractiveSheetImage
                  imageUrl={block.imageUrl}
                  caption={block.caption}
                  onUploadRequest={() => {
                    targetImageBlockId.current = block.id;
                    fileInputRef.current?.click();
                  }}
                  onUpdate={(imgUrl, caption) =>
                    setBlockContent(block.id, { imageUrl: imgUrl, caption })
                  }
                  onDelete={() => deleteBlock(block.id)}
                  onFocus={() => {
                    lastFocusedBlockRef.current = block.id;
                    setActiveBlockId(block.id);
                  }}
                  readOnly={readOnly}
                />
              )}

              {/* Divider */}
              {block.type === 'divider' && (
                <div
                  className="py-3 select-none"
                  onClick={() => {
                    lastFocusedBlockRef.current = block.id;
                    setActiveBlockId(block.id);
                  }}
                >
                  <hr
                    className="border-t transition"
                    style={{ borderColor: 'var(--theme-border)' }}
                  />
                </div>
              )}
            </div>

            {/* Floating Slash Commands Menu at Active Block */}
            {slashMenu && slashMenu.blockId === block.id && (
              <div
                className="absolute left-6 top-full mt-1 z-50 w-72 rounded-xl border p-1.5 shadow-2xl backdrop-blur-md max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
                style={{
                  backgroundColor: 'var(--theme-bg-surface)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              >
                <div
                  className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider opacity-50 border-b mb-1"
                  style={{
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-muted)',
                  }}
                >
                  Turn Into / Insert Block
                </div>

                {slashOptions.map((opt, oIdx) => {
                  const OptIcon = opt.icon;
                  const isSelected = oIdx === slashMenu.index;
                  return (
                    <button
                      key={opt.type}
                      onClick={() => convertBlockType(block.id, opt.type)}
                      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition ${
                        isSelected ? 'shadow-sm font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: isSelected
                          ? 'var(--theme-bg-surface-hover)'
                          : 'transparent',
                      }}
                    >
                      <div
                        className="p-1.5 rounded-lg border shrink-0"
                        style={{
                          borderColor: 'var(--theme-border)',
                          backgroundColor: 'var(--theme-bg-surface)',
                          color: 'var(--theme-primary)',
                        }}
                      >
                        <OptIcon size={15} />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold leading-tight">{opt.title}</div>
                        <div
                          className="text-[10px] truncate opacity-70 leading-tight"
                          style={{ color: 'var(--theme-text-muted)' }}
                        >
                          {opt.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ==========================================
// Auto-Growing Inline Text Input Component
// ==========================================
interface AutoGrowingInputProps {
  id: string;
  value: string;
  onChange: (val: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}

const AutoGrowingInput: React.FC<AutoGrowingInputProps> = ({
  id,
  value,
  onChange,
  onKeyDown,
  onFocus,
  placeholder,
  className = '',
  readOnly = false,
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  return (
    <textarea
      id={id}
      ref={ref}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        resize();
      }}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      placeholder={placeholder}
      readOnly={readOnly}
      rows={1}
      className={`w-full bg-transparent resize-none focus:outline-none placeholder:opacity-30 overflow-hidden ${className}`}
      style={{
        color: 'var(--theme-text-primary)',
        borderColor: 'var(--theme-border)',
      }}
    />
  );
};

// ==========================================
// Interactive Sheet Table Component
// ==========================================
interface InteractiveSheetTableProps {
  data: string[][];
  onChange: (data: string[][]) => void;
  onFocus?: () => void;
  readOnly?: boolean;
}

const InteractiveSheetTable: React.FC<InteractiveSheetTableProps> = ({
  data,
  onChange,
  onFocus,
  readOnly = false,
}) => {
  const numRows = data.length;
  const numCols = Math.max(...data.map((r) => r.length), 1);

  const handleCellChange = (rIdx: number, cIdx: number, val: string) => {
    const next = data.map((r, rI) => {
      if (rI !== rIdx) return [...r];
      const newRow = [...r];
      newRow[cIdx] = val;
      return newRow;
    });
    onChange(next);
  };

  const addRow = () => {
    onFocus?.();
    const newRow = Array.from({ length: numCols }, () => '');
    onChange([...data, newRow]);
  };

  const addCol = () => {
    onFocus?.();
    const next = data.map((row) => [...row, '']);
    onChange(next);
  };

  const deleteRow = (rIdx: number) => {
    onFocus?.();
    if (data.length <= 1) return;
    onChange(data.filter((_, i) => i !== rIdx));
  };

  const deleteCol = (cIdx: number) => {
    onFocus?.();
    if (numCols <= 1) return;
    const next = data.map((row) => row.filter((_, i) => i !== cIdx));
    onChange(next);
  };

  return (
    <div
      onClick={onFocus}
      className="my-3 overflow-x-auto rounded-xl border group relative"
      style={{
        borderColor: 'var(--theme-border)',
        backgroundColor: 'var(--theme-bg-surface)',
      }}
    >
      <table className="w-full text-xs border-collapse">
        <tbody>
          {data.map((row, rIdx) => (
            <tr
              key={rIdx}
              className={`border-b last:border-b-0 transition ${
                rIdx === 0
                  ? 'font-bold'
                  : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              style={{
                backgroundColor: rIdx === 0 ? 'var(--theme-bg-surface-hover)' : 'transparent',
                borderColor: 'var(--theme-border)',
              }}
            >
              {Array.from({ length: numCols }).map((_, cIdx) => (
                <td
                  key={cIdx}
                  className="p-1 border-r last:border-r-0 relative group/cell"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  <input
                    type="text"
                    value={row[cIdx] || ''}
                    onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                    onFocus={onFocus}
                    placeholder={rIdx === 0 ? `Header ${cIdx + 1}` : '...'}
                    readOnly={readOnly}
                    className={`w-full px-2 py-1.5 bg-transparent focus:outline-none text-xs ${
                      rIdx === 0 ? 'font-bold' : ''
                    }`}
                    style={{ color: 'var(--theme-text-primary)' }}
                  />
                </td>
              ))}

              {/* Row delete button */}
              {!readOnly && numRows > 1 && (
                <td className="w-8 text-center opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => deleteRow(rIdx)}
                    title="Delete row"
                    className="p-1 text-red-400 hover:bg-red-500/10 rounded"
                  >
                    <Trash2 size={11} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Table controls */}
      {!readOnly && (
        <div
          className="p-2 border-t flex items-center justify-between text-xs opacity-70 group-hover:opacity-100 transition"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-app)' }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={addRow}
              className="px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <Plus size={12} /> Add Row
            </button>
            <button
              onClick={addCol}
              className="px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <Plus size={12} /> Add Column
            </button>
          </div>

          <span className="text-[10px] opacity-60">
            {numRows} rows × {numCols} cols
          </span>
        </div>
      )}
    </div>
  );
};

// ==========================================
// Interactive Sheet Image Component
// ==========================================
interface InteractiveSheetImageProps {
  imageUrl?: string;
  caption?: string;
  onUploadRequest: () => void;
  onUpdate: (url: string, caption: string) => void;
  onDelete: () => void;
  onFocus?: () => void;
  readOnly?: boolean;
}

const InteractiveSheetImage: React.FC<InteractiveSheetImageProps> = ({
  imageUrl,
  caption,
  onUploadRequest,
  onUpdate,
  onDelete,
  onFocus,
  readOnly = false,
}) => {
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  if (!imageUrl) {
    return (
      <div
        onClick={onFocus}
        className="my-3 border-2 border-dashed rounded-2xl p-6 text-center space-y-3 transition"
        style={{
          borderColor: 'var(--theme-border)',
          backgroundColor: 'var(--theme-bg-surface)',
        }}
      >
        <div
          className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center border shadow-sm"
          style={{
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-primary)',
          }}
        >
          <ImageIcon size={20} />
        </div>

        <div>
          <h4 className="text-xs font-bold">Add Picture to Sheet</h4>
          <p className="text-[11px] opacity-60" style={{ color: 'var(--theme-text-muted)' }}>
            Upload directly or paste image URL
          </p>
        </div>

        {!showUrlInput ? (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => {
                onFocus?.();
                onUploadRequest();
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow transition flex items-center gap-1.5"
              style={{
                backgroundColor: 'var(--theme-primary)',
                color: 'var(--theme-primary-text)',
              }}
            >
              <Upload size={13} />
              <span>Upload Picture</span>
            </button>
            <button
              onClick={() => {
                onFocus?.();
                setShowUrlInput(true);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition hover:bg-black/5 dark:hover:bg-white/5"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              Embed Link
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 max-w-sm mx-auto">
            <input
              type="url"
              placeholder="https://example.com/image.png"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onFocus={onFocus}
              className="flex-1 px-3 py-1.5 rounded-xl border text-xs bg-transparent focus:outline-none"
              style={{ borderColor: 'var(--theme-border)' }}
            />
            <button
              onClick={() => {
                onFocus?.();
                if (urlInput.trim()) {
                  onUpdate(urlInput.trim(), caption || '');
                }
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold shadow transition"
              style={{
                backgroundColor: 'var(--theme-primary)',
                color: 'var(--theme-primary-text)',
              }}
            >
              Embed
            </button>
            <button
              onClick={() => setShowUrlInput(false)}
              className="p-1.5 rounded-lg opacity-60 hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onFocus}
      className="my-3 rounded-2xl border overflow-hidden group relative transition shadow-sm"
      style={{
        borderColor: 'var(--theme-border)',
        backgroundColor: 'var(--theme-bg-surface)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={caption || 'Picture'}
        className="w-full max-h-[500px] object-contain bg-black/10 dark:bg-black/30"
      />

      {/* Delete / Replace Controls */}
      {!readOnly && (
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition flex items-center gap-1.5 z-10">
          <button
            onClick={() => {
              onFocus?.();
              onUploadRequest();
            }}
            title="Replace image"
            className="px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur-md bg-black/60 text-white hover:bg-black/80 transition"
          >
            Replace
          </button>
          <button
            onClick={() => {
              onFocus?.();
              onDelete();
            }}
            title="Remove image"
            className="p-1 rounded-lg backdrop-blur-md bg-red-500/80 text-white hover:bg-red-600 transition"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* Editable Caption */}
      <div
        className="p-2 border-t text-center"
        style={{ borderColor: 'var(--theme-border)' }}
      >
        <input
          type="text"
          value={caption || ''}
          onChange={(e) => onUpdate(imageUrl, e.target.value)}
          onFocus={onFocus}
          placeholder="Write a caption..."
          readOnly={readOnly}
          className="w-full text-center text-xs italic bg-transparent focus:outline-none opacity-70 hover:opacity-100"
          style={{ color: 'var(--theme-text-muted)' }}
        />
      </div>
    </div>
  );
};
