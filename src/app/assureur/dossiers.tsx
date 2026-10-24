import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { InsurerShell } from '@/components/InsurerShell';
import { AUTH_ENABLED } from '@/config/auth';
import { useAuth } from '@/hooks/useAuth';
import { createInsurerDossier } from '@/lib/insurer-dossiers';
import { getInsurerDossiers, getInsurerOrganizations, type InsurerDossier, type InsurerOrganization } from '@/lib/insurer-dashboard';

type Filter = 'open' | 'all' | 'archived';

function workflowLabel(status: string, archived: boolean) {
  if (archived) return 'Archivé';
  switch (status) {
    case 'draft': return 'Brouillon';
    case 'compared': return 'Comparé';
    case 'decision_recorded': return 'Décision prise';
    default: return 'À examiner';
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export default function InsurerDossiersPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const { loading: authLoading, session } = useAuth();
  const [organizations, setOrganizations] = useState<InsurerOrganization[]>([]);
  const [organization, setOrganization] = useState<InsurerOrganization | null>(null);
  const [dossiers, setDossiers] = useState<InsurerDossier[]>([]);
  const [title, setTitle] = useState('');
  const [filter, setFilter] = useState<Filter>('open');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!AUTH_ENABLED || !session?.user.id) {
        setLoading(false);
        return;
      }
      try {
        const found = await getInsurerOrganizations(session.user.id);
        if (!active) return;
        setOrganizations(found);
        const firstOrganization = found[0] ?? null;
        setOrganization(firstOrganization);
        if (firstOrganization) setDossiers(await getInsurerDossiers(firstOrganization.id));
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Les dossiers ne sont pas disponibles.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [session?.user.id]);

  const visibleDossiers = useMemo(() => dossiers.filter((dossier) => {
    if (filter === 'archived') return Boolean(dossier.archived_at);
    if (filter === 'open') return !dossier.archived_at;
    return true;
  }), [dossiers, filter]);

  async function createDossier() {
    if (!organization || title.trim().length < 3) {
      setError('Donne un titre d’au moins trois caractères au dossier.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = await createInsurerDossier(organization.id, title);
      router.push({ pathname: '/assureur/dossiers/[id]', params: { id } });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Le dossier n’a pas pu être créé.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <InsurerShell>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, compact && styles.pageCompact]}>
        {authLoading || loading ? (
          <View style={styles.center}><ActivityIndicator color="#397FBD" /><Text style={styles.muted}>Chargement de vos dossiers…</Text></View>
        ) : !AUTH_ENABLED || !session ? (
          <View style={styles.panel}>
            <Text style={styles.eyebrow}>ESPACE ASSUREUR</Text>
            <Text style={styles.title}>Connectez-vous pour ouvrir vos dossiers.</Text>
            <Pressable onPress={() => router.push('/sign-in')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Se connecter</Text></Pressable>
          </View>
        ) : organizations.length === 0 || !organization ? (
          <View style={styles.panel}>
            <Text style={styles.eyebrow}>ESPACE ORGANISATIONNEL</Text>
            <Text style={styles.title}>Votre compte n’est pas encore rattaché à un assureur.</Text>
            <Text style={styles.muted}>Demandez à Check ou au responsable de votre organisation de rattacher votre compte.</Text>
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>DOSSIERS · {organization.name.toLocaleUpperCase('fr')}</Text>
              <Text style={[styles.title, styles.heroTitle, compact && styles.titleCompact]}>Suivez chaque sinistre et ses devis.</Text>
              <Text style={styles.heroText}>Rassemblez plusieurs propositions dans un même dossier, comparez les pièces aux références et consignez la décision de votre équipe.</Text>
            </View>

            <View style={styles.createPanel}>
              <View style={styles.createCopy}>
                <Text style={styles.panelTitle}>Ouvrir un dossier</Text>
                <Text style={styles.muted}>Commencez par le numéro de sinistre ou un titre reconnaissable.</Text>
              </View>
              <View style={[styles.createRow, compact && styles.createRowCompact]}>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  onSubmitEditing={() => { void createDossier(); }}
                  placeholder="Ex. SIN-2026-014 · véhicule Toyota Corolla"
                  placeholderTextColor="#8796A4"
                  returnKeyType="done"
                  maxLength={300}
                  style={styles.input}
                />
                <Pressable disabled={saving} onPress={() => { void createDossier(); }} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, saving && styles.disabled]}>
                  {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.primaryButtonText}>Créer le dossier →</Text>}
                </Pressable>
              </View>
            </View>

            {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

            <View style={styles.toolbar}>
              <View><Text style={styles.panelTitle}>Dossiers accessibles</Text><Text style={styles.muted}>Les accès suivent les droits de votre organisation.</Text></View>
              <View style={styles.filters}>
                {([
                  ['open', 'En cours'],
                  ['all', 'Tous'],
                  ['archived', 'Archivés'],
                ] as const).map(([key, label]) => (
                  <Pressable key={key} onPress={() => setFilter(key)} style={[styles.filterChip, filter === key && styles.filterChipActive]}>
                    <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {visibleDossiers.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>▤</Text>
                <Text style={styles.emptyTitle}>{filter === 'archived' ? 'Aucun dossier archivé' : 'Aucun dossier à afficher'}</Text>
                <Text style={styles.muted}>Créez un dossier, puis ajoutez les devis des concessionnaires pour les comparer ensemble.</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {visibleDossiers.map((dossier) => <DossierCard key={dossier.id} dossier={dossier} onOpen={() => router.push({ pathname: '/assureur/dossiers/[id]', params: { id: dossier.id } })} />)}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </InsurerShell>
  );
}

function DossierCard({ dossier, onOpen }: { dossier: InsurerDossier; onOpen: () => void }) {
  const archived = Boolean(dossier.archived_at);
  return (
    <Pressable onPress={onOpen} accessibilityRole="link" style={({ pressed }) => [styles.dossierCard, pressed && styles.pressed]}>
      <View style={styles.dossierIcon}><Text style={styles.dossierIconText}>▤</Text></View>
      <View style={styles.dossierBody}>
        <Text numberOfLines={1} style={styles.dossierTitle}>{dossier.title}</Text>
        <Text style={styles.dossierMeta}>Mis à jour le {formatDate(dossier.updated_at)} · {dossier.estimateCount} devis · {dossier.lineCount} pièce{dossier.lineCount === 1 ? '' : 's'}</Text>
        <Text style={styles.dossierMeta}>{dossier.assigned_user_id ? 'Attribué à un membre' : 'À attribuer ou traiter par son auteur'}</Text>
      </View>
      <View style={styles.dossierRight}>
        <View style={[styles.statusPill, archived && styles.statusArchived]}><Text style={[styles.statusText, archived && styles.statusArchivedText]}>{workflowLabel(dossier.workflow_status, archived)}</Text></View>
        <Text style={styles.arrow}>→</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  page: { width: '100%', maxWidth: 1220, paddingHorizontal: 30, paddingTop: 28, paddingBottom: 60, alignSelf: 'center' },
  pageCompact: { paddingHorizontal: 15, paddingTop: 16 },
  center: { minHeight: 360, alignItems: 'center', justifyContent: 'center', gap: 10 },
  hero: { padding: 27, borderRadius: 19, backgroundColor: '#12385F' },
  eyebrow: { color: '#78B7EC', fontSize: 9, fontWeight: '900', letterSpacing: 1.35 },
  title: { maxWidth: 760, marginTop: 9, color: '#183653', fontSize: 30, lineHeight: 37, fontWeight: '800' },
  titleCompact: { color: '#FFFFFF', fontSize: 26, lineHeight: 32 },
  heroTitle: { color: '#FFFFFF' },
  heroText: { maxWidth: 740, marginTop: 9, color: '#D4E3F0', fontSize: 11, lineHeight: 18 },
  panel: { padding: 27, borderWidth: 1, borderColor: '#E0E8F0', borderRadius: 17, backgroundColor: '#FFFFFF' },
  createPanel: { marginTop: 16, padding: 20, borderWidth: 1, borderColor: '#E0E8F0', borderRadius: 16, backgroundColor: '#FFFFFF' },
  createCopy: { marginBottom: 12 },
  panelTitle: { color: '#193A59', fontSize: 15, fontWeight: '800' },
  muted: { marginTop: 5, color: '#7D8E9E', fontSize: 10, lineHeight: 16 },
  createRow: { flexDirection: 'row', gap: 9 },
  createRowCompact: { flexDirection: 'column' },
  input: { flex: 1, minWidth: 0, minHeight: 43, paddingHorizontal: 13, borderWidth: 1, borderColor: '#DCE6EF', borderRadius: 10, backgroundColor: '#FBFCFE', color: '#183653', fontSize: 11 },
  primaryButton: { minHeight: 43, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#397FBD' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
  errorBox: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: '#FCECEB' },
  errorText: { color: '#9B534B', fontSize: 10, lineHeight: 16 },
  toolbar: { marginTop: 25, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: { minHeight: 32, paddingHorizontal: 11, justifyContent: 'center', borderRadius: 99, borderWidth: 1, borderColor: '#DDE7F0', backgroundColor: '#FFFFFF' },
  filterChipActive: { borderColor: '#397FBD', backgroundColor: '#EAF4FE' },
  filterText: { color: '#6E8192', fontSize: 9, fontWeight: '700' },
  filterTextActive: { color: '#2C689F' },
  list: { gap: 8 },
  dossierCard: { minHeight: 78, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#E0E8F0', borderRadius: 13, backgroundColor: '#FFFFFF' },
  dossierIcon: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#EAF4FE' },
  dossierIconText: { color: '#397FBD', fontSize: 16, fontWeight: '800' },
  dossierBody: { flex: 1, minWidth: 0 },
  dossierTitle: { color: '#1B3956', fontSize: 12, fontWeight: '800' },
  dossierMeta: { marginTop: 4, color: '#8292A0', fontSize: 9 },
  dossierRight: { alignItems: 'flex-end', gap: 7 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99, backgroundColor: '#EAF4FE' },
  statusArchived: { backgroundColor: '#F0F2F4' },
  statusText: { color: '#3479B6', fontSize: 8, fontWeight: '800' },
  statusArchivedText: { color: '#74808A' },
  arrow: { color: '#397FBD', fontSize: 15, fontWeight: '900' },
  empty: { minHeight: 190, padding: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E0E8F0', borderRadius: 14, backgroundColor: '#FFFFFF' },
  emptyIcon: { color: '#397FBD', fontSize: 28 },
  emptyTitle: { marginTop: 8, color: '#193A59', fontSize: 14, fontWeight: '800' },
});
