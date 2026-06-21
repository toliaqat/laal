import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * First-launch onboarding flag. Bump the version suffix if the intro changes
 * materially and you want returning users to see it again.
 */
const KEY = 'laal.onboarding.seen.v1';

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // Non-fatal: worst case the intro shows again next launch.
  }
}
