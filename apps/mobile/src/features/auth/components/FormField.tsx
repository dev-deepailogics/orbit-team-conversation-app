import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = ComponentProps<typeof Input> & { label: string };

export function FormField({ label, ...inputProps }: Props) {
  return (
    <View className="gap-1">
      <Label className="text-xs font-semibold text-gray-300">{label}</Label>
      <Input
        className="h-11 border-gray-700 bg-slack-darkBg text-white"
        placeholderTextColor="#6B7280"
        autoCapitalize="none"
        autoCorrect={false}
        {...inputProps}
      />
    </View>
  );
}
