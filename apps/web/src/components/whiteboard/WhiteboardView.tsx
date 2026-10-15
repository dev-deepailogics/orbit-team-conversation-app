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
  AlertTriangle,
  Loader2,
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
      if (!inList) { html += '<ul class="list-disc pl-5 my-0.5">'; inList = true; }
      const itemText = line.replace(/^[-•*]\s*/, '');
      html += `<li>${formatInline(itemText)}</li>`;
    } else if (/^\d+\.\s/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; }
      if (!inOrdered) { html += '<ol class="list-decimal pl-5 my-0.5">'; inOrdered = true; }
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
        return children.trim() ? `\`${children.trim()}\`` : '';
      case 'blockquote': {
        const lines = children.trim().split('\n');
        return `\n${lines.map((l) => `> ${l}`).join('\n')}\n`;
      }
      case 'ul':
      case 'ol':
        return `\n${children.trim()}\n`;
      case 'li': {
        const itemText = children.trim();
        return itemText ? `- ${itemText}\n` : '';
      }
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
  { bg: '#FED7AA', text: '#7C2D12', border: '#FB923C', label: 'Orange' },
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
  const [fontLoaded, setFontLoaded] = useState<boolean>(false);

  // Detect when custom handwriting fonts (Caveat, etc.) finish loading to redraw canvas
  useEffect(() => {
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => {
        setFontLoaded(true);
      });
    }
  }, []);

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
  const editingIdRef = useRef<string | null>(null);
  const latestTextRef = useRef<string>('');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear Canvas Confirmation Modal State
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [clearConfirmText, setClearConfirmText] = useState<string>('');
  const [isClearing, setIsClearing] = useState<boolean>(false);

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

  // Remove / Delete Element (Sticky Note, Text, Shape)
  const handleDeleteElement = (idToDelete: string) => {
    if (editingIdRef.current === idToDelete || editingId === idToDelete) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      editingIdRef.current = null;
      setEditingId(null);
      setEditText('');
    }
    if (selectedElementId === idToDelete) {
      setSelectedElementId(null);
    }
    const next = elements.filter((el) => el.id !== idToDelete);
    commitElements(next);
  };

  // Start in-place editing
  const startEditing = useCallback((elementId: string, initialText: string) => {
    editingIdRef.current = elementId;
    latestTextRef.current = initialText;
    setEditingId(elementId);
    setEditText(initialText);
  }, []);

  // Finish in-place editing and commit changes
  const finishEditing = useCallback(
    (idToFinish?: string) => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      const targetId = idToFinish || editingIdRef.current || editingId;
      if (!targetId) return;

      let currentMd = '';
      if (inlineContentEditableRef.current) {
        currentMd = htmlToMarkdown(inlineContentEditableRef.current.innerHTML);
      } else if (latestTextRef.current !== undefined && latestTextRef.current !== '') {
        currentMd = latestTextRef.current;
      } else {
        currentMd = editText;
      }

      editingIdRef.current = null;
      latestTextRef.current = '';

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

  // Clean up autoSave timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Auto-focus contentEditable and load initial HTML ONLY when entering edit mode (editingId changes)
  useEffect(() => {
    if (editingId && inlineContentEditableRef.current) {
      const editor = inlineContentEditableRef.current;
      const targetEl = elements.find((el) => el.id === editingId);
      const textToLoad = targetEl?.text ?? latestTextRef.current ?? editText;
      editor.innerHTML = markdownToHtml(textToLoad);
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
  }, [editingId]);

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

  const handleClearBoard = () => {
    setClearConfirmText('');
    setShowClearModal(true);
  };

  const handleConfirmClearBoard = async () => {
    if (clearConfirmText.trim().toLowerCase() !== 'clear-canvas' || isClearing) return;
    try {
      setIsClearing(true);
      commitElements([]);
      setSelectedElementId(null);
      setEditingId(null);
      await api.delete(`/api/channels/${channel.id}/whiteboard`);
      setShowClearModal(false);
      setClearConfirmText('');
    } catch (err) {
      console.error('Failed to clear whiteboard', err);
    } finally {
      setIsClearing(false);
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
          handleDeleteElement(selectedElementId);
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

    // If currently in-place editing, finish and commit before performing canvas actions
    if (editingIdRef.current || editingId) {
      finishEditing();
    }

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
      }
      return;
    }

    if (activeTool === 'eraser') {
      const clicked = findElementAtCoords(coords);
      if (clicked) {
        handleDeleteElement(clicked.id);
      }
      return;
    }

    // Direct in-place Sticky Note Creation
    if (activeTool === 'sticky') {
      const stickyColor = STICKY_COLORS[stickyColorIdx] || STICKY_COLORS[0];
      const newSticky: CanvasElement = {
        id: `sticky-${Date.now()}`,
        type: 'sticky',
        x: coords.x - 90,
        y: coords.y - 90,
        width: 180,
        height: 180,
        color: stickyColor.text,
        fillColor: stickyColor.bg,
        strokeWidth: 2,
        fontSize: 20,
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

  // Double Click directly activates In-Place text editing or creates a new sticky note
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    const clicked = findElementAtCoords(coords);
    if (clicked && (clicked.type === 'sticky' || clicked.type === 'text')) {
      if ((editingIdRef.current || editingId) && (editingIdRef.current !== clicked.id)) {
        finishEditing();
      }
      setSelectedElementId(clicked.id);
      startEditing(clicked.id, clicked.text || '');
    } else if (!clicked) {
      // Double click on empty space drops a pinned sticky note
      const stickyColor = STICKY_COLORS[stickyColorIdx] || STICKY_COLORS[0];
      const newSticky: CanvasElement = {
        id: `sticky-${Date.now()}`,
        type: 'sticky',
        x: coords.x - 90,
        y: coords.y - 90,
        width: 180,
        height: 180,
        color: stickyColor.text,
        fillColor: stickyColor.bg,
        strokeWidth: 2,
        fontSize: 20,
        text: '',
      };
      commitElements([...elements, newSticky]);
      setSelectedElementId(newSticky.id);
      startEditing(newSticky.id, '');
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
      latestTextRef.current = md;
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
      latestTextRef.current = md;
      setEditText(md);
      updateSelectedFormatting({ text: md });
    }
  };

  // Keyboard events in inline contentEditable (auto-bullet conversion, Escape, Ctrl+B, Tab, Arrow escape)
  const handleInlineKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      finishEditing();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'Backspace' || e.key === 'Delete')) {
      e.preventDefault();
      const targetId = editingIdRef.current || editingId;
      if (targetId) {
        handleDeleteElement(targetId);
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      executeExecCommand('bold');
      return;
    }

    const editor = inlineContentEditableRef.current;

    // Arrow Right escape from inline formatting tags (code, b, i, s, etc.)
    if (e.key === 'ArrowRight' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && editor) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const inlineTags = new Set(['code', 'b', 'strong', 'i', 'em', 's', 'strike', 'del', 'a', 'u']);
        let curr: Node | null = range.endContainer;
        let inlineEl: HTMLElement | null = null;
        while (curr && curr !== editor) {
          if (curr.nodeType === Node.ELEMENT_NODE && inlineTags.has((curr as HTMLElement).tagName.toLowerCase())) {
            inlineEl = curr as HTMLElement;
            break;
          }
          curr = curr.parentNode;
        }

        if (inlineEl && range.collapsed) {
          try {
            const testRange = document.createRange();
            testRange.selectNodeContents(inlineEl);
            testRange.setStart(range.endContainer, range.endOffset);
            if (testRange.toString().replace(/\u200B/g, '').length === 0) {
              e.preventDefault();
              let nextNode = inlineEl.nextSibling;
              if (!nextNode || nextNode.nodeType !== Node.TEXT_NODE) {
                const textNode = document.createTextNode('\u200B');
                inlineEl.parentNode?.insertBefore(textNode, inlineEl.nextSibling);
                nextNode = textNode;
              }
              const newRange = document.createRange();
              const text = nextNode.textContent || '';
              const offset = text.startsWith('\u200B') ? 1 : 0;
              newRange.setStart(nextNode, offset);
              newRange.setEnd(nextNode, offset);
              sel.removeAllRanges();
              sel.addRange(newRange);
              return;
            }
          } catch (err) {}
        }
      }
    }

    // Arrow Left escape from start of inline tags
    if (e.key === 'ArrowLeft' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && editor) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const inlineTags = new Set(['code', 'b', 'strong', 'i', 'em', 's', 'strike', 'del', 'a', 'u']);
        let curr: Node | null = range.startContainer;
        let inlineEl: HTMLElement | null = null;
        while (curr && curr !== editor) {
          if (curr.nodeType === Node.ELEMENT_NODE && inlineTags.has((curr as HTMLElement).tagName.toLowerCase())) {
            inlineEl = curr as HTMLElement;
            break;
          }
          curr = curr.parentNode;
        }

        if (inlineEl && range.collapsed) {
          try {
            const testRange = document.createRange();
            testRange.selectNodeContents(inlineEl);
            testRange.setEnd(range.startContainer, range.startOffset);
            if (testRange.toString().replace(/\u200B/g, '').length === 0) {
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
          } catch (err) {}
        }
      }
    }

    // Auto-convert "- ", "* ", or "• " + Space into a real bullet list
    if (e.key === ' ') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const node = sel.anchorNode;
        const parentLi =
          node instanceof HTMLElement
            ? node.closest('li')
            : node?.parentElement?.closest('li');

        if (!parentLi) {
          const text = node?.textContent || '';
          const offset = sel.anchorOffset;
          if ((text === '-' || text === '•' || text === '*') && offset === 1) {
            e.preventDefault();
            if (node && node.nodeType === Node.TEXT_NODE) {
              node.textContent = '';
            }
            document.execCommand('insertUnorderedList');
            const md = htmlToMarkdown(editor.innerHTML);
            latestTextRef.current = md;
            setEditText(md);
            updateSelectedFormatting({ text: md });
            return;
          }
        }
      }
    }

    // Enter key inside bullet list: automatically create next bullet or exit list
    if (e.key === 'Enter') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editor) {
        const range = sel.getRangeAt(0);
        const node = sel.anchorNode;
        const parentLi =
          node instanceof HTMLElement
            ? node.closest('li')
            : node?.parentElement?.closest('li');

        if (parentLi && editor.contains(parentLi)) {
          e.preventDefault();
          const liRawText = parentLi.textContent?.replace(/\u200B/g, '').trim() || '';

          if (!liRawText) {
            // Empty bullet: exit bullet list
            const parentList = parentLi.parentElement;
            const parentListNextSibling = parentList?.nextSibling;
            const parentListParent = parentList?.parentNode;
            parentLi.remove();
            const isListEmpty = parentList && parentList.children.length === 0;
            if (isListEmpty) {
              parentList.remove();
            }
            const newDiv = document.createElement('div');
            newDiv.innerHTML = '<br>';
            if (parentListParent && parentListNextSibling) {
              parentListParent.insertBefore(newDiv, parentListNextSibling);
            } else if (parentListParent && !isListEmpty) {
              parentListParent.appendChild(newDiv);
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

          const md = htmlToMarkdown(editor.innerHTML);
          latestTextRef.current = md;
          setEditText(md);
          updateSelectedFormatting({ text: md });
          return;
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
      isGlobalBold?: boolean,
      isHandwriting?: boolean
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
          const fontWeight = isBold ? 'bold' : (isHandwriting ? '600' : '500');
          const fontFamily = isHandwriting
            ? "'Caveat', 'Kalam', 'Patrick Hand', 'Comic Sans MS', cursive, sans-serif"
            : 'sans-serif';
          ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

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

        currentY += fontSize * (isHandwriting ? 1.25 : 1.35);
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
        const w = el.width || 180;
        const h = el.height || 180;

        // Realistic paper drop shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 6;
        ctx.fillStyle = el.fillColor || '#FEF08A';
        ctx.beginPath();
        ctx.roundRect(el.x, el.y, w, h, 8);
        ctx.fill();
        ctx.restore();

        // Subtle paper border
        ctx.save();
        ctx.strokeStyle = el.color + '22';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(el.x, el.y, w, h, 8);
        ctx.stroke();

        // Subtle top highlight strip for realistic paper look
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.beginPath();
        ctx.roundRect(el.x + 1, el.y + 1, w - 2, 18, [7, 7, 0, 0]);
        ctx.fill();

        // REALISTIC PUSH PIN (📌) AT TOP CENTER
        const pinX = el.x + w / 2;
        const pinY = el.y + 10;

        // Pin shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(pinX + 2, pinY + 3, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pushpin Head - glossy red / coral gradient
        const pinGrad = ctx.createRadialGradient(pinX - 1.5, pinY - 1.5, 1, pinX, pinY, 6.5);
        pinGrad.addColorStop(0, '#FCA5A5');
        pinGrad.addColorStop(0.35, '#EF4444');
        pinGrad.addColorStop(1, '#991B1B');
        ctx.fillStyle = pinGrad;
        ctx.beginPath();
        ctx.arc(pinX, pinY, 6, 0, Math.PI * 2);
        ctx.fill();

        // Metallic rim
        ctx.strokeStyle = '#7F1D1D';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Specular white dot highlight on pin
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(pinX - 1.8, pinY - 1.8, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (!isCurrentlyEditing) {
          renderFormattedLines(
            el.text || '',
            el.x + 14,
            el.y + 34,
            el.color || '#713F12',
            el.fontSize || 20,
            el.isBold,
            true
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
  }, [elements, currentElement, zoom, pan, selectedElementId, editingId, fontLoaded]);

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
      <div className="absolute top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 z-30 flex items-center justify-between pointer-events-none gap-2">
        {/* Left: Channel Canvas Info */}
        <div className="flex items-center gap-2 sm:gap-3 bg-[#1F2326]/90 backdrop-blur border border-gray-700/80 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl shadow-2xl pointer-events-auto min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <Sparkles size={15} className="text-slack-green animate-pulse shrink-0" />
            <span className="font-bold text-xs sm:text-sm text-white truncate max-w-[100px] sm:max-w-none">
              #{channel.name} Canvas
            </span>
          </div>

          <span className="text-gray-600 hidden xs:inline">|</span>

          <div className="hidden xs:flex items-center gap-1 text-[11px] sm:text-xs text-gray-300 shrink-0">
            <Users size={13} className="text-slack-green" />
            <span>{activeUsersCount} Live</span>
          </div>

          {isSaving && (
            <span className="text-[10px] sm:text-[11px] text-gray-400 italic hidden sm:inline ml-1">
              Saving...
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 bg-[#1F2326]/90 backdrop-blur border border-gray-700/80 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl shadow-2xl pointer-events-auto shrink-0">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Undo (Ctrl+Z)"
            className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg sm:rounded-xl transition disabled:opacity-30"
          >
            <Undo2 size={15} />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            title="Redo (Ctrl+Y)"
            className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg sm:rounded-xl transition disabled:opacity-30"
          >
            <Redo2 size={15} />
          </button>

          <span className="w-px h-4 sm:h-5 bg-gray-700 mx-0.5" />

          {/* Zoom Controls */}
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.15))}
            title="Zoom In"
            className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg sm:rounded-xl transition"
          >
            <ZoomIn size={15} />
          </button>
          <span className="text-[11px] sm:text-xs text-gray-400 px-0.5 font-mono hidden sm:inline">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.max(0.2, z - 0.15))}
            title="Zoom Out"
            className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg sm:rounded-xl transition"
          >
            <ZoomOut size={15} />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            title="Reset View (100%)"
            className="hidden sm:flex p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition"
          >
            <Maximize2 size={15} />
          </button>

          <span className="w-px h-4 sm:h-5 bg-gray-700 mx-0.5" />

          {/* Export PNG */}
          <button
            onClick={handleExportImage}
            title="Export as PNG"
            className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg sm:rounded-xl transition"
          >
            <Download size={15} />
          </button>

          {/* Clear Board */}
          <button
            onClick={handleClearBoard}
            title="Clear Board"
            className="p-1.5 sm:p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg sm:rounded-xl transition"
          >
            <Trash2 size={15} />
          </button>

          {onClose && (
            <>
              <span className="w-px h-4 sm:h-5 bg-gray-700 mx-0.5" />
              <button
                onClick={onClose}
                title="Back to Chat"
                className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg sm:rounded-xl transition"
              >
                <X size={15} />
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
                  title={`${sc.label} Note`}
                  className={`w-4 h-4 rounded-md border transition hover:scale-125 relative ${
                    selectedElement.fillColor === sc.bg ? 'ring-2 ring-slack-green' : 'border-gray-500/50'
                  }`}
                >
                  <span className="absolute top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-500" />
                </button>
              ))}
            </>
          )}

          {/* Delete Element / Sticky Note Button */}
          <span className="w-px h-4 bg-gray-700 mx-0.5" />
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleDeleteElement(selectedElement.id)}
            title="Delete (Delete / Backspace)"
            className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/20 transition active:scale-95"
          >
            <Trash2 size={13} />
            <span className="text-[11px] hidden sm:inline">Delete</span>
          </button>
        </div>
      )}

      {/* Floating Center Bottom Toolbar (Tools & Palettes) */}
      <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 sm:gap-2 bg-[#1F2326]/95 backdrop-blur border border-gray-700/80 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl shadow-2xl max-w-[96vw] overflow-x-auto scrollbar-none">
        {/* Tool Selector */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
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
              className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl transition flex items-center justify-center shrink-0 ${
                activeTool === tool
                  ? 'bg-slack-green text-white shadow-lg scale-105 font-bold'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/60'
              }`}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>

        <span className="w-px h-5 sm:h-6 bg-gray-700 mx-0.5 sm:mx-1 shrink-0" />

        {/* Color Palette / Note Color Picker */}
        {activeTool === 'sticky' ? (
          <div className="flex items-center gap-1 sm:gap-1.5 px-0.5 sm:px-1 shrink-0">
            {STICKY_COLORS.map((sc, idx) => (
              <button
                key={sc.label}
                onClick={() => setStickyColorIdx(idx)}
                style={{ backgroundColor: sc.bg }}
                title={`${sc.label} Pinned Note`}
                className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md transition transform hover:scale-125 border shrink-0 relative ${
                  stickyColorIdx === idx
                    ? 'ring-2 ring-slack-green ring-offset-2 ring-offset-[#1F2326] scale-110'
                    : 'border-gray-500/50'
                }`}
              >
                <span className="absolute top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-500 shadow-sm" />
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1 sm:gap-1.5 px-0.5 sm:px-1 shrink-0">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full transition transform hover:scale-125 border shrink-0 ${
                    activeColor === c
                      ? 'ring-2 ring-slack-green ring-offset-2 ring-offset-[#1F2326]'
                      : 'border-gray-700'
                  }`}
                />
              ))}
            </div>

            <span className="w-px h-5 sm:h-6 bg-gray-700 mx-0.5 sm:mx-1 shrink-0" />

            {/* Stroke Width Selector */}
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              {[2, 4, 8].map((w) => (
                <button
                  key={w}
                  onClick={() => setStrokeWidth(w)}
                  className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-mono font-bold transition shrink-0 ${
                    strokeWidth === w
                      ? 'bg-[#383F45] text-white border border-slack-green'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {w}px
                </button>
              ))}
            </div>
          </>
        )}
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
          {/* Pinned pushpin indicator */}
          {editingElement.type === 'sticky' && (
            <div
              className="absolute -top-2 left-1/2 -translate-x-1/2 pointer-events-none z-20 flex items-center justify-center"
              style={{
                width: `${16 * zoom}px`,
                height: `${16 * zoom}px`,
              }}
            >
              <div
                className="w-4 h-4 rounded-full bg-gradient-to-br from-red-400 via-red-600 to-red-900 border border-red-950 shadow-md flex items-center justify-center relative"
                style={{
                  boxShadow: '1px 2px 5px rgba(0,0,0,0.4)',
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-white/90 -translate-x-0.5 -translate-y-0.5" />
              </div>
            </div>
          )}

          {/* Delete Button on Note / Text */}
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteElement(editingElement.id);
            }}
            title="Delete Note"
            className="absolute -top-2.5 -right-2.5 z-30 w-6 h-6 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg flex items-center justify-center transition transform hover:scale-110 active:scale-95 border border-red-800 cursor-pointer"
          >
            <Trash2 size={12} />
          </button>

          <div
            ref={inlineContentEditableRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder={
              editingElement.type === 'sticky'
                ? 'Write note...'
                : 'Type note or heading...'
            }
            onInput={() => {
              if (inlineContentEditableRef.current) {
                const md = htmlToMarkdown(inlineContentEditableRef.current.innerHTML);
                latestTextRef.current = md;
                setEditText(md);

                if (autoSaveTimerRef.current) {
                  clearTimeout(autoSaveTimerRef.current);
                }
                autoSaveTimerRef.current = setTimeout(() => {
                  const targetId = editingIdRef.current;
                  if (targetId && latestTextRef.current !== undefined) {
                    const currentText = latestTextRef.current;
                    setElements((prev) => {
                      const updated = prev.map((el) =>
                        el.id === targetId ? { ...el, text: currentText } : el
                      );
                      saveWhiteboardToServer(updated);
                      getSocket().emit('whiteboard:update', {
                        channelId: channel.id,
                        data: { elements: updated },
                      });
                      return updated;
                    });
                  }
                }, 500);
              }
            }}
            onBlur={() => finishEditing()}
            onKeyDown={handleInlineKeyDown}
            style={{
              width: `${(editingElement.width || (editingElement.type === 'sticky' ? 180 : 240)) * zoom}px`,
              minHeight: `${(editingElement.height || (editingElement.type === 'sticky' ? 180 : 44)) * zoom}px`,
              fontSize: `${(editingElement.fontSize || (editingElement.type === 'sticky' ? 20 : 18)) * zoom}px`,
              fontWeight: editingElement.isBold ? 'bold' : '500',
              fontFamily:
                editingElement.type === 'sticky'
                  ? "'Caveat', 'Kalam', 'Patrick Hand', 'Comic Sans MS', cursive, sans-serif"
                  : 'inherit',
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
              padding:
                editingElement.type === 'sticky'
                  ? `${28 * zoom}px ${14 * zoom}px ${14 * zoom}px ${14 * zoom}px`
                  : `${8 * zoom}px`,
              outline: 'none',
              lineHeight: editingElement.type === 'sticky' ? 1.25 : 1.35,
              display: 'block',
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
            }}
            className={`${
              editingElement.type === 'sticky' ? 'font-handwriting' : 'font-sans'
            } shadow-2xl focus:ring-2 focus:ring-slack-green selection:bg-slack-green selection:text-white empty:before:content-[attr(data-placeholder)] empty:before:text-gray-500 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_b]:font-bold [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_li]:leading-normal [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1`}
          />
        </div>
      )}

      {/* Quick Action Delete Badge on Selected Element */}
      {selectedElement && !editingElement && (() => {
        let rightX = selectedElement.x + (selectedElement.width || 180);
        let topY = selectedElement.y;
        if (selectedElement.type === 'pen' && selectedElement.points && selectedElement.points.length > 0) {
          const xs = selectedElement.points.map((p) => p.x);
          const ys = selectedElement.points.map((p) => p.y);
          rightX = Math.max(...xs);
          topY = Math.min(...ys);
        } else if ((selectedElement.type === 'line' || selectedElement.type === 'arrow') && selectedElement.points && selectedElement.points.length > 0) {
          const xs = selectedElement.points.map((p) => p.x);
          const ys = selectedElement.points.map((p) => p.y);
          rightX = Math.max(...xs);
          topY = Math.min(...ys);
        }

        return (
          <div
            style={{
              position: 'absolute',
              left: `${rightX * zoom + pan.x - 10}px`,
              top: `${topY * zoom + pan.y - 10}px`,
              zIndex: 45,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteElement(selectedElement.id);
            }}
          >
            <button
              title="Delete (Delete / Backspace)"
              className="w-6 h-6 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg flex items-center justify-center transition transform hover:scale-110 active:scale-95 border border-red-800 cursor-pointer"
            >
              <Trash2 size={12} />
            </button>
          </div>
        );
      })()}

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
      {/* Clear Canvas Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
          <div className="bg-[#1F2326] border border-gray-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} className="text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Clear Entire Whiteboard</h3>
                <p className="text-xs text-gray-400">Destructive action for all teammates</p>
              </div>
            </div>

            <p className="text-sm text-gray-300 mb-4 leading-relaxed">
              This will permanently delete all drawings, shapes, sticky notes, and text for everyone on <span className="font-semibold text-white">#{channel.name}</span>. This action cannot be undone.
            </p>

            <div className="bg-[#141618] border border-gray-800 rounded-xl p-3 mb-5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Type <span className="text-red-400 font-mono font-bold lowercase">clear-canvas</span> to confirm:
              </label>
              <input
                type="text"
                autoFocus
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && clearConfirmText.trim().toLowerCase() === 'clear-canvas') {
                    handleConfirmClearBoard();
                  }
                }}
                placeholder="clear-canvas"
                className="w-full bg-[#1F2326] border border-gray-700 focus:border-red-500 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-gray-600 focus:outline-none transition"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowClearModal(false);
                  setClearConfirmText('');
                }}
                disabled={isClearing}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearBoard}
                disabled={clearConfirmText.trim().toLowerCase() !== 'clear-canvas' || isClearing}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-red-900/30"
              >
                {isClearing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Clearing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Clear Everything</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
