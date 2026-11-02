import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { CalendarDays, MessageCircle, SquareCheck } from '@/components/icons';
import { Avatar } from '@/components/Avatar';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { Ticket } from '../types';
import { checklistProgress, formatDue, getAssignees, getChecklist, getLabels, isOverdue, priorityMeta, ticketRef } from '../utils';

interface Props {
  ticket: Ticket;
  onPress: () => void;
  onLongPress?: () => void;
}

export const TicketCard = memo(function TicketCardImpl({ ticket, onPress, onLongPress }: Props) {
  const { colors } = useTheme();
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
      className="mx-4 mb-3 gap-2.5 rounded-xl border border-border bg-background p-4 active:bg-muted"
      accessibilityRole="button"
      accessibilityLabel={`${ticket.title}, ${p.label} priority`}
    >
      <View className="flex-row items-center gap-2">
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
        <Text className="text-xs font-bold" style={{ color: p.color }}>
          {p.label}
        </Text>
        {!!ref && <Text className="text-xs text-subtle">{ref}</Text>}
      </View>
      <Text className="font-bold" numberOfLines={3}>
        {ticket.title}
      </Text>
      {labels.length > 0 && (
        <View className="flex-row flex-wrap gap-1">
          {labels.slice(0, 4).map(l => (
            <View key={l} className="rounded-md bg-muted px-2 py-0.5">
              <Text className="text-xs font-bold text-muted-foreground">{l}</Text>
            </View>
          ))}
        </View>
      )}
      <View className="flex-row items-center gap-3">
        {!!ticket.dueDate && (
          <View className="flex-row items-center gap-1">
            <CalendarDays size={13} color={overdue ? colors.destructive : colors.mutedForeground} />
            <Text className={cn('text-xs', overdue ? 'font-bold text-destructive' : 'text-muted-foreground')}>
              {formatDue(ticket.dueDate)}
            </Text>
          </View>
        )}
        {total > 0 && (
          <View className="flex-row items-center gap-1">
            <SquareCheck size={13} color={colors.mutedForeground} />
            <Text className="text-xs text-muted-foreground">
              {done}/{total}
            </Text>
          </View>
        )}
        {comments > 0 && (
          <View className="flex-row items-center gap-1">
            <MessageCircle size={13} color={colors.mutedForeground} />
            <Text className="text-xs text-muted-foreground">{comments}</Text>
          </View>
        )}
        <View className="flex-1" />
        <View className="flex-row">
          {assignees.slice(0, 3).map((a, i) => (
            <Avatar key={a.uid} name={a.name} className={cn('h-6 w-6 rounded-md border-2 border-background', i > 0 && '-ml-1.5')} />
          ))}
          {assignees.length > 3 && <Text className="ml-1 self-center text-xs text-muted-foreground">+{assignees.length - 3}</Text>}
        </View>
      </View>
    </Pressable>
  );
});
