'use client';

import React, { useEffect, useState } from 'react';
import { BotApp, Workspace } from '@orbit/types';
import { Bot, Check, Copy, Eye, EyeOff, KeyRound, Plus, Shield, AlertTriangle, X } from '@/components/ui/icons';
import { api } from '../../lib/api';
import {
  Card,
  CardTitle,
  DialogButton,
  DialogFrame,
  OutlineButton,
  PageHeader,
  PrimaryButton,
  SUCCESS,
  WARNING,
  onTint,
  tint,
} from './ui';

const maskToken = (t: string) => (t.length > 9 ? `${t.slice(0, 5)}${'•'.repeat(14)}${t.slice(-4)}` : t);

export const BotSettings: React.FC<{ workspace: Workspace }> = ({ workspace }) => {
  const [bots, setBots] = useState<BotApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [created, setCreated] = useState<BotApp | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .get(`/api/bot/workspaces/${workspace.id}/bots`)
      .then((res) => alive && setBots(res.data))
      .catch((err) => console.error('Failed to fetch bots', err))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [workspace.id]);

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const curlLines = [
    { text: `curl -X POST ${origin}/api/bot/chat.postMessage \\`, color: '#E6EAFF' },
    { text: '  -H "Authorization: Bearer xoxb-your-token" \\', color: '#8FA6FF' },
    { text: '  -H "Content-Type: application/json" \\', color: '#8FA6FF' },
    { text: `  -d '{"channelId":"YOUR_CHANNEL_ID","text":"Deploy finished"}'`, color: '#7EE2B8' },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader
        title="Bot & app integrations"
        subtitle="Bots post messages and answer slash commands using a bearer token."
        actions={
          <PrimaryButton icon={<Plus size={15} />} onClick={() => setShowCreate(true)}>
            Create bot app
          </PrimaryButton>
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 flex flex-col gap-4" style={{ backgroundColor: 'var(--theme-bg-surface)' }}>
        <Card>
          <CardTitle title="Active bot apps" subtitle={loading ? 'Loading…' : `${bots.length} ${bots.length === 1 ? 'bot' : 'bots'}`} />
          {!loading && bots.length === 0 && (
            <p className="text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
              No bots in {workspace.name} yet.
            </p>
          )}
          {bots.map((bot) => (
            <div
              key={bot.id}
              className="w-full rounded-xl border p-3.5 flex flex-wrap items-center gap-3.5"
              style={{ backgroundColor: 'var(--theme-bg-surface)', borderColor: 'var(--theme-border)' }}
            >
              {bot.avatarUrl ? (
                <img src={bot.avatarUrl} alt={bot.name} className="w-11 h-11 rounded-xl object-cover shrink-0" />
              ) : (
                <span
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
                >
                  <Bot size={22} />
                </span>
              )}
              <div className="flex-1 min-w-[180px] flex flex-col gap-[3px]">
                <span className="flex items-center gap-2">
                  <span className="text-[15px] font-bold truncate" style={{ color: 'var(--theme-text)' }}>
                    {bot.name}
                  </span>
                  <span
                    className="h-[22px] px-[9px] rounded-[11px] flex items-center gap-[5px] text-[11px] font-semibold shrink-0"
                    style={
                      bot.isActive
                        ? { backgroundColor: tint(SUCCESS), color: onTint(SUCCESS) }
                        : { backgroundColor: 'var(--theme-bg-surface-hover)', color: 'var(--theme-text-muted)' }
                    }
                  >
                    {bot.isActive && <Check size={12} />}
                    {bot.isActive ? 'Active' : 'Inactive'}
                  </span>
                </span>
                {bot.description && (
                  <span className="text-[13px] truncate" style={{ color: 'var(--theme-text-muted)' }}>
                    {bot.description}
                  </span>
                )}
              </div>
              <div
                className="h-[34px] px-2.5 rounded-lg border flex items-center gap-2 max-w-full"
                style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)' }}
              >
                <KeyRound size={14} style={{ color: 'var(--theme-text-muted)' }} />
                <span className="text-xs truncate max-w-[220px]" style={{ color: 'var(--theme-text)' }}>
                  {revealed[bot.id] ? bot.botToken : maskToken(bot.botToken)}
                </span>
                <button
                  title={revealed[bot.id] ? 'Hide token' : 'Show token'}
                  onClick={() => setRevealed((r) => ({ ...r, [bot.id]: !r[bot.id] }))}
                  style={{ color: 'var(--theme-text-muted)' }}
                  className="hover:opacity-70"
                >
                  {revealed[bot.id] ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button
                  title="Copy token"
                  onClick={() => copy(bot.id, bot.botToken)}
                  style={{ color: copied === bot.id ? SUCCESS : 'var(--theme-text-muted)' }}
                  className="hover:opacity-70"
                >
                  {copied === bot.id ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
            </div>
          ))}
        </Card>

        <Card>
          <CardTitle
            title="API integration example"
            subtitle="Post a message to a channel with your bot token"
            right={
              <OutlineButton
                icon={copied === 'curl' ? <Check size={15} style={{ color: SUCCESS }} /> : <Copy size={15} />}
                onClick={() => copy('curl', curlLines.map((l) => l.text).join('\n'))}
              >
                {copied === 'curl' ? 'Copied' : 'Copy'}
              </OutlineButton>
            }
          />
          {/* Code block keeps a fixed terminal palette in every theme, like the Figma */}
          <pre
            className="w-full rounded-xl p-4 flex flex-col gap-1 overflow-x-auto text-[13px] leading-5"
            style={{ backgroundColor: '#12172B', fontFamily: "'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, monospace" }}
          >
            {curlLines.map((l) => (
              <span key={l.text} className="whitespace-pre" style={{ color: l.color }}>
                {l.text}
              </span>
            ))}
          </pre>
        </Card>

        <div
          className="w-full rounded-[14px] border p-4 flex flex-wrap items-center gap-3.5"
          style={{
            backgroundColor: 'var(--theme-bg-surface)',
            borderColor: 'color-mix(in srgb, var(--theme-primary) 40%, transparent)',
          }}
        >
          <span
            className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--theme-bg-app)', color: 'var(--theme-primary-hover)' }}
          >
            <Plus size={18} />
          </span>
          <div className="flex-1 min-w-[200px] flex flex-col gap-0.5">
            <p className="text-sm font-bold" style={{ color: 'var(--theme-primary-hover)' }}>
              Create a new bot app
            </p>
            <p className="text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
              Each bot gets a unique token starting with xoxb-, shown once after creation.
            </p>
          </div>
          <PrimaryButton onClick={() => setShowCreate(true)}>Create bot app</PrimaryButton>
        </div>
      </div>

      {showCreate && (
        <CreateBotDialog
          workspace={workspace}
          onClose={() => setShowCreate(false)}
          onCreated={(bot) => {
            setBots((prev) => [bot, ...prev]);
            setShowCreate(false);
            setCreated(bot);
          }}
        />
      )}
      {created && <BotCreatedDialog bot={created} onClose={() => setCreated(null)} />}
    </div>
  );
};

const CreateBotDialog: React.FC<{ workspace: Workspace; onClose: () => void; onCreated: (bot: BotApp) => void }> = ({
  workspace,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post(`/api/bot/workspaces/${workspace.id}/bots`, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onCreated(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create bot');
    } finally {
      setSaving(false);
    }
  };

  const inputBase = 'w-full rounded-[10px] px-3 text-sm outline-none placeholder:text-[var(--theme-text-muted)]';
  return (
    <DialogFrame
      width={560}
      onClose={onClose}
      icon={<Bot size={20} />}
      title="Create a new bot app"
      subtitle="Bots post messages and respond to slash commands."
      closeIcon={<X size={18} />}
      footer={
        <>
          <DialogButton type="button" onClick={onClose}>
            Cancel
          </DialogButton>
          <DialogButton primary type="button" disabled={!name.trim() || saving} onClick={() => submit()}>
            {saving ? 'Creating…' : 'Create bot'}
          </DialogButton>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold" style={{ color: 'var(--theme-text)' }}>
            Bot name
          </span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="DeployBot, CI-Notifier"
            className={`${inputBase} h-10 border-[1.5px] focus:border-[var(--theme-primary)]`}
            style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold" style={{ color: 'var(--theme-text)' }}>
              Description
            </span>
            <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              Optional
            </span>
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this bot do?"
            className={`${inputBase} h-[88px] py-2.5 leading-5 border resize-none focus:border-[var(--theme-primary)]`}
            style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
          />
        </label>
        <div className="rounded-xl p-3 flex items-start gap-2.5" style={{ backgroundColor: 'var(--theme-bg-surface)' }}>
          <Shield size={18} style={{ color: 'var(--theme-primary-hover)' }} />
          <p className="flex-1 text-[13px] leading-[19px]" style={{ color: 'var(--theme-text)' }}>
            Each bot gets a unique Bearer token that starts with xoxb-. You will see it once after the bot is created.
          </p>
        </div>
        {error && (
          <p className="text-[13px]" style={{ color: '#DC2626' }}>
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </DialogFrame>
  );
};

const BotCreatedDialog: React.FC<{ bot: BotApp; onClose: () => void }> = ({ bot, onClose }) => {
  const [copied, setCopied] = useState(false);
  return (
    <DialogFrame
      width={560}
      onClose={onClose}
      icon={<Bot size={20} />}
      title="Bot created"
      subtitle={`Use this token to post messages as ${bot.name}.`}
      closeIcon={<X size={18} />}
      footer={
        <DialogButton primary type="button" onClick={onClose}>
          Done
        </DialogButton>
      }
    >
      <div className="rounded-xl p-3 flex items-center gap-2.5" style={{ backgroundColor: tint(SUCCESS), color: onTint(SUCCESS, 80) }}>
        <Check size={18} />
        <p className="text-sm font-semibold">{bot.name} was created.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold" style={{ color: 'var(--theme-text)' }}>
          Bearer token
        </span>
        <div
          className="h-11 px-3 rounded-[10px] border flex items-center gap-2"
          style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)' }}
        >
          <span className="flex-1 min-w-0 truncate text-sm" style={{ color: 'var(--theme-text)' }}>
            {bot.botToken}
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(bot.botToken);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="h-7 px-2.5 rounded-lg border flex items-center gap-1.5 text-[13px] font-semibold shrink-0 transition hover:bg-[var(--theme-fill-hover)]"
            style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)', color: copied ? SUCCESS : 'var(--theme-text)' }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <div className="rounded-xl p-3 flex items-start gap-2.5" style={{ backgroundColor: tint(WARNING), color: onTint(WARNING, 45) }}>
        <AlertTriangle size={18} style={{ color: WARNING }} />
        <p className="flex-1 text-[13px] leading-[19px]">Copy this token now. For security, it will not be shown again.</p>
      </div>
    </DialogFrame>
  );
};
