'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Channel, UserProfile } from '@orbit/types';
import {
  MousePointer,
  Hand,
  Pencil,
  Square,
  Circle,
  ArrowRight,
  Minus,
  StickyNote,
  Type,
  Eraser,
  Undo2,
  Redo2,
  Download,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Users,
  X,
  Bold,
  Heading1,
  Heading2,
  List,
} from 'lucide-react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';

// Convert stored markdown to live HTML for contentEditable
function markdownToHtml(md: string): string {
  if (!md) return '';
  const lines = md.split('\n');
  let inList = false;
  let inOrdered = false;
  let html = '';

  const formatInline = (str: string) => {
    return str
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\*([^*]+)\*/g, '<i>$1</i>')
      .replace(/~~([^~]+)~~/g, '<s>$1</s>')
      .replace(/`([^`]+)`/g, '<code class="bg-[#2C3136] text-[#ECB22E] px-1 py-0.5 rounded font-mono text-xs">$1</code>');
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('# ')) {
      if (inList) { html += '</ul>'; inList = false; }
      if (inOrdered) { html += '</ol>'; inOrdered = false; }
      html += `<h1>${formatInline(line.slice(2))}</h1>`;
    } else if (line.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false; }
      if (inOrdered) { html += '</ol>'; inOrdered = false; }
      html += `<h2>${formatInline(line.slice(3))}</h2>`;
    } else if (line.startsWith('### ')) {
      if (inList) { html += '</ul>'; inList = false; }
      if (inOrdered) { html += '</ol>'; inOrdered = false; }
      html += `<h3>${formatInline(line.slice(4))}</h3>`;
    } else if (line.startsWith('> ')) {
      if (inList) { html += '</ul>'; inList = false; }
      if (inOrdered) { html += '</ol>'; inOrdered = false; }
      html += `<blockquote>${formatInline(line.slice(2))}</blockquote>`;
    } else if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
      if (inOrdered) { html += '</ol>'; inOrdered = false; }
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${formatInline(line.slice(2))}</li>`;
    } else if (/^\d+\.\s/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; }
      if (!inOrdered) { html += '<ol>'; inOrdered = true; }
      html += `<li>${formatInline(line.replace(/^\d+\.\s*/, ''))}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (inOrdered) { html += '</ol>'; inOrdered = false; }
      if (line.trim() === '') {
        html += '<div><br></div>';
      } else {
        html += `<div>${formatInline(line)}</div>`;
      }
    }
  }

  if (inList) html += '</ul>';
  if (inOrdered) html += '</ol>';
  return html;
}

// Convert live contentEditable HTML to clean markdown for storage & drawing
function htmlToMarkdown(html: string): string {
  if (!html) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  function nodeToMd(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const children = Array.from(el.childNodes).map(nodeToMd).join('');

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
        return children.trim() ? `\`${children.trim()}\`` : '';
      case 'blockquote': {
        const lines = children.trim().split('\n');
        return `\n${lines.map((l) => `> ${l}`).join('\n')}\n`;
      }
      case 'ul':
      case 'ol':
        return `\n${children.trim()}\n`;
      case 'li':
        return `- ${children.trim()}\n`;
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
  return rawMd.replace(/\n{3,}/g, '\n\n').trim();
}

export type ToolType =
  | 'select'
  | 'hand'
  | 'pen'
  | 'rect'
  | 'circle'
  | 'arrow'
  | 'line'
  | 'sticky'
  | 'text'
  | 'eraser';

export interface CanvasElement {
  id: string;
  type: ToolType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[];
  color: string;
  fillColor?: string;
  strokeWidth: number;
  text?: string;
  fontSize?: number;
  isBold?: boolean;
}

interface PeerCursor {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  color: string;
  x: number;
  y: number;
  lastActive: number;
}

interface WhiteboardViewProps {
  channel: Channel;
  currentUser: UserProfile | null;
  onClose?: () => void;
}

const COLOR_PALETTE = [
  '#FFFFFF', // White
  '#007A5A', // Slack Green
  '#36C5F0', // Slack Cyan
  '#ECB22E', // Slack Gold
  '#E01E5A', // Slack Red
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#64748B', // Slate
];

const STICKY_COLORS = [
  { bg: '#FEF08A', text: '#713F12', border: '#FACC15', label: 'Yellow' },
  { bg: '#BAE6FD', text: '#0C4A6E', border: '#38BDF8', label: 'Blue' },
  { bg: '#BBF7D0', text: '#14532D', border: '#4ADE80', label: 'Green' },
  { bg: '#FBCFE8', text: '#831843', border: '#F472B6', label: 'Pink' },
  { bg: '#DDD6FE', text: '#4C1D95', border: '#A78BFA', label: 'Purple' },
];

const FONT_SIZES = [
  { label: 'S', size: 14, tooltip: 'Small text (14px)' },
  { label: 'M', size: 18, tooltip: 'Medium text (18px)' },
  { label: 'L', size: 24, tooltip: 'Large text (24px)' },
  { label: 'XL', size: 32, tooltip: 'Extra Large text (32px)' },
];

export const WhiteboardView: React.FC<WhiteboardViewProps> = ({
  channel,
  currentUser,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inlineContentEditableRef = useRef<HTMLDivElement | null>(null);

  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [activeColor, setActiveColor] = useState<string>('#007A5A');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [stickyColorIdx, setStickyColorIdx] = useState<number>(0);

  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [history, setHistory] = useState<CanvasElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Drawing & Interaction State
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentElement, setCurrentElement] = useState<CanvasElement | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Dragging elements state
  const [isDraggingElement, setIsDraggingElement] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Direct Inline In-Place Live WYSIWYG Text Editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');

  // Infinite Pan & Zoom
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);

  const [peerCursors, setPeerCursors] = useState<{ [userId: string]: PeerCursor }>({});
  const [activeUsersCount, setActiveUsersCount] = useState<number>(1);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch channel whiteboard data on load
  useEffect(() => {
    let isMounted = true;
    const loadWhiteboard = async () => {
      try {
        const res = await api.get(`/api/channels/${channel.id}/whiteboard`);
        if (isMounted && res.data.whiteboardData?.elements) {
          const loaded = res.data.whiteboardData.elements;
          setElements(loaded);
          setHistory([loaded]);
          setHistoryIndex(0);
        }
      } catch (err) {
        console.error('Failed to load whiteboard', err);
      }
    };

    loadWhiteboard();
    return () => {
      isMounted = false;
    };
  }, [channel.id]);

  // 2. Debounced Auto-save to Server
  const saveWhiteboardToServer = useCallback(
    (newElements: CanvasElement[]) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          setIsSaving(true);
          await api.put(`/api/channels/${channel.id}/whiteboard`, {
            whiteboardData: { elements: newElements },
          });
        } catch (err) {
          console.error('Failed to auto-save whiteboard', err);
        } finally {
          setIsSaving(false);
        }
      }, 1000);
    },
    [channel.id]
  );

  // History Commit
  const commitElements = (newElements: CanvasElement[]) => {
    setElements(newElements);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    saveWhiteboardToServer(newElements);

    const socket = getSocket();
    socket.emit('whiteboard:update', {
      channelId: channel.id,
      data: { elements: newElements },
    });
  };

  // Start in-place editing
  const startEditing = useCallback((elementId: string, initialText: string) => {
    setEditingId(elementId);
    setEditText(initialText);
  }, []);

  // Finish in-place editing and commit changes
  const finishEditing = useCallback(
    (idToFinish?: string) => {
      const targetId = idToFinish || editingId;
      if (!targetId) return;

      const currentHtml = inlineContentEditableRef.current?.innerHTML || '';
      const currentMd = htmlToMarkdown(currentHtml) || editText;

      setElements((prev) => {
        const el = prev.find((item) => item.id === targetId);
        if (!el) return prev;

        // Clean up empty standalone text boxes
        if (el.type === 'text' && !currentMd.trim()) {
          const filtered = prev.filter((item) => item.id !== targetId);
          saveWhiteboardToServer(filtered);
          getSocket().emit('whiteboard:update', {
            channelId: channel.id,
            data: { elements: filtered },
          });
          return filtered;
        }

        const updated = prev.map((item) =>
          item.id === targetId ? { ...item, text: currentMd } : item
        );
        saveWhiteboardToServer(updated);
        getSocket().emit('whiteboard:update', {
          channelId: channel.id,
          data: { elements: updated },
        });
        return updated;
      });

      setEditingId(null);
      setEditText('');
    },
    [editingId, editText, channel.id, saveWhiteboardToServer]
  );

  // Auto-focus contentEditable and load initial HTML whenever editingId changes
  useEffect(() => {
    if (editingId && inlineContentEditableRef.current) {
      const editor = inlineContentEditableRef.current;
      editor.innerHTML = markdownToHtml(editText);
      const timer = setTimeout(() => {
        if (editor) {
          editor.focus();
          const sel = window.getSelection();
          if (sel) {
            sel.selectAllChildren(editor);
            sel.collapseToEnd();
          }
        }
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [editingId, editText]);

  // 2. Real-time collaboration socket listeners
  useEffect(() => {
    const socket = getSocket(currentUser?.id, channel.workspaceId);
    socket.emit('channel:join', channel.id);

    const onWhiteboardUpdate = (payload: { channelId: string; data: any; userId: string }) => {
      if (payload.channelId === channel.id && payload.userId !== currentUser?.id) {
        if (payload.data?.elements) {
          setElements(payload.data.elements);
        }
      }
    };

    const onWhiteboardCursor = (payload: {
      channelId: string;
      cursor: { x: number; y: number };
      user: { displayName: string; avatarUrl?: string };
      userId: string;
    }) => {
      if (payload.channelId === channel.id && payload.userId !== currentUser?.id) {
        setPeerCursors((prev) => ({
          ...prev,
          [payload.userId]: {
            userId: payload.userId,
            displayName: payload.user.displayName,
            avatarUrl: payload.user.avatarUrl,
            color: '#36C5F0',
            x: payload.cursor.x,
            y: payload.cursor.y,
            lastActive: Date.now(),
          },
        }));
      }
    };

    const onWhiteboardClear = (payload: { channelId: string }) => {
      if (payload.channelId === channel.id) {
        setElements([]);
        setHistory([[]]);
        setHistoryIndex(0);
        setSelectedElementId(null);
        setEditingId(null);
      }
    };

    socket.on('whiteboard:update', onWhiteboardUpdate);
    socket.on('whiteboard:cursor', onWhiteboardCursor);
    socket.on('whiteboard:clear', onWhiteboardClear);

    const cursorInterval = setInterval(() => {
      const now = Date.now();
      setPeerCursors((prev) => {
        const next: { [id: string]: PeerCursor } = {};
        let count = 1;
        Object.entries(prev).forEach(([uid, cursor]) => {
          if (now - cursor.lastActive < 5000) {
            next[uid] = cursor;
            count++;
          }
        });
        setActiveUsersCount(count);
        return next;
      });
    }, 3000);

    return () => {
      socket.off('whiteboard:update', onWhiteboardUpdate);
      socket.off('whiteboard:cursor', onWhiteboardCursor);
      socket.off('whiteboard:clear', onWhiteboardClear);
      clearInterval(cursorInterval);
    };
  }, [channel.id, channel.workspaceId, currentUser?.id]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setElements(prev);
      saveWhiteboardToServer(prev);
      getSocket().emit('whiteboard:update', { channelId: channel.id, data: { elements: prev } });
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setElements(next);
      saveWhiteboardToServer(next);
      getSocket().emit('whiteboard:update', { channelId: channel.id, data: { elements: next } });
    }
  };

  const handleClearBoard = async () => {
    if (confirm('Clear the entire whiteboard?')) {
      commitElements([]);
      setSelectedElementId(null);
      setEditingId(null);
      try {
        await api.delete(`/api/channels/${channel.id}/whiteboard`);
      } catch (err) {
        console.error('Failed to clear whiteboard', err);
      }
    }
  };

  // Keyboard Shortcuts & Space Pan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in inline text
      if (editingId) return;

      if (e.code === 'Space') {
        setIsSpacePressed(true);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementId) {
          commitElements(elements.filter((el) => el.id !== selectedElementId));
          setSelectedElementId(null);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        handleRedo();
      } else if (e.key === 'v' || e.key === 'V') {
        setActiveTool('select');
      } else if (e.key === 'h' || e.key === 'H') {
        setActiveTool('hand');
      } else if (e.key === 'p' || e.key === 'P') {
        setActiveTool('pen');
      } else if (e.key === 't' || e.key === 'T') {
        setActiveTool('text');
      } else if (e.key === 's' || e.key === 'S') {
        setActiveTool('sticky');
      } else if (e.key === 'r' || e.key === 'R') {
        setActiveTool('rect');
      } else if (e.key === 'c' || e.key === 'C') {
        setActiveTool('circle');
      } else if (e.key === 'e' || e.key === 'E') {
        setActiveTool('eraser');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [editingId, selectedElementId, elements, historyIndex, history]);

  // Coordinate Conversion (Infinite Canvas World)
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    };
  };

  const emitCursor = (coords: { x: number; y: number }) => {
    if (currentUser) {
      getSocket().emit('whiteboard:cursor', {
        channelId: channel.id,
        cursor: coords,
        user: {
          displayName: currentUser.displayName,
          avatarUrl: currentUser.avatarUrl,
        },
      });
    }
  };

  // Smooth Infinite Wheel Zoom & Pan (2-finger scroll / mouse wheel)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom centered on cursor
      const zoomFactor = 1 - e.deltaY * 0.002;
      const newZoom = Math.min(3, Math.max(0.2, zoom * zoomFactor));
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
      const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    } else {
      // Pan infinitely
      setPan((p) => ({
        x: p.x - e.deltaX,
        y: p.y - e.deltaY,
      }));
    }
  };

  // Find clicked element
  const findElementAtCoords = (coords: { x: number; y: number }): CanvasElement | null => {
    return (
      [...elements].reverse().find((el) => {
        if (el.type === 'rect' || el.type === 'sticky') {
          const w = el.width || (el.type === 'sticky' ? 160 : 100);
          const h = el.height || (el.type === 'sticky' ? 160 : 100);
          return (
            coords.x >= el.x &&
            coords.x <= el.x + w &&
            coords.y >= el.y &&
            coords.y <= el.y + h
          );
        }
        if (el.type === 'circle') {
          const r = Math.abs(el.width || 60) / 2;
          const cx = el.x + (el.width || 60) / 2;
          const cy = el.y + (el.height || 60) / 2;
          return Math.hypot(coords.x - cx, coords.y - cy) <= r;
        }
        if (el.type === 'text') {
          const lineCount = (el.text || '').split('\n').length || 1;
          const estimatedHeight = Math.max(el.height || 48, lineCount * (el.fontSize || 18) * 1.35 + 10);
          const w = el.width || 240;
          return (
            coords.x >= el.x &&
            coords.x <= el.x + w &&
            coords.y >= el.y &&
            coords.y <= el.y + estimatedHeight
          );
        }
        if (el.type === 'pen' && el.points) {
          return el.points.some((pt) => Math.hypot(coords.x - pt.x, coords.y - pt.y) < 10);
        }
        return false;
      }) || null
    );
  };

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);

    // Pan via middle button, spacebar, or hand tool
    if (e.button === 1 || e.button === 2 || isSpacePressed || activeTool === 'hand') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (activeTool === 'select') {
      const clicked = findElementAtCoords(coords);
      if (clicked) {
        setSelectedElementId(clicked.id);
        setIsDraggingElement(true);
        setDragOffset({ x: coords.x - clicked.x, y: coords.y - clicked.y });
      } else {
        setSelectedElementId(null);
        setEditingId(null);
      }
      return;
    }

    if (activeTool === 'eraser') {
      const clicked = findElementAtCoords(coords);
      if (clicked) {
        commitElements(elements.filter((el) => el.id !== clicked.id));
        if (selectedElementId === clicked.id) setSelectedElementId(null);
      }
      return;
    }

    // Direct in-place Sticky Note Creation
    if (activeTool === 'sticky') {
      const stickyColor = STICKY_COLORS[stickyColorIdx];
      const newSticky: CanvasElement = {
        id: `sticky-${Date.now()}`,
        type: 'sticky',
        x: coords.x - 85,
        y: coords.y - 85,
        width: 170,
        height: 170,
        color: stickyColor.text,
        fillColor: stickyColor.bg,
        strokeWidth: 2,
        fontSize: 14,
        text: '',
      };
      commitElements([...elements, newSticky]);
      setSelectedElementId(newSticky.id);
      startEditing(newSticky.id, '');
      setActiveTool('select');
      return;
    }

    // Direct in-place Text Creation
    if (activeTool === 'text') {
      const newText: CanvasElement = {
        id: `text-${Date.now()}`,
        type: 'text',
        x: coords.x,
        y: coords.y,
        width: 240,
        height: 48,
        color: activeColor === '#007A5A' ? '#FFFFFF' : activeColor,
        strokeWidth: 1,
        fontSize: 18,
        text: '',
      };
      commitElements([...elements, newText]);
      setSelectedElementId(newText.id);
      startEditing(newText.id, '');
      setActiveTool('select');
      return;
    }

    // Start drawing shape
    setIsDrawing(true);
    const newId = `el-${Date.now()}`;

    if (activeTool === 'pen') {
      setCurrentElement({
        id: newId,
        type: 'pen',
        x: coords.x,
        y: coords.y,
        points: [{ x: coords.x, y: coords.y }],
        color: activeColor,
        strokeWidth,
      });
    } else if (activeTool === 'rect') {
      setCurrentElement({
        id: newId,
        type: 'rect',
        x: coords.x,
        y: coords.y,
        width: 0,
        height: 0,
        color: activeColor,
        strokeWidth,
      });
    } else if (activeTool === 'circle') {
      setCurrentElement({
        id: newId,
        type: 'circle',
        x: coords.x,
        y: coords.y,
        width: 0,
        height: 0,
        color: activeColor,
        strokeWidth,
      });
    } else if (activeTool === 'arrow' || activeTool === 'line') {
      setCurrentElement({
        id: newId,
        type: activeTool,
        x: coords.x,
        y: coords.y,
        points: [{ x: coords.x, y: coords.y }, { x: coords.x, y: coords.y }],
        color: activeColor,
        strokeWidth,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    emitCursor(coords);

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    // Dragging selected element
    if (isDraggingElement && selectedElementId) {
      setElements((prev) =>
        prev.map((el) => {
          if (el.id === selectedElementId) {
            const dx = coords.x - dragOffset.x - el.x;
            const dy = coords.y - dragOffset.y - el.y;

            if (el.type === 'pen' && el.points) {
              return {
                ...el,
                x: el.x + dx,
                y: el.y + dy,
                points: el.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
              };
            }
            if ((el.type === 'arrow' || el.type === 'line') && el.points) {
              return {
                ...el,
                x: el.x + dx,
                y: el.y + dy,
                points: el.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
              };
            }
            return {
              ...el,
              x: coords.x - dragOffset.x,
              y: coords.y - dragOffset.y,
            };
          }
          return el;
        })
      );
      return;
    }

    if (!isDrawing || !currentElement) return;

    if (currentElement.type === 'pen') {
      setCurrentElement((prev) =>
        prev
          ? {
              ...prev,
              points: [...(prev.points || []), { x: coords.x, y: coords.y }],
            }
          : null
      );
    } else if (currentElement.type === 'rect' || currentElement.type === 'circle') {
      setCurrentElement((prev) =>
        prev
          ? {
              ...prev,
              width: coords.x - prev.x,
              height: coords.y - prev.y,
            }
          : null
      );
    } else if (currentElement.type === 'arrow' || currentElement.type === 'line') {
      setCurrentElement((prev) =>
        prev
          ? {
              ...prev,
              points: [prev.points![0], { x: coords.x, y: coords.y }],
            }
          : null
      );
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isDraggingElement) {
      setIsDraggingElement(false);
      commitElements(elements);
      return;
    }

    if (isDrawing && currentElement) {
      commitElements([...elements, currentElement]);
      setCurrentElement(null);
      setIsDrawing(false);
    }
  };

  // Double Click directly activates In-Place text editing
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    const clicked = findElementAtCoords(coords);
    if (clicked && (clicked.type === 'sticky' || clicked.type === 'text')) {
      setSelectedElementId(clicked.id);
      startEditing(clicked.id, clicked.text || '');
    }
  };

  // Text Formatting Helpers for Live WYSIWYG ContentEditable Editing
  const selectedElement = elements.find((el) => el.id === selectedElementId);

  const updateSelectedFormatting = useCallback((updates: Partial<CanvasElement>) => {
    if (!selectedElementId) return;
    setElements((prev) => {
      const updated = prev.map((el) =>
        el.id === selectedElementId ? { ...el, ...updates } : el
      );
      saveWhiteboardToServer(updated);
      getSocket().emit('whiteboard:update', {
        channelId: channel.id,
        data: { elements: updated },
      });
      return updated;
    });
  }, [selectedElementId, channel.id, saveWhiteboardToServer]);

  const executeExecCommand = (command: string, value: string | undefined = undefined) => {
    const editor = inlineContentEditableRef.current;
    if (editor) {
      editor.focus();
      document.execCommand(command, false, value);
      const md = htmlToMarkdown(editor.innerHTML);
      setEditText(md);
      updateSelectedFormatting({ text: md });
    }
  };

  // Format Heading: live toggle between H1 / H2 / Div in contentEditable
  const handleFormatHeading = (level: 1 | 2 | 0) => {
    const editor = inlineContentEditableRef.current;
    if (editor) {
      editor.focus();
      if (level === 0) {
        document.execCommand('formatBlock', false, '<div>');
      } else {
        const tag = level === 1 ? 'H1' : 'H2';
        const sel = window.getSelection();
        const parent = sel?.anchorNode?.parentElement;
        if (parent && parent.tagName === tag) {
          document.execCommand('formatBlock', false, '<div>');
        } else {
          document.execCommand('formatBlock', false, `<${tag}>`);
        }
      }
      const md = htmlToMarkdown(editor.innerHTML);
      setEditText(md);
      updateSelectedFormatting({ text: md });
    }
  };

  // Keyboard events in inline contentEditable (auto-bullet continuation on Enter, Escape, Ctrl+B)
  const handleInlineKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      finishEditing();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      executeExecCommand('bold');
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const node = sel.anchorNode;
        const parentLi =
          node instanceof HTMLElement
            ? node.closest('li')
            : node?.parentElement?.closest('li');

        // If not already in a native <li> list element, auto-continue plain bullet lines
        if (!parentLi) {
          const textContent = node?.textContent || '';
          const offset = sel.anchorOffset;
          const lineBeforeCursor = textContent.slice(0, offset);
          const bulletMatch = lineBeforeCursor.match(/^(\s*[-•*]\s+)(.*)$/);
          const emptyBulletMatch = lineBeforeCursor.match(/^(\s*[-•*]\s*)$/);

          if (emptyBulletMatch) {
            e.preventDefault();
            if (node && node.parentElement) {
              node.parentElement.innerHTML = '<br>';
            }
            return;
          } else if (bulletMatch) {
            e.preventDefault();
            const prefix = bulletMatch[1];
            const afterText = textContent.slice(offset);

            const newLineDiv = document.createElement('div');
            newLineDiv.textContent = prefix + afterText;

            if (node && node.nodeType === Node.TEXT_NODE) {
              node.textContent = lineBeforeCursor;
              const parent = node.parentElement;
              if (parent && parent !== inlineContentEditableRef.current) {
                parent.after(newLineDiv);
              } else if (parent) {
                parent.appendChild(newLineDiv);
              }
            }

            const newRange = document.createRange();
            if (newLineDiv.firstChild) {
              newRange.setStart(newLineDiv.firstChild, prefix.length);
              newRange.collapse(true);
              sel.removeAllRanges();
              sel.addRange(newRange);
            }

            if (inlineContentEditableRef.current) {
              const md = htmlToMarkdown(inlineContentEditableRef.current.innerHTML);
              setEditText(md);
              setElements((prev) =>
                prev.map((el) => (el.id === editingId ? { ...el, text: md } : el))
              );
            }
            return;
          }
        }
      }
    }
  };

  // Canvas Painter Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = containerRef.current?.clientWidth || window.innerWidth;
    const height = containerRef.current?.clientHeight || window.innerHeight;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    // Background Canvas
    ctx.fillStyle = '#141618';
    ctx.fillRect(0, 0, width, height);

    // Dynamic Infinite Grid Dots
    ctx.save();
    ctx.fillStyle = '#262A2E';
    const dotSpacing = 28 * zoom;
    const offsetX = (pan.x % dotSpacing + dotSpacing) % dotSpacing;
    const offsetY = (pan.y % dotSpacing + dotSpacing) % dotSpacing;
    for (let x = offsetX; x < width; x += dotSpacing) {
      for (let y = offsetY; y < height; y += dotSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2 * Math.min(1.5, zoom), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Apply Infinite Transform
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const renderList = currentElement ? [...elements, currentElement] : elements;

    // Helper to render rich lines with markdown heading, bold, code chips, and quotes
    const renderFormattedLines = (
      fullText: string,
      startX: number,
      startY: number,
      defaultColor: string,
      baseSize: number,
      isGlobalBold?: boolean
    ) => {
      const rawLines = (fullText || '').split('\n');
      let currentY = startY;

      rawLines.forEach((raw) => {
        let line = raw;
        let fontSize = baseSize;
        let isHeading = false;
        let isQuote = false;

        if (line.startsWith('# ')) {
          fontSize = Math.max(baseSize * 1.45, 24);
          isHeading = true;
          line = line.slice(2);
        } else if (line.startsWith('## ')) {
          fontSize = Math.max(baseSize * 1.25, 19);
          isHeading = true;
          line = line.slice(3);
        } else if (line.startsWith('### ')) {
          fontSize = Math.max(baseSize * 1.1, 16);
          isHeading = true;
          line = line.slice(4);
        } else if (line.startsWith('> ')) {
          isQuote = true;
          line = line.slice(2);
        } else if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
          line = '• ' + line.slice(2);
        }

        let currentX = startX;

        // Draw quote line indicator
        if (isQuote) {
          ctx.save();
          ctx.fillStyle = '#007A5A';
          ctx.fillRect(startX - 6, currentY - fontSize + 2, 3, fontSize * 1.2);
          ctx.restore();
          currentX += 4;
        }

        // Parse inline formatting: **bold**, *italic*, ~~strike~~, `code`
        const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|`[^`]+`)/g);

        parts.forEach((part) => {
          if (!part) return;

          let text = part;
          let isBold = isHeading || isGlobalBold;
          let isItalic = isQuote;
          let isStrike = false;
          let isCode = false;

          if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
            isBold = true;
            text = part.slice(2, -2);
          } else if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
            isItalic = true;
            text = part.slice(1, -1);
          } else if (part.startsWith('~~') && part.endsWith('~~') && part.length >= 4) {
            isStrike = true;
            text = part.slice(2, -2);
          } else if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
            isCode = true;
            text = part.slice(1, -1);
          }

          const fontStyle = isItalic ? 'italic' : 'normal';
          const fontWeight = isBold ? 'bold' : '500';
          ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px sans-serif`;

          const textWidth = ctx.measureText(text).width;

          // Draw code chip background
          if (isCode) {
            ctx.save();
            ctx.fillStyle = '#262A2E';
            ctx.beginPath();
            ctx.roundRect(currentX - 2, currentY - fontSize + 2, textWidth + 4, fontSize * 1.2, 4);
            ctx.fill();
            ctx.strokeStyle = '#383F45';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();

            ctx.fillStyle = '#ECB22E'; // Gold code text
          } else {
            ctx.fillStyle = defaultColor;
          }

          ctx.fillText(text, currentX, currentY);

          // Draw strikethrough line
          if (isStrike) {
            ctx.save();
            ctx.strokeStyle = defaultColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(currentX, currentY - fontSize / 3);
            ctx.lineTo(currentX + textWidth, currentY - fontSize / 3);
            ctx.stroke();
            ctx.restore();
          }

          currentX += textWidth + (isCode ? 4 : 0);
        });

        currentY += fontSize * 1.35;
      });
    };

    renderList.forEach((el) => {
      // If currently in-place editing this element, hide its text so the textarea shows cleanly
      const isCurrentlyEditing = editingId === el.id;

      ctx.save();
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.fillColor || el.color;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.type === 'pen' && el.points && el.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.stroke();
      } else if (el.type === 'rect') {
        const w = el.width || 0;
        const h = el.height || 0;
        ctx.beginPath();
        ctx.roundRect(el.x, el.y, w, h, 8);
        ctx.fillStyle = el.color + '18';
        ctx.fill();
        ctx.stroke();
      } else if (el.type === 'circle') {
        const rx = Math.abs(el.width || 0) / 2;
        const ry = Math.abs(el.height || 0) / 2;
        const cx = el.x + (el.width || 0) / 2;
        const cy = el.y + (el.height || 0) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        ctx.fillStyle = el.color + '18';
        ctx.fill();
        ctx.stroke();
      } else if ((el.type === 'arrow' || el.type === 'line') && el.points && el.points.length === 2) {
        const [from, to] = el.points;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();

        if (el.type === 'arrow') {
          const angle = Math.atan2(to.y - from.y, to.x - from.x);
          const headLength = 12 + el.strokeWidth;
          ctx.beginPath();
          ctx.moveTo(to.x, to.y);
          ctx.lineTo(
            to.x - headLength * Math.cos(angle - Math.PI / 6),
            to.y - headLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.moveTo(to.x, to.y);
          ctx.lineTo(
            to.x - headLength * Math.cos(angle + Math.PI / 6),
            to.y - headLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.stroke();
        }
      } else if (el.type === 'sticky') {
        const w = el.width || 170;
        const h = el.height || 170;

        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 5;
        ctx.fillStyle = el.fillColor || '#FEF08A';
        ctx.beginPath();
        ctx.roundRect(el.x, el.y, w, h, 8);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = el.color + '25';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (!isCurrentlyEditing) {
          renderFormattedLines(
            el.text || '',
            el.x + 14,
            el.y + 26,
            el.color || '#713F12',
            el.fontSize || 14,
            el.isBold
          );
        }
      } else if (el.type === 'text') {
        if (!isCurrentlyEditing) {
          renderFormattedLines(
            el.text || '',
            el.x,
            el.y + 20,
            el.color || '#FFFFFF',
            el.fontSize || 18,
            el.isBold
          );
        }
      }

      // Selection Highlight Box
      if (selectedElementId === el.id) {
        ctx.strokeStyle = '#007A5A';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        const pad = 6;
        let bx = el.x - pad;
        let by = el.y - pad;
        let bw = (el.width || 100) + pad * 2;
        let bh = (el.height || 100) + pad * 2;

        if (el.type === 'pen' && el.points && el.points.length > 0) {
          const xs = el.points.map((p) => p.x);
          const ys = el.points.map((p) => p.y);
          bx = Math.min(...xs) - pad;
          by = Math.min(...ys) - pad;
          bw = Math.max(...xs) - bx + pad;
          bh = Math.max(...ys) - by + pad;
        }

        ctx.strokeRect(bx, by, bw, bh);
        ctx.setLineDash([]);
      }

      ctx.restore();
    });

    ctx.restore();
  }, [elements, currentElement, zoom, pan, selectedElementId, editingId]);

  // Export to PNG Image
  const handleExportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${channel.name}-brainstorm-canvas.png`;
    a.click();
  };

  // Locate the currently editing element in screen space
  const editingElement = elements.find((el) => el.id === editingId);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className={`relative w-full h-full flex flex-col bg-[#141618] overflow-hidden select-none ${
        isSpacePressed || activeTool === 'hand' ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      {/* Top Header Bar */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
        {/* Left: Channel Canvas Info */}
        <div className="flex items-center gap-3 bg-[#1F2326]/90 backdrop-blur border border-gray-700/80 px-4 py-2 rounded-2xl shadow-2xl pointer-events-auto">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-slack-green animate-pulse" />
            <span className="font-bold text-sm text-white">#{channel.name} Canvas</span>
          </div>

          <span className="text-gray-600">|</span>

          <div className="flex items-center gap-1.5 text-xs text-gray-300">
            <Users size={14} className="text-slack-green" />
            <span>{activeUsersCount} Live</span>
          </div>

          {isSaving && (
            <span className="text-[11px] text-gray-400 italic ml-2">Auto-saving...</span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 bg-[#1F2326]/90 backdrop-blur border border-gray-700/80 p-1.5 rounded-2xl shadow-2xl pointer-events-auto">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Undo (Ctrl+Z)"
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition disabled:opacity-30"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            title="Redo (Ctrl+Y)"
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition disabled:opacity-30"
          >
            <Redo2 size={16} />
          </button>

          <span className="w-px h-5 bg-gray-700 mx-1" />

          {/* Zoom Controls */}
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.15))}
            title="Zoom In"
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition"
          >
            <ZoomIn size={16} />
          </button>
          <span className="text-xs text-gray-400 px-1 font-mono">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.max(0.2, z - 0.15))}
            title="Zoom Out"
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            title="Reset View (100%)"
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition"
          >
            <Maximize2 size={15} />
          </button>

          <span className="w-px h-5 bg-gray-700 mx-1" />

          {/* Export PNG */}
          <button
            onClick={handleExportImage}
            title="Export as PNG"
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition"
          >
            <Download size={16} />
          </button>

          {/* Clear Board */}
          <button
            onClick={handleClearBoard}
            title="Clear Board"
            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition"
          >
            <Trash2 size={16} />
          </button>

          {onClose && (
            <>
              <span className="w-px h-5 bg-gray-700 mx-1" />
              <button
                onClick={onClose}
                title="Back to Chat"
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition"
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Floating Formatting Toolbar (When Text / Sticky Note is Selected) */}
      {selectedElement && (selectedElement.type === 'text' || selectedElement.type === 'sticky') && (
        <div
          style={{
            transform: `translate(${selectedElement.x * zoom + pan.x}px, ${
              selectedElement.y * zoom + pan.y - 48
            }px)`,
          }}
          className="absolute top-0 left-0 z-40 flex items-center gap-1 bg-[#1F2326] border border-gray-700 px-2 py-1 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Bold */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => executeExecCommand('bold')}
            title="Bold (Ctrl+B)"
            className="p-1.5 rounded-lg text-xs font-bold transition text-gray-300 hover:text-white hover:bg-gray-700/60 active:scale-95"
          >
            <Bold size={14} />
          </button>

          {/* Heading 1 (Large) */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleFormatHeading(1)}
            title="Heading 1"
            className="p-1.5 rounded-lg text-xs font-bold transition text-gray-300 hover:text-white hover:bg-gray-700/60 active:scale-95"
          >
            <Heading1 size={14} />
          </button>

          {/* Heading 2 (Medium) */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleFormatHeading(2)}
            title="Heading 2"
            className="p-1.5 rounded-lg text-xs font-bold transition text-gray-300 hover:text-white hover:bg-gray-700/60 active:scale-95"
          >
            <Heading2 size={14} />
          </button>

          {/* Simple Text */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleFormatHeading(0)}
            title="Simple Text"
            className="p-1.5 rounded-lg text-xs font-bold transition text-gray-300 hover:text-white hover:bg-gray-700/60 active:scale-95"
          >
            <span className="text-[11px] font-bold">T</span>
          </button>

          {/* Bullet List */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => executeExecCommand('insertUnorderedList')}
            title="Bullet List (•)"
            className="p-1.5 rounded-lg text-xs text-gray-300 hover:text-white hover:bg-gray-700/60 transition active:scale-95"
          >
            <List size={14} />
          </button>

          <span className="w-px h-4 bg-gray-700 mx-0.5" />

          {/* Text Font Size / Scale Selector */}
          <div className="flex items-center gap-0.5 bg-gray-800/80 p-0.5 rounded-lg border border-gray-700/60">
            {FONT_SIZES.map(({ label, size, tooltip }) => {
              const currentSize =
                selectedElement.fontSize || (selectedElement.type === 'sticky' ? 14 : 18);
              const isActive = currentSize === size;
              return (
                <button
                  key={label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => updateSelectedFormatting({ fontSize: size })}
                  title={tooltip}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition active:scale-95 ${
                    isActive
                      ? 'bg-slack-green text-white shadow font-extrabold'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Color swatches for Sticky Note background */}
          {selectedElement.type === 'sticky' && (
            <>
              <span className="w-px h-4 bg-gray-700 mx-0.5" />
              {STICKY_COLORS.map((sc) => (
                <button
                  key={sc.label}
                  onClick={() =>
                    updateSelectedFormatting({ fillColor: sc.bg, color: sc.text })
                  }
                  style={{ backgroundColor: sc.bg }}
                  title={sc.label}
                  className={`w-4 h-4 rounded-full border transition hover:scale-125 ${
                    selectedElement.fillColor === sc.bg ? 'ring-2 ring-slack-green' : 'border-gray-600'
                  }`}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Floating Center Bottom Toolbar (Tools & Palettes) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-[#1F2326]/95 backdrop-blur border border-gray-700/80 p-2 rounded-2xl shadow-2xl">
        {/* Tool Selector */}
        <div className="flex items-center gap-1">
          {[
            { tool: 'select', icon: MousePointer, label: 'Select & Move (V)' },
            { tool: 'hand', icon: Hand, label: 'Pan Hand (H / Space)' },
            { tool: 'pen', icon: Pencil, label: 'Draw Pen (P)' },
            { tool: 'sticky', icon: StickyNote, label: 'Sticky Note (S)' },
            { tool: 'text', icon: Type, label: 'Text Box (T)' },
            { tool: 'rect', icon: Square, label: 'Rectangle (R)' },
            { tool: 'circle', icon: Circle, label: 'Circle (C)' },
            { tool: 'arrow', icon: ArrowRight, label: 'Arrow' },
            { tool: 'line', icon: Minus, label: 'Line' },
            { tool: 'eraser', icon: Eraser, label: 'Eraser (E)' },
          ].map(({ tool, icon: Icon, label }) => (
            <button
              key={tool}
              onClick={() => setActiveTool(tool as ToolType)}
              title={label}
              className={`p-2.5 rounded-xl transition flex items-center justify-center ${
                activeTool === tool
                  ? 'bg-slack-green text-white shadow-lg scale-105 font-bold'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/60'
              }`}
            >
              <Icon size={18} />
            </button>
          ))}
        </div>

        <span className="w-px h-6 bg-gray-700 mx-1" />

        {/* Color Palette */}
        <div className="flex items-center gap-1.5 px-1">
          {COLOR_PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setActiveColor(c)}
              style={{ backgroundColor: c }}
              className={`w-6 h-6 rounded-full transition transform hover:scale-125 border ${
                activeColor === c ? 'ring-2 ring-slack-green ring-offset-2 ring-offset-[#1F2326]' : 'border-gray-700'
              }`}
            />
          ))}
        </div>

        <span className="w-px h-6 bg-gray-700 mx-1" />

        {/* Stroke Width Selector */}
        <div className="flex items-center gap-1">
          {[2, 4, 8].map((w) => (
            <button
              key={w}
              onClick={() => setStrokeWidth(w)}
              className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition ${
                strokeWidth === w
                  ? 'bg-[#383F45] text-white border border-slack-green'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {w}px
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        className="w-full h-full cursor-crosshair touch-none"
      />

      {/* DIRECT IN-PLACE INLINE LIVE WYSIWYG TEXT EDITING (NO MODALS!) */}
      {editingElement && (
        <div
          style={{
            position: 'absolute',
            left: `${editingElement.x * zoom + pan.x}px`,
            top: `${editingElement.y * zoom + pan.y}px`,
            zIndex: 50,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <div
            ref={inlineContentEditableRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder={
              editingElement.type === 'sticky'
                ? 'Brainstorm idea...'
                : 'Type note or heading...'
            }
            onInput={() => {
              if (inlineContentEditableRef.current) {
                const md = htmlToMarkdown(inlineContentEditableRef.current.innerHTML);
                setEditText(md);
                setElements((prev) =>
                  prev.map((el) =>
                    el.id === editingElement.id ? { ...el, text: md } : el
                  )
                );
              }
            }}
            onBlur={() => finishEditing()}
            onKeyDown={handleInlineKeyDown}
            style={{
              width: `${(editingElement.width || (editingElement.type === 'sticky' ? 170 : 240)) * zoom}px`,
              minHeight: `${(editingElement.height || (editingElement.type === 'sticky' ? 170 : 44)) * zoom}px`,
              fontSize: `${(editingElement.fontSize || (editingElement.type === 'sticky' ? 14 : 18)) * zoom}px`,
              fontWeight: editingElement.isBold ? 'bold' : '500',
              color:
                editingElement.type === 'sticky'
                  ? editingElement.color
                  : editingElement.color || '#FFFFFF',
              backgroundColor:
                editingElement.type === 'sticky'
                  ? editingElement.fillColor
                  : 'rgba(24, 27, 31, 0.92)',
              border:
                editingElement.type === 'sticky'
                  ? `2px dashed ${editingElement.color}40`
                  : '1.5px dashed #007A5A',
              borderRadius: editingElement.type === 'sticky' ? '8px' : '6px',
              padding: `${(editingElement.type === 'sticky' ? 12 : 8) * zoom}px`,
              outline: 'none',
              lineHeight: 1.35,
              display: 'block',
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
            }}
            className="font-sans shadow-2xl focus:ring-2 focus:ring-slack-green selection:bg-slack-green selection:text-white empty:before:content-[attr(data-placeholder)] empty:before:text-gray-500 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_s]:line-through [&_strike]:line-through [&_code]:bg-[#2C3136] [&_code]:text-[#ECB22E] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_blockquote]:border-l-4 [&_blockquote]:border-slack-green [&_blockquote]:pl-2 [&_blockquote]:italic [&_blockquote]:text-gray-300 [&_ul]:list-disc [&_ul]:list-inside [&_ol]:list-decimal [&_ol]:list-inside"
          />
        </div>
      )}

      {/* Real-time Teammates' Cursors Overlay */}
      {Object.values(peerCursors).map((cursor) => (
        <div
          key={cursor.userId}
          style={{
            transform: `translate(${cursor.x * zoom + pan.x}px, ${cursor.y * zoom + pan.y}px)`,
          }}
          className="absolute top-0 left-0 pointer-events-none z-20 transition-transform duration-75 flex items-start gap-1"
        >
          <MousePointer size={16} className="text-slack-green fill-slack-green drop-shadow-md" />
          <span className="bg-slack-green text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">
            {cursor.displayName}
          </span>
        </div>
      ))}
    </div>
  );
};
