'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useResizableSidebar } from '../layout/useResizableSidebar';
import { Canvas, Channel, UserProfile, WorkspaceMember } from '@orbit/types';
import {
  Plus,
  Search,
  Canvas as CanvasIcon,
  Trash2,
  Link2,
  X,
  Share2,
  Board,
  SortDown,
  Pencil,
} from '@/components/ui/icons';
import { api } from '../../lib/api';
import { useChatStore } from '../../stores/chatStore';
import { useProjectStore } from '../../stores/projectStore';
import { WhiteboardView } from './WhiteboardView';
import { NewCanvasModal } from './NewCanvasModal';
import { ShareCanvasModal } from './ShareCanvasModal';
import { LinkConversationModal } from '../channel/LinkConversationModal';
import { Avatar, relativeTime } from '../project/projectViewUtils';
import {
  MenuItem,
  MoreButton,
  OutlinePill,
  PageHeader,
  Popover,
  SearchField,
  SearchOrbitButton,
  SolidPill,
  TabsRow,
} from '../project/docsCanvasUi';

interface CanvasViewProps {
  workspaceId: string;
  currentUser: UserProfile | null;
  // When set, only canvases linked to this channel/project are listed, and new ones are linked to it
  scope?: { channelId?: string; projectId?: string; label: string };
  initialCanvasId?: string | null;
  onClose?: () => void;
  onOpenCanvasSidebar?: () => void;
  // Optional: owner names on cards; without it others' canvases show "Teammate"
  members?: WorkspaceMember[];
  // Optional controlled selection (e.g. driven by the app sidebar)
  selectedCanvasId?: string | null;
  onSelectCanvas?: (canvasId: string | null) => void;
  onOpenSearch?: () => void;
  getCanvasLink?: (canvasId: string) => string;
  // Bump to open the New canvas dialog from outside (e.g. the sidebar's "+")
  newCanvasSignal?: number;
  // Keep an outside canvas list (the app sidebar) in sync with changes made here
  onCanvasCreated?: (canvas: Canvas) => void;
  onCanvasDeleted?: (canvasId: string) => void;
}

type CanvasTab = 'all' | 'linked' | 'others';
type SortKey = 'edited' | 'title' | 'created';
const SORT_LABEL: Record<SortKey, string> = { edited: 'Last edited', title: 'Title', created: 'Date created' };

const isDirect = (c: Channel) => c.type === 'DIRECT' || c.type === 'GROUP_DIRECT';

const editedLabel = (iso: string) => {
  const rel = relativeTime(iso);
  return rel === 'Just now' ? 'Edited just now' : `Edited ${rel === 'Yesterday' ? 'yesterday' : rel}`;
};

export const CanvasView: React.FC<CanvasViewProps> = ({
  workspaceId,
  currentUser,
  scope,
  initialCanvasId,
  onClose,
  onOpenCanvasSidebar,
  members = [],
  selectedCanvasId,
  onSelectCanvas,
  onOpenSearch,
  getCanvasLink,
  newCanvasSignal,
  onCanvasCreated,
  onCanvasDeleted,
}) => {
  const [showLink, setShowLink] = useState(false);
  const channels = useChatStore((s) => s.channels);
  const projects = useProjectStore((s) => s.projects);
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<CanvasTab>('all');
  const [sortKey, setSortKey] = useState<SortKey>('edited');
  const [showNew, setShowNew] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const sidebar = useResizableSidebar('orbit_canvas_sidebar_width');
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 768
  );
  const [titleDraft, setTitleDraft] = useState('');

  const controlled = selectedCanvasId !== undefined;
  const selectedId = controlled ? selectedCanvasId : localSelectedId;
  const setSelectedId = (id: string | null) => {
    if (!controlled) setLocalSelectedId(id);
    onSelectCanvas?.(id);
  };

  const selected = canvases.find((c) => c.id === selectedId) || null;

  useEffect(() => {
    if (newCanvasSignal) setShowNew(true);
  }, [newCanvasSignal]);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    if (!controlled) setLocalSelectedId(null);
    api
      .get('/api/canvases', { params: { workspaceId, channelId: scope?.channelId, projectId: scope?.projectId } })
      .then((res) => {
        if (!alive) return;
        setCanvases(res.data);
        if (initialCanvasId) {
          setSelectedId(initialCanvasId);
        } else if (scope?.channelId || scope?.projectId) {
          // If a linked canvas already exists in this scope, auto-open the most recently updated one
          if (res.data.length > 0) {
            setSelectedId(res.data[0].id);
          }
        }
      })
      .catch((err) => console.error('Failed to load canvases', err))
      .finally(() => alive && setIsLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, scope?.channelId, scope?.projectId]);

  useEffect(() => setTitleDraft(selected?.title || ''), [selected?.id, selected?.title]);

  const channelLabel = (c: Channel) => {
    if (!isDirect(c)) return `# ${c.name}`;
    const others = (c.members || []).filter((m) => m.userId !== currentUser?.id).map((m) => m.user?.displayName);
    return others.filter(Boolean).join(', ') || c.name;
  };

  const linkedChannel = (canvas: Canvas) => (canvas.channelId ? channels.find((c) => c.id === canvas.channelId) || null : null);
  const linkedProject = (canvas: Canvas) => (canvas.projectId ? projects.find((p) => p.id === canvas.projectId) || null : null);

  const linkLabel = (canvas: Canvas) => {
    if (canvas.channelId) {
      const ch = linkedChannel(canvas);
      return ch ? channelLabel(ch) : 'Linked chat';
    }
    if (canvas.projectId) {
      const pr = linkedProject(canvas);
      return pr ? `${pr.name} board` : 'Linked project';
    }
    return null;
  };

  const owner = (canvas: Canvas) => {
    if (canvas.createdById === currentUser?.id) {
      return { name: currentUser.displayName, label: `You (${currentUser.displayName})`, avatarUrl: currentUser.avatarUrl, isMe: true };
    }
    const u = members.find((m) => m.userId === canvas.createdById)?.user;
    return { name: u?.displayName || 'Teammate', label: u?.displayName || 'Teammate', avatarUrl: u?.avatarUrl, isMe: false };
  };

  const tabCanvases: Record<CanvasTab, Canvas[]> = useMemo(
    () => ({
      all: canvases,
      linked: canvases.filter((c) => c.channelId || c.projectId),
      others: canvases.filter((c) => c.createdById !== currentUser?.id),
    }),
    [canvases, currentUser?.id]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = tabCanvases[tab].filter((c) => !q || c.title.toLowerCase().includes(q));
    return [...list].sort((a, b) =>
      sortKey === 'title'
        ? a.title.localeCompare(b.title)
        : sortKey === 'created'
          ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [tabCanvases, tab, search, sortKey]);

  const openCanvas = (id: string) => {
    setSelectedId(id);
    if (scope && typeof window !== 'undefined' && window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const patchCanvas = async (id: string, body: Partial<Pick<Canvas, 'title' | 'channelId' | 'projectId'>>) => {
    try {
      const res = await api.patch(`/api/canvases/${id}`, body);
      setCanvases((prev) => prev.map((c) => (c.id === id ? { ...c, ...res.data } : c)));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update canvas');
    }
  };

  const handleDelete = async (canvas: Canvas) => {
    if (!window.confirm(`Delete "${canvas.title}" for everyone? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/canvases/${canvas.id}`);
      setCanvases((prev) => prev.filter((c) => c.id !== canvas.id));
      onCanvasDeleted?.(canvas.id);
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


  const canDelete = (c: Canvas) => c.createdById === currentUser?.id || currentUser?.systemRole === 'SUPER_ADMIN';

  const newCanvasModal = showNew && (
    <NewCanvasModal
      workspaceId={workspaceId}
      currentUser={currentUser}
      channels={channels}
      projects={projects}
      defaultLink={
        scope ? { channelId: scope.channelId || null, projectId: scope.projectId || null } : undefined
      }
      onClose={() => setShowNew(false)}
      onCreated={(canvas) => {
        setShowNew(false);
        setCanvases((prev) => [canvas, ...prev]);
        onCanvasCreated?.(canvas);
        openCanvas(canvas.id);
      }}
    />
  );

  // ---------------- Workspace (a canvas is open) ----------------
  const workspace = selected && (
    <>
      <WhiteboardView
        key={selected.id}
        canvas={selected}
        currentUser={currentUser}
        onClose={onClose}
        onBack={() => setSelectedId(null)}
        backLabel="Canvas"
        headerSlot={
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-label="Canvas title"
            className="w-full max-w-[420px] bg-transparent font-bold outline-none rounded-md -ml-1 px-1 hover:bg-[var(--theme-fill-hover)] focus:bg-[var(--theme-fill-hover)]"
            style={{ color: 'var(--theme-text)' }}
          />
        }
        headerMeta={
          linkLabel(selected) && (
            <>
              <span>·</span>
              <span className="font-medium truncate" style={{ color: 'var(--theme-primary-hover)' }}>
                Linked to {linkLabel(selected)}
              </span>
            </>
          )
        }
        headerActions={
          <>
            <span className="hidden md:block">
              <OutlinePill onClick={() => setShowLink(true)} icon={<Link2 size={14} />} title="Link to a channel or chat">
                {linkLabel(selected) ? `Linked: ${linkLabel(selected)}` : 'Link to channel'}
              </OutlinePill>
            </span>
            <SolidPill onClick={() => setShowShare(true)} icon={<Share2 size={14} />}>
              Share
            </SolidPill>
          </>
        }
        moreItems={(close) => (
          <>
            {projects.length > 0 && <GroupLabel>Link to project board</GroupLabel>}
            {projects.map((p) => (
              <MenuItem
                key={p.id}
                icon={<Board size={14} />}
                selected={p.id === selected.projectId}
                onClick={() => {
                  close();
                  patchCanvas(selected.id, { channelId: null, projectId: p.id === selected.projectId ? null : p.id });
                }}
              >
                {p.name}
              </MenuItem>
            ))}
            {canDelete(selected) && (
              <MenuItem
                danger
                icon={<Trash2 size={14} />}
                onClick={() => {
                  close();
                  handleDelete(selected);
                }}
              >
                Delete canvas
              </MenuItem>
            )}
          </>
        )}
      />
      {showLink && (
        <LinkConversationModal
          item={{ title: selected.title, kind: 'canvas' }}
          channels={channels.filter((c) => !c.isArchived)}
          currentUserId={currentUser?.id}
          linkedChannelId={selected.channelId}
          onLink={(channelId) => {
            setShowLink(false);
            patchCanvas(selected.id, { channelId, projectId: null });
          }}
          onClose={() => setShowLink(false)}
        />
      )}
      {showShare && (
        <ShareCanvasModal
          canvas={selected}
          owner={owner(selected)}
          channel={linkedChannel(selected)}
          project={linkedProject(selected)}
          channelLabel={channelLabel}
          getCanvasLink={getCanvasLink}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );

  // ---------------- Canvas list ----------------
  const list = (
    <div className="flex-1 h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-app)' }}>
      <div className="shrink-0 border-b" style={{ borderColor: 'var(--theme-border)' }}>
        <PageHeader
          icon={<CanvasIcon size={20} />}
          title={scope ? `Canvas · ${scope.label}` : 'Canvas'}
          subtitle="Whiteboards for planning and brainstorming. Link them to any conversation."
          right={
            <>
              {onOpenSearch && <SearchOrbitButton onClick={onOpenSearch} />}
              {!scope && onOpenCanvasSidebar && (
                <button
                  type="button"
                  onClick={onOpenCanvasSidebar}
                  className="md:hidden h-8 px-2.5 rounded-lg text-[13px] font-medium transition hover:bg-[var(--theme-fill-hover)]"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  Menu
                </button>
              )}
              {scope && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  title="Back to messages"
                  className="w-9 h-9 rounded-[10px] flex items-center justify-center transition hover:bg-[var(--theme-fill-hover)]"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <X size={18} />
                </button>
              )}
            </>
          }
        />
        <TabsRow<CanvasTab>
          tabs={[
            { id: 'all', label: 'All canvases', count: tabCanvases.all.length },
            { id: 'linked', label: 'Linked', count: tabCanvases.linked.length },
            { id: 'others', label: 'Shared with me', count: tabCanvases.others.length },
          ]}
          active={tab}
          onChange={setTab}
          action={
            <SolidPill onClick={() => setShowNew(true)} icon={<Plus size={14} />}>
              New canvas
            </SolidPill>
          }
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4 flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <SearchField value={search} onChange={setSearch} placeholder="Search canvases" />
          <span className="flex-1" />
          <Popover
            width={180}
            trigger={(_, toggle) => (
              <OutlinePill onClick={toggle} icon={<SortDown size={14} />}>
                {SORT_LABEL[sortKey]}
              </OutlinePill>
            )}
          >
            {(close) =>
              (Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                <MenuItem
                  key={k}
                  selected={k === sortKey}
                  onClick={() => {
                    setSortKey(k);
                    close();
                  }}
                >
                  {SORT_LABEL[k]}
                </MenuItem>
              ))
            }
          </Popover>
        </div>

        {isLoading ? (
          <p className="text-[13px] py-6" style={{ color: 'var(--theme-text-muted)' }}>
            Loading canvases…
          </p>
        ) : filtered.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <p className="text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
              {search ? 'No canvases match your search.' : tab === 'all' ? 'No canvases yet.' : 'Nothing here yet.'}
            </p>
            {!search && (
              <SolidPill onClick={() => setShowNew(true)} icon={<Plus size={14} />}>
                New canvas
              </SolidPill>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c) => {
              const who = owner(c);
              const link = linkLabel(c);
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openCanvas(c.id)}
                  onKeyDown={(e) => e.key === 'Enter' && openCanvas(c.id)}
                  className="group relative rounded-[14px] border overflow-hidden text-left cursor-pointer transition hover:-translate-y-px"
                  style={{
                    borderColor: 'var(--theme-border)',
                    backgroundColor: 'var(--theme-bg-app)',
                    boxShadow: '0 1px 2px rgba(20, 26, 46, 0.06)',
                  }}
                >
                  <div
                    className="h-[150px] flex items-center justify-center"
                    style={{
                      backgroundColor: 'var(--theme-bg-surface)',
                      backgroundImage: 'radial-gradient(var(--theme-border) 1.2px, transparent 1.2px)',
                      backgroundSize: '18px 18px',
                      color: 'var(--theme-text-muted)',
                    }}
                  >
                    <span
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: 'var(--theme-bg-app)', color: 'var(--theme-accent)', boxShadow: '0 1px 2px rgba(20, 26, 46, 0.06)' }}
                    >
                      <CanvasIcon size={22} />
                    </span>
                  </div>
                  <span
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition rounded-lg"
                    style={{ backgroundColor: 'var(--theme-bg-app)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Popover width={180} trigger={(_, toggle) => <MoreButton onClick={toggle} />}>
                      {(close) => (
                        <>
                          <MenuItem
                            icon={<Pencil size={14} />}
                            onClick={() => {
                              close();
                              openCanvas(c.id);
                            }}
                          >
                            Open
                          </MenuItem>
                          {canDelete(c) && (
                            <MenuItem
                              danger
                              icon={<Trash2 size={14} />}
                              onClick={() => {
                                close();
                                handleDelete(c);
                              }}
                            >
                              Delete
                            </MenuItem>
                          )}
                        </>
                      )}
                    </Popover>
                  </span>
                  <div className="p-3.5 flex flex-col gap-2">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--theme-text)' }}>
                      {c.title}
                    </p>
                    <div className="flex items-center gap-2 min-w-0 text-xs">
                      <Avatar name={who.name} src={who.avatarUrl} size={20} />
                      <span className="truncate" style={{ color: 'var(--theme-text)' }}>
                        {who.label}
                      </span>
                      <span style={{ color: 'var(--theme-text-muted)' }}>·</span>
                      <span className="truncate" style={{ color: 'var(--theme-text-muted)' }}>
                        {editedLabel(c.updatedAt)}
                      </span>
                    </div>
                    <span
                      className="self-start inline-flex items-center gap-[5px] h-[22px] px-2 rounded-[11px] text-xs font-semibold max-w-full"
                      style={
                        link
                          ? { backgroundColor: 'var(--theme-bg-surface)', color: 'var(--theme-primary-hover)' }
                          : { backgroundColor: 'var(--theme-bg-surface-hover)', color: 'var(--theme-text-muted)' }
                      }
                    >
                      <Link2 size={12} />
                      <span className="truncate">{link || 'Not linked'}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex h-full overflow-hidden relative" style={{ color: 'var(--theme-text-primary)' }}>
      {/* Scoped canvas list (embedded in a channel's canvas tab) */}
      {scope && (
        <div
          className={`${
            isSidebarOpen ? 'w-64 md:w-[var(--sidebar-w)]' : 'w-0'
          } shrink-0 border-r flex flex-col h-full select-none ${sidebar.dragging ? '' : 'transition-all duration-200'} overflow-hidden relative`}
          style={{ backgroundColor: 'var(--theme-bg-sidebar)', borderColor: 'var(--theme-border)', ...sidebar.style }}
        >
          {sidebar.handle}
          <div
            className="h-14 border-b pl-4 pr-3 flex items-center justify-between gap-2 shrink-0"
            style={{ borderColor: 'var(--theme-fill)', color: 'var(--theme-text)' }}
          >
            <span className="truncate font-bold text-[15px]">Canvases · {scope.label}</span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setShowNew(true)}
                title="Create new canvas"
                aria-label="Create new canvas"
                className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:brightness-95"
                style={{ backgroundColor: 'var(--theme-fill)', color: 'var(--theme-text-muted)' }}
              >
                <Plus size={18} />
              </button>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center md:hidden"
                aria-label="Close canvas list"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
            <label
              className="mx-1 h-8 flex items-center gap-[9px] pl-[9px] pr-3 rounded-lg"
              style={{ backgroundColor: 'var(--theme-fill)', color: 'var(--theme-text-muted)' }}
            >
              <Search size={16} />
              <input
                type="search"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent outline-none text-[13px]"
                style={{ color: 'var(--theme-text)' }}
              />
            </label>

            <div className="space-y-0.5">
              {isLoading ? (
                <p className="px-2.5 py-1.5 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                  Loading canvases…
                </p>
              ) : filtered.length === 0 ? (
                <p className="px-2.5 py-1.5 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                  {search ? 'No canvases found' : 'No canvases yet'}
                </p>
              ) : (
                filtered.map((c) => {
                  const isActive = c.id === selectedId;
                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openCanvas(c.id)}
                      onKeyDown={(e) => e.key === 'Enter' && openCanvas(c.id)}
                      className={`group relative flex items-center h-8 pr-2 rounded-lg cursor-pointer transition-colors ${
                        isActive ? '' : 'hover:bg-[var(--theme-fill-hover)]'
                      }`}
                      style={isActive ? { backgroundColor: 'var(--theme-selected)' } : undefined}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-[6px] w-[3px] h-5 rounded-[2px]" style={{ backgroundColor: 'var(--theme-accent)' }} />
                      )}
                      <span className="ml-[10px] mr-2 flex" style={{ color: 'var(--theme-text-muted)' }}>
                        <CanvasIcon size={18} />
                      </span>
                      <span
                        className={`flex-1 truncate text-sm ${isActive ? 'font-semibold' : ''}`}
                        style={{ color: 'var(--theme-text)' }}
                      >
                        {c.title}
                      </span>
                      {canDelete(c) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(c);
                          }}
                          title="Delete canvas"
                          aria-label={`Delete ${c.title}`}
                          className="p-1 rounded shrink-0 opacity-0 group-hover:opacity-70 hover:!opacity-100 focus:opacity-100"
                          style={{ color: 'var(--theme-text-muted)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 h-full relative overflow-hidden flex">{workspace || list}</div>
      {newCanvasModal}
    </div>
  );
};

const GroupLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
    {children}
  </p>
);
