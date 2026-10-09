'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Channel, UserProfile } from '@orbit/types';
import {
  MousePointer,
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
  Palette,
} from 'lucide-react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';

export type ToolType =
  | 'select'
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

export const WhiteboardView: React.FC<WhiteboardViewProps> = ({
  channel,
  currentUser,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [activeColor, setActiveColor] = useState<string>('#007A5A');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [stickyColorIdx, setStickyColorIdx] = useState<number>(0);

  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [history, setHistory] = useState<CanvasElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentElement, setCurrentElement] = useState<CanvasElement | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [editingTextElementId, setEditingTextElementId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState<string>('');

  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [peerCursors, setPeerCursors] = useState<{ [userId: string]: PeerCursor }>({});
  const [activeUsersCount, setActiveUsersCount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch channel whiteboard data on load
  useEffect(() => {
    let isMounted = true;
    const loadWhiteboard = async () => {
      try {
        setIsLoading(true);
        const res = await api.get(`/api/channels/${channel.id}/whiteboard`);
        if (isMounted && res.data.whiteboardData?.elements) {
          const loaded = res.data.whiteboardData.elements;
          setElements(loaded);
          setHistory([loaded]);
          setHistoryIndex(0);
        }
      } catch (err) {
        console.error('Failed to load whiteboard', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadWhiteboard();
    return () => {
      isMounted = false;
    };
  }, [channel.id]);

  // 2. Real-time collaboration listeners via Socket.IO
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
      }
    };

    socket.on('whiteboard:update', onWhiteboardUpdate);
    socket.on('whiteboard:cursor', onWhiteboardCursor);
    socket.on('whiteboard:clear', onWhiteboardClear);

    // Clean up stale cursors every 3 seconds
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

  // 3. Debounced Auto-save to Server
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

  // Push elements into undo/redo history
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
    if (confirm('Are you sure you want to clear the entire whiteboard?')) {
      commitElements([]);
      try {
        await api.delete(`/api/channels/${channel.id}/whiteboard`);
      } catch (err) {
        console.error('Failed to clear whiteboard', err);
      }
    }
  };

  // Convert client coordinates to canvas world coordinates
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    };
  };

  // Broadcast mouse cursor to teammates
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

  // Mouse Handlers for Drawing & Interacting
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);

    // Right-click or middle-click or Space for pan
    if (e.button === 1 || e.button === 2 || e.shiftKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (activeTool === 'select') {
      // Find clicked element in reverse order
      const clicked = [...elements].reverse().find((el) => {
        if (el.type === 'rect' || el.type === 'sticky') {
          return (
            coords.x >= el.x &&
            coords.x <= el.x + (el.width || 100) &&
            coords.y >= el.y &&
            coords.y <= el.y + (el.height || 100)
          );
        }
        if (el.type === 'circle') {
          const r = (el.width || 50) / 2;
          const cx = el.x + r;
          const cy = el.y + r;
          return Math.hypot(coords.x - cx, coords.y - cy) <= r;
        }
        if (el.type === 'text') {
          return (
            coords.x >= el.x &&
            coords.x <= el.x + (el.width || 120) &&
            coords.y >= el.y &&
            coords.y <= el.y + (el.height || 30)
          );
        }
        return false;
      });

      setSelectedElementId(clicked?.id || null);
      return;
    }

    if (activeTool === 'eraser') {
      const remaining = elements.filter((el) => {
        if (el.type === 'rect' || el.type === 'sticky') {
          return !(
            coords.x >= el.x &&
            coords.x <= el.x + (el.width || 100) &&
            coords.y >= el.y &&
            coords.y <= el.y + (el.height || 100)
          );
        }
        if (el.type === 'circle') {
          const r = (el.width || 50) / 2;
          return Math.hypot(coords.x - (el.x + r), coords.y - (el.y + r)) > r;
        }
        return true;
      });
      if (remaining.length !== elements.length) {
        commitElements(remaining);
      }
      return;
    }

    if (activeTool === 'sticky') {
      const stickyColor = STICKY_COLORS[stickyColorIdx];
      const newSticky: CanvasElement = {
        id: `sticky-${Date.now()}`,
        type: 'sticky',
        x: coords.x,
        y: coords.y,
        width: 140,
        height: 140,
        color: stickyColor.text,
        fillColor: stickyColor.bg,
        strokeWidth: 2,
        text: 'Type a thought...',
      };
      commitElements([...elements, newSticky]);
      setEditingTextElementId(newSticky.id);
      setEditingTextValue(newSticky.text || '');
      setActiveTool('select');
      return;
    }

    if (activeTool === 'text') {
      const newText: CanvasElement = {
        id: `text-${Date.now()}`,
        type: 'text',
        x: coords.x,
        y: coords.y,
        width: 160,
        height: 36,
        color: activeColor,
        strokeWidth: 1,
        fontSize: 16,
        text: 'Heading / Idea',
      };
      commitElements([...elements, newText]);
      setEditingTextElementId(newText.id);
      setEditingTextValue(newText.text || '');
      setActiveTool('select');
      return;
    }

    // Start drawing shape or freehand
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

    if (isDrawing && currentElement) {
      commitElements([...elements, currentElement]);
      setCurrentElement(null);
      setIsDrawing(false);
    }
  };

  // Render Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to container
    const width = containerRef.current?.clientWidth || window.innerWidth;
    const height = containerRef.current?.clientHeight || window.innerHeight;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    // Clear background
    ctx.fillStyle = '#181B1E';
    ctx.fillRect(0, 0, width, height);

    // Draw grid dots
    ctx.save();
    ctx.fillStyle = '#2C3136';
    const dotSpacing = 24 * zoom;
    const offsetX = (pan.x % dotSpacing + dotSpacing) % dotSpacing;
    const offsetY = (pan.y % dotSpacing + dotSpacing) % dotSpacing;
    for (let x = offsetX; x < width; x += dotSpacing) {
      for (let y = offsetY; y < height; y += dotSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Apply zoom & pan transformations
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const renderList = currentElement ? [...elements, currentElement] : elements;

    renderList.forEach((el) => {
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
        ctx.fillStyle = el.color + '15'; // 10% opacity fill
        ctx.fill();
        ctx.stroke();
      } else if (el.type === 'circle') {
        const rx = Math.abs(el.width || 0) / 2;
        const ry = Math.abs(el.height || 0) / 2;
        const cx = el.x + (el.width || 0) / 2;
        const cy = el.y + (el.height || 0) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        ctx.fillStyle = el.color + '15';
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
        const w = el.width || 140;
        const h = el.height || 140;
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = el.fillColor || '#FEF08A';
        ctx.beginPath();
        ctx.roundRect(el.x, el.y, w, h, 6);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = el.color + '33';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Render sticky note text
        ctx.fillStyle = el.color;
        ctx.font = '500 13px sans-serif';
        const lines = (el.text || '').split('\n');
        lines.forEach((line, i) => {
          ctx.fillText(line, el.x + 12, el.y + 24 + i * 18, w - 24);
        });
      } else if (el.type === 'text') {
        ctx.fillStyle = el.color;
        ctx.font = `600 ${el.fontSize || 16}px sans-serif`;
        ctx.fillText(el.text || '', el.x, el.y + 18);
      }

      ctx.restore();
    });

    ctx.restore();
  }, [elements, currentElement, zoom, pan]);

  // Export to PNG Image
  const handleExportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${channel.name}-whiteboard.png`;
    a.click();
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col bg-[#181B1E] overflow-hidden select-none"
    >
      {/* Top Controls Header */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
        {/* Left: Channel Title & Active Users */}
        <div className="flex items-center gap-3 bg-[#222529]/90 backdrop-blur border border-gray-700/80 px-4 py-2 rounded-2xl shadow-2xl pointer-events-auto">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-slack-green animate-pulse" />
            <span className="font-bold text-sm text-white">{channel.name} Canvas</span>
          </div>

          <span className="text-gray-600">|</span>

          {/* Real-time collaborator count */}
          <div className="flex items-center gap-1.5 text-xs text-gray-300">
            <Users size={14} className="text-slack-green" />
            <span>{activeUsersCount} Live</span>
          </div>

          {isSaving && (
            <span className="text-[11px] text-gray-400 italic ml-2">Saving...</span>
          )}
        </div>

        {/* Right: Actions (Undo/Redo, Export, Zoom, Close) */}
        <div className="flex items-center gap-1.5 bg-[#222529]/90 backdrop-blur border border-gray-700/80 p-1.5 rounded-2xl shadow-2xl pointer-events-auto">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Undo"
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition disabled:opacity-30"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            title="Redo"
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition disabled:opacity-30"
          >
            <Redo2 size={16} />
          </button>

          <span className="w-px h-5 bg-gray-700 mx-1" />

          {/* Zoom In / Out */}
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
            title="Zoom In"
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition"
          >
            <ZoomIn size={16} />
          </button>
          <span className="text-xs text-gray-400 px-1 font-mono">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
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
            title="Reset Zoom & Pan"
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

      {/* Floating Center Bottom / Left Toolbar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-[#222529]/95 backdrop-blur border border-gray-700/80 p-2 rounded-2xl shadow-2xl">
        {/* Tool Buttons */}
        <div className="flex items-center gap-1">
          {[
            { tool: 'select', icon: MousePointer, label: 'Select' },
            { tool: 'pen', icon: Pencil, label: 'Draw' },
            { tool: 'rect', icon: Square, label: 'Rectangle' },
            { tool: 'circle', icon: Circle, label: 'Circle' },
            { tool: 'arrow', icon: ArrowRight, label: 'Arrow' },
            { tool: 'line', icon: Minus, label: 'Line' },
            { tool: 'sticky', icon: StickyNote, label: 'Sticky Note' },
            { tool: 'text', icon: Type, label: 'Text' },
            { tool: 'eraser', icon: Eraser, label: 'Eraser' },
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
                activeColor === c ? 'ring-2 ring-slack-green ring-offset-2 ring-offset-[#222529]' : 'border-gray-700'
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
        className="w-full h-full cursor-crosshair touch-none"
      />

      {/* Inline Text Editor for Sticky Note / Text Editing */}
      {editingTextElementId && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-[#222529] border border-gray-700 p-5 rounded-2xl shadow-2xl w-96 space-y-4">
            <h4 className="text-sm font-bold text-white">Edit Note / Text</h4>
            <textarea
              rows={4}
              value={editingTextValue}
              onChange={(e) => setEditingTextValue(e.target.value)}
              autoFocus
              className="w-full bg-[#181B1E] border border-gray-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-slack-green resize-none"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingTextElementId(null)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  commitElements(
                    elements.map((el) =>
                      el.id === editingTextElementId ? { ...el, text: editingTextValue } : el
                    )
                  );
                  setEditingTextElementId(null);
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-slack-green hover:bg-[#008a65] text-white rounded-lg transition"
              >
                Save
              </button>
            </div>
          </div>
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
