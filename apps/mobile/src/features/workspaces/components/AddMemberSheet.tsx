import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import type { Workspace } from '@orbit/types';
import { FormField } from '@/components/FormField';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { addWorkspaceMember } from '../services/workspaceApi';

const ROLES = [
  { value: 'MEMBER', label: 'Member', hint: 'Chat, huddles, files' },
  { value: 'ADMIN', label: 'Admin', hint: 'Manage channels, bots, members' },
] as const;

interface Props {
  visible: boolean;
  workspace: Workspace;
  onClose: () => void;
  onAdded: () => void;
}

export function AddMemberSheet({ visible, workspace, onClose, onAdded }: Props) {
  const [who, setWho] = useState('');
  const [role, setRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const submit = async () => {
    const target = who.trim();
    if (isLoading) return;
    if (!target) {
      setError('Enter an email or username.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await addWorkspaceMember(workspace.id, target, role);
      setWho('');
      setRole('MEMBER');
      onAdded();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to add member'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet visible={visible} title={`Add to ${workspace.name}`} onClose={onClose}>
      <FormField
        label="Email or username"
        placeholder="teammate@company.com"
        value={who}
        onChangeText={setWho}
        keyboardType="email-address"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Text className="-mt-2 text-xs text-gray-500">They must already have an Orbit account.</Text>

      <View className="flex-row gap-2">
        {ROLES.map(r => (
          <Pressable
            key={r.value}
            onPress={() => setRole(r.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: role === r.value }}
            className={cn(
              'flex-1 gap-0.5 rounded-lg border p-3',
              role === r.value ? 'border-slack-green bg-slack-green/15' : 'border-slack-darkBorder',
            )}
          >
            <Text className="text-sm font-semibold text-white">{r.label}</Text>
            <Text className="text-xs text-gray-400">{r.hint}</Text>
          </Pressable>
        ))}
      </View>

      {!!error && <Text className="text-xs text-red-400">{error}</Text>}

      <Button className="h-11 bg-slack-green" disabled={isLoading} onPress={submit}>
        {isLoading ? <ActivityIndicator color="white" /> : <Text className="font-semibold text-white">Add member</Text>}
      </Button>
    </Sheet>
  );
}
