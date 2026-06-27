import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AuthProvider } from '@/lib/auth';
import { colors, serif } from '@/lib/theme';
import { initI18n } from '@/lib/i18n';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    initI18n().finally(() => setReady(true));
  }, []);

  // Hold rendering until i18next has loaded the catalog + applied direction,
  // so screens never flash untranslated text or the wrong layout direction.
  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

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
          <Stack.Screen name="campaigns/[slug]" options={{ title: t('mobile.detail.headerTitle') }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
