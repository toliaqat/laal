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
import { AuthDivider, GoogleButton } from '@/components/ui';
import { accentShadow, colors, radius, serif, spacing } from '@/lib/theme';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace('/');
  };

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
        <Text style={styles.eyebrow}>WELCOME BACK</Text>
        <Text style={styles.title}>Sign in to Laal</Text>
        <Text style={styles.subtitle}>
          Return to the people your community is standing with.
        </Text>

        <View style={styles.form}>
          <GoogleButton
            label="Sign in with Google"
            onSuccess={() => router.replace('/')}
            onError={setError}
          />
          <AuthDivider />

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
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don’t have an account? </Text>
          <Link href="/signup" style={styles.link}>
            Create one
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
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: '700',
    color: colors.accent,
  },
  title: { fontSize: 28, fontWeight: '600', color: colors.ink, fontFamily: serif },
  subtitle: { fontSize: 14, lineHeight: 21, color: colors.muted, marginBottom: spacing.lg },
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
