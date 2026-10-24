import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { AppShell } from '@/components/AppShell';
import { AUTH_ENABLED } from '@/config/auth';
import { useAuth } from '@/hooks/useAuth';
import { canManageCatalogPrices } from '@/lib/catalog';
import {
  getReferenceIssuesForReview,
  setReferenceIssueDecision,
  type ReferenceIssueForReview,
  type ReviewIssueStatus,
} from '@/lib/catalog-review';

type AccessState = 'checking' | 'allowed' | 'sign-in' | 'denied' | 'error';
type StatusFilter = 'open' | 'resolved' | 'dismissed' | 'all';
type AdminCheck = { userId: string; allowed: boolean; error: string | null };
type IssueResult = {
  userId: string;
  refreshKey: number;
  data: ReferenceIssueForReview[];
  error: string | null;
};

const EMPTY_ISSUES: ReferenceIssueForReview[] = [];

const issueLabels: Record<string, string> = {
  DUPLICATE_SOURCE_NUMBER: 'Numéro de source répété',
  FAMILY_CLASSIFICATION_REVIEW: 'Famille à vérifier',
  OIL_GRADE_TO_REVIEW: 'Grade d’huile à vérifier',
  PILOT_SCOPE_REVIEW: 'Périmètre automobile à vérifier',
  POSSIBLE_DUPLICATE_SPECIFICATION: 'Doublon de spécification possible',
  PRICE_OUTSIDE_BOUNDS: 'Prix moyen hors de l’intervalle',
  SERVICE_TAX_BASIS_REVIEW: 'Base de taxe à vérifier',
  TYRE_DIMENSIONS_INCOMPLETE: 'Dimensions de pneu incomplètes',
  UNIT_PACKAGING_AMBIGUOUS: 'Unité ou conditionnement ambigu',
};

const filters: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'À traiter' },
  { value: 'resolved', label: 'Résolues' },
  { value: 'dismissed', label: 'Écartées' },
  { value: 'all', label: 'Toutes' },
];

function formatAmount(value: number | null) {
  if (value === null) return '—';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return 'Date non précisée';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function statusLabel(status: ReviewIssueStatus) {
  if (status === 'resolved') return 'Résolue';
  if (status === 'dismissed') return 'Écartée';
  return 'À traiter';
}

export default function AdminReviewScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const { loading: authLoading, session } = useAuth();
  const [adminCheck, setAdminCheck] = useState<AdminCheck | null>(null);
  const [issueResult, setIssueResult] = useState<IssueResult | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('open');
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingIssueId, setSavingIssueId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ issueId: string; message: string } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    if (!AUTH_ENABLED || authLoading || !session) return () => { active = false; };
    void canManageCatalogPrices()
      .then((allowed) => {
        if (active) setAdminCheck({ userId: session.user.id, allowed, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setAdminCheck({
          userId: session.user.id,
          allowed: false,
          error: error instanceof Error ? error.message : 'Vérification des droits impossible.',
        });
      });

    return () => { active = false; };
  }, [authLoading, session]);

  const adminCheckForUser = session && adminCheck?.userId === session.user.id ? adminCheck : null;
  const access: AccessState = !AUTH_ENABLED
    ? 'denied'
    : authLoading
      ? 'checking'
      : !session
        ? 'sign-in'
        : !adminCheckForUser
          ? 'checking'
          : adminCheckForUser.error
            ? 'error'
            : adminCheckForUser.allowed
              ? 'allowed'
              : 'denied';

  useEffect(() => {
    if (access !== 'allowed' || !session) return;
    let active = true;
    void getReferenceIssuesForReview()
      .then((data) => {
        if (active) setIssueResult({ userId: session.user.id, refreshKey, data, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setIssueResult({
          userId: session.user.id,
          refreshKey,
          data: [],
          error: error instanceof Error ? error.message : 'Impossible de charger les alertes.',
        });
      })

    return () => { active = false; };
  }, [access, refreshKey, session]);

  const currentIssueResult = session
    && issueResult?.userId === session.user.id
    && issueResult.refreshKey === refreshKey
    ? issueResult
    : null;
  const issues = currentIssueResult?.data ?? EMPTY_ISSUES;
  const loadingIssues = access === 'allowed' && currentIssueResult === null;
  const issuesError = currentIssueResult?.error ?? null;
  const accessError = adminCheckForUser?.error ?? null;

  const counts = useMemo(() => ({
    open: issues.filter((issue) => issue.status === 'open').length,
    resolved: issues.filter((issue) => issue.status === 'resolved').length,
    dismissed: issues.filter((issue) => issue.status === 'dismissed').length,
    entries: new Set(issues.map((issue) => issue.entry.id)).size,
  }), [issues]);

  const visibleIssues = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('fr');
    return issues.filter((issue) => {
      if (filter !== 'all' && issue.status !== filter) return false;
      if (!term) return true;
      return [
        issue.code,
        issue.message,
        issueLabels[issue.code],
        issue.entry.designation,
        issue.entry.source_item_number,
        issue.entry.source_family_label,
        issue.entry.source_group_label,
      ].some((value) => value?.toLocaleLowerCase('fr').includes(term));
    });
  }, [filter, issues, search]);

  async function saveDecision(issue: ReferenceIssueForReview, status: ReviewIssueStatus) {
    const note = status === 'open' ? null : (notes[issue.id] ?? '').trim();
    if (status !== 'open' && note && note.length < 5) {
      setActionError({ issueId: issue.id, message: 'La note doit contenir au moins 5 caractères.' });
      return;
    }
    if (status !== 'open' && !note) {
      setActionError({ issueId: issue.id, message: 'Ajoute une courte note pour expliquer ta décision.' });
      return;
    }

    setSavingIssueId(issue.id);
    setActionError(null);
    setFeedback(null);
    try {
      await setReferenceIssueDecision({ issueId: issue.id, status, note });
      const now = status === 'open' ? null : new Date().toISOString();
      setIssueResult((current) => {
        if (!current || current.userId !== session?.user.id) return current;
        return {
          ...current,
          data: current.data.map((item) => item.id === issue.id ? {
            ...item,
            status,
            resolution_note: note,
            resolved_at: now,
            resolved_by: status === 'open' ? null : session?.user.id ?? null,
          } : item),
        };
      });
      setNotes((current) => ({ ...current, [issue.id]: '' }));
      setFeedback(status === 'open' ? 'Alerte rouverte.' : 'Décision enregistrée. Les données sources n’ont pas été modifiées.');
    } catch (error) {
      setActionError({ issueId: issue.id, message: error instanceof Error ? error.message : 'La décision n’a pas pu être enregistrée.' });
    } finally {
      setSavingIssueId(null);
    }
  }

  if (!AUTH_ENABLED) return <Redirect href="/" />;

  if (access !== 'allowed') {
    const isChecking = access === 'checking';
    const title = access === 'sign-in' ? 'Connecte-toi pour continuer' : access === 'denied' ? 'Accès administrateur requis' : 'Vérification des droits';
    return (
      <AppShell>
        <View style={styles.accessScreen}>
          {isChecking ? <ActivityIndicator color="#2B6049" /> : <View style={styles.accessMark}><Text style={styles.accessMarkText}>!</Text></View>}
          <Text style={styles.accessTitle}>{title}</Text>
          <Text style={styles.accessText}>
            {access === 'sign-in'
              ? 'Cette file est réservée aux administrateurs du catalogue.'
              : access === 'denied'
                ? 'Le compte connecté ne possède pas le rôle catalog_admin.'
                : accessError ?? 'Check vérifie les autorisations du compte.'}
          </Text>
          {access === 'sign-in' && <Pressable onPress={() => router.push('/sign-in')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Connexion Google</Text></Pressable>}
          <Pressable onPress={() => router.replace('/catalogue')} accessibilityRole="link" style={styles.backButton}><Text style={styles.backButtonText}>Retour au catalogue</Text></Pressable>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, compact && styles.pageCompact]}>
        <View style={[styles.intro, compact && styles.introCompact]}>
          <View style={styles.introCopy}>
            <Text style={styles.eyebrow}>ADMINISTRATION · RÉPERTOIRE SOURCE</Text>
            <Text style={[styles.title, compact && styles.titleCompact]}>File de vérification</Text>
            <Text style={styles.subtitle}>Ces alertes automatiques signalent des points à examiner dans l’import du PDF. Elles ne sont pas des réclamations clients.</Text>
          </View>
          <View style={styles.introActions}>
            <Pressable onPress={() => router.push('/admin/suppliers')} style={styles.supplierButton}>
              <Text style={styles.supplierButtonText}>Fournisseurs</Text>
            </Pressable>
            <Pressable onPress={() => setRefreshKey((current) => current + 1)} disabled={loadingIssues} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
              <Text style={styles.refreshButtonText}>{loadingIssues ? 'Actualisation…' : 'Actualiser'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.stats, compact && styles.statsCompact]}>
          <View style={styles.statCard}><Text style={styles.statValue}>{counts.open}</Text><Text style={styles.statLabel}>Alertes à traiter</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{counts.entries}</Text><Text style={styles.statLabel}>Lignes source concernées</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{counts.resolved + counts.dismissed}</Text><Text style={styles.statLabel}>Décisions enregistrées</Text></View>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeMark}>i</Text>
          <Text style={styles.noticeText}>Résoudre ou écarter une alerte enregistre ta décision et ta note. Cela ne modifie ni les valeurs du PDF ni le produit, et ne publie pas automatiquement le prix.</Text>
        </View>

        {feedback && <Text style={styles.feedback}>{feedback}</Text>}
        {issuesError && <View style={styles.errorPanel}><Text style={styles.errorText}>{issuesError}</Text></View>}

        <View style={[styles.controls, compact && styles.controlsCompact]}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un article, une famille ou une alerte…"
            placeholderTextColor="#849188"
            accessibilityLabel="Rechercher dans les alertes source"
            style={styles.searchInput}
          />
          <View style={styles.filters}>
            {filters.map((item) => {
              const selected = filter === item.value;
              const count = item.value === 'all' ? issues.length : counts[item.value];
              return (
                <Pressable key={item.value} onPress={() => setFilter(item.value)} style={[styles.filterButton, selected && styles.filterButtonSelected]}>
                  <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{item.label} · {count}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {loadingIssues ? (
          <View style={styles.loadingPanel}><ActivityIndicator color="#2B6049" /><Text style={styles.loadingText}>Chargement des alertes…</Text></View>
        ) : visibleIssues.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>{issues.length === 0 ? 'Aucune alerte source.' : 'Aucune alerte pour ce filtre.'}</Text>
            <Text style={styles.emptyText}>{issues.length === 0 ? 'Les vérifications du répertoire apparaîtront ici.' : 'Essaie un autre filtre ou une autre recherche.'}</Text>
          </View>
        ) : (
          <View style={styles.issueList}>
            <Text style={styles.listCaption}>{visibleIssues.length} alerte{visibleIssues.length > 1 ? 's' : ''} affichée{visibleIssues.length > 1 ? 's' : ''}</Text>
            {visibleIssues.map((issue) => {
              const saving = savingIssueId === issue.id;
              const issueNote = notes[issue.id] ?? '';
              return (
                <View key={issue.id} style={styles.issueCard}>
                  <View style={[styles.cardHeader, compact && styles.cardHeaderCompact]}>
                    <View style={styles.cardTitleBlock}>
                      <Text style={styles.issueLabel}>{issueLabels[issue.code] ?? issue.code.replaceAll('_', ' ')}</Text>
                      <Text style={styles.issueCode}>{issue.code}</Text>
                    </View>
                    <View style={[styles.statusPill, issue.status === 'open' ? styles.statusOpen : issue.status === 'resolved' ? styles.statusResolved : styles.statusDismissed]}>
                      <Text style={[styles.statusText, issue.status === 'open' ? styles.statusOpenText : styles.statusClosedText]}>{statusLabel(issue.status)}</Text>
                    </View>
                  </View>

                  <Text style={styles.issueMessage}>{issue.message}</Text>

                  <View style={[styles.sourcePanel, compact && styles.sourcePanelCompact]}>
                    <View style={styles.sourceHead}>
                      <Text style={styles.sourceNumber}>Réf. source {issue.entry.source_item_number}</Text>
                      <Text style={styles.sourcePage}>PDF p. {issue.entry.pdf_page}{issue.entry.printed_page ? ' · imprimée p. ' + issue.entry.printed_page : ''}</Text>
                    </View>
                    <Text style={styles.designation}>{issue.entry.designation}</Text>
                    <Text style={styles.sourceMeta}>
                      {[issue.entry.source_group_label, issue.entry.source_family_label, 'Unité source : ' + issue.entry.unit_raw, issue.entry.kind === 'service_candidate' ? 'Type : prestation possible' : 'Type : produit'].filter(Boolean).join(' · ')}
                    </Text>
                    <View style={[styles.priceRow, compact && styles.priceRowCompact]}>
                      <View style={styles.priceCell}><Text style={styles.priceCaption}>LI · MINIMUM</Text><Text style={styles.priceAmount}>{formatAmount(issue.entry.li)}</Text></View>
                      <View style={styles.priceCell}><Text style={styles.priceCaption}>PM · MOYEN</Text><Text style={styles.priceAmount}>{formatAmount(issue.entry.pm)}</Text></View>
                      <View style={styles.priceCell}><Text style={styles.priceCaption}>LS · MAXIMUM</Text><Text style={styles.priceAmount}>{formatAmount(issue.entry.ls)}</Text></View>
                      <View style={styles.currencyCell}><Text style={styles.currencyText}>{issue.entry.currency} · {issue.entry.tax_basis === 'unknown' ? 'taxe non précisée' : issue.entry.tax_basis}</Text></View>
                    </View>
                    <Text style={styles.reviewState}>État de validation de la ligne : {issue.entry.review_status}</Text>
                  </View>

                  {issue.status === 'open' ? (
                    <View style={styles.decisionPanel}>
                      <Text style={styles.decisionTitle}>Ta décision</Text>
                      <TextInput
                        value={issueNote}
                        onChangeText={(value) => setNotes((current) => ({ ...current, [issue.id]: value }))}
                        placeholder="Note obligatoire : vérification effectuée, motif du classement, etc."
                        placeholderTextColor="#849188"
                        multiline
                        maxLength={1000}
                        accessibilityLabel={'Note pour l’alerte ' + issue.code}
                        style={styles.noteInput}
                      />
                      {actionError?.issueId === issue.id && <Text style={styles.actionError}>{actionError.message}</Text>}
                      <View style={[styles.decisionActions, compact && styles.decisionActionsCompact]}>
                        <Pressable
                          onPress={() => void saveDecision(issue, 'resolved')}
                          disabled={saving || issueNote.trim().length < 5}
                          style={({ pressed }) => [styles.resolveButton, pressed && styles.pressed, (saving || issueNote.trim().length < 5) && styles.disabledButton]}>
                          <Text style={styles.resolveButtonText}>{saving ? 'Enregistrement…' : 'Résoudre · revue effectuée'}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => void saveDecision(issue, 'dismissed')}
                          disabled={saving || issueNote.trim().length < 5}
                          style={({ pressed }) => [styles.dismissButton, pressed && styles.pressed, (saving || issueNote.trim().length < 5) && styles.disabledButton]}>
                          <Text style={styles.dismissButtonText}>Écarter cette alerte</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.resolutionPanel}>
                      <View style={styles.resolutionCopy}>
                        <Text style={styles.resolutionTitle}>Note de décision</Text>
                        <Text style={styles.resolutionNote}>{issue.resolution_note}</Text>
                        <Text style={styles.resolutionDate}>Décision enregistrée le {formatDate(issue.resolved_at)}</Text>
                      </View>
                      <Pressable onPress={() => void saveDecision(issue, 'open')} disabled={saving} style={({ pressed }) => [styles.reopenButton, pressed && styles.pressed]}>
                        <Text style={styles.reopenButtonText}>{saving ? '…' : 'Rouvrir'}</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  accessScreen: { flex: 1, minHeight: 420, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 13 },
  accessMark: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#F8EDE5' },
  accessMarkText: { color: '#A94F30', fontSize: 24, fontWeight: '900' },
  accessTitle: { color: '#21382D', fontSize: 23, fontWeight: '800', textAlign: 'center' },
  accessText: { maxWidth: 430, color: '#77867D', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  primaryButton: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 10, backgroundColor: '#2B6049' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  backButton: { padding: 10 },
  backButtonText: { color: '#397252', fontSize: 12, fontWeight: '700' },
  scroll: { flex: 1 },
  page: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 34, paddingTop: 30, paddingBottom: 64, gap: 19 },
  pageCompact: { paddingHorizontal: 16, paddingTop: 20, gap: 15 },
  intro: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 },
  introCompact: { alignItems: 'flex-start', flexDirection: 'column' },
  introCopy: { flex: 1, gap: 7 },
  eyebrow: { color: '#9A6849', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#20372D', fontSize: 32, lineHeight: 38, fontWeight: '900', letterSpacing: -1 },
  titleCompact: { fontSize: 28, lineHeight: 34 },
  subtitle: { maxWidth: 740, color: '#718078', fontSize: 12, lineHeight: 19 },
  introActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  supplierButton: { minHeight: 40, paddingHorizontal: 13, justifyContent: 'center', borderRadius: 10, backgroundColor: '#EAF2EC' },
  supplierButtonText: { color: '#3D6D4B', fontSize: 10, fontWeight: '800' },
  refreshButton: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1, borderColor: '#DDE5DE', borderRadius: 10, backgroundColor: '#FFFFFF' },
  refreshButtonText: { color: '#345A44', fontSize: 11, fontWeight: '800' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  statsCompact: { gap: 8 },
  statCard: { flex: 1, minWidth: 150, paddingHorizontal: 17, paddingVertical: 14, borderWidth: 1, borderColor: '#E5EBE5', borderRadius: 14, backgroundColor: '#FFFFFF' },
  statValue: { color: '#234332', fontSize: 23, fontWeight: '900' },
  statLabel: { marginTop: 4, color: '#77867D', fontSize: 10, fontWeight: '700' },
  notice: { padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: '#DDE9DF', borderRadius: 12, backgroundColor: '#F1F6F0' },
  noticeMark: { width: 18, height: 18, borderRadius: 9, color: '#FFFFFF', fontSize: 12, fontWeight: '900', textAlign: 'center', lineHeight: 18, backgroundColor: '#52795E' },
  noticeText: { flex: 1, color: '#526B58', fontSize: 10, lineHeight: 16 },
  feedback: { padding: 12, borderRadius: 10, color: '#2B6049', fontSize: 11, fontWeight: '700', backgroundColor: '#EAF2EC' },
  controls: { gap: 12 },
  controlsCompact: { gap: 10 },
  searchInput: { minHeight: 44, paddingHorizontal: 13, borderWidth: 1, borderColor: '#DDE5DE', borderRadius: 10, color: '#20372D', fontSize: 11, backgroundColor: '#FFFFFF', outlineStyle: 'none' } as never,
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filterButton: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#E1E8E2', borderRadius: 99, backgroundColor: '#FFFFFF' },
  filterButtonSelected: { borderColor: '#2B6049', backgroundColor: '#EAF2EC' },
  filterText: { color: '#627168', fontSize: 10, fontWeight: '700' },
  filterTextSelected: { color: '#2B6049' },
  issueList: { gap: 12 },
  listCaption: { color: '#718078', fontSize: 10, fontWeight: '800' },
  issueCard: { padding: 17, gap: 13, borderWidth: 1, borderColor: '#E4EAE4', borderRadius: 16, backgroundColor: '#FFFFFF' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cardHeaderCompact: { alignItems: 'flex-start' },
  cardTitleBlock: { flex: 1, gap: 3 },
  issueLabel: { color: '#233B2F', fontSize: 14, fontWeight: '800' },
  issueCode: { color: '#8A978E', fontSize: 8, fontWeight: '700', letterSpacing: .4 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99 },
  statusOpen: { backgroundColor: '#FFF2E6' },
  statusResolved: { backgroundColor: '#EAF3EC' },
  statusDismissed: { backgroundColor: '#F0F1F1' },
  statusText: { fontSize: 9, fontWeight: '800' },
  statusOpenText: { color: '#9A572D' },
  statusClosedText: { color: '#456256' },
  issueMessage: { color: '#526159', fontSize: 11, lineHeight: 17 },
  sourcePanel: { padding: 14, gap: 8, borderRadius: 12, backgroundColor: '#F7F9F6' },
  sourcePanelCompact: { padding: 12 },
  sourceHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 },
  sourceNumber: { color: '#335B43', fontSize: 9, fontWeight: '800' },
  sourcePage: { color: '#79877E', fontSize: 9, fontWeight: '700' },
  designation: { color: '#24382D', fontSize: 13, fontWeight: '800' },
  sourceMeta: { color: '#77867D', fontSize: 9, lineHeight: 15 },
  priceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  priceRowCompact: { gap: 8 },
  priceCell: { minWidth: 92, paddingVertical: 7, paddingHorizontal: 9, borderRadius: 8, backgroundColor: '#FFFFFF' },
  priceCaption: { color: '#8A978E', fontSize: 7, fontWeight: '900', letterSpacing: .6 },
  priceAmount: { marginTop: 3, color: '#254533', fontSize: 12, fontWeight: '900' },
  currencyCell: { paddingHorizontal: 3, paddingVertical: 7 },
  currencyText: { color: '#65746B', fontSize: 9, fontWeight: '700' },
  reviewState: { color: '#8A7667', fontSize: 8 },
  decisionPanel: { paddingTop: 12, gap: 9, borderTopWidth: 1, borderTopColor: '#EDF0EC' },
  decisionTitle: { color: '#344B3B', fontSize: 11, fontWeight: '800' },
  noteInput: { minHeight: 72, padding: 11, borderWidth: 1, borderColor: '#DDE5DE', borderRadius: 9, color: '#263B2E', fontSize: 10, textAlignVertical: 'top', backgroundColor: '#FCFDFC', outlineStyle: 'none' } as never,
  actionError: { color: '#B91C1C', fontSize: 9, lineHeight: 14 },
  decisionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  decisionActionsCompact: { flexDirection: 'column' },
  resolveButton: { minHeight: 40, paddingHorizontal: 13, justifyContent: 'center', borderRadius: 9, backgroundColor: '#2B6049' },
  resolveButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  dismissButton: { minHeight: 40, paddingHorizontal: 13, justifyContent: 'center', borderWidth: 1, borderColor: '#DDE5DE', borderRadius: 9, backgroundColor: '#FFFFFF' },
  dismissButtonText: { color: '#596A60', fontSize: 10, fontWeight: '800' },
  disabledButton: { opacity: .45 },
  resolutionPanel: { paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderTopWidth: 1, borderTopColor: '#EDF0EC' },
  resolutionCopy: { flex: 1, gap: 4 },
  resolutionTitle: { color: '#526B58', fontSize: 9, fontWeight: '900', letterSpacing: .4 },
  resolutionNote: { color: '#4F5F55', fontSize: 10, lineHeight: 16 },
  resolutionDate: { color: '#8A978E', fontSize: 8 },
  reopenButton: { paddingHorizontal: 11, paddingVertical: 8, borderWidth: 1, borderColor: '#DDE5DE', borderRadius: 8 },
  reopenButtonText: { color: '#456256', fontSize: 9, fontWeight: '800' },
  loadingPanel: { minHeight: 130, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#77867D', fontSize: 11 },
  emptyPanel: { minHeight: 150, alignItems: 'center', justifyContent: 'center', padding: 23, borderWidth: 1, borderColor: '#E5EBE5', borderRadius: 14, backgroundColor: '#FFFFFF' },
  emptyTitle: { color: '#233B2F', fontSize: 14, fontWeight: '800' },
  emptyText: { marginTop: 5, color: '#77867D', fontSize: 10, textAlign: 'center' },
  errorPanel: { padding: 13, borderRadius: 10, backgroundColor: '#FFF4F0' },
  errorText: { color: '#A23D26', fontSize: 10, lineHeight: 16 },
  pressed: { opacity: .76 },
});
