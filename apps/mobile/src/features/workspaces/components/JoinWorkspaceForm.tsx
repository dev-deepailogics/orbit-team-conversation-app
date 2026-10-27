import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getErrorMessage } from '@/lib/api';
import { joinWorkspace } from '../services/workspaceApi';
import { useWorkspaceStore } from '../store';
import { parseInviteCode } from '../utils';

export function JoinWorkspaceForm({ onJoined }: { onJoined?: () => void }) {
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
    <View className="gap-2">
      <FormField
        label="Join with an invite"
        placeholder="Invite link or code"
        value={code}
        onChangeText={setCode}
        keyboardType="url"
        returnKeyType="go"
        onSubmitEditing={handleJoin}
      />
      {!!error && <Text className="text-xs text-red-400">{error}</Text>}
      <Button variant="secondary" className="h-10" disabled={isLoading} onPress={handleJoin}>
        {isLoading ? <ActivityIndicator color="white" /> : <Text>Join workspace</Text>}
      </Button>
    </View>
  );
}
