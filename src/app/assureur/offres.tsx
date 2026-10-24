import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { InsurerShell } from '@/components/InsurerShell';
import { getPublishedSupplierOffers, supplierAvailabilityLabel, type SupplierOfferView } from '@/lib/suppliers';

function money(value: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value) + ' ' + currency;
}

export default function InsurerOffersPage() {
  const compact = useWindowDimensions().width < 760;
  const [offers, setOffers] = useState<SupplierOfferView[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getPublishedSupplierOffers()
      .then((data) => { if (active) setOffers(data); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Les offres ne sont pas disponibles.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('fr');
    if (!term) return offers;
    return offers.filter((offer) => [offer.product?.name, offer.product?.brand, offer.product?.manufacturer_reference, offer.supplierName, offer.delivery_zone].some((value) => value?.toLocaleLowerCase('fr').includes(term)));
  }, [offers, query]);

  return (
    <InsurerShell>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, compact && styles.pageCompact]}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>OFFRES PARTENAIRES · ESPACE ASSUREUR</Text>
          <Text style={styles.title}>Une option vérifiée après la comparaison.</Text>
          <Text style={styles.heroText}>Consulte les prix fournisseurs et les frais de livraison pour repérer une solution moins coûteuse. La commande et le paiement restent entre l’assureur et le concessionnaire.</Text>
        </View>
        <View style={styles.toolbar}>
          <TextInput value={query} onChangeText={setQuery} placeholder="Pièce, marque, fournisseur ou zone…" style={styles.input} />
          <Text style={styles.count}>{visible.length} offre{visible.length === 1 ? '' : 's'}</Text>
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
        {loading ? <View style={styles.empty}><ActivityIndicator color="#397FBD" /><Text style={styles.muted}>Chargement des offres vérifiées…</Text></View>
          : !visible.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>{offers.length ? 'Aucune offre correspondante' : 'Les premières offres arrivent'}</Text><Text style={styles.muted}>Les offres approuvées apparaîtront ici avec leur prix, leur disponibilité et leur zone.</Text></View>
            : <View style={styles.grid}>{visible.map((offer) => <View key={offer.id} style={styles.card}>
              <View style={styles.badge}><Text style={styles.badgeText}>✓ OFFRE VALIDÉE</Text></View>
              <Text style={styles.product}>{offer.product?.name ?? 'Pièce automobile'}</Text>
              <Text style={styles.meta}>{offer.product?.brand ?? offer.brand ?? 'Marque non précisée'} · {offer.product?.unit_code ?? 'unité'}</Text>
              <View style={styles.priceRow}><Text style={styles.price}>{money(offer.unit_price, offer.currency)}</Text><Text style={styles.tax}>{offer.tax_basis === 'unknown' ? 'Base à confirmer' : offer.tax_basis}</Text></View>
              <View style={styles.info}><Text style={styles.supplier}>{offer.supplierName}</Text><Text style={styles.meta}>{supplierAvailabilityLabel(offer.availability)} · {offer.delivery_zone}</Text><Text style={styles.meta}>Livraison : {money(offer.delivery_fee, offer.delivery_currency)}</Text></View>
              <Text style={styles.verified}>Stock confirmé le {new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(offer.verified_at))}</Text>
            </View>)}</View>}
      </ScrollView>
    </InsurerShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 }, page: { width: '100%', maxWidth: 1200, alignSelf: 'center', padding: 25, paddingBottom: 55 }, pageCompact: { padding: 13 },
  hero: { padding: 23, borderRadius: 17, backgroundColor: '#12385F' }, eyebrow: { color: '#80BBEA', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  title: { maxWidth: 730, marginTop: 9, color: '#FFF', fontSize: 25, lineHeight: 31, fontWeight: '800' }, heroText: { maxWidth: 780, marginTop: 8, color: '#D4E3EF', fontSize: 10, lineHeight: 16 },
  toolbar: { marginTop: 15, marginBottom: 11, flexDirection: 'row', alignItems: 'center', gap: 10 }, input: { flex: 1, minHeight: 40, paddingHorizontal: 11, borderWidth: 1, borderColor: '#DCE5EC', borderRadius: 9, backgroundColor: '#FFF', color: '#23425F', fontSize: 9 },
  count: { color: '#487294', fontSize: 9, fontWeight: '800' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { flexGrow: 1, flexBasis: 290, maxWidth: 580, padding: 14, borderWidth: 1, borderColor: '#DFE8F0', borderRadius: 12, backgroundColor: '#FFF' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 99, backgroundColor: '#EAF5EF' }, badgeText: { color: '#347456', fontSize: 7, fontWeight: '900' },
  product: { marginTop: 9, color: '#193A59', fontSize: 12, fontWeight: '800' }, meta: { marginTop: 4, color: '#8291A0', fontSize: 8 },
  priceRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, price: { color: '#2D6FA8', fontSize: 16, fontWeight: '900' },
  tax: { color: '#60798E', fontSize: 8, fontWeight: '800' }, info: { marginTop: 11, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#EAF0F4' },
  supplier: { color: '#345A78', fontSize: 9, fontWeight: '800' }, verified: { marginTop: 9, color: '#8795A1', fontSize: 7 },
  empty: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: '#E0E8F0', borderRadius: 12, backgroundColor: '#FFF' },
  emptyTitle: { color: '#193A59', fontSize: 12, fontWeight: '800' }, muted: { maxWidth: 440, marginTop: 5, color: '#7E8E9B', fontSize: 9, lineHeight: 15, textAlign: 'center' },
  error: { marginBottom: 10, color: '#A14E47', fontSize: 9 },
});
