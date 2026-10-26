import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import type { SystemRole } from '@orbit/types';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { deleteUser, resetUserPassword, updateUserRole } from '../services/adminApi';
import type { AdminUser } from '../types';
import { ROLES, ROLE_LABELS } from '../utils';
import { Sheet } from './Sheet';

interface Props {
  user: AdminUser | null;
  isSelf: boolean;
  onClose: () => void;
  // Called after any successful change so the console can refetch.
  onChanged: () => void;
}

type Busy = 'role' | 'password' | 'delete' | null;

export function UserActionsSheet({ user, isSelf, onClose, onChanged }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<Busy>(null);

  const close = () => {
    setPassword('');
    setError('');
    onClose();
  };

  // One action at a time; every action resets loading and reports its own error.
  const run = async (kind: Exclude<Busy, null>, action: () => Promise<void>, fallback: string) => {
    if (busy) return false;
    setError('');
    setBusy(kind);
    try {
      await action();
      onChanged();
      return true;
    } catch (err) {
      setError(getErrorMessage(err, fallback));
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (!user) return null;

  const handleRole = (role: SystemRole) => {
    if (role === user.systemRole) return;
    run('role', () => updateUserRole(user.id, role), 'Failed to update role');
  };

  const handleResetPassword = async () => {
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (await run('password', () => resetUserPassword(user.id, password), 'Failed to reset password')) {
      Alert.alert('Password reset', `${user.displayName} can now sign in with the new password.`);
      close();
    }
  };

  const handleDelete = () => {
    Alert.alert(
      `Delete ${user.displayName}?`,
      'This permanently deletes the account and everything it owns, including workspaces they own. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (await run('delete', () => deleteUser(user.id), 'Failed to delete user')) close();
          },
        },
      ],
    );
  };

  return (
    <Sheet visible title={user.displayName} onClose={close}>
      <Text className="-mt-3 text-xs text-gray-400">
        @{user.username} · {user.email}
      </Text>

      <View className="gap-1">
        <Text className="text-xs font-semibold uppercase tracking-wider text-gray-400">System role</Text>
        <View className="overflow-hidden rounded-lg border border-slack-darkBorder">
          {ROLES.map((role, i) => {
            const selected = role === user.systemRole;
            // Server rejects demoting your own super admin account.
            const disabled = !!busy || (isSelf && !selected);
            return (
              <Pressable
                key={role}
                disabled={disabled}
                onPress={() => handleRole(role)}
                className={cn(
                  'min-h-[44px] flex-row items-center justify-between px-3 active:bg-white/5',
                  i > 0 && 'border-t border-slack-darkBorder',
                  disabled && !selected && 'opacity-40',
                )}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled }}
              >
                <Text className={cn('text-sm text-gray-200', selected && 'font-semibold text-white')}>
                  {ROLE_LABELS[role]}
                </Text>
                {selected && <Text className="text-slack-green">✓</Text>}
              </Pressable>
            );
          })}
        </View>
        {busy === 'role' && <ActivityIndicator color="white" className="mt-1" />}
      </View>

      <View className="gap-2">
        <FormField
          label="Reset password"
          placeholder="New password (min 6 characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={handleResetPassword}
        />
        <Button variant="secondary" className="h-10" disabled={!!busy} onPress={handleResetPassword}>
          {busy === 'password' ? <ActivityIndicator color="white" /> : <Text>Reset password</Text>}
        </Button>
      </View>

      {!!error && <Text className="text-xs text-red-400">{error}</Text>}

      {!isSelf && (
        <Button variant="destructive" className="h-11" disabled={!!busy} onPress={handleDelete}>
          {busy === 'delete' ? <ActivityIndicator color="white" /> : <Text>Delete user</Text>}
        </Button>
      )}
    </Sheet>
  );
}
