import { useEffect, useMemo, useState } from 'react';
import { Link } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { InsurerShell } from '@/components/InsurerShell';
import { AUTH_ENABLED } from '@/config/auth';
import { useAuth } from '@/hooks/useAuth';
import { createInsurerOrganizationInvitation, getInsurerOrganizationInvitations, getInsurerOrganizationMembers, revokeInsurerOrganizationInvitation, saveInsurerOrganizationSettings, setInsurerMemberActive, type InsurerOrganizationInvitation, type InsurerOrganizationMember } from '@/lib/insurer-organization-settings';
import { getInsurerOrganizations, type InsurerOrganization } from '@/lib/insurer-dashboard';
import { insurerAccents, isInsurerAccent, type InsurerAccent } from '@/lib/insurer-theme';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
type InvitationView = InsurerOrganizationInvitation & { expired: boolean };

function organizationForm(organization: InsurerOrganization) {
  return {
    name: organization.name,
    email: organization.contact_email ?? '',
    phone: organization.contact_phone ?? '',
    city: organization.city ?? '',
    accent: isInsurerAccent(organization.accent_color) ? organization.accent_color : 'blue' as InsurerAccent,
  };
}

function invitationViews(items: InsurerOrganizationInvitation[]): InvitationView[] {
  const now = Date.now();
  return items.map((invitation) => ({
    ...invitation,
    expired: invitation.status === 'pending' && Date.parse(invitation.expires_at) <= now,
  }));
}

export default function InsurerSettingsPage() {
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const [organizations, setOrganizations] = useState<InsurerOrganization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [members, setMembers] = useState<InsurerOrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<InvitationView[]>([]);
  const [organizationLoading, setOrganizationLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [busyMember, setBusyMember] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', city: '', accent: 'blue' as InsurerAccent });
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitationLink, setInvitationLink] = useState('');
  const [invitationLinkId, setInvitationLinkId] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!AUTH_ENABLED || !session?.user.id) {
        setOrganizations([]);
        setOrganizationLoading(false);
        return;
      }
      setOrganizationLoading(true);
      setError(null);
      try {
        const found = await getInsurerOrganizations(session.user.id);
        if (!active) return;
        setOrganizations(found);
        const initialOrganization = found[0] ?? null;
        setSelectedOrganizationId(initialOrganization?.id ?? null);
        if (initialOrganization) setForm(organizationForm(initialOrganization));
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Impossible de charger l’organisation.');
      } finally {
        if (active) setOrganizationLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [session?.user.id]);

  const organization = organizations.find((item) => item.id === selectedOrganizationId) ?? null;
  const isManager = organization?.membershipRole === 'manager';
  const accent = organization && isInsurerAccent(organization.accent_color) ? organization.accent_color : 'blue';
  const organizationId = organization?.id;
  const organizationRole = organization?.membershipRole;

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    const loadTeam = async () => {
      setTeamLoading(true);
      if (organizationRole !== 'manager') {
        setMembers([]);
        setInvitations([]);
        setTeamLoading(false);
        return;
      }
      try {
        const [nextMembers, nextInvitations] = await Promise.all([
          getInsurerOrganizationMembers(organizationId),
          getInsurerOrganizationInvitations(organizationId),
        ]);
        if (active) {
          setMembers(nextMembers);
          setInvitations(invitationViews(nextInvitations));
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les membres.');
      } finally {
        if (active) setTeamLoading(false);
      }
    };
    void loadTeam();
    return () => { active = false; };
  }, [organizationId, organizationRole]);

  const pendingInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status === 'pending' && !invitation.expired),
    [invitations],
  );

  async function refreshTeam(organizationId: string) {
    const [nextMembers, nextInvitations] = await Promise.all([
      getInsurerOrganizationMembers(organizationId),
      getInsurerOrganizationInvitations(organizationId),
    ]);
    setMembers(nextMembers);
    setInvitations(invitationViews(nextInvitations));
  }

  async function saveSettings() {
    if (!organization) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveInsurerOrganizationSettings({
        organizationId: organization.id,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        accentColor: form.accent,
      });
      setOrganizations((current) => current.map((item) => item.id === organization.id ? {
        ...item,
        name: form.name.trim(),
        contact_email: form.email.trim() || null,
        contact_phone: form.phone.trim() || null,
        city: form.city.trim() || null,
        accent_color: form.accent,
      } : item));
      setNotice('Les paramètres de l’organisation ont été enregistrés.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Les paramètres n’ont pas pu être enregistrés.');
    } finally {
      setSaving(false);
    }
  }

  async function createInvitation() {
    if (!organization) return;
    setInviting(true);
    setError(null);
    setNotice(null);
    setCopyMessage('');
    try {
      if (Platform.OS !== 'web') throw new Error('La création des liens d’invitation est disponible depuis la plateforme web pour le moment.');
      const created = await createInsurerOrganizationInvitation(organization.id, inviteEmail.trim());
      const link = new URL('/assureur/invitation', window.location.origin);
      link.searchParams.set('token', created.token);
      setInvitationLink(link.toString());
      setInvitationLinkId(created.id);
      setInviteEmail('');
      setNotice(`Invitation créée. Elle expire le ${dateFormatter.format(new Date(created.expiresAt))}.`);
      await refreshTeam(organization.id);
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Le lien d’invitation n’a pas pu être créé.');
    } finally {
      setInviting(false);
    }
  }

  async function copyInvitationLink() {
    if (!invitationLink) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(invitationLink);
        setCopyMessage('Lien copié. Tu peux le partager au collègue invité.');
      } else {
        setCopyMessage('Sélectionne le lien ci-dessus et copie-le pour le partager.');
      }
    } catch {
      setCopyMessage('Sélectionne le lien ci-dessus et copie-le pour le partager.');
    }
  }

  async function revokeInvitation(invitation: InsurerOrganizationInvitation) {
    if (!organization) return;
    setBusyMember(invitation.id);
    setError(null);
    try {
      await revokeInsurerOrganizationInvitation(invitation.id);
      await refreshTeam(organization.id);
      setNotice(`L’invitation de ${invitation.email} a été révoquée.`);
      if (invitationLinkId === invitation.id) {
        setInvitationLink('');
        setInvitationLinkId(null);
      }
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'L’invitation n’a pas pu être révoquée.');
    } finally {
      setBusyMember(null);
    }
  }

  async function changeMemberAccess(member: InsurerOrganizationMember) {
    if (!organization) return;
    const actionLabel = member.is_active ? 'désactiver' : 'réactiver';
    if (typeof window !== 'undefined' && !window.confirm(`Veux-tu ${actionLabel} l’accès de ${member.display_name} ?`)) return;
    setBusyMember(member.user_id);
    setError(null);
    try {
      await setInsurerMemberActive(organization.id, member.user_id, !member.is_active);
      await refreshTeam(organization.id);
      setNotice(`L’accès de ${member.display_name} a été ${member.is_active ? 'désactivé' : 'réactivé'}.`);
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : 'L’accès du membre n’a pas pu être modifié.');
    } finally {
      setBusyMember(null);
    }
  }

  return (
    <InsurerShell accentColor={accent}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, compact && styles.pageCompact]}>
        <View style={[styles.pageHeader, compact && styles.pageHeaderCompact]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ESPACE ASSUREUR · ORGANISATION</Text>
            <Text style={[styles.title, compact && styles.titleCompact]}>Paramètres & équipe</Text>
            <Text style={styles.subtitle}>Centralise les informations de l’organisation et gère les collègues qui y ont accès.</Text>
          </View>
          <View style={[styles.headerBadge, { backgroundColor: insurerAccents[accent].light }]}>
            <Text style={[styles.headerBadgeIcon, { color: insurerAccents[accent].primary }]}>⚙</Text>
          </View>
        </View>

        {error && <Feedback kind="error" message={error} />}
        {notice && <Feedback kind="success" message={notice} />}

        {organizationLoading ? (
          <View style={styles.loading}><ActivityIndicator color={insurerAccents[accent].primary} /><Text style={styles.muted}>Chargement de votre organisation…</Text></View>
        ) : !session || !AUTH_ENABLED ? (
          <View style={styles.panel}><Text style={styles.panelTitle}>{AUTH_ENABLED ? 'Connecte-toi pour ouvrir ces paramètres.' : 'La connexion est momentanément indisponible.'}</Text><Text style={styles.body}>Les paramètres sont accessibles aux membres rattachés à une organisation assureur.</Text>{AUTH_ENABLED && <Link href="/sign-in" asChild><Pressable style={styles.primaryButton}><Text style={styles.primaryButtonText}>Se connecter avec Google</Text></Pressable></Link>}</View>
        ) : !organization ? (
          <View style={styles.panel}><Text style={styles.panelTitle}>Aucune organisation assureur rattachée.</Text><Text style={styles.body}>Demande au responsable de ton organisation ou à l’équipe Check de relier ton compte.</Text></View>
        ) : (
          <>
            {organizations.length > 1 && (
              <View style={styles.organizationSwitcher}>
                {organizations.map((item) => (
                  <Pressable key={item.id} onPress={() => {
                    setSelectedOrganizationId(item.id);
                    setForm(organizationForm(item));
                    setInvitationLink('');
                    setInvitationLinkId(null);
                    setCopyMessage('');
                    setMembers([]);
                    setInvitations([]);
                    setError(null);
                    setNotice(null);
                  }} style={[styles.organizationPill, item.id === organization.id && { borderColor: insurerAccents[accent].primary, backgroundColor: insurerAccents[accent].light }]}>
                    <Text style={[styles.organizationPillText, item.id === organization.id && { color: insurerAccents[accent].primary }]}>{item.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {!isManager && <View style={styles.readOnlyNotice}><Text style={styles.readOnlyTitle}>Accès en lecture seule</Text><Text style={styles.body}>Le responsable de l’organisation gère les coordonnées, le thème et les membres.</Text></View>}

            <View style={[styles.settingsGrid, compact && styles.settingsGridCompact]}>
              <View style={styles.panel}>
                <View style={styles.panelHeading}><View><Text style={styles.panelTitle}>Identité de l’organisation</Text><Text style={styles.panelSubtitle}>Les informations visibles dans l’espace assureur.</Text></View><View style={styles.sectionIcon}><Text style={styles.sectionIconText}>▣</Text></View></View>
                <Field label="Nom de l’organisation" value={form.name} onChangeText={(name) => setForm((current) => ({ ...current, name }))} placeholder="Ex. Assurance Horizon" editable={Boolean(isManager)} />
                <Field label="E-mail de contact" value={form.email} onChangeText={(email) => setForm((current) => ({ ...current, email }))} placeholder="contact@organisation.tg" keyboardType="email-address" editable={Boolean(isManager)} />
                <View style={[styles.fieldRow, compact && styles.fieldColumn]}>
                  <Field label="Téléphone" value={form.phone} onChangeText={(phone) => setForm((current) => ({ ...current, phone }))} placeholder="+228 …" keyboardType="phone-pad" editable={Boolean(isManager)} />
                  <Field label="Ville" value={form.city} onChangeText={(city) => setForm((current) => ({ ...current, city }))} placeholder="Lomé" editable={Boolean(isManager)} />
                </View>
                {isManager && <Pressable onPress={saveSettings} disabled={saving} style={[styles.primaryButton, { backgroundColor: insurerAccents[form.accent].primary }, saving && styles.disabledButton]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Enregistrer les paramètres</Text>}</Pressable>}
              </View>

              <View style={styles.panel}>
                <View style={styles.panelHeading}><View><Text style={styles.panelTitle}>Couleur de l’espace</Text><Text style={styles.panelSubtitle}>Choisis une couleur d’accent pour le portail de l’organisation.</Text></View><View style={[styles.sectionIcon, { backgroundColor: insurerAccents[form.accent].light }]}><Text style={[styles.sectionIconText, { color: insurerAccents[form.accent].primary }]}>◉</Text></View></View>
                <View style={styles.paletteGrid}>
                  {(Object.entries(insurerAccents) as [InsurerAccent, (typeof insurerAccents)[InsurerAccent]][]).map(([key, palette]) => (
                    <Pressable key={key} disabled={!isManager} onPress={() => setForm((current) => ({ ...current, accent: key }))} style={[styles.paletteOption, form.accent === key && { borderColor: palette.primary, backgroundColor: palette.light }, !isManager && styles.notEditable]}>
                      <View style={[styles.paletteSwatch, { backgroundColor: palette.primary }]} />
                      <Text style={styles.paletteLabel}>{palette.label}</Text>
                      {form.accent === key && <Text style={[styles.paletteCheck, { color: palette.primary }]}>✓</Text>}
                    </Pressable>
                  ))}
                </View>
                <View style={[styles.themePreview, { borderLeftColor: insurerAccents[form.accent].primary }]}>
                  <View style={[styles.previewMark, { backgroundColor: insurerAccents[form.accent].primary }]}><Text style={styles.previewMarkText}>C</Text></View>
                  <View style={styles.previewCopy}><Text style={styles.previewTitle}>{organization.name}</Text><Text style={styles.previewCaption}>Aperçu de l’espace assureur</Text></View>
                  <View style={[styles.previewBadge, { backgroundColor: insurerAccents[form.accent].light }]}><Text style={[styles.previewBadgeText, { color: insurerAccents[form.accent].primary }]}>Actif</Text></View>
                </View>
                {!isManager && <Text style={styles.helper}>Seul un responsable peut modifier la couleur.</Text>}
              </View>
            </View>

            <View style={styles.teamPanel}>
              <View style={[styles.teamHeader, compact && styles.teamHeaderCompact]}>
                <View style={styles.headerCopy}><Text style={styles.panelTitle}>Membres de l’organisation</Text><Text style={styles.panelSubtitle}>Invitations, responsables et accès des collègues.</Text></View>
                {isManager && <View style={styles.memberCount}><Text style={styles.memberCountNumber}>{members.filter((member) => member.is_active).length}</Text><Text style={styles.memberCountLabel}>ACTIFS</Text></View>}
              </View>
              {isManager ? (
                <>
                  <View style={[styles.inviteBox, compact && styles.inviteBoxCompact]}>
                    <View style={styles.inviteCopy}><Text style={styles.inviteTitle}>Inviter un collègue</Text><Text style={styles.helper}>Saisis son adresse Google, crée un lien sécurisé puis partage-le. Aucun e-mail n’est envoyé automatiquement pour le moment.</Text></View>
                    <View style={[styles.inviteForm, compact && styles.inviteFormCompact]}>
                      <TextInput value={inviteEmail} onChangeText={setInviteEmail} placeholder="collegue@organisation.tg" placeholderTextColor="#94A3B8" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" editable={!inviting} style={styles.inviteInput} />
                      <Pressable onPress={createInvitation} disabled={inviting || !inviteEmail.trim()} style={[styles.inviteButton, { backgroundColor: insurerAccents[accent].primary }, (inviting || !inviteEmail.trim()) && styles.disabledButton]}>{inviting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.inviteButtonText}>Créer le lien</Text>}</Pressable>
                    </View>
                    {invitationLink ? <View style={styles.sharePanel}><Text style={styles.shareTitle}>Lien à partager · valable 7 jours</Text><TextInput value={invitationLink} editable={false} selectTextOnFocus style={styles.shareInput} />{copyMessage ? <Text style={styles.helper}>{copyMessage}</Text> : null}<Pressable onPress={copyInvitationLink} style={[styles.copyButton, { borderColor: insurerAccents[accent].primary }]}><Text style={[styles.copyButtonText, { color: insurerAccents[accent].primary }]}>Copier le lien</Text></Pressable></View> : null}
                  </View>

                  <View style={styles.memberSectionHeading}><Text style={styles.listTitle}>Équipe</Text><Text style={styles.listMeta}>{members.length} membre{members.length === 1 ? '' : 's'}</Text></View>
                  {teamLoading ? <View style={styles.inlineLoading}><ActivityIndicator color={insurerAccents[accent].primary} /><Text style={styles.muted}>Chargement de l’équipe…</Text></View> : members.length === 0 ? <Text style={styles.emptyText}>Aucun membre n’est encore rattaché.</Text> : members.map((member) => (
                    <View key={member.user_id} style={[styles.personRow, compact && styles.personRowCompact]}>
                      <View style={[styles.avatar, { backgroundColor: insurerAccents[accent].light }]}><Text style={[styles.avatarText, { color: insurerAccents[accent].primary }]}>{(member.display_name || member.email).slice(0, 1).toUpperCase()}</Text></View>
                      <View style={styles.personCopy}><Text style={styles.personName}>{member.display_name}</Text><Text style={styles.personEmail}>{member.email}</Text></View>
                      <View style={[styles.roleBadge, member.role === 'manager' ? styles.managerBadge : styles.memberBadge]}><Text style={[styles.roleText, member.role === 'manager' ? styles.managerText : styles.memberText]}>{member.role === 'manager' ? 'Responsable' : 'Membre'}</Text></View>
                      <View style={[styles.accessBadge, member.is_active ? styles.accessBadgeActive : styles.accessBadgeInactive]}><Text style={[styles.accessText, member.is_active ? styles.accessTextActive : styles.accessTextInactive]}>{member.is_active ? 'Actif' : 'Désactivé'}</Text></View>
                      {member.role === 'member' && <Pressable onPress={() => changeMemberAccess(member)} disabled={busyMember === member.user_id} style={styles.memberAction}>{busyMember === member.user_id ? <ActivityIndicator color="#66788A" /> : <Text style={styles.memberActionText}>{member.is_active ? 'Désactiver' : 'Réactiver'}</Text>}</Pressable>}
                    </View>
                  ))}

                  <View style={styles.memberSectionHeading}><Text style={styles.listTitle}>Invitations</Text><Text style={styles.listMeta}>{pendingInvitations.length} en attente</Text></View>
                  {invitations.length === 0 ? <Text style={styles.emptyText}>Aucune invitation envoyée.</Text> : invitations.map((invitation) => {
                    const expired = invitation.expired;
                    const status = expired ? 'Expirée' : invitation.status === 'pending' ? 'En attente' : invitation.status === 'accepted' ? 'Acceptée' : invitation.status === 'revoked' ? 'Révoquée' : 'Expirée';
                    return (
                      <View key={invitation.id} style={[styles.invitationRow, compact && styles.personRowCompact]}>
                        <View style={styles.invitationMark}><Text style={styles.invitationMarkText}>↗</Text></View>
                        <View style={styles.personCopy}><Text style={styles.personName}>{invitation.email}</Text><Text style={styles.personEmail}>Expire le {dateFormatter.format(new Date(invitation.expires_at))}</Text></View>
                        <View style={[styles.accessBadge, invitation.status === 'accepted' ? styles.accessBadgeActive : styles.accessBadgeInactive]}><Text style={[styles.accessText, invitation.status === 'accepted' ? styles.accessTextActive : styles.accessTextInactive]}>{status}</Text></View>
                        {invitation.status === 'pending' && !expired && <Pressable onPress={() => revokeInvitation(invitation)} disabled={busyMember === invitation.id} style={styles.memberAction}>{busyMember === invitation.id ? <ActivityIndicator color="#66788A" /> : <Text style={styles.memberActionText}>Révoquer</Text>}</Pressable>}
                      </View>
                    );
                  })}
                  <Text style={styles.permissionNote}>Les autorisations détaillées par dossier seront définies dans une prochaine étape avec la matrice de permissions.</Text>
                </>
              ) : (
                <View style={styles.memberReadOnly}><Text style={styles.readOnlyTitle}>Tu es membre de {organization.name}.</Text><Text style={styles.body}>Pour inviter un collègue ou changer les paramètres de l’organisation, contacte l’un de ses responsables.</Text><Text style={styles.listMeta}>Ton rôle : {organization.membershipRole === 'manager' ? 'Responsable' : 'Membre'}</Text></View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </InsurerShell>
  );
}

function Field({ label, value, onChangeText, placeholder, editable = true, keyboardType = 'default' }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; editable?: boolean; keyboardType?: 'default' | 'email-address' | 'phone-pad' }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9AA9B7" editable={editable} keyboardType={keyboardType} autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'} autoCorrect={false} style={[styles.input, !editable && styles.inputReadOnly]} />
    </View>
  );
}

function Feedback({ kind, message }: { kind: 'error' | 'success'; message: string }) {
  return <View style={[styles.feedback, kind === 'error' ? styles.feedbackError : styles.feedbackSuccess]}><Text style={[styles.feedbackText, kind === 'error' ? styles.feedbackErrorText : styles.feedbackSuccessText]}>{message}</Text></View>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  page: { width: '100%', maxWidth: 1320, paddingHorizontal: 30, paddingTop: 27, paddingBottom: 54, alignSelf: 'center', gap: 16 },
  pageCompact: { paddingHorizontal: 15, paddingTop: 18, gap: 12 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18, marginBottom: 2 },
  pageHeaderCompact: { alignItems: 'flex-start' },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#4F8ABD', fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  title: { marginTop: 6, color: '#183653', fontSize: 28, lineHeight: 35, fontWeight: '800', letterSpacing: -.6 },
  titleCompact: { fontSize: 24, lineHeight: 30 },
  subtitle: { maxWidth: 630, marginTop: 6, color: '#75889A', fontSize: 11, lineHeight: 18 },
  headerBadge: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  headerBadgeIcon: { fontSize: 25, fontWeight: '800' },
  loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 11 },
  muted: { color: '#75899D', fontSize: 11 },
  feedback: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 11 },
  feedbackError: { backgroundColor: '#FCECEB' },
  feedbackSuccess: { backgroundColor: '#EAF6EF' },
  feedbackText: { fontSize: 11, lineHeight: 17 },
  feedbackErrorText: { color: '#8D4942' },
  feedbackSuccessText: { color: '#28724C' },
  settingsGrid: { flexDirection: 'row', alignItems: 'stretch', gap: 14 },
  settingsGridCompact: { flexDirection: 'column' },
  panel: { flex: 1, minWidth: 0, padding: 20, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1EAF3' },
  panelHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 15 },
  panelTitle: { color: '#193955', fontSize: 14, fontWeight: '800' },
  panelSubtitle: { marginTop: 4, color: '#7C8FA1', fontSize: 10, lineHeight: 15 },
  sectionIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF4FE' },
  sectionIconText: { color: '#397FBD', fontSize: 16, fontWeight: '800' },
  field: { flex: 1, minWidth: 0, marginBottom: 12, gap: 6 },
  fieldLabel: { color: '#526A80', fontSize: 9, fontWeight: '800' },
  input: { width: '100%', minHeight: 40, paddingHorizontal: 11, borderWidth: 1, borderColor: '#DCE6EF', borderRadius: 9, backgroundColor: '#FBFCFD', color: '#183653', fontSize: 11 },
  inputReadOnly: { color: '#74899C', backgroundColor: '#F7F9FB' },
  fieldRow: { flexDirection: 'row', gap: 12 },
  fieldColumn: { flexDirection: 'column', gap: 0 },
  primaryButton: { minHeight: 42, alignSelf: 'flex-start', marginTop: 2, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  disabledButton: { opacity: .58 },
  paletteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paletteOption: { minWidth: 100, minHeight: 41, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#E3EAF0', borderRadius: 10, backgroundColor: '#FFFFFF' },
  notEditable: { opacity: .78 },
  paletteSwatch: { width: 15, height: 15, borderRadius: 8 },
  paletteLabel: { color: '#465D72', fontSize: 10, fontWeight: '700' },
  paletteCheck: { marginLeft: 'auto', fontSize: 13, fontWeight: '900' },
  themePreview: { minHeight: 59, marginTop: 17, paddingHorizontal: 11, borderLeftWidth: 3, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F7FAFD' },
  previewMark: { width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  previewMarkText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  previewCopy: { flex: 1 },
  previewTitle: { color: '#193955', fontSize: 10, fontWeight: '800' },
  previewCaption: { marginTop: 3, color: '#8293A3', fontSize: 8 },
  previewBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20 },
  previewBadgeText: { fontSize: 8, fontWeight: '800' },
  helper: { color: '#7E90A1', fontSize: 9, lineHeight: 15 },
  teamPanel: { padding: 20, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1EAF3' },
  teamHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  teamHeaderCompact: { alignItems: 'flex-start' },
  memberCount: { minWidth: 58, paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center', borderRadius: 10, backgroundColor: '#EEF5FC' },
  memberCountNumber: { color: '#326F9F', fontSize: 14, fontWeight: '900' },
  memberCountLabel: { marginTop: 2, color: '#71869A', fontSize: 7, fontWeight: '900', letterSpacing: .6 },
  inviteBox: { marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: '#F6F9FC', borderWidth: 1, borderColor: '#E4ECF3' },
  inviteBoxCompact: { padding: 11 },
  inviteCopy: { gap: 5 },
  inviteTitle: { color: '#284762', fontSize: 11, fontWeight: '800' },
  inviteForm: { marginTop: 11, flexDirection: 'row', gap: 8 },
  inviteFormCompact: { flexDirection: 'column' },
  inviteInput: { flex: 1, minHeight: 40, paddingHorizontal: 11, borderWidth: 1, borderColor: '#DCE6EF', borderRadius: 9, backgroundColor: '#FFFFFF', color: '#183653', fontSize: 11 },
  inviteButton: { minHeight: 40, minWidth: 120, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  inviteButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  sharePanel: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE7EF' },
  shareTitle: { marginBottom: 7, color: '#385671', fontSize: 9, fontWeight: '800' },
  shareInput: { minHeight: 37, paddingHorizontal: 9, borderRadius: 8, backgroundColor: '#F5F8FB', color: '#526A80', fontSize: 9 },
  copyButton: { minHeight: 34, alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, justifyContent: 'center', borderWidth: 1, borderRadius: 8 },
  copyButtonText: { fontSize: 9, fontWeight: '800' },
  memberSectionHeading: { marginTop: 19, marginBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listTitle: { color: '#35526B', fontSize: 11, fontWeight: '800' },
  listMeta: { color: '#8698A8', fontSize: 9 },
  inlineLoading: { paddingVertical: 19, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { paddingVertical: 12, color: '#8798A8', fontSize: 10 },
  personRow: { minHeight: 58, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#EDF1F5' },
  personRowCompact: { flexWrap: 'wrap' },
  avatar: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  avatarText: { fontSize: 12, fontWeight: '900' },
  personCopy: { flex: 1, minWidth: 150 },
  personName: { color: '#25445F', fontSize: 10, fontWeight: '800' },
  personEmail: { marginTop: 3, color: '#8293A3', fontSize: 9 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20 },
  managerBadge: { backgroundColor: '#EAF4FE' },
  memberBadge: { backgroundColor: '#F0F3F6' },
  roleText: { fontSize: 8, fontWeight: '800' },
  managerText: { color: '#397FBD' },
  memberText: { color: '#667B8E' },
  accessBadge: { minWidth: 64, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20 },
  accessBadgeActive: { backgroundColor: '#EAF6EF' },
  accessBadgeInactive: { backgroundColor: '#F3F1F0' },
  accessText: { fontSize: 8, fontWeight: '800' },
  accessTextActive: { color: '#32744F' },
  accessTextInactive: { color: '#846E67' },
  memberAction: { minWidth: 68, minHeight: 32, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  memberActionText: { color: '#7C5960', fontSize: 8, fontWeight: '800' },
  invitationRow: { minHeight: 52, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#EDF1F5' },
  invitationMark: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#F0F5FA' },
  invitationMarkText: { color: '#5B7893', fontSize: 15, fontWeight: '800' },
  permissionNote: { marginTop: 16, padding: 11, borderRadius: 9, backgroundColor: '#F3F7FB', color: '#73889A', fontSize: 9, lineHeight: 15 },
  organizationSwitcher: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  organizationPill: { minHeight: 33, paddingHorizontal: 11, justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: '#DDE7EF', backgroundColor: '#FFFFFF' },
  organizationPillText: { color: '#617A90', fontSize: 9, fontWeight: '800' },
  readOnlyNotice: { padding: 14, borderRadius: 12, backgroundColor: '#F1F6FB', borderWidth: 1, borderColor: '#DEEAF4' },
  readOnlyTitle: { color: '#345570', fontSize: 11, fontWeight: '800' },
  body: { marginTop: 6, color: '#788C9F', fontSize: 10, lineHeight: 16 },
  memberReadOnly: { marginTop: 16, padding: 15, borderRadius: 11, backgroundColor: '#F7FAFC' },
});
