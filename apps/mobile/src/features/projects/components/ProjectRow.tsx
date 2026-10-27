import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import type { Project } from '../types';

export const ProjectRow = memo(function ProjectRowImpl({ project, onPress }: { project: Project; onPress: () => void }) {
  const tickets = project._count?.tickets ?? 0;
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[64px] flex-row items-center gap-3 border-b border-slack-darkBorder px-5 py-4 active:bg-white/5"
      accessibilityRole="button"
      accessibilityLabel={`Project ${project.name}, ${tickets} tickets`}
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: project.color || '#007A5A' }}
      >
        <Text className="text-lg">{project.icon || '📋'}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-white" numberOfLines={1}>
          {project.name}
        </Text>
        <Text className="text-xs text-gray-400" numberOfLines={1}>
          {tickets} {tickets === 1 ? 'ticket' : 'tickets'}
          {project.status ? ` · ${project.status}` : ''}
          {project.description ? ` · ${project.description}` : ''}
        </Text>
      </View>
      <Text className="text-gray-500">›</Text>
    </Pressable>
  );
});
