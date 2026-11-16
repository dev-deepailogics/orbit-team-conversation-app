import { useRef } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Channel } from '@orbit/types';
import { getErrorMessage } from '@/lib/api';
import type { RootStackParamList } from '@/navigation/types';
import { openDirectMessage } from '../services/workspaceApi';
import { useWorkspaceStore } from '../store';
import { pendingDMUserId } from '../utils';

// Opens a channel row; placeholder DM rows (see splitChannels) create the real DM first.
export function useOpenChannel() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const busy = useRef(false);

  return async (channel: Channel) => {
    const userId = pendingDMUserId(channel);
    if (!userId) return navigation.navigate('Channel', { channelId: channel.id });
    if (busy.current) return;
    busy.current = true;
    try {
      const dm = await openDirectMessage(channel.workspaceId, userId);
      useWorkspaceStore.getState().upsertChannel(dm);
      navigation.navigate('Channel', { channelId: dm.id });
    } catch (err) {
      Alert.alert('Could not open conversation', getErrorMessage(err, 'Please try again.'));
    } finally {
      busy.current = false;
    }
  };
}
