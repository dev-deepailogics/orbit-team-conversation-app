'use client';

import React from 'react';
import { Workspace } from '@orbit/types';
import { SettingsDialog, SettingsDialogProps, SettingsSection } from '../settings/SettingsDialog';

const SECTION_FOR_TAB = {
  presets: 'theme-presets',
  custom: 'theme-custom',
  general: 'general',
  profile: 'profile',
} as const satisfies Record<string, SettingsSection>;

interface ThemeModalProps extends Pick<SettingsDialogProps, 'onSignOut'> {
  isOpen: boolean;
  onClose: () => void;
  workspace?: Workspace | null;
  isAdminOrOwner?: boolean;
  initialTab?: 'presets' | 'custom' | 'general' | 'profile';
}

export const ThemeModal: React.FC<ThemeModalProps> = ({ isOpen, initialTab = 'presets', ...rest }) =>
  isOpen ? <SettingsDialog initialSection={SECTION_FOR_TAB[initialTab]} {...rest} /> : null;
