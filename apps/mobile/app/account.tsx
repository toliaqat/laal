import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import type { Profile } from '@laal/types';
import { supabase, WEB_APP_URL } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/ui';
import { LanguageToggle } from '@/components/language-toggle';
import { cardShadow, colors, radius, serif, spacing } from '@/lib/theme';

const ROLE_KEY: Record<string, string> = {
  donor: 'mobile.account.roleSupporter',
  organizer: 'mobile.account.roleOrganizer',
  org_member: 'mobile.account.rolePartner',
  admin: 'mobile.account.roleTeam',
};

type CampaignRef = { slug: string; title: string; deceased_name: string } | null;
type FollowItem = { campaign_id: string; campaign: CampaignRef };
type DonationItem = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  campaign: CampaignRef;
};

function formatMoney(amount: number, currency: string, locale: string) {
  try {
    const fmtLocale = locale === 'ur' ? 'ur-PK-u-nu-latn' : locale;
    return new Intl.NumberFormat(fmtLocale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

function formatDate(iso: string, locale: string) {
  try {
    const fmtLocale = locale === 'ur' ? 'ur-PK-u-nu-latn' : locale;
    return new Date(iso).toLocaleDateString(fmtLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function AccountScreen() {
  const { t, i18n } = useTranslation();
  const { session, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [follows, setFollows] = useState<FollowItem[]>([]);
  const [donations, setDonations] = useState<DonationItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Signed-out users have no account to show — send them to sign in.
  useEffect(() => {
    if (!session) router.replace('/login');
  }, [session, router]);

  useEffect(() => {
    if (!session) return;
    let mounted = true;
    (async () => {
      const [{ data: prof }, { data: f }, { data: d }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
        supabase
          .from('campaign_follows')
          .select('campaign_id, campaign:campaigns(slug, title, deceased_name)')
          // Scope to the signed-in user explicitly: the RLS policy also allows
          // admins to read ALL follows, so without this an admin would see every
          // user's saved stories in their own list.
          .eq('profile_id', session.user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('donations')
          .select(
            'id, amount, currency, status, created_at, campaign:campaigns(slug, title, deceased_name)',
          )
          .eq('donor_profile_id', session.user.id)
          .order('created_at', { ascending: false }),
      ]);
      if (!mounted) return;
      setProfile((prof as Profile | null) ?? null);
      setFollows((f as unknown as FollowItem[]) ?? []);
      setDonations((d as unknown as DonationItem[]) ?? []);
      setLoadingData(false);
    })();
    return () => {
      mounted = false;
    };
  }, [session]);

  if (!session) return <View style={styles.screen} />;

  const meta = session.user.user_metadata ?? {};
  const fullName =
    profile?.full_name || (meta.full_name as string) || t('mobile.account.friend');
  const email = profile?.email || session.user.email || '';
  const role = t(ROLE_KEY[profile?.role ?? 'donor'] ?? 'mobile.account.roleSupporter');

  const handleSignOut = async () => {
    // Leave the account screen first, then clear the session, so the
    // signed-out guard above doesn't bounce through /login on the way out.
    router.replace('/');
    await signOut();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg },
      ]}
    >
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        style={styles.back}
      >
        <Text style={styles.backText}>{t('mobile.account.backFundraisers')}</Text>
      </Pressable>

      {/* identity */}
      <View style={[styles.profileCard, cardShadow]}>
        <Avatar text={initialsOf(fullName, email)} size={64} />
        <Text style={styles.name}>{fullName}</Text>
        {email ? <Text style={styles.email}>{email}</Text> : null}
        <View style={styles.roleChip}>
          <Text style={styles.roleChipText}>{role}</Text>
        </View>
      </View>

      {/* activity — real follows + contributions */}
      {loadingData ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <>
          <View style={styles.subHead}>
            <Text style={styles.sectionLabel}>{t('mobile.account.followsLabel')}</Text>
            {follows.length > 0 ? (
              <Text style={styles.countChip}>{follows.length}</Text>
            ) : null}
          </View>
          {follows.length === 0 ? (
            <ActivityRow
              icon="❤"
              title={t('mobile.account.followsEmptyTitle')}
              body={t('mobile.account.followsEmptyBody')}
            />
          ) : (
            follows
              .filter((f) => f.campaign)
              .map((f) => (
                <Pressable
                  key={f.campaign_id}
                  style={[styles.listRow, cardShadow]}
                  onPress={() => router.push(`/campaigns/${f.campaign!.slug}`)}
                >
                  <View style={styles.listIcon}>
                    <Text style={styles.listIconText}>♥</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {f.campaign!.title}
                    </Text>
                    <Text style={styles.listSub} numberOfLines={1}>
                      {t('mobile.common.inMemoryOf', { name: f.campaign!.deceased_name })}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))
          )}

          <View style={styles.subHead}>
            <Text style={styles.sectionLabel}>{t('mobile.account.supportLabel')}</Text>
            {donations.length > 0 ? (
              <Text style={styles.countChip}>{donations.length}</Text>
            ) : null}
          </View>
          {donations.length === 0 ? (
            <ActivityRow
              icon="✦"
              title={t('mobile.account.supportEmptyTitle')}
              body={t('mobile.account.supportEmptyBody')}
            />
          ) : (
            donations.map((d) => {
              const row = (
                <>
                  <View style={styles.listIcon}>
                    <Text style={styles.listIconText}>✦</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {d.campaign?.title ?? t('mobile.account.donationFallbackTitle')}
                    </Text>
                    <Text style={styles.listSub}>
                      {formatDate(d.created_at, i18n.language)}
                      {d.status !== 'succeeded' ? ` · ${d.status}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.amount}>
                    {formatMoney(d.amount, d.currency, i18n.language)}
                  </Text>
                </>
              );
              return d.campaign ? (
                <Pressable
                  key={d.id}
                  style={[styles.listRow, cardShadow]}
                  onPress={() => router.push(`/campaigns/${d.campaign!.slug}`)}
                >
                  {row}
                </Pressable>
              ) : (
                <View key={d.id} style={[styles.listRow, cardShadow]}>
                  {row}
                </View>
              );
            })
          )}
        </>
      )}

      <Text style={styles.sectionLabel}>{t('mobile.account.doMore')}</Text>

      <Pressable
        style={[styles.actionRow, cardShadow]}
        onPress={() => WebBrowser.openBrowserAsync(`${WEB_APP_URL}/start`)}
      >
        <View style={styles.actionIcon}>
          <Text style={styles.actionIconText}>＋</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>{t('mobile.account.startTitle')}</Text>
          <Text style={styles.actionBody}>{t('mobile.account.startBody')}</Text>
        </View>
      </Pressable>

      <Pressable
        style={[styles.actionRow, cardShadow]}
        onPress={() => WebBrowser.openBrowserAsync(`${WEB_APP_URL}/dashboard`)}
      >
        <View style={styles.actionIcon}>
          <Text style={styles.actionIconText}>≡</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>{t('mobile.account.manageTitle')}</Text>
          <Text style={styles.actionBody}>{t('mobile.account.manageBody')}</Text>
        </View>
      </Pressable>

      <Text style={styles.sectionLabel}>{t('mobile.account.preferences')}</Text>
      <View style={[styles.actionRow, cardShadow]}>
        <LanguageToggle />
      </View>

      <Pressable style={styles.signOut} onPress={handleSignOut} hitSlop={6}>
        <Text style={styles.signOutText}>{t('mobile.account.signOut')}</Text>
      </Pressable>

      <Text style={styles.footnote}>{t('mobile.account.footnote')}</Text>
    </ScrollView>
  );
}

function ActivityRow({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.activityRow}>
      <View style={styles.activityIcon}>
        <Text style={styles.activityIconText}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activityBody}>{body}</Text>
      </View>
    </View>
  );
}

function initialsOf(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const src = name.trim() || email.trim() || '·';
  return src.slice(0, 2).toUpperCase();
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl * 2,
    gap: spacing.md,
  },
  back: { alignSelf: 'flex-start' },
  backText: { fontSize: 16, fontWeight: '600', color: colors.accentHover },

  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: 6,
    marginTop: spacing.xs,
  },
  name: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.ink,
    fontFamily: serif,
    marginTop: spacing.sm,
  },
  email: { fontSize: 14, color: colors.muted },
  roleChip: {
    marginTop: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: '#e6cfbb',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  roleChipText: { fontSize: 12, fontWeight: '700', color: colors.accentHover },

  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: colors.muted,
    marginTop: spacing.md,
    marginBottom: 2,
  },

  activityRow: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'flex-start',
  },
  activityIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIconText: { fontSize: 16, color: colors.accent },
  activityTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  activityBody: { fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 2 },

  loadingBox: { paddingVertical: spacing.xl, alignItems: 'center' },
  subHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  countChip: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  listIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listIconText: { fontSize: 15, color: colors.accent },
  listTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  listSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  chevron: { fontSize: 22, color: colors.lineStrong, fontWeight: '600' },
  amount: { fontSize: 14, fontWeight: '700', color: colors.accentHover },

  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconText: { fontSize: 18, color: colors.accentHover, fontWeight: '700' },
  actionTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  actionBody: { fontSize: 13, color: colors.muted, marginTop: 1 },

  signOut: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: colors.danger },

  footnote: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12,
    fontFamily: serif,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
});
