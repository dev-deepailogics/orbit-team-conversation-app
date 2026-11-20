'use client';

import React from 'react';
import { Workspace } from '@orbit/types';
import { SettingsDialog, SettingsDialogProps } from '../settings/SettingsDialog';

interface ThemeModalProps extends Pick<SettingsDialogProps, 'onOpenProfile' | 'onSignOut'> {
  isOpen: boolean;
  onClose: () => void;
  workspace?: Workspace | null;
  isAdminOrOwner?: boolean;
  initialTab?: 'presets' | 'custom' | 'general';
}

export const ThemeModal: React.FC<ThemeModalProps> = ({ isOpen, initialTab = 'presets', ...rest }) =>
  isOpen ? <SettingsDialog initialSection={initialTab === 'general' ? 'general' : initialTab === 'custom' ? 'theme-custom' : 'theme-presets'} {...rest} /> : null;
