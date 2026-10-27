import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { FormField } from '@/components/FormField';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getErrorMessage } from '@/lib/api';
import { createColumn, deleteColumn, reorderColumns, updateColumn } from '../services/projectApi';
import { useProjectStore } from '../store';
import { moveItem } from '../utils';

// Manage board columns: add, rename, reorder (up/down instead of drag), delete.
export function ColumnsSheet({ visible, projectId, onClose }: { visible: boolean; projectId: string; onClose: () => void }) {
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
      <ScrollView className="max-h-80" keyboardShouldPersistTaps="handled">
        {columns.map((c, i) => (
          <View key={c.id} className="min-h-[48px] flex-row items-center gap-2 border-b border-slack-darkBorder">
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
                <Button size="sm" className="bg-slack-green" onPress={rename}>
                  <Text className="text-white">OK</Text>
                </Button>
              </View>
            ) : (
              <>
                <View className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color || '#6B7280' }} />
                <Pressable className="flex-1 py-3" onPress={() => setRenaming({ id: c.id, name: c.name })} accessibilityLabel={`Rename ${c.name}`}>
                  <Text className="text-white" numberOfLines={1}>
                    {c.name} <Text className="text-xs text-gray-500">({c.tickets?.length ?? 0})</Text>
                  </Text>
                </Pressable>
                <Pressable hitSlop={10} onPress={() => move(i, i - 1)} disabled={i === 0} accessibilityLabel={`Move ${c.name} up`}>
                  <Text className={i === 0 ? 'text-gray-700' : 'text-gray-300'}>▲</Text>
                </Pressable>
                <Pressable hitSlop={10} onPress={() => move(i, i + 1)} disabled={i === columns.length - 1} accessibilityLabel={`Move ${c.name} down`}>
                  <Text className={i === columns.length - 1 ? 'text-gray-700' : 'text-gray-300'}>▼</Text>
                </Pressable>
                <Pressable hitSlop={10} onPress={() => remove(c.id, c.name, c.tickets?.length ?? 0)} accessibilityLabel={`Delete ${c.name}`}>
                  <Text className="text-red-400">🗑</Text>
                </Pressable>
              </>
            )}
          </View>
        ))}
      </ScrollView>
      <View className="flex-row items-end gap-2">
        <View className="flex-1">
          <FormField label="New column" value={newName} onChangeText={setNewName} autoCapitalize="sentences" maxLength={50} onSubmitEditing={add} />
        </View>
        <Button className="h-11 bg-slack-green" onPress={add} disabled={busy}>
          <Text className="text-white">Add</Text>
        </Button>
      </View>
    </Sheet>
  );
}
