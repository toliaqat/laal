import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, initials, serif } from '@/lib/theme';

/**
 * A small round portrait of the person a fundraiser is for — their photo
 * when one was uploaded, otherwise their initials in the same warm memorial
 * monogram treatment as PersonPortrait's fallback.
 *
 * If the photo URL fails to load (deleted file, offline), it quietly falls
 * back to initials instead of leaving an empty circle.
 *
 * The accessible label names the person, never the fundraiser title. Pass
 * `decorative` when adjacent text already names them (e.g. "In memory of
 * {name}"), so screen readers don't hear the name twice.
 */
export function PersonAvatar({
  name,
  photoUrl,
  size = 40,
  decorative = false,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  /** Hide from assistive tech because nearby text already names the person. */
  decorative?: boolean;
}) {
  const { t } = useTranslation();
  const uri = photoUrl?.trim() || null;
  // Remember which URL failed, so a new URL gets a fresh attempt.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showPhoto = uri !== null && failedUri !== uri;

  const trimmedName = name.trim();
  const label = decorative
    ? undefined
    : trimmedName
    ? showPhoto
      ? t('mobile.avatar.photoOf', { name: trimmedName })
      : trimmedName
    : undefined;

  const shape = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View
      style={[styles.circle, shape]}
      accessible={Boolean(label)}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
    >
      {showPhoto ? (
        <Image
          source={{ uri }}
          style={shape}
          resizeMode="cover"
          onError={() => setFailedUri(uri)}
        />
      ) : (
        <Text
          style={[styles.monogram, { fontSize: Math.round(size * 0.4) }]}
          allowFontScaling={false}
          numberOfLines={1}
        >
          {initials(trimmedName)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Same fill and serif as PersonPortrait's fallback, so a missing photo
  // reads the same everywhere. The ink is deliberately stronger than the
  // card banner's old faded accent: at avatar sizes that 0.55-opacity accent
  // measured 1.89:1 on accentSoft, below the 3:1 minimum for a meaningful
  // graphic. accentHover at full opacity measures 4.64:1.
  circle: {
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  monogram: {
    fontFamily: serif,
    fontWeight: '600',
    color: colors.accentHover,
  },
});
