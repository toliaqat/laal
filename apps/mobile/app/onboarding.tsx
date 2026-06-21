import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { markOnboardingSeen } from '@/lib/onboarding';
import { accentShadow, colors, radius, serif, spacing } from '@/lib/theme';

type Panel = {
  key: string;
  mark: string;
  title: string;
  body: string;
};

const PANELS: Panel[] = [
  {
    key: 'who',
    mark: '❡',
    title: 'Everyone is someone’s Laal.',
    body: 'A calm, caring way to stand with families in their hardest moments — with dignity, never pity.',
  },
  {
    key: 'verified',
    mark: '✓',
    title: 'Every fundraiser is verified.',
    body: 'We gently confirm the people and the need, so your kindness reaches the right family.',
  },
  {
    key: 'help',
    mark: '♥',
    title: 'Be there in seconds.',
    body: 'Help securely without an account — or sign in to follow the families you care about.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Panel>>(null);
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  const isLast = index === PANELS.length - 1;

  const finish = async (to: '/' | '/login') => {
    await markOnboardingSeen();
    router.replace(to);
  };

  const next = () => {
    if (isLast) {
      finish('/');
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  };

  return (
    <Animated.View
      style={[
        styles.screen,
        { opacity: fade, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      {/* top bar: dots + skip */}
      <View style={styles.topBar}>
        <View style={styles.dots}>
          {PANELS.map((p, i) => (
            <View
              key={p.key}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
        {!isLast ? (
          <Pressable onPress={() => finish('/')} hitSlop={8}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <FlatList
        ref={listRef}
        data={PANELS}
        keyExtractor={(p) => p.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item }) => (
          <View style={[styles.panel, { width }]}>
            <View style={styles.mark}>
              <Text style={styles.markText}>{item.mark}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />

      {/* bottom controls */}
      <View style={styles.controls}>
        <Pressable
          onPress={next}
          style={({ pressed }) => [
            styles.primary,
            accentShadow,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryText}>
            {isLast ? 'Get started' : 'Continue'}
          </Text>
        </Pressable>

        {isLast ? (
          <Pressable onPress={() => finish('/login')} hitSlop={8}>
            <Text style={styles.secondary}>I already have an account</Text>
          </Pressable>
        ) : (
          <Text style={styles.tagline}>Every life is precious.</Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.lineStrong,
  },
  dotActive: { width: 22, backgroundColor: colors.accent },
  skip: { fontSize: 15, fontWeight: '600', color: colors.muted },

  panel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl + spacing.sm,
    gap: spacing.lg,
  },
  mark: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: '#e6cfbb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  markText: { fontSize: 38, color: colors.accent },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
    color: colors.ink,
    fontFamily: serif,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 320,
  },

  controls: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    width: '100%',
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  primaryText: { color: colors.accentInk, fontSize: 17, fontWeight: '700' },
  secondary: { fontSize: 15, fontWeight: '700', color: colors.accentHover },
  tagline: {
    fontSize: 13,
    color: colors.muted,
    fontFamily: serif,
    fontStyle: 'italic',
  },
});
