import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type TabParamList = {
  Home: undefined;
  DMs: undefined;
  Projects: undefined;
  You: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: NavigatorScreenParams<TabParamList>;
  Channel: { channelId: string };
  Thread: { channelId: string; messageId: string };
  NewMessage: undefined;
  AdminConsole: undefined;
  WorkspaceControl: undefined;
  ProjectBoard: { projectId: string };
  TicketDetail: { projectId: string; ticketId: string };
};

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

// Tab screens can also push root stack screens (Channel, NewMessage, ...).
export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
