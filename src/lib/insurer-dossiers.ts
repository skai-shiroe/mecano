import type { Database, Json } from '@/types/database';
import { supabase } from '@/lib/supabase';

export type InsurerDossierRow = Database['public']['Tables']['quote_dossiers']['Row'];
export type InsurerEstimate = Database['public']['Tables']['quote_estimates']['Row'];
export type InsurerQuoteLine = Database['public']['Tables']['quote_lines']['Row'];
export type InsurerDossierEvent = Database['public']['Tables']['quote_dossier_events']['Row'];
export type InsurerOfferAlternative = Database['public']['Tables']['quote_line_offer_alternatives']['Row'];

export type PartCondition = 'new' | 'reconditioned' | 'used';
export type PartQuality = 'original' | 'equivalent' | 'reconditioned' | 'used';

export type ComparisonLineResult = {
  quote_id: string;
  supplier_name: string;
  quote_reference: string | null;
  quote_date: string | null;
  line_id: string;
  position: number;
  designation: string;
  quantity: number;
  unit_price: number;
  tax_rate: number | null;
  line_total: number;
  currency: string;
  tax_basis: string;
  condition?: PartCondition | null;
  quality?: PartQuality | null;
  unit_code: string | null;
  selected_product_id: string | null;
  product_name: string | null;
  status: 'below' | 'within' | 'above' | 'reference_unavailable' | 'unit_mismatch' | 'currency_mismatch' | 'tax_basis_unknown' | 'tax_basis_mismatch' | 'reference_range_invalid';
  delta: number | null;
  reference: {
    price_id: string;
    pm: number;
    li: number;
    ls: number;
    currency: string;
    tax_basis: string;
    unit_code: string;
    source_title: string;
    source_edition: string;
    revision: number;
  } | null;
};

export type ComparisonSnapshot = { algorithm_version: string; lines: ComparisonLineResult[] };
export type InsurerEstimateWithLines = InsurerEstimate & { lines: InsurerQuoteLine[] };
export type InsurerDossierDetail = InsurerDossierRow & {
  estimates: InsurerEstimateWithLines[];
  offerAlternatives: InsurerOfferAlternative[];
  latestComparison: ComparisonSnapshot | null;
  latestComparisonAt: string | null;
  events: InsurerDossierEvent[];
};

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function getInsurerDossierDetail(dossierId: string): Promise<InsurerDossierDetail> {
  const dossierResult = await supabase
    .from('quote_dossiers')
    .select('*')
    .eq('id', dossierId)
    .single();
  throwIfError(dossierResult.error);

  const dossier = dossierResult.data;
  if (!dossier) throw new Error('Le dossier est introuvable.');

  const [estimatesResult, comparisonResult, eventsResult, alternativesResult] = await Promise.all([
    supabase.from('quote_estimates').select('*').eq('dossier_id', dossierId).order('created_at', { ascending: true }),
    supabase.from('comparison_runs').select('result_snapshot,created_at').eq('dossier_id', dossierId).order('created_at', { ascending: false }).limit(1),
    supabase.from('quote_dossier_events').select('*').eq('dossier_id', dossierId).order('created_at', { ascending: false }).limit(30),
    supabase.from('quote_line_offer_alternatives').select('*').eq('dossier_id', dossierId).order('created_at', { ascending: true }),
  ]);
  throwIfError(estimatesResult.error);
  throwIfError(comparisonResult.error);
  throwIfError(eventsResult.error);
  throwIfError(alternativesResult.error);

  const estimates = estimatesResult.data ?? [];
  let linesByEstimate = new Map<string, InsurerQuoteLine[]>();
  if (estimates.length > 0) {
    const lineResult = await supabase
      .from('quote_lines')
      .select('*')
      .in('quote_estimate_id', estimates.map((estimate) => estimate.id))
      .order('position', { ascending: true });
    throwIfError(lineResult.error);
    linesByEstimate = new Map(estimates.map((estimate) => [estimate.id, []]));
    for (const line of lineResult.data ?? []) {
      if (line.quote_estimate_id) linesByEstimate.get(line.quote_estimate_id)?.push(line);
    }
  }

  const latest = comparisonResult.data?.[0] ?? null;
  return {
    ...dossier,
    estimates: estimates.map((estimate) => ({ ...estimate, lines: linesByEstimate.get(estimate.id) ?? [] })),
    offerAlternatives: alternativesResult.data ?? [],
    latestComparison: latest?.result_snapshot as ComparisonSnapshot | null,
    latestComparisonAt: latest?.created_at ?? null,
    events: eventsResult.data ?? [],
  };
}

export async function addInsurerOfferAlternative(quoteLineId: string, supplierOfferId: string): Promise<string> {
  const { data, error } = await supabase.rpc('add_insurer_offer_alternative', {
    p_quote_line_id: quoteLineId,
    p_supplier_offer_id: supplierOfferId,
  });
  throwIfError(error);
  if (typeof data !== 'string') throw new Error('L’offre n’a pas pu être ajoutée au dossier.');
  return data;
}

export async function createInsurerDossier(organizationId: string, title: string): Promise<string> {
  const { data, error } = await supabase
    .from('quote_dossiers')
    .insert({ organization_id: organizationId, title: title.trim() })
    .select('id')
    .single();
  throwIfError(error);
  if (!data) throw new Error('Le dossier n’a pas été créé.');
  return data.id;
}

export async function createInsurerEstimate(dossierId: string, supplierName: string): Promise<string> {
  const { data, error } = await supabase
    .from('quote_estimates')
    .insert({ dossier_id: dossierId, supplier_name: supplierName.trim() })
    .select('id')
    .single();
  throwIfError(error);
  if (!data) throw new Error('Le devis n’a pas été créé.');
  return data.id;
}

export type SaveEstimateLine = {
  position: number;
  designation: string;
  quantity: number;
  unit_code: string | null;
  unit_price: number;
  currency: string;
  tax_basis: 'HT' | 'TTC' | 'unknown';
  condition: PartCondition | null;
  quality: PartQuality | null;
  tax_rate: number | null;
  selected_product_id: string | null;
  matching_note: string | null;
};

export async function saveInsurerEstimate(input: {
  estimateId: string;
  supplierName: string;
  quoteReference: string;
  quoteDate: string;
  lines: SaveEstimateLine[];
}): Promise<void> {
  const { error } = await supabase.rpc('save_insurer_estimate', {
    p_estimate_id: input.estimateId,
    p_supplier_name: input.supplierName.trim(),
    p_quote_reference: input.quoteReference.trim() || null,
    p_quote_date: input.quoteDate || null,
    p_lines: input.lines as unknown as Json,
  });
  throwIfError(error);
}

export async function compareInsurerDossier(dossierId: string): Promise<string> {
  const { data, error } = await supabase.rpc('compare_insurer_dossier', { p_dossier_id: dossierId });
  throwIfError(error);
  if (typeof data !== 'string') throw new Error('La comparaison n’a pas été enregistrée.');
  return data;
}

export async function assignInsurerDossier(dossierId: string, assigneeId: string | null): Promise<void> {
  const { error } = await supabase.rpc('assign_insurer_dossier', {
    p_dossier_id: dossierId,
    p_assignee_id: assigneeId,
  });
  throwIfError(error);
}

export async function recordInsurerDecision(dossierId: string, estimateId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('record_insurer_decision', {
    p_dossier_id: dossierId,
    p_estimate_id: estimateId,
    p_decision_note: note.trim() || null,
  });
  throwIfError(error);
}

export async function recordInsurerOfferDecision(dossierId: string, alternativeId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('record_insurer_offer_decision', {
    p_dossier_id: dossierId,
    p_alternative_id: alternativeId,
    p_decision_note: note.trim() || null,
  });
  throwIfError(error);
}

export async function archiveInsurerDossier(dossierId: string): Promise<void> {
  const { error } = await supabase
    .from('quote_dossiers')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', dossierId);
  throwIfError(error);
}
