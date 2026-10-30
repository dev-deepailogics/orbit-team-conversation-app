import { useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { View } from 'react-native';
import {
  EnrichedTextInput,
  type EnrichedTextInputInstance,
  type HtmlStyle,
  type OnChangeSelectionEvent,
  type OnChangeStateEvent,
} from 'react-native-enriched-html';
import { Text } from '@/components/ui/text';
import { htmlToMarkdown } from '@/features/chat/htmlToMarkdown';
import { markdownToHtml } from '@/lib/markdownToHtml';
import { FONT, perScheme, useTheme } from '@/lib/theme';
import { FormatToolbar, type Format } from './FormatToolbar';
import { LinkSheet } from './LinkSheet';

// Slack's look for what the editor shows while typing (headings, code, quotes, lists, links); matches MarkdownText.
export const RICH_HTML_STYLE = perScheme<HtmlStyle>(c => ({
  h1: { fontSize: 22, bold: true },
  h2: { fontSize: 18, bold: true },
  blockquote: { borderColor: c.border, borderWidth: 4, gapWidth: 10, color: c.foreground },
  codeblock: { color: c.foreground, borderRadius: 8, backgroundColor: c.codeBg },
  code: { color: c.destructive, backgroundColor: c.codeBg },
  a: { color: c.link, textDecorationLine: 'none' },
  ul: { bulletColor: c.foreground, bulletSize: 5, marginLeft: 8, gapWidth: 10 },
  ol: { gapWidth: 10, marginLeft: 8, markerColor: c.foreground },
}));

// Shared by the composer and form editors.
export const RICH_INPUT_TEXT = perScheme(c => ({ fontFamily: FONT, fontSize: 15, lineHeight: 22, color: c.foreground }));

export interface RichTextInputHandle {
  // Reads on demand: getHTML per keystroke is slow, and forms only need the value on submit.
  getMarkdown: () => Promise<string>;
}

interface Props {
  ref?: Ref<RichTextInputHandle>;
  label?: string;
  // Markdown to start with. Read once on mount; remount (key) to load a different value.
  initialMarkdown?: string | null;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  autoFocus?: boolean;
}

// Formatted text field (bold, lists, code, links…) that reads and writes markdown, like chat messages.
export function RichTextInput({
  ref,
  label,
  initialMarkdown,
  placeholder,
  minHeight = 120,
  maxHeight = 280,
  autoFocus,
}: Props) {
  const { colors, scheme } = useTheme();
  const editor = useRef<EnrichedTextInputInstance>(null);
  const [state, setState] = useState<OnChangeStateEvent>();
  const [selection, setSelection] = useState<OnChangeSelectionEvent>({ start: 0, end: 0, text: '' });
  const [showLink, setShowLink] = useState(false);
  const inputStyle = useMemo(
    () => ({
      ...RICH_INPUT_TEXT[scheme],
      minHeight,
      maxHeight,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      paddingVertical: 10,
    }),
    [minHeight, maxHeight, scheme, colors],
  );
  const defaultValue = useMemo(() => markdownToHtml(initialMarkdown ?? ''), [initialMarkdown]);

  useImperativeHandle(ref, () => ({
    getMarkdown: async () => htmlToMarkdown((await editor.current?.getHTML()) ?? ''),
  }));

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

  return (
    <View className="gap-1.5">
      {!!label && <Text className="text-sm font-bold">{label}</Text>}
      <View className="overflow-hidden rounded-lg border border-input bg-background">
        <View className="border-b border-border bg-muted py-1">
          <FormatToolbar state={state} onPress={handleFormat} />
        </View>
        <EnrichedTextInput
          ref={editor}
          defaultValue={defaultValue}
          autoFocus={autoFocus}
          placeholder={placeholder}
          placeholderTextColor={colors.subtle}
          cursorColor={colors.link}
          selectionColor={colors.link}
          htmlStyle={RICH_HTML_STYLE[scheme]}
          style={inputStyle}
          onChangeState={e => setState(e.nativeEvent)}
          onChangeSelection={e => setSelection(e.nativeEvent)}
        />
      </View>
      <LinkSheet
        visible={showLink}
        hasSelection={selection.end > selection.start}
        onClose={() => {
          setShowLink(false);
          editor.current?.focus();
        }}
        onSubmit={(url, linkLabel) =>
          editor.current?.setLink(selection.start, selection.end, selection.text || linkLabel.trim() || url, url)
        }
      />
    </View>
  );
}
