import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { Check } from '@/components/icons';
import type { SystemRole } from '@orbit/types';
import { FormField } from '@/components/FormField';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getErrorMessage } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import {
  deleteUser,
  resetUserPassword,
  updateUserRole,
} from '../services/adminApi';
import type { AdminUser } from '../types';
import { ROLES, ROLE_LABELS } from '../utils';

interface Props {
  user: AdminUser | null;
  isSelf: boolean;
  onClose: () => void;
  // Called after any successful change so the console can refetch.
  onChanged: () => void;
}

type Busy = 'role' | 'password' | 'delete' | null;

export function UserActionsSheet({ user, isSelf, onClose, onChanged }: Props) {
  const { colors } = useTheme();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<Busy>(null);

  const close = () => {
    setPassword('');
    setError('');
    onClose();
  };

  // One action at a time; every action resets loading and reports its own error.
  const run = async (
    kind: Exclude<Busy, null>,
    action: () => Promise<void>,
    fallback: string,
  ) => {
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
    if (
      await run(
        'password',
        () => resetUserPassword(user.id, password),
        'Failed to reset password',
      )
    ) {
      Alert.alert(
        'Password reset',
        `${user.displayName} can now sign in with the new password.`,
      );
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
            if (
              await run(
                'delete',
                () => deleteUser(user.id),
                'Failed to delete user',
              )
            )
              close();
          },
        },
      ],
    );
  };

  return (
    <Sheet visible title={user.displayName} onClose={close}>
      <Text className="-mt-3 text-sm text-muted-foreground">
        @{user.username} · {user.email}
      </Text>

      <View className="gap-1.5">
        <Text className="text-sm font-bold">
          System role
        </Text>
        <View className="overflow-hidden rounded-xl border border-border">
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
                  'min-h-[48px] flex-row items-center justify-between px-3 active:bg-muted',
                  i > 0 && 'border-t border-border',
                  disabled && !selected && 'opacity-40',
                )}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled }}
              >
                <Text
                  className={cn(
                    selected && 'font-bold',
                  )}
                >
                  {ROLE_LABELS[role]}
                </Text>
                {selected && <Check size={18} color={colors.primary} strokeWidth={2.5} />}
              </Pressable>
            );
          })}
        </View>
        {busy === 'role' && (
          <ActivityIndicator color={colors.mutedForeground} className="mt-1" />
        )}
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
        <Button
          variant="outline"
          disabled={!!busy}
          onPress={handleResetPassword}
        >
          {busy === 'password' ? (
            <ActivityIndicator color={colors.mutedForeground} />
          ) : (
            <Text>Reset password</Text>
          )}
        </Button>
      </View>

      {!!error && <Text className="text-sm text-destructive">{error}</Text>}

      {!isSelf && (
        <Button
          variant="destructive"
          disabled={!!busy}
          onPress={handleDelete}
        >
          {busy === 'delete' ? (
            <ActivityIndicator color={colors.destructiveForeground} />
          ) : (
            <Text>Delete user</Text>
          )}
        </Button>
      )}
    </Sheet>
  );
}
