import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/store';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ScreenProps } from '@/navigation/types';
import { MarkdownText } from '@/features/chat/components/MarkdownText';
import { MoveSheet } from '../components/MoveSheet';
import { TicketFormSheet } from '../components/TicketFormSheet';
import { addComment, deleteTicket, getComments, moveTicket, toggleWatch, updateTicket } from '../services/projectApi';
import { useProjectStore } from '../store';
import type { ChecklistItem, TicketComment, TicketInput } from '../types';
import {
  checklistProgress,
  findTicket,
  formatDue,
  getAssignees,
  getChecklist,
  getEvents,
  getLabels,
  getWatchers,
  isOverdue,
  priorityMeta,
  ticketRef,
} from '../utils';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View className="gap-3">
    <Text className="text-xs font-semibold uppercase text-gray-500">{title}</Text>
    {children}
  </View>
);

export function TicketDetailScreen({ route, navigation }: ScreenProps<'TicketDetail'>) {
  const { projectId, ticketId } = route.params;
  const myId = useAuthStore(s => s.user?.id);
  const ticket = useProjectStore(s => findTicket(s.current?.id === projectId ? s.current : null, ticketId));
  const columnName = useProjectStore(s => s.current?.columns?.find(c => c.id === ticket?.columnId)?.name);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [commentsError, setCommentsError] = useState('');
  const [draft, setDraft] = useState('');
  const [item, setItem] = useState('');
  const [sending, setSending] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showMove, setShowMove] = useState(false);

  useEffect(() => {
    let alive = true;
    getComments(projectId, ticketId)
      .then(c => alive && setComments(c))
      .catch(err => alive && setCommentsError(getErrorMessage(err, 'Failed to load comments')));
    return () => {
      alive = false;
    };
  }, [projectId, ticketId]);

  const save = useCallback(
    async (input: TicketInput) => {
      const updated = await updateTicket(projectId, ticketId, input);
      useProjectStore.getState().updateTicket(updated);
    },
    [projectId, ticketId],
  );

  const safe = async (fn: () => Promise<void>, title: string) => {
    try {
      await fn();
    } catch (err) {
      Alert.alert(title, getErrorMessage(err, 'Please try again.'));
    }
  };

  if (!ticket) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-slack-darkBg p-6">
        <Text className="text-gray-400">This ticket is no longer available.</Text>
        <Button className="bg-slack-activeChannel" onPress={navigation.goBack}>
          <Text className="text-white">Go back</Text>
        </Button>
      </SafeAreaView>
    );
  }

  const checklist = getChecklist(ticket);
  const { done, total } = checklistProgress(checklist);
  const labels = getLabels(ticket);
  const assignees = getAssignees(ticket);
  const watching = !!myId && getWatchers(ticket).includes(myId);
  const p = priorityMeta(ticket.priority);
  const ref = ticketRef(ticket);

  const setChecklist = (next: ChecklistItem[]) => safe(() => save({ checklist: next }), 'Checklist not saved');

  const addItem = () => {
    const text = item.trim();
    if (!text) return;
    setItem('');
    setChecklist([...checklist, { id: `chk-${Date.now()}`, text, completed: false }]);
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const c = await addComment(projectId, ticketId, text);
      setComments(prev => [...prev, c]);
      setDraft('');
    } catch (err) {
      Alert.alert('Comment not sent', getErrorMessage(err, 'Please try again.'));
    } finally {
      setSending(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert('Delete ticket?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          safe(async () => {
            await deleteTicket(projectId, ticketId);
            useProjectStore.getState().removeTicket(ticketId);
            navigation.goBack();
          }, 'Delete failed'),
      },
    ]);

  return (
    <SafeAreaView className="flex-1 bg-slack-darkBg" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-4 border-b border-slack-darkBorder px-5 py-4">
        <Pressable onPress={navigation.goBack} hitSlop={12} accessibilityLabel="Back">
          <Text className="text-2xl text-white">‹</Text>
        </Pressable>
        <Text className="flex-1 text-sm text-gray-400" numberOfLines={1}>
          {ref || 'Ticket'}
        </Text>
        <Pressable onPress={() => setShowEdit(true)} hitSlop={10} accessibilityLabel="Edit ticket">
          <Text className="text-sm font-semibold text-slack-activeChannel">Edit</Text>
        </Pressable>
        <Pressable onPress={confirmDelete} hitSlop={10} accessibilityLabel="Delete ticket">
          <Text className="text-lg">🗑</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-6 px-5 py-6" keyboardShouldPersistTaps="handled">
          <Text className="text-xl font-bold text-white">{ticket.title}</Text>

          <View className="flex-row flex-wrap gap-3">
            <Pressable
              onPress={() => setShowMove(true)}
              className="rounded-full border border-slack-darkBorder px-4 py-2.5 active:opacity-70"
              accessibilityLabel="Move ticket"
            >
              <Text className="text-sm text-white">{columnName ?? '—'} ▾</Text>
            </Pressable>
            <View className="rounded-full px-4 py-2.5" style={{ backgroundColor: p.color }}>
              <Text className="text-sm font-semibold text-white">{p.label}</Text>
            </View>
            <Pressable
              onPress={() =>
                safe(async () => {
                  const r = await toggleWatch(projectId, ticketId);
                  useProjectStore.getState().updateTicket({ ...ticket, watchers: r.watchers });
                }, 'Watch failed')
              }
              className="rounded-full border border-slack-darkBorder px-4 py-2.5 active:opacity-70"
              accessibilityRole="button"
              accessibilityState={{ selected: watching }}
            >
              <Text className="text-sm text-white">{watching ? '👁 Watching' : '👁 Watch'}</Text>
            </Pressable>
          </View>

          <View className="gap-3 rounded-xl border border-slack-darkBorder p-4">
            <View className="flex-row items-start gap-2">
              <Text className="w-24 text-sm text-gray-400">Assignees</Text>
              {assignees.length ? (
                <View className="flex-1 gap-2">
                  {assignees.map(a => (
                    <View key={a.uid} className="flex-row items-center gap-2">
                      <Avatar name={a.name} className="h-6 w-6 rounded-md" />
                      <Text className="flex-1 text-sm text-white">{a.name}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-sm text-gray-500">Unassigned</Text>
              )}
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="w-24 text-sm text-gray-400">Due</Text>
              <Text className={cn('text-sm', isOverdue(ticket.dueDate) ? 'font-semibold text-red-400' : 'text-white')}>
                {ticket.dueDate ? formatDue(ticket.dueDate) : '—'}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="w-24 text-sm text-gray-400">Story points</Text>
              <Text className="text-sm text-white">{ticket.storyPoints ?? '—'}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="w-24 text-sm text-gray-400">Reporter</Text>
              <Text className="text-sm text-white">{ticket.creator?.displayName ?? '—'}</Text>
            </View>
            {!!ticket.gitbranch && (
              <View className="flex-row items-center gap-2">
                <Text className="w-24 text-sm text-gray-400">Branch</Text>
                <Text className="flex-1 text-sm text-white" selectable>
                  {ticket.gitbranch}
                </Text>
              </View>
            )}
          </View>

          {labels.length > 0 && (
            <View className="flex-row flex-wrap gap-1">
              {labels.map(l => (
                <View key={l} className="rounded bg-white/10 px-2 py-1">
                  <Text className="text-xs text-gray-200">{l}</Text>
                </View>
              ))}
            </View>
          )}

          {!!ticket.description && (
            <Section title="Description">
              <MarkdownText content={ticket.description} />
            </Section>
          )}
          {!!ticket.testPlan && (
            <Section title="Test plan">
              <MarkdownText content={ticket.testPlan} />
            </Section>
          )}
          {!!ticket.notes && (
            <Section title="Notes">
              <MarkdownText content={ticket.notes} />
            </Section>
          )}

          <Section title={total ? `Checklist ${done}/${total}` : 'Checklist'}>
            {checklist.map(c => (
              <View key={c.id} className="min-h-[44px] flex-row items-center gap-3">
                <Pressable
                  onPress={() => setChecklist(checklist.map(x => (x.id === c.id ? { ...x, completed: !x.completed } : x)))}
                  className="flex-1 flex-row items-center gap-3"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: c.completed }}
                >
                  <Text className="text-lg text-white">{c.completed ? '☑' : '☐'}</Text>
                  <Text className={cn('flex-1 text-white', c.completed && 'text-gray-500 line-through')}>{c.text}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setChecklist(checklist.filter(x => x.id !== c.id))}
                  hitSlop={10}
                  accessibilityLabel={`Remove ${c.text}`}
                >
                  <Text className="text-gray-500">✕</Text>
                </Pressable>
              </View>
            ))}
            <Input
              value={item}
              onChangeText={setItem}
              onSubmitEditing={addItem}
              placeholder="Add checklist item"
              placeholderTextColor="#6B7280"
              returnKeyType="done"
              className="h-10 border-gray-700 bg-slack-darkSidebar text-white"
            />
          </Section>

          <Section title="Comments">
            {!!commentsError && <Text className="text-xs text-red-400">{commentsError}</Text>}
            {comments.length === 0 && !commentsError && <Text className="text-sm text-gray-500">No comments yet.</Text>}
            {comments.map(c => (
              <View key={c.id} className="flex-row gap-2">
                <Avatar name={c.user?.displayName || c.username} className="h-7 w-7 rounded-md" />
                <View className="flex-1">
                  <Text className="text-xs text-gray-400">
                    {c.user?.displayName || c.username} · {new Date(c.createdAt).toLocaleString()}
                  </Text>
                  <Text className="text-white" selectable>
                    {c.text}
                  </Text>
                </View>
              </View>
            ))}
          </Section>

          {getEvents(ticket).length > 0 && (
            <Section title="Activity">
              {getEvents(ticket).map(e => (
                <View key={e.id} className="flex-row items-start gap-2">
                  <View className="mt-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: e.color || '#6B7280' }} />
                  <Text className="flex-1 text-xs text-gray-400">
                    {e.user ? `${e.user} · ` : ''}
                    {e.action} · {new Date(e.date).toLocaleString()}
                  </Text>
                </View>
              ))}
            </Section>
          )}
        </ScrollView>

        <View className="flex-row items-center gap-3 border-t border-slack-darkBorder px-5 py-3">
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a comment"
            placeholderTextColor="#6B7280"
            multiline
            className="max-h-24 min-h-[40px] flex-1 border-gray-700 bg-slack-darkSidebar text-white"
          />
          <Button className="h-10 bg-slack-green" onPress={send} disabled={sending || !draft.trim()}>
            {sending ? <ActivityIndicator color="white" /> : <Text className="text-white">Send</Text>}
          </Button>
        </View>
      </KeyboardAvoidingView>

      <TicketFormSheet
        visible={showEdit}
        ticket={ticket}
        onClose={() => setShowEdit(false)}
        onSubmit={async input => {
          await save(input);
          setShowEdit(false);
        }}
      />
      <MoveSheet
        visible={showMove}
        currentColumnId={ticket.columnId}
        onClose={() => setShowMove(false)}
        onPick={columnId => {
          setShowMove(false);
          const store = useProjectStore.getState();
          const index = store.current?.columns?.find(c => c.id === columnId)?.tickets?.length ?? 0;
          store.moveTicket(ticket, columnId, index);
          safe(async () => {
            try {
              await moveTicket(projectId, ticketId, columnId, index);
            } catch (e) {
              store.openProject(projectId);
              throw e;
            }
          }, 'Move failed');
        }}
      />
    </SafeAreaView>
  );
}
