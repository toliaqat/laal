import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/lib/theme';

/** A warm progress bar showing `value / total` as a filled track. */
export function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.min(Math.max(value / total, 0), 1) : 0;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct * 100}%` }]} />
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
});
