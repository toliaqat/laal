import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Supabase client for React Native — sessions persisted in AsyncStorage. */
export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection on native.
    detectSessionInUrl: false,
  },
});

/** Base URL of the web app — used to hand donations off to web Stripe Checkout. */
export const WEB_APP_URL =
  process.env.EXPO_PUBLIC_APP_URL ?? 'http://localhost:3000';
