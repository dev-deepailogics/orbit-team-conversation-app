import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import {
  EnrichedTextInput,
  type EnrichedTextInputInstance,
  type HtmlStyle,
  type OnChangeSelectionEvent,
  type OnChangeStateEvent,
} from 'react-native-enriched-html';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { htmlToMarkdown } from '../htmlToMarkdown';
import { FormatToolbar, type Format } from './FormatToolbar';
import { LinkSheet } from './LinkSheet';

interface Props {
  placeholder: string;
  // Receives the message as markdown. Resolve true when sent, so the draft is only cleared on success.
  onSend: (markdown: string) => Promise<boolean>;
  onTyping?: (isTyping: boolean) => void;
}

const TYPING_IDLE_MS = 3000;

// Dark-theme look for what the editor shows while typing (headings, code, quotes, lists, links).
const HTML_STYLE: HtmlStyle = {
  h1: { fontSize: 24, bold: true },
  h2: { fontSize: 20, bold: true },
  blockquote: {
    borderColor: '#6B7280',
    borderWidth: 4,
    gapWidth: 8,
    color: '#D1D5DB',
  },
  codeblock: { color: '#E5E7EB', borderRadius: 6, backgroundColor: '#0F1114' },
  code: { color: '#FDBA74', backgroundColor: '#2A2D31' },
  a: { color: '#1D9BD1', textDecorationLine: 'underline' },
  ul: { bulletColor: '#9CA3AF', bulletSize: 6, marginLeft: 8, gapWidth: 8 },
  ol: { gapWidth: 8, marginLeft: 8, markerColor: '#9CA3AF' },
};

const inputStyle = {
  minHeight: 40,
  maxHeight: 140,
  fontSize: 15,
  color: '#FFFFFF',
  backgroundColor: '#19171D',
  borderWidth: 1,
  borderColor: '#374151',
  borderRadius: 8,
  paddingHorizontal: 12,
  paddingVertical: 8,
  flex: 1,
};

export function Composer({ placeholder, onSend, onTyping }: Props) {
  const editor = useRef<EnrichedTextInputInstance>(null);
  const [state, setState] = useState<OnChangeStateEvent>();
  const [selection, setSelection] = useState<OnChangeSelectionEvent>({
    start: 0,
    end: 0,
    text: '',
  });
  const [hasText, setHasText] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const typing = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Read the latest callback in the unmount cleanup without re-running the effect.
  const onTypingRef = useRef(onTyping);
  onTypingRef.current = onTyping;

  const stopTyping = () => {
    clearTimeout(idleTimer.current);
    if (typing.current) {
      typing.current = false;
      onTypingRef.current?.(false);
    }
  };

  useEffect(() => stopTyping, []);

  const handleChangeText = (value: string) => {
    setHasText(!!value.trim());
    if (!value.trim()) return stopTyping();
    if (!typing.current) {
      typing.current = true;
      onTyping?.(true);
    }
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const handleFormat = (format: Format) => {
    const e = editor.current;
    if (!e) return;
    const actions: Record<Format, () => void> = {
      bold: e.toggleBold,
      italic: e.toggleItalic,
      strike: e.toggleStrikeThrough,
      h1: e.toggleH1,
      h2: e.toggleH2,
      bullet: e.toggleUnorderedList,
      numbered: e.toggleOrderedList,
      quote: e.toggleBlockQuote,
      code: e.toggleInlineCode,
      codeblock: e.toggleCodeBlock,
      link: () => setShowLink(true),
    };
    actions[format]();
  };

  const canSend = hasText && !isSending;

  const handleSend = async () => {
    if (!canSend) return;
    const markdown = htmlToMarkdown((await editor.current?.getHTML()) ?? '');
    if (!markdown) return;
    stopTyping();
    setIsSending(true);
    const sent = await onSend(markdown);
    setIsSending(false);
    if (sent) {
      editor.current?.setValue('');
      setHasText(false);
    }
  };

  return (
    <View className="border-t border-slack-darkBorder bg-slack-darkBg">
      <FormatToolbar state={state} onPress={handleFormat} />
      <View className="flex-row items-end gap-2 px-3 pb-2 pt-1">
        <EnrichedTextInput
          ref={editor}
          placeholder={placeholder}
          placeholderTextColor="#6B7280"
          cursorColor="#1D9BD1"
          selectionColor="#1D9BD155"
          htmlStyle={HTML_STYLE}
          style={inputStyle}
          onChangeText={e => handleChangeText(e.nativeEvent.value)}
          onChangeState={e => setState(e.nativeEvent)}
          onChangeSelection={e => setSelection(e.nativeEvent)}
        />
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          className={cn(
            'h-10 w-10 items-center justify-center rounded-lg',
            canSend ? 'bg-slack-green' : 'bg-gray-700',
          )}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !canSend }}
        >
          {isSending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-lg font-bold text-white">➤</Text>
          )}
        </Pressable>
      </View>
      <LinkSheet
        visible={showLink}
        hasSelection={selection.end > selection.start}
        onClose={() => {
          setShowLink(false);
          editor.current?.focus();
        }}
        onSubmit={(url, label) =>
          editor.current?.setLink(
            selection.start,
            selection.end,
            selection.text || label.trim() || url,
            url,
          )
        }
      />
    </View>
  );
}
