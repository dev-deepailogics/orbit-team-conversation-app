import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, View } from 'react-native';
import { Paperclip, SendHorizontal, X } from '@/components/icons';
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
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { htmlToMarkdown } from '../htmlToMarkdown';
import { useAttachments } from '../hooks/useAttachments';
import type { StagedAttachment } from '../services/chatApi';
import { formatBytes, isImage } from '../utils';
import { AttachSheet } from './AttachSheet';

interface Props {
  channelId: string;
  placeholder: string;
  // Receives the message as markdown (may be empty when only files are attached). Resolve true when sent, so the draft is only cleared on success.
  onSend: (markdown: string, attachments: StagedAttachment[]) => Promise<boolean>;
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

export function Composer({ channelId, placeholder, onSend, onTyping }: Props) {
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
  const [showAttach, setShowAttach] = useState(false);
  const attachments = useAttachments(channelId);
  // iOS can't present the picker until the sheet's modal has finished dismissing (see Sheet's onDismiss).
  const pendingPick = useRef<() => void>(undefined);
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

  const choosePicker = (launch: () => void) => {
    setShowAttach(false);
    if (Platform.OS === 'ios') pendingPick.current = launch;
    else launch();
  };

  const canSend = (hasText || attachments.files.length > 0) && !attachments.isUploading && !isSending;

  const handleSend = async () => {
    if (!canSend) return;
    const markdown = htmlToMarkdown((await editor.current?.getHTML()) ?? '');
    if (!markdown && !attachments.staged.length) return;
    stopTyping();
    setIsSending(true);
    const sent = await onSend(markdown, attachments.staged);
    setIsSending(false);
    if (sent) {
      editor.current?.setValue('');
      setHasText(false);
      attachments.clear();
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
      {attachments.files.length > 0 && (
        // A handful of local picks, not server data, so a plain ScrollView is fine.
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4 pb-1 pt-2" keyboardShouldPersistTaps="handled">
          {attachments.files.map(f => (
            <View key={f.key} className="h-16 justify-center overflow-hidden rounded-lg border border-border bg-muted">
              {isImage(f.type) ? (
                <Image source={{ uri: f.uri }} className="h-16 w-16" accessibilityLabel={f.name} />
              ) : (
                <View className="w-36 flex-row items-center gap-1.5 px-2.5">
                  <Paperclip size={14} color={colors.mutedForeground} />
                  <Text className="shrink text-sm font-bold" numberOfLines={2}>
                    {f.name}
                  </Text>
                </View>
              )}
              {/* Size as uploaded (after compression), so the saving is visible. */}
              {!!f.staged && (
                <Text className="absolute bottom-0 left-0 right-0 bg-overlay/50 text-center text-2xs text-primary-foreground">
                  {formatBytes(f.staged.fileSize)}
                </Text>
              )}
              {!f.staged && (
                <View className="absolute inset-0 items-center justify-center bg-background/60">
                  <ActivityIndicator color={colors.foreground} size="small" />
                </View>
              )}
              <Pressable
                onPress={() => attachments.remove(f.key)}
                hitSlop={10}
                className="absolute right-1 top-1 h-5 w-5 items-center justify-center rounded-full bg-foreground"
                accessibilityRole="button"
                accessibilityLabel={`Remove ${f.name}`}
              >
                <X size={12} color={colors.background} strokeWidth={3} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
      <View className="flex-row items-center gap-2 pb-1.5 pl-2 pr-3">
        <Pressable
          onPress={() => setShowAttach(true)}
          hitSlop={6}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-muted"
          accessibilityRole="button"
          accessibilityLabel="Attach files"
        >
          <Paperclip size={19} color={colors.mutedForeground} />
        </Pressable>
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
      <AttachSheet
        visible={showAttach}
        onClose={() => setShowAttach(false)}
        onDismiss={() => {
          pendingPick.current?.();
          pendingPick.current = undefined;
        }}
        onPickMedia={() => choosePicker(attachments.pickMedia)}
        onPickFiles={() => choosePicker(attachments.pickFiles)}
      />
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
