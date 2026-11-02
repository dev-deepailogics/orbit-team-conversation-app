import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

// For navigating from outside React (push notification taps).
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
