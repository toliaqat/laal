import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { accentShadow, colors, radius, serif, spacing } from '@/lib/theme';

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <View
        style={[
          styles.screen,
          styles.donePad,
          { paddingTop: insets.top + spacing.xl * 2 },
        ]}
      >
        <View style={styles.doneBadge}>
          <Text style={styles.doneMark}>✓</Text>
        </View>
        <Text style={styles.title}>Almost there</Text>
        <Text style={styles.message}>
          Check your email to confirm your account, then sign in. We’re glad
          you’re here.
        </Text>
        <Link href="/login" style={[styles.link, { marginTop: spacing.lg }]}>
          Back to sign in
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.eyebrow}>JOIN LAAL</Text>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          Follow the families you care about and stand with them.
        </Text>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, focused === 'name' && styles.inputFocused]}
            placeholder="Full name"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
            autoComplete="name"
            value={fullName}
            onChangeText={setFullName}
            onFocus={() => setFocused('name')}
            onBlur={() => setFocused(null)}
          />
          <TextInput
            style={[styles.input, focused === 'email' && styles.inputFocused]}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocused('email')}
            onBlur={() => setFocused(null)}
          />
          <TextInput
            style={[styles.input, focused === 'password' && styles.inputFocused]}
            placeholder="Password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocused('password')}
            onBlur={() => setFocused(null)}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              accentShadow,
              submitting && styles.buttonDisabled,
              pressed && styles.pressed,
            ]}
            onPress={onSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.accentInk} />
            ) : (
              <Text style={styles.buttonText}>Create account</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/login" style={styles.link}>
            Sign in
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: 6,
  },
  back: { alignSelf: 'flex-start', marginBottom: spacing.md },
  backText: { fontSize: 16, fontWeight: '600', color: colors.accentHover },
  donePad: { paddingHorizontal: spacing.xl, alignItems: 'center', gap: spacing.sm },
  doneBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successLine,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  doneMark: { color: colors.success, fontSize: 26, fontWeight: '900' },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: '700',
    color: colors.accent,
  },
  title: { fontSize: 28, fontWeight: '600', color: colors.ink, fontFamily: serif },
  subtitle: { fontSize: 14, lineHeight: 21, color: colors.muted, marginBottom: spacing.lg },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  form: { gap: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.ink,
  },
  inputFocused: { borderColor: colors.accent, backgroundColor: '#fff' },
  error: { color: colors.danger, fontSize: 14 },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  buttonDisabled: { opacity: 0.6 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  buttonText: { color: colors.accentInk, fontSize: 17, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: { fontSize: 15, color: colors.muted },
  link: { fontSize: 15, color: colors.accentHover, fontWeight: '700' },
});
