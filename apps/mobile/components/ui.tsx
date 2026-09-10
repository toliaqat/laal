import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { accentShadow, colors, radius, serif, spacing } from '@/lib/theme';
import { signInWithGoogle } from '@/lib/google-auth';

/** Circular avatar showing initials over a warm accent fill. */
export function Avatar({
  text,
  size = 40,
}: {
  text: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{text}</Text>
    </View>
  );
}

/**
 * A small "✓ Fundraiser reviewed" trust chip.
 *
 * Wording matters here: admin approval does NOT require an approved death
 * verification, so a bare "Verified" would be a false trust claim in a
 * bereavement product. BRAND.md prescribes "Fundraiser reviewed" / "Need
 * verified" — this chip only ever claims the former.
 */
export function ReviewedChip({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.verified}>
      <Text style={styles.verifiedMark}>✓</Text>
      <Text style={styles.verifiedText}>{label ?? t('mobile.common.reviewed')}</Text>
    </View>
  );
}


/**
 * Format a money amount with its ISO currency, localized to the active locale.
 * Urdu keeps Western digits for amounts (clearer for currency) by pinning the
 * numbering system. Mirrors `formatMoney` in apps/web/components/ui.tsx.
 */
export function formatMoney(
  amount: number,
  currency: string,
  locale?: string,
): string {
  const resolved = locale === 'ur' ? 'ur-PK-u-nu-latn' : locale;
  try {
    return new Intl.NumberFormat(resolved, {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

/** A softly pulsing placeholder block. */
export function SkeletonBlock({
  width,
  height,
  radius: r = radius.sm,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: r, backgroundColor: colors.surface2, opacity: pulse },
        style,
      ]}
    />
  );
}

/**
 * Placeholder in the shape of a CampaignCard, so the header paints immediately
 * instead of the whole screen being replaced by a centred spinner.
 */
export function CampaignCardSkeleton() {
  return (
    <View style={styles.skeletonCard} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SkeletonBlock height={168} width="100%" radius={0} />
      <View style={styles.skeletonBody}>
        <SkeletonBlock height={18} width="80%" />
        <SkeletonBlock height={13} width="52%" />
        <SkeletonBlock height={13} width="38%" />
        <SkeletonBlock height={8} width="100%" radius={radius.pill} />
        <SkeletonBlock height={13} width="60%" />
      </View>
    </View>
  );
}

/** `count` stacked {@link CampaignCardSkeleton}s. */
export function CampaignCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View style={{ gap: spacing.md }}>
      {Array.from({ length: count }, (_, i) => (
        <CampaignCardSkeleton key={i} />
      ))}
    </View>
  );
}

/** Generic soft chip. */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{children}</Text>
    </View>
  );
}

/** Small green check badge for feature / reassurance rows. */
export function CheckBadge({ size = 22 }: { size?: number }) {
  return (
    <View
      style={[
        styles.checkBadge,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.checkBadgeMark, { fontSize: size * 0.55 }]}>✓</Text>
    </View>
  );
}

/** Filled, warm primary action with gentle press feedback. */
export function PrimaryButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.primaryBtn,
        accentShadow,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

/** Quiet outlined action. */
export function GhostButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.ghostBtn,
        pressed && styles.pressedSoft,
        style,
      ]}
    >
      <Text style={styles.ghostBtnText}>{label}</Text>
    </Pressable>
  );
}

/** "Continue with Google" — native sign-in via signInWithGoogle. */
export function GoogleButton({
  label,
  onSuccess,
  onError,
}: {
  label?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (loading) return;
    setLoading(true);
    const res = await signInWithGoogle();
    setLoading(false);
    if (res.ok) onSuccess?.();
    else if (!res.cancelled) onError?.(res.message ?? t('mobile.google.failed'));
  };

  return (
    <Pressable
      onPress={handle}
      disabled={loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: loading, busy: loading }}
      style={({ pressed }) => [styles.googleBtn, pressed && styles.pressedSoft]}
    >
      {loading ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <>
          <Text style={styles.gMark}>G</Text>
          <Text style={styles.googleText}>{label ?? t('mobile.google.continue')}</Text>
        </>
      )}
    </Pressable>
  );
}

/** A labelled "or" rule to separate Google from the email form. */
export function AuthDivider({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{label ?? t('mobile.auth.divider')}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.accentInk, fontWeight: '700', fontFamily: serif },

  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: '#e6cfbb',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verifiedMark: { color: colors.accentHover, fontSize: 11, fontWeight: '900' },
  verifiedText: { color: colors.accentHover, fontSize: 11, fontWeight: '700' },

  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { color: colors.inkSoft, fontSize: 12, fontWeight: '600' },

  checkBadge: {
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadgeMark: { color: colors.success, fontWeight: '900' },

  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.accentInk, fontSize: 16, fontWeight: '700' },

  ghostBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  ghostBtnText: { color: colors.ink, fontSize: 16, fontWeight: '700' },

  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  pressedSoft: { backgroundColor: colors.surface2 },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  // Simplified single-color Google "G"; swap for the official 4-color asset
  // before public launch to follow Google's branding guidelines.
  gMark: {
    fontSize: 19,
    fontWeight: '800',
    color: '#4285F4',
    fontFamily: serif,
  },
  googleText: { fontSize: 16, fontWeight: '700', color: colors.ink },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { fontSize: 13, color: colors.muted, fontWeight: '600' },

  skeletonCard: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  skeletonBody: { padding: spacing.lg, gap: spacing.sm },
});
