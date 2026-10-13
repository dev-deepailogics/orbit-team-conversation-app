'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  RotateCcw,
  Sparkles,
  Sliders,
  Palette,
  Loader2,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import { ThemeConfig, Workspace } from '@orbit/types';
import { THEME_PRESETS, DEFAULT_THEME, applyTheme } from '../../lib/theme';
import { useThemeStore } from '../../stores/themeStore';

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace?: Workspace | null;
  isAdminOrOwner?: boolean;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({
  isOpen,
  onClose,
  workspace,
  isAdminOrOwner = false,
}) => {
  const { currentTheme, setTheme } = useThemeStore();
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');

  // Working theme draft
  const [draftTheme, setDraftTheme] = useState<ThemeConfig>(currentTheme);
  const [initialTheme] = useState<ThemeConfig>(currentTheme);
  const [isSaving, setIsSaving] = useState(false);
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraftTheme(currentTheme);
      setSavedSuccess(false);
    }
  }, [isOpen, currentTheme]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: ThemeConfig) => {
    setDraftTheme(preset);
    applyTheme(preset); // Live interactive preview on entire screen
  };

  const handleCustomColorChange = (key: keyof ThemeConfig, value: string) => {
    const updated = {
      ...draftTheme,
      id: 'custom',
      name: 'Custom Theme',
      [key]: value,
    };
    setDraftTheme(updated);
    applyTheme(updated); // Live preview
  };

  const handleResetToDefault = () => {
    setDraftTheme(DEFAULT_THEME);
    applyTheme(DEFAULT_THEME);
  };

  const handleClose = () => {
    // Revert to currentTheme if closed without saving
    applyTheme(currentTheme);
    onClose();
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setTheme(draftTheme, workspace?.id, true, setAsDefault);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Failed to save theme', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-3xl rounded-2xl border shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: draftTheme.surfaceColor || '#222529',
          borderColor: draftTheme.borderColor || '#383F45',
          color: draftTheme.textColor || '#FFFFFF',
        }}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{
            borderColor: draftTheme.borderColor || '#383F45',
            backgroundColor: draftTheme.workspaceColor || '#19171D',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md"
              style={{ backgroundColor: draftTheme.primaryColor }}
            >
              <Palette size={20} style={{ color: draftTheme.primaryTextColor || '#FFF' }} />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2" style={{ color: draftTheme.textColor || '#FFF' }}>
                <span>Theme & Appearance</span>
                <span
                  className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${draftTheme.primaryColor}25`,
                    color: draftTheme.primaryColor,
                    border: `1px solid ${draftTheme.primaryColor}40`,
                  }}
                >
                  {draftTheme.name}
                </span>
              </h2>
              <p className="text-xs mt-0.5" style={{ color: draftTheme.textMutedColor || '#9CA3AF' }}>
                Customize your color scheme with presets or individual color controls
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{ color: draftTheme.textMutedColor || '#9CA3AF' }}
            className="p-1.5 rounded-lg hover:opacity-80 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          className="flex items-center px-5 pt-3 border-b gap-3"
          style={{ borderColor: draftTheme.borderColor || '#383F45' }}
        >
          <button
            onClick={() => setActiveTab('presets')}
            className={`flex items-center gap-1.5 pb-2.5 px-1 text-xs font-semibold border-b-2 transition ${
              activeTab === 'presets'
                ? 'border-b-2'
                : 'hover:opacity-80 border-transparent'
            }`}
            style={{
              borderColor: activeTab === 'presets' ? draftTheme.primaryColor : 'transparent',
              color: activeTab === 'presets' ? (draftTheme.textColor || '#FFF') : (draftTheme.textMutedColor || '#9CA3AF'),
            }}
          >
            <Sparkles size={14} />
            <span>Preset Themes</span>
          </button>

          <button
            onClick={() => setActiveTab('custom')}
            className={`flex items-center gap-1.5 pb-2.5 px-1 text-xs font-semibold border-b-2 transition ${
              activeTab === 'custom'
                ? 'border-b-2'
                : 'hover:opacity-80 border-transparent'
            }`}
            style={{
              borderColor: activeTab === 'custom' ? draftTheme.primaryColor : 'transparent',
              color: activeTab === 'custom' ? (draftTheme.textColor || '#FFF') : (draftTheme.textMutedColor || '#9CA3AF'),
            }}
          >
            <Sliders size={14} />
            <span>Custom Colors</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Live Mini Preview Box */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Eye size={13} />
                <span>Live Preview</span>
              </span>
              <span className="text-[11px] text-gray-400">
                (Colors update live across the entire interface as you click)
              </span>
            </div>

            <div
              className="rounded-xl border overflow-hidden shadow-inner flex h-36 select-none"
              style={{
                borderColor: draftTheme.borderColor,
                backgroundColor: draftTheme.backgroundColor,
              }}
            >
              {/* Mini Workspace bar */}
              <div
                className="w-10 border-r flex flex-col items-center py-2 gap-2"
                style={{
                  backgroundColor: draftTheme.workspaceColor,
                  borderColor: draftTheme.borderColor,
                }}
              >
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shadow"
                  style={{
                    backgroundColor: draftTheme.primaryColor,
                    color: draftTheme.primaryTextColor || '#FFF',
                  }}
                >
                  O
                </div>
                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-[9px] text-gray-400">
                  +
                </div>
              </div>

              {/* Mini Channels sidebar */}
              <div
                className="w-36 border-r flex flex-col p-2 space-y-1.5"
                style={{
                  backgroundColor: draftTheme.sidebarColor,
                  borderColor: draftTheme.borderColor,
                }}
              >
                <div
                  className="text-[11px] font-bold truncate pb-1 border-b"
                  style={{
                    color: draftTheme.textColor,
                    borderColor: draftTheme.borderColor,
                  }}
                >
                  {workspace?.name || 'Workspace'}
                </div>
                <div
                  className="px-2 py-1 rounded text-[10px] font-medium flex items-center justify-between"
                  style={{
                    backgroundColor: `${draftTheme.primaryColor}30`,
                    color: draftTheme.primaryColor,
                    border: `1px solid ${draftTheme.primaryColor}50`,
                  }}
                >
                  <span># general</span>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: draftTheme.primaryColor }} />
                </div>
                <div
                  className="px-2 py-1 rounded text-[10px] hover:bg-white/5"
                  style={{ color: draftTheme.textMutedColor }}
                >
                  # announcements
                </div>
                <div
                  className="px-2 py-1 rounded text-[10px] hover:bg-white/5"
                  style={{ color: draftTheme.textMutedColor }}
                >
                  # random
                </div>
              </div>

              {/* Mini Chat View */}
              <div
                className="flex-1 flex flex-col justify-between p-3"
                style={{ backgroundColor: draftTheme.backgroundColor }}
              >
                <div className="space-y-2">
                  <div
                    className="p-2 rounded-lg text-xs max-w-xs shadow-sm flex items-start gap-2"
                    style={{
                      backgroundColor: draftTheme.surfaceColor,
                      borderColor: draftTheme.borderColor,
                      borderWidth: '1px',
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5"
                      style={{
                        backgroundColor: draftTheme.secondaryColor,
                        color: '#FFF',
                      }}
                    >
                      A
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold" style={{ color: draftTheme.textColor }}>
                        Alex Chen
                      </div>
                      <div className="text-[10px]" style={{ color: draftTheme.textMutedColor }}>
                        Theme looks fantastic!
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mini composer */}
                <div
                  className="p-1.5 rounded-lg flex items-center justify-between border"
                  style={{
                    backgroundColor: draftTheme.surfaceColor,
                    borderColor: draftTheme.borderColor,
                  }}
                >
                  <span className="text-[10px]" style={{ color: draftTheme.textMutedColor }}>
                    Message #general...
                  </span>
                  <div
                    className="px-2 py-0.5 rounded text-[10px] font-semibold"
                    style={{
                      backgroundColor: draftTheme.primaryColor,
                      color: draftTheme.primaryTextColor || '#FFF',
                    }}
                  >
                    Send
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TAB 1: PRESETS */}
          {activeTab === 'presets' && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Select a Curated Preset
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {THEME_PRESETS.map((preset) => {
                  const isSelected = draftTheme.name === preset.name || draftTheme.id === preset.id;
                  return (
                    <button
                      key={preset.id || preset.name}
                      onClick={() => handleSelectPreset(preset)}
                      className={`group relative p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between hover:scale-[1.02] ${
                        isSelected
                          ? 'ring-2 shadow-lg'
                          : 'hover:border-gray-500'
                      }`}
                      style={{
                        backgroundColor: preset.surfaceColor,
                        borderColor: isSelected ? preset.primaryColor : preset.borderColor,
                      }}
                    >
                      {/* Selected check badge */}
                      {isSelected && (
                        <div
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow"
                          style={{
                            backgroundColor: preset.primaryColor,
                            color: preset.primaryTextColor || '#FFF',
                          }}
                        >
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}

                      {/* Swatch Previews */}
                      <div className="space-y-1.5 mb-2.5">
                        <div className="flex h-5 w-full rounded overflow-hidden shadow-xs border border-white/10">
                          <div className="w-1/4 h-full" style={{ backgroundColor: preset.workspaceColor }} />
                          <div className="w-2/4 h-full" style={{ backgroundColor: preset.sidebarColor }} />
                          <div className="w-1/4 h-full" style={{ backgroundColor: preset.backgroundColor }} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/30 shadow-xs shrink-0"
                            style={{ backgroundColor: preset.primaryColor }}
                            title="Primary Accent"
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/30 shadow-xs shrink-0"
                            style={{ backgroundColor: preset.secondaryColor }}
                            title="Secondary Accent"
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/30 shadow-xs shrink-0"
                            style={{ backgroundColor: preset.surfaceColor }}
                            title="Surface"
                          />
                        </div>
                      </div>

                      <div>
                        <span
                          className="font-bold text-xs block group-hover:underline truncate"
                          style={{ color: preset.textColor }}
                        >
                          {preset.name}
                        </span>
                        <span className="text-[10px] block truncate" style={{ color: preset.textMutedColor }}>
                          {preset.primaryColor}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOM COLOR PICKERS */}
          {activeTab === 'custom' && (
            <div className="space-y-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Fine-tune Colors
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {/* 1. Sidebar Background */}
                <div
                  className="p-3 rounded-xl border space-y-1.5"
                  style={{
                    backgroundColor: draftTheme.workspaceColor,
                    borderColor: draftTheme.borderColor,
                  }}
                >
                  <label className="text-xs font-semibold block" style={{ color: draftTheme.textColor }}>
                    Channel Sidebar
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draftTheme.sidebarColor}
                      onChange={(e) => handleCustomColorChange('sidebarColor', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={draftTheme.sidebarColor}
                      onChange={(e) => handleCustomColorChange('sidebarColor', e.target.value)}
                      className="flex-1 bg-black/40 border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono uppercase focus:outline-none focus:border-white"
                      style={{ color: draftTheme.textColor }}
                    />
                  </div>
                </div>

                {/* 2. Workspace Icon Bar */}
                <div
                  className="p-3 rounded-xl border space-y-1.5"
                  style={{
                    backgroundColor: draftTheme.workspaceColor,
                    borderColor: draftTheme.borderColor,
                  }}
                >
                  <label className="text-xs font-semibold block" style={{ color: draftTheme.textColor }}>
                    Workspace Left Bar
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draftTheme.workspaceColor}
                      onChange={(e) => handleCustomColorChange('workspaceColor', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={draftTheme.workspaceColor}
                      onChange={(e) => handleCustomColorChange('workspaceColor', e.target.value)}
                      className="flex-1 bg-black/40 border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono uppercase focus:outline-none focus:border-white"
                      style={{ color: draftTheme.textColor }}
                    />
                  </div>
                </div>

                {/* 3. Main App / Chat Background */}
                <div
                  className="p-3 rounded-xl border space-y-1.5"
                  style={{
                    backgroundColor: draftTheme.workspaceColor,
                    borderColor: draftTheme.borderColor,
                  }}
                >
                  <label className="text-xs font-semibold block" style={{ color: draftTheme.textColor }}>
                    Main Chat / View Area
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draftTheme.backgroundColor}
                      onChange={(e) => handleCustomColorChange('backgroundColor', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={draftTheme.backgroundColor}
                      onChange={(e) => handleCustomColorChange('backgroundColor', e.target.value)}
                      className="flex-1 bg-black/40 border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono uppercase focus:outline-none focus:border-white"
                      style={{ color: draftTheme.textColor }}
                    />
                  </div>
                </div>

                {/* 4. Surface / Card Color */}
                <div
                  className="p-3 rounded-xl border space-y-1.5"
                  style={{
                    backgroundColor: draftTheme.workspaceColor,
                    borderColor: draftTheme.borderColor,
                  }}
                >
                  <label className="text-xs font-semibold block" style={{ color: draftTheme.textColor }}>
                    Surface / Card Panels
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draftTheme.surfaceColor}
                      onChange={(e) => handleCustomColorChange('surfaceColor', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={draftTheme.surfaceColor}
                      onChange={(e) => handleCustomColorChange('surfaceColor', e.target.value)}
                      className="flex-1 bg-black/40 border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono uppercase focus:outline-none focus:border-white"
                      style={{ color: draftTheme.textColor }}
                    />
                  </div>
                </div>

                {/* 5. Primary Accent */}
                <div
                  className="p-3 rounded-xl border space-y-1.5"
                  style={{
                    backgroundColor: draftTheme.workspaceColor,
                    borderColor: draftTheme.borderColor,
                  }}
                >
                  <label className="text-xs font-semibold block" style={{ color: draftTheme.textColor }}>
                    Primary Accent (Buttons/Active)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draftTheme.primaryColor}
                      onChange={(e) => handleCustomColorChange('primaryColor', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={draftTheme.primaryColor}
                      onChange={(e) => handleCustomColorChange('primaryColor', e.target.value)}
                      className="flex-1 bg-black/40 border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono uppercase focus:outline-none focus:border-white"
                      style={{ color: draftTheme.textColor }}
                    />
                  </div>
                </div>

                {/* 6. Secondary Accent */}
                <div
                  className="p-3 rounded-xl border space-y-1.5"
                  style={{
                    backgroundColor: draftTheme.workspaceColor,
                    borderColor: draftTheme.borderColor,
                  }}
                >
                  <label className="text-xs font-semibold block" style={{ color: draftTheme.textColor }}>
                    Secondary Accent (Badges)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draftTheme.secondaryColor}
                      onChange={(e) => handleCustomColorChange('secondaryColor', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={draftTheme.secondaryColor}
                      onChange={(e) => handleCustomColorChange('secondaryColor', e.target.value)}
                      className="flex-1 bg-black/40 border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono uppercase focus:outline-none focus:border-white"
                      style={{ color: draftTheme.textColor }}
                    />
                  </div>
                </div>

                {/* 7. Primary Text */}
                <div
                  className="p-3 rounded-xl border space-y-1.5"
                  style={{
                    backgroundColor: draftTheme.workspaceColor,
                    borderColor: draftTheme.borderColor,
                  }}
                >
                  <label className="text-xs font-semibold block" style={{ color: draftTheme.textColor }}>
                    Primary Text Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draftTheme.textColor}
                      onChange={(e) => handleCustomColorChange('textColor', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={draftTheme.textColor}
                      onChange={(e) => handleCustomColorChange('textColor', e.target.value)}
                      className="flex-1 bg-black/40 border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono uppercase focus:outline-none focus:border-white"
                      style={{ color: draftTheme.textColor }}
                    />
                  </div>
                </div>

                {/* 8. Muted Text */}
                <div
                  className="p-3 rounded-xl border space-y-1.5"
                  style={{
                    backgroundColor: draftTheme.workspaceColor,
                    borderColor: draftTheme.borderColor,
                  }}
                >
                  <label className="text-xs font-semibold block" style={{ color: draftTheme.textColor }}>
                    Muted / Secondary Text
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draftTheme.textMutedColor}
                      onChange={(e) => handleCustomColorChange('textMutedColor', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={draftTheme.textMutedColor}
                      onChange={(e) => handleCustomColorChange('textMutedColor', e.target.value)}
                      className="flex-1 bg-black/40 border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono uppercase focus:outline-none focus:border-white"
                      style={{ color: draftTheme.textColor }}
                    />
                  </div>
                </div>

                {/* 9. Border Color */}
                <div
                  className="p-3 rounded-xl border space-y-1.5"
                  style={{
                    backgroundColor: draftTheme.workspaceColor,
                    borderColor: draftTheme.borderColor,
                  }}
                >
                  <label className="text-xs font-semibold block" style={{ color: draftTheme.textColor }}>
                    Borders & Dividers
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draftTheme.borderColor}
                      onChange={(e) => handleCustomColorChange('borderColor', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={draftTheme.borderColor}
                      onChange={(e) => handleCustomColorChange('borderColor', e.target.value)}
                      className="flex-1 bg-black/40 border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono uppercase focus:outline-none focus:border-white"
                      style={{ color: draftTheme.textColor }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Admin Option: Set as Workspace Default */}
          {isAdminOrOwner && (
            <div
              className="p-3.5 rounded-xl border flex items-center justify-between"
              style={{
                backgroundColor: draftTheme.workspaceColor,
                borderColor: draftTheme.borderColor,
              }}
            >
              <div>
                <span className="text-xs font-bold block" style={{ color: draftTheme.textColor }}>
                  Set as Workspace Default
                </span>
                <span className="text-[11px] text-gray-400 block">
                  New members who join this workspace will automatically start with this theme.
                </span>
              </div>
              <input
                type="checkbox"
                id="setAsDefault"
                checked={setAsDefault}
                onChange={(e) => setSetAsDefault(e.target.checked)}
                className="w-4 h-4 rounded text-slack-green focus:ring-0 cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="flex items-center justify-between px-5 py-3 border-t"
          style={{
            borderColor: draftTheme.borderColor,
            backgroundColor: draftTheme.workspaceColor,
          }}
        >
          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            <RotateCcw size={13} />
            <span>Reset to Default</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-gray-300 hover:text-white hover:bg-white/5 transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
              style={{
                backgroundColor: draftTheme.primaryColor,
                color: draftTheme.primaryTextColor || '#FFF',
              }}
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : savedSuccess ? (
                <>
                  <CheckCircle2 size={14} />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Theme</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
