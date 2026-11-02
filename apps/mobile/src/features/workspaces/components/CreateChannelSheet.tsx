import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import type { Channel } from '@orbit/types';
import { slugify } from '@/features/admin/utils';
import { FormField } from '@/components/FormField';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { createChannel } from '../services/workspaceApi';
import { useWorkspaceStore } from '../store';
import { useTheme } from '@/lib/theme';

const TYPES = [
  { value: 'PUBLIC', label: 'Public', hint: 'Everyone in the workspace joins' },
  { value: 'PRIVATE', label: 'Private', hint: 'Invite-only' },
] as const;

interface Props {
  visible: boolean;
  workspaceId: string;
  onClose: () => void;
  onCreated: (channel: Channel) => void;
}

// Any workspace member can create a channel (server checks membership).
export function CreateChannelSheet({ visible, workspaceId, onClose, onCreated }: Props) {
  const { colors } = useTheme();
  const upsertChannel = useWorkspaceStore(s => s.upsertChannel);
  const [name, setName] = useState('');
  const [type, setType] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const submit = async () => {
    if (isLoading) return;
    const slug = slugify(name);
    if (slug.length < 2) {
      setError('Name must be 2–50 lowercase letters, numbers or dashes.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const channel = await createChannel(workspaceId, slug, type);
      upsertChannel(channel); // the socket event can lag; this makes it appear immediately
      setName('');
      setType('PUBLIC');
      onCreated(channel);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create channel'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet visible={visible} title="Create channel" onClose={onClose}>
      <FormField
        label="Channel name"
        placeholder="project-updates"
        value={name}
        onChangeText={t => setName(t.toLowerCase().replace(/\s+/g, '-'))}
        maxLength={50}
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <View className="flex-row gap-2">
        {TYPES.map(t => (
          <Pressable
            key={t.value}
            onPress={() => setType(t.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: type === t.value }}
            className={cn(
              'flex-1 gap-0.5 rounded-xl border p-3',
              type === t.value ? 'border-link bg-accent' : 'border-border',
            )}
          >
            <Text className="font-bold">{t.label}</Text>
            <Text className="text-sm text-muted-foreground">{t.hint}</Text>
          </Pressable>
        ))}
      </View>
      {!!error && <Text className="text-sm text-destructive">{error}</Text>}
      <Button disabled={isLoading} onPress={submit}>
        {isLoading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text>Create channel</Text>}
      </Button>
    </Sheet>
  );
}
