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
import { FormatToolbar, type Format } from './FormatToolbar';
import { LinkSheet } from './LinkSheet';

// Dark-theme look for what the editor shows while typing (headings, code, quotes, lists, links).
export const RICH_HTML_STYLE: HtmlStyle = {
  h1: { fontSize: 24, bold: true },
  h2: { fontSize: 20, bold: true },
  blockquote: { borderColor: '#6B7280', borderWidth: 4, gapWidth: 8, color: '#D1D5DB' },
  codeblock: { color: '#E5E7EB', borderRadius: 6, backgroundColor: '#0F1114' },
  code: { color: '#FDBA74', backgroundColor: '#2A2D31' },
  a: { color: '#1D9BD1', textDecorationLine: 'underline' },
  ul: { bulletColor: '#9CA3AF', bulletSize: 6, marginLeft: 8, gapWidth: 8 },
  ol: { gapWidth: 8, marginLeft: 8, markerColor: '#9CA3AF' },
};

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
  const editor = useRef<EnrichedTextInputInstance>(null);
  const [state, setState] = useState<OnChangeStateEvent>();
  const [selection, setSelection] = useState<OnChangeSelectionEvent>({ start: 0, end: 0, text: '' });
  const [showLink, setShowLink] = useState(false);
  const inputStyle = useMemo(
    () => ({
      minHeight,
      maxHeight,
      fontSize: 15,
      color: '#FFFFFF',
      backgroundColor: '#19171D',
      paddingHorizontal: 12,
      paddingVertical: 10,
    }),
    [minHeight, maxHeight],
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
      {!!label && <Text className="text-xs font-semibold text-gray-300">{label}</Text>}
      <View className="overflow-hidden rounded-lg border border-gray-700 bg-slack-darkBg">
        <FormatToolbar state={state} onPress={handleFormat} />
        <EnrichedTextInput
          ref={editor}
          defaultValue={defaultValue}
          autoFocus={autoFocus}
          placeholder={placeholder}
          placeholderTextColor="#6B7280"
          cursorColor="#1D9BD1"
          selectionColor="#1D9BD155"
          htmlStyle={RICH_HTML_STYLE}
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
