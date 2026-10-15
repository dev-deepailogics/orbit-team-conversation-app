"use client";

import React, { useState } from "react";
import {
  Columns3,
  FileText,
  Plus,
  Calendar,
  Clock,
  Table as TableIcon,
  Sparkles,
  ChevronDown,
  LayoutGrid,
} from "lucide-react";

export interface ViewOption {
  id: string;
  label: string;
  icon: any;
  count?: number;
  badge?: string;
  isAvailable?: boolean;
}

interface ProjectViewSwitcherProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  ticketCount?: number;
  docCount?: number;
}

export const ProjectViewSwitcher: React.FC<ProjectViewSwitcherProps> = ({
  activeSection,
  onSectionChange,
  ticketCount = 0,
  docCount = 0,
}) => {
  const [showFutureViewsMenu, setShowFutureViewsMenu] = useState(false);

  const views: ViewOption[] = [
    {
      id: "board",
      label: "Board",
      icon: Columns3,
      count: ticketCount,
      isAvailable: true,
    },
    {
      id: "docs",
      label: "Documents",
      icon: FileText,
      count: docCount,
      isAvailable: true,
    },
  ];

  const upcomingViews: ViewOption[] = [
    {
      id: "timeline",
      label: "Timeline & Gantt",
      icon: Clock,
      badge: "Soon",
      isAvailable: false,
    },
  ];

  return (
    <div
      className="relative flex items-center gap-1.5 py-1 px-1 rounded-xl border bg-black/5 dark:bg-white/[0.04]"
      style={{
        borderColor: "var(--theme-border)",
      }}
    >
      {/* Active & Available Views */}
      {views.map((view) => {
        const Icon = view.icon;
        const isActive = activeSection === view.id;

        return (
          <button
            key={view.id}
            onClick={() => onSectionChange(view.id)}
            title={view.label}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 relative shrink-0 ${
              isActive
                ? "shadow-sm font-bold"
                : "opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5"
            }`}
            style={{
              backgroundColor: isActive
                ? "var(--theme-bg-surface)"
                : "transparent",
              color: isActive
                ? "var(--theme-text-primary)"
                : "var(--theme-text-muted)",
              borderWidth: isActive ? "1px" : "0px",
              borderColor: isActive ? "var(--theme-border)" : "transparent",
            }}
          >
            <Icon
              size={14}
              style={{
                color: isActive ? "var(--theme-primary)" : "inherit",
              }}
            />
            <span className="hidden sm:inline">{view.label}</span>

            {typeof view.count === "number" && (
              <span
                className="text-[10px] px-1 sm:px-1.5 py-0.2 rounded-full font-medium"
                style={{
                  backgroundColor: isActive
                    ? "var(--theme-bg-surface-hover)"
                    : "var(--theme-bg-surface)",
                  color: isActive
                    ? "var(--theme-text-primary)"
                    : "var(--theme-text-muted)",
                }}
              >
                {view.count}
              </span>
            )}
          </button>
        );
      })}

      {/* Extensible Future Views Dropdown Trigger */}
      <div className="relative shrink-0">
        <button
          onClick={() => setShowFutureViewsMenu((prev) => !prev)}
          title="Add or browse more project views"
          className="flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 transition"
          style={{
            color: "var(--theme-text-muted)",
          }}
        >
          <Plus size={13} />
          <span className="hidden sm:inline text-[11px]">View</span>
          <ChevronDown size={11} className="opacity-70 hidden sm:inline" />
        </button>

        {/* Future Views Popover */}
        {showFutureViewsMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowFutureViewsMenu(false)}
            />
            <div
              className="absolute right-0 top-full mt-1.5 z-50 w-56 max-w-[calc(100vw-1.5rem)] rounded-xl border p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
              style={{
                backgroundColor: "var(--theme-bg-surface)",
                borderColor: "var(--theme-border)",
                color: "var(--theme-text-primary)",
              }}
            >
              <div
                className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider opacity-50"
                style={{ color: "var(--theme-text-muted)" }}
              >
                Upcoming Features
              </div>

              {upcomingViews.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs opacity-65 hover:opacity-90 transition cursor-not-allowed"
                    style={{
                      color: "var(--theme-text-muted)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <ItemIcon size={14} />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md"
                        style={{
                          backgroundColor: "var(--theme-bg-surface-hover)",
                          color: "var(--theme-primary)",
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
