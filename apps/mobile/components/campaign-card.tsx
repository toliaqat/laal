import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Campaign } from '@ashfaat/types';
import { ProgressBar } from './progress-bar';

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

/** A tappable card summarizing a campaign; links to its detail screen. */
export function CampaignCard({ campaign }: { campaign: Campaign }) {
  return (
    <Link href={`/campaigns/${campaign.slug}`} asChild>
      <Pressable style={styles.card}>
        <Text style={styles.title} numberOfLines={2}>
          {campaign.title}
        </Text>
        <Text style={styles.deceased}>In memory of {campaign.deceased_name}</Text>

        <View style={styles.progressWrap}>
          <ProgressBar value={campaign.amount_raised} total={campaign.goal_amount} />
        </View>

        <View style={styles.amounts}>
          <Text style={styles.raised}>
            {formatMoney(campaign.amount_raised, campaign.currency)} raised
          </Text>
          <Text style={styles.goal}>
            of {formatMoney(campaign.goal_amount, campaign.currency)}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    gap: 8,
  },
  title: { fontSize: 17, fontWeight: '600', color: '#1a1a1a' },
  deceased: { fontSize: 14, color: '#666' },
  progressWrap: { marginTop: 4 },
  amounts: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  raised: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  goal: { fontSize: 13, color: '#888' },
});
