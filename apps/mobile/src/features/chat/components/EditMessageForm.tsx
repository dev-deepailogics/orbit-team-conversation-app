import { useRef, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import type { Message } from '@orbit/types';
import { RichTextInput, type RichTextInputHandle } from '@/components/rich-text/RichTextInput';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getErrorMessage } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { editMessage } from '../services/chatApi';
import { useChatStore } from '../store';

interface Props {
  message: Message;
  onDone: () => void;
}

// Shown inside the long-press sheet rather than in the composer, so an unsent draft there survives.
export function EditMessageForm({ message, onDone }: Props) {
  const { colors } = useTheme();
  const updateMessage = useChatStore(s => s.updateMessage);
  const input = useRef<RichTextInputHandle>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    const content = (await input.current?.getMarkdown()) ?? '';
    if (!content.trim()) {
      Alert.alert('Message is empty', 'To remove it, delete the message instead.');
      return;
    }
    if (content === message.content) return onDone();
    setBusy(true);
    try {
      updateMessage(await editMessage(message.id, content));
      onDone();
    } catch (err) {
      Alert.alert('Message not saved', getErrorMessage(err, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <RichTextInput ref={input} initialMarkdown={message.content} autoFocus minHeight={80} maxHeight={240} />
      <Button size="lg" onPress={save} disabled={busy}>
        {busy ? <ActivityIndicator color={colors.primaryForeground} /> : <Text>Save</Text>}
      </Button>
    </>
  );
}
