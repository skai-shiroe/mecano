import { Link, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { InsurerShell } from '@/components/InsurerShell';
import { AUTH_ENABLED } from '@/config/auth';
import { useAuth } from '@/hooks/useAuth';
import { acceptInsurerOrganizationInvitation } from '@/lib/insurer-organization-settings';
import { supabase } from '@/lib/supabase';
import { getInsurerOrganizations } from '@/lib/insurer-dashboard';

export default function InsurerInvitationPage() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const router = useRouter();
  const { loading: authLoading, session } = useAuth();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const redirectPath = token ? `/assureur/invitation?token=${encodeURIComponent(token)}` : '/assureur/invitation';
  const signInHref = { pathname: '/sign-in', params: { redirect: redirectPath } } as Href;

  async function switchAccount() {
    await supabase.auth.signOut();
    router.replace(signInHref);
  }

  async function acceptInvitation() {
    if (!token) return;
    setAccepting(true);
    setError(null);
    try {
      const organizationId = await acceptInsurerOrganizationInvitation(token);
      const organizations = session?.user.id ? await getInsurerOrganizations(session.user.id) : [];
      setOrganizationName(organizations.find((item) => item.id === organizationId)?.name ?? 'votre organisation');
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'L’invitation n’a pas pu être acceptée.');
    } finally {
      setAccepting(false);
    }
  }

  return (
    <InsurerShell>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.card}>
          <View style={styles.mark}><Text style={styles.markText}>{organizationName ? '✓' : '↗'}</Text></View>
          <Text style={styles.eyebrow}>INVITATION · ESPACE ASSUREUR</Text>
          <Text style={styles.title}>{organizationName ? 'Bienvenue dans l’équipe.' : 'Rejoins ton organisation.'}</Text>
          <Text style={styles.body}>
            {organizationName
              ? `Ton compte Google est maintenant rattaché à ${organizationName}.`
              : 'Cette invitation est nominative et ne peut être acceptée qu’avec l’adresse Google à laquelle elle a été envoyée.'}
          </Text>

          {authLoading ? <View style={styles.loading}><ActivityIndicator color="#397FBD" /><Text style={styles.muted}>Vérification de la connexion…</Text></View> : !token ? (
            <Text style={styles.error}>Ce lien ne contient pas de jeton d’invitation valide.</Text>
          ) : organizationName ? (
            <Pressable onPress={() => router.replace('/assureur')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Ouvrir mon espace assureur →</Text></Pressable>
          ) : !AUTH_ENABLED || !session ? (
            <Link href={signInHref} asChild><Pressable style={styles.primaryButton}><Text style={styles.primaryButtonText}>Continuer avec Google →</Text></Pressable></Link>
          ) : (
            <>
              <Text style={styles.accountLine}>Connecté avec : <Text style={styles.accountEmail}>{session.user.email ?? 'compte Google'}</Text></Text>
              <Pressable onPress={acceptInvitation} disabled={accepting} style={[styles.primaryButton, accepting && styles.disabled]}>
                {accepting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Accepter l’invitation →</Text>}
              </Pressable>
              <Pressable onPress={switchAccount} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Utiliser un autre compte Google</Text></Pressable>
            </>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
          <Text style={styles.footnote}>Les droits détaillés sur les dossiers seront définis par l’organisation dans une prochaine étape.</Text>
        </View>
      </ScrollView>
    </InsurerShell>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, minHeight: 440, padding: 22, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', maxWidth: 560, padding: 28, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1EAF3' },
  mark: { width: 47, height: 47, marginBottom: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#EAF4FE' },
  markText: { color: '#397FBD', fontSize: 23, fontWeight: '900' },
  eyebrow: { color: '#4F8ABD', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  title: { marginTop: 8, color: '#183653', fontSize: 27, lineHeight: 34, fontWeight: '800' },
  body: { marginTop: 9, color: '#75889A', fontSize: 11, lineHeight: 18 },
  loading: { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 9 },
  muted: { color: '#75899D', fontSize: 10 },
  accountLine: { marginTop: 18, color: '#75889A', fontSize: 10 },
  accountEmail: { color: '#345570', fontWeight: '800' },
  primaryButton: { minHeight: 43, marginTop: 18, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#397FBD' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  disabled: { opacity: .6 },
  secondaryButton: { minHeight: 38, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#56748E', fontSize: 9, fontWeight: '700' },
  error: { marginTop: 14, color: '#A13D38', fontSize: 10, lineHeight: 16 },
  footnote: { marginTop: 20, color: '#8A9BA9', fontSize: 9, lineHeight: 15 },
});
