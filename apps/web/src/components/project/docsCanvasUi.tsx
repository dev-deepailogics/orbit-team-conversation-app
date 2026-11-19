"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, Check, Search, X, More } from "@/components/ui/icons";
import { Avatar, tint } from "./projectViewUtils";

// Shared chrome for the Docs and Canvas pages (Figma "Docs · Document list", "Canvas · Canvas list",
// their editor headers, and the New / Share modals).

const SUCCESS = "#1F9D63";
const WARNING = "#D97706";

export const PageHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  right?: React.ReactNode;
}> = ({ icon, title, subtitle, right }) => (
  <div className="h-16 px-6 flex items-center gap-4 shrink-0">
    <div className="flex-1 min-w-0 flex items-center gap-3">
      <span
        className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
        style={{ backgroundColor: "var(--theme-selected)", color: "var(--theme-accent)" }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[17px] font-bold leading-[22px] truncate" style={{ color: "var(--theme-text)" }}>
          {title}
        </p>
        <p className="text-[13px] leading-[18px] truncate" style={{ color: "var(--theme-text-muted)" }}>
          {subtitle}
        </p>
      </div>
    </div>
    {right}
  </div>
);

export const SearchOrbitButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="hidden md:flex w-[320px] h-10 pl-3 pr-2 rounded-xl items-center gap-2 text-left transition hover:brightness-[0.98]"
    style={{ backgroundColor: "var(--theme-bg-surface-hover)", color: "var(--theme-text-muted)" }}
  >
    <Search size={16} />
    <span className="text-sm flex-1">Search Orbit</span>
    <kbd
      className="px-1.5 py-0.5 rounded-md border text-[11px] font-medium font-sans"
      style={{ borderColor: "color-mix(in srgb, var(--theme-text) 20%, transparent)" }}
    >
      Ctrl K
    </kbd>
  </button>
);

export interface TabDef<T extends string> {
  id: T;
  label: string;
  count: number;
}

export function TabsRow<T extends string>({
  tabs,
  active,
  onChange,
  action,
}: {
  tabs: TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="h-12 px-6 flex items-center justify-between gap-3 shrink-0">
      <div className="h-12 flex items-start gap-5 overflow-x-auto scrollbar-none">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className="h-12 flex flex-col items-center shrink-0"
            >
              <span className="h-[46px] px-1 flex items-center gap-2">
                <span
                  className={`text-sm whitespace-nowrap ${isActive ? "font-semibold" : "font-medium"}`}
                  style={{ color: isActive ? "var(--theme-primary-hover)" : "var(--theme-text-muted)" }}
                >
                  {t.label}
                </span>
                <span
                  className="h-5 min-w-5 px-[7px] rounded-[10px] flex items-center justify-center text-xs font-semibold"
                  style={{
                    backgroundColor: isActive ? "var(--theme-selected)" : "var(--theme-bg-surface-hover)",
                    color: isActive ? "var(--theme-primary-hover)" : "var(--theme-text-muted)",
                  }}
                >
                  {t.count}
                </span>
              </span>
              <span
                className="h-0.5 w-full"
                style={{ backgroundColor: isActive ? "var(--theme-primary)" : "transparent" }}
              />
            </button>
          );
        })}
      </div>
      {action}
    </div>
  );
}

export const SearchField: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}> = ({ value, onChange, placeholder }) => (
  <label
    className="w-full sm:w-[300px] h-9 px-3 rounded-[10px] flex items-center gap-2 shrink-0"
    style={{ backgroundColor: "var(--theme-bg-surface-hover)", color: "var(--theme-text-muted)" }}
  >
    <Search size={15} />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="flex-1 min-w-0 bg-transparent outline-none text-[13px] placeholder:text-[var(--theme-text-muted)]"
      style={{ color: "var(--theme-text)" }}
    />
    {value && (
      <button type="button" onClick={() => onChange("")} title="Clear" className="hover:opacity-70">
        <X size={12} />
      </button>
    )}
  </label>
);

export type Visibility = "public" | "shared" | "draft";

const VISIBILITY_META: Record<Visibility, { label: string; color: string; bg: string }> = {
  public: { label: "Public", color: `color-mix(in srgb, ${SUCCESS} 70%, var(--theme-text))`, bg: tint(SUCCESS, 14) },
  shared: { label: "Shared", color: "var(--theme-primary-hover)", bg: "var(--theme-selected)" },
  draft: { label: "Draft", color: `color-mix(in srgb, ${WARNING} 65%, var(--theme-text))`, bg: tint(WARNING, 14) },
};

export const VisibilityPill: React.FC<{ visibility: Visibility; icon: React.ReactNode }> = ({ visibility, icon }) => {
  const m = VISIBILITY_META[visibility];
  return (
    <span
      className="inline-flex items-center gap-[5px] h-6 px-[9px] rounded-xl text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: m.bg, color: m.color }}
    >
      {icon}
      {m.label}
    </span>
  );
};

// Generic popover menu anchored to its trigger; closes on outside click.
export const Popover: React.FC<{
  trigger: (open: boolean, toggle: () => void) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  width?: number;
}> = ({ trigger, children, align = "right", width = 208 }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative shrink-0">
      {trigger(open, () => setOpen((v) => !v))}
      {open && (
        <div
          className={`absolute top-full mt-1.5 z-50 max-h-80 overflow-y-auto rounded-xl border p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100 ${
            align === "right" ? "right-0" : "left-0"
          }`}
          style={{ width, backgroundColor: "var(--theme-bg-app)", borderColor: "var(--theme-border)" }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
};

export const MenuItem: React.FC<{
  onClick: () => void;
  icon?: React.ReactNode;
  selected?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ onClick, icon, selected, danger, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full h-8 px-2.5 rounded-lg flex items-center gap-2 text-[13px] text-left transition hover:bg-[var(--theme-fill-hover)]"
    style={{ color: danger ? "#DC2626" : "var(--theme-text)" }}
  >
    {icon && <span className="shrink-0 flex" style={{ color: danger ? "#DC2626" : "var(--theme-text-muted)" }}>{icon}</span>}
    <span className="flex-1 truncate">{children}</span>
    {selected && <Check size={12} style={{ color: "var(--theme-primary)" }} />}
  </button>
);

export const MoreButton: React.FC<{ onClick: () => void; size?: 32 | 36; title?: string }> = ({
  onClick,
  size = 32,
  title = "More actions",
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`${size === 36 ? "w-9 h-9 rounded-[10px]" : "w-8 h-8 rounded-lg"} flex items-center justify-center shrink-0 transition hover:bg-[var(--theme-fill-hover)]`}
    style={{ color: "var(--theme-text-muted)" }}
  >
    <More size={18} />
  </button>
);

// ---------- Editor header (doc editor / canvas workspace) ----------

export const BackPill: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="h-8 pl-1.5 pr-2.5 rounded-2xl flex items-center gap-1 shrink-0 transition hover:bg-[var(--theme-fill-hover)]"
    style={{ color: "var(--theme-text-muted)" }}
  >
    <ChevronLeft size={16} />
    <span className="text-[13px] font-medium">{label}</span>
  </button>
);

export const SaveMeta: React.FC<{ saving: boolean; savedLabel?: string; children?: React.ReactNode }> = ({
  saving,
  savedLabel = "Saved",
  children,
}) => (
  <div className="flex items-center gap-1.5 text-xs min-w-0" style={{ color: "var(--theme-text-muted)" }}>
    {saving ? (
      <span className="w-[7px] h-[7px] rounded-full animate-pulse shrink-0" style={{ backgroundColor: WARNING }} />
    ) : (
      <Check size={13} />
    )}
    <span className="whitespace-nowrap">{saving ? "Saving…" : savedLabel}</span>
    {children}
  </div>
);

export const AvatarStack: React.FC<{ people: { id: string; name: string; avatarUrl?: string | null }[]; max?: number }> = ({
  people,
  max = 4,
}) =>
  people.length ? (
    <div className="hidden sm:flex items-center pr-1.5 shrink-0">
      {people.slice(0, max).map((p, i) => (
        <Avatar key={p.id} name={p.name} src={p.avatarUrl} size={28} ring="var(--theme-bg-app)" className={i ? "-ml-1.5" : ""} />
      ))}
      {people.length > max && (
        <span
          className="-ml-1.5 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
          style={{ backgroundColor: "var(--theme-bg-surface-hover)", color: "var(--theme-text)", boxShadow: "0 0 0 2px var(--theme-bg-app)" }}
        >
          +{people.length - max}
        </span>
      )}
    </div>
  ) : null;

export const OutlinePill: React.FC<{
  onClick?: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  title?: string;
}> = ({ onClick, icon, children, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="h-8 px-3 rounded-2xl border flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap shrink-0 transition hover:bg-[var(--theme-fill-hover)] max-w-[220px]"
    style={{ borderColor: "var(--theme-border)", backgroundColor: "var(--theme-bg-app)", color: "var(--theme-text)" }}
  >
    {icon && <span className="flex shrink-0" style={{ color: "var(--theme-text-muted)" }}>{icon}</span>}
    <span className="truncate">{children}</span>
  </button>
);

export const SolidPill: React.FC<{ onClick?: () => void; icon?: React.ReactNode; children: React.ReactNode }> = ({
  onClick,
  icon,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="h-8 px-3.5 rounded-2xl flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap shrink-0 transition hover:bg-[var(--theme-primary-hover)]"
    style={{ backgroundColor: "var(--theme-primary)", color: "var(--theme-primary-text)" }}
  >
    {icon}
    {children}
  </button>
);

// ---------- Modal shell (Figma modal 06/07/08/12) ----------

export const ModalFrame: React.FC<{
  width: number;
  icon?: React.ReactNode;
  title: string;
  subtitle: string;
  onClose: () => void;
  footer: React.ReactNode;
  footerJustify?: "end" | "between";
  children: React.ReactNode;
}> = ({ width, icon, title, subtitle, onClose, footer, footerJustify = "end", children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      style={{ backgroundColor: "color-mix(in srgb, var(--theme-text) 45%, transparent)" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          maxWidth: width,
          backgroundColor: "var(--theme-bg-app)",
          color: "var(--theme-text)",
          boxShadow: "0 2px 6px rgba(20, 26, 46, 0.08), 0 24px 48px rgba(20, 26, 46, 0.2)",
        }}
      >
        <div className="px-6 pt-5 pb-4 flex items-start gap-3 shrink-0">
          {icon && (
            <span
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "var(--theme-selected)", color: "var(--theme-accent)" }}
            >
              {icon}
            </span>
          )}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <h2 className="text-lg font-bold leading-6 truncate">{title}</h2>
            <p className="text-[13px] leading-[18px]" style={{ color: "var(--theme-text-muted)" }}>
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition hover:bg-[var(--theme-fill-hover)]"
            style={{ color: "var(--theme-text-muted)" }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 pb-5 flex flex-col gap-4 overflow-y-auto">{children}</div>
        <div
          className={`px-6 py-4 border-t flex items-center gap-2 shrink-0 ${footerJustify === "between" ? "" : "justify-end"}`}
          style={{ backgroundColor: "var(--theme-bg-surface)", borderColor: "var(--theme-border)" }}
        >
          {footer}
        </div>
      </div>
    </div>
  );
};

export const FieldLabel: React.FC<{ children: React.ReactNode; optional?: boolean }> = ({ children, optional }) => (
  <div className="flex items-center gap-1.5">
    <span className="text-[13px] font-semibold" style={{ color: "var(--theme-text)" }}>
      {children}
    </span>
    {optional && (
      <span className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
        Optional
      </span>
    )}
  </div>
);

export const inputClass =
  "w-full h-10 px-3 rounded-[10px] border text-sm outline-none transition focus:border-[1.5px] focus:border-[var(--theme-primary)] placeholder:text-[var(--theme-text-muted)]";
export const inputStyle: React.CSSProperties = {
  borderColor: "var(--theme-border)",
  backgroundColor: "var(--theme-bg-app)",
  color: "var(--theme-text)",
};

export const SecondaryButton: React.FC<{
  onClick?: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ onClick, icon, children, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="h-9 px-4 rounded-[10px] border flex items-center gap-1.5 text-sm font-semibold transition hover:bg-[var(--theme-fill-hover)] disabled:opacity-50"
    style={{ borderColor: "var(--theme-border)", backgroundColor: "var(--theme-bg-app)", color: "var(--theme-text)" }}
  >
    {icon && <span className="flex" style={{ color: "var(--theme-text-muted)" }}>{icon}</span>}
    {children}
  </button>
);

export const PrimaryButton: React.FC<{
  onClick?: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
}> = ({ onClick, icon, children, disabled, type = "button" }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className="h-9 px-4 rounded-[10px] flex items-center gap-1.5 text-sm font-semibold transition hover:bg-[var(--theme-primary-hover)] disabled:opacity-50"
    style={{ backgroundColor: "var(--theme-primary)", color: "var(--theme-primary-text)" }}
  >
    {icon}
    {children}
  </button>
);

export const RadioCard: React.FC<{
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ selected, onSelect, icon, title, description }) => (
  <button
    type="button"
    onClick={onSelect}
    className="w-full p-3 rounded-xl flex items-center gap-3 text-left transition"
    style={{
      border: selected ? "1.5px solid var(--theme-primary)" : "1px solid var(--theme-border)",
      backgroundColor: selected ? "var(--theme-bg-surface)" : "var(--theme-bg-app)",
    }}
  >
    <span
      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
      style={{
        backgroundColor: selected ? "var(--theme-selected)" : "var(--theme-bg-surface-hover)",
        color: selected ? "var(--theme-accent)" : "var(--theme-text-muted)",
      }}
    >
      {icon}
    </span>
    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
      <span className="text-sm font-semibold" style={{ color: "var(--theme-text)" }}>
        {title}
      </span>
      <span className="text-[13px]" style={{ color: "var(--theme-text-muted)" }}>
        {description}
      </span>
    </span>
    <span
      className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0"
      style={
        selected
          ? { backgroundColor: "var(--theme-primary)" }
          : { border: "1.5px solid color-mix(in srgb, var(--theme-text) 20%, transparent)", backgroundColor: "var(--theme-bg-app)" }
      }
    >
      {selected && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--theme-primary-text)" }} />}
    </span>
  </button>
);

// Select-like trigger used by "Link to" fields and permission menus
export const SelectTrigger: React.FC<{
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  placeholder?: boolean;
}> = ({ onClick, icon, label, placeholder }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full h-10 px-3 rounded-[10px] border flex items-center gap-2 text-left transition hover:bg-[var(--theme-fill-hover)]"
    style={{ borderColor: "var(--theme-border)", backgroundColor: "var(--theme-bg-app)" }}
  >
    {icon && <span className="flex shrink-0" style={{ color: "var(--theme-text-muted)" }}>{icon}</span>}
    <span
      className="flex-1 truncate text-sm"
      style={{ color: placeholder ? "var(--theme-text-muted)" : "var(--theme-text)" }}
    >
      {label}
    </span>
    <ChevronDown size={16} style={{ color: "var(--theme-text-muted)" }} />
  </button>
);

export const PermissionButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="h-8 px-2.5 rounded-lg border flex items-center gap-1 text-[13px] font-semibold whitespace-nowrap transition hover:bg-[var(--theme-fill-hover)]"
    style={{ borderColor: "var(--theme-border)", backgroundColor: "var(--theme-bg-app)", color: "var(--theme-text)" }}
  >
    {label}
    <ChevronDown size={14} style={{ color: "var(--theme-text-muted)" }} />
  </button>
);

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs font-semibold" style={{ color: "var(--theme-text-muted)" }}>
    {children}
  </p>
);
