import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth';
import { colors, serif } from '@/lib/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.accentHover,
            headerShadowVisible: false,
            headerTitleStyle: { fontFamily: serif, color: colors.ink },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          {/* Screens with their own custom headers */}
          <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="account" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ headerShown: false }} />
          {/* Detail keeps a native header for the back affordance */}
          <Stack.Screen name="campaigns/[slug]" options={{ title: 'Fundraiser' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
