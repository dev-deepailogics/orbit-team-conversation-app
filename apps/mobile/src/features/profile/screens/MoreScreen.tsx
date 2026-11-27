import { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Building2, ChevronRight, LogOut, Palette, Plus, ShieldCheck, type LucideIcon } from '@/components/icons';
import { Text } from '@/components/ui/text';
import { CreateWorkspaceSheet } from '@/features/admin/components/CreateWorkspaceSheet';
import { ROLE_LABELS } from '@/features/admin/utils';
import { useAuthStore } from '@/features/auth/store';
import { AvailabilitySheet } from '@/features/availability/components/AvailabilitySheet';
import { PresenceAvatar } from '@/features/availability/components/PresenceAvatar';
import { useServerNow } from '@/features/availability/hooks/useServerNow';
import { useAvailabilityStore } from '@/features/availability/store';
import { presenceLabel } from '@/features/availability/utils';
import { ThemeSheet } from '@/features/settings/components/ThemeSheet';
import { THEME_OPTIONS, useSettingsStore } from '@/features/settings/store';
import { useWorkspaceStore } from '@/features/workspaces/store';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { TabScreenProps } from '@/navigation/types';

// Slack's "More" tab: you (status) on top, then preferences. Admin entry points mirror the web home empty state.
// ponytail: profile editing waits on a PATCH /api/auth/me endpoint (Phase 3).
export function MoreScreen({ navigation }: TabScreenProps<'More'>) {
  const { colors } = useTheme();
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const loadWorkspaces = useWorkspaceStore(s => s.load);
  const theme = useSettingsStore(s => s.theme);
  const availability = useAvailabilityStore(s => s.record);
  const now = useServerNow(useIsFocused());
  const [showCreate, setShowCreate] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [showStatus, setShowStatus] = useState(false);

  if (!user) return null;
  const isSuperAdmin = user.systemRole === 'SUPER_ADMIN';
  const canCreateWorkspace = isSuperAdmin;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="pb-8">
        <View className="min-h-[56px] justify-center px-4">
          <Text className="text-2xl font-black">More</Text>
        </View>

        <Pressable
          onPress={() => setShowStatus(true)}
          className="flex-row items-center gap-4 px-4 py-4 active:bg-muted"
          accessibilityRole="button"
          accessibilityLabel={`${user.displayName}, ${presenceLabel(availability, now)}. Set your status`}
        >
          <PresenceAvatar name={user.displayName} url={user.avatarUrl} className="h-16 w-16 rounded-2xl" />
          <View className="flex-1">
            <Text className="text-xl font-black" numberOfLines={1}>
              {user.displayName}
            </Text>
            <Text className="text-muted-foreground" numberOfLines={1}>
              {presenceLabel(availability, now)}
            </Text>
            {user.systemRole !== 'USER' && (
              <View className="mt-1.5 self-start rounded-md bg-accent px-2 py-0.5">
                <Text className="text-xs font-bold text-accent-foreground">{ROLE_LABELS[user.systemRole]}</Text>
              </View>
            )}
          </View>
          <ChevronRight size={18} color={colors.subtle} />
        </Pressable>

        <View className="mt-2 border-t border-border pt-2">
          {/* ponytail: OS settings only; in-app notification preferences need a server endpoint first. */}
          <MenuRow Icon={Bell} label="Notifications" onPress={() => Linking.openSettings().catch(() => {})} />
          <MenuRow
            Icon={Palette}
            label="Appearance"
            value={THEME_OPTIONS.find(o => o.value === theme)?.label}
            onPress={() => setShowTheme(true)}
          />
        </View>

        {canCreateWorkspace && (
          <View className="mt-2 border-t border-border pt-2">
            <Text className="px-4 py-2 text-sm text-muted-foreground">
              {isSuperAdmin
                ? 'You are a Super Administrator. Manage users and roles, reset passwords, or launch workspaces.'
                : 'You are a Company Administrator. Create your organization workspace to start inviting your team.'}
            </Text>
            {isSuperAdmin && (
              <MenuRow Icon={ShieldCheck} label="Admin Console" onPress={() => navigation.navigate('AdminConsole')} />
            )}
            {isSuperAdmin && (
              <MenuRow Icon={Building2} label="Workspace control" onPress={() => navigation.navigate('WorkspaceControl')} />
            )}
            <MenuRow Icon={Plus} label="Create workspace" onPress={() => setShowCreate(true)} />
          </View>
        )}

        <View className="mt-2 border-t border-border pt-2">
          <MenuRow Icon={LogOut} label="Sign out" onPress={logout} destructive />
        </View>
      </ScrollView>

      <AvailabilitySheet visible={showStatus} onClose={() => setShowStatus(false)} />
      <ThemeSheet visible={showTheme} onClose={() => setShowTheme(false)} />
      {canCreateWorkspace && (
        <CreateWorkspaceSheet
          visible={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={ws => {
            setShowCreate(false);
            loadWorkspaces(ws.id);
            navigation.navigate('Home');
          }}
        />
      )}
    </SafeAreaView>
  );
}

function MenuRow({
  Icon,
  label,
  value,
  onPress,
  destructive,
}: {
  Icon: LucideIcon;
  label: string;
  // Current setting shown on the right (e.g. "System").
  value?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[52px] flex-row items-center gap-4 px-4 active:bg-muted"
      accessibilityRole="button"
    >
      <Icon size={22} color={destructive ? colors.destructive : colors.foreground} strokeWidth={1.75} />
      <Text className={cn('flex-1 text-lg', destructive && 'text-destructive')}>{label}</Text>
      {!!value && <Text className="text-muted-foreground">{value}</Text>}
      {!destructive && <ChevronRight size={18} color={colors.subtle} />}
    </Pressable>
  );
}
