import { Link } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AUTH_ENABLED } from '@/config/auth';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export function WebAuthAction({ compact = false }: { compact?: boolean }) {
  const { loading, session } = useAuth();

  if (Platform.OS !== 'web' || !AUTH_ENABLED || loading) return null;

  if (!session) {
    return (
      <Link href="/sign-in" asChild>
        <Pressable accessibilityRole="link" style={({ pressed }) => [styles.signIn, compact && styles.compactSignIn, pressed && styles.pressed]}>
          <Text style={[styles.signInText, compact && styles.compactSignInText]}>{compact ? 'Connexion' : 'Se connecter'}</Text>
        </Pressable>
      </Link>
    );
  }

  const email = session.user.email;
  return (
    <View style={[styles.account, compact && styles.compactAccount]}>
      {!compact && email ? <Text numberOfLines={1} style={styles.email}>{email}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Se déconnecter"
        onPress={() => { void supabase.auth.signOut(); }}
        style={({ pressed }) => [styles.signOut, compact && styles.compactSignOut, pressed && styles.pressed]}>
        <Text style={[styles.signOutText, compact && styles.compactSignOutText]}>Déconnexion</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  signIn: { minHeight: 43, paddingHorizontal: 15, justifyContent: 'center', borderWidth: 1, borderColor: '#D9E2DB', borderRadius: 10, backgroundColor: '#FFFFFF' },
  compactSignIn: { minHeight: 38, paddingHorizontal: 10 },
  signInText: { color: '#244D3C', fontSize: 11, fontWeight: '800' },
  compactSignInText: { fontSize: 10 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12, maxWidth: 260 },
  compactAccount: { gap: 0 },
  email: { maxWidth: 150, color: '#63746A', fontSize: 10 },
  signOut: { minHeight: 38, paddingHorizontal: 11, justifyContent: 'center', borderRadius: 9, backgroundColor: '#EEF3EF' },
  compactSignOut: { minHeight: 34, paddingHorizontal: 8 },
  signOutText: { color: '#365B48', fontSize: 10, fontWeight: '800' },
  compactSignOutText: { fontSize: 9 },
  pressed: { opacity: 0.72 },
});
