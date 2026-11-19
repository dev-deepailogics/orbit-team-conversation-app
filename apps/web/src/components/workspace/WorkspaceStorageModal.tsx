'use client';

import React from 'react';
import { UserProfile, Workspace } from '@orbit/types';
import { SettingsDialog, SettingsDialogProps } from '../settings/SettingsDialog';

interface WorkspaceStorageModalProps extends Pick<SettingsDialogProps, 'isAdminOrOwner' | 'onOpenProfile' | 'onSignOut'> {
  workspace: Workspace;
  currentUser: UserProfile | null;
  onClose: () => void;
  onFileDeleted?: (fileId: string) => void;
}

export const WorkspaceStorageModal: React.FC<WorkspaceStorageModalProps> = (props) => (
  <SettingsDialog initialSection="storage" {...props} />
);
