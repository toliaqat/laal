import { StyleSheet, View } from 'react-native';

/** A minimal progress bar showing `value / total` as a filled track. */
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
    borderRadius: 4,
    backgroundColor: '#eee',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#1a1a1a',
  },
});
