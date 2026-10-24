import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { hasSupabaseConfig } from '@/config/supabase';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { completeAuthFromUrl } from '@/lib/auth-url';
import { AUTH_ENABLED } from '@/config/auth';

WebBrowser.maybeCompleteAuthSession();

function authDestination(value?: string | string[]): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.startsWith('/assureur/invitation?token=') && candidate.length < 2000 ? candidate : '/';
}

export default function SignInScreen() {
  const { loading, session } = useAuth();
  const params = useLocalSearchParams<{ redirect?: string | string[] }>();
  const destination = authDestination(params.redirect);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!AUTH_ENABLED || Platform.OS === 'web') return;
    let active = true;
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      const result = await completeAuthFromUrl(url);
      if (active && result.status === 'error') {
        setError(`Connexion Google impossible : ${result.message}`);
      }
    };
    Linking.getInitialURL().then(handleUrl).catch(() => undefined);
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  async function signInWithGoogle() {
    if (!AUTH_ENABLED) return;
    setBusy(true);
    setError(null);
    try {
      const redirectTo = Platform.OS === 'web'
        ? (() => {
            const callback = new URL('/auth/callback', window.location.origin);
            if (destination !== '/') callback.searchParams.set('next', destination);
            return callback.toString();
          })()
        : AuthSession.makeRedirectUri({ path: 'auth-callback' });
      console.log('Google OAuth redirect URL:', redirectTo);
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (oauthError || !data.url) {
        setError(oauthError?.message ?? 'La connexion Google est indisponible.');
        return;
      }
      if (Platform.OS === 'web') {
        window.location.assign(data.url);
        return;
      }
      // Let Expo's auth session finish naturally. A fixed timeout can reject
      // a valid provider flow while the browser is still returning to the app.
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      console.log('Google OAuth browser result:', result);
      if (result.type === 'success') {
        const authResult = await completeAuthFromUrl(result.url);
        if (authResult.status === 'error') {
          setError(`La session Google n’a pas pu être ouverte : ${authResult.message}`);
        } else if (authResult.status === 'none') {
          setError(`Retour Google incomplet. URL reçue : ${result.url}`);
        } else if (authResult.status === 'already-handled') {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (!currentSession) setError('Le retour Google a été reçu, mais aucune session active n’a été créée.');
        }
      } else {
        setError('La fenêtre Google a été fermée avant la fin de la connexion.');
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Erreur inconnue';
      await WebBrowser.dismissBrowser().catch(() => undefined);
      console.error('Google OAuth failed', caughtError);
      setError(`Connexion Google impossible : ${message}`);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;
  if (!AUTH_ENABLED || session) return <Redirect href={destination as Href} />;

  return (
    <View style={styles.container}>
      <View style={styles.brandBlock}>
        <Text style={styles.eyebrow}>CHECK</Text>
        <Text style={styles.title}>Les bons prix, au bon moment.</Text>
        <Text style={styles.subtitle}>
          Vérifiez une pièce, comparez un devis et gardez une trace claire de vos décisions.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Créer un compte ou se connecter</Text>
        <Text style={styles.cardText}>
          Pour le lancement, l’accès se fait avec Google. La connexion par SMS sera ajoutée après la configuration du service OTP.
        </Text>
        {!hasSupabaseConfig && (
          <Text style={styles.warning}>
            Ajoutez EXPO_PUBLIC_SUPABASE_ANON_KEY dans votre environnement pour activer la connexion.
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          disabled={busy || !hasSupabaseConfig}
          onPress={signInWithGoogle}
          style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continuer avec Google</Text>}
        </Pressable>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 32 },
  brandBlock: { gap: 12 },
  eyebrow: { color: '#F97316', fontSize: 14, fontWeight: '800', letterSpacing: 3 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '800', maxWidth: 460 },
  subtitle: { fontSize: 17, lineHeight: 25, opacity: 0.7, maxWidth: 520 },
  card: { gap: 16, maxWidth: 520, padding: 22, borderRadius: 20, backgroundColor: '#F8FAFC' },
  cardTitle: { fontSize: 20, fontWeight: '700' },
  cardText: { fontSize: 15, lineHeight: 22, color: '#475569' },
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#0F172A', paddingHorizontal: 20 },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  warning: { color: '#9A3412', lineHeight: 20 },
  error: { color: '#B91C1C', lineHeight: 20 },
});
