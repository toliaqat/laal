import { useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, initials, radius as radii, serif } from '@/lib/theme';

/** Passport-style frame: width 7, height 9. Matches the web crop step. */
export const PORTRAIT_RATIO = 7 / 9;

/**
 * A passport-style 7:9 portrait of the person a fundraiser is for — their
 * photo when one was uploaded, otherwise their initials in the same 7:9 frame.
 * Used on the fundraiser card and the detail screen. (The account screen keeps
 * the small round {@link PersonAvatar}.)
 *
 * New uploads arrive already framed at 7:9 with the face centred, so a
 * centre-crop (`cover`) is correct. If the photo URL fails to load (deleted
 * file, offline), it falls back to initials instead of an empty frame.
 *
 * The accessible label names the person, never the fundraiser title. Pass
 * `decorative` when adjacent text already names them (e.g. "In memory of
 * {name}"), so screen readers don't hear the name twice.
 */
export function PersonPortrait({
  name,
  photoUrl,
  width,
  cornerRadius = radii.sm,
  decorative = false,
  style,
}: {
  name: string;
  photoUrl?: string | null;
  /** Frame width in points; height follows the 7:9 ratio. */
  width: number;
  cornerRadius?: number;
  /** Hide from assistive tech because nearby text already names the person. */
  decorative?: boolean;
  style?: StyleProp<ViewStyle>;
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

  const frame = {
    width,
    height: Math.round(width / PORTRAIT_RATIO),
    borderRadius: cornerRadius,
  };

  return (
    <View
      style={[styles.frame, frame, style]}
      accessible={Boolean(label)}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
    >
      {showPhoto ? (
        <Image
          source={{ uri }}
          style={styles.photo}
          resizeMode="cover"
          onError={() => setFailedUri(uri)}
        />
      ) : (
        <Text
          style={[styles.monogram, { fontSize: Math.round(width * 0.38) }]}
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
  // Same fill, serif and ink as PersonAvatar, so a missing photo reads the
  // same everywhere. The old landscape banner used a 0.55-opacity accent
  // (1.89:1 on accentSoft) — fine as a large watermark, too faint in a small
  // frame. accentHover at full opacity measures 4.64:1.
  frame: {
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  monogram: {
    fontFamily: serif,
    fontWeight: '600',
    color: colors.accentHover,
  },
});
