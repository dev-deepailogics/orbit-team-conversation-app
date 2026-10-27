import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { Ticket } from '../types';
import { checklistProgress, formatDue, getAssignees, getChecklist, getLabels, isOverdue, priorityMeta, ticketRef } from '../utils';

interface Props {
  ticket: Ticket;
  onPress: () => void;
  onLongPress?: () => void;
}

export const TicketCard = memo(function TicketCardImpl({ ticket, onPress, onLongPress }: Props) {
  const p = priorityMeta(ticket.priority);
  const { done, total } = checklistProgress(getChecklist(ticket));
  const labels = getLabels(ticket);
  const overdue = isOverdue(ticket.dueDate);
  const ref = ticketRef(ticket);
  const assignees = getAssignees(ticket);
  const comments = ticket._count?.comments ?? 0;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="mx-5 mb-3 gap-2.5 rounded-xl border border-slack-darkBorder bg-slack-darkSidebar p-4 active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={`${ticket.title}, ${p.label} priority`}
    >
      <View className="flex-row items-center gap-2">
        <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
        <Text className="text-xs font-semibold" style={{ color: p.color }}>
          {p.label}
        </Text>
        {!!ref && <Text className="text-xs text-gray-500">{ref}</Text>}
      </View>
      <Text className="text-base font-semibold text-white" numberOfLines={3}>
        {ticket.title}
      </Text>
      {labels.length > 0 && (
        <View className="flex-row flex-wrap gap-1">
          {labels.slice(0, 4).map(l => (
            <View key={l} className="rounded bg-white/10 px-2 py-0.5">
              <Text className="text-xs text-gray-300">{l}</Text>
            </View>
          ))}
        </View>
      )}
      <View className="flex-row items-center gap-3">
        {!!ticket.dueDate && (
          <Text className={cn('text-xs', overdue ? 'font-semibold text-red-400' : 'text-gray-400')}>
            📅 {formatDue(ticket.dueDate)}
          </Text>
        )}
        {total > 0 && (
          <Text className="text-xs text-gray-400">
            ☑ {done}/{total}
          </Text>
        )}
        {comments > 0 && <Text className="text-xs text-gray-400">💬 {comments}</Text>}
        <View className="flex-1" />
        <View className="flex-row">
          {assignees.slice(0, 3).map((a, i) => (
            <Avatar key={a.uid} name={a.name} className={cn('h-6 w-6 rounded-md border border-slack-darkSidebar', i > 0 && '-ml-2')} />
          ))}
          {assignees.length > 3 && <Text className="ml-1 self-center text-xs text-gray-400">+{assignees.length - 3}</Text>}
        </View>
      </View>
    </Pressable>
  );
});
