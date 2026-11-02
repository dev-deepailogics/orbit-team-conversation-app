import { Pressable, ScrollView } from 'react-native';
import type { OnChangeStateEvent } from 'react-native-enriched-html';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Italic,
  Link,
  List,
  ListOrdered,
  SquareCode,
  Strikethrough,
  TextQuote,
  type LucideIcon,
} from '@/components/icons';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

export type Format =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'h1'
  | 'h2'
  | 'bullet'
  | 'numbered'
  | 'quote'
  | 'code'
  | 'codeblock'
  | 'link';

type StateKey = keyof Pick<
  OnChangeStateEvent,
  | 'bold'
  | 'italic'
  | 'strikeThrough'
  | 'h1'
  | 'h2'
  | 'unorderedList'
  | 'orderedList'
  | 'blockQuote'
  | 'inlineCode'
  | 'codeBlock'
  | 'link'
>;

// Same set and order as the web editor toolbar. `key` is the editor's own state for the button highlight.
const TOOLS: Array<{ format: Format; key: StateKey; Icon: LucideIcon; a11y: string }> = [
  { format: 'bold', key: 'bold', Icon: Bold, a11y: 'Bold' },
  { format: 'italic', key: 'italic', Icon: Italic, a11y: 'Italic' },
  { format: 'strike', key: 'strikeThrough', Icon: Strikethrough, a11y: 'Strikethrough' },
  { format: 'h1', key: 'h1', Icon: Heading1, a11y: 'Heading 1' },
  { format: 'h2', key: 'h2', Icon: Heading2, a11y: 'Heading 2' },
  { format: 'bullet', key: 'unorderedList', Icon: List, a11y: 'Bullet list' },
  { format: 'numbered', key: 'orderedList', Icon: ListOrdered, a11y: 'Numbered list' },
  { format: 'quote', key: 'blockQuote', Icon: TextQuote, a11y: 'Blockquote' },
  { format: 'code', key: 'inlineCode', Icon: Code, a11y: 'Inline code' },
  { format: 'codeblock', key: 'codeBlock', Icon: SquareCode, a11y: 'Code block' },
  { format: 'link', key: 'link', Icon: Link, a11y: 'Link' },
];

interface Props {
  state: OnChangeStateEvent | undefined;
  onPress: (f: Format) => void;
}

export function FormatToolbar({ state, onPress }: Props) {
  const { colors } = useTheme();
  return (
    // "always": taps must not dismiss the keyboard or blur the editor first.
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="always"
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-0.5 px-1"
    >
      {TOOLS.map(t => {
        const active = !!state?.[t.key]?.isActive;
        // e.g. bold inside a code block isn't allowed.
        const blocked = !!state?.[t.key]?.isBlocking;
        return (
          <Pressable
            key={t.format}
            onPress={() => onPress(t.format)}
            disabled={blocked}
            hitSlop={{ top: 4, bottom: 4 }}
            className={cn(
              'h-9 w-9 items-center justify-center rounded-md active:bg-muted',
              active && 'bg-accent',
              blocked && 'opacity-30',
            )}
            accessibilityRole="button"
            accessibilityLabel={t.a11y}
            accessibilityState={{ selected: active, disabled: blocked }}
          >
            <t.Icon size={18} strokeWidth={2} color={active ? colors.link : colors.mutedForeground} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
