import { Pressable, ScrollView } from 'react-native';
import type { OnChangeStateEvent } from 'react-native-enriched-html';
import { Text } from '@/components/ui/text';
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
const TOOLS: Array<{
  format: Format;
  key: StateKey;
  label: string;
  a11y: string;
  className?: string;
}> = [
  {
    format: 'bold',
    key: 'bold',
    label: 'B',
    a11y: 'Bold',
    className: 'font-bold',
  },
  {
    format: 'italic',
    key: 'italic',
    label: 'I',
    a11y: 'Italic',
    className: 'italic',
  },
  {
    format: 'strike',
    key: 'strikeThrough',
    label: 'S',
    a11y: 'Strikethrough',
    className: 'line-through',
  },
  {
    format: 'h1',
    key: 'h1',
    label: 'H1',
    a11y: 'Heading 1',
    className: 'font-bold',
  },
  {
    format: 'h2',
    key: 'h2',
    label: 'H2',
    a11y: 'Heading 2',
    className: 'font-bold',
  },
  { format: 'bullet', key: 'unorderedList', label: '•', a11y: 'Bullet list' },
  {
    format: 'numbered',
    key: 'orderedList',
    label: '1.',
    a11y: 'Numbered list',
  },
  { format: 'quote', key: 'blockQuote', label: '❝', a11y: 'Blockquote' },
  { format: 'code', key: 'inlineCode', label: '</>', a11y: 'Inline code' },
  { format: 'codeblock', key: 'codeBlock', label: '{ }', a11y: 'Code block' },
  { format: 'link', key: 'link', label: '🔗', a11y: 'Link' },
];

interface Props {
  state: OnChangeStateEvent | undefined;
  onPress: (f: Format) => void;
}

export function FormatToolbar({ state, onPress }: Props) {
  return (
    // "always": taps must not dismiss the keyboard or blur the editor first.
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="always"
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="px-2"
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
              'h-10 min-w-[40px] items-center justify-center rounded-md px-2 active:bg-white/10',
              active && 'bg-slack-activeChannel/30',
              blocked && 'opacity-30',
            )}
            accessibilityRole="button"
            accessibilityLabel={t.a11y}
            accessibilityState={{ selected: active, disabled: blocked }}
          >
            <Text
              className={cn(
                'text-base text-gray-300',
                active && 'text-white',
                t.className,
              )}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
