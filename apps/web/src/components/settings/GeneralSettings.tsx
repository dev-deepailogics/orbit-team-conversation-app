'use client';

import React from 'react';
import { usePrefsStore } from '../../stores/prefsStore';
import { Card, CardTitle, PageHeader } from './ui';

const SHORTCUTS: { label: string; hint: string; keys: string[][] }[] = [
  { label: 'Search Orbit', hint: 'Search messages, files and people', keys: [['Ctrl', 'K']] },
  {
    label: 'Quick to-dos',
    hint: 'Opens the panel with the cursor in the input, ready to type. Press again to close',
    keys: [['Ctrl', 'Shift', 'Space'], ['Alt', 'T']],
  },
  {
    label: 'Back / forward',
    hint: 'Step through the conversations you opened recently (Cmd [ and Cmd ] on a Mac)',
    keys: [['Alt', '←'], ['Alt', '→']],
  },
  { label: 'Close panels and dialogs', hint: 'Dismiss the quick to-dos panel, search and dialogs', keys: [['Esc']] },
];

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd
    className="px-1.5 min-w-[24px] h-6 inline-flex items-center justify-center rounded-md border text-[11px] font-semibold font-sans"
    style={{
      backgroundColor: 'var(--theme-bg-surface)',
      borderColor: 'color-mix(in srgb, var(--theme-text) 20%, transparent)',
      color: 'var(--theme-text)',
    }}
  >
    {children}
  </kbd>
);

export const GeneralSettings: React.FC = () => {
  const showTodoButton = usePrefsStore((s) => s.showTodoButton);
  const setShowTodoButton = usePrefsStore((s) => s.setShowTodoButton);
  const todoPos = usePrefsStore((s) => s.todoPos);
  const setTodoPos = usePrefsStore((s) => s.setTodoPos);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader title="Shortcuts & quick to-dos" subtitle="Keyboard shortcuts and the floating to-do button" />
      <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 flex flex-col gap-4">
        <Card>
          <CardTitle title="Quick to-dos button" subtitle="A draggable button that opens your personal to-do list" />
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>
                Show floating button
              </span>
              <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                The keyboard shortcut works even when the button is hidden.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showTodoButton}
              aria-label="Show quick to-dos floating button"
              onClick={() => setShowTodoButton(!showTodoButton)}
              className="relative w-11 h-6 rounded-full shrink-0 transition-colors"
              style={{ backgroundColor: showTodoButton ? 'var(--theme-primary)' : 'var(--theme-border)' }}
            >
              <span
                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                style={{ transform: showTodoButton ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </div>
          {todoPos && (
            <button
              type="button"
              onClick={() => setTodoPos(null)}
              className="self-start text-xs font-semibold hover:underline"
              style={{ color: 'var(--theme-primary)' }}
            >
              Reset button position
            </button>
          )}
        </Card>

        <Card>
          <CardTitle title="Keyboard shortcuts" subtitle="Use Cmd instead of Ctrl on a Mac" />
          <div className="flex flex-col">
            {SHORTCUTS.map((s, i) => (
              <div
                key={s.label}
                className={`flex items-center justify-between gap-4 py-3 ${i ? 'border-t' : ''}`}
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>
                    {s.label}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                    {s.hint}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {s.keys.map((combo, ci) => (
                    <span key={ci} className="flex items-center gap-1">
                      {combo.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
