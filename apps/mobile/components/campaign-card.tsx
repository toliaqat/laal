import { Link } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Campaign } from '@laal/types';
import { ProgressBar } from './progress-bar';
import { VerifiedChip } from './ui';
import { cardShadow, colors, initials, radius, serif, spacing } from '@/lib/theme';

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

/** A tappable card summarizing a campaign; links to its detail screen. */
export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const { t, i18n } = useTranslation();
  const pct =
    campaign.goal_amount > 0
      ? Math.round((campaign.amount_raised / campaign.goal_amount) * 100)
      : 0;

  return (
    <Link href={`/campaigns/${campaign.slug}`} asChild>
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('mobile.card.a11yLabel', {
          title: campaign.title,
          name: campaign.deceased_name,
          pct,
        })}
        style={({ pressed }) => [
          styles.card,
          cardShadow,
          pressed && styles.pressed,
        ]}
      >
        {/* Banner — a human face when we have one, a dignified memorial
            monogram when we don't. The verified chip floats over it. */}
        <View style={styles.banner}>
          {campaign.cover_image_url ? (
            <Image
              source={{ uri: campaign.cover_image_url }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.bannerFallback}>
              <Text style={styles.monogram}>
                {initials(campaign.deceased_name)}
              </Text>
            </View>
          )}
          <View style={styles.chipOverlay}>
            <VerifiedChip />
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {campaign.title}
          </Text>
          <Text style={styles.memory}>
            {t('mobile.common.inMemoryOf', { name: campaign.deceased_name })}
          </Text>

          <View style={styles.progressWrap}>
            <ProgressBar value={campaign.amount_raised} total={campaign.goal_amount} />
          </View>

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
            <Text style={styles.pct}>{t('mobile.card.pctThere', { pct })}</Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const BANNER_HEIGHT = 168;

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.97, transform: [{ scale: 0.99 }] },

  banner: {
    height: BANNER_HEIGHT,
    backgroundColor: colors.accentSoft,
  },
  bannerImage: { width: '100%', height: '100%' },
  bannerFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  monogram: {
    fontSize: 52,
    fontFamily: serif,
    fontWeight: '600',
    color: colors.accent,
    opacity: 0.55,
  },
  chipOverlay: { position: 'absolute', top: spacing.md, start: spacing.md },

  body: { padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: 18, fontWeight: '600', color: colors.ink, fontFamily: serif },
  memory: { fontSize: 13, color: colors.muted },
  progressWrap: { marginTop: spacing.xs },
  amounts: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  raised: { fontSize: 14, fontWeight: '700', color: colors.ink },
  goal: { fontSize: 13, color: colors.muted },
  pct: { fontSize: 12, fontWeight: '700', color: colors.accent },
});
