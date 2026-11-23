'use client';

import React from 'react';
import { Workspace } from '@orbit/types';
import { ArrowDownAZ, Check, Clock } from '@/components/ui/icons';
import { SidebarSort, useSidebarSort, useSidebarSortStore } from '../../stores/sidebarSortStore';
import { Card, CardTitle, PageHeader } from './ui';

const OPTIONS: { value: SidebarSort; icon: React.ReactNode; title: string; subtitle: string }[] = [
  {
    value: 'recent',
    icon: <Clock size={18} />,
    title: 'Recent activity',
    subtitle: 'Conversations with the newest messages first',
  },
  {
    value: 'alphabetical',
    icon: <ArrowDownAZ size={18} />,
    title: 'Alphabetical',
    subtitle: 'Channels, groups and people from A to Z',
  },
];

export const SidebarSettings: React.FC<{ workspace: Workspace }> = ({ workspace }) => {
  const sort = useSidebarSort(workspace.id);
  const setSort = useSidebarSortStore((s) => s.setSort);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader title="Sidebar" subtitle={`How conversations are ordered in ${workspace.name}`} />
      <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 flex flex-col gap-4" style={{ backgroundColor: 'var(--theme-bg-surface)' }}>
        <Card>
          <CardTitle
            title="Sort channels and direct messages"
            subtitle="Unread conversations always move to the top until you read them. Pinned ones stay above everything."
          />
          <div role="radiogroup" aria-label="Sidebar sort order" className="flex flex-col gap-2">
            {OPTIONS.map((o) => {
              const active = sort === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSort(workspace.id, o.value)}
                  className="w-full rounded-xl border p-3 flex items-center gap-3 text-left transition hover:bg-[var(--theme-fill-hover)]"
                  style={{
                    backgroundColor: active ? 'var(--theme-selected)' : 'var(--theme-bg-surface)',
                    borderColor: active ? 'var(--theme-primary)' : 'var(--theme-border)',
                  }}
                >
                  <span
                    className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'var(--theme-bg-app)', color: active ? 'var(--theme-primary)' : 'var(--theme-text-muted)' }}
                  >
                    {o.icon}
                  </span>
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--theme-text)' }}>
                      {o.title}
                    </span>
                    <span className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
                      {o.subtitle}
                    </span>
                  </span>
                  {active && <Check size={18} style={{ color: 'var(--theme-primary)' }} />}
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};
