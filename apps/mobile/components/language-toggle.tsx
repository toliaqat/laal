import { Alert, DevSettings, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { locales, localeNames, type Locale } from '@laal/i18n';
import { setLocale } from '@/lib/i18n';
import { colors, radius } from '@/lib/theme';

/**
 * Segmented language switcher. Changing language is instant for text; when the
 * text *direction* flips (English ↔ Urdu), React Native only re-mirrors the UI
 * on a fresh start, so we reload the app after confirming with the user.
 *
 * `compact` drops the "Language" label and tightens spacing, for placing in a
 * top bar (e.g. onboarding / the signed-out home header).
 */
export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const current = i18n.language as Locale;

  async function choose(locale: Locale) {
    if (locale === current) return;
    const directionChanged = await setLocale(locale);
    if (directionChanged) {
      Alert.alert(
        t('mobile.language.restartTitle'),
        t('mobile.language.restartBody'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('mobile.language.restartConfirm'),
            onPress: () => DevSettings.reload(),
          },
        ],
      );
    }
  }

  const group = (
    <View style={[styles.group, compact && styles.groupCompact]}>
      {locales.map((l) => {
        const active = l === current;
        return (
          <Pressable
            key={l}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => choose(l)}
            style={[
              styles.option,
              compact && styles.optionCompact,
              active && styles.optionActive,
            ]}
          >
            <Text
              style={[
                styles.optionText,
                compact && styles.optionTextCompact,
                active && styles.optionTextActive,
              ]}
            >
              {localeNames[l]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (compact) return group;

  return (
    <View>
      <Text style={styles.label}>{t('nav.language')}</Text>
      {group}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 8,
  },
  group: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.pill,
    padding: 4,
    alignSelf: 'flex-start',
  },
  option: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
  },
  optionActive: { backgroundColor: colors.accentSoft },
  optionText: { fontSize: 14, fontWeight: '600', color: colors.inkSoft },
  optionTextActive: { color: colors.accentHover },
  groupCompact: { padding: 3, gap: 4 },
  optionCompact: { paddingVertical: 4, paddingHorizontal: 12 },
  optionTextCompact: { fontSize: 13 },
});
