'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useResizableSidebar } from '../layout/useResizableSidebar';
import { Canvas, Channel, UserProfile } from '@orbit/types';
import { Plus, Search, PenTool, Trash2, Link2, PanelLeft, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useChatStore } from '../../stores/chatStore';
import { useProjectStore } from '../../stores/projectStore';
import { WhiteboardView } from './WhiteboardView';

interface CanvasViewProps {
  workspaceId: string;
  currentUser: UserProfile | null;
  // When set, only canvases linked to this channel/project are listed, and new ones are linked to it
  scope?: { channelId?: string; projectId?: string; label: string };
  onClose?: () => void;
}

const isDirect = (c: Channel) => c.type === 'DIRECT' || c.type === 'GROUP_DIRECT';

export const CanvasView: React.FC<CanvasViewProps> = ({
  workspaceId,
  currentUser,
  scope,
  onClose,
}) => {
  const channels = useChatStore((s) => s.channels);
  const projects = useProjectStore((s) => s.projects);
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const sidebar = useResizableSidebar('orbit_canvas_sidebar_width');
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 768
  );
  const [titleDraft, setTitleDraft] = useState('');

  const selected = canvases.find((c) => c.id === selectedId) || null;

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    setSelectedId(null);
    api
      .get('/api/canvases', { params: { workspaceId, channelId: scope?.channelId, projectId: scope?.projectId } })
      .then((res) => alive && setCanvases(res.data))
      .catch((err) => console.error('Failed to load canvases', err))
      .finally(() => alive && setIsLoading(false));
    return () => {
      alive = false;
    };
  }, [workspaceId, scope?.channelId, scope?.projectId]);

  useEffect(() => setTitleDraft(selected?.title || ''), [selected?.id, selected?.title]);

  const channelLabel = (c: Channel) => {
    if (!isDirect(c)) return `#${c.name}`;
    const others = (c.members || []).filter((m) => m.userId !== currentUser?.id).map((m) => m.user?.displayName);
    return others.filter(Boolean).join(', ') || c.name;
  };

  const linkLabel = (canvas: Canvas) => {
    if (canvas.channelId) {
      const ch = channels.find((c) => c.id === canvas.channelId);
      return ch ? channelLabel(ch) : 'Linked chat';
    }
    if (canvas.projectId) {
      const pr = projects.find((p) => p.id === canvas.projectId);
      return pr ? `${pr.icon || '📋'} ${pr.name}` : 'Linked project';
    }
    return null;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? canvases.filter((c) => c.title.toLowerCase().includes(q)) : canvases;
  }, [canvases, search]);

  const openCanvas = (id: string) => {
    setSelectedId(id);
    if (typeof window !== 'undefined' && window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const patchCanvas = async (id: string, body: Partial<Pick<Canvas, 'title' | 'channelId' | 'projectId'>>) => {
    try {
      const res = await api.patch(`/api/canvases/${id}`, body);
      setCanvases((prev) => prev.map((c) => (c.id === id ? { ...c, ...res.data } : c)));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update canvas');
    }
  };

  const handleCreate = async () => {
    try {
      const res = await api.post('/api/canvases', {
        workspaceId,
        title: 'Untitled canvas',
        channelId: scope?.channelId,
        projectId: scope?.projectId,
      });
      setCanvases((prev) => [res.data, ...prev]);
      openCanvas(res.data.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create canvas');
    }
  };

  const handleDelete = async (canvas: Canvas) => {
    if (!window.confirm(`Delete "${canvas.title}" for everyone? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/canvases/${canvas.id}`);
      setCanvases((prev) => prev.filter((c) => c.id !== canvas.id));
      if (selectedId === canvas.id) setSelectedId(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete canvas');
    }
  };

  const commitTitle = () => {
    if (selected && titleDraft.trim() && titleDraft.trim() !== selected.title) {
      patchCanvas(selected.id, { title: titleDraft.trim() });
    } else {
      setTitleDraft(selected?.title || '');
    }
  };

  const linkValue = selected?.channelId
    ? `channel:${selected.channelId}`
    : selected?.projectId
      ? `project:${selected.projectId}`
      : '';

  const handleLinkChange = (value: string) => {
    if (!selected) return;
    const [kind, id] = value.split(':');
    patchCanvas(selected.id, {
      channelId: kind === 'channel' ? id : null,
      projectId: kind === 'project' ? id : null,
    });
  };

  const linkableChannels = channels.filter((c) => !c.isArchived && !isDirect(c));
  const linkableChats = channels.filter((c) => !c.isArchived && isDirect(c));

  const canDelete = (c: Canvas) => c.createdById === currentUser?.id || currentUser?.systemRole === 'SUPER_ADMIN';

  const headerSlot = selected && (
    <div className="flex items-center gap-1.5 min-w-0">
      <button
        onClick={() => setIsSidebarOpen((v) => !v)}
        title={isSidebarOpen ? 'Hide canvas list' : 'Show canvas list'}
        aria-label="Toggle canvas list"
        className="p-1 rounded-md shrink-0 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)]"
      >
        <PanelLeft size={14} />
      </button>
      <input
        value={titleDraft}
        onChange={(e) => setTitleDraft(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label="Canvas title"
        className="bg-transparent font-bold text-xs sm:text-sm text-[var(--theme-text)] focus:outline-none min-w-0 w-24 sm:w-44 rounded px-1 hover:bg-[var(--theme-bg-surface-hover)] focus:bg-[var(--theme-bg-surface-hover)]"
      />
      <label className="flex items-center gap-1 text-[11px] text-[var(--theme-text-muted)] shrink-0" title="Link to a channel, chat or project">
        <Link2 size={13} />
        <select
          value={linkValue}
          onChange={(e) => handleLinkChange(e.target.value)}
          aria-label="Link canvas to"
          className="bg-[var(--theme-bg-surface)] text-[var(--theme-text)] border border-[var(--theme-border)] rounded-md px-1 py-0.5 text-[11px] max-w-[110px] sm:max-w-[180px] focus:outline-none"
        >
          <option value="">Not linked</option>
          {linkableChannels.length > 0 && (
            <optgroup label="Channels">
              {linkableChannels.map((c) => (
                <option key={c.id} value={`channel:${c.id}`}>{channelLabel(c)}</option>
              ))}
            </optgroup>
          )}
          {linkableChats.length > 0 && (
            <optgroup label="Direct messages">
              {linkableChats.map((c) => (
                <option key={c.id} value={`channel:${c.id}`}>{channelLabel(c)}</option>
              ))}
            </optgroup>
          )}
          {projects.length > 0 && (
            <optgroup label="Projects">
              {projects.map((p) => (
                <option key={p.id} value={`project:${p.id}`}>{`${p.icon || '📋'} ${p.name}`}</option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
    </div>
  );

  return (
    <div className="flex-1 flex h-full overflow-hidden relative" style={{ color: 'var(--theme-text-primary)' }}>
      {/* Canvas list sidebar (styled like the channels / DMs sidebar) */}
      <div
        className={`${
          isSidebarOpen
            ? 'w-64 md:w-[var(--sidebar-w)] max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:shadow-2xl'
            : 'w-0'
        } shrink-0 border-r flex flex-col h-full select-none ${sidebar.dragging ? '' : 'transition-all duration-200'} overflow-hidden relative`}
        style={{ backgroundColor: 'var(--theme-bg-sidebar)', borderColor: 'var(--theme-border)', ...sidebar.style }}
      >
        {sidebar.handle}
        <div
          className="h-14 border-b px-3 sm:px-4 flex items-center justify-between gap-2 shrink-0"
          style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
        >
          <span className="truncate font-bold text-sm sm:text-base">{scope ? `Canvases · ${scope.label}` : 'Canvases'}</span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleCreate}
              title="Create new canvas"
              aria-label="Create new canvas"
              className="p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Plus size={18} />
            </button>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 rounded-lg opacity-60 hover:opacity-100 md:hidden"
              aria-label="Close canvas list"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          <div className="px-1">
            <div
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs"
              style={{ backgroundColor: 'var(--theme-bg-surface)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-muted)' }}
            >
              <Search size={14} className="shrink-0" style={{ color: 'var(--theme-primary)' }} />
              <input
                type="search"
                placeholder="Search canvases..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent focus:outline-none"
                style={{ color: 'var(--theme-text-primary)' }}
              />
            </div>
          </div>

          <div>
            <div
              className="flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider mb-1"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              <span>All canvases</span>
              <span className="text-[10px] font-semibold">{canvases.length}</span>
            </div>

            {isLoading ? (
              <div className="px-2.5 py-1.5 text-xs" style={{ color: 'var(--theme-text-muted)' }}>Loading canvases...</div>
            ) : filtered.length === 0 ? (
              <div className="px-2.5 py-1.5 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                {search ? 'No canvases found' : 'No canvases yet'}
              </div>
            ) : (
              <div className="space-y-0.5">
                {filtered.map((c) => {
                  const isActive = c.id === selectedId;
                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openCanvas(c.id)}
                      onKeyDown={(e) => e.key === 'Enter' && openCanvas(c.id)}
                      title={linkLabel(c) ? `${c.title} · ${linkLabel(c)}` : `${c.title} · Not linked`}
                      className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                        isActive ? 'shadow font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/10'
                      }`}
                      style={
                        isActive
                          ? { backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }
                          : { color: 'var(--theme-text-primary)' }
                      }
                    >
                      <div className="flex items-center gap-2 truncate">
                        <PenTool size={15} className="shrink-0 opacity-70" />
                        <span className="truncate">{c.title}</span>
                      </div>
                      {canDelete(c) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(c);
                          }}
                          title="Delete canvas"
                          aria-label={`Delete ${c.title}`}
                          className="p-0.5 rounded shrink-0 opacity-0 group-hover:opacity-70 hover:!opacity-100 focus:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main area: the selected canvas, or a "new or existing" chooser */}
      <div className="flex-1 h-full relative overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-app)' }}>
        {selected ? (
          <WhiteboardView
            key={selected.id}
            canvas={selected}
            currentUser={currentUser}
            onClose={onClose}
            headerSlot={headerSlot}
          />
        ) : (
          <div className="h-full overflow-y-auto p-6 flex flex-col items-center">
            <div className="w-full max-w-2xl mt-6 sm:mt-16">
              {!isSidebarOpen && (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="mb-4 flex items-center gap-1.5 text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
                >
                  <PanelLeft size={14} /> Show canvas list
                </button>
              )}
              <h2 className="text-lg font-bold">{scope ? `Canvases in ${scope.label}` : 'Canvases'}</h2>
              <p className="text-xs mt-1 mb-5" style={{ color: 'var(--theme-text-muted)' }}>
                Start a new canvas or pick up where you left off.
              </p>

              <button
                onClick={handleCreate}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed text-left transition hover:bg-[var(--theme-bg-surface-hover)]"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
                >
                  <Plus size={20} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">New canvas</span>
                  <span className="block text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                    {scope ? `Linked to ${scope.label}` : 'Link it to a channel, chat or project anytime'}
                  </span>
                </span>
              </button>

              {canvases.length > 0 && (
                <>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider mt-8 mb-2" style={{ color: 'var(--theme-text-muted)' }}>
                    Open existing
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {canvases.slice(0, 12).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => openCanvas(c.id)}
                        className="flex items-center gap-3 p-3 rounded-xl border text-left transition hover:bg-[var(--theme-bg-surface-hover)] min-w-0"
                        style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                      >
                        <PenTool size={16} className="shrink-0" style={{ color: 'var(--theme-primary)' }} />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium truncate">{c.title}</span>
                          <span className="block text-[11px] truncate" style={{ color: 'var(--theme-text-muted)' }}>
                            {linkLabel(c) || 'Not linked'} · {new Date(c.updatedAt).toLocaleDateString()}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
