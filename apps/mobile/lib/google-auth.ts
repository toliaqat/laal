import { supabase } from './supabase';

/**
 * Native Google sign-in → Supabase. The user picks an account in the native
 * Google sheet; we exchange the returned ID token for a Supabase session via
 * signInWithIdToken. Requires a custom dev build (the native module is absent
 * in Expo Go) and the Google Cloud / Supabase setup in the README checklist.
 *
 * The library is loaded lazily (require inside the handler) so the rest of the
 * app — including Expo Go — boots fine even though the native module is missing.
 */

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

let configured = false;

export type GoogleResult =
  | { ok: true }
  | { ok: false; cancelled?: boolean; message?: string };

export async function signInWithGoogle(): Promise<GoogleResult> {
  if (!WEB_CLIENT_ID) {
    return {
      ok: false,
      message:
        'Google sign-in isn’t configured yet (missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).',
    };
  }

  // Lazy load so a missing native module (Expo Go) can't crash app startup.
  let mod: typeof import('@react-native-google-signin/google-signin');
  try {
    mod = require('@react-native-google-signin/google-signin');
  } catch {
    return {
      ok: false,
      message: 'Google sign-in needs the custom dev build (not available in Expo Go).',
    };
  }

  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = mod;

  try {
    if (!configured) {
      // webClientId is what Supabase validates the ID token against; required.
      GoogleSignin.configure({
        webClientId: WEB_CLIENT_ID,
        iosClientId: IOS_CLIENT_ID,
        scopes: ['profile', 'email'],
      });
      configured = true;
    }

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      return { ok: false, cancelled: true }; // user dismissed the sheet
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      return { ok: false, message: 'Google did not return an ID token.' };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) {
        return { ok: false, cancelled: true };
      }
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { ok: false, message: 'Google Play Services is not available.' };
      }
    }
    const message = (e as Error)?.message ?? 'Google sign-in failed.';
    return {
      ok: false,
      message: /RNGoogleSignin|native module|TurboModule/i.test(message)
        ? 'Google sign-in needs the custom dev build (not available in Expo Go).'
        : message,
    };
  }
}
