'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ListChecks, Trash2, X } from 'lucide-react';
import { api } from '../../lib/api';
import { usePrefsStore, hydratePrefs } from '../../stores/prefsStore';

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

const BTN = 44;
const PANEL_W = 340;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

// Personal quick to-dos. Ctrl+Shift+Space / Alt+T (or the draggable floating button) opens the panel with the input focused:
// type, Enter, and the next one is ready. Click a row to tick it off.
export const QuickTodos: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const showButton = usePrefsStore((s) => s.showTodoButton);
  const savedPos = usePrefsStore((s) => s.todoPos);
  const setSavedPos = usePrefsStore((s) => s.setTodoPos);
  const [viewport, setViewport] = useState({ w: 1280, h: 800 });
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);

  useEffect(() => {
    hydratePrefs();
    const measure = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Default: right edge, vertically centred.
  const base = savedPos ?? { x: viewport.w - BTN - 16, y: viewport.h / 2 - BTN / 2 };
  const pos = dragPos ?? {
    x: clamp(base.x, 8, viewport.w - BTN - 8),
    y: clamp(base.y, 8, viewport.h - BTN - 8),
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, sx: e.clientX, sy: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
    d.moved = true;
    setDragPos({
      x: clamp(e.clientX - d.dx, 8, viewport.w - BTN - 8),
      y: clamp(e.clientY - d.dy, 8, viewport.h - BTN - 8),
    });
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved && dragPos) {
      setSavedPos(dragPos);
    } else {
      setOpen((o) => !o);
    }
    setDragPos(null);
  };

  // Panel sits beside the button, on whichever side has room.
  const panelLeft = pos.x > PANEL_W + 24 ? pos.x - PANEL_W - 8 : pos.x + BTN + 8;
  const panelTop = clamp(pos.y - 160, 8, viewport.h - 460);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/todos');
      setTodos(res.data);
      setLoaded(true);
    } catch {
      setError('Could not load your to-dos');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const altT = e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyT';
      const chord = (e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'Space';
      if (altT || chord) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText('');
    setError('');
    const tempId = `tmp-${Date.now()}`;
    setTodos((t) => [{ id: tempId, text: value, done: false }, ...t]);
    try {
      const res = await api.post('/api/todos', { text: value });
      setTodos((t) => t.map((x) => (x.id === tempId ? res.data : x)));
    } catch (err: any) {
      setTodos((t) => t.filter((x) => x.id !== tempId));
      setText(value);
      setError(err.response?.data?.error || 'Could not add to-do');
    }
  };

  const toggle = async (todo: Todo) => {
    if (todo.id.startsWith('tmp-')) return;
    setTodos((t) => t.map((x) => (x.id === todo.id ? { ...x, done: !x.done } : x)));
    try {
      await api.patch(`/api/todos/${todo.id}`, { done: !todo.done });
    } catch {
      setTodos((t) => t.map((x) => (x.id === todo.id ? { ...x, done: todo.done } : x)));
    }
  };

  const remove = async (todo: Todo) => {
    if (todo.id.startsWith('tmp-')) return;
    const prev = todos;
    setTodos((t) => t.filter((x) => x.id !== todo.id));
    try {
      await api.delete(`/api/todos/${todo.id}`);
    } catch {
      setTodos(prev);
    }
  };

  const clearDone = async () => {
    const prev = todos;
    setTodos((t) => t.filter((x) => !x.done));
    try {
      await api.delete('/api/todos/completed');
    } catch {
      setTodos(prev);
    }
  };

  const open_ = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  return (
    <div ref={panelRef}>
      {open && (
        <div
          className="fixed z-40 w-[340px] max-w-[calc(100vw-2rem)] max-h-[70vh] flex flex-col rounded-2xl border overflow-hidden"
          style={{
            left: clamp(panelLeft, 8, viewport.w - PANEL_W - 8),
            top: panelTop,
            backgroundColor: 'var(--theme-bg-app)',
            borderColor: 'var(--theme-border)',
            boxShadow: '0 12px 16px rgba(20, 26, 46, 0.2)',
          }}
        >
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <span className="text-sm font-bold" style={{ color: 'var(--theme-text)' }}>
              Quick to-dos
            </span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--theme-fill-hover)]"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              <X size={15} />
            </button>
          </div>

          <form onSubmit={add} className="px-3 pb-2">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              placeholder="Add a to-do and press Enter"
              className="w-full h-10 px-3 rounded-[10px] border text-sm outline-none focus:border-[var(--theme-primary)]"
              style={{
                backgroundColor: 'var(--theme-bg-app)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text)',
              }}
            />
          </form>
          {error && (
            <p className="px-4 pb-2 text-xs" style={{ color: '#DC2626' }}>
              {error}
            </p>
          )}

          <div className="overflow-y-auto px-2 pb-2">
            {loaded && todos.length === 0 && (
              <p className="px-2 py-4 text-center text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                Nothing to do. Type above to add one.
              </p>
            )}
            {[...open_, ...done].map((todo) => (
              <div
                key={todo.id}
                className="group flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[var(--theme-fill-hover)]"
              >
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => toggle(todo)}
                  className="mt-0.5 w-4 h-4 shrink-0 cursor-pointer accent-[var(--theme-primary)]"
                  aria-label={todo.done ? 'Mark as not done' : 'Mark as done'}
                />
                <span
                  className={`flex-1 text-sm leading-5 break-words min-w-0 ${todo.done ? 'line-through opacity-60' : ''}`}
                  style={{ color: 'var(--theme-text)' }}
                >
                  {todo.text}
                </span>
                <button
                  type="button"
                  aria-label="Delete to-do"
                  onClick={() => remove(todo)}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0 w-6 h-6 rounded flex items-center justify-center"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {done.length > 0 && (
            <button
              type="button"
              onClick={clearDone}
              className="px-4 py-2 text-xs text-left border-t hover:bg-[var(--theme-fill-hover)]"
              style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-muted)' }}
            >
              Clear {done.length} completed
            </button>
          )}
        </div>
      )}

      {showButton && (
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            drag.current = null;
            setDragPos(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpen((o) => !o);
            }
          }}
          title="Quick to-dos (Ctrl+Shift+Space). Drag to move"
          aria-label="Quick to-dos"
          className="fixed z-40 rounded-full flex items-center justify-center shadow-lg hover:brightness-110 touch-none select-none"
          style={{
            left: pos.x,
            top: pos.y,
            width: BTN,
            height: BTN,
            cursor: dragPos ? 'grabbing' : 'grab',
            backgroundColor: 'var(--theme-primary)',
            color: 'var(--theme-primary-text)',
          }}
        >
          <ListChecks size={20} />
          {open_.length > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
              style={{ backgroundColor: '#DC2626', color: '#fff' }}
            >
              {open_.length > 99 ? '99+' : open_.length}
            </span>
          )}
        </button>
      )}
    </div>
  );
};
