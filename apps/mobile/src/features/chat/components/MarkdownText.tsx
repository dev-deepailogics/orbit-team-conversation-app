import { memo } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { isSafeHref } from '../link';

const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

// Dark theme matching the message list. Keys are react-native-markdown-display's rule names.
const styles = {
  body: { color: '#E5E7EB', fontSize: 15, lineHeight: 21 },
  paragraph: { marginTop: 0, marginBottom: 4 },
  strong: { color: '#FFFFFF', fontWeight: '700' as const },
  link: { color: '#1D9BD1', textDecorationLine: 'underline' as const },
  heading1: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700' as const,
    marginTop: 4,
    marginBottom: 4,
  },
  heading2: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700' as const,
    marginTop: 4,
    marginBottom: 4,
  },
  heading3: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
    marginTop: 4,
    marginBottom: 4,
  },
  bullet_list: { marginBottom: 4 },
  ordered_list: { marginBottom: 4 },
  blockquote: {
    backgroundColor: 'transparent',
    borderLeftColor: '#6B7280',
    borderLeftWidth: 4,
    paddingHorizontal: 8,
    marginLeft: 0,
    marginBottom: 4,
  },
  code_inline: {
    backgroundColor: '#2A2D31',
    color: '#FDBA74',
    fontFamily: mono,
    borderRadius: 3,
  },
  code_block: {
    backgroundColor: '#0F1114',
    borderColor: '#383F45',
    borderRadius: 6,
    color: '#E5E7EB',
    fontFamily: mono,
    fontSize: 13,
    padding: 8,
  },
  fence: {
    backgroundColor: '#0F1114',
    borderColor: '#383F45',
    borderRadius: 6,
    color: '#E5E7EB',
    fontFamily: mono,
    fontSize: 13,
    padding: 8,
    marginBottom: 4,
  },
  s: { textDecorationLine: 'line-through' as const },
};

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
  return (
    <Markdown style={styles} onLinkPress={handleLinkPress}>
      {content}
    </Markdown>
  );
});
