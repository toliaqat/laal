import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { accentShadow, colors, radius, serif } from '@/lib/theme';
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

/** A small "✓ Verified" trust chip. */
export function VerifiedChip({ label = 'Verified' }: { label?: string }) {
  return (
    <View style={styles.verified}>
      <Text style={styles.verifiedMark}>✓</Text>
      <Text style={styles.verifiedText}>{label}</Text>
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
  label = 'Continue with Google',
  onSuccess,
  onError,
}: {
  label?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (loading) return;
    setLoading(true);
    const res = await signInWithGoogle();
    setLoading(false);
    if (res.ok) onSuccess?.();
    else if (!res.cancelled) onError?.(res.message ?? 'Google sign-in failed.');
  };

  return (
    <Pressable
      onPress={handle}
      disabled={loading}
      style={({ pressed }) => [styles.googleBtn, pressed && styles.pressedSoft]}
    >
      {loading ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <>
          <Text style={styles.gMark}>G</Text>
          <Text style={styles.googleText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** A labelled "or" rule to separate Google from the email form. */
export function AuthDivider({ label = 'or' }: { label?: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{label}</Text>
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
});
