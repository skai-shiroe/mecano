import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { AppShell } from '@/components/AppShell';
import { AUTH_ENABLED } from '@/config/auth';
import { useAuth } from '@/hooks/useAuth';
import { canManageCatalogPrices } from '@/lib/catalog';
import {
  getPendingSupplierApplications,
  getPendingSupplierOffers,
  reviewSupplierApplication,
  reviewSupplierOffer,
  type SupplierApplication,
  type SupplierOfferView,
} from '@/lib/suppliers';

type AccessState = 'checking' | 'allowed' | 'sign-in' | 'denied' | 'error';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function amount(value: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value) + ' ' + currency;
}

export default function AdminSuppliersScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const { loading: authLoading, session } = useAuth();
  const [accessResult, setAccessResult] = useState<{ userId: string; access: Exclude<AccessState, 'checking' | 'sign-in'>; error: string | null } | null>(null);
  const access: AccessState = authLoading
    ? 'checking'
    : !AUTH_ENABLED
      ? 'denied'
      : !session
        ? 'sign-in'
        : accessResult && accessResult.userId === session.user.id
          ? accessResult.access
          : 'checking';
  const accessError = accessResult && accessResult.userId === session?.user.id ? accessResult.error : null;
  const [applications, setApplications] = useState<SupplierApplication[]>([]);
  const [offers, setOffers] = useState<SupplierOfferView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!AUTH_ENABLED || authLoading || !session) return;
    let active = true;
    const userId = session.user.id;
    void canManageCatalogPrices()
      .then((allowed) => {
        if (active) setAccessResult({ userId, access: allowed ? 'allowed' : 'denied', error: null });
      })
      .catch((error: unknown) => {
        if (active) setAccessResult({
          userId,
          access: 'error',
          error: error instanceof Error ? error.message : 'Vérification des droits impossible.',
        });
      });
    return () => { active = false; };
  }, [authLoading, session]);

  useEffect(() => {
    let active = true;
    if (access !== 'allowed') return () => { active = false; };

    Promise.all([getPendingSupplierApplications(), getPendingSupplierOffers()])
      .then(([nextApplications, nextOffers]) => {
        if (active) {
          setApplications(nextApplications);
          setOffers(nextOffers);
        }
      })
      .catch((error: unknown) => {
        if (active) setActionError(error instanceof Error ? error.message : 'Impossible de charger la revue fournisseur.');
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [access, refreshKey]);

  async function decideApplication(application: SupplierApplication, approved: boolean) {
    const note = (notes[application.id] ?? '').trim();
    if (!approved && note.length < 5) {
      setActionError('Ajoute une raison d’au moins 5 caractères pour refuser une demande.');
      return;
    }
    setBusyId(application.id);
    setActionError(null);
    setFeedback(null);
    try {
      await reviewSupplierApplication(application.id, approved, note || null);
      setFeedback(approved
        ? 'Fournisseur validé : son organisation et son accès responsable sont créés.'
        : 'La demande fournisseur est refusée avec la raison indiquée.');
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'La décision n’a pas pu être enregistrée.');
    } finally {
      setBusyId(null);
    }
  }

  async function decideOffer(offer: SupplierOfferView, approved: boolean) {
    const note = (notes[offer.id] ?? '').trim();
    if (!approved && note.length < 5) {
      setActionError('Ajoute une raison d’au moins 5 caractères pour refuser une offre.');
      return;
    }
    setBusyId(offer.id);
    setActionError(null);
    setFeedback(null);
    try {
      await reviewSupplierOffer(offer.id, approved, note || null);
      setFeedback(approved
        ? 'L’offre est publiée et devient visible dans les offres partenaires.'
        : 'L’offre est refusée et reste masquée du catalogue public.');
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'La décision n’a pas pu être enregistrée.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, compact && styles.pageCompact]}>
        <View style={[styles.header, compact && styles.headerCompact]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ADMINISTRATION · PARTENAIRES</Text>
            <Text style={[styles.title, compact && styles.titleCompact]}>Revue des fournisseurs</Text>
            <Text style={styles.subtitle}>Valide les entreprises partenaires et vérifie chaque offre avant son affichage public.</Text>
          </View>
          <Pressable onPress={() => router.push('/fournisseurs')} style={styles.portalButton}><Text style={styles.portalButtonText}>Voir le portail →</Text></Pressable>
        </View>

        {authLoading || access === 'checking' ? (
          <View style={styles.messageCard}><ActivityIndicator color="#2D7550" /><Text style={styles.messageText}>Vérification de l’accès administrateur…</Text></View>
        ) : access === 'sign-in' ? (
          <View style={styles.messageCard}><Text style={styles.messageTitle}>Connexion requise</Text><Text style={styles.messageText}>Connecte-toi avec le compte administrateur pour examiner les demandes et les offres.</Text><Pressable onPress={() => router.push('/sign-in')} style={styles.actionButton}><Text style={styles.actionButtonText}>Se connecter</Text></Pressable></View>
        ) : access === 'denied' || access === 'error' || !AUTH_ENABLED ? (
          <View style={styles.messageCard}><Text style={styles.messageTitle}>Accès réservé</Text><Text style={styles.messageText}>{accessError ?? 'Ce compte ne possède pas les droits d’administration du catalogue.'}</Text></View>
        ) : (
          <>
            {feedback && <View style={styles.feedback}><Text style={styles.feedbackText}>{feedback}</Text></View>}
            {actionError && <View style={styles.error}><Text style={styles.errorText}>{actionError}</Text></View>}

            <View style={[styles.statsRow, compact && styles.statsRowCompact]}>
              <Stat value={String(applications.length)} label="Demandes à examiner" />
              <Stat value={String(offers.length)} label="Offres à valider" />
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Demandes d’adhésion</Text><Text style={styles.sectionCaption}>L’approbation crée l’organisation fournisseur et donne le rôle responsable au demandeur.</Text></View><Text style={styles.count}>{applications.length}</Text></View>
              {loading ? <Loading text="Chargement des demandes…" /> : applications.length === 0 ? <Empty text="Aucune demande fournisseur en attente." /> : (
                <View style={styles.list}>
                  {applications.map((application) => <ApplicationCard
                    key={application.id}
                    application={application}
                    note={notes[application.id] ?? ''}
                    busy={busyId === application.id}
                    onNote={(value) => setNotes((current) => ({ ...current, [application.id]: value }))}
                    onApprove={() => { void decideApplication(application, true); }}
                    onReject={() => { void decideApplication(application, false); }}
                  />)}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Offres à vérifier</Text><Text style={styles.sectionCaption}>Les produits doivent correspondre au catalogue ; prix, qualité et livraison deviennent publics après approbation.</Text></View><Text style={styles.count}>{offers.length}</Text></View>
              {loading ? <Loading text="Chargement des offres…" /> : offers.length === 0 ? <Empty text="Aucune offre à valider." /> : (
                <View style={styles.list}>
                  {offers.map((offer) => <OfferReviewCard
                    key={offer.id}
                    offer={offer}
                    note={notes[offer.id] ?? ''}
                    busy={busyId === offer.id}
                    onNote={(value) => setNotes((current) => ({ ...current, [offer.id]: value }))}
                    onApprove={() => { void decideOffer(offer, true); }}
                    onReject={() => { void decideOffer(offer, false); }}
                  />)}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

function ApplicationCard({
  application,
  note,
  busy,
  onNote,
  onApprove,
  onReject,
}: {
  application: SupplierApplication;
  note: string;
  busy: boolean;
  onNote: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardCopy}><Text style={styles.cardTitle}>{application.organization_name}</Text><Text style={styles.cardMeta}>{application.city} · envoyée le {formatDate(application.created_at)}</Text></View>
        <View style={styles.pendingPill}><Text style={styles.pendingText}>À examiner</Text></View>
      </View>
      <Text style={styles.description}>{application.description}</Text>
      <View style={styles.detailsGrid}>
        <Detail label="Contact" value={application.contact_name} />
        <Detail label="E-mail" value={application.contact_email} />
        <Detail label="Téléphone" value={application.contact_phone} />
        <Detail label="Spécialités" value={application.specialties.join(' · ') || 'À préciser'} />
        <Detail label="Zones desservies" value={application.service_zones.join(' · ')} />
      </View>
      <Text style={styles.fieldLabel}>Note administrative (requise pour un refus)</Text>
      <TextInput value={note} onChangeText={onNote} placeholder="Raison du refus ou note de validation…" placeholderTextColor="#95A198" multiline style={styles.noteInput} />
      <View style={styles.actions}>
        <Pressable onPress={onReject} disabled={busy} style={[styles.rejectButton, busy && styles.disabled]}><Text style={styles.rejectText}>{busy ? 'Traitement…' : 'Refuser'}</Text></Pressable>
        <Pressable onPress={onApprove} disabled={busy} style={[styles.approveButton, busy && styles.disabled]}><Text style={styles.approveText}>Valider l’entreprise</Text></Pressable>
      </View>
    </View>
  );
}

function OfferReviewCard({
  offer,
  note,
  busy,
  onNote,
  onApprove,
  onReject,
}: {
  offer: SupplierOfferView;
  note: string;
  busy: boolean;
  onNote: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardCopy}><Text style={styles.cardTitle}>{offer.product?.name ?? 'Produit retiré du catalogue'}</Text><Text style={styles.cardMeta}>{offer.supplierName} · {offer.product?.unit_code ?? 'unité'}</Text></View>
        <View style={styles.pendingPill}><Text style={styles.pendingText}>À valider</Text></View>
      </View>
      <View style={styles.detailsGrid}>
        <Detail label="Prix" value={amount(offer.unit_price, offer.currency) + ' · ' + offer.tax_basis} />
        <Detail label="Qualité" value={offer.quality + ' · ' + offer.condition} />
        <Detail label="Stock" value={offer.availability + (offer.stock_quantity === null ? '' : ' · ' + offer.stock_quantity)} />
        <Detail label="Livraison" value={offer.delivery_zone + ' · ' + amount(offer.delivery_fee, offer.delivery_currency)} />
        <Detail label="Délai" value={offer.delivery_days_min === null ? 'Non précisé' : offer.delivery_days_min + '–' + (offer.delivery_days_max ?? offer.delivery_days_min) + ' jours'} />
      </View>
      <Text style={styles.fieldLabel}>Note administrative (requise pour un refus)</Text>
      <TextInput value={note} onChangeText={onNote} placeholder="Raison du refus ou note de validation…" placeholderTextColor="#95A198" multiline style={styles.noteInput} />
      <View style={styles.actions}>
        <Pressable onPress={onReject} disabled={busy} style={[styles.rejectButton, busy && styles.disabled]}><Text style={styles.rejectText}>{busy ? 'Traitement…' : 'Refuser l’offre'}</Text></Pressable>
        <Pressable onPress={onApprove} disabled={busy} style={[styles.approveButton, busy && styles.disabled]}><Text style={styles.approveText}>Publier l’offre</Text></Pressable>
      </View>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <View style={styles.statCard}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function Loading({ text }: { text: string }) {
  return <View style={styles.empty}><ActivityIndicator color="#397A54" /><Text style={styles.emptyText}>{text}</Text></View>;
}

function Empty({ text }: { text: string }) {
  return <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  page: { width: '100%', maxWidth: 1200, paddingHorizontal: 28, paddingTop: 28, paddingBottom: 60, alignSelf: 'center' },
  pageCompact: { paddingHorizontal: 15, paddingTop: 17 },
  header: { marginBottom: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 15 },
  headerCompact: { alignItems: 'flex-start', flexDirection: 'column' },
  headerCopy: { maxWidth: 750 },
  eyebrow: { color: '#C3794E', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  title: { marginTop: 8, color: '#1D382E', fontSize: 31, lineHeight: 38, fontWeight: '800', letterSpacing: -0.7 },
  titleCompact: { fontSize: 27, lineHeight: 32 },
  subtitle: { marginTop: 8, color: '#78877F', fontSize: 11, lineHeight: 18 },
  portalButton: { minHeight: 40, paddingHorizontal: 13, justifyContent: 'center', borderRadius: 9, backgroundColor: '#E7F0E9' },
  portalButtonText: { color: '#3B6D4B', fontSize: 10, fontWeight: '800' },
  statsRow: { marginTop: 14, marginBottom: 26, flexDirection: 'row', gap: 11 },
  statsRowCompact: { flexDirection: 'column' },
  statCard: { flex: 1, minHeight: 79, padding: 14, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6ECE7' },
  statValue: { color: '#244A35', fontSize: 23, fontWeight: '900' },
  statLabel: { marginTop: 4, color: '#829087', fontSize: 9, fontWeight: '700' },
  section: { marginTop: 20 },
  sectionHeader: { marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  sectionTitle: { color: '#1D382E', fontSize: 18, fontWeight: '800' },
  sectionCaption: { maxWidth: 720, marginTop: 4, color: '#819087', fontSize: 9, lineHeight: 15 },
  count: { minWidth: 28, paddingHorizontal: 8, paddingVertical: 5, textAlign: 'center', overflow: 'hidden', borderRadius: 99, backgroundColor: '#EEF3EF', color: '#4E6F58', fontSize: 10, fontWeight: '900' },
  list: { gap: 11 },
  card: { padding: 18, borderWidth: 1, borderColor: '#E4EAE5', borderRadius: 14, backgroundColor: '#FFFFFF' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cardCopy: { flex: 1 },
  cardTitle: { color: '#203B30', fontSize: 13, fontWeight: '800' },
  cardMeta: { marginTop: 4, color: '#86938A', fontSize: 9 },
  pendingPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99, backgroundColor: '#FFF2DA' },
  pendingText: { color: '#876534', fontSize: 8, fontWeight: '900' },
  description: { marginTop: 14, color: '#63766B', fontSize: 10, lineHeight: 17 },
  detailsGrid: { marginTop: 15, flexDirection: 'row', flexWrap: 'wrap', gap: 13 },
  detail: { flexGrow: 1, flexBasis: 160 },
  detailLabel: { color: '#95A198', fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: .6 },
  detailValue: { marginTop: 4, color: '#465D50', fontSize: 10, fontWeight: '700' },
  fieldLabel: { marginTop: 15, marginBottom: 6, color: '#5D6E63', fontSize: 9, fontWeight: '800' },
  noteInput: { minHeight: 53, padding: 10, borderWidth: 1, borderColor: '#E1E8E2', borderRadius: 9, color: '#2E4739', fontSize: 10, textAlignVertical: 'top' },
  actions: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  rejectButton: { minHeight: 36, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#FCEBE8' },
  rejectText: { color: '#9B5143', fontSize: 9, fontWeight: '800' },
  approveButton: { minHeight: 36, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#2C7150' },
  approveText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  messageCard: { minHeight: 190, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 10, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5ECE6' },
  messageTitle: { color: '#274432', fontSize: 17, fontWeight: '800' },
  messageText: { maxWidth: 440, color: '#748279', fontSize: 10, lineHeight: 16, textAlign: 'center' },
  actionButton: { minHeight: 38, paddingHorizontal: 15, justifyContent: 'center', borderRadius: 9, backgroundColor: '#2C7150' },
  actionButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  empty: { minHeight: 100, justifyContent: 'center', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#E5ECE6', borderRadius: 12, backgroundColor: '#FFFFFF' },
  emptyText: { color: '#7D8A81', fontSize: 10, lineHeight: 15, textAlign: 'center' },
  feedback: { padding: 12, borderRadius: 9, backgroundColor: '#EAF5EC' },
  feedbackText: { color: '#4B7652', fontSize: 10 },
  error: { padding: 12, borderRadius: 9, backgroundColor: '#FCEBE8' },
  errorText: { color: '#985349', fontSize: 10 },
  disabled: { opacity: .5 },
});
