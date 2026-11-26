"use client";

import React, { useRef, useState } from "react";
import { Project, ProjectDocument } from "@orbit/types";
import { FileText, StickyNote, Users, Globe, Link2, Board, Upload, Pencil, X } from "@/components/ui/icons";
import { api } from "../../lib/api";
import {
  FieldLabel,
  MenuItem,
  ModalFrame,
  Popover,
  PrimaryButton,
  RadioCard,
  SecondaryButton,
  SelectTrigger,
  Visibility,
  inputClass,
  inputStyle,
} from "./docsCanvasUi";

interface NewDocumentModalProps {
  workspaceId: string;
  projects: Project[];
  onClose: () => void;
  // openShare: the creator picked "Shared", so the share dialog should open next to invite people
  onCreated: (doc: ProjectDocument, opts: { openShare: boolean }) => void;
}

// A doc is either written in Orbit's editor or an uploaded PDF / Word file.
type Mode = "write" | "upload";
const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx"];
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // matches the server's multipart limit

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
};

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const OPTIONS: { id: Visibility; title: string; description: string; Icon: React.ElementType }[] = [
  { id: "draft", title: "Draft", description: "Only you can see it until you share it.", Icon: StickyNote },
  { id: "shared", title: "Shared", description: "Only the people you invite can open it.", Icon: Users },
  { id: "public", title: "Public", description: "Everyone in Orbit can find and read it.", Icon: Globe },
];

export const NewDocumentModal: React.FC<NewDocumentModalProps> = ({ workspaceId, projects, onClose, onCreated }) => {
  const [mode, setMode] = useState<Mode>("write");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("draft");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linked = projects.find((p) => p.id === projectId);

  const pickFile = (picked: File | undefined | null) => {
    if (!picked) return;
    if (!ACCEPTED_EXTENSIONS.includes(extensionOf(picked.name))) {
      setError("Only PDF and Word (.doc, .docx) files can be uploaded.");
      return;
    }
    if (picked.size > MAX_UPLOAD_BYTES) {
      setError("This file is larger than 50 MB.");
      return;
    }
    setError(null);
    setFile(picked);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Choose a PDF or Word file to upload.");
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      // Text fields go before the file: the server reads them when it reaches the file part.
      const form = new FormData();
      form.append("workspaceId", workspaceId);
      if (projectId) form.append("projectId", projectId);
      if (title.trim()) form.append("title", title.trim());
      form.append("isPublicInProject", String(visibility === "public"));
      form.append("file", file);
      const res = await api.post("/api/documents/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onCreated(res.data, { openShare: visibility === "shared" });
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to upload file");
      setIsCreating(false);
    }
  };

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (mode === "upload") return handleUpload();
    setIsCreating(true);
    setError(null);
    try {
      const res = await api.post("/api/documents", {
        workspaceId,
        title: title.trim() || "Untitled Document",
        content: "",
        icon: "📄",
        isPublicInProject: visibility === "public",
        projectId,
      });
      onCreated(res.data, { openShare: visibility === "shared" });
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create document");
      setIsCreating(false);
    }
  };

  return (
    <ModalFrame
      width={520}
      icon={<FileText size={20} />}
      title="New document"
      subtitle={mode === "upload" ? "Upload a PDF or Word file for your team." : "Write it now, share it when it is ready."}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => handleCreate()} disabled={isCreating}>
            {mode === "upload"
              ? isCreating
                ? "Uploading…"
                : "Upload document"
              : isCreating
                ? "Creating…"
                : "Create document"}
          </PrimaryButton>
        </>
      }
    >
      <div className="flex gap-2">
        {(
          [
            { id: "write", label: "Write", Icon: Pencil },
            { id: "upload", label: "Upload file", Icon: Upload },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setMode(id);
              setError(null);
            }}
            className="flex-1 h-9 rounded-lg flex items-center justify-center gap-2 text-[13px] font-semibold transition"
            style={{
              border: mode === id ? "1.5px solid var(--theme-primary)" : "1px solid var(--theme-border)",
              backgroundColor: mode === id ? "var(--theme-selected)" : "var(--theme-bg-app)",
              color: mode === id ? "var(--theme-accent)" : "var(--theme-text-muted)",
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {mode === "upload" && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel>File</FieldLabel>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(",")}
            className="hidden"
            onChange={(e) => {
              pickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {file ? (
            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ border: "1px solid var(--theme-border)", backgroundColor: "var(--theme-bg-app)" }}
            >
              <span className="text-2xl leading-none">{extensionOf(file.name) === ".pdf" ? "📕" : "📘"}</span>
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="text-sm font-semibold truncate" style={{ color: "var(--theme-text)" }} title={file.name}>
                  {file.name}
                </span>
                <span className="text-[12px]" style={{ color: "var(--theme-text-muted)" }}>
                  {formatSize(file.size)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setFile(null)}
                title="Remove file"
                className="w-7 h-7 rounded-lg flex items-center justify-center transition hover:bg-[var(--theme-fill-hover)]"
                style={{ color: "var(--theme-text-muted)" }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              className="w-full p-5 rounded-xl flex flex-col items-center gap-1.5 text-center transition"
              style={{
                border: `1.5px dashed ${isDragging ? "var(--theme-primary)" : "var(--theme-border)"}`,
                backgroundColor: isDragging ? "var(--theme-selected)" : "var(--theme-bg-app)",
              }}
            >
              <Upload size={20} style={{ color: "var(--theme-text-muted)" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--theme-text)" }}>
                Click to choose a file, or drag it here
              </span>
              <span className="text-[12px]" style={{ color: "var(--theme-text-muted)" }}>
                PDF, DOC or DOCX · up to 50 MB
              </span>
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleCreate} className="flex flex-col gap-1.5">
        <FieldLabel optional={mode === "upload"}>Title</FieldLabel>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={mode === "upload" ? "Uses the file name if left empty" : "Untitled document"}
          maxLength={255}
          className={inputClass}
          style={inputStyle}
        />
      </form>

      <div className="flex flex-col gap-2">
        <FieldLabel>Visibility</FieldLabel>
        {OPTIONS.map((o) => (
          <RadioCard
            key={o.id}
            selected={visibility === o.id}
            onSelect={() => setVisibility(o.id)}
            icon={<o.Icon size={16} />}
            title={o.title}
            description={o.description}
          />
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel optional>Link to</FieldLabel>
        <Popover
          align="left"
          width={472}
          trigger={(_, toggle) => (
            <SelectTrigger
              onClick={toggle}
              icon={<Link2 size={16} />}
              label={linked ? `${linked.name} board` : "Choose a project board"}
              placeholder={!linked}
            />
          )}
        >
          {(close) => (
            <>
              <MenuItem
                onClick={() => {
                  setProjectId(null);
                  close();
                }}
                selected={!projectId}
              >
                No link
              </MenuItem>
              {projects.map((p) => (
                <MenuItem
                  key={p.id}
                  icon={<Board size={14} />}
                  selected={p.id === projectId}
                  onClick={() => {
                    setProjectId(p.id);
                    close();
                  }}
                >
                  {p.name}
                </MenuItem>
              ))}
            </>
          )}
        </Popover>
      </div>

      {error && (
        <p className="text-[13px]" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}
    </ModalFrame>
  );
};
