import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Check, ChevronDown, ChevronRight } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useServerNow } from '../hooks/useServerNow';
import { checkIn, checkOut, resumeWork, startBreak } from '../services/availabilityApi';
import { useAvailabilityStore } from '../store';
import { BREAK_REASONS, FULL_SHIFT_HOURS, formatElapsed, presenceOf, workedSeconds, type Presence } from '../utils';
import { PresenceDot } from './PresenceAvatar';

// Available / Break / Checkout, same actions as web's EmployeeAvailabilityHeader.
export function AvailabilitySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const record = useAvailabilityStore(s => s.record);
  const busy = useAvailabilityStore(s => s.busy);
  const error = useAvailabilityStore(s => s.error);
  const load = useAvailabilityStore(s => s.load);
  const run = useAvailabilityStore(s => s.run);
  const [pickBreak, setPickBreak] = useState(false);
  const now = useServerNow(visible);

  // Refresh on open: the status may have changed on web or by the server's 4 AM auto-checkout.
  useEffect(() => {
    if (!visible) return;
    setPickBreak(false);
    load();
  }, [visible, load]);

  const presence = presenceOf(record);
  const worked = formatElapsed(workedSeconds(record, now));
  const lastReason = record?.breaks?.at(-1)?.breakReason;

  const go = async (call: Parameters<typeof run>[0], fallback: string) => {
    if (await run(call, fallback)) onClose();
  };

  const requestCheckout = () => {
    const hours = workedSeconds(record, now) / 3600;
    if (hours >= FULL_SHIFT_HOURS) return go(checkOut, 'Failed to check out');
    Alert.alert(
      `Under ${FULL_SHIFT_HOURS} hours shift`,
      `You've worked ${hours.toFixed(1)} hours today. Check out and end your shift?`,
      [
        { text: 'Stay checked in', style: 'cancel' },
        { text: 'Check out', style: 'destructive', onPress: () => go(checkOut, 'Failed to check out') },
      ],
    );
  };

  return (
    <Sheet visible={visible} title="Set your status" onClose={onClose}>
      {/* Each row draws its own bottom border, so the box skips its own. */}
      <View className="overflow-hidden rounded-xl border border-b-0 border-border">
        <Option
          presence="working"
          title="Available"
          subtitle={
            presence === 'working'
              ? `Online · ${worked} worked today`
              : presence === 'break'
                ? 'Resume work and go back online'
                : 'Check in and start your day'
          }
          selected={presence === 'working'}
          disabled={busy}
          onPress={() => {
            if (presence === 'off') go(checkIn, 'Failed to check in');
            else if (presence === 'break') go(resumeWork, 'Failed to resume work');
          }}
        />
        <Option
          presence="break"
          title="Break"
          subtitle={
            presence === 'break'
              ? `On break${lastReason ? ` · ${lastReason}` : ''}`
              : presence === 'working'
                ? 'Step away for a while'
                : 'Check in first'
          }
          selected={presence === 'break'}
          disabled={busy || presence === 'off'}
          trailing={presence === 'working' ? (pickBreak ? ChevronDown : ChevronRight) : undefined}
          onPress={() => presence === 'working' && setPickBreak(v => !v)}
        />
        {pickBreak && presence === 'working' && (
          <View className="bg-muted py-1">
            {BREAK_REASONS.map(reason => (
              <Pressable
                key={reason}
                disabled={busy}
                onPress={() => go(() => startBreak(reason), 'Failed to start break')}
                className={cn('min-h-[44px] justify-center pl-12 pr-4 active:bg-border', busy && 'opacity-50')}
                accessibilityRole="button"
                accessibilityLabel={`Break: ${reason}`}
              >
                <Text>{reason}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Option
          presence="off"
          title="Checkout"
          subtitle={presence === 'off' ? 'Checked out · notifications off' : 'Done for the day'}
          selected={presence === 'off'}
          disabled={busy}
          onPress={() => presence !== 'off' && requestCheckout()}
        />
      </View>
      {!!error && <Text className="text-sm text-destructive">{error}</Text>}
      {busy && <Text className="text-sm text-muted-foreground">Updating…</Text>}
    </Sheet>
  );
}

function Option({
  presence,
  title,
  subtitle,
  selected,
  disabled,
  trailing: Trailing,
  onPress,
}: {
  presence: Presence;
  title: string;
  subtitle: string;
  selected: boolean;
  disabled?: boolean;
  trailing?: typeof ChevronRight;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(
        'min-h-[60px] flex-row items-center gap-3 border-b border-border px-4 active:bg-muted',
        selected && 'bg-accent',
        disabled && !selected && 'opacity-50',
      )}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
    >
      <PresenceDot presence={presence} className="h-3 w-3" />
      <View className="flex-1">
        <Text className={cn('font-bold', selected && 'text-accent-foreground')}>{title}</Text>
        <Text className="text-sm text-muted-foreground" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {selected && <Check size={20} color={colors.primary} strokeWidth={2.5} />}
      {Trailing && <Trailing size={18} color={colors.subtle} />}
    </Pressable>
  );
}
