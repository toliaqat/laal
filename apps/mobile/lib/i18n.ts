import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import {
  defaultLocale,
  isLocale,
  direction,
  type Locale,
} from '@laal/i18n';
import en from '@laal/i18n/messages/en.json';
import ur from '@laal/i18n/messages/ur.json';

const STORAGE_KEY = 'laal.locale';

const resources = {
  en: { translation: en },
  ur: { translation: ur },
} as const;

/** The user's saved choice, or the device language, or English. */
export async function resolveInitialLocale(): Promise<Locale> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved && isLocale(saved)) return saved;
  } catch {
    // ignore storage errors — fall back to device/default
  }
  const device = getLocales()[0]?.languageCode ?? defaultLocale;
  return isLocale(device) ? device : defaultLocale;
}

/** Initialize i18next once, before the app renders. */
export async function initI18n(): Promise<Locale> {
  const locale = await resolveInitialLocale();
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources,
      lng: locale,
      fallbackLng: defaultLocale,
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  } else {
    await i18n.changeLanguage(locale);
  }
  // Align native layout direction with the resolved locale on startup.
  applyDirection(locale);
  return locale;
}

/** Force the native layout direction to match a locale (no-op if unchanged). */
export function applyDirection(locale: Locale): boolean {
  const shouldRTL = direction[locale] === 'rtl';
  I18nManager.allowRTL(shouldRTL);
  if (I18nManager.isRTL !== shouldRTL) {
    I18nManager.forceRTL(shouldRTL);
    return true; // direction changed — a reload is required to take effect
  }
  return false;
}

/**
 * Persist + apply a new locale. Returns true when the text direction flipped,
 * meaning the caller must reload the app for RTL/LTR to take full effect
 * (React Native only re-mirrors the tree on a fresh start).
 */
export async function setLocale(locale: Locale): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // non-fatal — language still changes for this session
  }
  await i18n.changeLanguage(locale);
  return applyDirection(locale);
}

export default i18n;
