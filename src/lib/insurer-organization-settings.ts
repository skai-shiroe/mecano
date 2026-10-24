import { supabase } from '@/lib/supabase';
import type { InsurerAccent } from '@/lib/insurer-theme';

export type InsurerOrganizationMember = {
  user_id: string;
  email: string;
  display_name: string;
  role: 'manager' | 'member';
  is_active: boolean;
  joined_at: string;
};

export type InsurerOrganizationInvitation = {
  id: string;
  email: string;
  role: 'manager' | 'member';
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  created_at: string;
  expires_at: string;
};

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function getInsurerOrganizationMembers(organizationId: string): Promise<InsurerOrganizationMember[]> {
  const { data, error } = await supabase.rpc('get_insurer_organization_members', {
    p_organization_id: organizationId,
  });
  throwIfError(error);
  return (data ?? []) as InsurerOrganizationMember[];
}

export async function getInsurerOrganizationInvitations(organizationId: string): Promise<InsurerOrganizationInvitation[]> {
  const { data, error } = await supabase.rpc('get_insurer_organization_invitations', {
    p_organization_id: organizationId,
  });
  throwIfError(error);
  return (data ?? []) as InsurerOrganizationInvitation[];
}

export async function saveInsurerOrganizationSettings(input: {
  organizationId: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  accentColor: InsurerAccent;
}): Promise<void> {
  const { error } = await supabase.rpc('update_insurer_organization_settings', {
    p_organization_id: input.organizationId,
    p_name: input.name,
    p_contact_email: input.email || null,
    p_contact_phone: input.phone || null,
    p_city: input.city || null,
    p_accent_color: input.accentColor,
  });
  throwIfError(error);
}

export async function createInsurerOrganizationInvitation(organizationId: string, email: string): Promise<{ id: string; token: string; expiresAt: string }> {
  const { data, error } = await supabase.rpc('create_insurer_organization_invitation', {
    p_organization_id: organizationId,
    p_email: email,
  });
  throwIfError(error);
  const invitation = data?.[0];
  if (!invitation) throw new Error('Le lien d’invitation n’a pas pu être créé.');
  return { id: invitation.invitation_id, token: invitation.token, expiresAt: invitation.expires_at };
}

export async function revokeInsurerOrganizationInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_insurer_organization_invitation', {
    p_invitation_id: invitationId,
  });
  throwIfError(error);
}

export async function setInsurerMemberActive(organizationId: string, userId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_insurer_member_active', {
    p_organization_id: organizationId,
    p_user_id: userId,
    p_is_active: isActive,
  });
  throwIfError(error);
}

export async function acceptInsurerOrganizationInvitation(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_insurer_organization_invitation', { p_token: token });
  throwIfError(error);
  if (typeof data !== 'string') throw new Error('La réponse à l’invitation est invalide.');
  return data;
}
