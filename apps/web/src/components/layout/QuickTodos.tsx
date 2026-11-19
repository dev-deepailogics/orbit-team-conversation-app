'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ListChecks, Trash2, X } from 'lucide-react';
import { api } from '../../lib/api';

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

// Personal quick to-dos. Alt+T (or the floating button) opens the panel with the input focused:
// type, Enter, and the next one is ready. Click a row to tick it off.
export const QuickTodos: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyT') {
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
    <div ref={panelRef} className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {open && (
        <div
          className="w-[340px] max-w-[calc(100vw-2rem)] max-h-[70vh] flex flex-col rounded-2xl border overflow-hidden"
          style={{
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

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Quick to-dos (Alt+T)"
        aria-label="Quick to-dos"
        className="relative w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition hover:brightness-110"
        style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
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
    </div>
  );
};
