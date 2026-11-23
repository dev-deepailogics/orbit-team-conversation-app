'use client';

import React from 'react';
import { UserProfile, Workspace } from '@orbit/types';
import { SettingsDialog, SettingsDialogProps } from '../settings/SettingsDialog';

interface AddWorkspaceMemberDialogProps extends Pick<SettingsDialogProps, 'isAdminOrOwner' | 'onSignOut'> {
  workspace: Workspace;
  currentUser: UserProfile | null;
  onClose: () => void;
  onMemberAdded?: () => void;
}

export const AddWorkspaceMemberDialog: React.FC<AddWorkspaceMemberDialogProps> = (props) => (
  <SettingsDialog initialSection="invite" {...props} />
);
