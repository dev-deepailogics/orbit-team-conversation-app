import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getErrorMessage } from '@/lib/api';
import type { ScreenProps } from '@/navigation/types';
import { AuthLayout } from '../components/AuthLayout';
import { register } from '../services/authApi';
import { useAuthStore } from '../store';
import { useTheme } from '@/lib/theme';

export function RegisterScreen({ navigation }: ScreenProps<'Register'>) {
  const { colors } = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const usernameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const setAuth = useAuthStore(s => s.setAuth);

  const handleSubmit = async () => {
    if (isLoading) return;
    if (!displayName.trim() || !username.trim() || !email.trim() || !password) {
      setError('Fill in all fields.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const { user, accessToken } = await register({
        displayName: displayName.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
      });
      await setAuth(user, accessToken);
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed'));
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="First, let's get some basic information to set up your profile."
      error={error}
    >
      <FormField
        label="Display Name"
        placeholder="Alex Smith"
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => usernameRef.current?.focus()}
        submitBehavior="submit"
      />
      <FormField
        ref={usernameRef}
        label="Username"
        placeholder="alex"
        value={username}
        onChangeText={setUsername}
        autoComplete="username-new"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        submitBehavior="submit"
      />
      <FormField
        ref={emailRef}
        label="Email"
        placeholder="alex@company.com"
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
        placeholder="At least 6 characters"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
      />

      <Button
        size="lg"
        disabled={isLoading}
        onPress={handleSubmit}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text>Continue</Text>
        )}
      </Button>

      <View className="mt-2 flex-row justify-center">
        <Text className="text-muted-foreground">Already have an account? </Text>
        <Pressable onPress={() => navigation.replace('Login')} hitSlop={8}>
          <Text className="font-bold text-link">
            Sign in
          </Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}
