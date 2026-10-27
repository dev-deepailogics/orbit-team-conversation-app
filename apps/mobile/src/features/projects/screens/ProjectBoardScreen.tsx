import { useEffect, useMemo, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { getErrorMessage } from '@/lib/api';
import type { ScreenProps } from '@/navigation/types';
import { Chip } from '../components/Chip';
import { ColumnsSheet } from '../components/ColumnsSheet';
import { MoveSheet } from '../components/MoveSheet';
import { ProjectFormSheet } from '../components/ProjectFormSheet';
import { TicketCard } from '../components/TicketCard';
import { TicketFormSheet } from '../components/TicketFormSheet';
import { createTicket, deleteProject, moveTicket, updateProject } from '../services/projectApi';
import { useProjectStore } from '../store';
import type { Ticket } from '../types';
import { filterTickets } from '../utils';

export function ProjectBoardScreen({ route, navigation }: ScreenProps<'ProjectBoard'>) {
  const { projectId } = route.params;
  const project = useProjectStore(s => (s.current?.id === projectId ? s.current : null));
  const isLoading = useProjectStore(s => s.isLoading);
  const error = useProjectStore(s => s.error);
  const openProject = useProjectStore(s => s.openProject);
  const closeProject = useProjectStore(s => s.closeProject);
  const [columnId, setColumnId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<'ticket' | 'edit' | 'columns' | null>(null);
  const [moving, setMoving] = useState<Ticket | null>(null);

  useEffect(() => {
    openProject(projectId);
    return closeProject;
  }, [projectId, openProject, closeProject]);

  // The project can be deleted elsewhere (socket clears `current`) once it had loaded.
  const columns = project?.columns ?? [];
  const active = columns.find(c => c.id === columnId) ?? columns[0];
  const tickets = useMemo(() => filterTickets(active?.tickets ?? [], query), [active?.tickets, query]);

  const handleMove = async (ticket: Ticket, toColumnId: string) => {
    setMoving(null);
    const store = useProjectStore.getState();
    const target = columns.find(c => c.id === toColumnId);
    const index = target?.tickets?.length ?? 0;
    store.moveTicket(ticket, toColumnId, index);
    try {
      await moveTicket(projectId, ticket.id, toColumnId, index);
    } catch (err) {
      Alert.alert('Move failed', getErrorMessage(err, 'Please try again.'));
      store.openProject(projectId); // resync after the optimistic move
    }
  };

  const confirmDelete = () =>
    Alert.alert('Delete project?', `"${project?.name}" and all its tickets will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProject(projectId);
            useProjectStore.getState().removeProject(projectId);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Delete failed', getErrorMessage(err, 'Please try again.'));
          }
        },
      },
    ]);

  const openMenu = () => {
    const items = [
      { label: 'Edit project', run: () => setSheet('edit') },
      { label: 'Manage columns', run: () => setSheet('columns') },
      { label: 'Delete project', run: confirmDelete, destructive: true },
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...items.map(i => i.label), 'Cancel'], cancelButtonIndex: items.length, destructiveButtonIndex: 2 },
        i => items[i]?.run(),
      );
    } else {
      Alert.alert(project?.name ?? 'Project', undefined, [
        ...items.map(i => ({ text: i.label, onPress: i.run, style: i.destructive ? ('destructive' as const) : undefined })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  };

  const header = (
    <View className="flex-row items-center gap-4 border-b border-slack-darkBorder px-5 py-4">
      <Pressable onPress={navigation.goBack} hitSlop={12} accessibilityLabel="Back">
        <Text className="text-2xl text-white">‹</Text>
      </Pressable>
      <Text className="flex-1 text-lg font-bold text-white" numberOfLines={1}>
        {project ? `${project.icon || '📋'} ${project.name}` : 'Project'}
      </Text>
      {project && (
        <Pressable onPress={openMenu} hitSlop={12} accessibilityLabel="Project options">
          <Text className="text-2xl text-white">⋯</Text>
        </Pressable>
      )}
    </View>
  );

  if (!project) {
    return (
      <SafeAreaView className="flex-1 bg-slack-darkBg" edges={['top']}>
        {header}
        <View className="flex-1 items-center justify-center gap-4 p-6">
          {error ? (
            <>
              <Text className="text-center text-gray-300">{error}</Text>
              <Button className="bg-slack-activeChannel" onPress={() => openProject(projectId)}>
                <Text className="text-white">Retry</Text>
              </Button>
            </>
          ) : isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-gray-400">This project is no longer available.</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slack-darkBg" edges={['top', 'bottom']}>
      {header}
      <View className="h-16 justify-center">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center gap-2 px-5">
          {columns.map(c => (
            <Chip
              key={c.id}
              label={`${c.name} ${c.tickets?.length ?? 0}`}
              color={c.color || undefined}
              selected={c.id === active?.id}
              onPress={() => setColumnId(c.id)}
            />
          ))}
        </ScrollView>
      </View>
      <View className="px-5 pb-4">
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search tickets"
          placeholderTextColor="#6B7280"
          className="h-11 border-gray-700 bg-slack-darkSidebar text-white"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {columns.length === 0 ? (
        <View className="flex-1 items-center gap-3 p-6">
          <Text className="text-center text-gray-400">This project has no columns yet.</Text>
          <Button className="bg-slack-green" onPress={() => setSheet('columns')}>
            <Text className="text-white">Add a column</Text>
          </Button>
        </View>
      ) : (
        <FlashList
          data={tickets}
          keyExtractor={t => t.id}
          refreshing={isLoading}
          onRefresh={() => openProject(projectId)}
          contentContainerClassName="pb-24"
          renderItem={({ item }) => (
            <TicketCard
              ticket={item}
              onPress={() => navigation.navigate('TicketDetail', { projectId, ticketId: item.id })}
              onLongPress={() => setMoving(item)}
            />
          )}
          ListEmptyComponent={
            <Text className="mt-10 text-center text-gray-400">{query ? 'No matching tickets.' : 'No tickets in this column.'}</Text>
          }
        />
      )}

      {!!active && (
        <Pressable
          onPress={() => setSheet('ticket')}
          className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full bg-slack-green active:opacity-80"
          accessibilityLabel="New ticket"
        >
          <Text className="text-3xl text-white">＋</Text>
        </Pressable>
      )}

      <TicketFormSheet
        visible={sheet === 'ticket'}
        onClose={() => setSheet(null)}
        onSubmit={async input => {
          if (!active) return;
          const t = await createTicket(projectId, { ...input, columnId: active.id, title: input.title ?? '' });
          useProjectStore.getState().addTicket(t);
          setSheet(null);
        }}
      />
      <ProjectFormSheet
        visible={sheet === 'edit'}
        project={project}
        onClose={() => setSheet(null)}
        onSubmit={async input => {
          useProjectStore.getState().upsertProject(await updateProject(projectId, input));
          setSheet(null);
        }}
      />
      <ColumnsSheet visible={sheet === 'columns'} projectId={projectId} onClose={() => setSheet(null)} />
      <MoveSheet
        visible={!!moving}
        currentColumnId={moving?.columnId}
        onClose={() => setMoving(null)}
        onPick={id => moving && handleMove(moving, id)}
      />
    </SafeAreaView>
  );
}
