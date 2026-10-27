import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Avatar } from '@/components/Avatar';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export interface Option {
  value: string;
  label: string;
}

interface Props {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  emptyText?: string;
}

// Dropdown-style field: shows chips for the selection, opens a checklist sheet to change it.
export function MultiSelectField({ label, options, selected, onChange, placeholder = 'Select…', emptyText = 'Nothing to select.' }: Props) {
  const [open, setOpen] = useState(false);
  // Keep selections that are no longer offered (e.g. removed from the project) visible so they can be cleared.
  const chosen = selected.map(v => options.find(o => o.value === v) ?? { value: v, label: 'Unknown' });
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);

  return (
    <View className="gap-1.5">
      <Text className="text-xs font-semibold text-gray-300">{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        className="min-h-[44px] flex-row items-center gap-2 rounded-md border border-gray-700 bg-slack-darkBg px-3 py-2 active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${chosen.length ? chosen.map(c => c.label).join(', ') : 'none'}`}
      >
        <View className="flex-1 flex-row flex-wrap gap-1.5">
          {chosen.length === 0 ? (
            <Text className="text-gray-500">{placeholder}</Text>
          ) : (
            chosen.map(c => (
              <View key={c.value} className="flex-row items-center gap-1 rounded-full bg-white/10 py-1 pl-2 pr-1.5">
                <Text className="text-sm text-white">{c.label}</Text>
                <Pressable onPress={() => toggle(c.value)} hitSlop={8} accessibilityLabel={`Remove ${c.label}`}>
                  <Text className="text-xs text-gray-400">✕</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
        <Text className="text-gray-400">▾</Text>
      </Pressable>

      {open && (
        <Sheet visible title={label} onClose={() => setOpen(false)}>
          <View className="h-72">
            <FlashList
              data={options}
              extraData={selected}
              keyExtractor={o => o.value}
              ListEmptyComponent={<Text className="mt-6 text-center text-gray-400">{emptyText}</Text>}
              renderItem={({ item }) => {
                const on = selected.includes(item.value);
                return (
                  <Pressable
                    onPress={() => toggle(item.value)}
                    className={cn('min-h-[52px] flex-row items-center gap-3 px-2 active:bg-white/5', on && 'bg-white/5')}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    <Avatar name={item.label} className="h-8 w-8" />
                    <Text className="flex-1 text-white" numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text className="text-lg text-slack-green">{on ? '☑' : '☐'}</Text>
                  </Pressable>
                );
              }}
            />
          </View>
          <Button className="h-11 bg-slack-green" onPress={() => setOpen(false)}>
            <Text className="font-semibold text-white">Done{selected.length ? ` (${selected.length})` : ''}</Text>
          </Button>
        </Sheet>
      )}
    </View>
  );
}
