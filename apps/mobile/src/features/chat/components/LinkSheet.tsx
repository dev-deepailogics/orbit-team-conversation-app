import { useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { normalizeUrl } from '../link';

interface Props {
  visible: boolean;
  // Text already selected in the composer becomes the link label; otherwise ask for one.
  hasSelection: boolean;
  onClose: () => void;
  onSubmit: (url: string, label: string) => void;
}

export function LinkSheet({ visible, hasSelection, onClose, onSubmit }: Props) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');

  const close = () => {
    setUrl('');
    setLabel('');
    setError('');
    onClose();
  };

  const handleSubmit = () => {
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError('Enter a valid web or email link.');
      return;
    }
    onSubmit(normalized, label);
    close();
  };

  return (
    <Sheet visible={visible} title="Add link" onClose={close}>
      {!hasSelection && (
        <FormField
          label="Text (optional)"
          placeholder="Link text"
          value={label}
          onChangeText={setLabel}
          autoCapitalize="sentences"
        />
      )}
      <FormField
        label="Link"
        placeholder="https://example.com"
        value={url}
        onChangeText={v => {
          setUrl(v);
          setError('');
        }}
        keyboardType="url"
        autoComplete="off"
        textContentType="URL"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
        autoFocus
      />
      {!!error && <Text className="text-xs text-red-400">{error}</Text>}
      <Button className="h-11 bg-slack-activeChannel" onPress={handleSubmit}>
        <Text className="font-semibold text-white">Add link</Text>
      </Button>
    </Sheet>
  );
}
