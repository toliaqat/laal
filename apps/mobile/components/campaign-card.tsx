import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Campaign } from '@laal/types';
import { ProgressBar } from './progress-bar';
import { VerifiedChip } from './ui';
import { cardShadow, colors, radius, serif, spacing } from '@/lib/theme';

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
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
  const pct =
    campaign.goal_amount > 0
      ? Math.round((campaign.amount_raised / campaign.goal_amount) * 100)
      : 0;

  return (
    <Link href={`/campaigns/${campaign.slug}`} asChild>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          cardShadow,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.topRow}>
          <VerifiedChip />
          <Text style={styles.pct}>{pct}% there</Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {campaign.title}
        </Text>
        <Text style={styles.memory}>In memory of {campaign.deceased_name}</Text>

        <View style={styles.progressWrap}>
          <ProgressBar value={campaign.amount_raised} total={campaign.goal_amount} />
        </View>

        <View style={styles.amounts}>
          <Text style={styles.raised}>
            {formatMoney(campaign.amount_raised, campaign.currency)}
          </Text>
          <Text style={styles.goal}>
            raised of {formatMoney(campaign.goal_amount, campaign.currency)}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.96, transform: [{ scale: 0.99 }] },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  pct: { fontSize: 12, fontWeight: '700', color: colors.accent },
  title: { fontSize: 18, fontWeight: '600', color: colors.ink, fontFamily: serif },
  memory: { fontSize: 13, color: colors.muted },
  progressWrap: { marginTop: spacing.xs },
  amounts: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  raised: { fontSize: 14, fontWeight: '700', color: colors.ink },
  goal: { fontSize: 13, color: colors.muted },
});
