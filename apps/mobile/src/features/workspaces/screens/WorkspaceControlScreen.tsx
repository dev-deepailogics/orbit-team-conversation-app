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
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-muted-foreground">Open a workspace first.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 p-5">
      <View className="flex-row items-center gap-3">
        <Avatar name={current.name} className="h-12 w-12 rounded-xl" />
        <View className="flex-1 gap-0.5">
          <Text className="text-xl font-black" numberOfLines={1}>
            {current.name}
          </Text>
          <Text className="text-sm text-muted-foreground" selectable>
            Invite code: {current.inviteCode}
          </Text>
        </View>
      </View>

      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="font-bold">Members ({current.members.length})</Text>
          <Button size="sm" variant="outline" onPress={() => setShowAdd(true)}>
            <Text>Add member</Text>
          </Button>
        </View>
        {current.members.map(m => (
          <View key={m.id} className="min-h-[52px] flex-row items-center gap-3">
            <Avatar name={m.user?.displayName ?? '?'} />
            <View className="flex-1">
              <Text className="font-bold" numberOfLines={1}>
                {m.user?.displayName ?? m.userId}
              </Text>
              {!!m.user?.username && <Text className="text-sm text-muted-foreground">@{m.user.username}</Text>}
            </View>
            <Text className="rounded-md bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{m.role}</Text>
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
