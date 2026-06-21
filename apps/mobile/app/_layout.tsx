import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#fafafa' },
          headerTintColor: '#1a1a1a',
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Ashfaat' }} />
        <Stack.Screen name="campaigns/[slug]" options={{ title: 'Campaign' }} />
        <Stack.Screen name="login" options={{ title: 'Sign in' }} />
        <Stack.Screen name="signup" options={{ title: 'Create account' }} />
      </Stack>
    </AuthProvider>
  );
}
