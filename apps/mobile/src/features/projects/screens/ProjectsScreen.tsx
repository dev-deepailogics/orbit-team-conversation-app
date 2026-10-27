import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useWorkspaceStore } from '@/features/workspaces/store';
import type { TabScreenProps } from '@/navigation/types';
import { Chip } from '../components/Chip';
import { ProjectFormSheet } from '../components/ProjectFormSheet';
import { ProjectRow } from '../components/ProjectRow';
import { createProject } from '../services/projectApi';
import { useProjectStore } from '../store';
import type { StatusFilter } from '../types';
import { STATUS_FILTERS } from '../utils';

export function ProjectsScreen({ navigation }: TabScreenProps<'Projects'>) {
  const workspaceId = useWorkspaceStore(s => s.current?.id);
  const projects = useProjectStore(s => s.projects);
  const isLoading = useProjectStore(s => s.isLoading);
  const error = useProjectStore(s => s.error);
  const loadProjects = useProjectStore(s => s.loadProjects);
  const upsertProject = useProjectStore(s => s.upsertProject);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (workspaceId) loadProjects(workspaceId, filter);
  }, [workspaceId, filter, loadProjects]);

  if (!workspaceId) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slack-darkBg p-6">
        <Text className="text-center text-gray-400">Join a workspace to see its projects.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slack-darkBg" edges={['top']}>
      <View className="flex-row items-center justify-between px-5 pb-3 pt-4">
        <Text className="text-2xl font-bold text-white">Projects</Text>
        <Pressable onPress={() => setShowCreate(true)} hitSlop={12} accessibilityLabel="New project">
          <Text className="text-3xl text-white">＋</Text>
        </Pressable>
      </View>
      <View className="h-14">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-5">
          {STATUS_FILTERS.map(f => (
            <Chip key={f.value} label={f.label} selected={f.value === filter} onPress={() => setFilter(f.value)} />
          ))}
        </ScrollView>
      </View>

      {!!error && (
        <View className="flex-row items-center gap-3 px-4 py-2">
          <Text className="flex-1 text-xs text-red-400">{error}</Text>
          <Button size="sm" className="bg-slack-activeChannel" onPress={() => loadProjects(workspaceId, filter)}>
            <Text className="text-white">Retry</Text>
          </Button>
        </View>
      )}

      {isLoading && projects.length === 0 ? (
        <ActivityIndicator color="white" className="mt-10" />
      ) : (
        <FlashList
          data={projects}
          keyExtractor={p => p.id}
          refreshing={isLoading}
          onRefresh={() => loadProjects(workspaceId, filter)}
          renderItem={({ item }) => (
            <ProjectRow project={item} onPress={() => navigation.navigate('ProjectBoard', { projectId: item.id })} />
          )}
          ListEmptyComponent={
            !error ? (
              <Text className="mt-10 text-center text-gray-400">
                {filter === 'all' ? 'No projects yet. Tap ＋ to create one.' : `No ${filter} projects.`}
              </Text>
            ) : null
          }
        />
      )}

      <ProjectFormSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={async input => {
          const p = await createProject(workspaceId, input);
          upsertProject(p);
          setShowCreate(false);
          navigation.navigate('ProjectBoard', { projectId: p.id });
        }}
      />
    </SafeAreaView>
  );
}
