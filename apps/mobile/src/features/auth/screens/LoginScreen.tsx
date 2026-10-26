import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getErrorMessage } from '@/lib/api';
import type { ScreenProps } from '@/navigation/types';
import { AuthLayout } from '../components/AuthLayout';
import { login } from '../services/authApi';
import { useAuthStore } from '../store';

export function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async () => {
    if (isLoading) return;
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const { user, accessToken } = await login(email.trim(), password);
      // Navigation switches to Home automatically once `user` is set.
      await setAuth(user, accessToken);
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid email or password'));
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in to your workspace"
      subtitle="Enter your email address and password to continue."
      error={error}
    >
      <FormField
        label="Email"
        placeholder="you@company.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <FormField
        ref={passwordRef}
        label="Password"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
      />

      <Button className="h-11 bg-slack-activeChannel" disabled={isLoading} onPress={handleSubmit}>
        {isLoading ? <ActivityIndicator color="white" /> : <Text className="font-semibold text-white">Sign In</Text>}
      </Button>

      <View className="mt-2 flex-row justify-center">
        <Text className="text-xs text-gray-400">Don&apos;t have an account? </Text>
        <Pressable onPress={() => navigation.replace('Register')} hitSlop={8}>
          <Text className="text-xs font-semibold text-slack-activeChannel">Create an account</Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}
