'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Project,
  ProjectDocument,
  UserProfile,
  WorkspaceMember,
  SOCKET_EVENTS,
} from '@orbit/types';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useProjectStore } from '../../stores/projectStore';
import { NotionEditor } from './NotionEditor';
import { ShareDocumentModal } from './ShareDocumentModal';
import {
  Plus,
  Search,
  FileText,
  Globe,
  Lock,
  Share2,
  Trash2,
  MoreVertical,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Image as ImageIcon,
  Smile,
  Users,
  Copy,
  Clock,
  ExternalLink,
  X,
} from 'lucide-react';

interface ProjectDocsViewProps {
  project: Project;
  currentUser: UserProfile | null;
  members: WorkspaceMember[];
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

export const ProjectDocsView: React.FC<ProjectDocsViewProps> = ({
  project,
  currentUser,
  members,
}) => {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'project' | 'shared' | 'private'>('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Active doc editing state
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [docIcon, setDocIcon] = useState('📄');
  const [docCover, setDocCover] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Modals & Popovers
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [menuDocId, setMenuDocId] = useState<string | null>(null);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch documents on project change
  useEffect(() => {
    let isMounted = true;

    // Immediately clear stale document from previous project
    if (currentDocument && currentDocument.projectId !== project.id) {
      setCurrentDocument(null);
    }

    const fetchDocuments = async () => {
      setIsLoadingDocs(true);
      try {
        const res = await api.get(`/api/projects/${project.id}/documents`);
        if (isMounted) {
          const docs: ProjectDocument[] = res.data;
          setDocuments(docs);
          if (docs.length > 0) {
            const matchingDoc = docs.find((d) => d.id === currentDocument?.id && d.projectId === project.id);
            setCurrentDocument(matchingDoc || docs[0]);
          } else {
            setCurrentDocument(null);
          }
        }
      } catch (err) {
        console.error('Failed to load project documents', err);
      } finally {
        if (isMounted) setIsLoadingDocs(false);
      }
    };

    fetchDocuments();
    return () => {
      isMounted = false;
    };
  }, [project.id]);

  // 2. Real-time Socket.IO Listeners for Documents
  useEffect(() => {
    const socket = getSocket();

    const onDocNew = (doc: ProjectDocument) => {
      if (doc.projectId === project.id) {
        addDocument(doc);
      }
    };

    const onDocUpdate = (doc: ProjectDocument) => {
      if (doc.projectId === project.id) {
        updateDocument(doc);
      }
    };

    const onDocDelete = (payload: { documentId: string; projectId: string }) => {
      if (payload.projectId === project.id) {
        removeDocument(payload.documentId);
      }
    };

    socket.on(SOCKET_EVENTS.DOCUMENT_NEW, onDocNew);
    socket.on(SOCKET_EVENTS.DOCUMENT_UPDATE, onDocUpdate);
    socket.on(SOCKET_EVENTS.DOCUMENT_DELETE, onDocDelete);

    return () => {
      socket.off(SOCKET_EVENTS.DOCUMENT_NEW, onDocNew);
      socket.off(SOCKET_EVENTS.DOCUMENT_UPDATE, onDocUpdate);
      socket.off(SOCKET_EVENTS.DOCUMENT_DELETE, onDocDelete);
    };
  }, [project.id, addDocument, updateDocument, removeDocument]);

  // 3. Sync local editing state when currentDocument changes
  useEffect(() => {
    if (currentDocument) {
      setDocTitle(currentDocument.title || '');
      setDocContent(currentDocument.content || '');
      setDocIcon(currentDocument.icon || '📄');
      setDocCover(currentDocument.coverImage || null);
      setLastSavedAt(new Date(currentDocument.updatedAt));
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
      if (!currentDocument || currentDocument.projectId !== project.id) return;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      setIsSaving(true);
      saveTimerRef.current = setTimeout(async () => {
        try {
          const res = await api.patch(
            `/api/projects/${project.id}/documents/${currentDocument.id}`,
            updates
          );
          updateDocument(res.data);
          setLastSavedAt(new Date());
        } catch (err) {
          console.error('Failed to auto-save document', err);
        } finally {
          setIsSaving(false);
        }
      }, 700);
    },
    [currentDocument, project.id, updateDocument]
  );

  // Content change handler
  const handleContentChange = (newContent: string) => {
    setDocContent(newContent);
    triggerAutoSave({ content: newContent });
  };

  // Title change handler
  const handleTitleChange = (newTitle: string) => {
    setDocTitle(newTitle);
    triggerAutoSave({ title: newTitle });
  };

  // Icon change handler
  const handleIconSelect = (emoji: string) => {
    setDocIcon(emoji);
    setShowEmojiPicker(false);
    triggerAutoSave({ icon: emoji });
  };

  // Cover change handler
  const handleCoverSelect = (cover: string | null) => {
    setDocCover(cover);
    setShowCoverPicker(false);
    triggerAutoSave({ coverImage: cover });
  };

  // Create New Document
  const handleCreateNewDoc = async () => {
    try {
      const res = await api.post(`/api/projects/${project.id}/documents`, {
        title: 'Untitled Document',
        content: '',
        icon: '📄',
        isPublicInProject: false, // Default private to creator until shared
      });
      addDocument(res.data);
      setCurrentDocument(res.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create document');
    }
  };

  // Delete Document
  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.delete(`/api/projects/${project.id}/documents/${docId}`);
      removeDocument(docId);
      if (currentDocument?.id === docId) {
        const remaining = documents.filter((d) => d.id !== docId);
        setCurrentDocument(remaining[0] || null);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete document');
    }
  };

  // Filtered documents list
  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === 'project') return doc.isPublicInProject;
    if (activeFilter === 'shared') return !doc.isPublicInProject && doc.createdById !== currentUser?.id;
    if (activeFilter === 'private') return !doc.isPublicInProject && doc.createdById === currentUser?.id;

    return true;
  });

  return (
    <div
      className="flex-1 flex h-full overflow-hidden select-none"
      style={{
        backgroundColor: 'var(--theme-bg-app)',
        color: 'var(--theme-text-primary)',
      }}
    >
      {/* Mobile Drawer Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden animate-in fade-in duration-200"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ========================================== */}
      {/* 1. Left Document Navigation Sidebar        */}
      {/* ========================================== */}
      <div
        className={`${
          isSidebarOpen
            ? 'w-72 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:shadow-2xl'
            : 'w-0 max-md:-translate-x-full'
        } shrink-0 border-r flex flex-col h-full transition-all duration-200 overflow-hidden relative`}
        style={{
          backgroundColor: 'var(--theme-bg-surface)',
          borderColor: 'var(--theme-border)',
        }}
      >
        {/* Sidebar Header & New Doc */}
        <div
          className="p-3.5 border-b flex items-center justify-between gap-2 shrink-0"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-2">
            <FileText size={16} style={{ color: 'var(--theme-primary)' }} />
            <span className="text-xs font-bold uppercase tracking-wider">Documents</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
              style={{
                backgroundColor: 'var(--theme-bg-surface-hover)',
                color: 'var(--theme-text-muted)',
              }}
            >
              {documents.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCreateNewDoc}
              className="p-1.5 rounded-lg text-xs font-semibold shadow transition flex items-center gap-1 active:scale-95"
              style={{
                backgroundColor: 'var(--theme-primary)',
                color: 'var(--theme-primary-text)',
              }}
              title="Create new document"
            >
              <Plus size={14} />
              <span className="text-[11px]">New Document</span>
            </button>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 md:hidden transition"
              title="Close sidebar"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="p-3 shrink-0">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50"
              style={{ color: 'var(--theme-text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border bg-transparent focus:outline-none transition"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-app)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-3 pb-2 flex items-center gap-1 overflow-x-auto shrink-0 select-none">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'project', label: 'Project' },
              { id: 'shared', label: 'Shared' },
              { id: 'private', label: 'Drafts' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition ${
                activeFilter === tab.id
                  ? 'shadow-sm'
                  : 'opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              style={{
                backgroundColor:
                  activeFilter === tab.id
                    ? 'var(--theme-bg-surface-hover)'
                    : 'transparent',
                color:
                  activeFilter === tab.id
                    ? 'var(--theme-text-primary)'
                    : 'var(--theme-text-muted)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Documents List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {isLoadingDocs ? (
            <div className="p-4 text-center text-xs opacity-50">Loading docs...</div>
          ) : filteredDocs.length === 0 ? (
            <div className="p-6 text-center text-xs opacity-50">
              {searchQuery ? 'No documents found' : 'No documents yet'}
            </div>
          ) : (
            filteredDocs.map((doc) => {
              const isSelected = currentDocument?.id === doc.id;
              const isCreator = doc.createdById === currentUser?.id;

              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    setCurrentDocument(doc);
                    if (typeof window !== 'undefined' && window.innerWidth < 768) {
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={`group px-2.5 py-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition relative ${
                    isSelected ? 'shadow-sm font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: isSelected
                      ? 'var(--theme-bg-surface-hover)'
                      : 'transparent',
                    color: 'var(--theme-text-primary)',
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 truncate">
                    <span className="text-base shrink-0">{doc.icon || '📄'}</span>
                    <div className="min-w-0 truncate">
                      <div className="truncate text-xs">
                        {doc.title || 'Untitled Document'}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] opacity-60">
                        {doc.isPublicInProject ? (
                          <span className="flex items-center gap-0.5 text-emerald-400">
                            <Globe size={10} /> Public
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-amber-400">
                            <Lock size={10} /> Private
                          </span>
                        )}
                        <span>•</span>
                        <span>{doc.creator?.displayName?.split(' ')[0] || 'Member'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions button */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentDocument(doc);
                        setShowShareModal(true);
                      }}
                      title="Share document"
                      className="p-1 rounded opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
                    >
                      <Share2 size={12} />
                    </button>
                    {(isCreator || currentUser?.systemRole === 'SUPER_ADMIN') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDoc(doc.id);
                        }}
                        title="Delete document"
                        className="p-1 rounded text-red-400 opacity-70 hover:opacity-100 hover:bg-red-500/10"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* 2. Main Document Canvas & Notion Editor    */}
      {/* ========================================== */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setIsSidebarOpen((prev) => !prev)}
          title={isSidebarOpen ? 'Collapse Documents Sidebar' : 'Expand Documents Sidebar'}
          className="absolute left-2.5 top-2.5 z-20 px-2 py-1.5 rounded-xl border shadow-sm opacity-80 hover:opacity-100 transition flex items-center gap-1 text-xs backdrop-blur-md"
          style={{
            backgroundColor: 'var(--theme-bg-surface)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-primary)',
          }}
        >
          {isSidebarOpen ? <ChevronLeft size={14} /> : <FileText size={14} />}
          <span className="text-[11px] font-semibold hidden sm:inline">{isSidebarOpen ? 'Hide' : 'Documents'}</span>
        </button>

        {currentDocument ? (
          <div className="flex-1 flex flex-col h-full overflow-y-auto">
            {/* Notion Cover Image Banner */}
            <div className="relative group">
              {docCover ? (
                <div
                  className="w-full h-36 md:h-44 transition-all"
                  style={{
                    background: docCover,
                  }}
                />
              ) : (
                <div
                  className="w-full h-12 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-end px-6"
                  style={{ backgroundColor: 'var(--theme-bg-surface)' }}
                />
              )}

              {/* Cover Controls (Appear on hover) */}
              <div className="absolute right-4 bottom-3 opacity-0 group-hover:opacity-100 transition flex items-center gap-1.5 z-10">
                <button
                  onClick={() => setShowCoverPicker(true)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur-md bg-black/50 text-white hover:bg-black/70 transition flex items-center gap-1"
                >
                  <ImageIcon size={12} />
                  <span>{docCover ? 'Change Cover' : 'Add Cover'}</span>
                </button>
                {docCover && (
                  <button
                    onClick={() => handleCoverSelect(null)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur-md bg-black/50 text-white hover:bg-black/70 transition"
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Cover Picker Dropdown */}
              {showCoverPicker && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowCoverPicker(false)}
                  />
                  <div
                    className="absolute right-4 top-full mt-2 z-50 w-72 rounded-xl border p-3 shadow-2xl backdrop-blur-md"
                    style={{
                      backgroundColor: 'var(--theme-bg-surface)',
                      borderColor: 'var(--theme-border)',
                    }}
                  >
                    <div
                      className="text-[10px] font-bold uppercase tracking-wider mb-2 opacity-60"
                      style={{ color: 'var(--theme-text-muted)' }}
                    >
                      Choose Cover Gradient
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {COVER_PRESETS.map((preset, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleCoverSelect(preset)}
                          className="h-10 rounded-lg cursor-pointer hover:scale-105 transition shadow-sm"
                          style={{ background: preset }}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Notion Document Header */}
            <div className="px-6 md:px-12 pt-4 pb-2 max-w-4xl w-full mx-auto space-y-4">
              {/* Document Meta & Actions Bar */}
              <div className="flex items-center justify-between gap-4">
                {/* Save status & author */}
                <div className="flex items-center gap-2 text-xs opacity-60">
                  <div className="flex items-center gap-1">
                    {isSaving ? (
                      <span className="flex items-center gap-1 text-amber-400">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        Saving...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Check size={13} /> Saved
                      </span>
                    )}
                  </div>
                  <span>•</span>
                  <span>
                    Created by {currentDocument.creator?.displayName || 'Team Member'}
                  </span>
                </div>

                {/* Right Action buttons: Share & Options */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 shadow-sm active:scale-95"
                    style={{
                      borderColor: 'var(--theme-border)',
                      backgroundColor: 'var(--theme-bg-surface)',
                      color: 'var(--theme-text-primary)',
                    }}
                  >
                    {currentDocument.isPublicInProject ? (
                      <Globe size={13} className="text-emerald-400" />
                    ) : (
                      <Lock size={13} className="text-amber-400" />
                    )}
                    <span>Share</span>
                    {currentDocument.shares && currentDocument.shares.length > 0 && (
                      <span
                        className="text-[10px] px-1.5 py-0.2 rounded-full font-bold"
                        style={{
                          backgroundColor: 'var(--theme-bg-surface-hover)',
                          color: 'var(--theme-primary)',
                        }}
                      >
                        +{currentDocument.shares.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleDeleteDoc(currentDocument.id)}
                    title="Delete document"
                    className="p-1.5 rounded-xl border opacity-60 hover:opacity-100 hover:text-red-400 hover:border-red-500/30 transition"
                    style={{
                      borderColor: 'var(--theme-border)',
                      backgroundColor: 'var(--theme-bg-surface)',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Document Icon & Title (Notion Style) */}
              <div className="relative">
                {/* Clickable Notion Emoji Icon */}
                <div className="relative inline-block">
                  <button
                    onClick={() => setShowEmojiPicker((prev) => !prev)}
                    title="Change document icon"
                    className="text-4xl hover:scale-110 active:scale-95 transition transform -ml-1 p-1 rounded-xl hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    {docIcon}
                  </button>

                  {/* Quick Emoji Picker Popover */}
                  {showEmojiPicker && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowEmojiPicker(false)}
                      />
                      <div
                        className="absolute left-0 top-full mt-2 z-50 rounded-xl border p-2 shadow-2xl backdrop-blur-md flex items-center gap-1"
                        style={{
                          backgroundColor: 'var(--theme-bg-surface)',
                          borderColor: 'var(--theme-border)',
                        }}
                      >
                        {EMOJI_PRESETS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleIconSelect(emoji)}
                            className="text-lg p-1.5 rounded-lg hover:scale-125 transition"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Notion Title Input */}
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Untitled Document"
                  className="w-full text-2xl md:text-3xl font-extrabold tracking-tight bg-transparent focus:outline-none placeholder:opacity-30 mt-2"
                  style={{
                    color: 'var(--theme-text-primary)',
                  }}
                />
              </div>
            </div>

            {/* Rich Document Editor */}
            <div className="flex-1 max-w-4xl w-full mx-auto flex flex-col px-4 md:px-8 pb-12">
              <NotionEditor
                value={docContent}
                onChange={handleContentChange}
                placeholder="Type '/' for blocks, headings, tables, pictures, checklists..."
              />
            </div>
          </div>
        ) : (
          /* Empty State when no document selected */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center border shadow-lg"
              style={{
                backgroundColor: 'var(--theme-bg-surface)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-primary)',
              }}
            >
              <FileText size={32} />
            </div>

            <div className="max-w-sm space-y-1">
              <h3 className="text-base font-bold">No Document Selected</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>
                Create rich project documentation, specs, guides, and meeting notes.
              </p>
            </div>

            <button
              onClick={handleCreateNewDoc}
              className="px-4 py-2 rounded-xl text-xs font-semibold shadow transition flex items-center gap-2 active:scale-95"
              style={{
                backgroundColor: 'var(--theme-primary)',
                color: 'var(--theme-primary-text)',
              }}
            >
              <Plus size={15} />
              <span>Create First Document</span>
            </button>
          </div>
        )}
      </div>

      {/* Share Document Modal */}
      {currentDocument && (
        <ShareDocumentModal
          document={currentDocument}
          currentUser={currentUser}
          members={members}
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          onDocumentUpdated={(updated) => updateDocument(updated)}
        />
      )}
    </div>
  );
};
