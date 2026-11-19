'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Avatar } from '@/components/project/projectViewUtils';
import {
  Search,
  X,
  Hash,
  Lock,
  MessageSquare,
  FileText,
  Paperclip,
  User,
  ArrowRight,
  Loader2,
  ArrowLeft,
  Download,
  Board,
  Canvas,
  Clock,
  ChevronDown,
  Check,
} from '@/components/ui/icons';
import { Workspace, Channel, Project, ProjectDocument, Canvas as CanvasRecord } from '@orbit/types';
import { api } from '../../lib/api';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useTimeFormat } from '../../lib/timeFormat';

interface SearchMessagesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace | null;
  currentChannel: Channel | null;
  channels: Channel[];
  members: any[];
  onSelectMessage: (message: any) => void;
  // Optional navigation for non-message results; rows stay informational when absent.
  onSelectChannel?: (channel: Channel) => void;
  onSelectUser?: (user: any) => void;
  onSelectProject?: (project: Project) => void;
  onSelectDocument?: (doc: ProjectDocument) => void;
  onSelectCanvas?: (canvasId: string) => void;
}

type ResultType = 'projects' | 'channels' | 'messages' | 'people' | 'documents' | 'canvases';

const TYPES: { id: ResultType; label: string; group: string }[] = [
  { id: 'projects', label: 'Projects & tickets', group: 'PROJECTS & TICKETS' },
  { id: 'channels', label: 'Channels', group: 'CHANNELS' },
  { id: 'messages', label: 'Messages', group: 'MESSAGES' },
  { id: 'people', label: 'People', group: 'PEOPLE' },
  { id: 'documents', label: 'Documents', group: 'DOCUMENTS' },
  { id: 'canvases', label: 'Canvases', group: 'CANVASES' },
];

const TYPE_ALIASES: Record<string, ResultType> = {
  project: 'projects', projects: 'projects', ticket: 'projects', tickets: 'projects',
  channel: 'channels', channels: 'channels',
  message: 'messages', messages: 'messages', msg: 'messages',
  people: 'people', person: 'people', user: 'people',
  doc: 'documents', docs: 'documents', document: 'documents', documents: 'documents',
  canvas: 'canvases', canvases: 'canvases',
};

const DATE_OPTIONS = [
  { value: 'any', label: 'Any time', days: 0 },
  { value: 'today', label: 'Today', days: 1 },
  { value: '7', label: 'Last 7 days', days: 7 },
  { value: '30', label: 'Last 30 days', days: 30 },
  { value: '90', label: 'Last 90 days', days: 90 },
];

const DAY = 86_400_000;
const MAX_RECENT = 8;
// Fixed highlight tint so the match reads on light and dark surfaces alike.
const MATCH_BG = 'color-mix(in srgb, #FFD43B 55%, transparent)';

interface RecentSearch {
  q: string;
  at: number;
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const dayLabel = (ms: number) => {
  const today = startOfToday();
  if (ms >= today) return 'Today';
  if (ms >= today - DAY) return 'Yesterday';
  if (ms >= today - 6 * DAY) return new Date(ms).toLocaleDateString([], { weekday: 'long' });
  if (ms >= today - 13 * DAY) return 'Last week';
  return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const levenshtein = (a: string, b: string) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
};

// Pulls `from:@name`, `in:#channel` and `type:doc` operators out of the raw query.
const parseOperators = (raw: string) => {
  const ops: { from?: string; in?: string; type?: string } = {};
  const text = raw
    .replace(/\b(from|in|type):\s*([@#]?[\w.\-]+)/gi, (_, key: string, val: string) => {
      ops[key.toLowerCase() as 'from' | 'in' | 'type'] = val.replace(/^[@#]/, '').toLowerCase();
      return ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
  return { text, ops };
};

export const SearchMessagesDialog: React.FC<SearchMessagesDialogProps> = ({
  isOpen,
  onClose,
  workspace,
  currentChannel,
  channels,
  members,
  onSelectMessage,
  onSelectChannel,
  onSelectUser,
  onSelectProject,
  onSelectDocument,
  onSelectCanvas,
}) => {
  const timeFormat = useTimeFormat();
  const [query, setQuery] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string>(currentChannel?.id || 'all');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('any');
  const [hasAttachmentOnly, setHasAttachmentOnly] = useState<boolean>(false);
  const [activeType, setActiveType] = useState<ResultType | 'all'>('all');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [selectedFullMessage, setSelectedFullMessage] = useState<any | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [canvases, setCanvases] = useState<CanvasRecord[]>([]);
  const [recent, setRecent] = useState<RecentSearch[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const recentKey = workspace ? `orbit_recent_searches:${workspace.id}` : '';

  const { text: searchText, ops } = useMemo(() => parseOperators(query), [query]);

  const opUserId = useMemo(() => {
    if (!ops.from) return null;
    const m = members.find((mm) => {
      const u = mm.user || mm;
      return [u.username, u.displayName].some((v: string | undefined) => v?.toLowerCase().replace(/\s+/g, '') === ops.from);
    });
    return (m?.user || m)?.id ?? null;
  }, [ops.from, members]);
  const opChannelId = useMemo(
    () => (ops.in ? channels.find((c) => c.name.toLowerCase() === ops.in)?.id ?? null : null),
    [ops.in, channels],
  );
  const effectiveUserId = opUserId || (selectedUserId !== 'all' ? selectedUserId : null);
  const effectiveChannelId = opChannelId || (selectedChannelId !== 'all' ? selectedChannelId : null);
  const effectiveType: ResultType | 'all' = (ops.type && TYPE_ALIASES[ops.type]) || activeType;

  // Reset on open/close, default the channel scope to the current channel
  useEffect(() => {
    if (isOpen) {
      setSelectedChannelId(currentChannel?.id || 'all');
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setHasSearched(false);
      setSelectedChannelId(currentChannel?.id || 'all');
      setSelectedUserId('all');
      setSelectedProjectId('all');
      setDateRange('any');
      setHasAttachmentOnly(false);
      setActiveType('all');
      setSelectedFullMessage(null);
    }
  }, [isOpen, currentChannel]);

  // Non-message sources are small workspace lists; load once per open and filter locally.
  useEffect(() => {
    if (!isOpen || !workspace) return;
    let cancelled = false;
    Promise.allSettled([
      api.get(`/api/projects/workspaces/${workspace.id}/projects`),
      api.get('/api/documents', { params: { workspaceId: workspace.id } }),
      api.get('/api/canvases', { params: { workspaceId: workspace.id } }),
    ]).then(([p, d, c]) => {
      if (cancelled) return;
      if (p.status === 'fulfilled') setProjects(Array.isArray(p.value.data) ? p.value.data : p.value.data?.projects || []);
      if (d.status === 'fulfilled') setDocuments(Array.isArray(d.value.data) ? d.value.data : d.value.data?.documents || []);
      if (c.status === 'fulfilled') setCanvases(Array.isArray(c.value.data) ? c.value.data : c.value.data?.canvases || []);
    });
    try {
      setRecent(JSON.parse(localStorage.getItem(recentKey) || '[]'));
    } catch {
      setRecent([]);
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen, workspace, recentKey]);

  const saveRecent = (list: RecentSearch[]) => {
    setRecent(list);
    try {
      localStorage.setItem(recentKey, JSON.stringify(list));
    } catch {}
  };

  // ESC closes, or returns from the full message view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (selectedFullMessage) setSelectedFullMessage(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedFullMessage, onClose]);

  // Debounced message search
  useEffect(() => {
    if (!isOpen || !workspace) return;
    const trimmed = searchText.trim();
    if (!trimmed && !effectiveUserId && !hasAttachmentOnly) {
      setResults([]);
      setIsLoading(false);
      setHasSearched(false);
      return;
    }
    setIsLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const params: Record<string, string> = { workspaceId: workspace.id, limit: '30' };
        if (trimmed) params.q = trimmed;
        if (effectiveChannelId) params.channelId = effectiveChannelId;
        if (effectiveUserId) params.userId = effectiveUserId;
        if (hasAttachmentOnly) params.hasAttachment = 'true';
        const res = await api.get('/api/messages/search', { params });
        setResults(res.data.messages || []);
      } catch (err) {
        console.error('Failed to search messages', err);
        setResults([]);
      } finally {
        setHasSearched(true);
        setIsLoading(false);
      }
      if (query.trim().length >= 2) {
        const q = query.trim();
        let list: RecentSearch[] = [];
        try {
          list = JSON.parse(localStorage.getItem(recentKey) || '[]');
        } catch {}
        saveRecent([{ q, at: Date.now() }, ...list.filter((r) => r.q.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT));
      }
    }, 280);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText, effectiveChannelId, effectiveUserId, hasAttachmentOnly, isOpen, workspace]);

  const term = searchText.trim().toLowerCase();
  const minTime = (() => {
    const opt = DATE_OPTIONS.find((o) => o.value === dateRange);
    if (!opt || !opt.days) return 0;
    return opt.value === 'today' ? startOfToday() : Date.now() - opt.days * DAY;
  })();
  const inRange = (iso?: string) => !minTime || (!!iso && new Date(iso).getTime() >= minTime);

  const grouped = useMemo(() => {
    const has = (s?: string | null) => !!term && !!s && s.toLowerCase().includes(term);
    const nonDirect = channels.filter((c) => c.type !== 'DIRECT');
    const messageCountByChannel = new Map<string, number>();
    results.forEach((m) => m.channelId && messageCountByChannel.set(m.channelId, (messageCountByChannel.get(m.channelId) || 0) + 1));
    const projectFilter = selectedProjectId !== 'all' ? selectedProjectId : null;

    return {
      projects: projects.filter(
        (p) => has(p.name) && (!projectFilter || p.id === projectFilter),
      ),
      channels: nonDirect.filter((c) => has(c.name) && (!effectiveChannelId || c.id === effectiveChannelId)),
      messages: results.filter((m) => inRange(m.createdAt)),
      people: members
        .map((m) => m.user || m)
        .filter(
          (u) =>
            u?.id &&
            (has(u.displayName) || has(u.username) || has(u.email)) &&
            (!effectiveUserId || u.id === effectiveUserId),
        ),
      documents: documents.filter(
        (d) =>
          has(d.title) &&
          inRange(d.updatedAt) &&
          (!projectFilter || d.projectId === projectFilter) &&
          (!effectiveUserId || d.createdById === effectiveUserId),
      ),
      canvases: canvases.filter(
        (c) =>
          has(c.title) &&
          inRange(c.updatedAt) &&
          (!projectFilter || c.projectId === projectFilter) &&
          (!effectiveUserId || c.createdById === effectiveUserId),
      ),
      messageCountByChannel,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, channels, results, projects, members, documents, canvases, selectedProjectId, effectiveChannelId, effectiveUserId, minTime]);

  const counts: Record<ResultType, number> = {
    projects: grouped.projects.length,
    channels: grouped.channels.length,
    messages: grouped.messages.length,
    people: grouped.people.length,
    documents: grouped.documents.length,
    canvases: grouped.canvases.length,
  };
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const visibleTypes = TYPES.filter((t) => (effectiveType === 'all' || effectiveType === t.id) && counts[t.id] > 0);
  const visibleCount = visibleTypes.reduce((a, t) => a + counts[t.id], 0);
  const hasQuery = !!query.trim() || !!effectiveUserId || hasAttachmentOnly;
  const showCounts = hasSearched && !isLoading && totalCount > 0;
  const noResults = hasQuery && hasSearched && !isLoading && visibleCount === 0;

  const suggestion = useMemo(() => {
    if (!noResults || term.length < 3) return null;
    const vocab = new Set<string>();
    const add = (s?: string | null) =>
      s?.toLowerCase().split(/[^a-z0-9]+/).forEach((w) => w.length >= 3 && vocab.add(w));
    channels.forEach((c) => add(c.name));
    projects.forEach((p) => add(p.name));
    documents.forEach((d) => add(d.title));
    canvases.forEach((c) => add(c.title));
    members.forEach((m) => add((m.user || m)?.displayName));
    recent.forEach((r) => add(r.q));
    let best: { w: string; d: number } | null = null;
    vocab.forEach((w) => {
      if (w === term) return;
      const d = levenshtein(term, w);
      if (d <= 2 && (!best || d < best.d)) best = { w, d };
    });
    return (best as { w: string; d: number } | null)?.w ?? null;
  }, [noResults, term, channels, projects, documents, canvases, members, recent]);

  if (!isOpen || !workspace) return null;

  const clearFilters = () => {
    setSelectedChannelId('all');
    setSelectedUserId('all');
    setSelectedProjectId('all');
    setDateRange('any');
    setHasAttachmentOnly(false);
  };
  const searchEverywhere = () => {
    clearFilters();
    setActiveType('all');
    setQuery(searchText);
  };

  const highlight = (text: string) => {
    if (!term) return text;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === term ? (
        <mark key={i} className="font-bold px-0.5 rounded-[3px] text-[var(--theme-text)]" style={{ backgroundColor: MATCH_BG }}>
          {part}
        </mark>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      ),
    );
  };

  // Single-line message snippet centred on the first match
  const snippet = (content: string) => {
    const flat = content.replace(/\s+/g, ' ').trim();
    const idx = term ? flat.toLowerCase().indexOf(term) : -1;
    if (idx < 40) return flat;
    return `…${flat.slice(idx - 30)}`;
  };

  const formatTime = (iso: string) => {
    const ms = new Date(iso).getTime();
    if (ms >= startOfToday()) {
      return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: timeFormat === '12' });
    }
    if (ms >= startOfToday() - 6 * DAY) return new Date(iso).toLocaleDateString([], { weekday: 'short' });
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const channelName = (id?: string | null) => channels.find((c) => c.id === id);
  const projectName = (id?: string | null) => projects.find((p) => p.id === id)?.name;
  const memberName = (id?: string | null) => {
    const m = members.find((mm) => (mm.user || mm)?.id === id);
    return (m?.user || m)?.displayName;
  };

  const channelOptions = [
    { value: 'all', label: `All of ${workspace.name}` },
    ...(currentChannel ? [{ value: currentChannel.id, label: `#${currentChannel.name} (current)` }] : []),
    ...channels
      .filter((c) => c.id !== currentChannel?.id)
      .map((c) => ({ value: c.id, label: `${c.type === 'DIRECT' ? '@' : '#'} ${c.name}` })),
  ];
  const personOptions = [
    { value: 'all', label: 'Anyone' },
    ...members.map((m) => {
      const u = m.user || m;
      return { value: u.id, label: u.displayName || u.username || u.email };
    }),
  ];
  const projectOptions = [{ value: 'all', label: 'Any project' }, ...projects.map((p) => ({ value: p.id, label: p.name }))];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 px-3 sm:px-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-[1168px] h-[min(900px,calc(100vh-48px))] rounded-2xl border overflow-hidden flex flex-col z-10 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)' }}
      >
        {selectedFullMessage ? (
          <FullMessageView
            message={selectedFullMessage}
            onBack={() => setSelectedFullMessage(null)}
            onJump={() => {
              onSelectMessage(selectedFullMessage);
              onClose();
            }}
            onClose={onClose}
          />
        ) : (
          <>
            {/* Search header */}
            <div className="shrink-0 border-b" style={{ borderColor: 'var(--theme-border)' }}>
              <div className="h-[72px] px-6 flex items-center gap-4">
                <div
                  className="flex-1 min-w-0 h-11 px-[14px] flex items-center gap-[10px] rounded-xl border-2"
                  style={{ borderColor: 'var(--theme-primary)', backgroundColor: 'var(--theme-bg-app)' }}
                >
                  {isLoading ? (
                    <Loader2 size={18} className="animate-spin" style={{ color: 'var(--theme-text-muted)' }} />
                  ) : (
                    <Search size={18} style={{ color: 'var(--theme-text-muted)' }} />
                  )}
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      effectiveChannelId && channelName(effectiveChannelId)
                        ? `Search in #${channelName(effectiveChannelId)!.name}`
                        : `Search ${workspace.name}`
                    }
                    className="flex-1 min-w-0 bg-transparent outline-none text-[15px] font-medium text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] placeholder:font-normal"
                  />
                  {query && (
                    <button onClick={() => setQuery('')} title="Clear" style={{ color: 'var(--theme-text-muted)' }} className="hover:opacity-70">
                      <X size={16} />
                    </button>
                  )}
                </div>
                <button
                  onClick={onClose}
                  title="Close (Esc)"
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition hover:bg-[var(--theme-fill-hover)]"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="h-12 px-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0">
                  <TypeChip label="All" count={showCounts ? totalCount : undefined} active={effectiveType === 'all'} onClick={() => setActiveType('all')} />
                  {TYPES.map((t) => (
                    <TypeChip
                      key={t.id}
                      label={t.label}
                      count={showCounts ? counts[t.id] : undefined}
                      active={effectiveType === t.id}
                      onClick={() => setActiveType(t.id)}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <FilterPill label="Channel" value={selectedChannelId} options={channelOptions} onChange={setSelectedChannelId} />
                  <FilterPill label="Date" value={dateRange} options={DATE_OPTIONS} defaultValue="any" onChange={setDateRange} />
                  <FilterPill label="Project" value={selectedProjectId} options={projectOptions} onChange={setSelectedProjectId} />
                  <FilterPill label="Person" value={selectedUserId} options={personOptions} onChange={setSelectedUserId} />
                  <button
                    onClick={() => setHasAttachmentOnly((v) => !v)}
                    className="h-[30px] px-3 rounded-[15px] border flex items-center gap-1.5 text-[13px] font-medium transition hover:bg-[var(--theme-fill-hover)]"
                    style={{
                      borderColor: hasAttachmentOnly ? 'var(--theme-primary)' : 'var(--theme-border)',
                      backgroundColor: hasAttachmentOnly ? 'var(--theme-selected)' : undefined,
                      color: 'var(--theme-text)',
                    }}
                  >
                    <Paperclip size={14} />
                    Has files
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 flex">
              <div className="flex-1 min-w-0 overflow-y-auto">
                {!hasQuery && !isLoading && (
                  <EmptyState
                    title={`Search ${workspace.name}`}
                    body="Find projects, tickets, channels, messages, people, documents and canvases."
                  />
                )}

                {hasQuery && isLoading && !hasSearched && (
                  <div className="h-full flex items-center justify-center gap-2 text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
                    <Loader2 size={16} className="animate-spin" />
                    Searching…
                  </div>
                )}

                {noResults && (
                  <div className="h-full flex flex-col items-center justify-center">
                    <EmptyState
                      title={`No results for “${query.trim()}”`}
                      body="Check the spelling, try fewer words, or remove a filter. You can also search within one project or channel."
                    >
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={clearFilters}
                          className="h-9 px-[14px] rounded-[18px] border flex items-center gap-1.5 text-[13px] font-medium transition hover:bg-[var(--theme-fill-hover)]"
                          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-app)', color: 'var(--theme-text)' }}
                        >
                          <X size={15} />
                          Clear filters
                        </button>
                        <button
                          onClick={searchEverywhere}
                          className="h-9 px-4 rounded-[18px] flex items-center gap-1.5 text-[13px] font-semibold transition hover:brightness-95"
                          style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
                        >
                          <Search size={15} />
                          Search everywhere
                        </button>
                      </div>
                    </EmptyState>
                    {suggestion && (
                      <div className="flex items-center gap-2 pb-10">
                        <span className="text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
                          Did you mean
                        </span>
                        <button
                          onClick={() => setQuery(suggestion)}
                          className="h-[30px] px-3 rounded-[15px] flex items-center gap-1.5 text-[13px] font-semibold hover:brightness-95"
                          style={{ backgroundColor: 'var(--theme-selected)', color: 'var(--theme-primary-hover)' }}
                        >
                          <Search size={13} />
                          {suggestion}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {visibleCount > 0 && (
                  <div className="px-6 py-3 flex flex-col gap-1.5">
                    {visibleTypes.map((t) => (
                      <div key={t.id} className="flex flex-col gap-0.5">
                        <div className="h-[30px] px-[14px] flex items-center gap-2 text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                          <span className="font-bold tracking-[0.6px]">{t.group}</span>
                          <span className="font-semibold">{counts[t.id]}</span>
                        </div>

                        {t.id === 'projects' &&
                          grouped.projects.map((p) => (
                            <ResultRow
                              key={p.id}
                              Icon={Board}
                              title={highlight(p.name)}
                              subtitle={[
                                `${p._count?.tickets ?? 0} ${(p._count?.tickets ?? 0) === 1 ? 'ticket' : 'tickets'}`,
                                p.status ? p.status[0].toUpperCase() + p.status.slice(1) : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                              onClick={onSelectProject ? () => (onSelectProject(p), onClose()) : undefined}
                            />
                          ))}

                        {t.id === 'channels' &&
                          grouped.channels.map((c) => {
                            const mentions = grouped.messageCountByChannel.get(c.id) || 0;
                            const memberCount = Array.isArray(c.members) ? c.members.length : null;
                            return (
                              <ResultRow
                                key={c.id}
                                Icon={c.type === 'PRIVATE' ? Lock : Hash}
                                title={<># {highlight(c.name)}</>}
                                subtitle={[
                                  memberCount !== null ? `${memberCount} ${memberCount === 1 ? 'member' : 'members'}` : c.type === 'PRIVATE' ? 'Private channel' : 'Public channel',
                                  mentions ? `mentions ${term} ${mentions} ${mentions === 1 ? 'time' : 'times'}` : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                                onClick={onSelectChannel ? () => (onSelectChannel(c), onClose()) : undefined}
                              />
                            );
                          })}

                        {t.id === 'messages' &&
                          grouped.messages.map((m) => {
                            const author = m.bot?.name || m.user?.displayName || m.user?.username || 'Unknown';
                            const where = m.channel?.type === 'DIRECT' ? 'Direct message' : `# ${m.channel?.name || 'channel'}`;
                            return (
                              <ResultRow
                                key={m.id}
                                Icon={MessageSquare}
                                title={highlight(snippet(m.content || ''))}
                                subtitle={[author, where, m.parentMessageId ? 'Thread' : null, dayLabel(new Date(m.createdAt).getTime()), m.attachments?.length ? `${m.attachments.length} file${m.attachments.length > 1 ? 's' : ''}` : null]
                                  .filter(Boolean)
                                  .join(' · ')}
                                trailing={formatTime(m.createdAt)}
                                onClick={() => setSelectedFullMessage(m)}
                                action={
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSelectMessage(m);
                                      onClose();
                                    }}
                                    title="Jump to message"
                                    className="hidden group-hover:flex items-center gap-1 h-[26px] px-2.5 rounded-[13px] text-xs font-semibold"
                                    style={{ backgroundColor: 'var(--theme-selected)', color: 'var(--theme-primary-hover)' }}
                                  >
                                    Jump <ArrowRight size={12} />
                                  </button>
                                }
                              />
                            );
                          })}

                        {t.id === 'people' &&
                          grouped.people.map((u: any) => (
                            <ResultRow
                              key={u.id}
                              Icon={User}
                              title={highlight(u.displayName || u.username)}
                              subtitle={[u.role, `@${u.username}`].filter(Boolean).join(' · ')}
                              onClick={onSelectUser ? () => (onSelectUser(u), onClose()) : undefined}
                            />
                          ))}

                        {t.id === 'documents' &&
                          grouped.documents.map((d) => (
                            <ResultRow
                              key={d.id}
                              Icon={FileText}
                              title={highlight(d.title || 'Untitled')}
                              subtitle={[
                                d.isPublicLinkEnabled || d.shares?.length ? 'Shared' : d.isPublicInProject ? 'Project' : 'Private',
                                d.creator?.displayName || memberName(d.createdById),
                                `Edited ${dayLabel(new Date(d.updatedAt).getTime())}`,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                              onClick={onSelectDocument ? () => (onSelectDocument(d), onClose()) : undefined}
                            />
                          ))}

                        {t.id === 'canvases' &&
                          grouped.canvases.map((c) => (
                            <ResultRow
                              key={c.id}
                              Icon={Canvas}
                              title={highlight(c.title || 'Untitled canvas')}
                              subtitle={
                                c.projectId && projectName(c.projectId)
                                  ? `Linked to ${projectName(c.projectId)} board`
                                  : c.channelId && channelName(c.channelId)
                                  ? `Linked to #${channelName(c.channelId)!.name}`
                                  : `Edited ${dayLabel(new Date(c.updatedAt).getTime())}`
                              }
                              onClick={onSelectCanvas ? () => (onSelectCanvas(c.id), onClose()) : undefined}
                            />
                          ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(!hasQuery || noResults) && (
                <aside
                  className="hidden lg:flex w-[360px] shrink-0 border-l flex-col"
                  style={{ backgroundColor: 'var(--theme-bg-surface)', borderColor: 'var(--theme-border)' }}
                >
                  <div className="h-14 px-5 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--theme-border)' }}>
                    <span className="text-[15px] font-bold" style={{ color: 'var(--theme-text)' }}>
                      Recent searches
                    </span>
                    {recent.length > 0 && (
                      <button
                        onClick={() => saveRecent([])}
                        className="text-[13px] font-semibold hover:underline"
                        style={{ color: 'var(--theme-primary-hover)' }}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto">
                    {recent.length === 0 && (
                      <p className="px-5 py-3 text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
                        Your recent searches will show up here.
                      </p>
                    )}
                    {recent.map((r) => (
                      <div
                        key={r.q}
                        onClick={() => setQuery(r.q)}
                        className="group h-11 px-5 flex items-center gap-3 cursor-pointer transition hover:bg-[var(--theme-fill-hover)]"
                      >
                        <Clock size={16} style={{ color: 'var(--theme-text-muted)' }} />
                        <span className="flex-1 min-w-0 truncate text-sm font-medium" style={{ color: 'var(--theme-text)' }}>
                          {r.q}
                        </span>
                        <span className="text-xs shrink-0" style={{ color: 'var(--theme-text-muted)' }}>
                          {dayLabel(r.at)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            saveRecent(recent.filter((x) => x.q !== r.q));
                          }}
                          title="Remove"
                          className="shrink-0 hover:opacity-70"
                          style={{ color: 'var(--theme-text-muted)' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <div className="p-5 flex flex-col gap-2">
                      <span className="text-[11px] font-bold tracking-[0.6px]" style={{ color: 'var(--theme-text-muted)' }}>
                        SEARCH TIPS
                      </span>
                      <p className="text-[13px] leading-[19px]" style={{ color: 'var(--theme-text)' }}>
                        Use from:@name for people, in:#channel for a channel, and type:doc to narrow the type.
                      </p>
                    </div>
                  </div>
                </aside>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const TypeChip: React.FC<{ label: string; count?: number; active: boolean; onClick: () => void }> = ({
  label,
  count,
  active,
  onClick,
}) => (
  <button
    onClick={onClick}
    className={`h-[30px] px-3 rounded-[15px] flex items-center gap-1.5 shrink-0 text-[13px] transition ${
      active ? 'font-semibold' : 'font-medium border hover:bg-[var(--theme-fill-hover)]'
    }`}
    style={
      active
        ? { backgroundColor: 'var(--theme-primary-hover)', color: 'var(--theme-primary-text)' }
        : { backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }
    }
  >
    {label}
    {count !== undefined && (
      <span
        className="text-xs font-semibold"
        style={{ color: active ? 'color-mix(in srgb, var(--theme-primary-text) 75%, transparent)' : 'var(--theme-text-muted)' }}
      >
        {count}
      </span>
    )}
  </button>
);

const FilterPill: React.FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  onChange: (v: string) => void;
}> = ({ label, value, options, defaultValue = 'all', onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const isSet = value !== defaultValue;
  const current = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-[30px] px-3 rounded-[15px] border flex items-center gap-1.5 text-[13px] font-medium transition hover:bg-[var(--theme-fill-hover)]"
        style={{
          borderColor: isSet ? 'var(--theme-primary)' : 'var(--theme-border)',
          backgroundColor: isSet ? 'var(--theme-selected)' : undefined,
          color: 'var(--theme-text)',
        }}
      >
        <span className="max-w-[140px] truncate">{isSet ? current?.label : label}</span>
        <ChevronDown size={14} style={{ color: 'var(--theme-text-muted)' }} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 w-56 max-h-72 overflow-y-auto rounded-xl border p-1.5 shadow-xl"
          style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)' }}
        >
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="w-full h-8 px-2.5 rounded-lg flex items-center justify-between gap-2 text-[13px] text-left transition hover:bg-[var(--theme-fill-hover)]"
              style={{ color: 'var(--theme-text)' }}
            >
              <span className="truncate">{o.label}</span>
              {o.value === value && <Check size={12} style={{ color: 'var(--theme-primary)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ResultRow: React.FC<{
  Icon: React.ElementType;
  title: React.ReactNode;
  subtitle: string;
  trailing?: string;
  action?: React.ReactNode;
  onClick?: () => void;
}> = ({ Icon, title, subtitle, trailing, action, onClick }) => (
  <div
    onClick={onClick}
    className={`group h-[52px] px-[14px] flex items-center gap-3 rounded-[10px] transition ${
      onClick ? 'cursor-pointer hover:bg-[var(--theme-fill-hover)]' : ''
    }`}
  >
    <span
      className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0"
      style={{ backgroundColor: 'var(--theme-bg-surface)', color: 'var(--theme-primary-hover)' }}
    >
      <Icon size={17} />
    </span>
    <span className="flex-1 min-w-0 flex flex-col gap-px">
      <span className="text-sm font-semibold truncate" style={{ color: 'var(--theme-text)' }}>
        {title}
      </span>
      <span className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
        {subtitle}
      </span>
    </span>
    {action}
    {trailing && (
      <span className="text-xs shrink-0" style={{ color: 'var(--theme-text-muted)' }}>
        {trailing}
      </span>
    )}
  </div>
);

const EmptyState: React.FC<{ title: string; body: string; children?: React.ReactNode }> = ({ title, body, children }) => (
  <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
    <span
      className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
      style={{ backgroundColor: 'var(--theme-bg-surface)', color: 'var(--theme-primary-hover)' }}
    >
      <Search size={32} />
    </span>
    <p className="text-[17px] font-bold" style={{ color: 'var(--theme-text)' }}>
      {title}
    </p>
    <p className="w-[360px] max-w-full text-sm leading-[21px]" style={{ color: 'var(--theme-text-muted)' }}>
      {body}
    </p>
    {children}
  </div>
);

const FullMessageView: React.FC<{
  message: any;
  onBack: () => void;
  onJump: () => void;
  onClose: () => void;
}> = ({ message, onBack, onJump, onClose }) => (
  <div className="flex flex-col h-full overflow-hidden">
    <div className="h-[72px] px-6 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--theme-border)' }}>
      <button
        onClick={onBack}
        className="h-9 px-[14px] rounded-[18px] border flex items-center gap-1.5 text-[13px] font-medium transition hover:bg-[var(--theme-fill-hover)]"
        style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
      >
        <ArrowLeft size={14} />
        Back to results
      </button>
      <div className="flex items-center gap-2">
        <button
          onClick={onJump}
          className="h-9 px-4 rounded-[18px] flex items-center gap-1.5 text-[13px] font-semibold transition hover:brightness-95"
          style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
        >
          Jump to message
          <ArrowRight size={14} />
        </button>
        <button
          onClick={onClose}
          title="Close (Esc)"
          className="w-10 h-10 rounded-xl flex items-center justify-center transition hover:bg-[var(--theme-fill-hover)]"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <X size={20} />
        </button>
      </div>
    </div>

    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4" style={{ backgroundColor: 'var(--theme-bg-surface)' }}>
      <div className="flex items-center justify-between text-[13px]">
        <span className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--theme-text)' }}>
          {message.channel?.type === 'DIRECT' ? (
            <User size={14} style={{ color: 'var(--theme-text-muted)' }} />
          ) : message.channel?.type === 'PRIVATE' ? (
            <Lock size={14} style={{ color: 'var(--theme-text-muted)' }} />
          ) : (
            <Hash size={14} style={{ color: 'var(--theme-text-muted)' }} />
          )}
          {message.channel?.type === 'DIRECT' ? 'Direct message' : message.channel?.name || 'channel'}
          {message.parentMessageId && (
            <span
              className="ml-1.5 h-[22px] px-2 rounded-[11px] flex items-center gap-1 text-[11px] font-semibold"
              style={{ backgroundColor: 'var(--theme-selected)', color: 'var(--theme-primary-hover)' }}
            >
              <MessageSquare size={11} />
              Thread reply
            </span>
          )}
        </span>
        <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
          {new Date(message.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </div>

      <div className="rounded-[14px] border p-5 flex flex-col gap-3" style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)' }}>
        <div className="flex items-center gap-3">
          <Avatar
            name={message.bot?.name || message.user?.displayName || message.user?.username || 'Teammate'}
            src={message.bot?.avatarUrl || message.user?.avatarUrl}
            size={36}
          />
          <div className="flex flex-col">
            <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
              {message.bot?.name || message.user?.displayName || message.user?.username || 'Teammate'}
              {message.bot && (
                <span
                  className="h-4 px-1.5 rounded text-[10px] font-semibold flex items-center"
                  style={{ backgroundColor: 'var(--theme-bg-surface-hover)', color: 'var(--theme-text-muted)' }}
                >
                  APP
                </span>
              )}
            </span>
            <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              @{message.user?.username || 'user'}
            </span>
          </div>
        </div>
        <div className="text-sm leading-[21px] break-words" style={{ color: 'var(--theme-text)' }}>
          <MarkdownRenderer content={message.content} />
        </div>
      </div>

      {message.attachments?.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold tracking-[0.6px]" style={{ color: 'var(--theme-text-muted)' }}>
            ATTACHMENTS {message.attachments.length}
          </span>
          {message.attachments.map((att: any) => (
            <div
              key={att.id}
              className="h-[52px] px-[14px] rounded-[10px] border flex items-center gap-3"
              style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)' }}
            >
              <span
                className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--theme-bg-surface)', color: 'var(--theme-primary-hover)' }}
              >
                <Paperclip size={17} />
              </span>
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="text-sm font-semibold truncate" style={{ color: 'var(--theme-text)' }}>
                  {att.fileName}
                </span>
                <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                  {Math.round(att.fileSize / 1024)} KB
                </span>
              </span>
              <a
                href={att.fileUrl}
                target="_blank"
                rel="noreferrer"
                download={att.fileName}
                className="h-[30px] px-3 rounded-[15px] border flex items-center gap-1.5 text-[13px] font-medium transition hover:bg-[var(--theme-fill-hover)]"
                style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
              >
                <Download size={13} />
                Download
              </a>
            </div>
          ))}
        </div>
      )}

      {message.reactions?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {message.reactions.map((r: any) => (
            <span
              key={r.id}
              className="h-[26px] px-2.5 rounded-[13px] border flex items-center gap-1.5 text-xs"
              style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
            >
              {r.emoji}
              <span style={{ color: 'var(--theme-text-muted)' }}>{r.user?.displayName || '1'}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  </div>
);
