import { Link, Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { completeAuthFromUrl } from '@/lib/auth-url';
import { supabase } from '@/lib/supabase';
import { AUTH_ENABLED } from '@/config/auth';

function authDestination(value: string | null): string {
  return value?.startsWith('/assureur/invitation?token=') && value.length < 2000 ? value : '/';
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const destination = typeof window === 'undefined' ? '/' : authDestination(new URLSearchParams(window.location.search).get('next'));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!AUTH_ENABLED || typeof window === 'undefined') return;
    let active = true;
    void (async () => {
      const result = await completeAuthFromUrl(window.location.href);
      if (!active) return;
      if (result.status === 'error') {
        setError(result.message);
        return;
      }
      if (result.status === 'none') {
        setError('Le retour Google ne contient pas de code de connexion.');
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (session) router.replace(destination as Href);
      else setError('Google a répondu, mais aucune session Check n’a été créée.');
    })().catch((caughtError: unknown) => {
      if (!active) return;
      setError(caughtError instanceof Error ? caughtError.message : 'Impossible de terminer la connexion Google.');
    });
    return () => { active = false; };
  }, [destination, router]);

  if (!AUTH_ENABLED) return <Redirect href="/" />;

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Connexion non terminée</Text>
        <Text style={styles.error}>{error}</Text>
        <Link href={{ pathname: '/sign-in', params: { redirect: destination } }} style={styles.link}>Revenir à la connexion</Link>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator />
      <Text>Connexion à Google…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  error: { maxWidth: 460, color: '#B91C1C', textAlign: 'center', lineHeight: 22 },
  link: { color: '#176B50', fontWeight: '700', padding: 12 },
});
