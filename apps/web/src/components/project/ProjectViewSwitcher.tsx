"use client";

import React from "react";
import { Board, Summary, List } from "@/components/ui/icons";

interface ProjectViewSwitcherProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const VIEWS = [
  { id: "summary", label: "Summary", Icon: Summary },
  { id: "board", label: "Board", Icon: Board },
  { id: "list", label: "List", Icon: List },
] as const;

export const ProjectViewSwitcher: React.FC<ProjectViewSwitcherProps> = ({ activeSection, onSectionChange }) => (
  <div role="tablist" className="flex items-start gap-5 h-12 shrink-0">
    {VIEWS.map(({ id, label, Icon }) => {
      const active = activeSection === id;
      return (
        <button
          key={id}
          role="tab"
          aria-selected={active}
          onClick={() => onSectionChange(id)}
          className="flex flex-col items-center h-12 shrink-0 group"
        >
          <span
            className={`h-[46px] px-1 flex items-center gap-2 text-sm whitespace-nowrap transition-colors ${
              active ? "font-semibold" : "font-medium group-hover:opacity-80"
            }`}
            style={{ color: active ? "var(--theme-primary-hover)" : "var(--theme-text-muted)" }}
          >
            <Icon size={16} />
            {label}
          </span>
          <span
            className="h-0.5 w-full"
            style={{ backgroundColor: active ? "var(--theme-primary)" : "transparent" }}
          />
        </button>
      );
    })}
  </div>
);
