import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { supabase } from '@/lib/supabase';
import { completeAuthFromUrl } from '@/lib/auth-url';
import { AUTH_ENABLED } from '@/config/auth';

export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    if (!AUTH_ENABLED) {
      router.replace('/');
      return () => { active = false; };
    }
    const handleUrl = async (url: string | null) => {
      const result = await completeAuthFromUrl(url);
      if (!active) return;
      if (result.status === 'error' || result.status === 'none') {
        console.error('Google OAuth callback failed', result);
        router.replace('/sign-in');
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.replace('/');
    };
    Linking.getInitialURL().then(handleUrl).catch(() => router.replace('/sign-in'));
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace('/');
    });
    return () => {
      active = false;
      subscription.remove();
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator />
      <Text>Connexion à Google…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
});
