import { useEffect, useState } from 'react';
import { FlatList, Image, Linking, Modal, Pressable, StatusBar, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Attachment } from '@orbit/types';
import { Download, X } from '@/components/icons';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/lib/theme';
import { fileUrl } from '../utils';

export interface Gallery {
  images: Attachment[];
  index: number;
}

interface Props {
  gallery: Gallery | null;
  onClose: () => void;
}

// Full-screen, swipeable viewer for a message's images (Slack's photo viewer).
// ponytail: no pinch-zoom; add react-native-gesture-handler + a zoomable page when people ask for it.
export function ImageViewer({ gallery, onClose }: Props) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (gallery) setIndex(gallery.index);
  }, [gallery]);

  const images = gallery?.images ?? [];
  const current = images[index];

  return (
    <Modal visible={!!gallery} animationType="fade" onRequestClose={onClose} statusBarTranslucent supportedOrientations={['portrait', 'landscape']}>
      <StatusBar barStyle="light-content" />
      <View className="flex-1 bg-overlay">
        {gallery && (
          <FlatList
            data={images}
            keyExtractor={a => a.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={gallery.index}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={e => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => (
              <Image source={{ uri: fileUrl(item) }} style={{ width, height }} resizeMode="contain" accessibilityLabel={item.fileName} />
            )}
          />
        )}
        <SafeAreaView className="absolute left-0 right-0 top-0 flex-row items-center gap-2 px-2" edges={['top']}>
          <Pressable onPress={onClose} hitSlop={8} className="h-11 w-11 items-center justify-center" accessibilityRole="button" accessibilityLabel="Close">
            <X size={24} color={colors.primaryForeground} />
          </Pressable>
          <View className="flex-1 items-center">
            <Text className="font-bold text-primary-foreground" numberOfLines={1}>
              {current?.fileName}
            </Text>
            {images.length > 1 && (
              <Text className="text-xs text-primary-foreground">
                {index + 1} of {images.length}
              </Text>
            )}
          </View>
          <Pressable
            onPress={() => current && Linking.openURL(`${fileUrl(current)}?download=1`)}
            hitSlop={8}
            className="h-11 w-11 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Download image"
          >
            <Download size={22} color={colors.primaryForeground} />
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
