import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { AppShell } from '@/components/AppShell';
import { getPublishedSupplierOffers, supplierAvailabilityLabel, type SupplierOfferView } from '@/lib/suppliers';

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(amount) + ' ' + currency;
}

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
}

export default function PartnerOffersPage() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 760;
  const [offers, setOffers] = useState<SupplierOfferView[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getPublishedSupplierOffers()
      .then((result) => { if (active) setOffers(result); })
      .catch((error: unknown) => {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Les offres partenaires ne sont pas disponibles.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visibleOffers = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('fr');
    if (!term) return offers;
    return offers.filter((offer) => [
      offer.product?.name,
      offer.product?.brand,
      offer.product?.manufacturer_reference,
      offer.supplierName,
      offer.delivery_zone,
    ].some((value) => value?.toLocaleLowerCase('fr').includes(term)));
  }, [offers, query]);

  return (
    <AppShell>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, compact && styles.pageCompact]}>
        <View style={[styles.hero, compact && styles.heroCompact]}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>OFFRES FOURNISSEURS · PRIX COMMERCIAUX</Text>
            <Text style={[styles.title, compact && styles.titleCompact]}>Les bonnes pièces, avec des conditions claires.</Text>
            <Text style={styles.subtitle}>Chaque offre est reliée à une référence du catalogue, avec son prix, sa disponibilité et sa zone de livraison.</Text>
          </View>
          <Pressable onPress={() => router.push('/fournisseurs')} accessibilityRole="link" style={styles.partnerButton}>
            <Text style={styles.partnerButtonText}>Espace fournisseur ↗</Text>
          </Pressable>
        </View>

        <View style={[styles.toolbar, compact && styles.toolbarCompact]}>
          <TextInput value={query} onChangeText={setQuery} placeholder="Rechercher une pièce, une marque ou une zone…" placeholderTextColor="#89958E" style={styles.searchInput} />
          <View style={styles.resultCount}><Text style={styles.resultCountText}>{visibleOffers.length} offre{visibleOffers.length === 1 ? '' : 's'}</Text></View>
        </View>

        {errorMessage && <View style={styles.errorBox}><Text style={styles.errorText}>{errorMessage}</Text></View>}
        {loading ? (
          <View style={styles.empty}><ActivityIndicator color="#3B7550" /><Text style={styles.emptyText}>Chargement des offres partenaires…</Text></View>
        ) : visibleOffers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyMark}>⌕</Text>
            <Text style={styles.emptyTitle}>{offers.length === 0 ? 'Les premières offres arrivent.' : 'Aucune offre ne correspond.'}</Text>
            <Text style={styles.emptyText}>{offers.length === 0 ? 'Les fournisseurs partenaires apparaîtront ici après validation de leurs prix et de leurs conditions.' : 'Essaie une autre désignation ou une autre zone.'}</Text>
            {offers.length === 0 && <Pressable onPress={() => router.push('/catalogue')} style={styles.linkButton}><Text style={styles.linkButtonText}>Consulter les prix de référence →</Text></Pressable>}
          </View>
        ) : (
          <View style={[styles.grid, compact && styles.gridCompact]}>
            {visibleOffers.map((offer) => (
              <View key={offer.id} style={styles.card}>
                <View style={styles.cardImage}>
                  <View style={styles.imageHalo}><Text style={styles.imageSymbol}>⚙</Text></View>
                  <View style={styles.verifiedBadge}><Text style={styles.verifiedBadgeText}>✓ OFFRE VÉRIFIÉE</Text></View>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.productName}>{offer.product?.name ?? 'Pièce automobile'}</Text>
                  <Text style={styles.productMeta}>{offer.product?.brand ?? offer.brand ?? 'Marque à préciser'} · {offer.product?.unit_code ?? 'unité'}</Text>
                  <View style={styles.priceLine}><Text style={styles.price}>{money(offer.unit_price, offer.currency)}</Text><Text style={styles.basis}>{offer.tax_basis === 'unknown' ? 'Base non précisée' : offer.tax_basis}</Text></View>
                  <View style={styles.supplierLine}><Text style={styles.supplierLabel}>FOURNISSEUR</Text><Text style={styles.supplierName}>{offer.supplierName}</Text></View>
                  <View style={styles.deliveryPanel}>
                    <View><Text style={styles.deliveryTitle}>{offer.delivery_zone}</Text><Text style={styles.deliveryCaption}>Livraison · {money(offer.delivery_fee, offer.delivery_currency)}</Text></View>
                    <View style={styles.deliveryRight}><Text style={styles.availability}>{supplierAvailabilityLabel(offer.availability)}</Text><Text style={styles.deliveryCaption}>{offer.delivery_days_min === null ? 'Délai à confirmer' : offer.delivery_days_min + '–' + (offer.delivery_days_max ?? offer.delivery_days_min) + ' jours'}</Text></View>
                  </View>
                  <Text style={styles.updated}>Prix et stock confirmés le {date(offer.verified_at)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  page: { width: '100%', maxWidth: 1230, paddingHorizontal: 30, paddingTop: 27, paddingBottom: 55, alignSelf: 'center' },
  pageCompact: { paddingHorizontal: 15, paddingTop: 16 },
  hero: { minHeight: 205, padding: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18, borderRadius: 19, backgroundColor: '#183D33' },
  heroCompact: { alignItems: 'flex-start', flexDirection: 'column', padding: 21 },
  heroCopy: { flex: 1, maxWidth: 730 },
  eyebrow: { color: '#E8A273', fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  title: { marginTop: 10, color: '#FFFFFF', fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.8 },
  titleCompact: { fontSize: 26, lineHeight: 32 },
  subtitle: { maxWidth: 650, marginTop: 9, color: '#D4E1D8', fontSize: 11, lineHeight: 18 },
  partnerButton: { minHeight: 41, paddingHorizontal: 13, justifyContent: 'center', borderRadius: 10, backgroundColor: '#2A5443' },
  partnerButtonText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  toolbar: { marginTop: 20, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  toolbarCompact: { alignItems: 'stretch', flexDirection: 'column' },
  searchInput: { flex: 1, minHeight: 45, paddingHorizontal: 14, borderWidth: 1, borderColor: '#DEE6DF', borderRadius: 11, backgroundColor: '#FFFFFF', color: '#263E32', fontSize: 11 },
  resultCount: { minHeight: 36, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 99, backgroundColor: '#EAF0EA' },
  resultCountText: { color: '#52705B', fontSize: 9, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  gridCompact: { flexDirection: 'column' },
  card: { flexGrow: 1, flexBasis: 320, maxWidth: 600, overflow: 'hidden', borderWidth: 1, borderColor: '#E3EAE3', borderRadius: 15, backgroundColor: '#FFFFFF' },
  cardImage: { height: 112, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF3EE' },
  imageHalo: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: '#FFFFFF', shadowColor: '#183D33', shadowOpacity: .11, shadowRadius: 18, shadowOffset: { width: 0, height: 7 } },
  imageSymbol: { color: '#4C825B', fontSize: 32 },
  verifiedBadge: { position: 'absolute', top: 11, right: 11, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99, backgroundColor: '#FFFFFF' },
  verifiedBadgeText: { color: '#4D7F58', fontSize: 7, fontWeight: '900', letterSpacing: .5 },
  cardBody: { padding: 15 },
  productName: { color: '#253C30', fontSize: 13, fontWeight: '800' },
  productMeta: { marginTop: 4, color: '#87938A', fontSize: 9 },
  priceLine: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { color: '#235A38', fontSize: 19, fontWeight: '900' },
  basis: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99, backgroundColor: '#F0F4EF', color: '#738277', fontSize: 8, fontWeight: '800' },
  supplierLine: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF1ED' },
  supplierLabel: { color: '#9AA49C', fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  supplierName: { marginTop: 4, color: '#486150', fontSize: 10, fontWeight: '800' },
  deliveryPanel: { marginTop: 12, padding: 11, flexDirection: 'row', justifyContent: 'space-between', gap: 10, borderRadius: 10, backgroundColor: '#F6F8F5' },
  deliveryTitle: { color: '#4D6654', fontSize: 9, fontWeight: '800' },
  deliveryCaption: { marginTop: 4, color: '#88948A', fontSize: 8 },
  deliveryRight: { alignItems: 'flex-end' },
  availability: { color: '#43805B', fontSize: 9, fontWeight: '800' },
  updated: { marginTop: 11, color: '#A0AAA1', fontSize: 8 },
  empty: { minHeight: 220, padding: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E4EAE4', borderRadius: 15, backgroundColor: '#FFFFFF' },
  emptyMark: { color: '#6A9771', fontSize: 28 },
  emptyTitle: { marginTop: 7, color: '#284334', fontSize: 15, fontWeight: '800' },
  emptyText: { maxWidth: 460, marginTop: 6, marginBottom: 13, color: '#849087', fontSize: 10, lineHeight: 16, textAlign: 'center' },
  linkButton: { minHeight: 34, paddingHorizontal: 10, justifyContent: 'center' },
  linkButtonText: { color: '#477550', fontSize: 9, fontWeight: '800' },
  errorBox: { marginBottom: 12, padding: 11, borderRadius: 9, backgroundColor: '#FCEAE7' },
  errorText: { color: '#945348', fontSize: 10 },
});
