import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from '@/components/icons';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/lib/theme';
import type { Project } from '../types';

export const ProjectRow = memo(function ProjectRowImpl({ project, onPress }: { project: Project; onPress: () => void }) {
  const { colors } = useTheme();
  const tickets = project._count?.tickets ?? 0;
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[68px] flex-row items-center gap-3 px-4 py-3 active:bg-muted"
      accessibilityRole="button"
      accessibilityLabel={`Project ${project.name}, ${tickets} tickets`}
    >
      <View
        className="h-11 w-11 items-center justify-center rounded-xl"
        style={{ backgroundColor: project.color || colors.primary }}
      >
        <Text className="text-lg">{project.icon || '📋'}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-lg font-bold" numberOfLines={1}>
          {project.name}
        </Text>
        <Text className="text-sm text-muted-foreground" numberOfLines={1}>
          {tickets} {tickets === 1 ? 'ticket' : 'tickets'}
          {project.status ? ` · ${project.status}` : ''}
          {project.description ? ` · ${project.description}` : ''}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.subtle} />
    </Pressable>
  );
});
