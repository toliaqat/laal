import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Ashfaat</Text>
      <Text style={styles.subtitle}>
        Dignified, verified memorial fundraising for expats and their families.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>How it works</Text>
        <Text style={styles.step}>1. Create a campaign for someone who has died abroad.</Text>
        <Text style={styles.step}>2. Donors contribute — no account needed.</Text>
        <Text style={styles.step}>3. We verify the death.</Text>
        <Text style={styles.step}>4. Funds go to a verified family member or partner org.</Text>
      </View>

      <Text style={styles.note}>Scaffold ready — wire screens to Supabase next.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: '700', color: '#1a1a1a' },
  subtitle: { fontSize: 17, color: '#555' },
  card: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    gap: 6,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  step: { fontSize: 15, color: '#444', lineHeight: 22 },
  note: { marginTop: 24, fontSize: 13, color: '#888' },
});
