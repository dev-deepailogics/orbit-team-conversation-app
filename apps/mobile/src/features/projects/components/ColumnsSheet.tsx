import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { ChevronDown, ChevronUp, Trash2 } from '@/components/icons';
import { FormField } from '@/components/FormField';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getErrorMessage } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { createColumn, deleteColumn, reorderColumns, updateColumn } from '../services/projectApi';
import { useProjectStore } from '../store';
import { cn } from '@/lib/utils';
import { moveItem } from '../utils';

// Manage board columns: add, rename, reorder (up/down instead of drag), delete.
export function ColumnsSheet({ visible, projectId, onClose }: { visible: boolean; projectId: string; onClose: () => void }) {
  const { colors } = useTheme();
  const columns = useProjectStore(s => s.current?.columns ?? []);
  const store = useProjectStore.getState;
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>, fallback: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const add = () =>
    newName.trim() &&
    run(async () => {
      store().addColumn(await createColumn(projectId, newName.trim()));
      setNewName('');
    }, 'Failed to add column');

  const rename = () =>
    renaming?.name.trim() &&
    run(async () => {
      store().updateColumn(await updateColumn(projectId, renaming.id, { name: renaming.name.trim() }));
      setRenaming(null);
    }, 'Failed to rename column');

  const move = (from: number, to: number) => {
    const ids = moveItem(columns, from, to).map(c => c.id);
    const previous = columns.map(c => c.id);
    store().setColumnOrder(projectId, ids);
    run(async () => {
      try {
        await reorderColumns(projectId, ids);
      } catch (e) {
        store().setColumnOrder(projectId, previous); // roll back the optimistic order
        throw e;
      }
    }, 'Failed to reorder columns');
  };

  const remove = (id: string, name: string, count: number) =>
    Alert.alert(`Delete "${name}"?`, count ? `Its ${count} ticket(s) will be deleted too.` : 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await deleteColumn(projectId, id);
            store().removeColumn(id);
          }, 'Failed to delete column'),
      },
    ]);

  return (
    <Sheet visible={visible} title="Columns" onClose={onClose}>
      <ScrollView className="max-h-80 rounded-xl border border-border" keyboardShouldPersistTaps="handled">
        {columns.map((c, i) => (
          <View key={c.id} className={cn('min-h-[52px] flex-row items-center gap-1 px-3', i > 0 && 'border-t border-border')}>
            {renaming?.id === c.id ? (
              <View className="flex-1 flex-row items-center gap-2 py-1">
                <View className="flex-1">
                  <FormField
                    label="Name"
                    value={renaming.name}
                    onChangeText={name => setRenaming({ id: c.id, name })}
                    autoCapitalize="sentences"
                    maxLength={50}
                    onSubmitEditing={rename}
                  />
                </View>
                <Button size="sm" onPress={rename}>
                  <Text>Save</Text>
                </Button>
              </View>
            ) : (
              <>
                <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color || colors.subtle }} />
                <Pressable className="flex-1 py-3 pl-2" onPress={() => setRenaming({ id: c.id, name: c.name })} accessibilityLabel={`Rename ${c.name}`}>
                  <Text className="font-bold" numberOfLines={1}>
                    {c.name} <Text className="text-sm font-normal text-subtle">{c.tickets?.length ?? 0}</Text>
                  </Text>
                </Pressable>
                <Button variant="ghost" size="icon" className="h-9 w-9" onPress={() => move(i, i - 1)} disabled={i === 0} accessibilityLabel={`Move ${c.name} up`}>
                  <ChevronUp size={18} color={colors.mutedForeground} />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9" onPress={() => move(i, i + 1)} disabled={i === columns.length - 1} accessibilityLabel={`Move ${c.name} down`}>
                  <ChevronDown size={18} color={colors.mutedForeground} />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9" onPress={() => remove(c.id, c.name, c.tickets?.length ?? 0)} accessibilityLabel={`Delete ${c.name}`}>
                  <Trash2 size={17} color={colors.destructive} />
                </Button>
              </>
            )}
          </View>
        ))}
      </ScrollView>
      <View className="flex-row items-end gap-2">
        <View className="flex-1">
          <FormField label="New column" value={newName} onChangeText={setNewName} autoCapitalize="sentences" maxLength={50} onSubmitEditing={add} />
        </View>
        <Button onPress={add} disabled={busy}>
          <Text>Add</Text>
        </Button>
      </View>
    </Sheet>
  );
}
