'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ProjectDocument, UserProfile, WorkspaceMember, SOCKET_EVENTS } from '@orbit/types';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useProjectStore } from '../../stores/projectStore';
import { NotionEditor } from './NotionEditor';
import { ShareDocumentModal } from './ShareDocumentModal';
import { NewDocumentModal } from './NewDocumentModal';
import { Avatar, relativeTime } from './projectViewUtils';
import {
  AvatarStack,
  BackPill,
  MenuItem,
  MoreButton,
  OutlinePill,
  PageHeader,
  Popover,
  SaveMeta,
  SearchField,
  SearchOrbitButton,
  SolidPill,
  TabsRow,
  Visibility,
  VisibilityPill,
} from './docsCanvasUi';
import {
  Plus,
  FileText,
  Globe,
  Share2,
  Pencil,
  Trash2,
  Filter,
  SortDown,
  Link2,
  Board,
  Image as ImageIcon,
} from '@/components/ui/icons';

// Docs are workspace-level; a doc can optionally be linked to a project.
interface ProjectDocsViewProps {
  workspaceId: string;
  currentUser: UserProfile | null;
  members: WorkspaceMember[];
  initialDocId?: string | null; // from the URL (?view=docs&docId=...)
  onDocChange?: (docId: string | null) => void;
  onOpenDocsSidebar?: () => void;
  onOpenSearch?: () => void;
  // Bump to open the New document dialog from outside (e.g. the sidebar's "+")
  newDocSignal?: number;
}

const COVER_PRESETS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #13547a 0%, #80d0c7 100%)',
  'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)',
  'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)',
  'linear-gradient(135deg, #f12711 0%, #f5af19 100%)',
  'linear-gradient(135deg, #b224ef 0%, #7579ff 100%)',
  'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
  'linear-gradient(135deg, #111827 0%, #374151 100%)',
];

const EMOJI_PRESETS = ['📄', '📝', '💡', '🚀', '📚', '🎯', '⚡', '🎨', '🔬', '📌', '🛠️', '✨'];

type DocTab = 'mine' | 'public' | 'shared';
type SortKey = 'edited' | 'title' | 'created';

const SORT_LABEL: Record<SortKey, string> = { edited: 'Last edited', title: 'Title', created: 'Date created' };

export const visibilityOf = (doc: ProjectDocument): Visibility =>
  doc.isPublicInProject ? 'public' : doc.shares && doc.shares.length > 0 ? 'shared' : 'draft';

const VisibilityIcon: React.FC<{ v: Visibility }> = ({ v }) =>
  v === 'public' ? <Globe size={12} /> : v === 'shared' ? <Share2 size={12} /> : <Pencil size={12} />;

const editedLabel = (iso: string) => {
  const rel = relativeTime(iso);
  return rel === 'Just now' ? 'Edited just now' : `Edited ${rel === 'Yesterday' ? 'yesterday' : rel}`;
};

export const ProjectDocsView: React.FC<ProjectDocsViewProps> = ({
  workspaceId,
  currentUser,
  members,
  initialDocId,
  onDocChange,
  onOpenDocsSidebar,
  onOpenSearch,
  newDocSignal,
}) => {
  const projects = useProjectStore((s) => s.projects);
  const {
    documents,
    currentDocument,
    setDocuments,
    setCurrentDocument,
    addDocument,
    updateDocument,
    removeDocument,
  } = useProjectStore();

  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  // List page state
  const [tab, setTab] = useState<DocTab>('mine');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<Visibility | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('edited');

  // Active doc editing state
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [docIcon, setDocIcon] = useState('📄');
  const [docCover, setDocCover] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Modals
  const [showShareModal, setShowShareModal] = useState(false);
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [shareTarget, setShareTarget] = useState<ProjectDocument | null>(null);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (newDocSignal) setShowNewDoc(true);
  }, [newDocSignal]);

  // 1. Fetch the workspace's documents. Without a doc in the URL the list page is shown.
  useEffect(() => {
    let isMounted = true;

    if (currentDocument && currentDocument.workspaceId !== workspaceId) {
      setCurrentDocument(null);
    }

    const fetchDocuments = async () => {
      setIsLoadingDocs(true);
      try {
        const res = await api.get('/api/documents', { params: { workspaceId } });
        if (isMounted) {
          const docs: ProjectDocument[] = res.data;
          setDocuments(docs);
          const wantedId =
            initialDocId || (currentDocument?.workspaceId === workspaceId ? currentDocument.id : null);
          setCurrentDocument((wantedId && docs.find((d) => d.id === wantedId)) || null);
        }
      } catch (err) {
        console.error('Failed to load documents', err);
      } finally {
        if (isMounted) setIsLoadingDocs(false);
      }
    };

    fetchDocuments();
    return () => {
      isMounted = false;
    };
  }, [workspaceId]);

  // Keep the URL pointing at the open doc
  useEffect(() => {
    if (!isLoadingDocs) onDocChange?.(currentDocument?.id ?? null);
  }, [currentDocument?.id, isLoadingDocs]);

  // 2. Real-time Socket.IO Listeners for Documents
  useEffect(() => {
    const socket = getSocket();

    // ponytail: server broadcasts every doc to the whole workspace room, so private docs' metadata
    // reaches all members' sockets; filter here only for display. Emit per-user if that matters.
    const isVisible = (doc: ProjectDocument) =>
      doc.isPublicInProject ||
      doc.createdById === currentUser?.id ||
      !!doc.shares?.some((s) => s.userId === currentUser?.id);

    const onDocNew = (doc: ProjectDocument) => {
      if (doc.workspaceId === workspaceId && isVisible(doc)) addDocument(doc);
    };

    const onDocUpdate = (doc: ProjectDocument) => {
      if (doc.workspaceId !== workspaceId) return;
      if (isVisible(doc)) {
        if (useProjectStore.getState().documents.some((d) => d.id === doc.id)) updateDocument(doc);
        else addDocument(doc);
      } else {
        removeDocument(doc.id);
      }
    };

    const onDocDelete = (payload: { documentId: string }) => removeDocument(payload.documentId);

    socket.on(SOCKET_EVENTS.DOCUMENT_NEW, onDocNew);
    socket.on(SOCKET_EVENTS.DOCUMENT_UPDATE, onDocUpdate);
    socket.on(SOCKET_EVENTS.DOCUMENT_DELETE, onDocDelete);

    return () => {
      socket.off(SOCKET_EVENTS.DOCUMENT_NEW, onDocNew);
      socket.off(SOCKET_EVENTS.DOCUMENT_UPDATE, onDocUpdate);
      socket.off(SOCKET_EVENTS.DOCUMENT_DELETE, onDocDelete);
    };
  }, [workspaceId, currentUser?.id, addDocument, updateDocument, removeDocument]);

  // 3. Sync local editing state when currentDocument changes
  useEffect(() => {
    if (currentDocument) {
      setDocTitle(currentDocument.title || '');
      setDocContent(currentDocument.content || '');
      setDocIcon(currentDocument.icon || '📄');
      setDocCover(currentDocument.coverImage || null);
    } else {
      setDocTitle('');
      setDocContent('');
      setDocIcon('📄');
      setDocCover(null);
    }
  }, [currentDocument?.id]);

  // 4. Debounced Auto-Save function
  const triggerAutoSave = useCallback(
    (updates: Partial<ProjectDocument>) => {
      if (!currentDocument || currentDocument.workspaceId !== workspaceId) return;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      setIsSaving(true);
      saveTimerRef.current = setTimeout(async () => {
        try {
          const res = await api.patch(`/api/documents/${currentDocument.id}`, updates);
          updateDocument(res.data);
        } catch (err) {
          console.error('Failed to auto-save document', err);
        } finally {
          setIsSaving(false);
        }
      }, 700);
    },
    [currentDocument, workspaceId, updateDocument]
  );

  const handleContentChange = (newContent: string) => {
    setDocContent(newContent);
    triggerAutoSave({ content: newContent });
  };

  const handleTitleChange = (newTitle: string) => {
    setDocTitle(newTitle);
    if (newTitle.trim()) triggerAutoSave({ title: newTitle });
  };

  const handleIconSelect = (emoji: string) => {
    setDocIcon(emoji);
    triggerAutoSave({ icon: emoji });
  };

  const handleCoverSelect = (cover: string | null) => {
    setDocCover(cover);
    triggerAutoSave({ coverImage: cover });
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.delete(`/api/documents/${docId}`);
      removeDocument(docId);
      if (currentDocument?.id === docId) setCurrentDocument(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete document');
    }
  };

  const handleProjectLink = async (projectId: string | null) => {
    if (!currentDocument) return;
    try {
      const res = await api.patch(`/api/documents/${currentDocument.id}`, { projectId });
      updateDocument(res.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to link document');
    }
  };

  const linkedProject = (doc: ProjectDocument) =>
    doc.projectId ? projects.find((p) => p.id === doc.projectId) || null : null;

  const isMine = (doc: ProjectDocument) => doc.createdById === currentUser?.id;
  const sharedWithMe = (doc: ProjectDocument) =>
    !isMine(doc) && !!doc.shares?.some((s) => s.userId === currentUser?.id);

  const tabDocs: Record<DocTab, ProjectDocument[]> = useMemo(
    () => ({
      mine: documents.filter(isMine),
      public: documents.filter((d) => d.isPublicInProject),
      shared: documents.filter(sharedWithMe),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documents, currentUser?.id]
  );

  const listDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = tabDocs[tab].filter(
      (d) =>
        (visibilityFilter === 'all' || visibilityOf(d) === visibilityFilter) &&
        (!q || d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q))
    );
    return [...list].sort((a, b) =>
      sortKey === 'title'
        ? a.title.localeCompare(b.title)
        : sortKey === 'created'
          ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [tabDocs, tab, searchQuery, visibilityFilter, sortKey]);

  const ownerName = (doc: ProjectDocument) => {
    const name = doc.creator?.displayName || doc.creator?.username || 'Team member';
    return isMine(doc) ? `You (${name})` : name;
  };

  // ---------------- Editor ----------------
  if (currentDocument) {
    const visibility = visibilityOf(currentDocument);
    const project = linkedProject(currentDocument);
    const collaborators = [
      ...(currentDocument.creator
        ? [{ id: currentDocument.creator.id, name: currentDocument.creator.displayName, avatarUrl: currentDocument.creator.avatarUrl }]
        : []),
      ...(currentDocument.shares || [])
        .filter((s) => s.user)
        .map((s) => ({ id: s.userId, name: s.user!.displayName, avatarUrl: s.user!.avatarUrl })),
    ];

    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-surface)' }}>
        <div
          className="h-16 shrink-0 border-b px-3 sm:px-5 flex items-center gap-3"
          style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)' }}
        >
          <BackPill label="Docs" onClick={() => setCurrentDocument(null)} />
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <p className="text-[17px] font-bold leading-[22px] truncate" style={{ color: 'var(--theme-text)' }}>
                {docTitle || 'Untitled Document'}
              </p>
              <span className="hidden sm:inline-flex">
                <VisibilityPill visibility={visibility} icon={<VisibilityIcon v={visibility} />} />
              </span>
            </div>
            <SaveMeta saving={isSaving} savedLabel={`Saved ${relativeTime(currentDocument.updatedAt).toLowerCase()}`}>
              {project && (
                <>
                  <span>·</span>
                  <span className="font-medium truncate" style={{ color: 'var(--theme-primary-hover)' }}>
                    Linked to {project.name} board
                  </span>
                </>
              )}
            </SaveMeta>
          </div>
          <AvatarStack people={collaborators} />
          <span className="hidden md:block">
            <Popover
              width={240}
              trigger={(_, toggle) => (
                <OutlinePill onClick={toggle} icon={<Link2 size={14} />} title="Link to a project board">
                  {project ? project.name : 'Link to project'}
                </OutlinePill>
              )}
            >
              {(close) => (
                <>
                  <MenuItem
                    selected={!project}
                    onClick={() => {
                      close();
                      handleProjectLink(null);
                    }}
                  >
                    Not linked
                  </MenuItem>
                  {projects.map((p) => (
                    <MenuItem
                      key={p.id}
                      icon={<Board size={14} />}
                      selected={p.id === project?.id}
                      onClick={() => {
                        close();
                        handleProjectLink(p.id);
                      }}
                    >
                      {p.name}
                    </MenuItem>
                  ))}
                </>
              )}
            </Popover>
          </span>
          <SolidPill onClick={() => setShowShareModal(true)} icon={<Share2 size={14} />}>
            Share
          </SolidPill>
          <Popover
            width={244}
            trigger={(_, toggle) => <MoreButton size={36} onClick={toggle} />}
          >
            {(close) => (
              <>
                <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
                  Icon
                </p>
                <div className="px-1.5 pb-1.5 grid grid-cols-6 gap-0.5">
                  {EMOJI_PRESETS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        handleIconSelect(emoji);
                        close();
                      }}
                      className="h-8 rounded-lg text-lg transition hover:bg-[var(--theme-fill-hover)]"
                      style={emoji === docIcon ? { backgroundColor: 'var(--theme-selected)' } : undefined}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
                  Cover
                </p>
                <div className="px-1.5 pb-1.5 grid grid-cols-4 gap-1.5">
                  {COVER_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        handleCoverSelect(preset);
                        close();
                      }}
                      className="h-7 rounded-md transition hover:scale-105"
                      style={{ background: preset, outline: preset === docCover ? '2px solid var(--theme-primary)' : undefined }}
                    />
                  ))}
                </div>
                {docCover && (
                  <MenuItem
                    icon={<ImageIcon size={14} />}
                    onClick={() => {
                      handleCoverSelect(null);
                      close();
                    }}
                  >
                    Remove cover
                  </MenuItem>
                )}
                <div className="h-px my-1" style={{ backgroundColor: 'var(--theme-border)' }} />
                <MenuItem
                  danger
                  icon={<Trash2 size={14} />}
                  onClick={() => {
                    close();
                    handleDeleteDoc(currentDocument.id);
                  }}
                >
                  Delete document
                </MenuItem>
              </>
            )}
          </Popover>
        </div>

        <NotionEditor
          variant="page"
          value={docContent}
          onChange={handleContentChange}
          placeholder="Type '/' for blocks, headings, tables, pictures, checklists..."
          pageHeader={
            <div className="flex flex-col gap-3.5">
              {docCover && <div className="h-28 rounded-[10px]" style={{ background: docCover }} />}
              {docIcon !== '📄' && <span className="text-[34px] leading-none">{docIcon}</span>}
              <input
                type="text"
                value={docTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Untitled Document"
                aria-label="Document title"
                className="w-full text-[30px] leading-[38px] font-bold bg-transparent outline-none placeholder:text-[var(--theme-text-muted)] placeholder:opacity-60"
                style={{ color: 'var(--theme-text)' }}
              />
              <p className="text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
                Created by {currentDocument.creator?.displayName || 'Team member'} ·{' '}
                {editedLabel(currentDocument.updatedAt)}
                {project && ` · ${project.name} board`}
              </p>
              <div className="h-1.5" />
            </div>
          }
        />

        <ShareDocumentModal
          document={currentDocument}
          currentUser={currentUser}
          members={members}
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          onDocumentUpdated={(updated) => updateDocument(updated)}
        />
      </div>
    );
  }

  // ---------------- List ----------------
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-app)' }}>
      <div className="shrink-0 border-b" style={{ borderColor: 'var(--theme-border)' }}>
        <PageHeader
          icon={<FileText size={20} />}
          title="Docs"
          subtitle="Create documents, browse public drafts and docs shared with you"
          right={
            <>
              {onOpenSearch && <SearchOrbitButton onClick={onOpenSearch} />}
              {onOpenDocsSidebar && (
                <button
                  type="button"
                  onClick={onOpenDocsSidebar}
                  className="md:hidden h-8 px-2.5 rounded-lg text-[13px] font-medium transition hover:bg-[var(--theme-fill-hover)]"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  Menu
                </button>
              )}
            </>
          }
        />
        <TabsRow<DocTab>
          tabs={[
            { id: 'mine', label: 'My docs', count: tabDocs.mine.length },
            { id: 'public', label: 'Public drafts', count: tabDocs.public.length },
            { id: 'shared', label: 'Shared with me', count: tabDocs.shared.length },
          ]}
          active={tab}
          onChange={setTab}
          action={
            <SolidPill onClick={() => setShowNewDoc(true)} icon={<Plus size={14} />}>
              New document
            </SolidPill>
          }
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4 flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <SearchField value={searchQuery} onChange={setSearchQuery} placeholder="Search documents" />
          <Popover
            align="left"
            width={180}
            trigger={(_, toggle) => (
              <OutlinePill onClick={toggle} icon={<Filter size={14} />}>
                Visibility: {visibilityFilter === 'all' ? 'All' : visibilityFilter[0].toUpperCase() + visibilityFilter.slice(1)}
              </OutlinePill>
            )}
          >
            {(close) =>
              (['all', 'public', 'shared', 'draft'] as const).map((v) => (
                <MenuItem
                  key={v}
                  selected={v === visibilityFilter}
                  onClick={() => {
                    setVisibilityFilter(v);
                    close();
                  }}
                >
                  {v === 'all' ? 'All' : v[0].toUpperCase() + v.slice(1)}
                </MenuItem>
              ))
            }
          </Popover>
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

        <div className="overflow-x-auto">
          <div
            className="min-w-[760px] rounded-xl border overflow-hidden"
            style={{ borderColor: 'var(--theme-border)', boxShadow: '0 1px 2px rgba(20, 26, 46, 0.05)' }}
          >
            <div
              className="h-9 px-5 border-b flex items-center gap-3 text-xs font-semibold tracking-[0.3px]"
              style={{
                backgroundColor: 'var(--theme-selected)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-muted)',
              }}
            >
              <span className="w-10 shrink-0" />
              <span className="flex-1">Title</span>
              <span className="w-[190px] shrink-0">Owner</span>
              <span className="w-[120px] shrink-0">Visibility</span>
              <span className="w-[140px] shrink-0">Last edited</span>
              <span className="w-8 shrink-0" />
            </div>

            {isLoadingDocs ? (
              <p className="h-[68px] px-5 flex items-center text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
                Loading documents…
              </p>
            ) : listDocs.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-3 text-center">
                <p className="text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
                  {searchQuery || visibilityFilter !== 'all'
                    ? 'No documents match these filters.'
                    : tab === 'shared'
                      ? 'Nothing has been shared with you yet.'
                      : 'No documents here yet.'}
                </p>
                {tab === 'mine' && !searchQuery && (
                  <SolidPill onClick={() => setShowNewDoc(true)} icon={<Plus size={14} />}>
                    New document
                  </SolidPill>
                )}
              </div>
            ) : (
              listDocs.map((doc, i) => {
                const v = visibilityOf(doc);
                const project = linkedProject(doc);
                const canDelete = isMine(doc) || currentUser?.systemRole === 'SUPER_ADMIN';
                return (
                  <div
                    key={doc.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setCurrentDocument(doc)}
                    onKeyDown={(e) => e.key === 'Enter' && setCurrentDocument(doc)}
                    className={`h-[68px] px-5 flex items-center gap-3 cursor-pointer transition-colors hover:bg-[var(--theme-fill-hover)] ${
                      i < listDocs.length - 1 ? 'border-b' : ''
                    }`}
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    <span
                      className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
                      style={{ backgroundColor: 'var(--theme-bg-surface)', color: 'var(--theme-accent)' }}
                    >
                      {doc.icon && doc.icon !== '📄' ? <span className="text-lg">{doc.icon}</span> : <FileText size={20} />}
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-sm font-semibold leading-5 truncate" style={{ color: 'var(--theme-text)' }}>
                        {doc.title || 'Untitled Document'}
                      </span>
                      <span className="text-xs leading-4 truncate" style={{ color: 'var(--theme-text-muted)' }}>
                        {project ? `Linked to ${project.name} board` : 'Not linked'}
                      </span>
                    </span>
                    <span className="w-[190px] shrink-0 flex items-center gap-2 min-w-0">
                      <Avatar
                        name={doc.creator?.displayName || doc.creator?.username || '?'}
                        src={doc.creator?.avatarUrl}
                        size={26}
                      />
                      <span className="text-[13px] truncate" style={{ color: 'var(--theme-text)' }}>
                        {ownerName(doc)}
                      </span>
                    </span>
                    <span className="w-[120px] shrink-0">
                      <VisibilityPill visibility={v} icon={<VisibilityIcon v={v} />} />
                    </span>
                    <span className="w-[140px] shrink-0 text-[13px] truncate" style={{ color: 'var(--theme-text-muted)' }}>
                      {editedLabel(doc.updatedAt)}
                    </span>
                    <span onClick={(e) => e.stopPropagation()}>
                      <Popover width={180} trigger={(_, toggle) => <MoreButton onClick={toggle} />}>
                        {(close) => (
                          <>
                            <MenuItem
                              icon={<FileText size={14} />}
                              onClick={() => {
                                close();
                                setCurrentDocument(doc);
                              }}
                            >
                              Open
                            </MenuItem>
                            <MenuItem
                              icon={<Share2 size={14} />}
                              onClick={() => {
                                close();
                                setShareTarget(doc);
                              }}
                            >
                              Share
                            </MenuItem>
                            {canDelete && (
                              <MenuItem
                                danger
                                icon={<Trash2 size={14} />}
                                onClick={() => {
                                  close();
                                  handleDeleteDoc(doc.id);
                                }}
                              >
                                Delete
                              </MenuItem>
                            )}
                          </>
                        )}
                      </Popover>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {showNewDoc && (
        <NewDocumentModal
          workspaceId={workspaceId}
          projects={projects}
          onClose={() => setShowNewDoc(false)}
          onCreated={(doc, { openShare }) => {
            setShowNewDoc(false);
            addDocument(doc);
            setCurrentDocument(doc);
            if (openShare) setShowShareModal(true);
          }}
        />
      )}

      {shareTarget && (
        <ShareDocumentModal
          document={documents.find((d) => d.id === shareTarget.id) || shareTarget}
          currentUser={currentUser}
          members={members}
          isOpen
          onClose={() => setShareTarget(null)}
          onDocumentUpdated={(updated) => updateDocument(updated)}
        />
      )}
    </div>
  );
};
