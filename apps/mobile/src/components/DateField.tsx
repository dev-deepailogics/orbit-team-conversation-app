import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formatYmd, MONTHS, monthGrid, parseYmd, shiftMonth, toYmd, todayYmd, WEEKDAYS } from '@/lib/date';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  // 'YYYY-MM-DD' or '' for no date.
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Tappable field that opens a calendar. JS-only so it needs no native module / pod install.
export function DateField({ label, value, onChange, placeholder = 'Select date' }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-semibold text-gray-300">{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        className="h-11 flex-row items-center justify-between rounded-md border border-gray-700 bg-slack-darkBg px-3 active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatYmd(value) : 'not set'}`}
      >
        <Text className={value ? 'text-white' : 'text-gray-500'}>{value ? formatYmd(value) : placeholder}</Text>
        <Text>📅</Text>
      </Pressable>
      {open && (
        <CalendarSheet
          title={label}
          value={value}
          onClose={() => setOpen(false)}
          onPick={v => {
            onChange(v);
            setOpen(false);
          }}
        />
      )}
    </View>
  );
}

function CalendarSheet({
  title,
  value,
  onClose,
  onPick,
}: {
  title: string;
  value: string;
  onClose: () => void;
  onPick: (v: string) => void;
}) {
  const today = todayYmd();
  const start = parseYmd(value) ?? parseYmd(today)!;
  const [view, setView] = useState({ year: start.year, month: start.month });

  return (
    <Sheet visible title={title} onClose={onClose}>
      <View className="flex-row items-center justify-between">
        <Pressable onPress={() => setView(v => shiftMonth(v.year, v.month, -1))} hitSlop={12} className="px-3 py-2" accessibilityLabel="Previous month">
          <Text className="text-2xl text-white">‹</Text>
        </Pressable>
        <Text className="text-base font-semibold text-white">
          {MONTHS[view.month]} {view.year}
        </Text>
        <Pressable onPress={() => setView(v => shiftMonth(v.year, v.month, 1))} hitSlop={12} className="px-3 py-2" accessibilityLabel="Next month">
          <Text className="text-2xl text-white">›</Text>
        </Pressable>
      </View>
      <View className="flex-row">
        {WEEKDAYS.map((d, i) => (
          <Text key={i} className="flex-1 text-center text-xs text-gray-500">
            {d}
          </Text>
        ))}
      </View>
      <View className="gap-1">
        {monthGrid(view.year, view.month).map((week, r) => (
          <View key={r} className="flex-row">
            {week.map((day, c) => {
              if (!day) return <View key={c} className="h-11 flex-1" />;
              const ymd = toYmd(view.year, view.month, day);
              const selected = ymd === value.slice(0, 10);
              return (
                <Pressable
                  key={c}
                  onPress={() => onPick(ymd)}
                  className="h-11 flex-1 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel={formatYmd(ymd)}
                  accessibilityState={{ selected }}
                >
                  <View
                    className={cn(
                      'h-10 w-10 items-center justify-center rounded-full',
                      selected && 'bg-slack-activeChannel',
                      !selected && ymd === today && 'border border-slack-activeChannel',
                    )}
                  >
                    <Text className={cn('text-white', selected && 'font-bold')}>{day}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View className="flex-row gap-3">
        <Button variant="outline" className="h-11 flex-1" onPress={() => onPick('')}>
          <Text>Clear</Text>
        </Button>
        <Button className="h-11 flex-1 bg-slack-green" onPress={() => onPick(today)}>
          <Text className="text-white">Today</Text>
        </Button>
      </View>
    </Sheet>
  );
}
