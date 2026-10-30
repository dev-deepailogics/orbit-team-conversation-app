import { memo } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { FONT, MONO, perScheme, useTheme } from '@/lib/theme';
import { isSafeHref } from '../link';

const mono = Platform.select({ ios: MONO, default: 'monospace' });
// Slack's message typography. Keys are react-native-markdown-display's rule names.
const styles = perScheme(c => {
  const heading = {
    color: c.foreground,
    fontFamily: FONT,
    fontWeight: '700' as const,
    marginTop: 4,
    marginBottom: 4,
  };
  const codeBlock = {
    backgroundColor: c.codeBg,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 8,
    color: c.foreground,
    fontFamily: mono,
    fontSize: 13,
    lineHeight: 19,
    padding: 10,
  };

  return {
    body: {
      color: c.foreground,
      fontFamily: FONT,
      fontSize: 15,
      lineHeight: 22,
    },
    paragraph: { marginTop: 0, marginBottom: 2 },
    strong: { fontWeight: '700' as const },
    link: { color: c.link, textDecorationLine: 'none' as const },
    heading1: { ...heading, fontSize: 22, lineHeight: 28 },
    heading2: { ...heading, fontSize: 18, lineHeight: 24 },
    heading3: { ...heading, fontSize: 16, lineHeight: 22 },
    bullet_list: { marginBottom: 2 },
    ordered_list: { marginBottom: 2 },
    blockquote: {
      backgroundColor: 'transparent',
      borderLeftColor: c.border,
      borderLeftWidth: 4,
      paddingHorizontal: 10,
      marginLeft: 0,
      marginBottom: 2,
    },
    code_inline: {
      backgroundColor: c.codeBg,
      borderColor: c.border,
      borderWidth: 1,
      color: c.destructive,
      fontFamily: mono,
      fontSize: 13,
      borderRadius: 4,
    },
    code_block: codeBlock,
    fence: { ...codeBlock, marginBottom: 4 },
    s: { textDecorationLine: 'line-through' as const },
  };
});

// Returning false stops the library opening the URL itself.
const handleLinkPress = (url: string) => {
  if (isSafeHref(url))
    Linking.openURL(url).catch(() => Alert.alert('Cannot open link', url));
  return false;
};

export const MarkdownText = memo(function MarkdownTextView({
  content,
}: {
  content: string;
}) {
  const { scheme } = useTheme();
  return (
    <Markdown style={styles[scheme]} onLinkPress={handleLinkPress}>
      {content}
    </Markdown>
  );
});
