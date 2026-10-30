import { useAuthStore } from '@/features/auth/store';
import { useWorkspaceStore } from '@/features/workspaces/store';
import { channelLabel, channelPrefix, isDirect } from '@/features/workspaces/utils';
import { useCallStore } from '../store';

// "# general" for channels, the other people's names for DMs (the server's DM names are "dm-xxxx").
export function useCallTitle(): string {
  const call = useCallStore(s => s.call);
  const myId = useAuthStore(s => s.user?.id);
  const channel = useWorkspaceStore(s => s.current?.channels.find(c => c.id === call?.channelId));
  if (!channel) return call ? `# ${call.channelName}` : '';
  const label = channelLabel(channel, myId);
  return isDirect(channel) ? label : `${channelPrefix(channel)} ${label}`;
}
