import { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { DateField } from '@/components/DateField';
import { FormField } from '@/components/FormField';
import { MultiSelectField } from '@/components/MultiSelectField';
import { RichTextInput, type RichTextInputHandle } from '@/components/rich-text/RichTextInput';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useWorkspaceStore } from '@/features/workspaces/store';
import { getErrorMessage } from '@/lib/api';
import { useProjectStore } from '../store';
import type { PersonRef, Ticket, TicketInput, TicketPriority } from '../types';
import { dueToInput, getAssignees, getLabels, parseDueInput, PRIORITIES, projectMembers } from '../utils';
import { Chip } from './Chip';
import { useTheme } from '@/lib/theme';

interface Props {
  visible: boolean;
  // Present when editing; absent when creating.
  ticket?: Ticket | null;
  onClose: () => void;
  onSubmit: (input: TicketInput) => Promise<void>;
}

export function TicketFormSheet({ visible, ticket, onClose, onSubmit }: Props) {
  return (
    <Sheet visible={visible} title={ticket ? 'Edit ticket' : 'New ticket'} onClose={onClose} fullHeight>
      {/* Mounted per open so every field (and the rich editors) starts from the ticket's current values. */}
      {visible && <TicketForm ticket={ticket} onSubmit={onSubmit} />}
    </Sheet>
  );
}

function TicketForm({ ticket, onSubmit }: Pick<Props, 'ticket' | 'onSubmit'>) {
  const { colors } = useTheme();
  const workspaceMembers = useWorkspaceStore(s => s.current?.members);
  const project = useProjectStore(s => s.current);
  const people = projectMembers(project, workspaceMembers ?? []);

  const [title, setTitle] = useState(ticket?.title ?? '');
  const [priority, setPriority] = useState<TicketPriority>(ticket?.priority ?? 'MEDIUM');
  const [assignees, setAssignees] = useState<PersonRef[]>(ticket ? getAssignees(ticket) : []);
  const [due, setDue] = useState(dueToInput(ticket?.dueDate));
  const [points, setPoints] = useState(ticket?.storyPoints != null ? String(ticket.storyPoints) : '');
  const [labels, setLabels] = useState(ticket ? getLabels(ticket).join(', ') : '');
  const [branch, setBranch] = useState(ticket?.gitbranch ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const description = useRef<RichTextInputHandle>(null);
  const testPlan = useRef<RichTextInputHandle>(null);
  const notes = useRef<RichTextInputHandle>(null);

  // Already-assigned people stay selectable even if they have since left the project.
  const options = [...people, ...assignees.filter(a => !people.some(p => p.uid === a.uid))].map(p => ({
    value: p.uid,
    label: p.name,
  }));

  const submit = async () => {
    if (busy) return;
    const t = title.trim();
    if (!t || t.length > 255) return setError('Title must be 1–255 characters.');
    const dueDate = parseDueInput(due);
    if (dueDate === undefined) return setError('Pick a valid due date.');
    const sp = points.trim() === '' ? null : Number(points);
    if (sp !== null && (!Number.isFinite(sp) || sp < 0)) return setError('Story points must be a positive number.');

    setBusy(true);
    setError('');
    try {
      const [desc, plan, note] = await Promise.all([
        description.current?.getMarkdown(),
        testPlan.current?.getMarkdown(),
        notes.current?.getMarkdown(),
      ]);
      await onSubmit({
        title: t,
        description: desc || null,
        priority,
        assignees,
        dueDate,
        storyPoints: sp,
        labels: labels.split(',').map(l => l.trim()).filter(Boolean),
        gitbranch: branch.trim() || null,
        testPlan: plan || null,
        notes: note || null,
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save ticket'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ScrollView className="flex-1" contentContainerClassName="gap-5 pb-6" keyboardShouldPersistTaps="handled">
        <FormField label="Title" value={title} onChangeText={setTitle} autoCapitalize="sentences" maxLength={255} />
        <RichTextInput
          ref={description}
          label="Description"
          initialMarkdown={ticket?.description}
          placeholder="Describe the work…"
          minHeight={220}
          maxHeight={360}
        />
        <View className="gap-1.5">
          <Text className="text-sm font-bold">Priority</Text>
          <View className="flex-row flex-wrap gap-2">
            {PRIORITIES.map(p => (
              <Chip key={p.value} label={p.label} color={p.color} selected={p.value === priority} onPress={() => setPriority(p.value)} />
            ))}
          </View>
        </View>
        <MultiSelectField
          label="Assignees"
          placeholder="Select assignees"
          options={options}
          selected={assignees.map(a => a.uid)}
          onChange={ids => setAssignees(ids.map(id => options.find(o => o.value === id)!).map(o => ({ uid: o.value, name: o.label })))}
          emptyText="No one is assigned to this project yet. Add people from Edit project."
        />
        <DateField label="Due date" value={due} onChange={setDue} />
        <FormField label="Story points" value={points} onChangeText={setPoints} keyboardType="decimal-pad" maxLength={5} />
        <FormField label="Labels (comma separated)" value={labels} onChangeText={setLabels} />
        <FormField label="Git branch" value={branch} onChangeText={setBranch} />
        <RichTextInput ref={testPlan} label="Test plan" initialMarkdown={ticket?.testPlan} placeholder="How should this be tested?" minHeight={140} />
        <RichTextInput ref={notes} label="Notes" initialMarkdown={ticket?.notes} placeholder="Anything else worth noting" minHeight={140} />
      </ScrollView>
      {!!error && <Text className="text-sm text-destructive">{error}</Text>}
      <Button size="lg" onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color={colors.primaryForeground} /> : <Text>{ticket ? 'Save' : 'Create'}</Text>}
      </Button>
    </>
  );
}
