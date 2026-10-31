import { Pressable, Switch, View } from 'react-native';
import { FolderOpen, Images, type LucideIcon } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/ui/text';
import { useSettingsStore } from '@/features/settings/store';
import { useTheme } from '@/lib/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onDismiss: () => void;
  onPickMedia: () => void;
  onPickFiles: () => void;
}

// Slack's composer "+" sheet: where to attach from, plus whether to shrink photos first.
export function AttachSheet({ visible, onClose, onDismiss, onPickMedia, onPickFiles }: Props) {
  const { colors } = useTheme();
  const compress = useSettingsStore(s => s.compressUploads);
  const setCompress = useSettingsStore(s => s.setCompressUploads);

  const option = (Icon: LucideIcon, label: string, onPress: () => void) => (
    <Pressable onPress={onPress} className="min-h-[52px] flex-row items-center gap-3 px-4 active:bg-muted" accessibilityRole="button">
      <Icon size={20} color={colors.foreground} />
      <Text className="font-bold">{label}</Text>
    </Pressable>
  );

  return (
    <Sheet visible={visible} title="Attach" onClose={onClose} onDismiss={onDismiss}>
      <View className="overflow-hidden rounded-xl border border-border">
        {option(Images, 'Photos & videos', onPickMedia)}
        <View className="h-px bg-border" />
        {option(FolderOpen, 'Files', onPickFiles)}
      </View>
      <View className="min-h-[60px] flex-row items-center gap-3 rounded-xl border border-border px-4">
        <View className="flex-1">
          <Text className="font-bold">Compress photos</Text>
          <Text className="text-sm text-muted-foreground">
            {compress ? 'Resized to 1920px, usually 80–90% smaller.' : 'Sends originals at full quality.'}
          </Text>
        </View>
        <Switch
          value={compress}
          onValueChange={setCompress}
          trackColor={{ true: colors.primary, false: colors.border }}
          accessibilityLabel="Compress photos"
        />
      </View>
    </Sheet>
  );
}
