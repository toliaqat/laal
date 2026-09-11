import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Campaign } from '@laal/types';
import { PersonPortrait } from './person-portrait';
import { ProgressBar } from './progress-bar';
import { formatMoney, ReviewedChip } from './ui';
import { cardShadow, colors, radius, serif, spacing } from '@/lib/theme';

/** A tappable card summarizing a campaign; links to its detail screen. */
export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const { t, i18n } = useTranslation();
  const pct =
    campaign.goal_amount > 0
      ? Math.round((campaign.amount_raised / campaign.goal_amount) * 100)
      : 0;

  // Death city/country are captured by the edit form but were never shown
  // anywhere public; a place helps supporters recognise their own community.
  const city = campaign.death_city?.trim() || null;
  const country = campaign.death_country?.trim() || null;
  const place =
    city && country
      ? t('mobile.card.location', { city, country })
      : city ?? country;

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
        {/* Header — a passport-style portrait at the inline start (it
            mirrors to the right in Urdu), beside the title and memorial line. */}
        <View style={styles.header}>
          {/* Decorative: the card's own label and the "In memory of" line
              already name the person. */}
          <PersonPortrait
            name={campaign.deceased_name}
            photoUrl={campaign.cover_image_url}
            width={PORTRAIT_WIDTH}
            decorative
          />
          <View style={styles.headerText}>
            <View style={styles.chipRow}>
              <ReviewedChip />
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {campaign.title}
            </Text>
            <Text style={styles.memory}>
              {t('mobile.common.inMemoryOf', { name: campaign.deceased_name })}
            </Text>
            {place ? <Text style={styles.place}>{place}</Text> : null}
          </View>
        </View>

        <View style={styles.body}>
          <ProgressBar
            value={campaign.amount_raised}
            total={campaign.goal_amount}
            label={t('mobile.common.progressLabel')}
          />

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

/** 7:9 portrait, 80 x 103 — a profile photo, not a banner. */
const PORTRAIT_WIDTH = 80;

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.97, transform: [{ scale: 0.99 }] },

  // `row` follows the layout direction, so under forceRTL the portrait sits
  // on the right and the text on its left, with no per-locale code.
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  headerText: { flex: 1, gap: spacing.xs },
  chipRow: { flexDirection: 'row', marginBottom: 2 },

  body: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  title: { fontSize: 18, fontWeight: '600', color: colors.ink, fontFamily: serif },
  memory: { fontSize: 13, color: colors.muted },
  place: { fontSize: 13, color: colors.muted },
  amounts: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  raised: { fontSize: 14, fontWeight: '700', color: colors.ink },
  goal: { fontSize: 13, color: colors.muted },
  pct: { fontSize: 12, fontWeight: '700', color: colors.accent },
});
