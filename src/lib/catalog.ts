import type { Database } from '@/types/database';
import { supabase } from '@/lib/supabase';

export type ActiveCategory = Pick<Database['public']['Tables']['categories']['Row'], 'id' | 'name' | 'slug'>;
export type PriceHistoryEntry = Pick<
  Database['public']['Tables']['reference_prices']['Row'],
  'id' | 'pm' | 'li' | 'ls' | 'currency' | 'tax_basis' | 'revision' | 'status' |
  'correction_note' | 'published_at' | 'valid_from' | 'valid_until'
>;

export async function getActiveCategories(): Promise<ActiveCategory[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id,name,slug')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .limit(24);

  if (error) throw error;
  return data ?? [];
}

export async function searchPublishedPrices(query: string, categoryId?: string) {
  // Keep PostgREST's filter grammar out of the user-provided search string.
  const cleanedQuery = query.trim().replace(/[()%_.,:"*]/g, ' ').replace(/\\/g, ' ').replace(/\s+/g, ' ');
  let request = supabase
    .from('reference_prices')
    .select('id,product_id,source_id,pm,li,ls,currency,tax_basis,revision,correction_note,published_at,valid_from,valid_until,matching_verified,products!inner(id,name,brand,manufacturer_reference,category_id,unit_code,fitment_verified,attributes),units(label),reference_sources(title,edition)')
    .eq('status', 'published')
    .eq('products.status', 'published')
    .order('pm', { ascending: true })
    .limit(500);

  if (cleanedQuery) {
    const pattern = '%' + cleanedQuery + '%';
    request = request.or(
      'name.ilike.' + pattern + ',brand.ilike.' + pattern + ',manufacturer_reference.ilike.' + pattern,
      { referencedTable: 'products' },
    );
  }
  if (categoryId) request = request.eq('products.category_id', categoryId);

  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}

export async function canManageCatalogPrices(): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_manage_catalog_prices', {});
  if (error) throw error;
  return data;
}

export async function publishPriceRevision(input: {
  referencePriceId: string;
  pm: number;
  li: number;
  ls: number;
  note: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('publish_price_revision', {
    p_reference_price_id: input.referencePriceId,
    p_pm: input.pm,
    p_li: input.li,
    p_ls: input.ls,
    p_correction_note: input.note,
  });
  if (error) throw error;
  return data;
}

export async function getPriceHistory(productId: string, sourceId: string): Promise<PriceHistoryEntry[]> {
  const { data, error } = await supabase
    .from('reference_prices')
    .select('id,pm,li,ls,currency,tax_basis,revision,status,correction_note,published_at,valid_from,valid_until')
    .eq('product_id', productId)
    .eq('source_id', sourceId)
    .in('status', ['published', 'retired'])
    .order('revision', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}
