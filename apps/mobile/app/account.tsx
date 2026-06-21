import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import type { Profile } from '@laal/types';
import { supabase, WEB_APP_URL } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/ui';
import { cardShadow, colors, radius, serif, spacing } from '@/lib/theme';

const ROLE_LABEL: Record<string, string> = {
  donor: 'Supporter',
  organizer: 'Organizer',
  org_member: 'Partner',
  admin: 'Team',
};

export default function AccountScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile | null>(null);

  // Signed-out users have no account to show — send them to sign in.
  useEffect(() => {
    if (!session) router.replace('/login');
  }, [session, router]);

  useEffect(() => {
    if (!session) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      if (mounted) setProfile((data as Profile | null) ?? null);
    })();
    return () => {
      mounted = false;
    };
  }, [session]);

  if (!session) return <View style={styles.screen} />;

  const meta = session.user.user_metadata ?? {};
  const fullName =
    profile?.full_name || (meta.full_name as string) || 'Friend';
  const email = profile?.email || session.user.email || '';
  const role = ROLE_LABEL[profile?.role ?? 'donor'] ?? 'Supporter';

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
        <Text style={styles.backText}>‹ Stories</Text>
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

      {/* activity — warm empty states for launch */}
      <Text style={styles.sectionLabel}>YOUR LAAL</Text>

      <ActivityRow
        icon="❤"
        title="Stories you follow"
        body="Stories you save will gather here, so you can return to the people you care about."
      />
      <ActivityRow
        icon="✦"
        title="Your support"
        body="Every contribution you make will appear here — a quiet record of kindness."
      />

      <Text style={styles.sectionLabel}>DO MORE</Text>

      <Pressable
        style={[styles.actionRow, cardShadow]}
        onPress={() => WebBrowser.openBrowserAsync(`${WEB_APP_URL}/start`)}
      >
        <View style={styles.actionIcon}>
          <Text style={styles.actionIconText}>＋</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Share a story</Text>
          <Text style={styles.actionBody}>Stand up for someone on the web →</Text>
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
          <Text style={styles.actionTitle}>Manage on the web</Text>
          <Text style={styles.actionBody}>Your dashboard and stories →</Text>
        </View>
      </Pressable>

      <Pressable style={styles.signOut} onPress={handleSignOut} hitSlop={6}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      <Text style={styles.footnote}>Every life is precious.</Text>
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
