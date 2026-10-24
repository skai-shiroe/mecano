import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { InsurerShell } from '@/components/InsurerShell';
import { searchPublishedPrices } from '@/lib/catalog';

type SearchResult = Awaited<ReturnType<typeof searchPublishedPrices>>[number];

function productOf(item: SearchResult) {
  return Array.isArray(item.products) ? item.products[0] ?? null : item.products;
}

function sourceOf(item: SearchResult) {
  return Array.isArray(item.reference_sources) ? item.reference_sources[0] ?? null : item.reference_sources;
}

function unitOf(item: SearchResult) {
  const unit = Array.isArray(item.units) ? item.units[0] : item.units;
  return unit?.label ?? productOf(item)?.unit_code ?? 'unité';
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value) + ' ' + currency;
}

export default function InsurerCataloguePage() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 760;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (query.trim().length < 2) { setError('Saisis au moins deux caractères pour rechercher.'); return; }
    setLoading(true);
    setError(null);
    try {
      setResults((await searchPublishedPrices(query.trim())).slice(0, 30));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Le catalogue n’est pas disponible.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <InsurerShell>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, compact && styles.pageCompact]}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>RÉFÉRENCES AUTOMOBILES · ESPACE ASSUREUR</Text>
          <Text style={styles.title}>Vérifie la pièce avant de valider le devis.</Text>
          <Text style={styles.heroText}>Les valeurs publiées sont des prix de référence. Elles ne remplacent pas une offre fournisseur, et une comparaison fiable exige la même pièce, la même unité et la même base fiscale.</Text>
        </View>
        <View style={[styles.searchRow, compact && styles.searchColumn]}>
          <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => { void search(); }} placeholder="Ex. filtre à huile, amortisseur, plaquette…" style={styles.input} returnKeyType="search" />
          <Pressable disabled={loading} onPress={() => { void search(); }} style={styles.button}>{loading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.buttonText}>Rechercher</Text>}</Pressable>
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
        {loading ? <View style={styles.empty}><ActivityIndicator color="#397FBD" /><Text style={styles.muted}>Recherche des références…</Text></View>
          : results.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Choisis une désignation précise</Text><Text style={styles.muted}>Les résultats afficheront la fourchette, l’édition source et l’unité de comparaison.</Text></View>
            : <View style={styles.grid}>{results.map((item) => {
              const product = productOf(item);
              const source = sourceOf(item);
              if (!product) return null;
              return <View key={item.id} style={styles.card}>
                <Text style={styles.product}>{product.name}</Text>
                <Text style={styles.meta}>{product.brand ?? 'Marque non indiquée'} · {unitOf(item)} · {item.tax_basis === 'unknown' ? 'base fiscale inconnue' : item.tax_basis}</Text>
                <View style={styles.priceGrid}><Price label="MINIMUM" value={money(item.li, item.currency)} /><Price label="MOYEN" value={money(item.pm, item.currency)} /><Price label="MAXIMUM" value={money(item.ls, item.currency)} /></View>
                <Text style={styles.source}>{source?.title ?? 'Répertoire de référence'} · édition {source?.edition ?? 'non précisée'}</Text>
                <Pressable onPress={() => router.push('/assureur/dossiers')} style={styles.compareLink}><Text style={styles.compareLinkText}>Comparer dans un dossier →</Text></Pressable>
              </View>;
            })}</View>}
      </ScrollView>
    </InsurerShell>
  );
}

function Price({ label, value }: { label: string; value: string }) {
  return <View style={styles.priceCell}><Text style={styles.priceLabel}>{label}</Text><Text style={styles.priceValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 }, page: { width: '100%', maxWidth: 1200, alignSelf: 'center', padding: 25, paddingBottom: 55 }, pageCompact: { padding: 13 },
  hero: { padding: 23, borderRadius: 17, backgroundColor: '#12385F' }, eyebrow: { color: '#80BBEA', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  title: { maxWidth: 720, marginTop: 9, color: '#FFF', fontSize: 25, lineHeight: 31, fontWeight: '800' }, heroText: { maxWidth: 780, marginTop: 8, color: '#D4E3EF', fontSize: 10, lineHeight: 16 },
  searchRow: { marginTop: 15, flexDirection: 'row', gap: 8 }, searchColumn: { flexDirection: 'column' },
  input: { flex: 1, minWidth: 0, minHeight: 41, paddingHorizontal: 11, borderWidth: 1, borderColor: '#DCE5EC', borderRadius: 9, backgroundColor: '#FFF', color: '#23425F', fontSize: 9 },
  button: { minHeight: 41, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#397FBD' }, buttonText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  error: { marginTop: 8, color: '#A14E47', fontSize: 9 }, grid: { marginTop: 11, flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  card: { flexGrow: 1, flexBasis: 300, maxWidth: 580, padding: 13, borderWidth: 1, borderColor: '#DFE8F0', borderRadius: 11, backgroundColor: '#FFF' },
  product: { color: '#193A59', fontSize: 11, fontWeight: '800' }, meta: { marginTop: 4, color: '#8291A0', fontSize: 8 },
  priceGrid: { marginTop: 10, flexDirection: 'row', gap: 6 }, priceCell: { flex: 1, padding: 8, borderRadius: 7, backgroundColor: '#F1F6FA' },
  priceLabel: { color: '#8091A0', fontSize: 7, fontWeight: '900' }, priceValue: { marginTop: 4, color: '#2E6FA8', fontSize: 9, fontWeight: '800' },
  source: { marginTop: 9, color: '#8493A0', fontSize: 8 }, compareLink: { alignSelf: 'flex-start', marginTop: 7, minHeight: 27, justifyContent: 'center' }, compareLinkText: { color: '#3479B6', fontSize: 8, fontWeight: '800' },
  empty: { minHeight: 170, marginTop: 11, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#E0E8F0', borderRadius: 11, backgroundColor: '#FFF' },
  emptyTitle: { color: '#193A59', fontSize: 11, fontWeight: '800' }, muted: { maxWidth: 450, color: '#7E8E9B', fontSize: 9, lineHeight: 15, textAlign: 'center' },
});
