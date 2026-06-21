import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import type { Campaign } from '@ashfaat/types';
import { supabase, WEB_APP_URL } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { CampaignCard } from '@/components/campaign-card';

export default function HomeScreen() {
  const { session, signOut } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('campaigns')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (!mounted) return;
      setCampaigns((data as Campaign[]) ?? []);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const openStart = () => {
    WebBrowser.openBrowserAsync(`${WEB_APP_URL}/start`);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Campaigns</Text>
          {session ? (
            <Pressable onPress={signOut} hitSlop={8}>
              <Text style={styles.link}>Sign out</Text>
            </Pressable>
          ) : (
            <Link href="/login" style={styles.link}>
              Sign in
            </Link>
          )}
        </View>
        <Pressable onPress={openStart}>
          <Text style={styles.startNote}>
            Want to start a campaign? Create one on the web →
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CampaignCard campaign={item} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>No active campaigns yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fafafa' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 8 },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#1a1a1a' },
  link: { fontSize: 16, color: '#1a1a1a', fontWeight: '600' },
  startNote: { fontSize: 14, color: '#666' },
  list: { padding: 20, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  empty: { fontSize: 15, color: '#888' },
});
