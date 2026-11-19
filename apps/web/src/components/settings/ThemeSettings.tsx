'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ThemeConfig } from '@orbit/types';
import { Check, RotateCcw, Plus, ChevronDown, X, Send, Loader2 } from '@/components/ui/icons';
import { THEME_PRESETS, isLightColor } from '../../lib/theme';
import { OutlineButton, PageHeader, PrimaryButton, SUCCESS, WARNING, cardShadow, onTint, tint } from './ui';

export type ThemeTab = 'presets' | 'custom';

interface ThemeSettingsProps {
  tab: ThemeTab;
  onTabChange: (tab: ThemeTab) => void;
  draft: ThemeConfig;
  onDraftChange: (theme: ThemeConfig) => void;
  onReset: () => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  dirty: boolean;
  isAdminOrOwner: boolean;
  setAsDefault: boolean;
  onSetAsDefault: (v: boolean) => void;
}

// Presets modelled on other products are grouped separately, as in the Figma template page.
const INSPIRED: Record<string, string> = {
  'aubergine-classic': 'Slack-style',
  'slack-dark': 'Slack-style',
  'slack-light': 'Slack-style',
  'teams-dark': 'Teams-style',
  'teams-light': 'Teams-style',
  'clickup-light': 'ClickUp-style',
  'primer-dark': 'GitHub-style',
  'material-light': 'Material-style',
  dracula: 'Dracula-style',
};

const FONTS: { label: string; value: string | undefined }[] = [
  { label: 'Inter', value: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { label: 'Lato', value: "'Lato'" },
  { label: 'Segoe UI', value: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif" },
  { label: 'Space Grotesk', value: "'Space Grotesk', sans-serif" },
  { label: 'System default', value: undefined },
];

type ColorKey = keyof Pick<
  ThemeConfig,
  | 'backgroundColor'
  | 'sidebarColor'
  | 'workspaceColor'
  | 'surfaceColor'
  | 'borderColor'
  | 'primaryColor'
  | 'selectedColor'
  | 'secondaryColor'
  | 'accentColor'
  | 'textColor'
  | 'textMutedColor'
  | 'sectionColor'
  | 'primaryTextColor'
  | 'primaryHoverColor'
  | 'surfaceHoverColor'
>;

type Region = 'sidebar' | 'body' | 'cards' | 'header';

const COLOR_GROUPS: { label: string; items: { key: ColorKey; label: string; region?: Region }[] }[] = [
  {
    label: 'SURFACES',
    items: [
      { key: 'backgroundColor', label: 'App background', region: 'body' },
      { key: 'sidebarColor', label: 'Sidebar', region: 'sidebar' },
      { key: 'workspaceColor', label: 'Rail' },
      { key: 'surfaceColor', label: 'Cards & panels', region: 'cards' },
      { key: 'borderColor', label: 'Borders', region: 'header' },
    ],
  },
  {
    label: 'BRAND',
    items: [
      { key: 'primaryColor', label: 'Primary accent' },
      { key: 'selectedColor', label: 'Accent soft', region: 'sidebar' },
      { key: 'secondaryColor', label: 'Links' },
      { key: 'accentColor', label: 'Unread badge', region: 'sidebar' },
    ],
  },
  {
    label: 'TEXT',
    items: [
      { key: 'textColor', label: 'Body text', region: 'body' },
      { key: 'textMutedColor', label: 'Muted text', region: 'body' },
      { key: 'sectionColor', label: 'Section headers', region: 'sidebar' },
      { key: 'primaryTextColor', label: 'Text on accent' },
    ],
  },
  {
    label: 'STATES',
    items: [
      { key: 'primaryHoverColor', label: 'Primary hover' },
      { key: 'surfaceHoverColor', label: 'Hover fill' },
    ],
  },
];

const REGION_LABEL: Record<Region, string> = {
  sidebar: 'Sidebar',
  body: 'App background',
  cards: 'Cards & panels',
  header: 'Borders',
};

/** Resolved color for a key, including the derived defaults globals.css uses for optional fields. */
function colorOf(t: ThemeConfig, key: ColorKey): string {
  const v = t[key];
  if (v) return v;
  switch (key) {
    case 'selectedColor':
      return mix(t.primaryColor, t.sidebarColor, 0.16);
    case 'accentColor':
      return t.primaryColor;
    case 'sectionColor':
      return t.textMutedColor;
    case 'primaryTextColor':
      return '#FFFFFF';
    case 'primaryHoverColor':
      return t.primaryColor;
    case 'surfaceHoverColor':
      return t.surfaceColor;
    default:
      return '#000000';
  }
}

// ---------- color math ----------
const clamp = (n: number, lo = 0, hi = 255) => Math.min(hi, Math.max(lo, n));
function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}
const rgbToHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((n) => clamp(Math.round(n)).toString(16).padStart(2, '0')).join('').toUpperCase();
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max];
}
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
function mix(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return a;
  return rgbToHex(ra[0] * t + rb[0] * (1 - t), ra[1] * t + rb[1] * (1 - t), ra[2] * t + rb[2] * (1 - t));
}
const alpha = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
const sidebarText = (t: ThemeConfig) => (isLightColor(t.sidebarColor) ? t.textColor : '#FFFFFF');

// ---------- page ----------
export const ThemeSettings: React.FC<ThemeSettingsProps> = (props) => {
  const { tab, onTabChange, onReset, onSave, saving, saved, dirty, isAdminOrOwner, setAsDefault, onSetAsDefault } = props;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader
        bordered={false}
        title="Theme & appearance"
        subtitle={
          tab === 'presets'
            ? 'Choose a template for your workspace. You can fine-tune it later in Custom theme.'
            : 'Design every color and text style yourself, then save it as your own theme.'
        }
        actions={
          <>
            {isAdminOrOwner && (
              <label
                className="h-9 px-3 flex items-center gap-1.5 text-[13px] font-medium cursor-pointer select-none"
                style={{ color: 'var(--theme-text-muted)' }}
                title="New members who join this workspace start with this theme"
              >
                <input
                  type="checkbox"
                  checked={setAsDefault}
                  onChange={(e) => onSetAsDefault(e.target.checked)}
                  className="w-4 h-4 cursor-pointer"
                  style={{ accentColor: 'var(--theme-primary)' }}
                />
                Workspace default
              </label>
            )}
            <OutlineButton onClick={onReset} icon={<RotateCcw size={15} />}>
              Reset to default
            </OutlineButton>
            <PrimaryButton
              onClick={onSave}
              disabled={saving || (!dirty && !setAsDefault)}
              icon={saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            >
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save theme'}
            </PrimaryButton>
          </>
        }
      />

      {/* Tabs */}
      <div className="shrink-0 h-12 px-8 flex items-start gap-6 border-b" style={{ borderColor: 'var(--theme-border)' }}>
        {(
          [
            { id: 'presets', label: 'Theme templates' },
            { id: 'custom', label: 'Custom theme', pill: 'Fully editable' },
          ] as const
        ).map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => onTabChange(t.id)} className="h-12 flex flex-col items-center">
              <span className="h-[46px] px-1 flex items-center gap-2">
                <span
                  className={`text-sm ${active ? 'font-semibold' : 'font-medium'}`}
                  style={{ color: active ? 'var(--theme-primary-hover)' : 'var(--theme-text-muted)' }}
                >
                  {t.label}
                </span>
                {'pill' in t && (
                  <span
                    className="h-[18px] px-[7px] rounded-[9px] flex items-center text-[11px] font-semibold"
                    style={{ backgroundColor: 'var(--theme-selected)', color: 'var(--theme-primary-hover)' }}
                  >
                    {t.pill}
                  </span>
                )}
              </span>
              <span className="h-0.5 w-full" style={{ backgroundColor: active ? 'var(--theme-primary)' : 'transparent' }} />
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto" style={{ backgroundColor: 'var(--theme-bg-app)' }}>
        {tab === 'presets' ? <TemplatesBody {...props} /> : <CustomBody {...props} />}
      </div>
    </div>
  );
};

// ---------- templates ----------
const TemplatesBody: React.FC<ThemeSettingsProps> = ({ draft, onDraftChange, onTabChange }) => {
  const orbit = THEME_PRESETS.filter((p) => !INSPIRED[p.id || '']);
  const inspired = THEME_PRESETS.filter((p) => INSPIRED[p.id || '']);
  return (
    <div className="flex flex-col xl:flex-row gap-6 items-start px-8 py-6">
      <div className="flex-1 min-w-0 w-full flex flex-col gap-3">
        <GroupLabel title="Orbit themes" subtitle="Clean defaults made for Orbit" />
        <div className="grid grid-cols-2 gap-3.5">
          {orbit.map((p) => (
            <TemplateCard key={p.id} preset={p} selected={draft.id === p.id} onSelect={() => onDraftChange(p)} />
          ))}
        </div>
        <span className="h-1" />
        <GroupLabel title="Inspired by tools you know" subtitle="Familiar color schemes, no setup" />
        <div className="grid grid-cols-2 gap-3.5">
          {inspired.map((p) => (
            <TemplateCard
              key={p.id}
              preset={p}
              note={INSPIRED[p.id || '']}
              selected={draft.id === p.id}
              onSelect={() => onDraftChange(p)}
            />
          ))}
          <button
            onClick={() => onTabChange('custom')}
            className="rounded-[14px] border border-dashed p-2 flex flex-col gap-2 justify-center text-left transition hover:brightness-[0.98]"
            style={{
              backgroundColor: 'var(--theme-bg-surface)',
              borderColor: 'color-mix(in srgb, var(--theme-primary) 45%, transparent)',
            }}
          >
            <span className="h-[84px] w-full flex flex-col items-center justify-center gap-1.5">
              <span
                className="w-8 h-8 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--theme-selected)', color: 'var(--theme-primary-hover)' }}
              >
                <Plus size={16} />
              </span>
              <span className="text-[13px] font-bold" style={{ color: 'var(--theme-primary-hover)' }}>
                Build your own
              </span>
            </span>
            <span className="text-[11px] leading-[15px]" style={{ color: 'var(--theme-text-muted)' }}>
              Pick every color and text style in Custom theme
            </span>
          </button>
        </div>
      </div>
      <PreviewCard theme={draft} subtitle={draft.name} width={520} previewHeight={452} />
    </div>
  );
};

const GroupLabel: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="flex flex-col gap-0.5">
    <p className="text-[13px] font-bold" style={{ color: 'var(--theme-text)' }}>
      {title}
    </p>
    <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
      {subtitle}
    </p>
  </div>
);

const TemplateCard: React.FC<{ preset: ThemeConfig; selected: boolean; note?: string; onSelect: () => void }> = ({
  preset,
  selected,
  note,
  onSelect,
}) => (
  <button
    onClick={onSelect}
    className={`rounded-[14px] p-2 flex flex-col gap-2 text-left transition ${selected ? 'border-2' : 'border hover:brightness-[0.98]'}`}
    style={{
      backgroundColor: selected ? 'var(--theme-bg-surface)' : 'var(--theme-bg-app)',
      borderColor: selected ? 'var(--theme-primary)' : 'var(--theme-border)',
      boxShadow: cardShadow,
    }}
  >
    <ThemeThumb theme={preset} />
    <span className="w-full flex items-center justify-between gap-2 px-1 pb-0.5">
      <span className="flex flex-col gap-px min-w-0">
        <span className="text-[13px] font-bold truncate" style={{ color: 'var(--theme-text)' }}>
          {preset.name}
        </span>
        {note && (
          <span className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
            {note}
          </span>
        )}
      </span>
      {selected ? (
        <span
          className="w-5 h-5 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
        >
          <Check size={12} />
        </span>
      ) : (
        <span className="flex items-center shrink-0">
          {[preset.sidebarColor, preset.primaryColor, preset.backgroundColor].map((c, i) => (
            <span
              key={i}
              className={`w-4 h-4 rounded-lg border-2 ${i < 2 ? '-mr-1' : ''}`}
              style={{ backgroundColor: c, borderColor: 'var(--theme-bg-app)' }}
            />
          ))}
        </span>
      )}
    </span>
  </button>
);

/** Miniature app rendered from a preset's own colors (data, not the active theme). */
const ThemeThumb: React.FC<{ theme: ThemeConfig }> = ({ theme: t }) => {
  const sideText = sidebarText(t);
  const line = (top: number, w: number) => (
    <span
      className="absolute left-[10px] h-1.5 rounded-[3px]"
      style={{ top, width: w, backgroundColor: alpha(sideText, 55) }}
    />
  );
  return (
    <span className="relative block h-[84px] w-full rounded-lg overflow-hidden" style={{ backgroundColor: t.surfaceColor }}>
      <span className="absolute left-0 top-0 h-full w-[52px]" style={{ backgroundColor: t.sidebarColor }} />
      {line(12, 30)}
      <span
        className="absolute left-[10px] top-[26px] h-2 w-[34px] rounded-[3px]"
        style={{ backgroundColor: colorOf(t, 'selectedColor') }}
      />
      {line(42, 30)}
      {line(54, 22)}
      <span className="absolute left-[52px] right-0 top-0 h-[18px]" style={{ backgroundColor: t.backgroundColor }} />
      <span className="absolute left-[52px] right-0 top-[18px] h-px" style={{ backgroundColor: t.borderColor }} />
      <span className="absolute left-[66px] top-1.5 h-1.5 w-10 rounded-[3px]" style={{ backgroundColor: alpha(t.textColor, 80) }} />
      <span className="absolute left-[66px] top-[30px] h-1.5 w-[150px] max-w-[60%] rounded-[3px]" style={{ backgroundColor: alpha(t.textColor, 50) }} />
      <span className="absolute left-[66px] top-[42px] h-1.5 w-[110px] max-w-[45%] rounded-[3px]" style={{ backgroundColor: alpha(t.textColor, 35) }} />
      <span className="absolute left-[66px] top-[56px] h-4 w-12 rounded-lg" style={{ backgroundColor: t.primaryColor }} />
      <span className="absolute right-[18%] top-1.5 h-2 w-6 rounded" style={{ backgroundColor: t.primaryColor }} />
    </span>
  );
};

// ---------- custom ----------
const CustomBody: React.FC<ThemeSettingsProps> = ({ draft, onDraftChange }) => {
  const [baseName, setBaseName] = useState(draft.id === 'custom' ? 'Current theme' : draft.name);
  const [editing, setEditing] = useState<{ key: ColorKey; label: string; region?: Region; rect: DOMRect } | null>(null);
  const [showBaseMenu, setShowBaseMenu] = useState(false);

  const setColor = (key: ColorKey, value: string) =>
    onDraftChange({ ...draft, id: 'custom', name: 'My theme', [key]: value });

  const fontLabel = FONTS.find((f) => f.value === draft.fontFamily)?.label ?? (draft.fontFamily ? 'Custom' : 'System default');

  return (
    <div className="flex flex-col xl:flex-row gap-6 items-start px-8 py-5">
      <section
        className="w-full xl:w-[520px] shrink-0 xl:h-[670px] rounded-[14px] border overflow-hidden flex flex-col"
        style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)', boxShadow: '0 1px 2px rgba(20, 26, 46, 0.06)' }}
      >
        <div className="h-14 shrink-0 px-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex flex-col gap-px">
            <p className="text-[15px] font-bold" style={{ color: 'var(--theme-text)' }}>
              Colors
            </p>
            <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              Click any swatch to edit it
            </p>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowBaseMenu((v) => !v)}
              className="h-8 px-3 rounded-2xl flex items-center gap-2"
              style={{ backgroundColor: 'var(--theme-bg-surface-hover)' }}
            >
              <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                Start from
              </span>
              <span className="text-[13px] font-semibold max-w-[140px] truncate" style={{ color: 'var(--theme-text)' }}>
                {baseName}
              </span>
              <ChevronDown size={14} style={{ color: 'var(--theme-text-muted)' }} />
            </button>
            {showBaseMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowBaseMenu(false)} />
                <div
                  className="absolute right-0 top-full mt-1.5 z-50 w-56 max-h-72 overflow-y-auto rounded-xl border p-1.5"
                  style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)', boxShadow: '0 12px 16px rgba(20, 26, 46, 0.2)' }}
                >
                  {THEME_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setBaseName(p.name);
                        setShowBaseMenu(false);
                        onDraftChange({ ...p, id: 'custom', name: 'My theme' });
                      }}
                      className="w-full h-8 px-2.5 rounded-lg flex items-center gap-2 text-[13px] text-left transition hover:bg-[var(--theme-fill-hover)]"
                      style={{ color: 'var(--theme-text)' }}
                    >
                      <span className="w-3.5 h-3.5 rounded shrink-0" style={{ backgroundColor: p.sidebarColor, boxShadow: `inset -7px 0 0 ${p.primaryColor}` }} />
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-1.5">
          {COLOR_GROUPS.map((g) => (
            <React.Fragment key={g.label}>
              <div className="flex items-center gap-2 pt-2 pb-1 text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                <span className="font-bold tracking-[0.6px]">{g.label}</span>
                <span className="font-semibold">{g.items.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {g.items.map((item) => {
                  const value = colorOf(draft, item.key);
                  const open = editing?.key === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={(e) =>
                        setEditing(open ? null : { ...item, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })
                      }
                      className={`h-9 px-2 rounded-[10px] flex items-center gap-2 text-left transition ${open ? 'border-2' : 'border hover:bg-[var(--theme-fill-hover)]'}`}
                      style={{
                        backgroundColor: open ? 'var(--theme-bg-surface)' : 'var(--theme-bg-app)',
                        borderColor: open ? 'var(--theme-primary)' : 'var(--theme-border)',
                      }}
                    >
                      <span
                        className="w-[22px] h-[22px] rounded-md border shrink-0"
                        style={{ backgroundColor: value, borderColor: 'color-mix(in srgb, var(--theme-text) 15%, transparent)' }}
                      />
                      <span className="flex-1 min-w-0 truncate text-xs font-medium" style={{ color: 'var(--theme-text)' }}>
                        {item.label}
                      </span>
                      <span className="text-[11px] uppercase shrink-0" style={{ color: 'var(--theme-text-muted)' }}>
                        {value.startsWith('#') ? value.toUpperCase() : value}
                      </span>
                    </button>
                  );
                })}
              </div>
            </React.Fragment>
          ))}

          <div className="flex items-center gap-2 pt-2.5">
            <label
              className="relative flex-1 min-w-0 h-[34px] px-3 rounded-[10px] border flex items-center gap-2 cursor-pointer"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                Font
              </span>
              <span className="flex-1 min-w-0 truncate text-[13px] font-semibold" style={{ color: 'var(--theme-text)' }}>
                {fontLabel}
              </span>
              <ChevronDown size={14} style={{ color: 'var(--theme-text-muted)' }} />
              <select
                aria-label="Font"
                value={FONTS.findIndex((f) => f.value === draft.fontFamily)}
                onChange={(e) =>
                  onDraftChange({ ...draft, id: 'custom', name: 'My theme', fontFamily: FONTS[Number(e.target.value)]?.value })
                }
                className="absolute inset-0 opacity-0 cursor-pointer"
              >
                {FONTS.map((f, i) => (
                  <option key={f.label} value={i}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      <div className="flex-1 min-w-0 w-full">
        <PreviewCard
          theme={draft}
          subtitle={draft.id === 'custom' ? 'My theme · unsaved changes' : draft.name}
          previewHeight={516}
          highlight={editing?.region ? { region: editing.region, label: editing.label } : undefined}
        />
      </div>

      {editing && (
        <ColorPicker
          key={editing.key}
          label={editing.label}
          anchor={editing.rect}
          value={colorOf(draft, editing.key)}
          onCancel={() => setEditing(null)}
          onApply={(hex) => {
            setColor(editing.key, hex);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

// ---------- preview ----------
const PreviewCard: React.FC<{
  theme: ThemeConfig;
  subtitle: string;
  previewHeight: number;
  width?: number;
  highlight?: { region: Region; label: string };
}> = ({ theme: t, subtitle, previewHeight, width, highlight }) => {
  const sideText = sidebarText(t);
  const activeText = isLightColor(t.sidebarColor) ? colorOf(t, 'primaryHoverColor') : '#FFFFFF';
  const Overlay = ({ region }: { region: Region }) =>
    highlight?.region === region ? (
      <>
        <span className="pointer-events-none absolute inset-0 z-10" style={{ border: `2.5px dashed ${WARNING}` }} />
        <span
          className="pointer-events-none absolute left-[3px] bottom-[13px] z-10 h-[22px] px-2 rounded-[11px] flex items-center text-[11px] font-semibold whitespace-nowrap"
          style={{ backgroundColor: WARNING, color: '#FFFFFF' }}
        >
          {highlight.label || REGION_LABEL[region]}
        </span>
      </>
    ) : null;
  const row = (label: string, active = false, badge?: string) => (
    <span
      className="h-[26px] px-2 rounded-md flex items-center gap-1.5 text-xs"
      style={{
        backgroundColor: active ? colorOf(t, 'selectedColor') : undefined,
        color: active ? activeText : sideText,
        fontWeight: active ? 600 : 500,
      }}
    >
      <span className="truncate">{label}</span>
      {badge && (
        <span
          className="ml-auto h-4 px-[5px] rounded-lg flex items-center text-[10px] font-bold"
          style={{ backgroundColor: colorOf(t, 'accentColor'), color: colorOf(t, 'primaryTextColor') }}
        >
          {badge}
        </span>
      )}
    </span>
  );
  const sectionLabel = (label: string) => (
    <span className="pt-3 pb-1 pl-2 text-[10px] font-semibold tracking-[0.5px]" style={{ color: alpha(sideText, 65) }}>
      {label}
    </span>
  );
  return (
    <section
      className="rounded-[14px] border p-4 flex flex-col gap-3 shrink-0 w-full"
      style={{ maxWidth: width, backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)', boxShadow: cardShadow }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-[15px] font-bold" style={{ color: 'var(--theme-text)' }}>
            Live preview
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
            {subtitle}
          </p>
        </div>
        <span
          className="h-[22px] px-2 rounded-[11px] flex items-center gap-1.5 text-[11px] font-semibold shrink-0"
          style={{ backgroundColor: tint(SUCCESS), color: onTint(SUCCESS) }}
        >
          <span className="w-1.5 h-1.5 rounded-[3px]" style={{ backgroundColor: SUCCESS }} />
          Updates instantly
        </span>
      </div>

      <div
        className="relative w-full max-w-[488px] rounded-xl border overflow-hidden flex"
        style={{ height: previewHeight, borderColor: t.borderColor, backgroundColor: t.backgroundColor, fontFamily: t.fontFamily }}
      >
        <div className="relative w-[132px] shrink-0 h-full p-2.5 flex flex-col gap-0.5" style={{ backgroundColor: t.sidebarColor }}>
          <span className="flex items-center gap-1.5 pb-2">
            <span
              className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold"
              style={{ backgroundColor: t.primaryColor, color: colorOf(t, 'primaryTextColor') }}
            >
              O
            </span>
            <span className="text-[13px] font-bold" style={{ color: sideText }}>
              Orbit
            </span>
          </span>
          {row('Home')}
          {row('Threads')}
          {sectionLabel('CHANNELS')}
          {row('# social', true)}
          {row('# designers')}
          {row('# dev-team', false, '3')}
          {sectionLabel('DIRECT MESSAGES')}
          {row('Sara Khan')}
          {row('Omar Farooq')}
          <Overlay region="sidebar" />
        </div>

        <div className="relative flex-1 min-w-0 h-full flex flex-col">
          <div
            className="relative h-11 shrink-0 px-3.5 border-b flex items-center gap-2"
            style={{ backgroundColor: t.surfaceColor, borderColor: t.borderColor }}
          >
            <span className="text-sm font-bold" style={{ color: t.textColor }}>
              # social
            </span>
            <span className="text-[11px]" style={{ color: t.textMutedColor }}>
              12 members
            </span>
            <span
              className="ml-auto h-6 px-2.5 rounded-xl flex items-center text-[11px] font-semibold"
              style={{ backgroundColor: t.primaryColor, color: colorOf(t, 'primaryTextColor') }}
            >
              Invite
            </span>
            <Overlay region="header" />
          </div>
          <div className="relative flex-1 min-h-0 p-3.5 flex flex-col gap-3 overflow-hidden" style={{ backgroundColor: t.backgroundColor }}>
            {[
              { i: 'SK', bg: '#99F6E4', fg: '#0F766E', name: 'Sara Khan', time: '2h ago', text: 'Reminder that the all-hands moved to 3 PM today.' },
              { i: 'OF', bg: '#FFE6D1', fg: '#8A3B00', name: 'Omar Farooq', time: '38m ago', text: 'Staging deploy is green. Can someone verify the filters?', link: 'View KSIA-142' },
            ].map((m) => (
              <div key={m.i} className="flex items-start gap-2.5">
                <span
                  className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-semibold"
                  style={{ backgroundColor: m.bg, color: m.fg }}
                >
                  {m.i}
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs font-bold" style={{ color: t.textColor }}>
                      {m.name}
                    </span>
                    <span className="text-[11px]" style={{ color: t.textMutedColor }}>
                      {m.time}
                    </span>
                  </span>
                  <span className="text-xs leading-[17px]" style={{ color: t.textColor }}>
                    {m.text}
                  </span>
                  {m.link && (
                    <span className="text-xs font-semibold" style={{ color: t.secondaryColor }}>
                      {m.link}
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span className="flex-1 h-px" style={{ backgroundColor: alpha(t.primaryColor, 50) }} />
              <span className="text-[10px] font-bold" style={{ color: t.primaryColor }}>
                New
              </span>
            </div>
            <div className="relative rounded-[10px] border p-2.5 flex items-center gap-2" style={{ backgroundColor: t.surfaceColor, borderColor: t.borderColor }}>
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-xs font-semibold truncate" style={{ color: t.textColor }}>
                  KSIA-142 Kiosk check-in screens
                </span>
                <span className="text-[11px]" style={{ color: t.textMutedColor }}>
                  Due Nov 29
                </span>
              </span>
              <span
                className="h-5 px-2 rounded-[10px] flex items-center text-[11px] font-semibold"
                style={{ backgroundColor: alpha(WARNING, 16), color: WARNING }}
              >
                In review
              </span>
              <Overlay region="cards" />
            </div>
            <span className="flex-1" />
            <div className="h-[38px] shrink-0 rounded-[10px] border px-3 flex items-center gap-2" style={{ backgroundColor: t.surfaceColor, borderColor: t.borderColor }}>
              <span className="flex-1 text-xs" style={{ color: t.textMutedColor }}>
                Message #social
              </span>
              <span
                className="w-[26px] h-[26px] rounded-lg flex items-center justify-center"
                style={{ backgroundColor: t.primaryColor, color: colorOf(t, 'primaryTextColor') }}
              >
                <Send size={13} />
              </span>
            </div>
            <Overlay region="body" />
          </div>
        </div>
      </div>
    </section>
  );
};

// ---------- color picker ----------
const ColorPicker: React.FC<{
  label: string;
  value: string;
  anchor: DOMRect;
  onCancel: () => void;
  onApply: (hex: string) => void;
}> = ({ label, value, anchor, onCancel, onApply }) => {
  const initial = hexToRgb(value) ?? [0, 0, 0];
  const [hsv, setHsv] = useState<[number, number, number]>(() => rgbToHsv(...initial));
  const [hexInput, setHexInput] = useState(rgbToHex(...initial).slice(1));
  const rgb = hsvToRgb(...hsv).map(Math.round) as [number, number, number];
  const hex = rgbToHex(...rgb);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  useEffect(() => setHexInput(hex.slice(1)), [hex]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const swatches = useMemo(() => {
    const s = new Set<string>();
    THEME_PRESETS.forEach((p) => {
      s.add(p.sidebarColor.toUpperCase());
      s.add(p.primaryColor.toUpperCase());
    });
    return Array.from(s).slice(0, 8);
  }, []);

  const drag = (ref: React.RefObject<HTMLDivElement>, fn: (x: number, y: number) => void) => (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const update = (ev: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      fn(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)));
    };
    update(e);
    const move = (ev: PointerEvent) => update(ev);
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  const setFromRgb = (r: number, g: number, b: number) => setHsv(rgbToHsv(clamp(r), clamp(g), clamp(b)));

  const W = 268;
  const H = 372;
  const left = anchor.right + 8 + W < window.innerWidth ? anchor.right + 8 : Math.max(8, anchor.left - W - 8);
  const top = Math.min(Math.max(8, anchor.top - 40), window.innerHeight - H - 8);

  const field = (lbl: string, val: string, width: number, onChange: (v: string) => void) => (
    <label
      className="h-[34px] px-1.5 rounded-lg border flex items-center gap-1 shrink-0"
      style={{ width, borderColor: 'var(--theme-border)' }}
    >
      <span className="text-[11px] font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
        {lbl}
      </span>
      <input
        value={val}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 bg-transparent outline-none text-[13px] font-semibold uppercase"
        style={{ color: 'var(--theme-text)' }}
      />
    </label>
  );

  return (
    <>
      <div className="fixed inset-0 z-[70]" onMouseDown={onCancel} />
      <div
        data-settings-popover
        className="fixed z-[71] rounded-[14px] border p-3.5 flex flex-col gap-3"
        style={{
          left,
          top,
          width: W,
          backgroundColor: 'var(--theme-bg-app)',
          borderColor: 'var(--theme-border)',
          boxShadow: '0 16px 20px rgba(20, 26, 46, 0.22)',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="w-[18px] h-[18px] rounded-[5px]" style={{ backgroundColor: hex }} />
            <span className="text-sm font-bold" style={{ color: 'var(--theme-text)' }}>
              {label}
            </span>
          </span>
          <button onClick={onCancel} title="Close" style={{ color: 'var(--theme-text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div
          ref={svRef}
          onPointerDown={drag(svRef, (x, y) => setHsv(([h]) => [h, x, 1 - y]))}
          className="relative w-[240px] h-[140px] rounded-lg cursor-crosshair touch-none"
          style={{
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv[0]} 100% 50%))`,
          }}
        >
          <span
            className="absolute w-3.5 h-3.5 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: `${hsv[1] * 100}%`,
              top: `${(1 - hsv[2]) * 100}%`,
              backgroundColor: hex,
              boxShadow: '0 0 0 3px #FFFFFF, 0 0 0 4px rgba(0, 0, 0, 0.35)',
            }}
          />
        </div>

        <div
          ref={hueRef}
          onPointerDown={drag(hueRef, (x) => setHsv(([, s, v]) => [Math.min(359.9, x * 360), s, v]))}
          className="relative w-[240px] h-3 rounded-md cursor-pointer touch-none"
          style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
        >
          <span
            className="absolute top-1/2 w-4 h-4 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: `${(hsv[0] / 360) * 100}%`,
              backgroundColor: `hsl(${hsv[0]} 100% 50%)`,
              boxShadow: '0 0 0 3px #FFFFFF, 0 0 0 4px rgba(0, 0, 0, 0.25)',
            }}
          />
        </div>

        <div className="flex items-center gap-1.5">
          {field('HEX', hexInput, 84, (v) => {
            const clean = v.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
            setHexInput(clean);
            const parsed = hexToRgb(clean);
            if (clean.length === 6 && parsed) setFromRgb(...parsed);
          })}
          {(['R', 'G', 'B'] as const).map((c, i) =>
            field(c, String(rgb[i]), 46, (v) => {
              const n = Number(v.replace(/\D/g, '').slice(0, 3)) || 0;
              const next = [...rgb] as [number, number, number];
              next[i] = clamp(n);
              setFromRgb(...next);
            }),
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
            Recent &amp; preset colors
          </span>
          <span className="flex items-center gap-1.5">
            {swatches.map((c) => (
              <button
                key={c}
                title={c}
                onClick={() => {
                  const p = hexToRgb(c);
                  if (p) setFromRgb(...p);
                }}
                className="w-[22px] h-[22px] rounded-[11px] border"
                style={{ backgroundColor: c, borderColor: 'color-mix(in srgb, var(--theme-text) 12%, transparent)' }}
              />
            ))}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <OutlineButton className="flex-1" onClick={onCancel}>
            Cancel
          </OutlineButton>
          <PrimaryButton className="flex-1" onClick={() => onApply(hex)}>
            Apply
          </PrimaryButton>
        </div>
      </div>
    </>
  );
};
