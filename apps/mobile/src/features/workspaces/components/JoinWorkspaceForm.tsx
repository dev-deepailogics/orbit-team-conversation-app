import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getErrorMessage } from '@/lib/api';
import { joinWorkspace } from '../services/workspaceApi';
import { useWorkspaceStore } from '../store';
import { parseInviteCode } from '../utils';
import { useTheme } from '@/lib/theme';

export function JoinWorkspaceForm({ onJoined }: { onJoined?: () => void }) {
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const load = useWorkspaceStore(s => s.load);

  const handleJoin = async () => {
    if (isLoading) return;
    const inviteCode = parseInviteCode(code);
    if (!inviteCode) {
      setError('Paste an invite link or code.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const workspaceId = await joinWorkspace(inviteCode);
      setCode('');
      await load(workspaceId);
      onJoined?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not join workspace'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="gap-3">
      <FormField
        label="Join with an invite"
        placeholder="Invite link or code"
        value={code}
        onChangeText={setCode}
        keyboardType="url"
        returnKeyType="go"
        onSubmitEditing={handleJoin}
      />
      {!!error && <Text className="text-sm text-destructive">{error}</Text>}
      <Button disabled={isLoading} onPress={handleJoin}>
        {isLoading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text>Join workspace</Text>}
      </Button>
    </View>
  );
}
