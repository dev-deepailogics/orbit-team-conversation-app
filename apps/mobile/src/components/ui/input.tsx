import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme';
import { Platform, TextInput } from 'react-native';

// RN 0.88: ComponentProps<typeof TextInput> already carries the correct ref type.
// Slack-style field: hairline border that turns blue while focused.
function Input({ className, onFocus, onBlur, ...props }: React.ComponentProps<typeof TextInput>) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      className={cn(
        'border-input bg-background text-foreground font-sans h-11 w-full min-w-0 rounded-lg border px-3 text-base',
        focused && 'border-ring',
        props.editable === false &&
          cn('opacity-50', Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' })),
        Platform.select({
          web: 'placeholder:text-muted-foreground selection:bg-accent outline-none',
        }),
        className
      )}
      placeholderTextColor={colors.subtle}
      selectionColor={colors.link}
      cursorColor={colors.link}
      onFocus={e => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={e => {
        setFocused(false);
        onBlur?.(e);
      }}
      {...props}
    />
  );
}

export { Input };
