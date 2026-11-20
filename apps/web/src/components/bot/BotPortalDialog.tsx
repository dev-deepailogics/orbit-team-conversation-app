'use client';

import React from 'react';
import { Workspace } from '@orbit/types';
import { SettingsDialog, SettingsDialogProps } from '../settings/SettingsDialog';

interface BotPortalDialogProps extends Pick<SettingsDialogProps, 'isAdminOrOwner' | 'onSignOut'> {
  workspace: Workspace;
  onClose: () => void;
}

export const BotPortalDialog: React.FC<BotPortalDialogProps> = (props) => <SettingsDialog initialSection="bots" {...props} />;
