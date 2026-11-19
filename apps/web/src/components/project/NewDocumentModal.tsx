"use client";

import React, { useState } from "react";
import { Project, ProjectDocument } from "@orbit/types";
import { FileText, StickyNote, Users, Globe, Link2, Board } from "@/components/ui/icons";
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

const OPTIONS: { id: Visibility; title: string; description: string; Icon: React.ElementType }[] = [
  { id: "draft", title: "Draft", description: "Only you can see it until you share it.", Icon: StickyNote },
  { id: "shared", title: "Shared", description: "Only the people you invite can open it.", Icon: Users },
  { id: "public", title: "Public", description: "Everyone in Orbit can find and read it.", Icon: Globe },
];

export const NewDocumentModal: React.FC<NewDocumentModalProps> = ({ workspaceId, projects, onClose, onCreated }) => {
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("draft");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linked = projects.find((p) => p.id === projectId);

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
      subtitle="Write it now, share it when it is ready."
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => handleCreate()} disabled={isCreating}>
            {isCreating ? "Creating…" : "Create document"}
          </PrimaryButton>
        </>
      }
    >
      <form onSubmit={handleCreate} className="flex flex-col gap-1.5">
        <FieldLabel>Title</FieldLabel>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled document"
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
