'use client';

import React, { useState, useEffect } from 'react';
import { BotApp, Workspace } from '@orbit/types';
import { Bot, Copy, Check, Plus, Code, Terminal, Sparkles, X } from 'lucide-react';
import { api } from '../../lib/api';

interface BotPortalDialogProps {
  workspace: Workspace;
  onClose: () => void;
}

export const BotPortalDialog: React.FC<BotPortalDialogProps> = ({ workspace, onClose }) => {
  const [bots, setBots] = useState<BotApp[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchBots();
  }, [workspace.id]);

  const fetchBots = async () => {
    try {
      const res = await api.get(`/api/bot/workspaces/${workspace.id}/bots`);
      setBots(res.data);
    } catch (err) {
      console.error('Failed to fetch bots', err);
    }
  };

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      const res = await api.post(`/api/bot/workspaces/${workspace.id}/bots`, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setBots([res.data, ...bots]);
      setName('');
      setDescription('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create bot');
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2.5 sm:p-6">
      <div className="bg-[var(--theme-bg-app)] border border-[var(--theme-border)] rounded-2xl w-full max-w-3xl max-h-[92vh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-14 border-b border-[var(--theme-border)] px-3.5 sm:px-6 flex items-center justify-between bg-[var(--theme-bg-surface)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slack-activeChannel/20 rounded-lg text-slack-activeChannel">
              <Bot size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--theme-text)] leading-tight">
                Bot & App Integrations Portal
              </h2>
              <p className="text-[11px] text-[var(--theme-text-muted)]">
                Manage bot tokens and automate {workspace.name} with custom APIs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface)] rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6">
          {/* Create New Bot Card */}
          <div className="bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-xl p-5">
            <h3 className="text-sm font-bold text-[var(--theme-text)] mb-1 flex items-center gap-1.5">
              <Plus size={16} className="text-slack-green" />
              Create a New Bot App
            </h3>
            <p className="text-xs text-[var(--theme-text-muted)] mb-4">
              Bots receive a unique <code>xoxb-...</code> Bearer token to post messages and respond to slash commands.
            </p>

            <form onSubmit={handleCreateBot} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--theme-text)] mb-1">Bot Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DeployBot, CI-Notifier"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[var(--theme-bg-app)] border border-[var(--theme-border)] rounded-lg px-3 py-2 text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-slack-activeChannel"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--theme-text)] mb-1">Description (optional)</label>
                  <input
                    type="text"
                    placeholder="Sends GitHub PR and deployment notifications"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-[var(--theme-bg-app)] border border-[var(--theme-border)] rounded-lg px-3 py-2 text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-slack-activeChannel"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isCreating || !name.trim()}
                  className="px-4 py-2 bg-slack-green hover:bg-[#008a65] text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {isCreating ? 'Generating Token...' : 'Create Bot & Generate Token'}
                </button>
              </div>
            </form>
          </div>

          {/* Installed Bots List */}
          <div>
            <h3 className="text-sm font-bold text-[var(--theme-text)] mb-3">Active Bot Apps ({bots.length})</h3>

            {bots.length === 0 ? (
              <p className="text-xs text-[var(--theme-text-muted)] italic">No bots configured yet in this workspace.</p>
            ) : (
              <div className="space-y-3">
                {bots.map((bot) => (
                  <div
                    key={bot.id}
                    className="bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={bot.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${bot.name}`}
                        alt={bot.name}
                        className="w-10 h-10 rounded-lg bg-[var(--theme-bg-surface)]"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[var(--theme-text)]">{bot.name}</span>
                          <span className="text-[10px] bg-slack-green/20 text-slack-green border border-slack-green/30 px-1.5 py-0.5 rounded font-semibold">
                            ACTIVE
                          </span>
                        </div>
                        {bot.description && (
                          <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">{bot.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <div className="bg-[var(--theme-bg-app)] border border-[var(--theme-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--theme-text)] font-mono flex items-center justify-between gap-2 max-w-xs truncate">
                        <span className="truncate">{bot.botToken}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(bot.botToken)}
                        title="Copy Bot Token"
                        className="p-2 bg-[var(--theme-bg-app)] hover:bg-[var(--theme-bg-surface-hover)] text-[var(--theme-text)] hover:text-[var(--theme-text)] rounded-lg border border-[var(--theme-border)] transition shrink-0"
                      >
                        {copiedToken === bot.botToken ? <Check size={14} className="text-slack-green" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick cURL Integration Example */}
          <div className="bg-[var(--theme-bg-app)] border border-[var(--theme-border)] rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--theme-text)] mb-2">
              <Terminal size={15} className="text-blue-600 dark:text-blue-400" />
              <span>API Integration Example (POST to Channel)</span>
            </div>
            <pre className="text-[11px] font-mono text-[var(--theme-text)] bg-black/60 p-3 rounded-lg overflow-x-auto">
{`curl -X POST "${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000'}/api/bot/chat.postMessage" \\
  -H "Authorization: Bearer xoxb-YOUR_BOT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"channelId": "YOUR_CHANNEL_ID", "text": "🚀 Build #42 successfully deployed to production!"}'`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
