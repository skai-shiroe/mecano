import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { AppShell } from '@/components/AppShell';
import { searchPublishedPrices } from '@/lib/catalog';
import { getPublishedSupplierOffers, type SupplierOfferView } from '@/lib/suppliers';

type SearchResult = Awaited<ReturnType<typeof searchPublishedPrices>>[number];
type QuoteBasis = 'HT' | 'TTC' | 'unknown' | null;

function productOf(item: SearchResult) {
  return Array.isArray(item.products) ? item.products[0] ?? null : item.products;
}

function unitOf(item: SearchResult) {
  const unitLabel = Array.isArray(item.units) ? item.units[0]?.label : item.units?.label;
  return unitLabel ?? productOf(item)?.unit_code ?? 'unité';
}

function sourceOf(item: SearchResult) {
  return Array.isArray(item.reference_sources) ? item.reference_sources[0] ?? null : item.reference_sources;
}

function parseAmount(value: string) {
  const amount = Number(value.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
}

function conditionLabel(condition: string) {
  if (condition === 'new') return 'Neuf';
  if (condition === 'reconditioned') return 'Reconditionné';
  if (condition === 'used') return 'Occasion';
  return condition;
}

function qualityLabel(quality: string) {
  if (quality === 'original') return 'Origine constructeur';
  if (quality === 'equivalent') return 'Équivalent';
  if (quality === 'reconditioned') return 'Reconditionné';
  if (quality === 'used') return 'Occasion';
  return quality;
}

export default function QuoteCompareScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteBasis, setQuoteBasis] = useState<QuoteBasis>(null);
  const [sameUnitConfirmed, setSameUnitConfirmed] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [supplierLookup, setSupplierLookup] = useState<{ key: string; status: 'ready' | 'error'; offers: SupplierOfferView[] } | null>(null);

  const selected = results.find((item) => item.id === selectedPriceId) ?? null;
  const selectedProduct = selected ? productOf(selected) : null;
  const selectedUnit = selected ? unitOf(selected) : '';
  const amount = parseAmount(quoteAmount);
  const rangeIsOrdered = Boolean(selected && selected.li <= selected.pm && selected.pm <= selected.ls);
  const basisMatches = Boolean(selected && selected.tax_basis !== 'unknown' && quoteBasis === selected.tax_basis);
  const canCompare = Boolean(selected && amount && rangeIsOrdered && basisMatches && sameUnitConfirmed);
  const comparison = useMemo(() => {
    if (!canCompare || !selected || !amount) return null;
    if (amount < selected.li) return { type: 'below' as const, delta: selected.li - amount };
    if (amount > selected.ls) return { type: 'above' as const, delta: amount - selected.ls };
    return { type: 'within' as const, delta: Math.abs(amount - selected.pm) };
  }, [amount, canCompare, selected]);

  const supplierLookupKey = showResultModal
    && comparison?.type === 'above'
    && selected
    && selectedProduct
    && amount
    && selected.tax_basis !== 'unknown'
    ? `${selectedProduct.id}:${selected.currency}:${selected.tax_basis}:${amount}`
    : null;

  useEffect(() => {
    if (!supplierLookupKey || !selectedProduct || !selected || !amount) return;

    let active = true;
    const key = supplierLookupKey;
    const productId = selectedProduct.id;
    const currency = selected.currency;
    const taxBasis = selected.tax_basis;
    const quotedAmount = amount;

    void getPublishedSupplierOffers(productId)
      .then((offers) => {
        if (!active) return;
        const matchingOffers = offers
          .filter((offer) =>
            offer.product_id === productId
            && offer.currency === currency
            && offer.tax_basis === taxBasis
            && offer.availability === 'available'
            && offer.unit_price + offer.delivery_fee < quotedAmount
          )
          .sort((left, right) => (left.unit_price + left.delivery_fee) - (right.unit_price + right.delivery_fee))
          .slice(0, 3);
        setSupplierLookup({ key, status: 'ready', offers: matchingOffers });
      })
      .catch(() => {
        if (active) setSupplierLookup({ key, status: 'error', offers: [] });
      });

    return () => { active = false; };
  }, [amount, selected, selectedProduct, supplierLookupKey]);

  const currentSupplierLookup = supplierLookup?.key === supplierLookupKey ? supplierLookup : null;
  const supplierOffers = currentSupplierLookup?.offers ?? [];
  const supplierOffersLoading = Boolean(supplierLookupKey && !currentSupplierLookup);
  const supplierOffersError = currentSupplierLookup?.status === 'error';

  async function search() {
    const term = query.trim();
    if (term.length < 2) {
      setSearchError('Saisis au moins deux caractères pour rechercher une référence.');
      return;
    }
    setLoading(true);
    setSearchError(null);
    setShowResultModal(false);
    try {
      const found = await searchPublishedPrices(term);
      setResults(found.slice(0, 12));
      setSelectedPriceId(null);
      setQuoteAmount('');
      setQuoteBasis(null);
      setSameUnitConfirmed(false);
    } catch (error) {
      setResults([]);
      setSearchError(error instanceof Error ? error.message : 'La recherche est indisponible. Réessaie.');
    } finally {
      setLoading(false);
    }
  }

  function choosePrice(item: SearchResult) {
    setSelectedPriceId(item.id);
    setQuoteAmount('');
    setQuoteBasis(null);
    setSameUnitConfirmed(false);
    setShowResultModal(false);
  }

  const resultMessage = !selected
    ? 'Choisis une référence du répertoire.'
    : !amount
      ? 'Saisis le prix unitaire proposé dans le devis.'
      : selected.tax_basis === 'unknown'
        ? 'La source ne précise pas si le prix est HT ou TTC : aucune comparaison fiscale fiable n’est possible.'
        : !quoteBasis || quoteBasis !== selected.tax_basis
          ? `Choisis la même base que le répertoire (${selected.tax_basis}). Aucun taux de taxe n’est supposé.`
          : !rangeIsOrdered
            ? 'Les valeurs de cette ligne source ne forment pas une fourchette cohérente. Le prix est affiché, mais aucun verdict n’est calculé.'
            : !sameUnitConfirmed
              ? `Confirme que le devis porte sur la même désignation et la même unité (${selectedUnit}).`
              : null;

  const source = selected ? sourceOf(selected) : null;
  const sourceEdition = source?.edition ? `Édition ${source.edition}` : source?.title ?? 'Répertoire de référence';

  return (
    <AppShell>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, compact && styles.pageCompact]}>
        <View style={[styles.hero, compact && styles.heroCompact]}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>OUTIL DE VÉRIFICATION · AUTOMOBILE</Text>
            <Text style={[styles.title, compact && styles.titleCompact]}>Votre devis est-il dans la référence ?</Text>
            <Text style={styles.subtitle}>Choisis une ligne du répertoire et compare son prix unitaire au montant proposé par le garage.</Text>
            <Pressable onPress={() => router.push('/catalogue')} accessibilityRole="link" style={styles.backLink}>
              <Text style={styles.backLinkText}>← Retour au catalogue</Text>
            </Pressable>
          </View>
          <View style={styles.heroStamp}><Text style={styles.heroStampTop}>CHECK</Text><Text style={styles.heroStampValue}>XOF</Text><Text style={styles.heroStampBottom}>SOURCE 2026.01</Text></View>
        </View>

        <View style={[styles.contentGrid, compact && styles.contentGridCompact]}>
          <View style={styles.panel}>
            <View style={styles.stepHeader}><Text style={styles.stepNumber}>01</Text><View><Text style={styles.panelTitle}>Trouver la référence</Text><Text style={styles.panelSubtitle}>Recherche par désignation ou marque.</Text></View></View>
            <View style={[styles.searchRow, compact && styles.searchRowCompact]}>
              <TextInput
                value={query}
                onChangeText={(value) => { setQuery(value); setShowResultModal(false); }}
                onSubmitEditing={() => { void search(); }}
                placeholder="Ex. plaquette de frein, filtre à huile…"
                placeholderTextColor="#89958E"
                returnKeyType="search"
                accessibilityLabel="Rechercher une référence automobile"
                style={styles.searchInput}
              />
              <Pressable onPress={() => { void search(); }} disabled={loading} style={({ pressed }) => [styles.searchButton, pressed && styles.pressed, loading && styles.disabled]}>
                {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.searchButtonText}>Rechercher</Text>}
              </Pressable>
            </View>
            {searchError && <Text style={styles.errorText}>{searchError}</Text>}

            {results.length > 0 && (
              <View style={styles.resultList}>
                <Text style={styles.resultsCount}>{results.length} résultat{results.length > 1 ? 's' : ''} affiché{results.length > 1 ? 's' : ''} · choisis la désignation exacte</Text>
                {results.map((item) => {
                  const product = productOf(item);
                  if (!product) return null;
                  const active = item.id === selectedPriceId;
                  return (
                    <Pressable key={item.id} onPress={() => choosePrice(item)} accessibilityRole="button" style={({ pressed }) => [styles.resultOption, active && styles.resultOptionActive, pressed && styles.pressed]}>
                      <View style={styles.resultOptionCopy}>
                        <Text style={styles.resultName}>{product.name}</Text>
                        <Text style={styles.resultMeta}>{unitOf(item)} · {item.currency} · {item.tax_basis === 'unknown' ? 'base fiscale inconnue' : item.tax_basis}</Text>
                      </View>
                      <Text style={[styles.resultSelect, active && styles.resultSelectActive]}>{active ? 'Choisi' : 'Choisir'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {!loading && query.trim().length >= 2 && !searchError && results.length === 0 && <Text style={styles.emptyText}>Aucune référence publiée trouvée pour cette recherche.</Text>}
          </View>

          <View style={styles.panel}>
            <View style={styles.stepHeader}><Text style={styles.stepNumber}>02</Text><View><Text style={styles.panelTitle}>Saisir le prix du devis</Text><Text style={styles.panelSubtitle}>Le prix doit correspondre à une unité.</Text></View></View>
            {selected && selectedProduct ? (
              <View style={styles.selectedCard}>
                <Text style={styles.selectedLabel}>RÉFÉRENCE CHOISIE</Text>
                <Text style={styles.selectedName}>{selectedProduct.name}</Text>
                <Text style={styles.selectedMeta}>{selectedUnit} · {selected.currency} · {selected.tax_basis === 'unknown' ? 'Base fiscale non précisée' : `Prix ${selected.tax_basis}`}</Text>
                <View style={styles.referencePrices}>
                  <View style={styles.priceCell}><Text style={styles.priceCellLabel}>MINIMUM</Text><Text style={styles.priceCellValue}>{formatAmount(selected.li)}</Text></View>
                  <View style={[styles.priceCell, styles.priceCellAverage]}><Text style={styles.priceCellLabel}>MOYEN</Text><Text style={styles.priceCellValue}>{formatAmount(selected.pm)}</Text></View>
                  <View style={styles.priceCell}><Text style={styles.priceCellLabel}>MAXIMUM</Text><Text style={styles.priceCellValue}>{formatAmount(selected.ls)}</Text></View>
                </View>
                <Text style={styles.sourceCaption}>{sourceEdition} · prix du répertoire, non une offre de vendeur</Text>
              </View>
            ) : (
              <View style={styles.placeholder}><Text style={styles.placeholderMark}>↖</Text><Text style={styles.placeholderText}>Sélectionne d’abord une référence pour afficher ses valeurs.</Text></View>
            )}

            <Text style={styles.inputLabel}>Prix unitaire proposé ({selected?.currency ?? 'XOF'})</Text>
            <TextInput
              value={quoteAmount}
              onChangeText={(value) => { setQuoteAmount(value); setShowResultModal(false); }}
              editable={Boolean(selected)}
              keyboardType="decimal-pad"
              placeholder="Ex. 25 000"
              placeholderTextColor="#89958E"
              accessibilityLabel="Prix unitaire indiqué sur le devis"
              style={[styles.amountInput, !selected && styles.inputDisabled]}
            />

            <Text style={styles.inputLabel}>Base de prix indiquée sur le devis</Text>
            <View style={styles.basisRow}>
              {(['HT', 'TTC', 'unknown'] as const).map((basis) => {
                const label = basis === 'unknown' ? 'Je ne sais pas' : basis;
                const active = quoteBasis === basis;
                return <Pressable key={basis} onPress={() => { setQuoteBasis(basis); setShowResultModal(false); }} disabled={!selected} style={[styles.basisChip, active && styles.basisChipActive, !selected && styles.inputDisabled]}><Text style={[styles.basisChipText, active && styles.basisChipTextActive]}>{label}</Text></Pressable>;
              })}
            </View>

            {selected && (
              <Pressable onPress={() => { setSameUnitConfirmed((current) => !current); setShowResultModal(false); }} accessibilityRole="checkbox" accessibilityState={{ checked: sameUnitConfirmed }} style={styles.confirmRow}>
                <View style={[styles.checkbox, sameUnitConfirmed && styles.checkboxChecked]}>{sameUnitConfirmed && <Text style={styles.checkmark}>✓</Text>}</View>
                <Text style={styles.confirmText}>Je confirme que l’article, la qualité et l’unité du devis correspondent à cette référence.</Text>
              </Pressable>
            )}

            <Pressable onPress={() => setShowResultModal(true)} disabled={!selected} accessibilityRole="button" style={({ pressed }) => [styles.compareButton, pressed && styles.pressed, !selected && styles.disabled]}>
              <Text style={styles.compareButtonText}>Comparer le prix <Text style={styles.compareArrow}>→</Text></Text>
            </Pressable>
          </View>
        </View>

        <Modal
          visible={showResultModal}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setShowResultModal(false)}>
          <View style={styles.modalBackdrop}>
            <Pressable
              onPress={() => setShowResultModal(false)}
              accessibilityRole="button"
              accessibilityLabel="Fermer la fenêtre de résultat"
              style={StyleSheet.absoluteFill} />
            <View style={[styles.modalCard, compact && styles.modalCardCompact]} accessibilityViewIsModal>
              <View style={styles.modalHeader}>
                <View style={[
                  styles.modalIcon,
                  !comparison && styles.modalIconNotice,
                  comparison?.type === 'above' && styles.modalIconAbove,
                  comparison?.type === 'below' && styles.modalIconBelow,
                  comparison?.type === 'within' && styles.modalIconWithin,
                ]}>
                  <Text style={styles.modalIconText}>{comparison ? comparison.type === 'above' ? '!' : comparison.type === 'below' ? '↓' : '✓' : 'i'}</Text>
                </View>
                <Pressable onPress={() => setShowResultModal(false)} accessibilityRole="button" accessibilityLabel="Fermer" style={styles.modalClose}>
                  <Text style={styles.modalCloseText}>×</Text>
                </Pressable>
              </View>
              <Text style={styles.modalEyebrow}>{comparison ? 'RÉSULTAT INDICATIF' : 'COMPARAISON NON DISPONIBLE'}</Text>
              <Text style={styles.modalTitle}>
                {!comparison ? 'Vérifie les informations saisies' : comparison.type === 'above' ? 'Au-dessus de la borne haute' : comparison.type === 'below' ? 'En dessous de la fourchette' : 'Dans la fourchette de référence'}
              </Text>
              <Text style={styles.modalBody}>
                {!comparison
                  ? resultMessage
                  : comparison.type === 'above'
                    ? `${formatAmount(comparison.delta)} ${selected?.currency} au-dessus du maximum de référence.`
                    : comparison.type === 'below'
                      ? `${formatAmount(comparison.delta)} ${selected?.currency} en dessous du minimum de référence. Vérifie aussi la qualité, le conditionnement et les éventuels frais inclus.`
                      : `${formatAmount(comparison.delta)} ${selected?.currency} d’écart avec le prix moyen de référence.`}
              </Text>
              {selected && amount !== null && (
                <View style={styles.modalSummary}>
                  <View style={styles.modalSummaryCell}>
                    <Text style={styles.modalSummaryLabel}>DEVIS</Text>
                    <Text style={styles.modalSummaryValue}>{formatAmount(amount)} {selected.currency}</Text>
                  </View>
                  <View style={styles.modalSummaryCell}>
                    <Text style={styles.modalSummaryLabel}>FOURCHETTE SOURCE</Text>
                    <Text style={styles.modalSummaryValue}>{formatAmount(selected.li)} – {formatAmount(selected.ls)} {selected.currency}</Text>
                  </View>
                </View>
              )}
              {comparison && <Text style={styles.modalCaution}>Un écart signale un point à vérifier ; il ne prouve pas à lui seul une surfacturation. Vérifie le véhicule, la qualité, la quantité et les frais du devis.</Text>}
              {comparison?.type === 'above' && (
                <View style={styles.supplierOfferBlock}>
                  <View style={styles.supplierOfferHeader}>
                    <View><Text style={styles.supplierOfferTitle}>Offres partenaires moins chères</Text><Text style={styles.supplierOfferCaption}>Prix et base fiscale compatibles · état et qualité indiqués pour chaque offre</Text></View>
                    <Text style={styles.supplierOfferMark}>↘</Text>
                  </View>
                  {supplierOffersLoading ? (
                    <View style={styles.offerLoading}><ActivityIndicator size="small" color="#2B6049" /><Text style={styles.offerEmptyText}>Recherche des offres confirmées…</Text></View>
                  ) : supplierOffersError ? (
                    <Text style={styles.offerEmptyText}>Les offres partenaires sont momentanément indisponibles.</Text>
                  ) : supplierOffers.length === 0 ? (
                    <Text style={styles.offerEmptyText}>Aucune offre vérifiée ne réunit ces critères pour le moment.</Text>
                  ) : supplierOffers.map((offer) => (
                    <View key={offer.id} style={styles.supplierOfferCard}>
                      <View style={styles.supplierOfferTop}>
                        <View style={styles.supplierOfferCopy}><Text style={styles.supplierName}>{offer.supplierName}</Text><Text style={styles.supplierMeta}>{conditionLabel(offer.condition)} · {qualityLabel(offer.quality)} · {offer.delivery_zone} · stock confirmé le {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(offer.verified_at))}</Text></View>
                        <Text style={styles.supplierTotal}>{formatAmount(offer.unit_price + offer.delivery_fee)} {offer.currency}</Text>
                      </View>
                      <Text style={styles.supplierCostDetail}>1 unité : {formatAmount(offer.unit_price)} {offer.currency} + {formatAmount(offer.delivery_fee)} {offer.delivery_currency} de livraison</Text>
                    </View>
                  ))}
                  <Text style={styles.supplierOfferFootnote}>Estimation pour une unité, valable dans la zone affichée. Le prix fournisseur reste distinct de la référence source.</Text>
                  <Pressable onPress={() => { setShowResultModal(false); router.push('/offres'); }} accessibilityRole="link" style={styles.supplierOffersLink}>
                    <Text style={styles.supplierOffersLinkText}>Voir toutes les offres partenaires →</Text>
                  </Pressable>
                </View>
              )}
              <Pressable onPress={() => setShowResultModal(false)} accessibilityRole="button" style={({ pressed }) => [styles.modalAction, pressed && styles.pressed]}>
                <Text style={styles.modalActionText}>Revenir au formulaire</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <View style={styles.footerNote}>
          <Text style={styles.footerMark}>i</Text>
          <Text style={styles.footerText}>Cette première version compare une seule ligne, sans enregistrer le devis. Elle ne convertit pas HT/TTC et ne vérifie pas la compatibilité avec le véhicule.</Text>
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  page: { width: '100%', maxWidth: 1260, alignSelf: 'center', paddingHorizontal: 34, paddingTop: 34, paddingBottom: 64 },
  pageCompact: { paddingHorizontal: 18, paddingTop: 22 },
  hero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: 32, borderRadius: 24, backgroundColor: '#173A32' },
  heroCompact: { padding: 24 },
  heroCopy: { flex: 1, maxWidth: 780 },
  eyebrow: { color: '#F2A36F', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { marginTop: 14, color: '#FFFFFF', fontSize: 38, lineHeight: 44, fontWeight: '800', letterSpacing: -1.4 },
  titleCompact: { fontSize: 29, lineHeight: 34 },
  subtitle: { maxWidth: 700, marginTop: 12, color: '#D2E1D9', fontSize: 15, lineHeight: 23 },
  backLink: { alignSelf: 'flex-start', marginTop: 20 },
  backLinkText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  heroStamp: { width: 156, height: 156, borderWidth: 1, borderColor: '#57756A', borderRadius: 78, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  heroStampTop: { color: '#BBD0C6', fontSize: 11, letterSpacing: 2, fontWeight: '800' },
  heroStampValue: { marginVertical: 5, color: '#F2A36F', fontSize: 32, fontWeight: '900' },
  heroStampBottom: { color: '#BBD0C6', fontSize: 8, letterSpacing: 1.2, fontWeight: '800' },
  contentGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: 18, marginTop: 20 },
  contentGridCompact: { flexDirection: 'column' },
  panel: { flex: 1, minWidth: 0, padding: 22, borderWidth: 1, borderColor: '#E3EAE5', borderRadius: 20, backgroundColor: '#FFFFFF' },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  stepNumber: { color: '#2B6049', fontSize: 14, fontWeight: '900', backgroundColor: '#E9F2EC', overflow: 'hidden', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  panelTitle: { color: '#193B32', fontSize: 18, fontWeight: '800' },
  panelSubtitle: { marginTop: 3, color: '#76857D', fontSize: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'stretch', gap: 9 },
  searchRowCompact: { flexDirection: 'column' },
  searchInput: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: '#DDE5DF', borderRadius: 12, color: '#1D342B', fontSize: 13, backgroundColor: '#FBFCFB' },
  searchButton: { minHeight: 48, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2B6049' },
  searchButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
  errorText: { marginTop: 10, color: '#A54139', fontSize: 12, lineHeight: 18 },
  resultList: { marginTop: 18, gap: 8 },
  resultsCount: { marginBottom: 3, color: '#76857D', fontSize: 11, lineHeight: 16 },
  resultOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 12, borderWidth: 1, borderColor: '#E3EAE5', borderRadius: 13, backgroundColor: '#FFFFFF' },
  resultOptionActive: { borderColor: '#4C8E6A', backgroundColor: '#F2F8F4' },
  resultOptionCopy: { flex: 1 },
  resultName: { color: '#203A30', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  resultMeta: { marginTop: 4, color: '#78877F', fontSize: 10 },
  resultSelect: { color: '#66776F', fontSize: 11, fontWeight: '700' },
  resultSelectActive: { color: '#2B6049' },
  emptyText: { marginTop: 15, color: '#76857D', fontSize: 13, lineHeight: 20 },
  selectedCard: { padding: 15, borderRadius: 15, backgroundColor: '#F5F8F5' },
  selectedLabel: { color: '#759080', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  selectedName: { marginTop: 7, color: '#193B32', fontSize: 15, lineHeight: 21, fontWeight: '800' },
  selectedMeta: { marginTop: 4, color: '#66776F', fontSize: 11 },
  referencePrices: { flexDirection: 'row', gap: 7, marginTop: 14 },
  priceCell: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: '#FFFFFF' },
  priceCellAverage: { backgroundColor: '#EAF3ED' },
  priceCellLabel: { color: '#77877E', fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  priceCellValue: { marginTop: 4, color: '#193B32', fontSize: 14, fontWeight: '900' },
  sourceCaption: { marginTop: 10, color: '#77877E', fontSize: 10, lineHeight: 15 },
  placeholder: { minHeight: 142, padding: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#DCE5DE', borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFCFA' },
  placeholderMark: { color: '#75A087', fontSize: 26, fontWeight: '700' },
  placeholderText: { maxWidth: 240, marginTop: 6, color: '#7C8A82', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  inputLabel: { marginTop: 18, marginBottom: 8, color: '#344D40', fontSize: 11, fontWeight: '800' },
  amountInput: { minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: '#DDE5DF', borderRadius: 12, color: '#1D342B', fontSize: 16, fontWeight: '700', backgroundColor: '#FBFCFB' },
  inputDisabled: { opacity: 0.5 },
  basisRow: { flexDirection: 'row', gap: 8 },
  basisChip: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: '#DDE5DF', borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  basisChipActive: { borderColor: '#2B6049', backgroundColor: '#EAF3ED' },
  basisChipText: { color: '#627168', fontSize: 11, fontWeight: '700' },
  basisChipTextActive: { color: '#24533E' },
  confirmRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 15 },
  checkbox: { width: 19, height: 19, marginTop: 1, borderWidth: 1, borderColor: '#9BAAA1', borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { borderColor: '#2B6049', backgroundColor: '#2B6049' },
  checkmark: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  confirmText: { flex: 1, color: '#55675D', fontSize: 11, lineHeight: 17 },
  compareButton: { minHeight: 50, marginTop: 18, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2A36F' },
  compareButtonText: { color: '#173A32', fontSize: 13, fontWeight: '900' },
  compareArrow: { fontSize: 16 },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(15, 34, 28, 0.68)' },
  modalCard: { width: '100%', maxWidth: 560, maxHeight: '90%', padding: 26, borderRadius: 24, backgroundColor: '#FFFFFF', shadowColor: '#10271F', shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 18 },
  modalCardCompact: { padding: 22, borderRadius: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF3ED' },
  modalIconNotice: { backgroundColor: '#FFF2DE' },
  modalIconAbove: { backgroundColor: '#FBE9E2' },
  modalIconBelow: { backgroundColor: '#FFF2DE' },
  modalIconWithin: { backgroundColor: '#EAF3ED' },
  modalIconText: { color: '#24533E', fontSize: 20, fontWeight: '900' },
  modalClose: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F4F2' },
  modalCloseText: { color: '#51645A', fontSize: 25, lineHeight: 28 },
  modalEyebrow: { marginTop: 18, color: '#71857A', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  modalTitle: { marginTop: 7, color: '#193B32', fontSize: 24, lineHeight: 30, fontWeight: '900' },
  modalBody: { marginTop: 9, color: '#385346', fontSize: 14, lineHeight: 21, fontWeight: '600' },
  modalSummary: { flexDirection: 'row', gap: 9, marginTop: 19, padding: 12, borderRadius: 13, backgroundColor: '#F3F7F4' },
  modalSummaryCell: { flex: 1 },
  modalSummaryLabel: { color: '#77877E', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  modalSummaryValue: { marginTop: 5, color: '#193B32', fontSize: 12, lineHeight: 17, fontWeight: '800' },
  modalCaution: { marginTop: 14, color: '#627168', fontSize: 11, lineHeight: 17 },
  supplierOfferBlock: { marginTop: 16, padding: 13, borderWidth: 1, borderColor: '#DCE9DE', borderRadius: 14, backgroundColor: '#F6FAF6' },
  supplierOfferHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  supplierOfferTitle: { color: '#214733', fontSize: 12, fontWeight: '900' },
  supplierOfferCaption: { marginTop: 3, color: '#74877A', fontSize: 8 },
  supplierOfferMark: { color: '#5D956B', fontSize: 21, fontWeight: '900' },
  offerLoading: { minHeight: 37, flexDirection: 'row', alignItems: 'center', gap: 8 },
  offerEmptyText: { color: '#728278', fontSize: 9, lineHeight: 15 },
  supplierOfferCard: { marginTop: 7, padding: 10, borderRadius: 10, backgroundColor: '#FFFFFF' },
  supplierOfferTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  supplierOfferCopy: { flex: 1 },
  supplierName: { color: '#355A40', fontSize: 10, fontWeight: '800' },
  supplierMeta: { marginTop: 4, color: '#86958A', fontSize: 8 },
  supplierTotal: { color: '#27573B', fontSize: 13, fontWeight: '900' },
  supplierCostDetail: { marginTop: 7, color: '#728278', fontSize: 8 },
  supplierOfferFootnote: { marginTop: 9, color: '#86958A', fontSize: 8, lineHeight: 12 },
  supplierOffersLink: { alignSelf: 'flex-start', marginTop: 9, paddingVertical: 5 },
  supplierOffersLinkText: { color: '#32694A', fontSize: 9, fontWeight: '900' },
  modalAction: { minHeight: 48, marginTop: 22, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2B6049' },
  modalActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  footerNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 18, padding: 16, borderRadius: 14, backgroundColor: '#EDF1EE' },
  footerMark: { width: 18, height: 18, borderRadius: 9, color: '#FFFFFF', textAlign: 'center', overflow: 'hidden', backgroundColor: '#668676', fontSize: 12, fontWeight: '900' },
  footerText: { flex: 1, color: '#5D6C63', fontSize: 11, lineHeight: 17 },
});
