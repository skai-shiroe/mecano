import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { AppShell } from '@/components/AppShell';
import type { ActiveCategory, PriceHistoryEntry } from '@/lib/catalog';
import { canManageCatalogPrices, getActiveCategories, getPriceHistory, publishPriceRevision, searchPublishedPrices } from '@/lib/catalog';
import { useAuth } from '@/hooks/useAuth';

type SearchResults = Awaited<ReturnType<typeof searchPublishedPrices>>;
type SelectedPrice = SearchResults[number] & { productName: string };

function formatPriceDate(value: string | null) {
  if (!value) return 'date non précisée';
  const date = new Date(value.length === 10 ? value + 'T12:00:00' : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function parsePriceAmount(value: string) {
  const amount = Number(value.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
  return Number.isFinite(amount) ? amount : null;
}

const familyCards = [
  { label: 'Freinage', query: 'frein', image: require('../../../assets/images/part-brakes.webp'), note: 'Disques, plaquettes…' },
  { label: 'Éclairage', query: 'phare', image: require('../../../assets/images/part-headlight.webp'), note: 'Phares et optiques' },
  { label: 'Électricité', query: 'alternateur', image: require('../../../assets/images/part-alternator.webp'), note: 'Alternateurs, batteries…' },
  { label: 'Suspension', query: 'amortisseur', image: require('../../../assets/images/part-suspension.webp'), note: 'Amortisseurs et trains' },
];

export default function CatalogueScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const initialQuery = typeof params.q === 'string' ? params.q : '';
  return <CatalogueContent key={initialQuery} initialQuery={initialQuery} />;
}

function CatalogueContent({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const [categories, setCategories] = useState<ActiveCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [query, setQuery] = useState(() => initialQuery);
  const [results, setResults] = useState<SearchResults>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalogAdminUserId, setCatalogAdminUserId] = useState<string | null>(null);
  const canManagePrices = Boolean(session && catalogAdminUserId === session.user.id);
  const [editingPrice, setEditingPrice] = useState<SelectedPrice | null>(null);
  const [pmDraft, setPmDraft] = useState('');
  const [liDraft, setLiDraft] = useState('');
  const [lsDraft, setLsDraft] = useState('');
  const [revisionNote, setRevisionNote] = useState('');
  const [savingRevision, setSavingRevision] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<{ productId: string; sourceId: string; productName: string } | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getActiveCategories()
      .then((items) => { if (active) setCategories(items); })
      .catch(() => { if (active) setCategories([]); });
    searchPublishedPrices(initialQuery)
      .then((items) => {
        if (!active) return;
        setResults(items);
        setSearched(Boolean(initialQuery));
      })
      .catch((loadError) => {
        if (!active) return;
        const message = loadError instanceof Error ? loadError.message : '';
        setError(message || 'Impossible de charger les références publiées. Réessaie dans un instant.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialQuery]);

  useEffect(() => {
    let active = true;
    if (!session) return () => { active = false; };
    void canManageCatalogPrices()
      .then((allowed) => { if (active) setCatalogAdminUserId(allowed ? session.user.id : null); })
      .catch(() => { if (active) setCatalogAdminUserId(null); });
    return () => { active = false; };
  }, [session]);

  async function submitSearch(searchTerm = query, categoryId = selectedCategory) {
    setSearched(true);
    setError(null);
    setLoading(true);
    try {
      const data = await searchPublishedPrices(searchTerm, categoryId || undefined);
      setResults(data);
    } catch (searchError) {
      const message = searchError instanceof Error ? searchError.message : '';
      setError(message || 'La recherche du catalogue a échoué. Vérifie ton accès et réessaie.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function openPriceEditor(item: SearchResults[number], productName: string) {
    setEditingPrice({ ...item, productName });
    setPmDraft(String(item.pm));
    setLiDraft(String(item.li));
    setLsDraft(String(item.ls));
    setRevisionNote('');
    setRevisionError(null);
  }

  async function openPriceHistory(item: SearchResults[number], productName: string) {
    setHistoryFor({ productId: item.product_id, sourceId: item.source_id, productName });
    setPriceHistory([]);
    setHistoryError(null);
    setLoadingHistory(true);
    try {
      setPriceHistory(await getPriceHistory(item.product_id, item.source_id));
    } catch (historyLoadError) {
      setHistoryError(historyLoadError instanceof Error ? historyLoadError.message : 'Impossible de charger cet historique.');
    } finally {
      setLoadingHistory(false);
    }
  }

  async function savePriceRevision() {
    if (!editingPrice) return;
    const pm = parsePriceAmount(pmDraft);
    const li = parsePriceAmount(liDraft);
    const ls = parsePriceAmount(lsDraft);
    if (pm === null || li === null || ls === null || pm <= 0 || li <= 0 || ls <= 0 || li > pm || pm > ls) {
      setRevisionError('Saisis des montants positifs avec minimum ≤ moyen ≤ maximum.');
      return;
    }
    if (revisionNote.trim().length < 5) {
      setRevisionError('Ajoute le motif et, si possible, la source et la date du nouveau prix.');
      return;
    }

    setSavingRevision(true);
    setRevisionError(null);
    try {
      await publishPriceRevision({ referencePriceId: editingPrice.id, pm, li, ls, note: revisionNote.trim() });
      setEditingPrice(null);
      try {
        setResults(await searchPublishedPrices(query, selectedCategory || undefined));
      } catch {
        setError('Le prix a été enregistré. Actualise la page pour recharger le catalogue.');
      }
    } catch (saveError) {
      setRevisionError(saveError instanceof Error ? saveError.message : 'La nouvelle révision n’a pas pu être enregistrée.');
    } finally {
      setSavingRevision(false);
    }
  }

  return (
    <AppShell>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, compact && styles.pageCompact]}>
        <Animated.View entering={FadeInDown.duration(620)} style={[styles.hero, compact && styles.heroCompact]}>
          <View style={styles.heroCopy}>
            <View style={styles.heroPill}><View style={styles.heroDot} /><Text style={styles.heroPillText}>CATALOGUE AUTO · TOGO</Text></View>
            <Text style={[styles.title, compact && styles.titleCompact]}>La bonne pièce.{ '\n' }Le bon repère.</Text>
            <Text style={styles.heroText}>Trouvez une désignation ou une référence, puis lisez son prix avec l’unité, la source et le contexte.</Text>
            <View style={[styles.searchRow, compact && styles.searchRowCompact]}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => submitSearch()}
                placeholder="Nom, marque ou référence fabricant…"
                placeholderTextColor="#849188"
                returnKeyType="search"
                accessibilityLabel="Nom, marque ou référence fabricant de la pièce"
                style={styles.searchInput}
              />
              <Pressable onPress={() => submitSearch()} disabled={loading} accessibilityRole="button" style={({ pressed }) => [styles.searchButton, pressed && styles.pressed, loading && styles.disabled]}>
                {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.searchButtonText}>Rechercher <Text style={styles.searchArrow}>→</Text></Text>}
              </Pressable>
            </View>
            <Text style={styles.searchHint}>Une recherche par véhicule sera ajoutée quand les compatibilités seront vérifiées.</Text>
          </View>
          {!compact && (
            <ImageBackground source={require('../../../assets/images/part-brakes.webp')} resizeMode="cover" imageStyle={styles.heroImageRadius} style={styles.heroImage}>
              <View style={styles.heroImageShade} />
              <View style={styles.heroImageBadge}><Text style={styles.heroImageBadgeText}>REPÈRE · SOURCE · UNITÉ</Text></View>
            </ImageBackground>
          )}
        </Animated.View>

        {canManagePrices && (
          <Pressable
            onPress={() => router.push('/admin/review')}
            accessibilityRole="link"
            style={({ pressed }) => [styles.reviewQueueLink, pressed && styles.pressed]}>
            <View style={styles.reviewQueueCopy}>
              <Text style={styles.reviewQueueEyebrow}>ADMINISTRATION</Text>
              <Text style={styles.reviewQueueTitle}>Examiner les alertes du répertoire</Text>
              <Text style={styles.reviewQueueSubtitle}>Vérifier les désignations, unités et repères avec leur page source.</Text>
            </View>
            <Text style={styles.reviewQueueArrow}>→</Text>
          </Pressable>
        )}

        <Animated.View entering={FadeInUp.duration(650).delay(100)} style={styles.categorySection}>
          <View style={styles.sectionHeading}>
            <View><Text style={styles.overline}>UN PREMIER APERÇU</Text><Text style={styles.sectionTitle}>Parcourir par famille</Text></View>
            <Text style={styles.sectionHint}>Choisissez une pièce pour préparer la recherche.</Text>
          </View>
          <View style={[styles.familyGrid, compact && styles.familyGridCompact]}>
            {familyCards.map((family, index) => (
              <Animated.View key={family.label} entering={FadeInUp.duration(520).delay(130 + index * 70)} style={styles.familyCardWrap}>
                <Pressable
                  onPress={() => { setQuery(family.query); void submitSearch(family.query); }}
                  accessibilityRole="button"
                  accessibilityLabel={`Rechercher ${family.label}`}
                  style={({ pressed }) => [styles.familyCard, pressed && styles.familyCardPressed]}>
                  <ImageBackground source={family.image} resizeMode="cover" imageStyle={styles.familyImageRadius} style={styles.familyImage}>
                    <View style={styles.familyImageShade} />
                    <Text style={styles.familyBadge}>{family.label.toUpperCase()}</Text>
                    <View style={styles.familyCardFooter}><View><Text style={styles.familyTitle}>{family.label}</Text><Text style={styles.familyNote}>{family.note}</Text></View><Text style={styles.familyArrow}>↗</Text></View>
                  </ImageBackground>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(620).delay(180)} style={styles.searchPanel}>
          <View style={styles.searchPanelCopy}>
            <Text style={styles.searchTitle}>Affiner la recherche</Text>
            <Text style={styles.searchSubtitle}>Filtrez les références publiées par famille de catalogue.</Text>
          </View>
          <View style={styles.filterRow}>
            <Pressable onPress={() => { setSelectedCategory(''); void submitSearch(query, ''); }} style={[styles.filterChip, !selectedCategory && styles.filterChipSelected]}>
              <Text style={[styles.filterChipText, !selectedCategory && styles.filterChipTextSelected]}>Toutes</Text>
            </Pressable>
            {categories.map((category) => {
              const selected = selectedCategory === category.id;
              return (
                <Pressable key={category.id} onPress={() => { const nextCategory = selected ? '' : category.id; setSelectedCategory(nextCategory); void submitSearch(query, nextCategory); }} style={[styles.filterChip, selected && styles.filterChipSelected]}>
                  <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{category.name}</Text>
                </Pressable>
              );
            })}
            {!categories.length && <Text style={styles.filterEmpty}>Les familles seront listées ici après publication.</Text>}
          </View>
        </Animated.View>

        {error ? (
          <View style={styles.errorPanel}><Text style={styles.emptyIcon}>!</Text><View><Text style={styles.emptyTitle}>Connexion au catalogue interrompue</Text><Text style={styles.emptyText}>{error}</Text></View></View>
        ) : loading ? (
          <View style={styles.loadingPanel}><ActivityIndicator color="#3D765B" /><Text style={styles.loadingText}>Recherche des prix publiés dans Supabase…</Text></View>
        ) : results.length ? (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsHeading}>{results.length} référence{results.length > 1 ? 's' : ''}</Text>
            {results.map((item) => {
              const product = Array.isArray(item.products) ? item.products[0] : item.products;
              if (!product) return null;
              const unit = Array.isArray(item.units) ? item.units[0]?.label : item.units?.label;
              const source = Array.isArray(item.reference_sources) ? item.reference_sources[0] : item.reference_sources;
              const money = (amount: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount);
              const productAttributes = typeof product.attributes === 'object' && product.attributes !== null && !Array.isArray(product.attributes)
                ? product.attributes as Record<string, unknown>
                : {};
              return (
                <View key={item.id} style={[styles.resultCard, compact && styles.resultCardCompact]}>
                  <View style={styles.resultProduct}>
                    <View style={styles.resultImageWrap}>
                      <Image source={require('../../../assets/images/automotive-reference-illustration.png')} resizeMode="cover" style={styles.resultImage} accessibilityLabel="Illustration générique d'une voiture et de pièces détachées" />
                      <View style={styles.resultImageBadge}><Text style={styles.resultImageBadgeText}>AUTOMOBILE</Text></View>
                    </View>
                    <View style={styles.resultDescription}>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.productMeta}>{[product.brand, product.manufacturer_reference && `Réf. ${product.manufacturer_reference}`, `Unité : ${unit || product.unit_code}`].filter(Boolean).join(' · ')}</Text>
                      {product.fitment_verified && <Text style={styles.fitmentPill}>Compatibilité contrôlée</Text>}
                      {productAttributes.entry_kind === 'service_candidate' && <Text style={styles.fitmentPill}>Prestation à qualifier</Text>}
                    </View>
                  </View>
                  <View style={[styles.priceRange, compact && styles.priceRangeCompact]}>
                    <Text style={styles.priceLabel}>{item.revision > 1 || item.correction_note ? 'PRIX ACTUALISÉ' : 'VALEURS DU RÉPERTOIRE'} · {item.currency} · {item.tax_basis === 'unknown' ? 'taxe non précisée' : item.tax_basis}</Text>
                    <Text style={styles.priceValue}>PM · {money(item.pm)}</Text>
                    <Text style={styles.priceAverage}>LI · {money(item.li)}  ·  LS · {money(item.ls)}</Text>
                    <Text style={styles.priceSource}>PM = prix moyen · LI = minimum · LS = maximum</Text>
                    {item.revision > 1 && <Text style={styles.priceSource}>Révision {item.revision} · active depuis {formatPriceDate(item.valid_from || item.published_at)}</Text>}
                    {item.correction_note && <Text style={styles.priceRevisionNote}>Motif : {item.correction_note}</Text>}
                    {source && <Text style={styles.priceSource}>{source.title} · édition {source.edition}</Text>}
                    {canManagePrices && (
                      <View style={styles.priceAdminActions}>
                        <Pressable onPress={() => openPriceEditor(item, product.name)} accessibilityRole="button" style={({ pressed }) => [styles.priceEditButton, pressed && styles.pressed]}>
                          <Text style={styles.priceEditButtonText}>Modifier le prix</Text>
                        </Pressable>
                        <Pressable onPress={() => void openPriceHistory(item, product.name)} accessibilityRole="button" style={({ pressed }) => [styles.priceHistoryButton, pressed && styles.pressed]}>
                          <Text style={styles.priceHistoryButtonText}>Historique</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyPanel}>
            <View style={styles.emptyIconWrap}><Text style={styles.emptyIcon}>⌕</Text></View>
            <Text style={styles.emptyEyebrow}>{searched ? 'RÉSULTATS DE RECHERCHE' : 'CATALOGUE AUTOMOBILE'}</Text>
            <Text style={styles.emptyTitle}>{searched ? 'Aucune référence pour cette recherche.' : 'Aucun prix publié pour le moment.'}</Text>
            <Text style={styles.emptyText}>
              {searched
                ? 'Essaie une autre désignation, une marque ou une référence. Chaque résultat reprend les valeurs PM, LI et LS de la source.'
                : 'Les références automobiles publiées apparaîtront ici avec leur unité, leur source et leur édition.'}
            </Text>
            {searched && <Pressable onPress={() => router.push('/fonctionnement')} accessibilityRole="link" style={styles.emptyLink}><Text style={styles.emptyLinkText}>Voir comment Check établit ses repères</Text><Text style={styles.emptyLinkArrow}>→</Text></Pressable>}
            <View style={styles.emptyDivider} />
            <View style={styles.emptyFoot}><View style={styles.footDot} /><Text style={styles.emptyFootText}>Valeurs reprises de la source avec leur édition</Text></View>
          </View>
        )}

        <View style={[styles.noticeStrip, compact && styles.noticeStripCompact]}>
          <View style={styles.noticeMark}><Text style={styles.noticeMarkText}>i</Text></View>
          <View style={styles.noticeCopy}><Text style={styles.noticeTitle}>Comparer le bon article, dans le bon contexte.</Text><Text style={styles.noticeText}>Un montant seul ne suffit pas : vérifiez la désignation, l’unité, la source et la période du prix. Les montants sont des repères du répertoire, pas des offres ni un relevé de stock fournisseur. PM, LI, LS et la base de taxe sont reproduits tels qu’indiqués dans la source, en XOF.</Text></View>
        </View>
      </ScrollView>

      <Modal visible={editingPrice !== null} transparent animationType="fade" onRequestClose={() => { if (!savingRevision) setEditingPrice(null); }}>
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalCard}>
              <Text style={styles.modalEyebrow}>ADMINISTRATION DU CATALOGUE</Text>
              <Text style={styles.modalTitle}>Modifier le prix</Text>
              <Text style={styles.modalSubtitle}>{editingPrice?.productName} · {editingPrice?.currency} · {editingPrice?.tax_basis}</Text>
              <Text style={styles.modalHelp}>Une nouvelle révision datée sera créée. La valeur d’origine et les anciennes révisions restent conservées.</Text>
              <View style={styles.modalFieldsRow}>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Prix moyen (PM)</Text>
                  <TextInput value={pmDraft} onChangeText={setPmDraft} keyboardType="decimal-pad" accessibilityLabel="Nouveau prix moyen" placeholder="0" placeholderTextColor="#9AA59D" style={styles.modalInput} />
                </View>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Minimum (LI)</Text>
                  <TextInput value={liDraft} onChangeText={setLiDraft} keyboardType="decimal-pad" accessibilityLabel="Nouveau prix minimum" placeholder="0" placeholderTextColor="#9AA59D" style={styles.modalInput} />
                </View>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Maximum (LS)</Text>
                  <TextInput value={lsDraft} onChangeText={setLsDraft} keyboardType="decimal-pad" accessibilityLabel="Nouveau prix maximum" placeholder="0" placeholderTextColor="#9AA59D" style={styles.modalInput} />
                </View>
              </View>
              <Text style={styles.modalLabel}>Motif, source et date du nouveau prix</Text>
              <TextInput value={revisionNote} onChangeText={setRevisionNote} multiline maxLength={1000} placeholder="Ex. Prix fournisseur vérifié le 24/10/2026…" placeholderTextColor="#9AA59D" style={[styles.modalInput, styles.modalNoteInput]} />
              {!!revisionError && <Text style={styles.modalError}>{revisionError}</Text>}
              <View style={styles.modalActions}>
                <Pressable onPress={() => setEditingPrice(null)} disabled={savingRevision} style={({ pressed }) => [styles.modalCancelButton, pressed && styles.pressed]}>
                  <Text style={styles.modalCancelText}>Annuler</Text>
                </Pressable>
                <Pressable onPress={() => void savePriceRevision()} disabled={savingRevision} accessibilityRole="button" style={({ pressed }) => [styles.modalSaveButton, pressed && styles.pressed, savingRevision && styles.disabled]}>
                  {savingRevision ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.modalSaveText}>Publier la révision</Text>}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={historyFor !== null} transparent animationType="fade" onRequestClose={() => setHistoryFor(null)}>
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalCard}>
              <Text style={styles.modalEyebrow}>SUIVI DES PRIX</Text>
              <Text style={styles.modalTitle}>Historique des révisions</Text>
              <Text style={styles.modalSubtitle}>{historyFor?.productName}</Text>
              {loadingHistory ? <View style={styles.historyLoading}><ActivityIndicator color="#3D765B" /><Text style={styles.historyLoadingText}>Chargement de l’historique…</Text></View> : null}
              {historyError ? <Text style={styles.modalError}>{historyError}</Text> : null}
              {!loadingHistory && !historyError && priceHistory.map((entry) => (
                <View key={entry.id} style={styles.historyEntry}>
                  <View style={styles.historyEntryHeader}>
                    <Text style={styles.historyRevision}>Révision {entry.revision}</Text>
                    <Text style={[styles.historyStatus, entry.status === 'published' && styles.historyStatusActive]}>{entry.status === 'published' ? 'En vigueur' : 'Archivée'}</Text>
                  </View>
                  <Text style={styles.historyValues}>PM {entry.pm} · LI {entry.li} · LS {entry.ls} {entry.currency}</Text>
                  <Text style={styles.historyDate}>Publiée le {formatPriceDate(entry.published_at || entry.valid_from)}</Text>
                  {entry.correction_note && <Text style={styles.historyNote}>{entry.correction_note}</Text>}
                </View>
              ))}
              <View style={styles.modalActions}>
                <Pressable onPress={() => setHistoryFor(null)} style={({ pressed }) => [styles.modalCancelButton, pressed && styles.pressed]}>
                  <Text style={styles.modalCancelText}>Fermer</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  page: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 36, paddingTop: 30, paddingBottom: 60, gap: 29 },
  pageCompact: { paddingHorizontal: 18, paddingTop: 20, gap: 24 },
  hero: { minHeight: 330, padding: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 24, overflow: 'hidden', borderRadius: 22, backgroundColor: '#183D33' },
  heroCompact: { minHeight: 360, padding: 22, flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center' },
  heroCopy: { flex: 1, maxWidth: 660 },
  heroPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,.17)', borderRadius: 99, backgroundColor: 'rgba(255,255,255,.07)' },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F1A16D' },
  heroPillText: { color: '#DFE9E2', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 15, color: '#FFFFFF', fontSize: 39, lineHeight: 45, fontWeight: '800', letterSpacing: -1.4 },
  titleCompact: { fontSize: 33, lineHeight: 38, letterSpacing: -1 },
  heroText: { maxWidth: 520, marginTop: 10, marginBottom: 16, color: '#D4E2D9', fontSize: 12, lineHeight: 19 },
  reviewQueueLink: { paddingHorizontal: 18, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderWidth: 1, borderColor: '#DDE8DE', borderRadius: 14, backgroundColor: '#FFFFFF' },
  reviewQueueCopy: { flex: 1, gap: 4 },
  reviewQueueEyebrow: { color: '#9A6849', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  reviewQueueTitle: { color: '#234332', fontSize: 13, fontWeight: '800' },
  reviewQueueSubtitle: { color: '#77867D', fontSize: 9, lineHeight: 14 },
  reviewQueueArrow: { color: '#C8784C', fontSize: 20, fontWeight: '900' },
  heroImage: { width: 260, height: 250, padding: 13, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 18, backgroundColor: '#284E40' },
  heroImageRadius: { borderRadius: 18 },
  heroImageShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,40,31,.14)' },
  heroImageBadge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 99, backgroundColor: 'rgba(24,61,51,.84)' },
  heroImageBadgeText: { color: '#FFFFFF', fontSize: 7, fontWeight: '900', letterSpacing: .8 },
  searchHint: { marginTop: 9, color: '#B9CCC0', fontSize: 9, lineHeight: 14 },
  categorySection: { gap: 16 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  overline: { color: '#8B654B', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  sectionTitle: { marginTop: 5, color: '#20372D', fontSize: 21, fontWeight: '800', letterSpacing: -.5 },
  sectionHint: { color: '#77867D', fontSize: 9 },
  familyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  familyGridCompact: { gap: 9 },
  familyCardWrap: { flex: 1, minWidth: 170 },
  familyCard: { height: 210, overflow: 'hidden', borderRadius: 16, backgroundColor: '#183D33' },
  familyCardPressed: { opacity: .87, transform: [{ scale: .985 }] },
  familyImage: { flex: 1, padding: 13, justifyContent: 'space-between' },
  familyImageRadius: { borderRadius: 16 },
  familyImageShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(13,37,29,.3)' },
  familyBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 6, overflow: 'hidden', borderRadius: 99, color: '#FFFFFF', fontSize: 7, fontWeight: '900', letterSpacing: .8, backgroundColor: 'rgba(21,53,43,.78)' },
  familyCardFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  familyTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  familyNote: { marginTop: 3, color: '#E1E9E3', fontSize: 8 },
  familyArrow: { width: 29, height: 29, overflow: 'hidden', borderRadius: 10, color: '#274B3A', fontSize: 16, fontWeight: '900', lineHeight: 29, textAlign: 'center', backgroundColor: '#FFFFFF' },
  searchPanel: { padding: 21, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5EBE5' },
  searchPanelCopy: { marginBottom: 13 },
  searchTitle: { color: '#20372D', fontSize: 18, fontWeight: '800' },
  searchSubtitle: { marginTop: 5, color: '#77867D', fontSize: 11, lineHeight: 17 },
  searchRow: { flexDirection: 'row', gap: 9 },
  searchRowCompact: { flexDirection: 'column' },
  searchInput: { minWidth: 0, minHeight: 47, flex: 1, paddingHorizontal: 13, borderWidth: 1, borderColor: '#DDE5DE', borderRadius: 10, color: '#20372D', fontSize: 11, backgroundColor: '#FCFDFC', outlineStyle: 'none' } as never,
  searchButton: { minHeight: 48, minWidth: 150, paddingHorizontal: 17, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2B6049' },
  searchButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  searchArrow: { color: '#F2A36F', fontSize: 15 },
  filterRow: { marginTop: 15, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  filterLabel: { marginRight: 4, color: '#8A978E', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  filterChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99, borderWidth: 1, borderColor: '#E1E8E2', backgroundColor: '#FFFFFF' },
  filterChipSelected: { borderColor: '#2B6049', backgroundColor: '#EAF2EC' },
  filterChipText: { color: '#596A60', fontSize: 10, fontWeight: '700' },
  filterChipTextSelected: { color: '#2B6049' },
  filterEmpty: { color: '#8A978E', fontSize: 10 },
  emptyPanel: { minHeight: 290, padding: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: '#E5EBE5', backgroundColor: '#FFFFFF', textAlign: 'center' },
  emptyIconWrap: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF4EF' },
  emptyIcon: { color: '#48785D', fontSize: 28, fontWeight: '600' },
  emptyEyebrow: { marginTop: 19, color: '#7A8D80', fontSize: 8, fontWeight: '800', letterSpacing: 1.4 },
  emptyTitle: { marginTop: 8, color: '#21382D', fontSize: 19, fontWeight: '800', textAlign: 'center' },
  emptyText: { maxWidth: 530, marginTop: 8, color: '#78867D', fontSize: 11, lineHeight: 18, textAlign: 'center' },
  emptyDivider: { width: 60, height: 1, marginTop: 20, backgroundColor: '#E5EBE5' },
  emptyFoot: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 7 },
  footDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#5C9A71' },
  emptyFootText: { color: '#7D8D82', fontSize: 9, fontWeight: '600' },
  emptyLink: { marginTop: 15, flexDirection: 'row', alignItems: 'center', gap: 9 },
  emptyLinkText: { color: '#397252', fontSize: 10, fontWeight: '800' },
  emptyLinkArrow: { color: '#C8784C', fontSize: 14, fontWeight: '900' },
  loadingPanel: { minHeight: 180, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 18, backgroundColor: '#FFFFFF' },
  loadingText: { color: '#77867D', fontSize: 11 },
  errorPanel: { minHeight: 150, padding: 22, flexDirection: 'row', alignItems: 'center', gap: 18, borderRadius: 18, borderWidth: 1, borderColor: '#F0DBD3', backgroundColor: '#FFF9F6' },
  resultsSection: { gap: 12 },
  resultsHeading: { color: '#405A4A', fontSize: 13, fontWeight: '800' },
  resultCard: { padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E5EBE5', backgroundColor: '#FFFFFF' },
  resultCardCompact: { flexDirection: 'column', alignItems: 'stretch' },
  resultProduct: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 13 },
  resultImageWrap: { width: 78, height: 78, overflow: 'hidden', borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF3EC' },
  resultImage: { width: '100%', height: '100%' },
  resultImageBadge: { position: 'absolute', right: 3, bottom: 3, left: 3, paddingVertical: 3, borderRadius: 5, backgroundColor: 'rgba(24,61,51,.82)' },
  resultImageBadgeText: { color: '#FFFFFF', fontSize: 5, fontWeight: '900', letterSpacing: .35, textAlign: 'center' },
  resultDescription: { flex: 1, minWidth: 0 },
  productName: { color: '#283D32', fontSize: 14, fontWeight: '800' },
  productMeta: { marginTop: 4, color: '#7B8980', fontSize: 10 },
  fitmentPill: { alignSelf: 'flex-start', marginTop: 7, paddingHorizontal: 7, paddingVertical: 4, overflow: 'hidden', borderRadius: 99, color: '#397252', fontSize: 8, fontWeight: '800', backgroundColor: '#EAF2EC' },
  priceRange: { alignItems: 'flex-end' },
  priceRangeCompact: { alignItems: 'flex-start' },
  priceLabel: { color: '#849188', fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  priceValue: { marginTop: 5, color: '#2B6049', fontSize: 16, fontWeight: '800' },
  priceCurrency: { color: '#6D7F73', fontSize: 9 },
  priceAverage: { marginTop: 4, color: '#819087', fontSize: 9 },
  priceSource: { marginTop: 6, color: '#6E7D73', fontSize: 8, fontWeight: '700' },
  priceRevisionNote: { maxWidth: 340, marginTop: 6, color: '#8B654B', fontSize: 9, lineHeight: 14 },
  priceAdminActions: { marginTop: 10, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  priceEditButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: '#2B6049' },
  priceEditButtonText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  priceHistoryButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#DDE5DE', backgroundColor: '#FFFFFF' },
  priceHistoryButtonText: { color: '#456552', fontSize: 9, fontWeight: '700' },
  modalBackdrop: { flex: 1, padding: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16,36,27,.62)' },
  modalScrollContent: { flexGrow: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 560, padding: 24, borderRadius: 20, borderWidth: 1, borderColor: '#E5EBE5', backgroundColor: '#FFFFFF' },
  modalEyebrow: { color: '#8B654B', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  modalTitle: { marginTop: 7, color: '#20372D', fontSize: 23, fontWeight: '800' },
  modalSubtitle: { marginTop: 5, color: '#6D7F73', fontSize: 11, fontWeight: '700' },
  modalHelp: { marginTop: 12, marginBottom: 18, color: '#78867D', fontSize: 10, lineHeight: 16 },
  modalFieldsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  modalField: { flex: 1, minWidth: 125, marginBottom: 14 },
  modalLabel: { marginBottom: 6, color: '#405A4A', fontSize: 10, fontWeight: '800' },
  modalInput: { minHeight: 45, paddingHorizontal: 12, borderWidth: 1, borderColor: '#DDE5DE', borderRadius: 10, color: '#20372D', fontSize: 12, backgroundColor: '#FCFDFC', outlineStyle: 'none' } as never,
  modalNoteInput: { minHeight: 86, paddingTop: 11, textAlignVertical: 'top' },
  modalError: { marginTop: 9, color: '#A63E32', fontSize: 10, lineHeight: 15 },
  modalActions: { marginTop: 20, flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 9 },
  modalCancelButton: { minHeight: 42, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F4F1' },
  modalCancelText: { color: '#52645A', fontSize: 10, fontWeight: '800' },
  modalSaveButton: { minHeight: 42, minWidth: 150, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2B6049' },
  modalSaveText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  historyLoading: { minHeight: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  historyLoadingText: { color: '#77867D', fontSize: 10 },
  historyEntry: { marginTop: 13, padding: 13, borderWidth: 1, borderColor: '#E5EBE5', borderRadius: 12, backgroundColor: '#FCFDFC' },
  historyEntryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  historyRevision: { color: '#20372D', fontSize: 11, fontWeight: '800' },
  historyStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99, color: '#68796E', fontSize: 8, fontWeight: '800', backgroundColor: '#EEF1EF' },
  historyStatusActive: { color: '#2B6049', backgroundColor: '#EAF2EC' },
  historyValues: { marginTop: 8, color: '#3E5B49', fontSize: 10, fontWeight: '700' },
  historyDate: { marginTop: 5, color: '#78867D', fontSize: 9 },
  historyNote: { marginTop: 7, color: '#8B654B', fontSize: 9, lineHeight: 14 },
  noticeStrip: { padding: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 13, borderRadius: 16, backgroundColor: '#EAF0EB' },
  noticeStripCompact: { padding: 15 },
  noticeMark: { width: 27, height: 27, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D9E8DC' },
  noticeMarkText: { color: '#49755A', fontSize: 14, fontWeight: '800' },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: '#35503F', fontSize: 11, fontWeight: '800' },
  noticeText: { marginTop: 4, color: '#718077', fontSize: 10, lineHeight: 16 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.65 },
});
