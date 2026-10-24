import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { AppShell } from '@/components/AppShell';
import { AUTH_ENABLED } from '@/config/auth';
import { useAuth } from '@/hooks/useAuth';
import { canManageCatalogPrices } from '@/lib/catalog';
import { createInsurerOrganization, getAdminInsurerOrganizations, type AdminInsurerOrganization } from '@/lib/admin-organizations';

type AccessResult = { userId: string; allowed: boolean; error: string | null };

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export default function AdminInsurersScreen() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 760;
  const { loading: authLoading, session } = useAuth();
  const [accessResult, setAccessResult] = useState<AccessResult | null>(null);
  const [organizations, setOrganizations] = useState<AdminInsurerOrganization[]>([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [name, setName] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const access = authLoading
    ? 'checking'
    : !AUTH_ENABLED || !session
      ? 'sign-in'
      : accessResult && accessResult.userId === session.user.id
        ? accessResult.allowed ? 'allowed' : 'denied'
        : 'checking';
  const accessError = accessResult && accessResult.userId === session?.user.id ? accessResult.error : null;

  useEffect(() => {
    if (!AUTH_ENABLED || authLoading || !session) return;
    let active = true;
    const userId = session.user.id;
    void canManageCatalogPrices()
      .then((allowed) => { if (active) setAccessResult({ userId, allowed, error: null }); })
      .catch((error: unknown) => {
        if (active) setAccessResult({ userId, allowed: false, error: error instanceof Error ? error.message : 'La vérification des droits a échoué.' });
      });
    return () => { active = false; };
  }, [authLoading, session]);

  useEffect(() => {
    if (access !== 'allowed') return;
    let active = true;
    void getAdminInsurerOrganizations()
      .then((items) => { if (active) setOrganizations(items); })
      .catch((error: unknown) => {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Les organisations assureur n’ont pas pu être chargées.');
      })
      .finally(() => { if (active) setLoadingOrganizations(false); });
    return () => { active = false; };
  }, [access, refreshKey]);

  async function submit() {
    if (name.trim().length < 2 || !managerEmail.trim().includes('@')) {
      setErrorMessage('Indique le nom de l’organisation et l’adresse e-mail du responsable.');
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    setFeedback(null);
    try {
      await createInsurerOrganization(name, managerEmail);
      setFeedback(`L’organisation « ${name.trim()} » est créée. Le compte ${managerEmail.trim()} est rattaché comme responsable.`);
      setName('');
      setManagerEmail('');
      setLoadingOrganizations(true);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'La création de l’organisation a échoué.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, compact && styles.pageCompact]}>
        <View style={[styles.header, compact && styles.headerCompact]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ADMINISTRATION · ASSUREURS</Text>
            <Text style={[styles.title, compact && styles.titleCompact]}>Organisations assureur</Text>
            <Text style={styles.subtitle}>Crée l’organisation vérifiée et rattache son premier responsable. Celui-ci pourra ensuite gérer son équipe.</Text>
          </View>
          <Pressable onPress={() => router.push('/assureur')} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Voir l’espace assureur →</Text></Pressable>
        </View>

        {authLoading || access === 'checking' ? (
          <MessageCard><ActivityIndicator color="#397FBD" /><Text style={styles.messageText}>Vérification de l’accès administrateur…</Text></MessageCard>
        ) : access === 'sign-in' ? (
          <MessageCard><Text style={styles.messageTitle}>Connexion requise</Text><Text style={styles.messageText}>Connecte-toi avec un compte administrateur pour gérer les organisations assureur.</Text><Pressable onPress={() => router.push('/sign-in')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Se connecter</Text></Pressable></MessageCard>
        ) : access === 'denied' ? (
          <MessageCard><Text style={styles.messageTitle}>Accès réservé</Text><Text style={styles.messageText}>{accessError ?? 'Ce compte ne possède pas les droits d’administration.'}</Text></MessageCard>
        ) : (
          <>
            {feedback && <View style={styles.feedback}><Text style={styles.feedbackText}>{feedback}</Text></View>}
            {errorMessage && <View style={styles.error}><Text style={styles.errorText}>{errorMessage}</Text></View>}

            <View style={[styles.contentGrid, compact && styles.contentGridCompact]}>
              <View style={styles.formCard}>
                <View style={styles.cardIcon}><Text style={styles.cardIconText}>＋</Text></View>
                <Text style={styles.cardTitle}>Rattacher un assureur</Text>
                <Text style={styles.cardDescription}>Le responsable doit déjà avoir créé et confirmé son compte Check. Il recevra le rôle de manager de cette organisation.</Text>

                <Text style={styles.label}>Nom de l’organisation</Text>
                <TextInput value={name} onChangeText={setName} maxLength={200} placeholder="Ex. Assurance du Golfe" placeholderTextColor="#91A0AE" style={styles.input} />
                <Text style={styles.label}>E-mail du premier responsable</Text>
                <TextInput value={managerEmail} onChangeText={setManagerEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="responsable@assureur.tg" placeholderTextColor="#91A0AE" style={styles.input} />
                <View style={styles.info}><Text style={styles.infoMark}>i</Text><Text style={styles.infoText}>Cette étape ne crée pas encore les invitations ni les droits par dossier. Le responsable sera rattaché à une seule organisation assureur.</Text></View>
                <Pressable onPress={() => { void submit(); }} disabled={saving} style={[styles.primaryButton, saving && styles.disabled]}>
                  {saving && <ActivityIndicator color="#FFFFFF" size="small" />}
                  <Text style={styles.primaryButtonText}>{saving ? 'Création…' : 'Créer et rattacher le responsable'}</Text>
                </Pressable>
              </View>

              <View style={styles.listCard}>
                <View style={styles.listHeader}><View><Text style={styles.cardTitle}>Assureurs enregistrés</Text><Text style={styles.listSubtitle}>Organisations actuellement reliées à Check</Text></View><Text style={styles.count}>{organizations.length}</Text></View>
                {loadingOrganizations ? <View style={styles.loading}><ActivityIndicator color="#397FBD" /><Text style={styles.messageText}>Chargement…</Text></View> : organizations.length === 0 ? (
                  <View style={styles.empty}><Text style={styles.emptyMark}>▤</Text><Text style={styles.emptyTitle}>Aucune organisation assureur</Text><Text style={styles.emptyText}>La première apparaîtra ici après son rattachement.</Text></View>
                ) : (
                  <View style={styles.organizationList}>
                    {organizations.map((organization) => (
                      <View key={organization.id} style={styles.organizationRow}>
                        <View style={styles.organizationIcon}><Text style={styles.organizationIconText}>▤</Text></View>
                        <View style={styles.organizationCopy}><Text style={styles.organizationName}>{organization.name}</Text><Text style={styles.organizationDate}>Ajoutée le {dateLabel(organization.created_at)}</Text></View>
                        <View style={[styles.statusPill, organization.is_active ? styles.statusActive : styles.statusInactive]}><Text style={[styles.statusText, organization.is_active ? styles.statusActiveText : styles.statusInactiveText]}>{organization.is_active ? 'Active' : 'Suspendue'}</Text></View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

function MessageCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.messageCard}>{children}</View>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  page: { width: '100%', maxWidth: 1280, paddingHorizontal: 30, paddingTop: 28, paddingBottom: 50, alignSelf: 'center' },
  pageCompact: { paddingHorizontal: 15, paddingTop: 18 },
  header: { marginBottom: 22, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18 },
  headerCompact: { flexDirection: 'column', alignItems: 'stretch' },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#4F8ABD', fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  title: { marginTop: 8, color: '#173653', fontSize: 29, lineHeight: 35, fontWeight: '900', letterSpacing: -.8 },
  titleCompact: { fontSize: 25, lineHeight: 31 },
  subtitle: { maxWidth: 720, marginTop: 8, color: '#71859A', fontSize: 10, lineHeight: 17 },
  secondaryButton: { minHeight: 39, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 9, backgroundColor: '#EAF3FB' },
  secondaryButtonText: { color: '#426F96', fontSize: 9, fontWeight: '800' },
  contentGrid: { flexDirection: 'row', alignItems: 'stretch', gap: 15 },
  contentGridCompact: { flexDirection: 'column' },
  formCard: { flex: 1, minWidth: 0, padding: 22, borderWidth: 1, borderColor: '#DFE8F1', borderRadius: 15, backgroundColor: '#FFFFFF' },
  listCard: { flex: 1, minWidth: 0, padding: 22, borderWidth: 1, borderColor: '#DFE8F1', borderRadius: 15, backgroundColor: '#FFFFFF' },
  cardIcon: { width: 34, height: 34, marginBottom: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#EAF3FB' },
  cardIconText: { color: '#397FBD', fontSize: 20, fontWeight: '700' },
  cardTitle: { color: '#1B3D5A', fontSize: 13, fontWeight: '900' },
  cardDescription: { marginTop: 6, color: '#7A8DA0', fontSize: 9, lineHeight: 15 },
  label: { marginTop: 16, marginBottom: 6, color: '#405D76', fontSize: 9, fontWeight: '800' },
  input: { minHeight: 42, paddingHorizontal: 11, borderWidth: 1, borderColor: '#DCE6EF', borderRadius: 9, backgroundColor: '#FAFCFE', color: '#1D3C57', fontSize: 10 },
  info: { marginTop: 14, padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: 9, backgroundColor: '#F1F6FA' },
  infoMark: { width: 18, height: 18, borderRadius: 6, backgroundColor: '#DCEAF5', color: '#4C80A8', fontSize: 11, fontWeight: '900', textAlign: 'center', lineHeight: 18 },
  infoText: { flex: 1, color: '#6F8498', fontSize: 8, lineHeight: 14 },
  primaryButton: { minHeight: 42, marginTop: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 9, backgroundColor: '#397FBD' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  disabled: { opacity: .6 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  listSubtitle: { marginTop: 4, color: '#8A9AAA', fontSize: 8 },
  count: { minWidth: 27, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99, backgroundColor: '#EEF5FB', color: '#4A7DA5', fontSize: 9, fontWeight: '900', textAlign: 'center' },
  loading: { minHeight: 150, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  empty: { minHeight: 190, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: '#EDF1F5', marginTop: 14 },
  emptyMark: { width: 37, height: 37, marginBottom: 9, borderRadius: 12, backgroundColor: '#EEF5FB', color: '#7799B5', fontSize: 17, lineHeight: 37, textAlign: 'center' },
  emptyTitle: { color: '#3C5770', fontSize: 10, fontWeight: '900' },
  emptyText: { marginTop: 5, color: '#8A99A8', fontSize: 8, textAlign: 'center' },
  organizationList: { marginTop: 15, borderTopWidth: 1, borderTopColor: '#EDF1F5' },
  organizationRow: { minHeight: 58, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#EDF1F5' },
  organizationIcon: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#EEF5FB' },
  organizationIconText: { color: '#5F95C1', fontSize: 13 },
  organizationCopy: { flex: 1, minWidth: 0 },
  organizationName: { color: '#294861', fontSize: 9, fontWeight: '900' },
  organizationDate: { marginTop: 3, color: '#8A99A8', fontSize: 7 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99 },
  statusActive: { backgroundColor: '#E9F5EF' },
  statusInactive: { backgroundColor: '#F2F3F5' },
  statusText: { fontSize: 7, fontWeight: '900' },
  statusActiveText: { color: '#4D8A66' },
  statusInactiveText: { color: '#7E8994' },
  messageCard: { minHeight: 220, padding: 24, justifyContent: 'center', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: '#DFE8F1', borderRadius: 15, backgroundColor: '#FFFFFF' },
  messageTitle: { color: '#1B3D5A', fontSize: 15, fontWeight: '900' },
  messageText: { color: '#778A9C', fontSize: 10, lineHeight: 16 },
  feedback: { marginBottom: 12, padding: 12, borderRadius: 9, backgroundColor: '#EAF5EF' },
  feedbackText: { color: '#356E4C', fontSize: 9, fontWeight: '700' },
  error: { marginBottom: 12, padding: 12, borderRadius: 9, backgroundColor: '#FCECEB' },
  errorText: { color: '#94564E', fontSize: 9, lineHeight: 14 },
});
