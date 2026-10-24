import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { SupplierShell } from '@/components/SupplierShell';
import { AUTH_ENABLED } from '@/config/auth';
import { useAuth } from '@/hooks/useAuth';
import {
  createSupplierApplication,
  getSupplierApplications,
  getSupplierOffers,
  getSupplierProducts,
  getSupplierWorkspace,
  saveSupplierOffer,
  setSupplierOfferPaused,
  submitSupplierOffer,
  supplierAvailabilityLabel,
  supplierOfferStatusLabel,
  type SupplierApplication,
  type SupplierOffer,
  type SupplierOfferInput,
  type SupplierOfferView,
  type SupplierProduct,
  type SupplierWorkspace,
} from '@/lib/suppliers';

type ApplicationDraft = {
  organization_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  city: string;
  description: string;
  specialties: string;
  service_zones: string;
};

type OfferDraft = {
  product_id: string;
  brand: string;
  condition: string;
  quality: string;
  unit_price: string;
  currency: string;
  tax_basis: string;
  availability: string;
  stock_quantity: string;
  delivery_zone: string;
  delivery_fee: string;
  delivery_days_min: string;
  delivery_days_max: string;
  valid_until: string;
};

const EMPTY_APPLICATION: ApplicationDraft = {
  organization_name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  city: '',
  description: '',
  specialties: '',
  service_zones: '',
};

const EMPTY_OFFER: OfferDraft = {
  product_id: '',
  brand: '',
  condition: 'new',
  quality: 'equivalent',
  unit_price: '',
  currency: 'XOF',
  tax_basis: 'HT',
  availability: 'unknown',
  stock_quantity: '',
  delivery_zone: '',
  delivery_fee: '0',
  delivery_days_min: '',
  delivery_days_max: '',
  valid_until: '',
};

function parseNumber(value: string): number | null {
  const amount = Number(value.trim().replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
  return Number.isFinite(amount) ? amount : null;
}

function formatMoney(amount: number, currency = 'XOF') {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(amount) + ' ' + currency;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function toOptions(value: string): string[] {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

function csvList(values: string[]) {
  return values.length > 0 ? values.join(' · ') : 'À préciser';
}

function offerDraftFromOffer(offer: SupplierOffer): OfferDraft {
  return {
    product_id: offer.product_id,
    brand: offer.brand ?? '',
    condition: offer.condition,
    quality: offer.quality,
    unit_price: String(offer.unit_price),
    currency: offer.currency,
    tax_basis: offer.tax_basis,
    availability: offer.availability,
    stock_quantity: offer.stock_quantity === null ? '' : String(offer.stock_quantity),
    delivery_zone: offer.delivery_zone,
    delivery_fee: String(offer.delivery_fee),
    delivery_days_min: offer.delivery_days_min === null ? '' : String(offer.delivery_days_min),
    delivery_days_max: offer.delivery_days_max === null ? '' : String(offer.delivery_days_max),
    valid_until: offer.valid_until ?? '',
  };
}

export default function SuppliersPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 780;
  const { loading: authLoading, session } = useAuth();
  const [workspace, setWorkspace] = useState<SupplierWorkspace | null>(null);
  const [applications, setApplications] = useState<SupplierApplication[]>([]);
  const [offers, setOffers] = useState<SupplierOfferView[]>([]);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [applicationDraft, setApplicationDraft] = useState<ApplicationDraft>({
    ...EMPTY_APPLICATION,
  });
  const [offerDraft, setOfferDraft] = useState<OfferDraft>(EMPTY_OFFER);
  const [editingOffer, setEditingOffer] = useState<SupplierOffer | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pauseBusyId, setPauseBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (authLoading) return;
      if (!AUTH_ENABLED || !session) {
        if (active) setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage(null);
      try {
        const [nextWorkspace, nextApplications] = await Promise.all([
          getSupplierWorkspace(session.user.id),
          getSupplierApplications(session.user.id),
        ]);
        const nextOffers = nextWorkspace ? await getSupplierOffers(nextWorkspace.organization.id) : [];
        if (active) {
          setWorkspace(nextWorkspace);
          setApplications(nextApplications);
          setOffers(nextOffers);
        }
      } catch (error) {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Impossible de charger votre espace.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [authLoading, refreshKey, session]);

  const latestApplication = applications[0] ?? null;
  const visibleProducts = useMemo(() => {
    const term = productSearch.trim().toLocaleLowerCase('fr');
    if (!term) return products.slice(0, 12);
    return products.filter((product) => [
      product.name,
      product.brand,
      product.manufacturer_reference,
      product.unit_code,
    ].some((value) => value?.toLocaleLowerCase('fr').includes(term))).slice(0, 12);
  }, [productSearch, products]);

  async function openOfferForm(offer?: SupplierOfferView) {
    setErrorMessage(null);
    setFeedback(null);
    if (products.length === 0) {
      try {
        setProducts(await getSupplierProducts());
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Le catalogue est indisponible.');
        return;
      }
    }
    setEditingOffer(offer ?? null);
    setOfferDraft(offer ? offerDraftFromOffer(offer) : EMPTY_OFFER);
    setProductSearch('');
    setShowOfferForm(true);
  }

  async function sendApplication() {
    const required = [
      applicationDraft.organization_name,
      applicationDraft.contact_name,
      applicationDraft.contact_email || session?.user.email || '',
      applicationDraft.contact_phone,
      applicationDraft.city,
      applicationDraft.description,
    ];
    if (required.some((value) => !value.trim()) || applicationDraft.description.trim().length < 20) {
      setErrorMessage('Complète les champs requis et décris ton activité en 20 caractères minimum.');
      return;
    }
    const zones = toOptions(applicationDraft.service_zones);
    if (zones.length === 0) {
      setErrorMessage('Indique au moins une zone desservie.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const application = await createSupplierApplication({
        organization_name: applicationDraft.organization_name,
        contact_name: applicationDraft.contact_name,
        contact_email: applicationDraft.contact_email || session?.user.email || '',
        contact_phone: applicationDraft.contact_phone,
        city: applicationDraft.city,
        description: applicationDraft.description,
        specialties: toOptions(applicationDraft.specialties),
        service_zones: zones,
      });
      setApplications((current) => [application, ...current]);
      setFeedback('Ta demande est envoyée. Check donnera accès à l’espace fournisseur après vérification.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'La demande n’a pas pu être envoyée.');
    } finally {
      setSaving(false);
    }
  }

  function buildOfferInput(): SupplierOfferInput | null {
    const unitPrice = parseNumber(offerDraft.unit_price);
    const deliveryFee = parseNumber(offerDraft.delivery_fee);
    const stock = offerDraft.stock_quantity.trim() ? parseNumber(offerDraft.stock_quantity) : null;
    const minDays = offerDraft.delivery_days_min.trim() ? parseNumber(offerDraft.delivery_days_min) : null;
    const maxDays = offerDraft.delivery_days_max.trim() ? parseNumber(offerDraft.delivery_days_max) : null;
    const currency = offerDraft.currency.trim().toUpperCase();

    if (!offerDraft.product_id || unitPrice === null || unitPrice <= 0) {
      setErrorMessage('Choisis un produit Check et saisis un prix unitaire supérieur à zéro.');
      return null;
    }
    if (!currency.match(/^[A-Z]{3}$/) || !offerDraft.delivery_zone.trim() || deliveryFee === null || deliveryFee < 0) {
      setErrorMessage('Vérifie la devise, la zone desservie et les frais de livraison.');
      return null;
    }
    if (offerDraft.stock_quantity.trim() && stock === null) {
      setErrorMessage('Le stock doit être un nombre positif ou rester vide s’il est inconnu.');
      return null;
    }
    if ([minDays, maxDays].some((value) => value !== null && (value < 0 || !Number.isInteger(value)))) {
      setErrorMessage('Le délai doit être exprimé en jours entiers positifs.');
      return null;
    }
    if (minDays !== null && maxDays !== null && maxDays < minDays) {
      setErrorMessage('Le délai maximum doit être supérieur ou égal au délai minimum.');
      return null;
    }
    if (offerDraft.valid_until && !/^\d{4}-\d{2}-\d{2}$/.test(offerDraft.valid_until)) {
      setErrorMessage('La date de validité doit suivre le format AAAA-MM-JJ.');
      return null;
    }

    return {
      product_id: offerDraft.product_id,
      brand: offerDraft.brand.trim() || null,
      condition: offerDraft.condition,
      quality: offerDraft.quality,
      unit_price: unitPrice,
      currency,
      tax_basis: offerDraft.tax_basis,
      availability: offerDraft.availability,
      stock_quantity: stock,
      delivery_zone: offerDraft.delivery_zone.trim(),
      delivery_fee: deliveryFee,
      delivery_currency: currency,
      delivery_days_min: minDays,
      delivery_days_max: maxDays,
      valid_until: offerDraft.valid_until || null,
    };
  }

  async function saveOffer(submitForReview: boolean) {
    if (!workspace) return;
    const input = buildOfferInput();
    if (!input) return;

    setSaving(true);
    setErrorMessage(null);
    setFeedback(null);
    try {
      const offerId = await saveSupplierOffer(workspace.organization.id, input, editingOffer?.id);
      if (submitForReview && editingOffer?.status !== 'published') await submitSupplierOffer(offerId);
      setShowOfferForm(false);
      setEditingOffer(null);
      setOfferDraft(EMPTY_OFFER);
      setFeedback(submitForReview
        ? editingOffer?.status === 'published'
          ? 'Les informations sont enregistrées. Une modification du prix ou de la livraison a été envoyée en vérification.'
          : 'L’offre est envoyée à Check pour vérification.'
        : 'L’offre est enregistrée. Les modifications de prix et de livraison repassent en vérification.');
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'L’offre n’a pas pu être enregistrée.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleOfferPause(offer: SupplierOfferView) {
    const paused = offer.status === 'published';
    setPauseBusyId(offer.id);
    setErrorMessage(null);
    setFeedback(null);
    try {
      await setSupplierOfferPaused(offer.id, paused);
      setFeedback(paused
        ? 'L’offre est masquée du public.'
        : 'L’offre est renvoyée à Check pour une nouvelle vérification avant publication.');
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Le statut de l’offre n’a pas pu être modifié.');
    } finally {
      setPauseBusyId(null);
    }
  }

  const publishedCount = offers.filter((offer) => offer.status === 'published').length;
  const pendingCount = offers.filter((offer) => offer.status === 'pending_review').length;
  const editableOffer = editingOffer ? offers.find((offer) => offer.id === editingOffer.id) ?? null : null;
  const selectedProduct = products.find((product) => product.id === offerDraft.product_id);

  return (
    <SupplierShell>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, compact && styles.pageCompact]}>
        {loading || authLoading ? (
          <View style={styles.loadingState}><ActivityIndicator color="#7650B8" /><Text style={styles.loadingText}>Préparation de votre espace…</Text></View>
        ) : !AUTH_ENABLED ? (
          <InfoCard title="Espace fournisseur web" text="La gestion fournisseur est disponible dans la version web de Check pour le pilote." />
        ) : !session ? (
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeIcon}><Text style={styles.welcomeIconText}>↗</Text></View>
            <Text style={styles.eyebrow}>PARTENAIRES FOURNISSEURS</Text>
            <Text style={[styles.pageTitle, compact && styles.pageTitleCompact]}>Faites connaître vos offres.</Text>
            <Text style={styles.introText}>Connectez-vous avec votre compte Check pour présenter votre entreprise et publier des offres liées au catalogue vérifié.</Text>
            <PrimaryButton label="Se connecter" onPress={() => router.push('/sign-in')} />
          </View>
        ) : workspace ? (
          <>
            <View style={[styles.hero, compact && styles.heroCompact]}>
              <View style={styles.heroCopy}>
                <Text style={styles.eyebrow}>BONJOUR, {workspace.organization.name.toLocaleUpperCase('fr')}</Text>
                <Text style={[styles.pageTitle, styles.pageTitleOnHero, compact && styles.pageTitleCompact]}>Votre offre mérite d’être trouvée.</Text>
                <Text style={[styles.introText, styles.introTextOnHero]}>Reliez vos pièces aux références Check, indiquez un prix et des conditions de livraison. Chaque nouvelle offre est vérifiée avant sa mise en ligne.</Text>
              </View>
              <PrimaryButton label="+ Ajouter une offre" onPress={() => { void openOfferForm(); }} />
            </View>

            <View style={[styles.statsRow, compact && styles.statsRowCompact]}>
              <StatCard label="Mes offres" value={String(offers.length)} note="Toutes les offres de l’organisation" />
              <StatCard label="En ligne" value={String(publishedCount)} note="Visibles sur Check" />
              <StatCard label="En vérification" value={String(pendingCount)} note="En attente de revue" />
            </View>

            {feedback && <Notice tone="success" text={feedback} onClose={() => setFeedback(null)} />}
            {errorMessage && <Notice tone="error" text={errorMessage} onClose={() => setErrorMessage(null)} />}

            {showOfferForm && (
              <OfferEditor
                draft={offerDraft}
                update={(key, value) => setOfferDraft((current) => ({ ...current, [key]: value }))}
                products={visibleProducts}
                productSearch={productSearch}
                setProductSearch={setProductSearch}
                selectedProduct={selectedProduct}
                editing={editableOffer}
                saving={saving}
                onCancel={() => { setShowOfferForm(false); setEditingOffer(null); }}
                onSaveDraft={() => { void saveOffer(false); }}
                onSubmit={() => { void saveOffer(true); }}
              />
            )}

            <View style={styles.sectionHeader}>
              <View><Text style={styles.sectionTitle}>Mes offres</Text><Text style={styles.sectionSubtitle}>Le prix fournisseur reste distinct du prix de référence Check.</Text></View>
              <Pressable onPress={() => { void openOfferForm(); }} accessibilityRole="button" style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Nouvelle offre</Text></Pressable>
            </View>

            {offers.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyMark}>▦</Text>
                <Text style={styles.emptyTitle}>Votre catalogue commence ici.</Text>
                <Text style={styles.emptyText}>Ajoutez votre première offre à partir d’un produit validé dans le catalogue Check.</Text>
                <PrimaryButton label="Créer une offre" onPress={() => { void openOfferForm(); }} />
              </View>
            ) : (
              <View style={styles.offerList}>
                {offers.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    pauseBusy={pauseBusyId === offer.id}
                    onEdit={() => { void openOfferForm(offer); }}
                    onPause={() => { void toggleOfferPause(offer); }}
                  />
                ))}
              </View>
            )}
          </>
        ) : latestApplication?.status === 'pending' ? (
          <ApplicationStatusCard application={latestApplication} />
        ) : (
          <>
            <View style={styles.applicationIntro}>
              <Text style={styles.eyebrow}>REJOINDRE LE RÉSEAU CHECK</Text>
              <Text style={[styles.pageTitle, styles.pageTitleOnHero, compact && styles.pageTitleCompact]}>Présentez votre entreprise.</Text>
              <Text style={[styles.introText, styles.introTextOnHero]}>Check vérifie chaque partenaire avant d’ouvrir son espace fournisseur. Après validation, vous pourrez rattacher vos offres aux produits du catalogue et préciser le stock ainsi que la livraison.</Text>
            </View>
            {latestApplication?.status === 'rejected' && (
              <View style={styles.rejectionBox}>
                <Text style={styles.rejectionTitle}>La demande précédente nécessite une mise à jour.</Text>
                <Text style={styles.rejectionText}>{latestApplication.review_note ?? 'Complète les informations puis renvoie la demande.'}</Text>
              </View>
            )}
            {feedback && <Notice tone="success" text={feedback} onClose={() => setFeedback(null)} />}
            {errorMessage && <Notice tone="error" text={errorMessage} onClose={() => setErrorMessage(null)} />}
            <ApplicationForm
              draft={{ ...applicationDraft, contact_email: applicationDraft.contact_email || session?.user.email || '' }}
              update={(key, value) => setApplicationDraft((current) => ({ ...current, [key]: value }))}
              saving={saving}
              onSubmit={() => { void sendApplication(); }}
            />
          </>
        )}
        {errorMessage && (loading || authLoading) && <Notice tone="error" text={errorMessage} onClose={() => setErrorMessage(null)} />}
      </ScrollView>
    </SupplierShell>
  );
}

function ApplicationForm({
  draft,
  update,
  saving,
  onSubmit,
}: {
  draft: ApplicationDraft;
  update: (key: keyof ApplicationDraft, value: string) => void;
  saving: boolean;
  onSubmit: () => void;
}) {
  return (
    <View style={styles.formCard}>
      <Text style={styles.formTitle}>Informations de l’entreprise</Text>
      <Text style={styles.formSubtitle}>Les informations de contact sont consultées par Check pendant la validation.</Text>
      <View style={styles.formGrid}>
        <Field label="Nom de l’entreprise *" value={draft.organization_name} onChangeText={(value) => update('organization_name', value)} placeholder="Ex. Garage Central" />
        <Field label="Personne à contacter *" value={draft.contact_name} onChangeText={(value) => update('contact_name', value)} placeholder="Nom et prénom" />
        <Field label="E-mail professionnel *" value={draft.contact_email} onChangeText={(value) => update('contact_email', value)} placeholder="contact@entreprise.tg" keyboardType="email-address" />
        <Field label="Téléphone *" value={draft.contact_phone} onChangeText={(value) => update('contact_phone', value)} placeholder="+228…" keyboardType="phone-pad" />
        <Field label="Ville *" value={draft.city} onChangeText={(value) => update('city', value)} placeholder="Lomé" />
        <Field label="Spécialités" value={draft.specialties} onChangeText={(value) => update('specialties', value)} placeholder="Pièces moteur, freinage…" helper="Sépare les thèmes par des virgules." />
        <Field label="Zones desservies *" value={draft.service_zones} onChangeText={(value) => update('service_zones', value)} placeholder="Lomé, Tsévié…" helper="Sépare les zones par des virgules." />
        <Field label="Présentation *" value={draft.description} onChangeText={(value) => update('description', value)} placeholder="Décris les produits et services proposés…" multiline helper="20 caractères minimum." />
      </View>
      <View style={styles.formFooter}>
        <Text style={styles.formFootnote}>L’envoi d’une demande ne publie aucune offre.</Text>
        <PrimaryButton label={saving ? 'Envoi…' : 'Envoyer ma demande'} onPress={onSubmit} disabled={saving} />
      </View>
    </View>
  );
}

function OfferEditor({
  draft,
  update,
  products,
  productSearch,
  setProductSearch,
  selectedProduct,
  editing,
  saving,
  onCancel,
  onSaveDraft,
  onSubmit,
}: {
  draft: OfferDraft;
  update: (key: keyof OfferDraft, value: string) => void;
  products: SupplierProduct[];
  productSearch: string;
  setProductSearch: (value: string) => void;
  selectedProduct: SupplierProduct | undefined;
  editing: SupplierOfferView | null;
  saving: boolean;
  onCancel: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
}) {
  return (
    <View style={styles.formCard}>
      <View style={styles.editorHeader}>
        <View><Text style={styles.formTitle}>{editing ? 'Modifier une offre' : 'Nouvelle offre fournisseur'}</Text><Text style={styles.formSubtitle}>Choisis un produit Check validé pour garantir une comparaison claire.</Text></View>
        <Pressable onPress={onCancel} accessibilityRole="button" style={styles.closeButton}><Text style={styles.closeButtonText}>Fermer</Text></Pressable>
      </View>

      {editing?.status === 'published' && <Notice tone="info" text="Toute modification du prix, de la qualité ou de la livraison repasse en vérification. Le stock et la disponibilité peuvent être actualisés directement." />}

      <Text style={styles.fieldLabel}>Produit du catalogue *</Text>
      {selectedProduct ? (
        <Pressable onPress={() => { update('product_id', ''); setProductSearch(''); }} style={styles.selectedProduct}>
          <View style={styles.productGlyph}><Text style={styles.productGlyphText}>⚙</Text></View>
          <View style={styles.productCopy}><Text style={styles.productName}>{selectedProduct.name}</Text><Text style={styles.productMeta}>{selectedProduct.brand ?? 'Marque à préciser'} · {selectedProduct.unit_code}</Text></View>
          <Text style={styles.changeText}>Changer</Text>
        </Pressable>
      ) : (
        <>
          <TextInput value={productSearch} onChangeText={setProductSearch} placeholder="Rechercher une pièce…" placeholderTextColor="#AAA1B4" style={styles.input} />
          <View style={styles.productOptions}>
            {products.slice(0, 8).map((product) => (
              <Pressable key={product.id} onPress={() => update('product_id', product.id)} style={styles.productOption}>
                <Text style={styles.productOptionName}>{product.name}</Text>
                <Text style={styles.productOptionMeta}>{product.brand ?? 'Marque à préciser'} · {product.unit_code}</Text>
              </Pressable>
            ))}
            {products.length === 0 && <Text style={styles.helperText}>Aucun produit disponible. Vérifie que le catalogue est publié.</Text>}
          </View>
        </>
      )}

      <View style={styles.formGrid}>
        <Field label="Marque vendue" value={draft.brand} onChangeText={(value) => update('brand', value)} placeholder="Marque de la pièce" />
        <Field label="Prix unitaire *" value={draft.unit_price} onChangeText={(value) => update('unit_price', value)} placeholder="Ex. 18 500" keyboardType="decimal-pad" />
        <Field label="Devise *" value={draft.currency} onChangeText={(value) => update('currency', value.toUpperCase())} placeholder="XOF" autoCapitalize="characters" />
        <Field label="Stock disponible" value={draft.stock_quantity} onChangeText={(value) => update('stock_quantity', value)} placeholder="Quantité ou vide si inconnu" keyboardType="decimal-pad" />
        <Field label="Offre valable jusqu’au" value={draft.valid_until} onChangeText={(value) => update('valid_until', value)} placeholder="AAAA-MM-JJ" />
        <Field label="Zone de livraison *" value={draft.delivery_zone} onChangeText={(value) => update('delivery_zone', value)} placeholder="Ex. Grand Lomé" />
        <Field label="Frais de livraison *" value={draft.delivery_fee} onChangeText={(value) => update('delivery_fee', value)} placeholder="0 si offert" keyboardType="decimal-pad" />
        <Field label="Délai minimum (jours)" value={draft.delivery_days_min} onChangeText={(value) => update('delivery_days_min', value)} placeholder="Ex. 1" keyboardType="numeric" />
        <Field label="Délai maximum (jours)" value={draft.delivery_days_max} onChangeText={(value) => update('delivery_days_max', value)} placeholder="Ex. 3" keyboardType="numeric" />
      </View>

      <ChoiceRow label="État" value={draft.condition} options={[['new', 'Neuf'], ['reconditioned', 'Reconditionné'], ['used', 'Occasion']]} onChange={(value) => update('condition', value)} />
      <ChoiceRow label="Qualité" value={draft.quality} options={[['original', 'Origine'], ['equivalent', 'Équivalent'], ['reconditioned', 'Reconditionné'], ['used', 'Occasion']]} onChange={(value) => update('quality', value)} />
      <ChoiceRow label="Base fiscale" value={draft.tax_basis} options={[['HT', 'HT'], ['TTC', 'TTC'], ['unknown', 'Non précisée']]} onChange={(value) => update('tax_basis', value)} />
      <ChoiceRow label="Disponibilité" value={draft.availability} options={[['available', 'En stock'], ['on_order', 'Sur commande'], ['out_of_stock', 'Indisponible'], ['unknown', 'À confirmer']]} onChange={(value) => update('availability', value)} />

      <View style={styles.editorFooter}>
        <Text style={styles.formFootnote}>Le prix fournisseur n’est pas le prix de référence du répertoire.</Text>
        <View style={styles.editorActions}>
          <Pressable onPress={onCancel} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Annuler</Text></Pressable>
          <Pressable onPress={onSaveDraft} disabled={saving} style={[styles.secondaryButton, saving && styles.disabled]}><Text style={styles.secondaryButtonText}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Text></Pressable>
          <PrimaryButton label={saving ? 'Envoi…' : editing?.status === 'published' ? 'Enregistrer les changements' : 'Envoyer à Check'} onPress={onSubmit} disabled={saving || editing?.status === 'pending_review'} />
        </View>
      </View>
    </View>
  );
}

function OfferCard({ offer, onEdit, onPause, pauseBusy }: { offer: SupplierOfferView; onEdit: () => void; onPause: () => void; pauseBusy: boolean }) {
  const statusStyle = offer.status === 'published' ? styles.statusPublished : offer.status === 'pending_review' ? styles.statusPending : offer.status === 'rejected' ? styles.statusRejected : styles.statusDraft;
  const stockText = offer.stock_quantity === null ? 'Quantité non précisée' : String(offer.stock_quantity) + ' en stock';
  return (
    <View style={styles.offerCard}>
      <View style={styles.offerTop}>
        <View style={styles.offerProductCopy}>
          <Text style={styles.offerProduct}>{offer.product?.name ?? 'Produit du catalogue'}</Text>
          <Text style={styles.offerMeta}>{offer.product?.brand ?? offer.brand ?? 'Marque à préciser'} · {offer.product?.unit_code ?? 'unité'}</Text>
        </View>
        <View style={[styles.statusPill, statusStyle]}><Text style={styles.statusText}>{supplierOfferStatusLabel(offer.status)}</Text></View>
      </View>
      <View style={styles.offerDetails}>
        <View><Text style={styles.offerPrice}>{formatMoney(offer.unit_price, offer.currency)}</Text><Text style={styles.offerDetailLabel}>Prix unitaire · {offer.tax_basis === 'unknown' ? 'base non précisée' : offer.tax_basis}</Text></View>
        <View><Text style={styles.offerDetailValue}>{supplierAvailabilityLabel(offer.availability)}</Text><Text style={styles.offerDetailLabel}>{stockText}</Text></View>
        <View><Text style={styles.offerDetailValue}>{offer.delivery_zone}</Text><Text style={styles.offerDetailLabel}>Livraison · {formatMoney(offer.delivery_fee, offer.delivery_currency)}</Text></View>
      </View>
      {offer.reviewNote && <Text style={styles.reviewNote}>Retour de Check : {offer.reviewNote}</Text>}
      <View style={styles.offerBottom}>
        <Text style={styles.updatedText}>Vérifiée le {formatDate(offer.verified_at)}</Text>
        <View style={styles.offerActions}>
          {offer.status !== 'pending_review' && <Pressable onPress={onEdit} accessibilityRole="button" style={styles.editButton}><Text style={styles.editButtonText}>Modifier →</Text></Pressable>}
          {(offer.status === 'published' || offer.status === 'paused') && <Pressable onPress={onPause} disabled={pauseBusy} accessibilityRole="button" style={styles.editButton}><Text style={styles.pauseButtonText}>{pauseBusy ? 'Mise à jour…' : offer.status === 'published' ? 'Mettre en pause' : 'Réactiver · vérifier'}</Text></Pressable>}
        </View>
      </View>
    </View>
  );
}

function ApplicationStatusCard({ application }: { application: SupplierApplication }) {
  return (
    <View style={styles.statusPage}>
      <View style={styles.statusPageIcon}><Text style={styles.statusPageIconText}>✓</Text></View>
      <Text style={styles.eyebrow}>DEMANDE REÇUE</Text>
      <Text style={styles.pageTitle}>Nous vérifions votre entreprise.</Text>
      <Text style={styles.introText}>La demande de <Text style={styles.strong}>{application.organization_name}</Text> est en cours d’examen. L’accès fournisseur sera activé après validation par Check.</Text>
      <View style={styles.applicationSummary}>
        <SummaryRow label="Contact" value={application.contact_name} />
        <SummaryRow label="Ville" value={application.city} />
        <SummaryRow label="Spécialités" value={csvList(application.specialties)} />
        <SummaryRow label="Zones" value={csvList(application.service_zones)} />
        <SummaryRow label="Envoyée le" value={formatDate(application.created_at)} />
      </View>
      <View style={styles.pendingNotice}><Text style={styles.pendingNoticeTitle}>En attente de validation</Text><Text style={styles.pendingNoticeText}>Aucune offre n’est visible sur la plateforme pendant cette étape.</Text></View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  helper,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric' | 'decimal-pad';
  multiline?: boolean;
  helper?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#AAA1B4"
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        accessibilityLabel={label}
        style={[styles.input, multiline && styles.multilineInput]}
      />
      {helper && <Text style={styles.helperText}>{helper}</Text>}
    </View>
  );
}

function ChoiceRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.choiceRow}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.choiceOptions}>
        {options.map(([option, text]) => (
          <Pressable key={option} onPress={() => onChange(option)} style={[styles.choice, value === option && styles.choiceActive]}>
            <Text style={[styles.choiceText, value === option && styles.choiceTextActive]}>{text}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return <View style={styles.statCard}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text><Text style={styles.statNote}>{note}</Text></View>;
}

function Notice({ tone, text, onClose }: { tone: 'success' | 'error' | 'info'; text: string; onClose?: () => void }) {
  const style = tone === 'success' ? styles.noticeSuccess : tone === 'error' ? styles.noticeError : styles.noticeInfo;
  return <View style={[styles.notice, style]}><Text style={styles.noticeText}>{text}</Text>{onClose && <Pressable onPress={onClose}><Text style={styles.noticeClose}>×</Text></Pressable>}</View>;
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return <View style={styles.emptyCard}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{text}</Text></View>;
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, disabled && styles.disabled]}><Text style={styles.primaryButtonText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  page: { width: '100%', maxWidth: 1240, paddingHorizontal: 30, paddingTop: 28, paddingBottom: 60, alignSelf: 'center' },
  pageCompact: { paddingHorizontal: 16, paddingTop: 18 },
  loadingState: { minHeight: 360, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#91879F', fontSize: 12 },
  welcomeCard: { minHeight: 380, padding: 35, justifyContent: 'center', alignItems: 'flex-start', borderRadius: 21, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE5F1' },
  welcomeIcon: { width: 50, height: 50, marginBottom: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#F0E9FC' },
  welcomeIconText: { color: '#855BB8', fontSize: 24, fontWeight: '900' },
  hero: { minHeight: 235, padding: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 25, borderRadius: 21, backgroundColor: '#35234F', overflow: 'hidden' },
  heroCompact: { padding: 21, flexDirection: 'column', alignItems: 'stretch' },
  heroCopy: { flex: 1, maxWidth: 760 },
  eyebrow: { color: '#D0BAFF', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  pageTitle: { marginTop: 10, color: '#382750', fontSize: 37, lineHeight: 43, fontWeight: '800', letterSpacing: -1.2 },
  pageTitleOnHero: { color: '#FFFFFF' },
  pageTitleCompact: { fontSize: 30, lineHeight: 36 },
  introText: { maxWidth: 720, marginTop: 11, color: '#958AA2', fontSize: 12, lineHeight: 20 },
  introTextOnHero: { color: '#E9E1F4' },
  primaryButton: { minHeight: 44, paddingHorizontal: 17, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#B999EF' },
  primaryButtonText: { color: '#2A2040', fontSize: 11, fontWeight: '900' },
  secondaryButton: { minHeight: 39, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#F3EFF9' },
  secondaryButtonText: { color: '#694A91', fontSize: 10, fontWeight: '800' },
  statsRow: { marginTop: 17, flexDirection: 'row', gap: 12 },
  statsRowCompact: { flexDirection: 'column' },
  statCard: { flex: 1, minHeight: 106, padding: 16, borderWidth: 1, borderColor: '#EAE5F0', borderRadius: 14, backgroundColor: '#FFFFFF' },
  statLabel: { color: '#9A90A8', fontSize: 9, fontWeight: '800' },
  statValue: { marginTop: 6, color: '#382750', fontSize: 27, fontWeight: '900' },
  statNote: { marginTop: 3, color: '#ADA5B7', fontSize: 9 },
  sectionHeader: { marginTop: 32, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { color: '#3B2A53', fontSize: 19, fontWeight: '800' },
  sectionSubtitle: { marginTop: 5, color: '#A097AB', fontSize: 10 },
  offerList: { gap: 10 },
  offerCard: { padding: 18, borderWidth: 1, borderColor: '#E9E4EF', borderRadius: 15, backgroundColor: '#FFFFFF' },
  offerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  offerProductCopy: { flex: 1 },
  offerProduct: { color: '#403052', fontSize: 14, fontWeight: '800' },
  offerMeta: { marginTop: 4, color: '#A198AC', fontSize: 10 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 },
  statusPublished: { backgroundColor: '#E4F4EC' },
  statusPending: { backgroundColor: '#FFF2D9' },
  statusRejected: { backgroundColor: '#FCE7E5' },
  statusDraft: { backgroundColor: '#F1EEF5' },
  statusText: { color: '#64566F', fontSize: 9, fontWeight: '800' },
  offerDetails: { marginTop: 17, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F2EFF4', flexDirection: 'row', flexWrap: 'wrap', gap: 25 },
  offerPrice: { color: '#553577', fontSize: 16, fontWeight: '900' },
  offerDetailValue: { color: '#70617D', fontSize: 11, fontWeight: '800' },
  offerDetailLabel: { marginTop: 4, color: '#A79EAF', fontSize: 9 },
  reviewNote: { marginTop: 12, padding: 10, borderRadius: 9, backgroundColor: '#FFF6E9', color: '#8B6031', fontSize: 10, lineHeight: 16 },
  offerBottom: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  offerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  updatedText: { color: '#ADA5B7', fontSize: 9 },
  editButton: { minHeight: 30, paddingHorizontal: 9, justifyContent: 'center' },
  editButtonText: { color: '#8058BB', fontSize: 10, fontWeight: '800' },
  pauseButtonText: { color: '#8A6041', fontSize: 10, fontWeight: '800' },
  emptyCard: { marginTop: 12, minHeight: 225, padding: 25, alignItems: 'flex-start', justifyContent: 'center', borderWidth: 1, borderColor: '#EAE5F0', borderRadius: 16, backgroundColor: '#FFFFFF' },
  emptyMark: { color: '#9B78CF', fontSize: 25 },
  emptyTitle: { marginTop: 10, color: '#403052', fontSize: 16, fontWeight: '800' },
  emptyText: { maxWidth: 540, marginTop: 7, marginBottom: 17, color: '#9B91A9', fontSize: 11, lineHeight: 18 },
  applicationIntro: { padding: 27, borderRadius: 20, backgroundColor: '#35234F' },
  formCard: { marginTop: 16, padding: 22, borderWidth: 1, borderColor: '#E8E2EF', borderRadius: 17, backgroundColor: '#FFFFFF' },
  formTitle: { color: '#403052', fontSize: 16, fontWeight: '800' },
  formSubtitle: { marginTop: 5, marginBottom: 17, color: '#A097AB', fontSize: 10, lineHeight: 16 },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 13 },
  field: { flexGrow: 1, flexBasis: 270 },
  fieldLabel: { marginBottom: 6, color: '#786D84', fontSize: 9, fontWeight: '800' },
  input: { minHeight: 43, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E7E1ED', borderRadius: 10, backgroundColor: '#FEFDFE', color: '#403052', fontSize: 11 },
  multilineInput: { minHeight: 96, paddingTop: 11, textAlignVertical: 'top' },
  helperText: { marginTop: 5, color: '#ADA5B7', fontSize: 9 },
  formFooter: { marginTop: 19, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F0EDF3', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  formFootnote: { flex: 1, color: '#A198AC', fontSize: 9, lineHeight: 14 },
  rejectionBox: { marginTop: 14, padding: 15, borderRadius: 12, backgroundColor: '#FFF3E4' },
  rejectionTitle: { color: '#865723', fontSize: 11, fontWeight: '800' },
  rejectionText: { marginTop: 5, color: '#97754B', fontSize: 10 },
  editorHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  closeButton: { padding: 7, alignSelf: 'flex-start' },
  closeButtonText: { color: '#8B819B', fontSize: 10, fontWeight: '700' },
  selectedProduct: { minHeight: 62, marginBottom: 13, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 11, backgroundColor: '#F5F1FB' },
  productGlyph: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#EEE6FC' },
  productGlyphText: { color: '#8B62BD', fontSize: 18 },
  productCopy: { flex: 1 },
  productName: { color: '#4A385F', fontSize: 11, fontWeight: '800' },
  productMeta: { marginTop: 4, color: '#9C93AA', fontSize: 9 },
  changeText: { color: '#7B55B1', fontSize: 9, fontWeight: '800' },
  productOptions: { maxHeight: 220, marginBottom: 15, borderWidth: 1, borderColor: '#E8E3EF', borderRadius: 10, overflow: 'hidden' },
  productOption: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F2EFF4' },
  productOptionName: { color: '#544262', fontSize: 10, fontWeight: '700' },
  productOptionMeta: { marginTop: 3, color: '#A69DAF', fontSize: 8 },
  choiceRow: { marginTop: 13 },
  choiceLabel: { marginBottom: 7, color: '#786D84', fontSize: 9, fontWeight: '800' },
  choiceOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choice: { minHeight: 31, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E7E0EF', borderRadius: 99, backgroundColor: '#FFFFFF' },
  choiceActive: { borderColor: '#A282D1', backgroundColor: '#F3ECFC' },
  choiceText: { color: '#958BA3', fontSize: 9, fontWeight: '700' },
  choiceTextActive: { color: '#6B48A0' },
  editorFooter: { marginTop: 19, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F0EDF3', gap: 12 },
  editorActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  notice: { marginTop: 13, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 10 },
  noticeSuccess: { backgroundColor: '#E9F6EF' },
  noticeError: { backgroundColor: '#FDECEB' },
  noticeInfo: { backgroundColor: '#F3EFF9' },
  noticeText: { flex: 1, color: '#7C7188', fontSize: 10, lineHeight: 16 },
  noticeClose: { color: '#7C7188', fontSize: 18, fontWeight: '700' },
  statusPage: { maxWidth: 770, marginTop: 28, padding: 30, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE5F1' },
  statusPageIcon: { width: 43, height: 43, marginBottom: 17, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#E8F6EF' },
  statusPageIconText: { color: '#328B62', fontSize: 20, fontWeight: '900' },
  strong: { color: '#403052', fontWeight: '800' },
  applicationSummary: { marginTop: 20, padding: 15, borderRadius: 13, backgroundColor: '#F8F6FA', gap: 12 },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryLabel: { width: 100, color: '#A198AC', fontSize: 9 },
  summaryValue: { flex: 1, color: '#786A85', fontSize: 10, fontWeight: '700' },
  pendingNotice: { marginTop: 15, padding: 14, borderRadius: 11, backgroundColor: '#FFF5E2' },
  pendingNoticeTitle: { color: '#885C28', fontSize: 10, fontWeight: '900' },
  pendingNoticeText: { marginTop: 4, color: '#9A7B51', fontSize: 9 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
});
