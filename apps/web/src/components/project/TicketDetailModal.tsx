"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Edit,
  Copy,
  Check,
  Calendar,
  Plus,
  Trash2,
  Board,
  Link2,
  Share2,
  More,
  Flag,
  User,
  AlertTriangle,
  Tag,
  AtSign,
  Send,
  Code,
  Summary,
  Clock,
  Loader2,
} from '@/components/ui/icons';
import { WorkspaceMember, ProjectColumn } from '@orbit/types';
import { TicketTypeIcon } from './TicketTypeIcon';
import { api } from '../../lib/api';
import {
  Avatar,
  LabelChip,
  PriorityPill,
  StatusBadge,
  relativeTime,
  ticketAssignees,
  ticketKey,
  ticketLabels,
} from './projectViewUtils';
import { useTicketAttachmentUpload, TicketAttachmentsField } from './TicketAttachments';

interface TicketDetailModalProps {
  projectId: string;
  workspaceId: string;
  ticket: any;
  columns?: ProjectColumn[];
  members?: WorkspaceMember[];
  onClose: () => void;
  onEditTicket: (ticket: any) => void;
  onTicketUpdated?: (ticket: any) => void;
}

const DANGER = '#DC2626';

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  projectId,
  workspaceId,
  ticket,
  columns = [],
  members = [],
  onClose,
  onEditTicket,
  onTicketUpdated,
}) => {
  const [copied, setCopied] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [checklist, setChecklist] = useState<Array<{ id: string; text: string; completed: boolean }>>(
    Array.isArray(ticket.checklist) ? ticket.checklist : [],
  );
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);
  // Attachments save to the ticket as soon as they change (upload, paste or remove)
  const upload = useTicketAttachmentUpload(
    workspaceId,
    Array.isArray(ticket.images) ? ticket.images : [],
    async (next) => {
      try {
        const res = await api.put(`/api/projects/${projectId}/tickets/${ticket.id}`, { images: next });
        onTicketUpdated?.(res.data);
      } catch (err) {
        console.error('Failed to save attachments', err);
      }
    },
  );

  useEffect(() => {
    let alive = true;
    setLoadingComments(true);
    api
      .get(`/api/projects/${projectId}/tickets/${ticket.id}/comments`)
      .then((res) => alive && setComments(res.data || []))
      .catch((err) => console.error('Failed to load ticket comments', err))
      .finally(() => alive && setLoadingComments(false));
    return () => {
      alive = false;
    };
  }, [projectId, ticket.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const flash = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const key = ticketKey(ticket);
  const handleShare = async () => {
    const text = `${key} ${ticket.title}`;
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: text, text });
        return;
      } catch {
        // cancelled: fall through to copy
      }
    }
    flash('share', text);
  };

  const saveChecklist = async (nextList: typeof checklist) => {
    setChecklist(nextList);
    try {
      const res = await api.put(`/api/projects/${projectId}/tickets/${ticket.id}`, { checklist: nextList });
      onTicketUpdated?.(res.data);
    } catch (err) {
      console.error('Failed to update checklist', err);
    }
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistItem.trim()) return;
    setIsSavingChecklist(true);
    await saveChecklist([...checklist, { id: `chk-${Date.now()}`, text: newChecklistItem.trim(), completed: false }]);
    setNewChecklistItem('');
    setIsSavingChecklist(false);
  };

  const handleSendComment = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newComment.trim() || sending) return;
    try {
      setSending(true);
      const res = await api.post(`/api/projects/${projectId}/tickets/${ticket.id}/comments`, {
        text: newComment.trim(),
        type: 'text',
      });
      setComments((prev) => [...prev, res.data]);
      setNewComment('');
      setTab('comments');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to send comment');
    } finally {
      setSending(false);
    }
  };

  const column = columns.find((c) => c.id === ticket.columnId) ?? ticket.column ?? null;
  const assignees = ticketAssignees(ticket, members);
  const labels = ticketLabels(ticket);
  const events: any[] = Array.isArray(ticket.events) ? [...ticket.events].reverse() : [];
  const reporter =
    ticket.creator ?? members.find((m) => m.userId === ticket.createdById)?.user ?? null;
  const dueDate = ticket.dueDate
    ? new Date(ticket.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const created = ticket.createdAt
    ? new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const iconBtn =
    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition hover:bg-[var(--theme-fill-hover)]';

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-150">
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'color-mix(in srgb, var(--theme-text) 24%, transparent)' }}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-label={`Ticket ${key}`}
        className="relative w-full max-w-[480px] h-full border-l flex flex-col animate-in slide-in-from-right duration-200"
        style={{
          backgroundColor: 'var(--theme-bg-app)',
          borderColor: 'var(--theme-border)',
          boxShadow: '0 1px 40px rgba(20, 26, 46, 0.2)',
          color: 'var(--theme-text)',
        }}
      >
        {/* Header */}
        <div className="h-[60px] shrink-0 border-b px-5 flex items-center gap-2.5" style={{ borderColor: 'var(--theme-border)' }}>
          <button
            type="button"
            onClick={() => flash('id', key)}
            title="Copy ticket number"
            className="h-[26px] px-2 rounded-lg flex items-center gap-1.5 text-[13px] font-bold transition hover:brightness-95"
            style={{ backgroundColor: 'var(--theme-bg-surface)', color: 'var(--theme-primary-hover)' }}
          >
            {copied === 'id' ? <Check size={14} /> : <Board size={14} />}
            {key}
          </button>
          {column && <StatusBadge column={column} height={22} />}
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => flash('link', ticket.title)}
            title={copied === 'link' ? 'Copied' : 'Copy title'}
            className={iconBtn}
            style={{ color: 'var(--theme-text-muted)' }}
          >
            {copied === 'link' ? <Check size={18} /> : <Link2 size={18} />}
          </button>
          <button
            type="button"
            onClick={handleShare}
            title={copied === 'share' ? 'Copied' : 'Share'}
            className={iconBtn}
            style={{ color: 'var(--theme-text-muted)' }}
          >
            {copied === 'share' ? <Check size={18} /> : <Share2 size={18} />}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu((v) => !v)}
              title="More"
              className={iconBtn}
              style={{ color: 'var(--theme-text-muted)' }}
            >
              <More size={18} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div
                  className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl border p-1.5 shadow-xl"
                  style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)' }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onClose();
                      onEditTicket(ticket);
                    }}
                    className="w-full h-8 px-2 rounded-lg flex items-center gap-2 text-[13px] font-medium transition hover:bg-[var(--theme-fill-hover)]"
                  >
                    <Edit size={14} style={{ color: 'var(--theme-text-muted)' }} />
                    Edit ticket
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      flash('title', ticket.title);
                    }}
                    className="w-full h-8 px-2 rounded-lg flex items-center gap-2 text-[13px] font-medium transition hover:bg-[var(--theme-fill-hover)]"
                  >
                    <Copy size={14} style={{ color: 'var(--theme-text-muted)' }} />
                    Copy title
                  </button>
                </div>
              </>
            )}
          </div>
          <button type="button" onClick={onClose} title="Close" className={iconBtn} style={{ color: 'var(--theme-text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <h2 className="text-[22px] font-bold leading-7 break-words">{ticket.title}</h2>

          <div className="flex flex-col gap-0.5">
            <Field Icon={Flag} label="Status">
              {column ? <StatusBadge column={column} /> : <Muted>—</Muted>}
            </Field>
            <Field Icon={User} label="Assignee">
              {assignees.length ? (
                <span className="flex items-center gap-3 flex-wrap">
                  {assignees.map((u) => (
                    <span key={u.id} className="flex items-center gap-2">
                      <Avatar name={u.displayName} src={u.avatarUrl} size={24} />
                      <span className="text-sm font-medium">{u.displayName}</span>
                    </span>
                  ))}
                </span>
              ) : (
                <Muted>Unassigned</Muted>
              )}
            </Field>
            <Field Icon={AlertTriangle} label="Type">
              <TicketTypeIcon type={ticket.type} showLabel />
            </Field>
            <Field Icon={AlertTriangle} label="Priority">
              <PriorityPill priority={(ticket.priority || 'MEDIUM').toUpperCase()} size="lg" />
            </Field>
            <Field Icon={Tag} label="Labels">
              {labels.length ? (
                <span className="flex items-center gap-1.5 flex-wrap">
                  {labels.map((l) => (
                    <LabelChip key={l.name} name={l.name} color={l.color} pill />
                  ))}
                </span>
              ) : (
                <Muted>—</Muted>
              )}
            </Field>
            <Field Icon={Calendar} label="Due date">
              {dueDate ? <span className="text-sm font-medium">{dueDate}</span> : <Muted>—</Muted>}
            </Field>
            <Field Icon={User} label="Reporter">
              {reporter ? (
                <span className="flex items-center gap-2">
                  <Avatar name={reporter.displayName} src={reporter.avatarUrl} size={24} />
                  <span className="text-sm font-medium">{reporter.displayName}</span>
                </span>
              ) : (
                <Muted>—</Muted>
              )}
            </Field>
            {ticket.storyPoints !== null && ticket.storyPoints !== undefined && (
              <Field Icon={Summary} label="Story points">
                <span className="text-sm font-medium">{ticket.storyPoints}</span>
              </Field>
            )}
            {ticket.gitbranch && (
              <Field Icon={Code} label="Git branch">
                <button
                  type="button"
                  onClick={() => flash('branch', ticket.gitbranch)}
                  title="Copy branch"
                  className="h-6 max-w-full px-2 rounded-md flex items-center gap-1.5 font-mono text-xs truncate transition hover:brightness-95"
                  style={{ backgroundColor: 'var(--theme-bg-surface)' }}
                >
                  <span className="truncate">{ticket.gitbranch}</span>
                  {copied === 'branch' ? <Check size={12} /> : <Copy size={12} style={{ color: 'var(--theme-text-muted)' }} />}
                </button>
              </Field>
            )}
            {created && (
              <Field Icon={Clock} label="Created">
                <span className="text-sm font-medium">{created}</span>
              </Field>
            )}
          </div>

          <Section title="Description">
            {ticket.description ? (
              <p className="text-sm leading-[21px] whitespace-pre-wrap break-words">{ticket.description}</p>
            ) : (
              <Muted>No description provided.</Muted>
            )}
          </Section>

          <Section title={`Attachments${upload.attachments.length ? ` · ${upload.attachments.length}` : ''}`}>
            <TicketAttachmentsField upload={upload} showEmpty />
          </Section>

          {ticket.testPlan && (
            <Section title="Test plan">
              <p className="text-sm leading-[21px] whitespace-pre-wrap break-words">{ticket.testPlan}</p>
            </Section>
          )}

          <Section title={`Checklist${checklist.length ? ` · ${checklist.filter((c) => c.completed).length}/${checklist.length}` : ''}`}>
            <div className="flex flex-col gap-1">
              {checklist.map((item) => (
                <div key={item.id} className="group h-8 px-1 rounded-lg flex items-center gap-2 hover:bg-[var(--theme-fill-hover)]">
                  <button
                    type="button"
                    onClick={() =>
                      saveChecklist(checklist.map((c) => (c.id === item.id ? { ...c, completed: !c.completed } : c)))
                    }
                    className="w-4 h-4 rounded flex items-center justify-center shrink-0 border"
                    style={
                      item.completed
                        ? { backgroundColor: 'var(--theme-primary)', borderColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }
                        : { borderColor: 'color-mix(in srgb, var(--theme-text) 20%, transparent)' }
                    }
                    title={item.completed ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {item.completed && <Check size={10} />}
                  </button>
                  <span
                    className={`flex-1 truncate text-sm ${item.completed ? 'line-through' : ''}`}
                    style={{ color: item.completed ? 'var(--theme-text-muted)' : 'var(--theme-text)' }}
                  >
                    {item.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => saveChecklist(checklist.filter((c) => c.id !== item.id))}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md flex items-center justify-center"
                    style={{ color: DANGER }}
                    title="Remove item"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <form onSubmit={handleAddChecklistItem} className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  placeholder="Add checklist item…"
                  className="flex-1 h-8 px-3 rounded-lg border text-[13px] outline-none bg-transparent focus:border-[var(--theme-primary)] placeholder:text-[var(--theme-text-muted)]"
                  style={{ borderColor: 'var(--theme-border)' }}
                />
                <button
                  type="submit"
                  disabled={!newChecklistItem.trim() || isSavingChecklist}
                  title="Add item"
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition disabled:opacity-40"
                  style={{ backgroundColor: 'var(--theme-fill)', color: 'var(--theme-text-muted)' }}
                >
                  <Plus size={14} />
                </button>
              </form>
            </div>
          </Section>

          {/* Tabs */}
          <div className="h-10 shrink-0 border-b flex items-start gap-5" style={{ borderColor: 'var(--theme-border)' }}>
            {(
              [
                { id: 'comments', label: 'Comments', count: comments.length },
                { id: 'activity', label: 'Activity', count: events.length },
              ] as const
            ).map((t) => {
              const active = tab === t.id;
              return (
                <button key={t.id} type="button" onClick={() => setTab(t.id)} className="h-10 flex flex-col items-center">
                  <span
                    className="h-[38px] px-0.5 flex items-center gap-1.5"
                    style={{ color: active ? 'var(--theme-primary-hover)' : 'var(--theme-text-muted)' }}
                  >
                    <span className={`text-sm ${active ? 'font-semibold' : 'font-medium'}`}>{t.label}</span>
                    <span className="text-xs font-semibold">{t.count}</span>
                  </span>
                  <span className="h-0.5 w-full" style={{ backgroundColor: active ? 'var(--theme-primary)' : 'transparent' }} />
                </button>
              );
            })}
          </div>

          {tab === 'comments' ? (
            loadingComments ? (
              <span className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
                <Loader2 size={14} className="animate-spin" /> Loading comments…
              </span>
            ) : comments.length === 0 ? (
              <Muted>No comments yet. Start the discussion below.</Muted>
            ) : (
              comments.map((c) => {
                const name = c.user?.displayName || c.username || 'Team member';
                return (
                  <div key={c.id} className="flex items-start gap-2.5">
                    <Avatar name={name} src={c.user?.avatarUrl} size={28} />
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <span className="text-[13px] font-bold">{name}</span>
                        {c.createdAt && (
                          <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                            {relativeTime(c.createdAt)}
                          </span>
                        )}
                      </span>
                      <p className="text-[13px] leading-[19px] whitespace-pre-wrap break-words">{c.text}</p>
                    </div>
                  </div>
                );
              })
            )
          ) : events.length === 0 ? (
            <Muted>No activity recorded yet.</Muted>
          ) : (
            events.map((ev, i) => (
              <div key={ev.id || i} className="flex items-start gap-2.5">
                <Avatar name={ev.user || '?'} size={28} />
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] font-bold">{ev.user || 'Someone'}</span>
                    {ev.date && (
                      <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                        {relativeTime(ev.date)}
                      </span>
                    )}
                  </span>
                  <p className="text-[13px] leading-[19px]" style={{ color: 'var(--theme-text-muted)' }}>
                    {ev.action}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Comment box */}
        <form
          onSubmit={handleSendComment}
          className="shrink-0 border-t px-5 py-3 flex items-center gap-2"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <label
            className="flex-1 min-w-0 h-10 px-3 rounded-[10px] border flex items-center gap-2 focus-within:border-[var(--theme-primary)]"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            <input
              ref={inputRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment…"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:text-[var(--theme-text-muted)]"
            />
            <button
              type="button"
              title="Mention"
              onClick={() => {
                setNewComment((v) => `${v}${v && !v.endsWith(' ') ? ' ' : ''}@`);
                inputRef.current?.focus();
              }}
              style={{ color: 'var(--theme-text-muted)' }}
            >
              <AtSign size={16} />
            </button>
          </label>
          <button
            type="submit"
            disabled={!newComment.trim() || sending}
            title="Send"
            className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 transition hover:bg-[var(--theme-primary-hover)] disabled:opacity-50"
            style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
          >
            <Send size={16} />
          </button>
        </form>
      </aside>
    </div>
  );
};

const Field: React.FC<{ Icon: React.ElementType; label: string; children: React.ReactNode }> = ({
  Icon,
  label,
  children,
}) => (
  <div className="min-h-[38px] flex items-center gap-2.5">
    <span className="w-[120px] shrink-0 flex items-center gap-2" style={{ color: 'var(--theme-text-muted)' }}>
      <Icon size={16} />
      <span className="text-[13px]">{label}</span>
    </span>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="flex flex-col gap-1.5">
    <p className="text-xs font-bold tracking-[0.5px]" style={{ color: 'var(--theme-text-muted)' }}>
      {title}
    </p>
    {children}
  </div>
);

const Muted: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
    {children}
  </span>
);
