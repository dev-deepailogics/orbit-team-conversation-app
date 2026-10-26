import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, TextInput } from 'react-native';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getErrorMessage } from '@/lib/api';
import { createWorkspace } from '../services/adminApi';
import { isValidSlug, slugify } from '../utils';
import { Sheet } from './Sheet';

interface Props {
  visible: boolean;
  // Super admin console creates on behalf of another user; workspace admins create their own.
  withOwner?: boolean;
  onClose: () => void;
  onCreated: (workspaceName: string) => void;
}

export function CreateWorkspaceSheet({ visible, withOwner = false, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [owner, setOwner] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const slugRef = useRef<ComponentRef<typeof TextInput>>(null);
  const ownerRef = useRef<ComponentRef<typeof TextInput>>(null);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  };

  const handleSubmit = async () => {
    if (isLoading) return;
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      setError('Workspace name must be 2–50 characters.');
      return;
    }
    if (!isValidSlug(slug)) {
      setError('URL slug must be 2–50 lowercase letters, numbers or dashes.');
      return;
    }
    if (withOwner && !owner.trim()) {
      setError("Enter the owner's email or username.");
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const ws = await createWorkspace({ name: trimmedName, slug, ownerEmailOrId: withOwner ? owner.trim() : undefined });
      setName('');
      setSlug('');
      setSlugEdited(false);
      setOwner('');
      onCreated(ws.name);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create workspace'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet visible={visible} title="Create workspace" onClose={onClose}>
      <FormField
        label="Workspace name"
        placeholder="Acme Inc."
        value={name}
        onChangeText={handleNameChange}
        autoCapitalize="words"
        maxLength={50}
        returnKeyType="next"
        onSubmitEditing={() => slugRef.current?.focus()}
        submitBehavior="submit"
      />
      <FormField
        ref={slugRef}
        label="URL slug"
        placeholder="acme-inc"
        value={slug}
        onChangeText={value => {
          setSlugEdited(true);
          setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
        }}
        maxLength={50}
        returnKeyType={withOwner ? 'next' : 'go'}
        onSubmitEditing={withOwner ? () => ownerRef.current?.focus() : handleSubmit}
        submitBehavior={withOwner ? 'submit' : undefined}
      />
      {withOwner && (
        <FormField
          ref={ownerRef}
          label="Owner email or username"
          placeholder="ceo@company.com"
          value={owner}
          onChangeText={setOwner}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />
      )}

      {!!error && <Text className="text-xs text-red-400">{error}</Text>}

      <Button className="h-11 bg-slack-green" disabled={isLoading} onPress={handleSubmit}>
        {isLoading ? <ActivityIndicator color="white" /> : <Text className="font-semibold text-white">Create workspace</Text>}
      </Button>
    </Sheet>
  );
}
