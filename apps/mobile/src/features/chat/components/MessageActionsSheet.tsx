import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { MessageSquareText, Pencil, Trash2, type LucideIcon } from '@/components/icons';
import type { Message } from '@orbit/types';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/store';
import { useWorkspaceStore } from '@/features/workspaces/store';
import { getErrorMessage } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { deleteMessage } from '../services/chatApi';
import { useChatStore } from '../store';
import { messagePermissions, senderName } from '../utils';
import { EditMessageForm } from './EditMessageForm';

// Same quick picks as Slack's long-press menu. ponytail: full emoji picker comes in Phase 2.
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '👀', '✅'];

interface Props {
  message: Message | null;
  onClose: () => void;
  onReact: (m: Message, emoji: string) => void;
  onReplyInThread?: (m: Message) => void;
}

export function MessageActionsSheet({ message, onClose, onReact, onReplyInThread }: Props) {
  const { colors } = useTheme();
  const myId = useAuthStore(s => s.user?.id);
  const isSuperAdmin = useAuthStore(s => s.user?.systemRole === 'SUPER_ADMIN');
  const wsRole = useWorkspaceStore(s => s.current?.members.find(m => m.userId === myId)?.role);
  const updateMessage = useChatStore(s => s.updateMessage);
  // Editing swaps this sheet's content instead of opening a second modal, which iOS won't stack mid-dismiss.
  const [editing, setEditing] = useState(false);
  if (!message) return null;

  const { canEdit, canDelete } = messagePermissions(message, myId, isSuperAdmin || wsRole === 'OWNER' || wsRole === 'ADMIN');
  const close = () => {
    setEditing(false);
    onClose();
  };
  const act = (fn: () => void) => () => {
    close();
    fn();
  };

  const confirmDelete = (m: Message) =>
    Alert.alert('Delete message?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            updateMessage(await deleteMessage(m.id));
          } catch (err) {
            Alert.alert('Message not deleted', getErrorMessage(err, 'Please try again.'));
          }
        },
      },
    ]);

  const row = (Icon: LucideIcon, label: string, onPress: () => void, destructive = false) => (
    <Pressable onPress={onPress} className="min-h-[48px] flex-row items-center gap-3 rounded-lg px-2 active:bg-muted" accessibilityRole="button">
      <Icon size={20} color={destructive ? colors.destructive : colors.foreground} />
      <Text className={cn(destructive && 'text-destructive')}>{label}</Text>
    </Pressable>
  );

  return (
    <Sheet visible title={editing ? 'Edit message' : senderName(message)} onClose={close}>
      {editing ? (
        <EditMessageForm message={message} onDone={close} />
      ) : (
        <>
          {!!message.content && (
            <Text className="-mt-2 text-sm text-muted-foreground" numberOfLines={2}>
              {message.content}
            </Text>
          )}
          <View className="flex-row justify-between">
            {QUICK_REACTIONS.map(emoji => (
              <Pressable
                key={emoji}
                onPress={act(() => onReact(message, emoji))}
                className="h-12 w-12 items-center justify-center rounded-full bg-muted active:bg-border"
                accessibilityLabel={`React with ${emoji}`}
              >
                <Text className="text-2xl">{emoji}</Text>
              </Pressable>
            ))}
          </View>
          <View>
            {onReplyInThread && row(MessageSquareText, 'Reply in thread', act(() => onReplyInThread(message)))}
            {canEdit && row(Pencil, 'Edit message', () => setEditing(true))}
            {canDelete && row(Trash2, 'Delete message', act(() => confirmDelete(message)), true)}
          </View>
        </>
      )}
    </Sheet>
  );
}
