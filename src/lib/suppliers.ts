import type { Database } from '@/types/database';
import { supabase } from '@/lib/supabase';

export type SupplierApplication = Database['public']['Tables']['supplier_applications']['Row'];
export type SupplierOffer = Database['public']['Tables']['supplier_offers']['Row'];
export type SupplierOrganization = Pick<Database['public']['Tables']['organizations']['Row'], 'id' | 'name' | 'kind'>;
export type SupplierProduct = Pick<
  Database['public']['Tables']['products']['Row'],
  'id' | 'name' | 'brand' | 'manufacturer_reference' | 'unit_code'
>;

export type SupplierWorkspace = {
  organization: SupplierOrganization;
  membershipRole: string;
};

export type SupplierOfferView = SupplierOffer & {
  product: SupplierProduct | null;
  supplierName: string;
  reviewNote: string | null;
};

export type SupplierApplicationInput = Pick<
  Database['public']['Tables']['supplier_applications']['Insert'],
  'organization_name' | 'contact_name' | 'contact_email' | 'contact_phone' | 'city' | 'description' | 'specialties' | 'service_zones'
>;

export type SupplierOfferInput = Pick<
  Database['public']['Tables']['supplier_offers']['Insert'],
  | 'product_id' | 'brand' | 'condition' | 'quality' | 'unit_price' | 'currency'
  | 'tax_basis' | 'availability' | 'stock_quantity' | 'delivery_zone' | 'delivery_fee'
  | 'delivery_currency' | 'delivery_days_min' | 'delivery_days_max' | 'valid_until'
>;

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

async function latestReviewNotes(offerIds: string[]): Promise<Map<string, string | null>> {
  if (offerIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('supplier_offer_reviews')
    .select('offer_id,review_note,created_at')
    .in('offer_id', offerIds)
    .order('created_at', { ascending: false });
  throwIfError(error);

  const notes = new Map<string, string | null>();
  for (const review of data ?? []) {
    if (!notes.has(review.offer_id)) notes.set(review.offer_id, review.review_note);
  }
  return notes;
}

async function hydrateOffers(offers: SupplierOffer[], includeReviewNotes = false): Promise<SupplierOfferView[]> {
  if (offers.length === 0) return [];

  const productIds = [...new Set(offers.map((offer) => offer.product_id))];
  const organizationIds = [...new Set(offers.map((offer) => offer.supplier_organization_id))];
  const [productsResult, organizationsResult, reviewNotes] = await Promise.all([
    supabase.from('products').select('id,name,brand,manufacturer_reference,unit_code').in('id', productIds),
    supabase.from('organizations').select('id,name,kind').in('id', organizationIds),
    includeReviewNotes ? latestReviewNotes(offers.map((offer) => offer.id)) : Promise.resolve(new Map<string, string | null>()),
  ]);
  throwIfError(productsResult.error);
  throwIfError(organizationsResult.error);

  const products = new Map((productsResult.data ?? []).map((product) => [product.id, product]));
  const organizations = new Map((organizationsResult.data ?? []).map((organization) => [organization.id, organization.name]));

  return offers.map((offer) => ({
    ...offer,
    product: products.get(offer.product_id) ?? null,
    supplierName: organizations.get(offer.supplier_organization_id) ?? 'Fournisseur partenaire',
    reviewNote: reviewNotes.get(offer.id) ?? null,
  }));
}

export async function getSupplierWorkspace(userId: string): Promise<SupplierWorkspace | null> {
  const membershipResult = await supabase
    .from('organization_memberships')
    .select('organization_id,role,is_active')
    .eq('user_id', userId)
    .eq('is_active', true);
  throwIfError(membershipResult.error);

  const memberships = membershipResult.data ?? [];
  if (memberships.length === 0) return null;

  const organizationIds = memberships.map((membership) => membership.organization_id);
  const organizationsResult = await supabase
    .from('organizations')
    .select('id,name,kind')
    .in('id', organizationIds)
    .eq('kind', 'supplier');
  throwIfError(organizationsResult.error);

  const organization = organizationsResult.data?.[0];
  if (!organization) return null;
  const membership = memberships.find((item) => item.organization_id === organization.id);
  if (!membership) return null;

  return {
    organization,
    membershipRole: membership.role,
  };
}

export async function getSupplierApplications(userId: string): Promise<SupplierApplication[]> {
  const { data, error } = await supabase
    .from('supplier_applications')
    .select('*')
    .eq('applicant_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);
  throwIfError(error);
  return data ?? [];
}

export async function createSupplierApplication(input: SupplierApplicationInput): Promise<SupplierApplication> {
  const normalized: SupplierApplicationInput = {
    ...input,
    organization_name: input.organization_name.trim(),
    contact_name: input.contact_name.trim(),
    contact_email: input.contact_email.trim().toLowerCase(),
    contact_phone: input.contact_phone.trim(),
    city: input.city.trim(),
    description: input.description.trim(),
    specialties: input.specialties?.map((value) => value.trim()).filter(Boolean) ?? [],
    service_zones: input.service_zones?.map((value) => value.trim()).filter(Boolean) ?? [],
  };

  const { data, error } = await supabase
    .from('supplier_applications')
    .insert(normalized)
    .select('*')
    .single();
  throwIfError(error);
  if (!data) throw new Error('La demande fournisseur n’a pas été créée.');
  return data;
}

export async function getSupplierProducts(): Promise<SupplierProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id,name,brand,manufacturer_reference,unit_code')
    .eq('status', 'published')
    .order('name', { ascending: true })
    .limit(1000);
  throwIfError(error);
  return data ?? [];
}

export async function getSupplierOffers(organizationId: string): Promise<SupplierOfferView[]> {
  const { data, error } = await supabase
    .from('supplier_offers')
    .select('*')
    .eq('supplier_organization_id', organizationId)
    .order('updated_at', { ascending: false })
    .limit(500);
  throwIfError(error);
  return hydrateOffers(data ?? [], true);
}

export async function saveSupplierOffer(
  organizationId: string,
  values: SupplierOfferInput,
  offerId?: string,
): Promise<string> {
  if (offerId) {
    const { data, error } = await supabase
      .from('supplier_offers')
      .update(values)
      .eq('id', offerId)
      .eq('supplier_organization_id', organizationId)
      .select('id')
      .single();
    throwIfError(error);
    if (!data) throw new Error('L’offre n’a pas été mise à jour.');
    return data.id;
  }

  const { data, error } = await supabase
    .from('supplier_offers')
    .insert({ ...values, supplier_organization_id: organizationId })
    .select('id')
    .single();
  throwIfError(error);
  if (!data) throw new Error('L’offre n’a pas été créée.');
  return data.id;
}

export async function submitSupplierOffer(offerId: string): Promise<void> {
  const { error } = await supabase.rpc('submit_supplier_offer', { p_offer_id: offerId });
  throwIfError(error);
}

export async function setSupplierOfferPaused(offerId: string, paused: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_supplier_offer_paused', {
    p_offer_id: offerId,
    p_paused: paused,
  });
  throwIfError(error);
}

export async function getPublishedSupplierOffers(productId?: string): Promise<SupplierOfferView[]> {
  let request = supabase
    .from('supplier_offers')
    .select('*')
    .eq('status', 'published')
    .order('unit_price', { ascending: true })
    .limit(500);

  if (productId) request = request.eq('product_id', productId);
  const { data, error } = await request;
  throwIfError(error);
  return hydrateOffers(data ?? []);
}

export async function getPublishedSupplierOffersForProducts(productIds: string[]): Promise<SupplierOfferView[]> {
  const ids = [...new Set(productIds)].filter(Boolean);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('supplier_offers')
    .select('*')
    .eq('status', 'published')
    .in('product_id', ids)
    .order('unit_price', { ascending: true })
    .limit(1000);
  throwIfError(error);
  return hydrateOffers(data ?? []);
}

export async function getPendingSupplierApplications(): Promise<SupplierApplication[]> {
  const { data, error } = await supabase
    .from('supplier_applications')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(200);
  throwIfError(error);
  return data ?? [];
}

export async function getPendingSupplierOffers(): Promise<SupplierOfferView[]> {
  const { data, error } = await supabase
    .from('supplier_offers')
    .select('*')
    .eq('status', 'pending_review')
    .order('updated_at', { ascending: true })
    .limit(200);
  throwIfError(error);
  return hydrateOffers(data ?? []);
}

export async function reviewSupplierApplication(
  applicationId: string,
  approved: boolean,
  note: string | null,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('review_supplier_application', {
    p_application_id: applicationId,
    p_approved: approved,
    p_note: note,
  });
  throwIfError(error);
  return data;
}

export async function reviewSupplierOffer(
  offerId: string,
  approved: boolean,
  note: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('review_supplier_offer', {
    p_offer_id: offerId,
    p_approved: approved,
    p_note: note,
  });
  throwIfError(error);
}

export function supplierOfferStatusLabel(status: string): string {
  switch (status) {
    case 'published': return 'En ligne';
    case 'pending_review': return 'En vérification';
    case 'rejected': return 'À corriger';
    case 'paused': return 'En pause';
    default: return 'Brouillon';
  }
}

export function supplierAvailabilityLabel(availability: string): string {
  switch (availability) {
    case 'available': return 'En stock';
    case 'on_order': return 'Sur commande';
    case 'out_of_stock': return 'Indisponible';
    default: return 'Stock à confirmer';
  }
}
