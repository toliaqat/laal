import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/lib/theme';

/**
 * A warm progress bar showing `value / total` as a filled track.
 *
 * Exposed to assistive tech as a real progressbar with min/max/now, so
 * VoiceOver/TalkBack announce how far along a fundraiser is instead of skipping
 * a purely decorative view. Pass `label` (a translated string) to name it.
 */
export function ProgressBar({
  value,
  total,
  label,
}: {
  value: number;
  total: number;
  label?: string;
}) {
  const ratio = total > 0 ? Math.min(Math.max(value / total, 0), 1) : 0;
  const pct = Math.round(ratio * 100);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: pct, text: `${pct}%` }}
      style={styles.track}
    >
      {/* Keep a hairline of fill visible whenever anything has been raised, so
          a small amount against a large goal doesn't read as an empty bar. */}
      <View
        style={[
          styles.fill,
          { width: `${ratio * 100}%` },
          ratio > 0 ? styles.fillMin : null,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  fillMin: { minWidth: 3 },
});
