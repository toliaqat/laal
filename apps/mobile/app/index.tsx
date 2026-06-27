import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import type { Campaign } from '@laal/types';
import { supabase, WEB_APP_URL } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { hasSeenOnboarding } from '@/lib/onboarding';
import { CampaignCard } from '@/components/campaign-card';
import { Avatar, PrimaryButton } from '@/components/ui';
import { LanguageToggle } from '@/components/language-toggle';
import { colors, firstName, initials, radius, serif, spacing } from '@/lib/theme';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gateReady, setGateReady] = useState(false);

  // First launch → show the onboarding intro once, before Stories renders.
  useEffect(() => {
    let mounted = true;
    hasSeenOnboarding().then((seen) => {
      if (!mounted) return;
      if (seen) setGateReady(true);
      else router.replace('/onboarding');
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    setCampaigns((data as Campaign[]) ?? []);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await load();
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openStart = () => WebBrowser.openBrowserAsync(`${WEB_APP_URL}/start`);

  const name = firstName(session?.user.user_metadata?.full_name as string);
  const signedIn = Boolean(session);

  const header = (
    <View style={styles.header}>
      {/* top bar — brand + account affordance */}
      <View style={styles.topBar}>
        <Text style={styles.brand}>Laal</Text>
        {signedIn ? (
          <Pressable onPress={() => router.push('/account')} hitSlop={8}>
            <Avatar
              text={initials(
                session?.user.user_metadata?.full_name as string,
                session?.user.email,
              )}
              size={38}
            />
          </Pressable>
        ) : (
          <View style={styles.headerRight}>
            <LanguageToggle compact />
            <Link href="/login" asChild>
              <Pressable style={styles.signInPill} hitSlop={6}>
                <Text style={styles.signInPillText}>{t('mobile.home.signIn')}</Text>
              </Pressable>
            </Link>
          </View>
        )}
      </View>

      {/* hero band */}
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{t('mobile.home.eyebrow')}</Text>
        {signedIn ? (
          <>
            <Text style={styles.heroTitle}>
              {name
                ? t('mobile.home.welcomeBackName', { name })
                : t('mobile.home.welcomeBack')}
            </Text>
            <Text style={styles.heroSub}>{t('mobile.home.welcomeBackSub')}</Text>
          </>
        ) : (
          <>
            <Text style={styles.heroTitle}>{t('mobile.home.heroTitle')}</Text>
            <Text style={styles.heroSub}>{t('mobile.home.heroSub')}</Text>
          </>
        )}
      </View>

      {/* gentle, non-blocking sign-in invitation (signed-out only) */}
      {!signedIn ? (
        <View style={styles.inviteCard}>
          <Text style={styles.inviteTitle}>{t('mobile.home.inviteTitle')}</Text>
          <Text style={styles.inviteBody}>{t('mobile.home.inviteBody')}</Text>
          <View style={styles.inviteActions}>
            <Link href="/login" asChild>
              <Pressable style={styles.invitePrimary}>
                <Text style={styles.invitePrimaryText}>{t('mobile.home.signIn')}</Text>
              </Pressable>
            </Link>
            <Link href="/signup" asChild>
              <Pressable hitSlop={6}>
                <Text style={styles.inviteLink}>{t('mobile.home.createAccount')}</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      ) : (
        <Pressable style={styles.sharePrompt} onPress={openStart}>
          <View style={styles.sharePromptIcon}>
            <Text style={styles.sharePromptHeart}>♥</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sharePromptTitle}>{t('mobile.home.sharePromptTitle')}</Text>
            <Text style={styles.sharePromptBody}>{t('mobile.home.sharePromptBody')}</Text>
          </View>
        </Pressable>
      )}

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>
          {signedIn ? t('mobile.home.sectionNearYou') : t('mobile.home.sectionVerified')}
        </Text>
        {campaigns.length > 0 ? (
          <Text style={styles.sectionCount}>{campaigns.length}</Text>
        ) : null}
      </View>
    </View>
  );

  if (!gateReady || loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={campaigns}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CampaignCard campaign={item} />}
        ListHeaderComponent={header}
        contentContainerStyle={[
          styles.list,
          { paddingTop: insets.top + spacing.sm },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('mobile.home.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('mobile.home.emptyBody')}</Text>
            <PrimaryButton
              label={t('mobile.home.emptyCta')}
              onPress={openStart}
              style={{ marginTop: spacing.md }}
            />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },

  header: { gap: spacing.lg, marginBottom: spacing.xs },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { fontSize: 24, fontWeight: '700', color: colors.ink, fontFamily: serif },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  signInPill: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  signInPillText: { fontSize: 14, fontWeight: '700', color: colors.ink },

  hero: { gap: 6 },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: '700',
    color: colors.accent,
  },
  heroTitle: {
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '600',
    color: colors.ink,
    fontFamily: serif,
  },
  heroSub: { fontSize: 14, lineHeight: 21, color: colors.muted },

  inviteCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: 6,
  },
  inviteTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, fontFamily: serif },
  inviteBody: { fontSize: 13, lineHeight: 20, color: colors.muted },
  inviteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  invitePrimary: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  invitePrimaryText: { color: colors.accentInk, fontSize: 14, fontWeight: '700' },
  inviteLink: { color: colors.accentHover, fontSize: 14, fontWeight: '700' },

  sharePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: '#e6cfbb',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  sharePromptIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharePromptHeart: { color: colors.accent, fontSize: 18 },
  sharePromptTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  sharePromptBody: { fontSize: 13, color: colors.accentHover, marginTop: 1 },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.inkSoft },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 1,
    overflow: 'hidden',
  },

  empty: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, fontFamily: serif },
  emptyBody: { fontSize: 13, lineHeight: 20, color: colors.muted, textAlign: 'center' },
});
