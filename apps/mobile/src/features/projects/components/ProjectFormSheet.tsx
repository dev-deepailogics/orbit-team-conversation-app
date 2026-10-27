import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { FormField } from '@/components/FormField';
import { MultiSelectField } from '@/components/MultiSelectField';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useWorkspaceStore } from '@/features/workspaces/store';
import { getErrorMessage } from '@/lib/api';
import type { Project, ProjectInput, ProjectStatus } from '../types';
import { COLUMN_COLORS, memberName, projectMembers } from '../utils';
import { Chip } from './Chip';

interface Props {
  visible: boolean;
  project?: Project | null;
  onClose: () => void;
  onSubmit: (input: ProjectInput) => Promise<void>;
}

const STATUSES: ProjectStatus[] = ['active', 'inactive', 'delivered'];

export function ProjectFormSheet({ visible, project, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📋');
  const [color, setColor] = useState(COLUMN_COLORS[1]);
  const [status, setStatus] = useState<ProjectStatus>('active');
  const members = useWorkspaceStore(st => st.current?.members);
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Reset whenever the sheet opens so a cancelled edit doesn't leak into the next one.
  useEffect(() => {
    if (!visible) return;
    setName(project?.name ?? '');
    setDescription(project?.description ?? '');
    setIcon(project?.icon || '📋');
    setColor(project?.color || COLUMN_COLORS[1]);
    setStatus((project?.status as ProjectStatus) || 'active');
    setEmployeeIds(projectMembers(project ?? null, members ?? []).map(p => p.uid));
    setError('');
    // members intentionally omitted: don't reset the form when the member list refreshes mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, project]);

  const submit = async () => {
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) {
      setError('Project name must be 1–100 characters.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit({
        name: trimmed,
        description: description.trim() || null,
        icon: icon.trim() || '📋',
        color,
        status,
        assignedEmployees: employeeIds.flatMap(id => {
          const m = members?.find(x => x.userId === id);
          return m ? [{ uid: id, name: memberName(m) }] : [];
        }),
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save project'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} title={project ? 'Edit project' : 'New project'} onClose={onClose} fullHeight>
      <ScrollView className="flex-1" contentContainerClassName="gap-5 pb-6" keyboardShouldPersistTaps="handled">
      <FormField label="Name" value={name} onChangeText={setName} autoCapitalize="sentences" maxLength={100} returnKeyType="next" />
      <FormField
        label="Description"
        value={description}
        onChangeText={setDescription}
        autoCapitalize="sentences"
        returnKeyType="done"
      />
      <FormField label="Icon (emoji)" value={icon} onChangeText={setIcon} maxLength={4} />
      <View className="flex-row flex-wrap gap-2">
        {COLUMN_COLORS.map(c => (
          <Chip key={c} label={c === color ? '✓' : '  '} color={c} selected={c === color} onPress={() => setColor(c)} />
        ))}
      </View>
      <View className="flex-row flex-wrap gap-2">
        {STATUSES.map(s => (
          <Chip key={s} label={s} selected={s === status} onPress={() => setStatus(s)} />
        ))}
      </View>
      <MultiSelectField
        label="Team members"
        placeholder="Select who works on this project"
        options={(members ?? []).map(m => ({ value: m.userId, label: memberName(m) }))}
        selected={employeeIds}
        onChange={setEmployeeIds}
        emptyText="No workspace members found."
      />
      </ScrollView>
      {!!error && <Text className="text-xs text-red-400">{error}</Text>}
      <Button className="h-12 bg-slack-green" onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="white" /> : <Text className="font-semibold text-white">{project ? 'Save' : 'Create'}</Text>}
      </Button>
    </Sheet>
  );
}
