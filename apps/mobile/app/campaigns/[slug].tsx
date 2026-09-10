import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import type { Campaign, CampaignTrust, CampaignUpdate } from '@laal/types';
import { supabase, WEB_APP_URL } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatRelative } from '@/lib/format';
import { ProgressBar } from '@/components/progress-bar';
import { PrimaryButton, ReviewedChip, formatMoney } from '@/components/ui';
import { accentShadow, colors, radius, serif, spacing } from '@/lib/theme';

/**
 * The trust facts a supporter may be shown, derived from the public projection.
 * Mirrors `trustBadges` in apps/web/lib/campaign-trust.ts (which carries the
 * unit tests) — the two surfaces must never disagree about what is proven.
 *
 * This screen used to render an unconditional "Verified fundraiser" chip. An
 * admin can activate a fundraiser before the death certificate is approved, so
 * that chip was a false trust claim in a bereavement product. "Reviewed" and
 * "verified" are different facts and now come from different columns.
 */
type TrustBadge = 'reviewed' | 'needVerified' | 'familyVerified';

function trustBadges(trust: CampaignTrust | null): TrustBadge[] {
  if (!trust) return [];
  const badges: TrustBadge[] = [];
  if (trust.reviewed) badges.push('reviewed');
  if (trust.death_verified) badges.push('needVerified');
  // Organizations have no relationship check (they are vetted at onboarding —
  // ARCHITECTURE.md §4), so a family claim never applies to them.
  if (trust.beneficiary_type === 'individual' && trust.relationship_verified) {
    badges.push('familyVerified');
  }
  return badges;
}

/**
 * Columns of `campaign_trust_public` (0013_public_trust_projection.sql). Listed
 * explicitly rather than `*` so widening the view later cannot quietly widen
 * what this screen reads.
 */
const TRUST_COLUMNS =
  'campaign_id, slug, reviewed, beneficiary_type, beneficiary_display_name, ' +
  'beneficiary_relationship, organization_name, organization_type, ' +
  'death_verified, relationship_verified, death_verifier_type, ' +
  'organizer_first_name, organizer_relationship';

/** Newest-first, matching the web feed. One extra row reveals "there's more". */
const UPDATES_PAGE_SIZE = 10;

type UpdateRow = Pick<CampaignUpdate, 'id' | 'body' | 'created_at'>;

/** Copy for a fundraiser that isn't collecting support right now. */
function statusKey(status: Campaign['status']): string | null {
  switch (status) {
    case 'active':
      return null;
    case 'completed':
      return 'mobile.detail.statusCompleted';
    case 'closed':
      return 'mobile.detail.statusClosed';
    case 'paused':
      return 'mobile.detail.statusPaused';
    default:
      return 'mobile.detail.statusNotLive';
  }
}

export default function CampaignDetailScreen() {
  const { t, i18n } = useTranslation();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [trust, setTrust] = useState<CampaignTrust | null>(null);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [moreUpdates, setMoreUpdates] = useState(false);
  const [loading, setLoading] = useState(true);
  // A dropped connection and a deleted fundraiser used to look identical
  // ("could not be found"). Keep them apart so we can offer a retry.
  const [loadError, setLoadError] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [helpBusy, setHelpBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const { data: c, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      // Network/server problem — not a missing fundraiser.
      setLoadError(true);
      setCampaign(null);
      setLoading(false);
      return;
    }

    const found = (c as Campaign | null) ?? null;
    setCampaign(found);

    if (found) {
      const [{ data: b }, { data: u }] = await Promise.all([
        // beneficiaries / verifications / profiles are all organizer-or-admin
        // under RLS, so a supporter's client can only see these facts through
        // the public trust projection.
        supabase
          .from('campaign_trust_public')
          .select(TRUST_COLUMNS)
          .eq('campaign_id', found.id)
          .maybeSingle(),
        supabase
          .from('campaign_updates')
          .select('id, body, created_at')
          .eq('campaign_id', found.id)
          .order('created_at', { ascending: false })
          .limit(UPDATES_PAGE_SIZE + 1),
      ]);
      setTrust((b as CampaignTrust | null) ?? null);
      const rows = (u as UpdateRow[] | null) ?? [];
      setUpdates(rows.slice(0, UPDATES_PAGE_SIZE));
      setMoreUpdates(rows.length > UPDATES_PAGE_SIZE);
    } else {
      setTrust(null);
      setUpdates([]);
      setMoreUpdates(false);
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

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

  // Shared by the Help Now hand-off and the share sheet.
  const webUrl = `${WEB_APP_URL}/${i18n.language}/campaigns/${slug}`;

  const shareStory = async () => {
    if (!campaign) return;
    try {
      await Share.share({
        message: `${t('mobile.detail.shareMessage', { title: campaign.title })} ${webUrl}?from=app`,
        url: `${webUrl}?from=app`,
        title: campaign.title,
      });
    } catch {
      // Dismissed or unavailable — nothing worth interrupting the screen for.
    }
  };

  const help = async () => {
    if (helpBusy) return; // a double-tap must not open two browser sheets
    setHelpBusy(true);
    try {
      // Carry the app's language into the web URL: without the locale prefix an
      // English app user landed on the Urdu site (the web default is /ur).
      await WebBrowser.openBrowserAsync(`${webUrl}?from=app#help`);
    } catch {
      Alert.alert(t('mobile.detail.helpError'));
    } finally {
      setHelpBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.stateTitle}>{t('mobile.detail.errorTitle')}</Text>
        <Text style={styles.stateBody}>{t('mobile.detail.errorBody')}</Text>
        <PrimaryButton
          label={t('mobile.detail.retry')}
          onPress={load}
          style={{ marginTop: spacing.md }}
        />
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

  const inactiveKey = statusKey(campaign.status);

  // Only what the projection proves. `verifier` is named only alongside an
  // approved death verification; an admin confirming from documents leaves it
  // null and we then claim no institution.
  const badges = trustBadges(trust);
  const verifier = trust?.death_verified ? trust.death_verifier_type : null;
  // An organization beneficiary is named by the organization itself
  // (display_name is a copy made at creation time and can drift).
  const reaches =
    trust?.beneficiary_type === 'organization'
      ? (trust.organization_name ?? trust.beneficiary_display_name)
      : (trust?.beneficiary_display_name ?? null);
  const starterName = trust?.organizer_first_name?.trim() || null;
  const starterRelationship = trust?.organizer_relationship?.trim() || null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headRow}>
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
          <Pressable
            onPress={shareStory}
            hitSlop={6}
            accessibilityRole="button"
            style={styles.followBtn}
          >
            <Text style={styles.followText}>{t('mobile.detail.share')}</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>{campaign.title}</Text>
        <Text style={styles.memory}>
          {t('mobile.common.inMemoryOf', { name: campaign.deceased_name })}
        </Text>

        {/* One chip per proven fact — nothing when nothing is proven. */}
        {badges.length > 0 ? (
          <View style={styles.trustRow}>
            {badges.map((badge) => (
              <ReviewedChip key={badge} label={t(`mobile.detail.trust.${badge}`)} />
            ))}
          </View>
        ) : null}
        {starterName ? (
          <Text style={styles.startedBy}>
            {starterRelationship
              ? t('mobile.detail.startedByWithRelationship', {
                  name: starterName,
                  relationship: starterRelationship,
                })
              : t('mobile.detail.startedBy', { name: starterName })}
          </Text>
        ) : null}

        {campaign.cover_image_url ? (
          <Image
            source={{ uri: campaign.cover_image_url }}
            style={styles.cover}
            resizeMode="cover"
            accessible
            accessibilityLabel={campaign.deceased_name}
          />
        ) : null}

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

        {updates.length > 0 ? (
          <View style={styles.updatesSection}>
            <Text style={styles.sectionLabel}>
              {t('mobile.detail.updatesHeading')}
            </Text>
            {updates.map((u) => (
              <View key={u.id} style={styles.updateCard}>
                <View style={styles.updateMeta}>
                  {/* No author name: profiles are readable only by their owner
                      and admins, so attribution stays generic. */}
                  <Text style={styles.updateFrom}>
                    {t('mobile.detail.updateFrom')}
                  </Text>
                  <Text style={styles.updateTime}>
                    {formatRelative(u.created_at, i18n.language)}
                  </Text>
                </View>
                <Text style={styles.updateBody}>{u.body}</Text>
              </View>
            ))}
            {moreUpdates ? (
              <Text style={styles.updatesFooter}>
                {t('mobile.detail.updatesMostRecent')}
              </Text>
            ) : null}
          </View>
        ) : null}

        {reaches ? (
          <View style={styles.beneficiaryCard}>
            <Text style={styles.beneficiaryLabel}>
              {t('mobile.detail.whereSupportGoes')}
            </Text>
            <Text style={styles.beneficiaryText}>
              {trust?.beneficiary_relationship
                ? t('mobile.detail.fundsReachWithRelation', {
                    name: reaches,
                    relation: trust.beneficiary_relationship,
                  })
                : t('mobile.detail.fundsReach', { name: reaches })}
            </Text>
            {verifier ? (
              <Text style={styles.beneficiaryNote}>
                {t('mobile.detail.trust.confirmedWith', {
                  verifier: t(`mobile.detail.trust.verifier.${verifier}`),
                })}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {inactiveKey ? (
          // Not collecting support — no CTA to hand off to the web.
          <Text style={styles.footerStatus}>{t(inactiveKey)}</Text>
        ) : (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.helpButton,
                accentShadow,
                pressed && styles.pressed,
                helpBusy && styles.helpButtonBusy,
              ]}
              onPress={help}
              disabled={helpBusy}
              accessibilityRole="button"
              accessibilityState={{ busy: helpBusy, disabled: helpBusy }}
            >
              <Text style={styles.helpText}>
                {helpBusy
                  ? t('mobile.detail.opening')
                  : t('mobile.detail.helpNow')}
              </Text>
            </Pressable>
            <Text style={styles.helpNote}>{t('mobile.detail.helpNote')}</Text>
          </>
        )}
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
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  notFound: { fontSize: 16, color: colors.muted, textAlign: 'center' },
  stateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    fontFamily: serif,
    textAlign: 'center',
  },
  stateBody: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  content: { padding: spacing.xl, gap: spacing.md },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  startedBy: { fontSize: 13, color: colors.muted },
  // 16:9, matching the web cover cap so a portrait photo can't eat the screen.
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    marginTop: spacing.xs,
  },
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
  updatesSection: { marginTop: spacing.sm, gap: spacing.sm },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1.1,
    fontWeight: '700',
    color: colors.muted,
    // Caps are presentation, not copy: Urdu has no case, so the label text
    // stays sentence case in the catalogs and English is uppercased here.
    textTransform: 'uppercase',
  },
  updateCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.xs,
  },
  updateMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  updateFrom: {
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
  },
  updateTime: { fontSize: 12, color: colors.muted },
  updateBody: { fontSize: 15, lineHeight: 23, color: colors.inkSoft },
  updatesFooter: { fontSize: 12, color: colors.muted },
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
    // Caps are presentation, not copy: Urdu has no case, so the label text
    // stays sentence case in the catalogs and English is uppercased here.
    textTransform: 'uppercase',
  },
  beneficiaryText: { fontSize: 14, lineHeight: 21, color: colors.inkSoft },
  beneficiaryNote: { fontSize: 12, lineHeight: 19, color: colors.muted },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  footerStatus: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  helpButton: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  helpButtonBusy: { opacity: 0.7 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  helpText: { color: colors.accentInk, fontSize: 17, fontWeight: '700' },
  helpNote: { fontSize: 12, color: colors.muted, textAlign: 'center' },
});
