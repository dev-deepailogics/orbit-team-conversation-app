import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronDown, Eye, Pencil, SendHorizontal, Trash2, X } from '@/components/icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/store';
import { getErrorMessage } from '@/lib/api';
import { onSwatch, useTheme } from '@/lib/theme';
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
    <Text className="font-bold">{title}</Text>
    {children}
  </View>
);

export function TicketDetailScreen({ route, navigation }: ScreenProps<'TicketDetail'>) {
  const { colors } = useTheme();
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
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background p-6">
        <Text className="text-muted-foreground">This ticket is no longer available.</Text>
        <Button variant="outline" onPress={navigation.goBack}>
          <Text>Go back</Text>
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
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader
        title={ref || 'Ticket'}
        subtitle={columnName}
        onBack={navigation.goBack}
        right={
          <>
            <Button variant="ghost" size="icon" onPress={() => setShowEdit(true)} accessibilityLabel="Edit ticket">
              <Pencil size={19} color={colors.foreground} />
            </Button>
            <Button variant="ghost" size="icon" onPress={confirmDelete} accessibilityLabel="Delete ticket">
              <Trash2 size={19} color={colors.destructive} />
            </Button>
          </>
        }
      />

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-6 px-4 py-5" keyboardShouldPersistTaps="handled">
          <Text className="text-2xl font-black">{ticket.title}</Text>

          <View className="flex-row flex-wrap gap-2">
            <Pressable
              onPress={() => setShowMove(true)}
              className="h-9 flex-row items-center gap-1 rounded-full border border-border px-3.5 active:bg-muted"
              accessibilityRole="button"
              accessibilityLabel="Move ticket"
            >
              <Text className="text-sm font-bold">{columnName ?? '—'}</Text>
              <ChevronDown size={15} color={colors.foreground} strokeWidth={2.5} />
            </Pressable>
            <View className="h-9 justify-center rounded-full px-3.5" style={{ backgroundColor: p.color }}>
              <Text className="text-sm font-bold" style={{ color: onSwatch }}>{p.label}</Text>
            </View>
            <Pressable
              onPress={() =>
                safe(async () => {
                  const r = await toggleWatch(projectId, ticketId);
                  useProjectStore.getState().updateTicket({ ...ticket, watchers: r.watchers });
                }, 'Watch failed')
              }
              className={cn(
                'h-9 flex-row items-center gap-1.5 rounded-full border px-3.5 active:bg-muted',
                watching ? 'border-link bg-accent' : 'border-border',
              )}
              accessibilityRole="button"
              accessibilityState={{ selected: watching }}
            >
              <Eye size={15} color={watching ? colors.link : colors.foreground} />
              <Text className={cn('text-sm font-bold', watching && 'text-accent-foreground')}>
                {watching ? 'Watching' : 'Watch'}
              </Text>
            </Pressable>
          </View>

          <View className="gap-3.5 rounded-xl border border-border p-4">
            <View className="flex-row items-start gap-2">
              <Text className="w-28 text-muted-foreground">Assignees</Text>
              {assignees.length ? (
                <View className="flex-1 gap-2">
                  {assignees.map(a => (
                    <View key={a.uid} className="flex-row items-center gap-2">
                      <Avatar name={a.name} className="h-6 w-6 rounded-md" />
                      <Text className="flex-1 font-bold">{a.name}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-subtle">Unassigned</Text>
              )}
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="w-28 text-muted-foreground">Due</Text>
              <Text className={cn(isOverdue(ticket.dueDate) && 'font-bold text-destructive')}>
                {ticket.dueDate ? formatDue(ticket.dueDate) : '—'}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="w-28 text-muted-foreground">Story points</Text>
              <Text>{ticket.storyPoints ?? '—'}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="w-28 text-muted-foreground">Reporter</Text>
              <Text>{ticket.creator?.displayName ?? '—'}</Text>
            </View>
            {!!ticket.gitbranch && (
              <View className="flex-row items-center gap-2">
                <Text className="w-28 text-muted-foreground">Branch</Text>
                <Text className="flex-1 font-mono text-sm" selectable>
                  {ticket.gitbranch}
                </Text>
              </View>
            )}
          </View>

          {labels.length > 0 && (
            <View className="flex-row flex-wrap gap-1">
              {labels.map(l => (
                <View key={l} className="rounded-md bg-muted px-2 py-1">
                  <Text className="text-xs font-bold text-muted-foreground">{l}</Text>
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
                  <View
                    className={cn(
                      'h-5 w-5 items-center justify-center rounded border',
                      c.completed ? 'border-primary bg-primary' : 'border-input',
                    )}
                  >
                    {c.completed && <Check size={14} color={colors.primaryForeground} strokeWidth={3} />}
                  </View>
                  <Text className={cn('flex-1', c.completed && 'text-subtle line-through')}>{c.text}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setChecklist(checklist.filter(x => x.id !== c.id))}
                  hitSlop={10}
                  accessibilityLabel={`Remove ${c.text}`}
                >
                  <X size={16} color={colors.subtle} />
                </Pressable>
              </View>
            ))}
            <Input
              value={item}
              onChangeText={setItem}
              onSubmitEditing={addItem}
              placeholder="Add checklist item"
              returnKeyType="done"
              className="h-10"
            />
          </Section>

          <Section title="Comments">
            {!!commentsError && <Text className="text-sm text-destructive">{commentsError}</Text>}
            {comments.length === 0 && !commentsError && <Text className="text-subtle">No comments yet.</Text>}
            {comments.map(c => (
              <View key={c.id} className="flex-row gap-2">
                <Avatar name={c.user?.displayName || c.username} />
                <View className="flex-1">
                  <View className="flex-row items-baseline gap-2">
                    <Text className="shrink font-bold" numberOfLines={1}>
                      {c.user?.displayName || c.username}
                    </Text>
                    <Text className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</Text>
                  </View>
                  <Text selectable>
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
                  <View className="mt-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: e.color || colors.subtle }} />
                  <Text className="flex-1 text-sm text-muted-foreground">
                    {e.user ? `${e.user} · ` : ''}
                    {e.action} · {new Date(e.date).toLocaleString()}
                  </Text>
                </View>
              ))}
            </Section>
          )}
        </ScrollView>

        <View className="flex-row items-end gap-2 border-t border-border px-4 py-2.5">
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a comment"
            multiline
            className="h-auto max-h-24 min-h-[40px] flex-1 py-2"
          />
          <Pressable
            onPress={send}
            disabled={sending || !draft.trim()}
            className={cn(
              'h-10 w-10 items-center justify-center rounded-lg',
              !sending && draft.trim() && 'bg-primary active:bg-primary/90',
            )}
            accessibilityRole="button"
            accessibilityLabel="Send comment"
          >
            {sending ? (
              <ActivityIndicator color={colors.mutedForeground} size="small" />
            ) : (
              <SendHorizontal size={18} strokeWidth={2.25} color={draft.trim() ? colors.primaryForeground : colors.subtle} />
            )}
          </Pressable>
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
