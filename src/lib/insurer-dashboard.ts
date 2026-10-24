import type { Database } from '@/types/database';
import { supabase } from '@/lib/supabase';

type Organization = Pick<Database['public']['Tables']['organizations']['Row'], 'id' | 'name' | 'kind' | 'contact_email' | 'contact_phone' | 'city' | 'accent_color'>;
type Membership = Pick<Database['public']['Tables']['organization_memberships']['Row'], 'organization_id' | 'role'>;
type Dossier = Pick<
  Database['public']['Tables']['quote_dossiers']['Row'],
  'id' | 'title' | 'created_at' | 'updated_at' | 'archived_at' | 'workflow_status' | 'assigned_user_id'
>;

export type InsurerOrganization = Organization & { membershipRole: Membership['role'] };
export type InsurerDossier = Dossier & { lineCount: number; estimateCount: number; comparisonCount: number };

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function getInsurerOrganizations(userId: string): Promise<InsurerOrganization[]> {
  const membershipResult = await supabase
    .from('organization_memberships')
    .select('organization_id,role')
    .eq('user_id', userId)
    .eq('is_active', true);
  throwIfError(membershipResult.error);

  const memberships = (membershipResult.data ?? []) as Membership[];
  if (memberships.length === 0) return [];

  const organizationIds = memberships.map((membership) => membership.organization_id);
  const organizationsResult = await supabase
    .from('organizations')
    .select('id,name,kind,contact_email,contact_phone,city,accent_color')
    .in('id', organizationIds)
    .eq('kind', 'insurer');
  throwIfError(organizationsResult.error);

  const membershipByOrganization = new Map(memberships.map((membership) => [membership.organization_id, membership.role]));
  return ((organizationsResult.data ?? []) as Organization[]).map((organization) => ({
    ...organization,
    membershipRole: membershipByOrganization.get(organization.id) ?? 'member',
  }));
}

export async function getInsurerDossiers(organizationId: string): Promise<InsurerDossier[]> {
  const dossierResult = await supabase
    .from('quote_dossiers')
    .select('id,title,created_at,updated_at,archived_at,workflow_status,assigned_user_id')
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false })
    .limit(100);
  throwIfError(dossierResult.error);

  const dossiers = (dossierResult.data ?? []) as Dossier[];
  if (dossiers.length === 0) return [];

  const ids = dossiers.map((dossier) => dossier.id);
  const [linesResult, estimatesResult, comparisonsResult] = await Promise.all([
    supabase.from('quote_lines').select('dossier_id').in('dossier_id', ids),
    supabase.from('quote_estimates').select('dossier_id').in('dossier_id', ids),
    supabase.from('comparison_runs').select('dossier_id').in('dossier_id', ids),
  ]);
  throwIfError(linesResult.error);
  throwIfError(estimatesResult.error);
  throwIfError(comparisonsResult.error);

  const lineCounts = new Map<string, number>();
  const estimateCounts = new Map<string, number>();
  const comparisonCounts = new Map<string, number>();
  for (const row of linesResult.data ?? []) lineCounts.set(row.dossier_id, (lineCounts.get(row.dossier_id) ?? 0) + 1);
  for (const row of estimatesResult.data ?? []) estimateCounts.set(row.dossier_id, (estimateCounts.get(row.dossier_id) ?? 0) + 1);
  for (const row of comparisonsResult.data ?? []) comparisonCounts.set(row.dossier_id, (comparisonCounts.get(row.dossier_id) ?? 0) + 1);

  return dossiers.map((dossier) => ({
    ...dossier,
    lineCount: lineCounts.get(dossier.id) ?? 0,
    estimateCount: estimateCounts.get(dossier.id) ?? 0,
    comparisonCount: comparisonCounts.get(dossier.id) ?? 0,
  }));
}
