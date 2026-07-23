import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import type { Beneficiary, Campaign } from '@laal/types';
import { supabase, WEB_APP_URL } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { ProgressBar } from '@/components/progress-bar';
import { VerifiedChip } from '@/components/ui';
import { accentShadow, colors, radius, serif, spacing } from '@/lib/theme';

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

export default function CampaignDetailScreen() {
  const { t, i18n } = useTranslation();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [loading, setLoading] = useState(true);
  const [followed, setFollowed] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data: c } = await supabase
        .from('campaigns')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (!mounted) return;
      const found = (c as Campaign | null) ?? null;
      setCampaign(found);

      if (found) {
        const { data: b } = await supabase
          .from('beneficiaries')
          .select('*')
          .eq('campaign_id', found.id)
          .eq('is_active', true)
          .maybeSingle();
        if (!mounted) return;
        setBeneficiary((b as Beneficiary | null) ?? null);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [slug]);

  // Reflect whether the signed-in user already follows this story.
  useEffect(() => {
    if (!campaign || !session) {
      setFollowed(false);
      return;
    }
    let mounted = true;
    supabase
      .from('campaign_follows')
      .select('campaign_id')
      .eq('campaign_id', campaign.id)
      // Scope to this user: the RLS policy lets admins read all follows, so
      // without this maybeSingle() would error on a campaign with >1 follower.
      .eq('profile_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (mounted) setFollowed(Boolean(data));
      });
    return () => {
      mounted = false;
    };
  }, [campaign, session]);

  const toggleFollow = async () => {
    if (!session) {
      router.push('/login'); // gentle nudge — following needs an account
      return;
    }
    if (!campaign || followBusy) return;
    setFollowBusy(true);
    const next = !followed;
    setFollowed(next); // optimistic
    if (next) {
      const { error } = await supabase
        .from('campaign_follows')
        .insert({ campaign_id: campaign.id, profile_id: session.user.id });
      if (error) {
        setFollowed(false); // roll back the optimistic update
        Alert.alert(t('mobile.detail.followError'));
      }
    } else {
      const { error } = await supabase
        .from('campaign_follows')
        .delete()
        .eq('campaign_id', campaign.id)
        .eq('profile_id', session.user.id);
      if (error) {
        setFollowed(true); // roll back the optimistic update
        Alert.alert(t('mobile.detail.followError'));
      }
    }
    setFollowBusy(false);
  };

  const help = () => {
    WebBrowser.openBrowserAsync(`${WEB_APP_URL}/campaigns/${slug}`);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!campaign) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>{t('mobile.detail.notFound')}</Text>
      </View>
    );
  }

  const pct =
    campaign.goal_amount > 0
      ? Math.round((campaign.amount_raised / campaign.goal_amount) * 100)
      : 0;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headRow}>
          <VerifiedChip label={t('mobile.detail.verifiedFundraiser')} />
          <Pressable
            onPress={toggleFollow}
            disabled={followBusy}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityState={{ selected: followed, busy: followBusy }}
            style={[
              styles.followBtn,
              followed && styles.followBtnOn,
              followBusy && styles.followBtnBusy,
            ]}
          >
            <Text style={[styles.followText, followed && styles.followTextOn]}>
              {followed ? t('mobile.detail.following') : t('mobile.detail.follow')}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.title}>{campaign.title}</Text>
        <Text style={styles.memory}>
          {t('mobile.common.inMemoryOf', { name: campaign.deceased_name })}
        </Text>

        <View style={styles.progressWrap}>
          <ProgressBar value={campaign.amount_raised} total={campaign.goal_amount} />
          <View style={styles.amounts}>
            <Text style={styles.raised}>
              {formatMoney(campaign.amount_raised, campaign.currency, i18n.language)}
            </Text>
            <Text style={styles.goal}>
              {t('mobile.common.raisedOf', {
                amount: formatMoney(campaign.goal_amount, campaign.currency, i18n.language),
              })}
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.pct}>{t('mobile.common.pct', { pct })}</Text>
          </View>
        </View>

        {campaign.story ? (
          <Text style={styles.story}>{campaign.story}</Text>
        ) : null}

        {beneficiary ? (
          <View style={styles.beneficiaryCard}>
            <Text style={styles.beneficiaryLabel}>
              {t('mobile.detail.whereSupportGoes')}
            </Text>
            <Text style={styles.beneficiaryText}>
              {beneficiary.relationship_to_deceased
                ? t('mobile.detail.fundsReachWithRelation', {
                    name: beneficiary.display_name,
                    relation: beneficiary.relationship_to_deceased,
                  })
                : t('mobile.detail.fundsReach', {
                    name: beneficiary.display_name,
                  })}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          style={({ pressed }) => [
            styles.helpButton,
            accentShadow,
            pressed && styles.pressed,
          ]}
          onPress={help}
        >
          <Text style={styles.helpText}>{t('mobile.detail.helpNow')}</Text>
        </Pressable>
        <Text style={styles.helpNote}>{t('mobile.detail.helpNote')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  notFound: { fontSize: 16, color: colors.muted },
  content: { padding: spacing.xl, gap: spacing.md },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  followBtn: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  followBtnOn: { backgroundColor: colors.accentSoft, borderColor: '#e6cfbb' },
  followBtnBusy: { opacity: 0.6 },
  followText: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  followTextOn: { color: colors.accentHover },
  title: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '600',
    color: colors.ink,
    fontFamily: serif,
    marginTop: spacing.xs,
  },
  memory: { fontSize: 15, color: colors.muted },
  progressWrap: { marginTop: spacing.sm, gap: spacing.sm },
  amounts: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  raised: { fontSize: 16, fontWeight: '700', color: colors.ink },
  goal: { fontSize: 14, color: colors.muted },
  pct: { fontSize: 14, fontWeight: '700', color: colors.accent },
  story: {
    fontSize: 16,
    lineHeight: 25,
    color: colors.inkSoft,
    marginTop: spacing.sm,
  },
  beneficiaryCard: {
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 4,
  },
  beneficiaryLabel: {
    fontSize: 11,
    letterSpacing: 1.1,
    fontWeight: '700',
    color: colors.muted,
  },
  beneficiaryText: { fontSize: 14, lineHeight: 21, color: colors.inkSoft },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  helpButton: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  helpText: { color: colors.accentInk, fontSize: 17, fontWeight: '700' },
  helpNote: { fontSize: 12, color: colors.muted, textAlign: 'center' },
});
