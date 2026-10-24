import type { Database } from '@/types/database';
import { supabase } from '@/lib/supabase';

export type AdminInsurerOrganization = Pick<
  Database['public']['Tables']['organizations']['Row'],
  'id' | 'name' | 'is_active' | 'created_at'
>;

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function getAdminInsurerOrganizations(): Promise<AdminInsurerOrganization[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id,name,is_active,created_at')
    .eq('kind', 'insurer')
    .order('created_at', { ascending: false })
    .limit(100);
  throwIfError(error);
  return data ?? [];
}

export async function createInsurerOrganization(name: string, managerEmail: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_insurer_organization', {
    p_name: name.trim(),
    p_manager_email: managerEmail.trim().toLowerCase(),
  });
  throwIfError(error);
  if (!data) throw new Error('L’organisation assureur n’a pas été créée.');
  return data;
}
