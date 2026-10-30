import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SendHorizontal } from '@/components/icons';
import {
  EnrichedTextInput,
  type EnrichedTextInputInstance,
  type OnChangeSelectionEvent,
  type OnChangeStateEvent,
} from 'react-native-enriched-html';
import { FormatToolbar, type Format } from '@/components/rich-text/FormatToolbar';
import { LinkSheet } from '@/components/rich-text/LinkSheet';
import { RICH_HTML_STYLE, RICH_INPUT_TEXT } from '@/components/rich-text/RichTextInput';
import { perScheme, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { htmlToMarkdown } from '../htmlToMarkdown';

interface Props {
  placeholder: string;
  // Receives the message as markdown. Resolve true when sent, so the draft is only cleared on success.
  onSend: (markdown: string) => Promise<boolean>;
  onTyping?: (isTyping: boolean) => void;
}

const TYPING_IDLE_MS = 3000;

const inputStyle = perScheme((_, scheme) => ({
  ...RICH_INPUT_TEXT[scheme],
  minHeight: 40,
  maxHeight: 160,
  paddingHorizontal: 16,
  paddingTop: 12,
  paddingBottom: 4,
}));

export function Composer({ placeholder, onSend, onTyping }: Props) {
  const { colors, scheme } = useTheme();
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
    // Slack's mobile composer: full-width field on top, formatting + send on the row beneath.
    <View className="border-t border-border bg-background">
      <EnrichedTextInput
        ref={editor}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        cursorColor={colors.link}
        selectionColor={colors.link}
        htmlStyle={RICH_HTML_STYLE[scheme]}
        style={inputStyle[scheme]}
        onChangeText={e => handleChangeText(e.nativeEvent.value)}
        onChangeState={e => setState(e.nativeEvent)}
        onChangeSelection={e => setSelection(e.nativeEvent)}
      />
      <View className="flex-row items-center gap-2 pb-1.5 pl-2 pr-3">
        <View className="flex-1">
          <FormatToolbar state={state} onPress={handleFormat} />
        </View>
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          hitSlop={6}
          className={cn('h-9 w-9 items-center justify-center rounded-lg', canSend && 'bg-primary active:bg-primary/90')}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !canSend }}
        >
          {isSending ? (
            <ActivityIndicator color={colors.mutedForeground} size="small" />
          ) : (
            <SendHorizontal size={18} strokeWidth={2.25} color={canSend ? colors.primaryForeground : colors.subtle} />
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
