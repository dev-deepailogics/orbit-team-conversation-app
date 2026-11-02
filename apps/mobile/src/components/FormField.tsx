import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = ComponentProps<typeof Input> & { label: string };

export function FormField({ label, ...inputProps }: Props) {
  return (
    <View className="gap-1.5">
      <Label>{label}</Label>
      <Input autoCapitalize="none" autoCorrect={false} {...inputProps} />
    </View>
  );
}
