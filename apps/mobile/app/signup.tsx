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
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { AuthDivider, GoogleButton } from '@/components/ui';
import { accentShadow, colors, radius, serif, spacing } from '@/lib/theme';

export default function SignupScreen() {
  const { t } = useTranslation();
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
        <Text style={styles.title}>{t('mobile.signup.doneTitle')}</Text>
        <Text style={styles.message}>{t('mobile.signup.doneBody')}</Text>
        <Link href="/login" style={[styles.link, { marginTop: spacing.lg }]}>
          {t('mobile.signup.backToSignIn')}
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
          <Text style={styles.backText}>{t('mobile.common.back')}</Text>
        </Pressable>
        <Text style={styles.eyebrow}>{t('mobile.signup.eyebrow')}</Text>
        <Text style={styles.title}>{t('mobile.signup.title')}</Text>
        <Text style={styles.subtitle}>{t('mobile.signup.subtitle')}</Text>

        <View style={styles.form}>
          <GoogleButton
            label={t('mobile.signup.google')}
            onSuccess={() => router.replace('/')}
            onError={setError}
          />
          <AuthDivider />

          <TextInput
            style={[styles.input, focused === 'name' && styles.inputFocused]}
            placeholder={t('mobile.auth.fullNamePlaceholder')}
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
            placeholder={t('mobile.auth.emailPlaceholder')}
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
            placeholder={t('mobile.auth.passwordPlaceholder')}
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
              <Text style={styles.buttonText}>{t('mobile.signup.submit')}</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('mobile.signup.haveAccount')} </Text>
          <Link href="/login" style={styles.link}>
            {t('mobile.signup.signIn')}
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
