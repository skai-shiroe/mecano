import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { InsurerShell } from '@/components/InsurerShell';
import { InsurerQuoteEditor } from '@/components/InsurerQuoteEditor';
import { useAuth } from '@/hooks/useAuth';
import { addInsurerOfferAlternative, assignInsurerDossier, archiveInsurerDossier, compareInsurerDossier, createInsurerEstimate, getInsurerDossierDetail, recordInsurerDecision, recordInsurerOfferDecision, type ComparisonLineResult, type InsurerDossierDetail, type InsurerOfferAlternative } from '@/lib/insurer-dossiers';
import { getInsurerOrganizations, type InsurerOrganization } from '@/lib/insurer-dashboard';
import { getInsurerOrganizationMembers, type InsurerOrganizationMember } from '@/lib/insurer-organization-settings';
import { getPublishedSupplierOffersForProducts, type SupplierOfferView } from '@/lib/suppliers';

function date(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function money(value: number, currency = 'XOF') {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value) + ' ' + currency;
}

function conditionLabel(condition: string | null | undefined) {
  if (condition === 'new') return 'Neuf';
  if (condition === 'reconditioned') return 'Reconditionné';
  if (condition === 'used') return 'Occasion';
  return 'Tous les états';
}

function qualityLabel(quality: string | null | undefined) {
  if (quality === 'original') return 'Origine constructeur';
  if (quality === 'equivalent') return 'Équivalent';
  if (quality === 'reconditioned') return 'Reconditionné';
  if (quality === 'used') return 'Occasion';
  return 'Toutes les qualités';
}

function statusLabel(status: string, archived: boolean) {
  if (archived) return 'Archivé';
  if (status === 'draft') return 'Brouillon';
  if (status === 'compared') return 'Comparé';
  if (status === 'decision_recorded') return 'Décision prise';
  return 'À examiner';
}

function lineStatus(status: ComparisonLineResult['status']) {
  if (status === 'above') return 'Au-dessus de la borne haute';
  if (status === 'below') return 'En dessous de la fourchette';
  if (status === 'within') return 'Dans la fourchette';
  if (status === 'unit_mismatch') return 'Unité différente';
  if (status === 'currency_mismatch') return 'Devise différente';
  if (status === 'tax_basis_unknown') return 'Base fiscale à préciser';
  if (status === 'tax_basis_mismatch') return 'Base fiscale différente';
  if (status === 'reference_range_invalid') return 'Fourchette source incohérente';
  return 'Référence indisponible';
}

function canSearchPartnerOffers(line: ComparisonLineResult) {
  return Boolean(line.selected_product_id)
    && line.status !== 'unit_mismatch'
    && line.tax_basis !== 'unknown';
}

function SavedAlternativeCard({ alternative, selected, canDecide, busy, onSelect }: {
  alternative: InsurerOfferAlternative;
  selected: boolean;
  canDecide: boolean;
  busy: boolean;
  onSelect: () => void;
}) {
  const deliveredTotal = alternative.unit_price * alternative.quantity + alternative.delivery_fee;
  const expired = Boolean(alternative.valid_until && alternative.valid_until < new Date().toISOString().slice(0, 10));
  const deliveryTime = alternative.delivery_days_min === null && alternative.delivery_days_max === null
    ? 'Délai à confirmer'
    : alternative.delivery_days_min === alternative.delivery_days_max
      ? String(alternative.delivery_days_min) + ' jour' + (alternative.delivery_days_min === 1 ? '' : 's')
      : String(alternative.delivery_days_min ?? '?') + '–' + String(alternative.delivery_days_max ?? '?') + ' jours';
  return <View style={[styles.savedOfferCard, selected && styles.selectedOfferCard]}>
    <View style={styles.offerCardHeader}><View style={styles.flex}><Text style={styles.offerSupplier}>{alternative.supplier_name}</Text><Text style={styles.offerMeta}>Alternative conservée · ajoutée le {date(alternative.created_at)}</Text></View><Text style={selected ? styles.selectedDecisionBadge : styles.savedBadge}>{selected ? 'SOLUTION RETENUE' : 'AU DOSSIER'}</Text></View>
    <Text style={styles.savedProduct}>{alternative.product_name}</Text>
    <Text style={styles.offerMeta}>{conditionLabel(alternative.condition)} · {qualityLabel(alternative.quality)}</Text>
    <View style={styles.offerTotalRow}><Text style={styles.offerTotalLabel}>Total livré pour {alternative.quantity}</Text><Text style={styles.offerTotal}>{money(deliveredTotal, alternative.currency)}</Text></View>
    <Text style={styles.offerMeta}>{alternative.delivery_zone} · {deliveryTime} · vérifié le {date(alternative.offer_verified_at)}{alternative.valid_until ? ' · valable jusqu’au ' + date(alternative.valid_until) : ''}</Text>
    {selected && <Text style={styles.offerMeta}>Commande et paiement à organiser directement avec le fournisseur.</Text>}
    {!selected && canDecide && <Pressable disabled={busy || expired} onPress={onSelect} style={[styles.offerAction, (busy || expired) && styles.disabledButton]}><Text style={styles.offerActionText}>{expired ? 'Offre expirée · à vérifier' : busy ? 'Enregistrement…' : 'Retenir cette offre comme solution'}</Text></Pressable>}
  </View>;
}

export default function InsurerDossierDetailPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const dossierId = Array.isArray(params.id) ? params.id[0] : params.id;
  const compact = useWindowDimensions().width < 760;
  const { session } = useAuth();
  const [detail, setDetail] = useState<InsurerDossierDetail | null>(null);
  const [organization, setOrganization] = useState<InsurerOrganization | null>(null);
  const [members, setMembers] = useState<InsurerOrganizationMember[]>([]);
  const [note, setNote] = useState('');
  const [supplier, setSupplier] = useState('');
  const [showAddQuoteForm, setShowAddQuoteForm] = useState(false);
  const [expandedEstimateId, setExpandedEstimateId] = useState<string | null>(null);
  const [expandedComparisonIds, setExpandedComparisonIds] = useState<string[]>([]);
  const [showTeamControls, setShowTeamControls] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [offerData, setOfferData] = useState<{ key: string; offers: Record<string, SupplierOfferView[]>; error?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [addingOfferId, setAddingOfferId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!dossierId) return;
    const dossier = await getInsurerDossierDetail(dossierId);
    setDetail(dossier);
    setNote(dossier.decision_note ?? '');
  }, [dossierId]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!dossierId || !session?.user.id) { setLoading(false); return; }
      try {
        const dossier = await getInsurerDossierDetail(dossierId);
        if (!active) return;
        setDetail(dossier);
        setNote(dossier.decision_note ?? '');
        if (dossier.organization_id) {
          const organizations = await getInsurerOrganizations(session.user.id);
          const org = organizations.find((item) => item.id === dossier.organization_id) ?? null;
          if (active) setOrganization(org);
          if (org?.membershipRole === 'manager') {
            const team = await getInsurerOrganizationMembers(org.id);
            if (active) setMembers(team.filter((member) => member.is_active));
          }
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Ce dossier n’est pas accessible.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [dossierId, session?.user.id]);

  const latestComparison = detail?.latestComparison ?? null;
  const comparisonKey = detail?.latestComparisonAt ?? '';
  useEffect(() => {
    const searchableLines = (latestComparison?.lines ?? []).filter(canSearchPartnerOffers);
    const ids = [...new Set(searchableLines.map((line) => line.selected_product_id as string))];
    if (detail?.workflow_status !== 'compared' || !ids.length) return;
    const today = new Date().toISOString().slice(0, 10);
    let active = true;
    void getPublishedSupplierOffersForProducts(ids).then((candidates) => {
      if (!active) return;
      const next: Record<string, SupplierOfferView[]> = {};
      for (const id of ids) {
        const matchingLines = searchableLines.filter((line) => line.selected_product_id === id);
        next[id] = candidates.filter((offer) =>
          offer.product_id === id
          && offer.availability === 'available'
          && (offer.stock_quantity === null || matchingLines.some((line) => offer.stock_quantity! >= line.quantity))
          && (offer.valid_until === null || offer.valid_until >= today)
          && offer.currency === offer.delivery_currency
          && matchingLines.some((line) =>
            (!line.condition || offer.condition === line.condition)
            && (!line.quality || offer.quality === line.quality)
            && offer.currency === line.currency
            && offer.tax_basis === line.tax_basis
            && offer.tax_basis !== 'unknown'
            && offer.unit_price * line.quantity + offer.delivery_fee < line.line_total
          )
        );
      }
      setOfferData({ key: comparisonKey, offers: next });
    }).catch((loadError) => { if (active) setOfferData({ key: comparisonKey, offers: {}, error: loadError instanceof Error ? loadError.message : 'Impossible de charger les offres partenaires.' }); });
    return () => { active = false; };
  }, [comparisonKey, detail?.workflow_status, latestComparison]);

  const isManager = organization?.membershipRole === 'manager';
  const results = detail?.latestComparison?.lines ?? [];
  const estimatesById = useMemo(() => new Map((detail?.estimates ?? []).map((item) => [item.id, item])), [detail?.estimates]);
  const selectedAlternative = detail
    ? detail.offerAlternatives.find((alternative) => alternative.id === detail.decision_offer_alternative_id) ?? null
    : null;
  const selectedAlternativeTotal = selectedAlternative
    ? selectedAlternative.unit_price * selectedAlternative.quantity + selectedAlternative.delivery_fee
    : 0;

  async function run(action: () => Promise<void>, success?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      await reload();
      if (success) setNotice(success);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'L’opération a échoué.');
    } finally {
      setBusy(false);
    }
  }

  async function addQuote() {
    if (!detail || supplier.trim().length < 2) { setError('Indique le nom du concessionnaire.'); return; }
    setBusy(true);
    setError(null);
    try {
      const estimateId = await createInsurerEstimate(detail.id, supplier);
      setSupplier('');
      setShowAddQuoteForm(false);
      setExpandedEstimateId(estimateId);
      await reload();
      setNotice('Devis ajouté. Complète ses pièces et ses prix.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Le devis n’a pas pu être ajouté.');
    } finally { setBusy(false); }
  }

  async function addOfferToDossier(line: ComparisonLineResult, offer: SupplierOfferView) {
    setAddingOfferId(offer.id);
    setError(null);
    setNotice(null);
    try {
      await addInsurerOfferAlternative(line.line_id, offer.id);
      await reload();
      setNotice('Offre partenaire ajoutée au dossier comme alternative. Aucune commande ni paiement n’a été lancé.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'L’offre n’a pas pu être ajoutée au dossier.');
    } finally {
      setAddingOfferId(null);
    }
  }

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.textContent = '@media print { body * { visibility:hidden!important } #insurance-dossier-report, #insurance-dossier-report * { visibility:visible!important } #insurance-dossier-report { position:absolute!important; inset:0 auto auto 0!important; width:100%!important; padding:24px!important; background:white!important } #insurance-print-actions { display:none!important } }';
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  if (loading) return <InsurerShell><View style={styles.center}><ActivityIndicator color="#397FBD" /><Text style={styles.muted}>Ouverture du dossier…</Text></View></InsurerShell>;
  if (!detail) return <InsurerShell><View style={styles.page}><Text style={styles.error}>{error ?? 'Dossier introuvable ou inaccessible.'}</Text><Pressable onPress={() => router.replace('/assureur/dossiers')}><Text style={styles.link}>← Retour aux dossiers</Text></Pressable></View></InsurerShell>;

  return (
    <InsurerShell>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, compact && styles.pageCompact]}>
        <View nativeID="insurance-dossier-report">
          <View style={styles.hero}>
            <Pressable onPress={() => router.replace('/assureur/dossiers')}><Text style={styles.back}>← Tous les dossiers</Text></Pressable>
            <Text style={styles.eyebrow}>{organization?.name ?? 'ESPACE ASSUREUR'} · DOSSIER DE SINISTRE</Text>
            <Text style={styles.title}>{detail.title}</Text>
            <Text style={styles.heroText}>Créé le {date(detail.created_at)} · {detail.estimates.length} devis · {statusLabel(detail.workflow_status, Boolean(detail.archived_at))}</Text>
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          {notice && <Text style={styles.notice}>{notice}</Text>}

          {detail.decision_estimate_id ? (
            <View style={styles.decision}>
              <Text style={styles.decisionTitle}>✓ Devis retenu : {estimatesById.get(detail.decision_estimate_id)?.supplier_name ?? 'devis retenu'}</Text>
              {detail.decision_note && <Text style={styles.muted}>{detail.decision_note}</Text>}
            </View>
          ) : null}
          {selectedAlternative ? (
            <View style={styles.decision}>
              <Text style={styles.decisionTitle}>✓ Solution retenue : {selectedAlternative.supplier_name}</Text>
              <Text style={styles.muted}>{selectedAlternative.product_name} · total livré {money(selectedAlternativeTotal, selectedAlternative.currency)}</Text>
              {detail.decision_note && <Text style={styles.muted}>{detail.decision_note}</Text>}
              <Text style={styles.muted}>La commande et le paiement restent à organiser avec le fournisseur.</Text>
            </View>
          ) : null}
          {selectedAlternative && <View style={styles.decision}><Text style={styles.decisionTitle}>✓ Solution retenue : {selectedAlternative.supplier_name}</Text><Text style={styles.muted}>{selectedAlternative.product_name} · total livré {money(selectedAlternative.unit_price * selectedAlternative.quantity + selectedAlternative.delivery_fee, selectedAlternative.currency)}</Text>{detail.decision_note && <Text style={styles.muted}>{detail.decision_note}</Text>}<Text style={styles.muted}>La commande et le paiement restent à organiser avec le fournisseur.</Text></View>}

          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <View style={styles.flex}><Text style={styles.heading}>Devis des concessionnaires</Text><Text style={styles.muted}>{detail.estimates.length} devis · ouvre chaque fiche pour consulter ou renseigner ses lignes.</Text></View>
              {!detail.archived_at && <Pressable disabled={busy} onPress={() => setShowAddQuoteForm((current) => !current)} style={styles.addQuoteTrigger}><Text style={styles.addQuoteTriggerText}>{showAddQuoteForm ? 'Annuler' : '+ Ajouter un devis'}</Text></Pressable>}
            </View>
            {showAddQuoteForm && !detail.archived_at && <View style={[styles.addQuoteForm, compact && styles.column]}>
              <TextInput value={supplier} onChangeText={setSupplier} placeholder="Nom du concessionnaire" style={styles.addQuoteInput} />
              <Pressable disabled={busy} onPress={() => { void addQuote(); }} style={[styles.button, busy && styles.disabledButton]}><Text style={styles.buttonText}>{busy ? 'Ajout…' : 'Créer le devis'}</Text></Pressable>
            </View>}
            {!detail.estimates.length && <Text style={styles.emptyHint}>Aucun devis pour ce dossier. Ajoute un concessionnaire pour commencer.</Text>}
            {detail.estimates.map((estimate, index) => <InsurerQuoteEditor key={estimate.id + ':' + estimate.updated_at} estimate={estimate} index={index} disabled={Boolean(detail.archived_at)} expanded={expandedEstimateId === estimate.id} onToggle={() => setExpandedEstimateId((current) => current === estimate.id ? null : estimate.id)} onSaved={async () => { await reload(); setNotice('Devis enregistré.'); }} />)}
          </View>

          <View style={styles.panel}>
            <View style={[styles.row, compact && styles.column]}><View style={styles.flex}><Text style={styles.heading}>Comparaison côte à côte</Text><Text style={styles.muted}>La comparaison exige une référence, une unité et une base fiscale compatibles.</Text></View><Pressable disabled={busy || !detail.estimates.length || Boolean(detail.archived_at) || detail.workflow_status === 'decision_recorded'} onPress={() => { void run(() => compareInsurerDossier(detail.id).then(() => undefined), 'Comparaison enregistrée avec ses références.'); }} style={[styles.button, detail.workflow_status === 'decision_recorded' && styles.disabledButton]}><Text style={styles.buttonText}>{busy ? 'Patiente…' : detail.workflow_status === 'decision_recorded' ? 'Décision enregistrée' : 'Comparer les devis'}</Text></Pressable></View>
            {!results.length ? <Text style={styles.muted}>Enregistre les lignes des devis, puis lance la comparaison.</Text> : <View style={styles.grid}>
              {detail.estimates.map((estimate, index) => {
                const quoteLines = results.filter((line) => line.quote_id === estimate.id);
                const comparable = quoteLines.filter((line) => line.reference && (line.status === 'above' || line.status === 'below' || line.status === 'within'));
                const aboveCount = comparable.filter((line) => line.status === 'above').length;
                const belowCount = comparable.filter((line) => line.status === 'below').length;
                const withinCount = comparable.filter((line) => line.status === 'within').length;
                const unmatchedCount = quoteLines.length - comparable.length;
                const summary = [
                  aboveCount ? `${aboveCount} au-dessus` : '',
                  belowCount ? `${belowCount} sous la borne` : '',
                  withinCount ? `${withinCount} dans la fourchette` : '',
                  unmatchedCount ? `${unmatchedCount} non comparable${unmatchedCount === 1 ? '' : 's'}` : '',
                ].filter(Boolean).join(' · ') || 'Aucune ligne enregistrée dans ce devis';
                const isExpanded = expandedComparisonIds.includes(estimate.id);
                const quoteTotal = comparable.reduce((sum, line) => sum + line.line_total, 0);
                const refMin = comparable.reduce((sum, line) => sum + line.reference!.li * line.quantity, 0);
                const refMax = comparable.reduce((sum, line) => sum + line.reference!.ls * line.quantity, 0);
                return <View key={estimate.id} style={styles.compareCard}>
                  <View style={styles.compareHeader}>
                    <View style={styles.flex}><Text style={styles.quoteTitle}>{String(index + 1).padStart(2, '0')} · {estimate.supplier_name}</Text><Text style={styles.compareSummary}>{summary}</Text></View>
                    {quoteLines.length > 0 && <Pressable onPress={() => setExpandedComparisonIds((current) => current.includes(estimate.id) ? current.filter((id) => id !== estimate.id) : [...current, estimate.id])} style={styles.detailsToggle}><Text style={styles.detailsToggleText}>{isExpanded ? 'Masquer' : 'Détails et décision'} {isExpanded ? '−' : '+'}</Text></Pressable>}
                  </View>
                  {comparable.length > 0 && <View style={styles.totals}><Text style={styles.totalsTitle}>Total des lignes comparables</Text><Text style={styles.totalsText}>Devis {money(quoteTotal)} · référence {money(refMin)} – {money(refMax)}</Text></View>}
                  {isExpanded && <View style={styles.comparisonDetails}>
                    {quoteLines.map((line) => {
                      const savedAlternatives = detail.offerAlternatives.filter((alternative) => alternative.quote_line_id === line.line_id);
                      const partnerOffersLoaded = offerData?.key === comparisonKey;
                      const cheaperOffers = canSearchPartnerOffers(line) && line.selected_product_id && partnerOffersLoaded
                        ? (offerData.offers[line.selected_product_id] ?? []).filter((offer) =>
                          (!line.condition || offer.condition === line.condition)
                          && (!line.quality || offer.quality === line.quality)
                          && offer.currency === line.currency
                          && offer.tax_basis === line.tax_basis
                          && (offer.stock_quantity === null || offer.stock_quantity >= line.quantity)
                          && offer.unit_price * line.quantity + offer.delivery_fee < line.line_total
                        ).sort((a, b) => (a.unit_price * line.quantity + a.delivery_fee) - (b.unit_price * line.quantity + b.delivery_fee)).slice(0, 2)
                        : [];
                      const candidateOffers = cheaperOffers.filter((offer) => !savedAlternatives.some((saved) => saved.supplier_offer_id === offer.id));
                      return <View key={line.line_id} style={styles.result}>
                        <Text style={styles.resultTitle}>{line.designation}</Text><Text style={styles.resultPrice}>{money(line.unit_price, line.currency)} · {lineStatus(line.status)}</Text>
                        <Text style={styles.muted}>État recherché : {conditionLabel(line.condition)} · qualité : {qualityLabel(line.quality)}</Text>
                        <Text style={styles.muted}>{line.reference ? 'Référence ' + money(line.reference.li) + ' – ' + money(line.reference.ls) + ' · ' + line.reference.source_edition : line.status === 'tax_basis_mismatch' || line.status === 'tax_basis_unknown' ? 'Base fiscale incompatible ou non précisée.' : 'Référence comparable indisponible.'}</Text>
                        {savedAlternatives.map((alternative) => <SavedAlternativeCard
                          key={alternative.id}
                          alternative={alternative}
                          selected={detail.decision_offer_alternative_id === alternative.id}
                          canDecide={detail.workflow_status === 'compared' && !detail.archived_at}
                          busy={busy}
                          onSelect={() => { void run(() => recordInsurerOfferDecision(detail.id, alternative.id, note), 'Offre de ' + alternative.supplier_name + ' retenue. La commande et le paiement restent à organiser avec le fournisseur.'); }}
                        />)}
                        {canSearchPartnerOffers(line) && detail.workflow_status === 'compared' && <View style={styles.offerSection}>
                          <Text style={styles.offerSectionTitle}>OFFRES PARTENAIRES · PRIX LIVRÉ</Text>
                          <Text style={styles.offerSectionHint}>Offres du même produit, frais de livraison compris. Les critères choisis sur la ligne filtrent les résultats ; sans critère, les autres états et qualités restent visibles et sont indiqués. La référence officielle Check reste affichée séparément.</Text>
                          {!partnerOffersLoaded && <Text style={styles.offerEmpty}>Recherche des offres partenaires…</Text>}
                          {partnerOffersLoaded && offerData?.error && <Text style={styles.offerEmpty}>{offerData.error}</Text>}
                          {partnerOffersLoaded && !offerData?.error && cheaperOffers.length === 0 && savedAlternatives.length === 0 && <Text style={styles.offerEmpty}>Aucune offre partenaire compatible et moins chère trouvée pour cette quantité.</Text>}
                          {candidateOffers.map((offer) => {
                            const deliveredTotal = offer.unit_price * line.quantity + offer.delivery_fee;
                            const savings = line.line_total - deliveredTotal;
                            const deliveryTime = offer.delivery_days_min === null && offer.delivery_days_max === null
                              ? 'Délai à confirmer'
                              : offer.delivery_days_min === offer.delivery_days_max
                                ? `${offer.delivery_days_min} jour${offer.delivery_days_min === 1 ? '' : 's'}`
                                : `${offer.delivery_days_min ?? '?'}–${offer.delivery_days_max ?? '?'} jours`;
                            return <View key={offer.id} style={styles.offerCard}>
                              <View style={styles.offerCardHeader}><View style={styles.flex}><Text style={styles.offerSupplier}>{offer.supplierName}</Text><Text style={styles.offerMeta}>{conditionLabel(offer.condition)} · {qualityLabel(offer.quality)} · vérifié le {date(offer.verified_at)}</Text></View><Text style={styles.offerSaving}>−{money(savings, line.currency)}</Text></View>
                              <View style={styles.offerPriceGrid}><Text style={styles.offerPriceLine}>Pièce × {line.quantity} <Text style={styles.offerPriceValue}>{money(offer.unit_price * line.quantity, line.currency)}</Text></Text><Text style={styles.offerPriceLine}>Livraison <Text style={styles.offerPriceValue}>{money(offer.delivery_fee, offer.delivery_currency)}</Text></Text></View>
                              <View style={styles.offerTotalRow}><Text style={styles.offerTotalLabel}>Total livré</Text><Text style={styles.offerTotal}>{money(deliveredTotal, offer.currency)}</Text></View>
                              <Text style={styles.offerMeta}>{offer.delivery_zone} · {deliveryTime}{offer.valid_until ? ` · valable jusqu’au ${date(offer.valid_until)}` : ''}</Text>
                              <Pressable disabled={Boolean(addingOfferId) || Boolean(detail.archived_at)} onPress={() => { void addOfferToDossier(line, offer); }} style={[styles.offerAction, addingOfferId === offer.id && styles.disabledButton]}><Text style={styles.offerActionText}>{addingOfferId === offer.id ? 'Ajout au dossier…' : 'Conserver cette offre comme alternative'}</Text></Pressable>
                            </View>;
                          })}
                        </View>}
                      </View>;
                    })}
                    {detail.workflow_status === 'compared' && <View style={styles.decisionControls}><TextInput value={note} onChangeText={setNote} placeholder="Note de décision (facultative)" style={styles.input} /><Pressable disabled={busy} onPress={() => { void run(() => recordInsurerDecision(detail.id, estimate.id, note), 'Décision enregistrée.'); }} style={styles.outline}><Text style={styles.link}>{detail.decision_estimate_id === estimate.id ? 'Mettre à jour la décision' : 'Retenir ce devis'}</Text></Pressable></View>}
                  </View>}
                </View>;
              })}
            </View>}
            {detail.latestComparisonAt && <Text style={styles.muted}>Comparaison enregistrée le {date(detail.latestComparisonAt)}. Le résultat historique est conservé.</Text>}
            {detail.latestComparisonAt && detail.workflow_status === 'to_review' && <Text style={styles.stale}>Les devis ont changé depuis cette comparaison. Relance-la avant d’enregistrer une décision.</Text>}
          </View>

          {isManager && !detail.archived_at && <View style={styles.panel}>
            <Pressable onPress={() => setShowTeamControls((current) => !current)} style={styles.disclosureHeader} accessibilityRole="button" accessibilityState={{ expanded: showTeamControls }}>
              <View style={styles.flex}><Text style={styles.heading}>Attribution à l’équipe</Text><Text style={styles.muted}>{detail.assigned_user_id ? 'Dossier attribué à un membre' : 'Dossier non attribué'}</Text></View><Text style={styles.detailsToggleText}>{showTeamControls ? 'Masquer −' : 'Gérer +'}</Text>
            </Pressable>
            {showTeamControls && <View><Text style={styles.muted}>Le responsable voit tous les dossiers ; un membre voit les siens et ceux qui lui sont confiés.</Text><View style={styles.rowWrap}><Pressable onPress={() => { void run(() => assignInsurerDossier(detail.id, null), 'Attribution retirée.'); }} style={styles.chip}><Text>Sans attribution</Text></Pressable>{members.map((member) => <Pressable key={member.user_id} onPress={() => { void run(() => assignInsurerDossier(detail.id, member.user_id), 'Dossier attribué.'); }} style={[styles.chip, detail.assigned_user_id === member.user_id && styles.chipActive]}><Text>{member.display_name || member.email}</Text></Pressable>)}</View></View>}
          </View>}

          <View style={styles.panel}>
            <Pressable onPress={() => setShowHistory((current) => !current)} style={styles.disclosureHeader} accessibilityRole="button" accessibilityState={{ expanded: showHistory }}>
              <View style={styles.flex}><Text style={styles.heading}>Historique et archivage</Text><Text style={styles.muted}>{detail.events.length} action{detail.events.length === 1 ? '' : 's'} enregistrée{detail.events.length === 1 ? '' : 's'}</Text></View><Text style={styles.detailsToggleText}>{showHistory ? 'Masquer −' : 'Afficher +'}</Text>
            </Pressable>
            {showHistory && <View>
              <View nativeID="insurance-print-actions" style={styles.historyActions}>{Platform.OS === 'web' && <Pressable onPress={() => window.print()} style={styles.outline}><Text style={styles.link}>Imprimer / PDF</Text></Pressable>}{!detail.archived_at && <Pressable onPress={() => { void run(() => archiveInsurerDossier(detail.id), 'Dossier archivé.'); }} style={styles.outline}><Text style={styles.link}>Archiver le dossier</Text></Pressable>}</View>
              {detail.events.map((event) => <View key={event.id} style={styles.event}><Text style={styles.eventText}>{event.summary}</Text><Text style={styles.muted}>{date(event.created_at)} · {event.actor_user_id === session?.user.id ? 'Vous' : 'Équipe'}</Text></View>)}
            </View>}
          </View>
        </View>
      </ScrollView>
    </InsurerShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 }, page: { width: '100%', maxWidth: 1200, alignSelf: 'center', padding: 24, paddingBottom: 55 }, pageCompact: { padding: 13 },
  center: { flex: 1, minHeight: 350, alignItems: 'center', justifyContent: 'center', gap: 8 }, flex: { flex: 1, minWidth: 0 },
  hero: { padding: 23, borderRadius: 17, backgroundColor: '#12385F' }, back: { color: '#C9DDF0', marginBottom: 17, fontSize: 10, fontWeight: '700' },
  eyebrow: { color: '#80BBEA', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, title: { marginTop: 7, color: '#FFFFFF', fontSize: 26, lineHeight: 32, fontWeight: '800' }, heroText: { marginTop: 8, color: '#D4E3EF', fontSize: 10 },
  panel: { marginTop: 14, padding: 17, borderRadius: 14, borderWidth: 1, borderColor: '#E1E9F0', backgroundColor: '#FFFFFF' }, heading: { color: '#193A59', fontSize: 14, fontWeight: '800' }, muted: { marginTop: 5, color: '#7E8E9B', fontSize: 9, lineHeight: 15 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 9 }, rowWrap: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, column: { alignItems: 'stretch', flexDirection: 'column' },
  input: { minWidth: 150, minHeight: 37, paddingHorizontal: 10, borderWidth: 1, borderColor: '#DCE5EC', borderRadius: 8, backgroundColor: '#FFFFFF', color: '#23425F', fontSize: 9 }, button: { minHeight: 37, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#397FBD' }, buttonText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  stale: { marginTop: 8, padding: 9, borderRadius: 8, color: '#8B6425', backgroundColor: '#FFF5DD', fontSize: 9 }, disabledButton: { opacity: 0.55 }, error: { marginTop: 10, color: '#A14E47', fontSize: 10 }, notice: { marginTop: 10, padding: 10, borderRadius: 8, color: '#347456', backgroundColor: '#EAF5EF', fontSize: 10 }, decision: { marginTop: 12, padding: 12, borderRadius: 9, backgroundColor: '#EAF5EF' }, decisionTitle: { color: '#28654B', fontSize: 10, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, addQuoteTrigger: { minHeight: 38, paddingHorizontal: 13, justifyContent: 'center', borderWidth: 1, borderColor: '#397FBD', borderRadius: 9, backgroundColor: '#F3F8FC' }, addQuoteTriggerText: { color: '#286DAB', fontSize: 10, fontWeight: '800' }, addQuoteForm: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, addQuoteInput: { flex: 1, minWidth: 170, minHeight: 39, paddingHorizontal: 11, borderWidth: 1, borderColor: '#DCE5EC', borderRadius: 9, color: '#23425F', backgroundColor: '#FFF', fontSize: 10 }, emptyHint: { marginTop: 8, color: '#7E8E9B', fontSize: 9 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 9, marginTop: 12 }, compareCard: { flexGrow: 1, flexBasis: 280, padding: 13, borderWidth: 1, borderColor: '#DFE8F0', borderRadius: 11, backgroundColor: '#FAFCFE' }, compareHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, quoteTitle: { color: '#193A59', fontSize: 11, fontWeight: '800' }, compareSummary: { marginTop: 5, color: '#586F83', fontSize: 9, lineHeight: 14 }, detailsToggle: { minHeight: 32, paddingHorizontal: 9, justifyContent: 'center', borderRadius: 8, backgroundColor: '#EAF4FE' }, detailsToggleText: { color: '#286DAB', fontSize: 9, fontWeight: '800' }, comparisonDetails: { marginTop: 8, paddingTop: 3, borderTopWidth: 1, borderTopColor: '#E7EDF2' }, result: { marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E7EDF2' }, resultTitle: { color: '#23425F', fontSize: 10, fontWeight: '800' }, resultPrice: { marginTop: 4, color: '#3479B6', fontSize: 10, fontWeight: '800' },
  offerSection: { marginTop: 9, padding: 10, borderRadius: 10, backgroundColor: '#F1F8F4', borderWidth: 1, borderColor: '#D9EBDD' }, offerSectionTitle: { color: '#347456', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 }, offerSectionHint: { marginTop: 4, color: '#698374', fontSize: 8, lineHeight: 13 }, offerEmpty: { marginTop: 8, color: '#718477', fontSize: 8, lineHeight: 13 }, offerCard: { marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE9DF' }, savedOfferCard: { marginTop: 9, padding: 10, borderRadius: 8, backgroundColor: '#F2F8F4', borderWidth: 1, borderColor: '#CEE2D4' }, offerCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }, offerSupplier: { color: '#23425F', fontSize: 10, fontWeight: '800' }, offerMeta: { marginTop: 4, color: '#718477', fontSize: 8, lineHeight: 13 }, offerSaving: { color: '#347456', fontSize: 9, fontWeight: '900' }, offerPriceGrid: { marginTop: 9, gap: 4 }, offerPriceLine: { color: '#718477', fontSize: 8 }, offerPriceValue: { color: '#365D48', fontWeight: '700' }, offerTotalRow: { marginTop: 8, paddingTop: 7, borderTopWidth: 1, borderTopColor: '#E4EEE7', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, offerTotalLabel: { color: '#315F45', fontSize: 9, fontWeight: '800' }, offerTotal: { color: '#286A47', fontSize: 12, fontWeight: '900' }, offerAction: { marginTop: 9, minHeight: 34, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: '#397F5A' }, offerActionText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' }, savedBadge: { color: '#347456', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 }, savedProduct: { marginTop: 5, color: '#4B6955', fontSize: 8, fontWeight: '700' }, selectedOfferCard: { borderColor: '#347456', backgroundColor: '#EAF5EF' }, selectedDecisionBadge: { color: '#286A47', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  totals: { marginTop: 9, padding: 9, borderRadius: 8, backgroundColor: '#EAF4FE' }, totalsTitle: { color: '#2F6FAD', fontSize: 8, fontWeight: '900' }, totalsText: { marginTop: 4, color: '#335D7D', fontSize: 8, fontWeight: '700' }, totalsNote: { marginTop: 4, color: '#71889B', fontSize: 7 },
  decisionControls: { marginTop: 9, gap: 7 }, disclosureHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, historyActions: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, outline: { minHeight: 33, paddingHorizontal: 9, justifyContent: 'center', borderWidth: 1, borderColor: '#397FBD', borderRadius: 8 }, link: { color: '#3479B6', fontSize: 9, fontWeight: '800' }, chip: { minHeight: 31, paddingHorizontal: 9, justifyContent: 'center', borderWidth: 1, borderColor: '#DCE5EC', borderRadius: 30 }, chipActive: { borderColor: '#397FBD', backgroundColor: '#EAF4FE' },
  event: { marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#EDF0F3' }, eventText: { color: '#294967', fontSize: 9, fontWeight: '700' },
});
