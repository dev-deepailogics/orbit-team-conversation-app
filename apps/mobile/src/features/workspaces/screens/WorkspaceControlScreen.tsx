import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { AddMemberSheet } from '../components/AddMemberSheet';
import { useWorkspaceStore } from '../store';

// Super-admin control panel for the open workspace (registered only for SUPER_ADMIN in App.tsx; the server enforces it too).
// ponytail: only "add members" for now; remove / role change / rename slot in as new sections here.
export function WorkspaceControlScreen() {
  const current = useWorkspaceStore(s => s.current);
  const select = useWorkspaceStore(s => s.select);
  const [showAdd, setShowAdd] = useState(false);

  if (!current) {
    return (
      <View className="flex-1 items-center justify-center bg-slack-darkBg p-6">
        <Text className="text-gray-400">Open a workspace first.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slack-darkBg" contentContainerClassName="gap-6 p-6">
      <View className="gap-1">
        <Text className="text-xl font-bold text-white">{current.name}</Text>
        <Text className="text-xs text-gray-400">Invite code: {current.inviteCode}</Text>
      </View>

      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Members ({current.members.length})
          </Text>
        </View>
        <Button className="h-11 bg-slack-green" onPress={() => setShowAdd(true)}>
          <Text className="font-semibold text-white">Add member</Text>
        </Button>
        {current.members.map(m => (
          <View key={m.id} className="flex-row items-center gap-3">
            <Avatar name={m.user?.displayName ?? '?'} className="h-9 w-9 rounded-lg" />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-white" numberOfLines={1}>
                {m.user?.displayName ?? m.userId}
              </Text>
              {!!m.user?.username && <Text className="text-xs text-gray-400">@{m.user.username}</Text>}
            </View>
            <Text className="text-xs text-gray-400">{m.role}</Text>
          </View>
        ))}
      </View>

      <AddMemberSheet
        visible={showAdd}
        workspace={current}
        onClose={() => setShowAdd(false)}
        onAdded={() => {
          setShowAdd(false);
          select(current.id, true);
        }}
      />
    </ScrollView>
  );
}
