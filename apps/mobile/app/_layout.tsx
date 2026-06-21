import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#fafafa' },
          headerTintColor: '#1a1a1a',
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Ashfaat' }} />
      </Stack>
    </>
  );
}
