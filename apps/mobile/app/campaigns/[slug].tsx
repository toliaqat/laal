import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import type { Beneficiary, Campaign } from '@laal/types';
import { supabase, WEB_APP_URL } from '@/lib/supabase';
import { ProgressBar } from '@/components/progress-bar';

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

export default function CampaignDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [loading, setLoading] = useState(true);

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

  const donate = () => {
    WebBrowser.openBrowserAsync(`${WEB_APP_URL}/campaigns/${slug}`);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!campaign) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Campaign not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{campaign.title}</Text>
        <Text style={styles.memory}>In memory of {campaign.deceased_name}</Text>

        <View style={styles.progressWrap}>
          <ProgressBar value={campaign.amount_raised} total={campaign.goal_amount} />
          <View style={styles.amounts}>
            <Text style={styles.raised}>
              {formatMoney(campaign.amount_raised, campaign.currency)} raised
            </Text>
            <Text style={styles.goal}>
              of {formatMoney(campaign.goal_amount, campaign.currency)}
            </Text>
          </View>
        </View>

        {campaign.story ? <Text style={styles.story}>{campaign.story}</Text> : null}

        {beneficiary ? (
          <View style={styles.beneficiaryCard}>
            <Text style={styles.beneficiaryText}>
              Funds go to {beneficiary.display_name}
              {beneficiary.relationship_to_deceased
                ? ` (${beneficiary.relationship_to_deceased})`
                : ''}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.donateButton} onPress={donate}>
          <Text style={styles.donateText}>Donate</Text>
        </Pressable>
        <Text style={styles.donateNote}>You'll be taken to the web to donate securely.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fafafa' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  notFound: { fontSize: 16, color: '#888' },
  content: { padding: 20, gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: '#1a1a1a' },
  memory: { fontSize: 16, color: '#666' },
  progressWrap: { marginTop: 8, gap: 8 },
  amounts: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  raised: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  goal: { fontSize: 14, color: '#888' },
  story: { fontSize: 16, lineHeight: 24, color: '#333', marginTop: 8 },
  beneficiaryCard: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  beneficiaryText: { fontSize: 15, color: '#444' },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fafafa',
    gap: 8,
  },
  donateButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  donateText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  donateNote: { fontSize: 12, color: '#888', textAlign: 'center' },
});
