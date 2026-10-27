'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '../../lib/api';
import {
  Folder,
  FolderPlus,
  UploadCloud,
  FileVideo,
  FileImage,
  File,
  ChevronRight,
  ExternalLink,
  Copy,
  Trash2,
  Edit2,
  Lock,
  Unlock,
  RefreshCw,
  Search,
  ArrowLeft,
  X,
  Play,
  CheckCircle,
  AlertCircle,
  HardDrive,
  Clock,
  Layers,
  ChevronDown,
  Info,
  Database,
  FolderOpen,
  Home,
  Check,
} from 'lucide-react';

interface MediaManagerProps {
  workspace: any;
  currentUser: any;
  initialProjectId?: string;
  onBackToOrganizationControl?: () => void;
  onOpenProjectBoard?: (project: any) => void;
}

interface ProjectOption {
  id: string;
  name: string;
  description?: string;
  status?: string;
}

interface DriveFolder {
  id: string;
  name: string;
  webViewLink: string | null;
}

interface DriveFileItem {
  id: string;
  name: string;
  originalFileName: string;
  fileNamePrefix: string;
  description: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
  thumbnailLink: string | null;
  webViewLink: string | null;
  shareAccess: 'linkReady' | 'restricted';
}

interface UploadQueueItem {
  id: string;
  file: File;
  originalFileName: string;
  fileNamePrefix: string;
  description: string;
  progress: number;
  speed: string;
  eta: string;
  status: 'idle' | 'uploading' | 'complete' | 'error';
  error?: string;
}

const DRIVE_CHUNK_SIZE = 16 * 1024 * 1024; // 16MB chunks

function formatBytes(bytes: number | string): string {
  const num = Number(bytes || 0);
  if (num === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return parseFloat((num / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export const MediaManagementView: React.FC<MediaManagerProps> = ({
  workspace,
  currentUser,
  initialProjectId,
  onBackToOrganizationControl,
  onOpenProjectBoard,
}) => {
  // Connection state
  const [isDriveConnected, setIsDriveConnected] = useState<boolean | null>(null);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [checkingConnection, setCheckingConnection] = useState<boolean>(true);

  // Projects state
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  const [projectStats, setProjectStats] = useState<{
    fileCount: number;
    videoCount: number;
    imageCount: number;
    folderCount: number;
    totalSize: string;
  } | null>(null);

  // Folder navigation state
  const [projectRootFolder, setProjectRootFolder] = useState<DriveFolder | null>(null);
  const [folderStack, setFolderStack] = useState<DriveFolder[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [folderLoading, setFolderLoading] = useState<boolean>(false);
  const [fileLoading, setFileLoading] = useState<boolean>(false);

  // Modals & Forms
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [creatingFolder, setCreatingFolder] = useState<boolean>(false);
  const [renamingFolder, setRenamingFolder] = useState<DriveFolder | null>(null);
  const [renameFolderName, setRenameFolderName] = useState<string>('');
  const [renamingFile, setRenamingFile] = useState<DriveFileItem | null>(null);
  const [renameFileName, setRenameFileName] = useState<string>('');
  const [previewMediaFile, setPreviewMediaFile] = useState<DriveFileItem | null>(null);

  // Upload queue state
  const [fileList, setFileList] = useState<UploadQueueItem[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentFolder = folderStack[folderStack.length - 1] || projectRootFolder || null;
  const currentFolderId = currentFolder?.id || '';

  const activeProject = useMemo(() => projects.find((p) => p.id === selectedProjectId), [projects, selectedProjectId]);

  // Steps status calculation
  const workflowStep = useMemo(() => {
    if (!isDriveConnected) return 1;
    if (!selectedProjectId) return 2;
    if (!currentFolder) return 3;
    if (fileList.length > 0) return 4;
    return 3;
  }, [isDriveConnected, selectedProjectId, currentFolder, fileList.length]);

  // 1. Check Google Drive connection status
  const checkDriveStatus = useCallback(async () => {
    try {
      setCheckingConnection(true);
      const res = await api.get('/api/google/status');
      setIsDriveConnected(Boolean(res.data.connected));
      setConnectedEmail(res.data.email || null);
    } catch {
      setIsDriveConnected(false);
      setConnectedEmail(null);
    } finally {
      setCheckingConnection(false);
    }
  }, []);

  useEffect(() => {
    checkDriveStatus();
  }, [checkDriveStatus]);

  // 2. Fetch Projects for Workspace
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await api.get(`/api/projects/workspaces/${workspace.id}/projects`);
        const list = Array.isArray(res.data) ? res.data : (res.data?.projects || []);
        setProjects(list);
        if (!selectedProjectId && list.length > 0) {
          setSelectedProjectId(list[0].id);
        }
      } catch (err) {
        console.error('Failed to load projects for media:', err);
      }
    };
    if (workspace?.id) {
      fetchProjects();
    }
  }, [workspace?.id]);

  // 3. Load Folder hierarchy & Files when selected project changes
  const loadFolders = useCallback(
    async (targetParentId?: string, nextStack?: DriveFolder[]) => {
      if (!selectedProjectId || !isDriveConnected) return;
      try {
        setFolderLoading(true);
        const projectTitle = activeProject?.name || 'Project';

        const url = targetParentId
          ? `/api/drive/folders?projectId=${selectedProjectId}&projectTitle=${encodeURIComponent(
              projectTitle
            )}&parentId=${targetParentId}`
          : `/api/drive/folders?projectId=${selectedProjectId}&projectTitle=${encodeURIComponent(
              projectTitle
            )}`;

        const res = await api.get(url);
        setProjectRootFolder(res.data.projectRoot);
        setFolders(res.data.folders || []);
        if (nextStack !== undefined) {
          setFolderStack(nextStack);
        }

        // Stats
        api
          .get(`/api/drive/project-stats?projectId=${selectedProjectId}`)
          .then((s) => setProjectStats(s.data))
          .catch(() => {});
      } catch (err) {
        console.error('Failed to load folders:', err);
      } finally {
        setFolderLoading(false);
      }
    },
    [selectedProjectId, isDriveConnected, activeProject?.name]
  );

  const loadFiles = useCallback(
    async (folderId: string) => {
      if (!folderId || !isDriveConnected) return;
      try {
        setFileLoading(true);
        const res = await api.get(`/api/drive/files?folderId=${folderId}`);
        setDriveFiles(res.data.files || []);
      } catch (err) {
        console.error('Failed to load files:', err);
      } finally {
        setFileLoading(false);
      }
    },
    [isDriveConnected]
  );

  useEffect(() => {
    if (selectedProjectId && isDriveConnected) {
      setFolderStack([]);
      setDriveFiles([]);
      loadFolders();
    }
  }, [selectedProjectId, isDriveConnected, loadFolders]);

  const handleOpenFolder = (folder: DriveFolder) => {
    const next = [...folderStack, folder];
    setFolderStack(next);
    loadFolders(folder.id, next);
    loadFiles(folder.id);
  };

  const handleOpenBreadcrumb = (index: number) => {
    if (index < 0) {
      setFolderStack([]);
      loadFolders();
      if (projectRootFolder) loadFiles(projectRootFolder.id);
    } else {
      const next = folderStack.slice(0, index + 1);
      setFolderStack(next);
      const target = next[next.length - 1];
      loadFolders(target.id, next);
      loadFiles(target.id);
    }
  };

  // Create Subfolder
  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name || !selectedProjectId) return;
    try {
      setCreatingFolder(true);
      await api.post('/api/drive/folders', {
        projectId: selectedProjectId,
        parentId: currentFolderId || projectRootFolder?.id,
        name,
      });
      setNewFolderName('');
      loadFolders(currentFolderId || projectRootFolder?.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  // Rename Folder
  const handleRenameFolder = async () => {
    if (!renamingFolder || !renameFolderName.trim()) return;
    try {
      await api.patch('/api/drive/folders', {
        folderId: renamingFolder.id,
        name: renameFolderName.trim(),
      });
      setRenamingFolder(null);
      loadFolders(currentFolderId);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to rename folder');
    }
  };

  // Delete Folder
  const handleDeleteFolder = async (folder: DriveFolder) => {
    if (!confirm(`Delete folder "${folder.name}" and all media inside it?`)) return;
    try {
      await api.delete(`/api/drive/folders?folderId=${folder.id}`);
      loadFolders(currentFolderId);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete folder');
    }
  };

  // File Upload Handlers
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    const newItems: UploadQueueItem[] = selected.map((f, i) => ({
      id: `${Date.now()}_${i}_${f.name}`,
      file: f,
      originalFileName: f.name,
      fileNamePrefix: 'DRAFT',
      description: 'Project media file',
      progress: 0,
      speed: '0 KB/s',
      eta: 'Waiting',
      status: 'idle',
    }));

    setFileList((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length === 0) return;

    const newItems: UploadQueueItem[] = droppedFiles.map((f, i) => ({
      id: `${Date.now()}_${i}_${f.name}`,
      file: f,
      originalFileName: f.name,
      fileNamePrefix: 'DRAFT',
      description: 'Project media file',
      progress: 0,
      speed: '0 KB/s',
      eta: 'Waiting',
      status: 'idle',
    }));

    setFileList((prev) => [...prev, ...newItems]);
  };

  const uploadSingleFileChunked = async (item: UploadQueueItem): Promise<void> => {
    const projectTitle = activeProject?.name || 'Project';
    const folderId = currentFolderId || projectRootFolder?.id;

    // 1. Get Resumable Session URL
    const sessionRes = await api.post('/api/upload/session', {
      fileName: item.originalFileName,
      fileNamePrefix: item.fileNamePrefix,
      description: item.description,
      mimeType: item.file.type || 'application/octet-stream',
      size: item.file.size,
      folderId,
      projectId: selectedProjectId,
      projectTitle,
    });

    const sessionUrl = sessionRes.data.sessionUrl;
    const targetFolderId = sessionRes.data.folderId || folderId;
    const total = item.file.size;
    let start = 0;
    const startTime = Date.now();

    // 2. Loop upload chunks of 16MB
    while (start < total) {
      const end = Math.min(start + DRIVE_CHUNK_SIZE, total);
      const chunk = item.file.slice(start, end);

      const chunkPromise = new Promise<{ status: number; responseText: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', sessionUrl, true);
        xhr.setRequestHeader('Content-Range', `bytes ${start}-${end - 1}/${total}`);

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const sent = start + evt.loaded;
            const pct = Math.round((sent / total) * 100);
            const elapsed = (Date.now() - startTime) / 1000;
            const bytesPerSec = elapsed > 0 ? sent / elapsed : 0;
            const remaining = Math.max(0, total - sent);
            const etaSec = bytesPerSec > 0 ? remaining / bytesPerSec : 0;

            setFileList((list) =>
              list.map((it) =>
                it.id === item.id
                  ? {
                      ...it,
                      progress: pct,
                      speed: `${formatBytes(bytesPerSec)}/s`,
                      eta: formatDuration(etaSec),
                    }
                  : it
              )
            );
          }
        };

        xhr.onload = () => resolve({ status: xhr.status, responseText: xhr.responseText });
        xhr.onerror = () => reject(new Error('Network error during Google Drive upload'));
        xhr.send(chunk);
      });

      const chunkRes = await chunkPromise;

      if (chunkRes.status === 200 || chunkRes.status === 201) {
        let uploadedFileId = '';
        try {
          const body = JSON.parse(chunkRes.responseText);
          uploadedFileId = body.id;
        } catch {}

        if (uploadedFileId) {
          await api.post('/api/upload/complete', {
            fileId: uploadedFileId,
            folderId: targetFolderId,
            projectId: selectedProjectId,
            projectTitle,
            originalFileName: item.originalFileName,
            fileNamePrefix: item.fileNamePrefix,
            description: item.description,
          });
        }
        break;
      } else if (chunkRes.status === 308) {
        start = end;
      } else {
        throw new Error(`Google Drive upload failed with status ${chunkRes.status}`);
      }
    }
  };

  const handleStartUpload = async () => {
    if (isUploading || fileList.length === 0) return;
    setIsUploading(true);
    setUploadError(null);

    for (const item of fileList) {
      if (item.status === 'complete') continue;
      try {
        setFileList((q) => q.map((x) => (x.id === item.id ? { ...x, status: 'uploading' } : x)));
        await uploadSingleFileChunked(item);
        setFileList((q) => q.map((x) => (x.id === item.id ? { ...x, status: 'complete', progress: 100 } : x)));
      } catch (err: any) {
        setUploadError(err.message || 'Upload failed');
        setFileList((q) =>
          q.map((x) => (x.id === item.id ? { ...x, status: 'error', error: err.message || 'Failed' } : x))
        );
      }
    }

    setIsUploading(false);
    if (currentFolderId) {
      loadFiles(currentFolderId);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Drive?')) return;
    try {
      await api.delete('/api/google/disconnect');
      setIsDriveConnected(false);
      setFolders([]);
      setDriveFiles([]);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to disconnect');
    }
  };

  return (
    <div
      className="flex-1 flex flex-col h-full w-full overflow-y-auto"
      style={{
        backgroundColor: 'var(--theme-bg-app)',
        color: 'var(--theme-text-primary)',
      }}
    >
      {/* 1. Header Section */}
      <div
        className="px-6 py-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0"
        style={{
          backgroundColor: 'var(--theme-bg-surface)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div>
          {onBackToOrganizationControl && (
            <button
              onClick={onBackToOrganizationControl}
              className="text-xs font-semibold hover:underline flex items-center gap-1.5 mb-2 transition"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              <ArrowLeft size={14} />
              <span>Back to Organization Control</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border"
              style={{
                backgroundColor: 'rgba(0, 145, 255, 0.1)',
                borderColor: 'rgba(0, 145, 255, 0.25)',
                color: '#60A5FA',
              }}
            >
              Google Drive Workspace
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1 text-white">Media Upload</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
            Organize project folders, prepare upload metadata, and manage Drive media from one focused workspace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start sm:self-center">
          {checkingConnection ? (
            <span
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-xl border"
              style={{
                backgroundColor: 'var(--theme-bg-app)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-muted)',
              }}
            >
              <RefreshCw size={12} className="animate-spin" />
              Checking Drive...
            </span>
          ) : isDriveConnected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Connected:</span>
              <span className="text-white font-normal underline">{connectedEmail || 'affansidd1030@gmail.com'}</span>
            </div>
          ) : (
            <a
              href="/api/google/auth"
              title="Connect to affansidd1030@gmail.com"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1.5 transition hover:opacity-90"
              style={{ backgroundColor: 'var(--theme-primary)' }}
            >
              <HardDrive size={14} />
              <span>Connect Drive (affansidd1030@gmail.com)</span>
            </a>
          )}
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="max-w-7xl mx-auto w-full p-6 space-y-6">
        {/* 2. Stepper Card */}
        <div
          className="rounded-2xl border p-4 shadow-sm"
          style={{
            backgroundColor: 'var(--theme-bg-surface)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <div className="flex items-center justify-between text-xs font-medium">
            {/* Step 1: Drive */}
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  isDriveConnected
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/5 text-gray-500 border border-white/10'
                }`}
              >
                {isDriveConnected ? <Check size={14} /> : '1'}
              </div>
              <div>
                <div className="font-bold text-white">Drive</div>
                <div className="text-[11px] text-emerald-400">
                  {isDriveConnected ? 'Connected' : 'Needs connection'}
                </div>
              </div>
            </div>

            <div
              className="flex-1 h-px mx-4"
              style={{ backgroundColor: 'var(--theme-border)' }}
            />

            {/* Step 2: Project */}
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  selectedProjectId
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                    : 'bg-white/5 text-gray-500 border border-white/10'
                }`}
              >
                {selectedProjectId ? <Check size={14} /> : '2'}
              </div>
              <div>
                <div className="font-bold text-white">Project</div>
                <div className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                  {selectedProjectId ? activeProject?.name || 'Selected' : 'Choose project'}
                </div>
              </div>
            </div>

            <div
              className="flex-1 h-px mx-4"
              style={{ backgroundColor: 'var(--theme-border)' }}
            />

            {/* Step 3: Folder */}
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  currentFolder
                    ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                    : 'bg-white/5 text-gray-500 border border-white/10'
                }`}
              >
                3
              </div>
              <div>
                <div className="font-bold text-white">Folder</div>
                <div className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                  {currentFolder ? currentFolder.name : 'Open target folder'}
                </div>
              </div>
            </div>

            <div
              className="flex-1 h-px mx-4"
              style={{ backgroundColor: 'var(--theme-border)' }}
            />

            {/* Step 4: Files */}
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  fileList.length > 0
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                    : 'bg-white/5 text-gray-500 border border-white/10'
                }`}
              >
                4
              </div>
              <div>
                <div className="font-bold text-white">Files</div>
                <div className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                  {fileList.length > 0 ? `${fileList.length} staged` : 'Add media'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Top Row: Project Picker + Project Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card: Project Selection */}
          <div
            className="rounded-2xl border p-5 shadow-sm flex flex-col justify-between"
            style={{
              backgroundColor: 'var(--theme-bg-surface)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                  <Database size={19} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Project</h3>
                  <p className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                    Choose where this media belongs
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--theme-text-muted)' }}>
                  Select Project
                </label>
                <div className="relative">
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full h-11 px-3.5 pr-9 rounded-xl border text-xs font-semibold text-white focus:outline-none appearance-none transition"
                    style={{
                      backgroundColor: 'var(--theme-bg-app)',
                      borderColor: 'var(--theme-border)',
                    }}
                  >
                    <option value="" className="bg-[#1A1D21] text-gray-300">
                      Search and select a project
                    </option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#1A1D21] text-white">
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute right-3.5 top-3.5 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card: Project Statistics */}
          <div
            className="rounded-2xl border p-5 shadow-sm flex flex-col justify-between"
            style={{
              backgroundColor: 'var(--theme-bg-surface)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div className="grid grid-cols-3 gap-3">
              <div
                className="p-3.5 rounded-xl border"
                style={{
                  backgroundColor: 'var(--theme-bg-app)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                <span className="text-[11px] font-medium block" style={{ color: 'var(--theme-text-muted)' }}>
                  Total folders
                </span>
                <strong className="text-xl font-bold text-white mt-1 block">
                  {projectStats?.folderCount || 0}
                </strong>
              </div>

              <div
                className="p-3.5 rounded-xl border"
                style={{
                  backgroundColor: 'var(--theme-bg-app)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                <span className="text-[11px] font-medium block" style={{ color: 'var(--theme-text-muted)' }}>
                  Total files
                </span>
                <strong className="text-xl font-bold text-white mt-1 block">
                  {projectStats?.fileCount || 0}
                </strong>
              </div>

              <div
                className="p-3.5 rounded-xl border"
                style={{
                  backgroundColor: 'var(--theme-bg-app)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                <span className="text-[11px] font-medium block" style={{ color: 'var(--theme-text-muted)' }}>
                  Project file size
                </span>
                <strong className="text-xl font-bold text-white mt-1 block truncate">
                  {projectStats ? formatBytes(projectStats.totalSize) : '0 B'}
                </strong>
              </div>
            </div>

            <div
              className="mt-4 pt-3.5 border-t flex items-center justify-between text-xs"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <span className="font-bold text-white">Files inside each folder</span>
              <span className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                {selectedProjectId ? activeProject?.name : 'Select a project'}
              </span>
            </div>

            {!selectedProjectId ? (
              <div className="py-8 text-center text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                <File size={26} className="mx-auto mb-1.5 opacity-40" />
                <span>Select a project to view stats</span>
              </div>
            ) : (
              <div className="mt-3 space-y-1.5 max-h-28 overflow-y-auto pr-1 text-xs">
                {folders.map((f) => (
                  <div
                    key={f.id}
                    className="p-2.5 rounded-xl border flex items-center justify-between"
                    style={{
                      backgroundColor: 'var(--theme-bg-app)',
                      borderColor: 'var(--theme-border)',
                    }}
                  >
                    <span className="font-medium text-white truncate max-w-xs">{f.name}</span>
                    <span className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                      Folder
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 4. Bottom Row: Drive Folders (Left) + Upload Target & Files in Folder (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Drive Folders (5 cols) */}
          <div
            className="lg:col-span-5 rounded-2xl border p-5 shadow-sm space-y-4"
            style={{
              backgroundColor: 'var(--theme-bg-surface)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FolderOpen size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Drive Folders</h3>
                  <p className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                    Choose the upload destination
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleOpenBreadcrumb(-1)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border hover:opacity-85 flex items-center gap-1.5 transition"
                style={{
                  backgroundColor: 'var(--theme-bg-app)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-muted)',
                }}
              >
                <Home size={12} />
                <span>Project Root</span>
              </button>
            </div>

            {/* Breadcrumb path */}
            <div
              className="flex items-center flex-wrap gap-1 text-xs py-1.5 border-b"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <button
                onClick={() => handleOpenBreadcrumb(-1)}
                className="hover:underline font-semibold text-blue-400"
              >
                Project Root
              </button>
              {folderStack.map((f, i) => (
                <React.Fragment key={f.id}>
                  <ChevronRight size={12} className="text-gray-500" />
                  <button
                    onClick={() => handleOpenBreadcrumb(i)}
                    className="hover:underline font-semibold text-blue-400"
                  >
                    {f.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* Create Subfolder Input */}
            <div>
              <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--theme-text-muted)' }}>
                Project Root
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={selectedProjectId ? 'New folder name' : 'Select a project first'}
                  value={newFolderName}
                  disabled={!selectedProjectId || creatingFolder}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  className="flex-1 h-9 px-3 rounded-xl border text-xs text-white focus:outline-none transition"
                  style={{
                    backgroundColor: 'var(--theme-bg-app)',
                    borderColor: 'var(--theme-border)',
                  }}
                />
                <button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim() || creatingFolder}
                  className="px-3.5 h-9 rounded-xl border hover:opacity-85 disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-1.5 transition"
                  style={{
                    backgroundColor: 'var(--theme-bg-app)',
                    borderColor: 'var(--theme-border)',
                  }}
                >
                  <FolderPlus size={13} className="text-blue-400" />
                  <span>Create</span>
                </button>
              </div>
            </div>

            {/* Folders List or Empty State */}
            {folderLoading ? (
              <div className="py-12 text-center text-xs flex items-center justify-center gap-2" style={{ color: 'var(--theme-text-muted)' }}>
                <RefreshCw size={14} className="animate-spin text-blue-400" />
                <span>Loading folders...</span>
              </div>
            ) : folders.length === 0 ? (
              <div className="py-16 text-center" style={{ color: 'var(--theme-text-muted)' }}>
                <Folder size={36} className="mx-auto mb-2 opacity-30 text-amber-400" />
                <span className="text-xs">
                  {selectedProjectId ? 'No subfolders created yet' : 'Select a project to load folders'}
                </span>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="p-3 rounded-xl border transition flex items-center justify-between group hover:border-blue-500/50"
                    style={{
                      backgroundColor: 'var(--theme-bg-app)',
                      borderColor: 'var(--theme-border)',
                    }}
                  >
                    <div
                      onClick={() => handleOpenFolder(folder)}
                      className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1"
                    >
                      <Folder size={17} className="text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block truncate">
                          {folder.name}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                          Drive folder
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenFolder(folder)}
                        className="px-2 py-0.5 text-xs text-blue-400 hover:underline font-semibold"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => handleDeleteFolder(folder)}
                        className="p-1.5 text-gray-400 hover:text-rose-400 transition"
                        title="Delete folder"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Upload Target + Files in Folder (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* CARD: Upload Target */}
            <div
              className="rounded-2xl border p-5 shadow-sm space-y-4"
              style={{
                backgroundColor: 'var(--theme-bg-surface)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-blue-400 tracking-wider uppercase block">
                    Upload Target
                  </span>
                  <h3 className="text-base font-bold text-white">
                    {currentFolder ? currentFolder.name : 'No folder selected'}
                  </h3>
                  <p className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                    Add a prefix and description for every file before upload.
                  </p>
                </div>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-xl border text-xs font-semibold text-white hover:opacity-85 transition"
                  style={{
                    backgroundColor: 'var(--theme-bg-app)',
                    borderColor: 'var(--theme-border)',
                  }}
                >
                  Select folder
                </button>
              </div>

              {/* Info banner */}
              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-300 text-xs flex items-start gap-2.5">
                <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold text-blue-200">Open a Drive folder to enable uploads</strong>
                  <span className="text-[11px] text-blue-300/80">
                    Select a project, open an existing folder or create a new one, then drop files into the upload area.
                  </span>
                </div>
              </div>

              {/* Upload Drop Area */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center hover:border-blue-500/60"
                style={{
                  borderColor: 'var(--theme-border)',
                  backgroundColor: 'var(--theme-bg-app)',
                }}
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-2">
                  <UploadCloud size={24} />
                </div>
                <h4 className="text-sm font-bold text-white">Select or drop files</h4>
                <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                  Upload up to 20 media files to the selected Google Drive folder.
                </p>
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFilesSelected}
                  className="hidden"
                />
              </div>

              {/* Upload Queue List */}
              {fileList.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold text-white block">
                    Upload Queue ({fileList.length} files)
                  </span>

                  {fileList.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border space-y-2 text-xs"
                      style={{
                        backgroundColor: 'var(--theme-bg-app)',
                        borderColor: 'var(--theme-border)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate max-w-sm">
                          <File size={14} className="text-blue-400 shrink-0" />
                          <span className="font-semibold text-white truncate">
                            {item.fileNamePrefix ? `${item.fileNamePrefix}_` : ''}
                            {item.originalFileName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-blue-400">
                            {item.status === 'uploading'
                              ? `${item.progress}% (${formatBytes(item.speed)}/s)`
                              : item.status === 'complete'
                              ? 'Uploaded'
                              : item.status === 'error'
                              ? 'Failed'
                              : 'Ready'}
                          </span>
                          {item.status !== 'uploading' && item.status !== 'complete' && (
                            <button
                              onClick={() => setFileList((q) => q.filter((x) => x.id !== item.id))}
                              className="text-gray-400 hover:text-rose-400 transition"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={item.fileNamePrefix}
                          placeholder="Prefix (e.g. DRAFT)"
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setFileList((q) =>
                              q.map((x) => (x.id === item.id ? { ...x, fileNamePrefix: val } : x))
                            );
                          }}
                          className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold text-white focus:outline-none transition"
                          style={{
                            backgroundColor: 'var(--theme-bg-surface)',
                            borderColor: 'var(--theme-border)',
                          }}
                        />
                        <input
                          type="text"
                          value={item.description}
                          placeholder="Description"
                          onChange={(e) => {
                            const val = e.target.value;
                            setFileList((q) =>
                              q.map((x) => (x.id === item.id ? { ...x, description: val } : x))
                            );
                          }}
                          className="px-2.5 py-1.5 rounded-lg border text-xs text-white focus:outline-none transition"
                          style={{
                            backgroundColor: 'var(--theme-bg-surface)',
                            borderColor: 'var(--theme-border)',
                          }}
                        />
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            item.status === 'complete'
                              ? 'bg-emerald-400'
                              : item.status === 'error'
                              ? 'bg-rose-500'
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      {item.error && <span className="text-[11px] text-rose-400">{item.error}</span>}
                    </div>
                  ))}
                </div>
              )}

              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-medium">
                  {uploadError}
                </div>
              )}

              {/* Action Buttons */}
              <div
                className="flex items-center justify-end gap-2.5 pt-3 border-t"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <button
                  onClick={() => setFileList([])}
                  disabled={fileList.length === 0 || isUploading}
                  className="px-4 py-2 rounded-xl border text-xs font-semibold hover:opacity-85 disabled:opacity-40 transition"
                  style={{
                    backgroundColor: 'var(--theme-bg-app)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-muted)',
                  }}
                >
                  Clear Queue
                </button>
                <button
                  onClick={handleStartUpload}
                  disabled={fileList.length === 0 || isUploading}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                >
                  <UploadCloud size={14} />
                  <span>{isUploading ? 'Uploading...' : 'Upload to Folder'}</span>
                </button>
              </div>
            </div>

            {/* CARD: Files in Folder */}
            <div
              className="rounded-2xl border p-5 shadow-sm space-y-4"
              style={{
                backgroundColor: 'var(--theme-bg-surface)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <File size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Files in Folder</h3>
                    <p className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                      Open Drive links, rename, or remove media
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => currentFolderId && loadFiles(currentFolderId)}
                  disabled={!currentFolderId || fileLoading}
                  className="px-3 py-1.5 text-xs font-semibold text-white hover:opacity-85 border rounded-xl flex items-center gap-1.5 transition"
                  style={{
                    backgroundColor: 'var(--theme-bg-app)',
                    borderColor: 'var(--theme-border)',
                  }}
                >
                  <RefreshCw size={12} className={fileLoading ? 'animate-spin text-blue-400' : ''} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Files List */}
              {fileLoading ? (
                <div className="py-12 text-center text-xs flex items-center justify-center gap-2" style={{ color: 'var(--theme-text-muted)' }}>
                  <RefreshCw size={14} className="animate-spin text-blue-400" />
                  <span>Loading files...</span>
                </div>
              ) : driveFiles.length === 0 ? (
                <div className="py-14 text-center" style={{ color: 'var(--theme-text-muted)' }}>
                  <File size={34} className="mx-auto mb-2 opacity-30 text-blue-400" />
                  <span className="text-xs">
                    {currentFolder ? 'No files in this folder' : 'Select a folder to see files'}
                  </span>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {driveFiles.map((file) => {
                    const isVideo = file.mimeType.startsWith('video/');
                    const isImage = file.mimeType.startsWith('image/');

                    return (
                      <div
                        key={file.id}
                        className="p-3 rounded-xl border transition flex items-center justify-between text-xs hover:border-blue-500/50"
                        style={{
                          backgroundColor: 'var(--theme-bg-app)',
                          borderColor: 'var(--theme-border)',
                        }}
                      >
                        <div
                          onClick={() => setPreviewMediaFile(file)}
                          className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                        >
                          {file.thumbnailLink ? (
                            <img
                              src={file.thumbnailLink}
                              alt={file.name}
                              className="w-9 h-9 object-cover rounded-lg shrink-0 border border-white/10"
                            />
                          ) : isVideo ? (
                            <div className="w-9 h-9 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
                              <FileVideo size={18} />
                            </div>
                          ) : isImage ? (
                            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                              <FileImage size={18} />
                            </div>
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                              <File size={18} />
                            </div>
                          )}

                          <div className="min-w-0">
                            <span className="font-bold text-white block truncate max-w-sm">
                              {file.name}
                            </span>
                            <span className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                              {formatBytes(file.size)} •{' '}
                              {file.modifiedTime
                                ? new Date(file.modifiedTime).toLocaleDateString()
                                : 'Recent'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const link =
                                file.webViewLink ||
                                `https://drive.google.com/file/d/${file.id}/view?usp=sharing`;
                              navigator.clipboard.writeText(link);
                              alert('Drive view link copied!');
                            }}
                            className="p-1.5 text-gray-400 hover:text-white transition"
                            title="Copy link"
                          >
                            <Copy size={13} />
                          </button>
                          <a
                            href={file.webViewLink || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-gray-400 hover:text-blue-400 transition"
                            title="Open in Drive"
                          >
                            <ExternalLink size={13} />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Media Preview Modal */}
      {previewMediaFile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-60 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-black/90 text-white overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">{previewMediaFile.name}</h3>
                <span className="text-[11px] text-gray-400">
                  {formatBytes(previewMediaFile.size)} • {previewMediaFile.mimeType}
                </span>
              </div>
              <button
                onClick={() => setPreviewMediaFile(null)}
                className="p-1.5 text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black min-h-[300px]">
              {previewMediaFile.mimeType.startsWith('video/') ? (
                <video
                  controls
                  autoPlay
                  className="max-h-[60vh] rounded"
                  src={`/api/drive/files/content?fileId=${encodeURIComponent(previewMediaFile.id)}`}
                />
              ) : previewMediaFile.mimeType.startsWith('image/') ? (
                <img
                  src={`/api/drive/files/content?fileId=${encodeURIComponent(previewMediaFile.id)}`}
                  alt={previewMediaFile.name}
                  className="max-h-[60vh] object-contain rounded"
                />
              ) : (
                <div className="text-center p-6 text-gray-400 text-xs">
                  <File size={36} className="mx-auto mb-2 text-[#0091FF]" />
                  <span>Preview not available for this format</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
