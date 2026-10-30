import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useWorkspaceStore } from '@/features/workspaces/store';
import { useTheme } from '@/lib/theme';
import type { TabScreenProps } from '@/navigation/types';
import { Chip } from '../components/Chip';
import { ProjectFormSheet } from '../components/ProjectFormSheet';
import { ProjectRow } from '../components/ProjectRow';
import { createProject } from '../services/projectApi';
import { useProjectStore } from '../store';
import type { StatusFilter } from '../types';
import { STATUS_FILTERS } from '../utils';

export function ProjectsScreen({ navigation }: TabScreenProps<'Projects'>) {
  const { colors } = useTheme();
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
      <SafeAreaView className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-center text-muted-foreground">Join a workspace to see its projects.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="min-h-[56px] flex-row items-center justify-between pl-4 pr-2">
        <Text className="text-2xl font-black">Projects</Text>
        <Button variant="ghost" size="icon" onPress={() => setShowCreate(true)} accessibilityLabel="New project">
          <Plus size={24} color={colors.foreground} />
        </Button>
      </View>
      <View className="h-12 justify-center border-b border-border">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center gap-2 px-4">
          {STATUS_FILTERS.map(f => (
            <Chip key={f.value} label={f.label} selected={f.value === filter} onPress={() => setFilter(f.value)} />
          ))}
        </ScrollView>
      </View>

      {!!error && (
        <View className="flex-row items-center gap-3 px-4 py-2">
          <Text className="flex-1 text-sm text-destructive">{error}</Text>
          <Button size="sm" variant="outline" onPress={() => loadProjects(workspaceId, filter)}>
            <Text>Retry</Text>
          </Button>
        </View>
      )}

      {isLoading && projects.length === 0 ? (
        <ActivityIndicator color={colors.mutedForeground} className="mt-10" />
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
              <Text className="mt-10 px-6 text-center text-muted-foreground">
                {filter === 'all' ? 'No projects yet. Tap + to create one.' : `No ${filter} projects.`}
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
