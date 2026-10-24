import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { InsurerShell } from '@/components/InsurerShell';
import { AUTH_ENABLED } from '@/config/auth';
import { useAuth } from '@/hooks/useAuth';
import { getInsurerDossiers, getInsurerOrganizations, type InsurerDossier, type InsurerOrganization } from '@/lib/insurer-dashboard';
import { isInsurerAccent } from '@/lib/insurer-theme';

const formatter = new Intl.NumberFormat('fr-FR');
const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

function buildMonthlyActivity(dossiers: InsurerDossier[]) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return { key: `${date.getFullYear()}-${date.getMonth()}`, label: monthFormatter.format(date), value: 0 };
  });
  const values = new Map(months.map((month) => [month.key, month]));
  for (const dossier of dossiers) {
    const date = new Date(dossier.created_at);
    const month = values.get(`${date.getFullYear()}-${date.getMonth()}`);
    if (month) month.value += 1;
  }
  return months;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export default function InsurerDashboardPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const { loading: authLoading, session } = useAuth();
  const [organizations, setOrganizations] = useState<InsurerOrganization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [dossiers, setDossiers] = useState<InsurerDossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      await Promise.resolve();
      if (!active) return;
      if (!session?.user.id) {
        setOrganizations([]);
        setDossiers([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const foundOrganizations = await getInsurerOrganizations(session.user.id);
        if (!active) return;
        setOrganizations(foundOrganizations);
        const selectedId = foundOrganizations.some((organization) => organization.id === selectedOrganizationId)
          ? selectedOrganizationId
          : foundOrganizations[0]?.id ?? null;
        if (selectedId !== selectedOrganizationId) setSelectedOrganizationId(selectedId);
        if (!selectedId) {
          setDossiers([]);
          return;
        }
        const foundDossiers = await getInsurerDossiers(selectedId);
        if (active) setDossiers(foundDossiers);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Le tableau de bord n’a pas pu être chargé.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [selectedOrganizationId, session?.user.id]);

  const selectedOrganization = organizations.find((organization) => organization.id === selectedOrganizationId) ?? null;
  const activeDossiers = dossiers.filter((dossier) => !dossier.archived_at);
  const archivedDossiers = dossiers.filter((dossier) => dossier.archived_at);
  const comparisonCount = dossiers.reduce((sum, dossier) => sum + dossier.comparisonCount, 0);
  const lineCount = dossiers.reduce((sum, dossier) => sum + dossier.lineCount, 0);
  const activity = useMemo(() => buildMonthlyActivity(dossiers), [dossiers]);
  const maxActivity = Math.max(1, ...activity.map((month) => month.value));

  return (
    <InsurerShell accentColor={selectedOrganization && isInsurerAccent(selectedOrganization.accent_color) ? selectedOrganization.accent_color : 'blue'}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, compact && styles.pageCompact]}>
        {authLoading || loading ? (
          <View style={styles.loadingState}><ActivityIndicator color="#397FBD" /><Text style={styles.loadingText}>Chargement de votre espace assureur…</Text></View>
        ) : !AUTH_ENABLED || !session ? (
          <View style={styles.accessCard}>
            <View style={styles.accessIcon}><Text style={styles.accessIconText}>↗</Text></View>
            <Text style={styles.eyebrow}>ESPACE ASSUREUR</Text>
            <Text style={[styles.pageTitle, compact && styles.pageTitleCompact]}>Connectez-vous pour suivre vos dossiers.</Text>
            <Text style={styles.bodyText}>Votre espace d’organisation rassemble les devis examinés, les références Check et les offres des concessionnaires.</Text>
            <Pressable onPress={() => router.push('/sign-in')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Se connecter</Text><Text style={styles.buttonArrow}>→</Text></Pressable>
          </View>
        ) : error ? (
          <View style={styles.errorBox}><Text style={styles.errorTitle}>Impossible de charger l’espace</Text><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => { setSelectedOrganizationId(null); setLoading(true); }} style={styles.retryButton}><Text style={styles.retryText}>Réessayer</Text></Pressable></View>
        ) : !selectedOrganization ? (
          <View style={styles.accessCard}>
            <View style={styles.accessIcon}><Text style={styles.accessIconText}>▣</Text></View>
            <Text style={styles.eyebrow}>ESPACE ORGANISATIONNEL</Text>
            <Text style={[styles.pageTitle, compact && styles.pageTitleCompact]}>Votre compte n’est pas encore rattaché à un assureur.</Text>
            <Text style={styles.bodyText}>Demandez au responsable de votre organisation ou à Check de relier votre compte. Les dossiers resteront visibles uniquement aux membres autorisés.</Text>
            <Pressable onPress={() => router.push('/catalogue')} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Explorer les références</Text></Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.hero, compact && styles.heroCompact]}>
              <View style={styles.heroCopy}>
                <Text style={styles.eyebrow}>ESPACE ASSUREUR · {selectedOrganization.name.toLocaleUpperCase('fr')}</Text>
                <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>Une vue claire sur chaque décision.</Text>
                <Text style={styles.heroText}>Suivez les dossiers de sinistre, examinez les écarts de prix et retrouvez les offres partenaires de votre organisation.</Text>
                <View style={styles.heroActions}>
                  <Pressable onPress={() => router.push('/assureur/dossiers')} style={styles.heroButton}><Text style={styles.heroButtonText}>Ouvrir les dossiers</Text><Text style={styles.heroButtonArrow}>→</Text></Pressable>
                  <Pressable onPress={() => router.push('/assureur/offres')} style={styles.heroSecondary}><Text style={styles.heroSecondaryText}>Voir les offres partenaires</Text></Pressable>
                </View>
              </View>
              <View style={styles.heroVisual}>
                <View style={styles.visualHalo}><Text style={styles.visualIcon}>✓</Text></View>
                <View style={styles.visualPill}><View style={styles.visualDot} /><Text style={styles.visualPillText}>Référence vérifiable</Text></View>
              </View>
            </View>

            {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

            <View style={[styles.metrics, compact && styles.metricsCompact]}>
              <MetricCard label="Dossiers actifs" value={formatter.format(activeDossiers.length)} note="Non archivés" icon="▣" tone="blue" />
              <MetricCard label="Comparaisons enregistrées" value={formatter.format(comparisonCount)} note="Sur vos dossiers" icon="≈" tone="violet" />
              <MetricCard label="Pièces dans les devis" value={formatter.format(lineCount)} note="Lignes enregistrées" icon="⚙" tone="mint" />
              <MetricCard label="Dossiers archivés" value={formatter.format(archivedDossiers.length)} note="Historique de l’organisation" icon="✓" tone="slate" />
            </View>

            <View style={[styles.contentGrid, compact && styles.contentGridCompact]}>
              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <View><Text style={styles.panelTitle}>Évolution de l’activité</Text><Text style={styles.panelSubtitle}>Dossiers créés au cours des six derniers mois</Text></View>
                  <View style={styles.periodBadge}><Text style={styles.periodBadgeText}>6 MOIS</Text></View>
                </View>
                <View style={styles.chart}>
                  {activity.map((month) => (
                    <View key={month.key} style={styles.chartColumn}>
                      <Text style={styles.chartValue}>{month.value ? formatter.format(month.value) : ''}</Text>
                      <View style={styles.chartTrack}><View style={[styles.chartBar, { height: `${Math.max(month.value ? 12 : 3, month.value / maxActivity * 100)}%` }]} /></View>
                      <Text style={styles.chartLabel}>{month.label}</Text>
                    </View>
                  ))}
                </View>
                {dossiers.length === 0 && <Text style={styles.chartEmpty}>L’activité apparaîtra ici dès qu’un dossier sera enregistré.</Text>}
              </View>

              <View style={styles.insightPanel}>
                <View style={styles.insightMark}><Text style={styles.insightMarkText}>↗</Text></View>
                <Text style={styles.insightEyebrow}>DU DEVIS À LA COMMANDE</Text>
                <Text style={styles.insightTitle}>Un parcours de décision suivi de bout en bout.</Text>
                <Text style={styles.insightText}>Comparez une pièce à sa référence Check, consultez les concessionnaires partenaires et gardez la décision liée à votre dossier.</Text>
                <View style={styles.insightSteps}>
                  <Step number="01" label="Comparer" />
                  <View style={styles.stepLine} />
                  <Step number="02" label="Choisir" />
                  <View style={styles.stepLine} />
                  <Step number="03" label="Suivre" />
                </View>
              </View>
            </View>

            <View style={styles.listPanel}>
              <View style={[styles.listHeader, compact && styles.listHeaderCompact]}>
                <View><Text style={styles.panelTitle}>Dossiers récents</Text><Text style={styles.panelSubtitle}>Activité visible pour votre organisation</Text></View>
                <Link href="/assureur/dossiers" asChild><Pressable style={styles.listAction}><Text style={styles.listActionText}>Tous les dossiers</Text><Text style={styles.listActionArrow}>→</Text></Pressable></Link>
              </View>
              {dossiers.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyMark}><Text style={styles.emptyMarkText}>▤</Text></View>
                  <Text style={styles.emptyTitle}>Aucun dossier pour le moment</Text>
                  <Text style={styles.emptyText}>Les dossiers et les devis de votre organisation apparaîtront ici au fur et à mesure de leur traitement.</Text>
                  <Pressable onPress={() => router.push('/assureur/dossiers')} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Créer un dossier de sinistre</Text></Pressable>
                </View>
              ) : (
                <View style={styles.dossierList}>
                  {dossiers.slice(0, 6).map((dossier) => (
                    <Pressable key={dossier.id} onPress={() => router.push({ pathname: '/assureur/dossiers/[id]', params: { id: dossier.id } })} style={styles.dossierRow}>
                      <View style={styles.dossierMark}><Text style={styles.dossierMarkText}>▤</Text></View>
                      <View style={styles.dossierCopy}><Text numberOfLines={1} style={styles.dossierTitle}>{dossier.title}</Text><Text style={styles.dossierMeta}>Mis à jour le {shortDate(dossier.updated_at)} · {dossier.estimateCount} devis · {dossier.lineCount} pièce{dossier.lineCount === 1 ? '' : 's'}</Text></View>
                      <View style={[styles.statusPill, dossier.archived_at ? styles.statusArchived : styles.statusActive]}><Text style={[styles.statusText, dossier.archived_at ? styles.statusArchivedText : styles.statusActiveText]}>{dossier.archived_at ? 'Archivé' : dossier.workflow_status === 'decision_recorded' ? 'Décision prise' : dossier.workflow_status === 'compared' ? 'Comparé' : dossier.workflow_status === 'draft' ? 'Brouillon' : 'À examiner'}</Text></View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </InsurerShell>
  );
}

function MetricCard({ label, value, note, icon, tone }: { label: string; value: string; note: string; icon: string; tone: 'blue' | 'violet' | 'mint' | 'slate' }) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricTop}><Text style={styles.metricLabel}>{label}</Text><View style={[styles.metricIcon, styles[`metricIcon_${tone}`]]}><Text style={[styles.metricIconText, styles[`metricIconText_${tone}`]]}>{icon}</Text></View></View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricNote}>{note}</Text>
    </View>
  );
}

function Step({ number, label }: { number: string; label: string }) {
  return <View style={styles.step}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{number}</Text></View><Text style={styles.stepLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  page: { width: '100%', maxWidth: 1320, paddingHorizontal: 30, paddingTop: 26, paddingBottom: 50, alignSelf: 'center' },
  pageCompact: { paddingHorizontal: 15, paddingTop: 17 },
  loadingState: { minHeight: 370, justifyContent: 'center', alignItems: 'center', gap: 11 },
  loadingText: { color: '#75899D', fontSize: 11 },
  accessCard: { minHeight: 390, maxWidth: 740, padding: 34, justifyContent: 'center', alignItems: 'flex-start', borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1EAF3' },
  accessIcon: { width: 49, height: 49, marginBottom: 19, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#EAF4FE' },
  accessIconText: { color: '#397FBD', fontSize: 22, fontWeight: '900' },
  eyebrow: { color: '#4F8ABD', fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  pageTitle: { maxWidth: 620, marginTop: 9, color: '#183653', fontSize: 31, lineHeight: 38, fontWeight: '800', letterSpacing: -.7 },
  pageTitleCompact: { fontSize: 27, lineHeight: 34 },
  bodyText: { maxWidth: 550, marginTop: 10, color: '#75889A', fontSize: 11, lineHeight: 18 },
  primaryButton: { minHeight: 42, marginTop: 21, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 10, backgroundColor: '#397FBD' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  buttonArrow: { color: '#DDEEFF', fontSize: 14, fontWeight: '900' },
  secondaryButton: { minHeight: 39, marginTop: 18, paddingHorizontal: 13, justifyContent: 'center', borderWidth: 1, borderColor: '#D7E5F2', borderRadius: 10, backgroundColor: '#F7FAFD' },
  secondaryButtonText: { color: '#416C91', fontSize: 10, fontWeight: '800' },
  errorBox: { marginBottom: 15, padding: 14, borderRadius: 10, backgroundColor: '#FCECEB' },
  errorTitle: { color: '#8D4942', fontSize: 11, fontWeight: '800' },
  errorText: { marginTop: 4, color: '#955D55', fontSize: 10 },
  retryButton: { alignSelf: 'flex-start', marginTop: 9, paddingVertical: 5 },
  retryText: { color: '#416C91', fontSize: 10, fontWeight: '800' },
  hero: { minHeight: 220, padding: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 22, borderRadius: 19, backgroundColor: '#12385F', overflow: 'hidden' },
  heroCompact: { minHeight: 290, padding: 21, flexDirection: 'column', alignItems: 'stretch' },
  heroCopy: { flex: 1, maxWidth: 760 },
  heroTitle: { marginTop: 10, color: '#FFFFFF', fontSize: 31, lineHeight: 37, fontWeight: '800', letterSpacing: -.8 },
  heroTitleCompact: { fontSize: 27, lineHeight: 33 },
  heroText: { maxWidth: 650, marginTop: 8, color: '#D6E5F2', fontSize: 10, lineHeight: 17 },
  heroActions: { marginTop: 17, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9 },
  heroButton: { minHeight: 39, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 9, backgroundColor: '#6DB0E9' },
  heroButtonText: { color: '#102D50', fontSize: 10, fontWeight: '900' },
  heroButtonArrow: { color: '#102D50', fontSize: 14, fontWeight: '900' },
  heroSecondary: { minHeight: 39, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: '#54789B', borderRadius: 9, backgroundColor: '#1A456E' },
  heroSecondaryText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  heroVisual: { width: 180, minHeight: 135, alignItems: 'center', justifyContent: 'center' },
  visualHalo: { width: 94, height: 94, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#6DAFE3', borderRadius: 36, backgroundColor: '#1C4C78', transform: [{ rotate: '-8deg' }] },
  visualIcon: { color: '#9FD3FF', fontSize: 42, fontWeight: '700' },
  visualPill: { marginTop: -8, paddingHorizontal: 11, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#D9E8F6', borderRadius: 99, backgroundColor: '#FFFFFF' },
  visualDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#5AAA83' },
  visualPillText: { color: '#3A5D78', fontSize: 8, fontWeight: '800' },
  metrics: { marginTop: 15, flexDirection: 'row', gap: 11 },
  metricsCompact: { flexDirection: 'column' },
  metricCard: { flex: 1, minHeight: 106, padding: 14, borderWidth: 1, borderColor: '#E3EAF2', borderRadius: 13, backgroundColor: '#FFFFFF' },
  metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  metricLabel: { color: '#72859A', fontSize: 9, fontWeight: '700' },
  metricIcon: { width: 27, height: 27, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  metricIcon_blue: { backgroundColor: '#E8F3FD' },
  metricIcon_violet: { backgroundColor: '#F0ECFA' },
  metricIcon_mint: { backgroundColor: '#E9F5EF' },
  metricIcon_slate: { backgroundColor: '#EEF2F6' },
  metricIconText: { fontSize: 12, fontWeight: '900' },
  metricIconText_blue: { color: '#4C8BC1' },
  metricIconText_violet: { color: '#8064AE' },
  metricIconText_mint: { color: '#4D8D67' },
  metricIconText_slate: { color: '#667A8D' },
  metricValue: { marginTop: 6, color: '#183653', fontSize: 25, fontWeight: '900' },
  metricNote: { marginTop: 2, color: '#91A0AE', fontSize: 8 },
  contentGrid: { marginTop: 15, flexDirection: 'row', alignItems: 'stretch', gap: 13 },
  contentGridCompact: { flexDirection: 'column' },
  panel: { flex: 1.45, minHeight: 223, padding: 17, borderWidth: 1, borderColor: '#E2EAF2', borderRadius: 14, backgroundColor: '#FFFFFF' },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  panelTitle: { color: '#203A52', fontSize: 13, fontWeight: '800' },
  panelSubtitle: { marginTop: 4, color: '#8A9AAB', fontSize: 8 },
  periodBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99, backgroundColor: '#EFF5FB' },
  periodBadgeText: { color: '#557C9F', fontSize: 7, fontWeight: '900', letterSpacing: .5 },
  chart: { height: 130, marginTop: 15, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: 8 },
  chartColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  chartValue: { minHeight: 11, color: '#748BA0', fontSize: 8, fontWeight: '700' },
  chartTrack: { width: '65%', flex: 1, maxWidth: 33, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 8, backgroundColor: '#F0F5FA' },
  chartBar: { width: '100%', minHeight: 3, borderRadius: 8, backgroundColor: '#69A8DF' },
  chartLabel: { color: '#8798A8', fontSize: 8, textTransform: 'capitalize' },
  chartEmpty: { marginTop: 8, color: '#9AA7B3', fontSize: 8, textAlign: 'center' },
  insightPanel: { flex: 1, minHeight: 223, padding: 18, borderRadius: 14, backgroundColor: '#EAF3FB' },
  insightMark: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#D5E8F8' },
  insightMarkText: { color: '#4C8BBF', fontSize: 14, fontWeight: '900' },
  insightEyebrow: { marginTop: 13, color: '#5484AB', fontSize: 7, fontWeight: '900', letterSpacing: 1.2 },
  insightTitle: { marginTop: 6, color: '#203A52', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  insightText: { marginTop: 5, color: '#617D96', fontSize: 8, lineHeight: 14 },
  insightSteps: { marginTop: 15, flexDirection: 'row', alignItems: 'center', gap: 7 },
  step: { alignItems: 'center', gap: 4 },
  stepNumber: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#FFFFFF' },
  stepNumberText: { color: '#4C83B1', fontSize: 7, fontWeight: '900' },
  stepLabel: { color: '#6D8296', fontSize: 7, fontWeight: '700' },
  stepLine: { flex: 1, height: 1, marginBottom: 11, backgroundColor: '#B9D0E4' },
  listPanel: { marginTop: 15, padding: 17, borderWidth: 1, borderColor: '#E2EAF2', borderRadius: 14, backgroundColor: '#FFFFFF' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  listHeaderCompact: { alignItems: 'flex-start', flexDirection: 'column' },
  listAction: { minHeight: 33, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, backgroundColor: '#EEF5FC' },
  listActionText: { color: '#426F96', fontSize: 8, fontWeight: '800' },
  listActionArrow: { color: '#4C8BC1', fontSize: 11, fontWeight: '900' },
  emptyState: { minHeight: 190, padding: 18, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: '#EEF2F6', marginTop: 13 },
  emptyMark: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#EFF5FB' },
  emptyMarkText: { color: '#7299BA', fontSize: 17 },
  emptyTitle: { marginTop: 10, color: '#2A4358', fontSize: 12, fontWeight: '800' },
  emptyText: { maxWidth: 410, marginTop: 5, color: '#8796A5', fontSize: 8, lineHeight: 14, textAlign: 'center' },
  emptyButton: { minHeight: 34, marginTop: 11, paddingHorizontal: 11, justifyContent: 'center', borderRadius: 8, backgroundColor: '#397FBD' },
  emptyButtonText: { color: '#FFFFFF', fontSize: 8, fontWeight: '800' },
  dossierList: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#EEF2F6' },
  dossierRow: { minHeight: 59, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#F0F3F6' },
  dossierMark: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#EEF5FB' },
  dossierMarkText: { color: '#6596C2', fontSize: 13 },
  dossierCopy: { flex: 1, minWidth: 0 },
  dossierTitle: { color: '#2D465C', fontSize: 9, fontWeight: '800' },
  dossierMeta: { marginTop: 3, color: '#8B9AAA', fontSize: 7 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99 },
  statusArchived: { backgroundColor: '#EFF1F4' },
  statusActive: { backgroundColor: '#EAF4FC' },
  statusText: { fontSize: 7, fontWeight: '800' },
  statusArchivedText: { color: '#758393' },
  statusActiveText: { color: '#477DA8' },
});
