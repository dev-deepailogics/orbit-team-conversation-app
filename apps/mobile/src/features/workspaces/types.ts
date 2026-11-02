import type { Channel, Workspace, WorkspaceMember } from '@orbit/types';

// GET /api/workspaces/:id — channels are public ones plus private/DMs the caller belongs to.
export interface WorkspaceDetail extends Workspace {
  inviteCode: string;
  channels: Channel[];
  members: WorkspaceMember[];
}
