import type { PropsWithChildren } from 'react';
import { Link, usePathname } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { WebAuthAction } from '@/components/WebAuthAction';
import { insurerAccents, type InsurerAccent } from '@/lib/insurer-theme';

const links = [
  { id: 'overview', label: 'Vue d’ensemble', href: '/assureur' as const, icon: '⌂' },
  { id: 'dossiers', label: 'Dossiers sinistres', href: '/assureur/dossiers' as const, icon: '▤' },
  { id: 'compare', label: 'Comparer les devis', href: '/assureur/dossiers' as const, icon: '≈' },
  { id: 'offers', label: 'Offres partenaires', href: '/assureur/offres' as const, icon: '↗' },
  { id: 'catalogue', label: 'Catalogue automobile', href: '/assureur/catalogue' as const, icon: '▦' },
  { id: 'organization', label: 'Organisation', href: '/assureur/parametres' as const, icon: '⚙' },
];

export function InsurerShell({ children, accentColor = 'blue' }: PropsWithChildren<{ accentColor?: InsurerAccent }>) {
  const pathname = usePathname();
  const width = useWindowDimensions().width;
  const compact = width < 900;
  const mobile = width < 600;
  const accent = insurerAccents[accentColor];

  if (Platform.OS !== 'web') return <>{children}</>;

  return (
    <View style={[styles.frame, compact && styles.frameCompact]}>
      <View style={[styles.sidebar, compact && styles.sidebarCompact, mobile && styles.sidebarMobile]}>
        <Link href="/assureur" asChild>
          <Pressable accessibilityRole="link" style={styles.brand}>
            <View style={[styles.brandMark, { backgroundColor: accent.primary }]}><Text style={styles.brandMarkText}>C</Text></View>
            <View>
              <Text style={styles.brandName}>CHECK <Text style={styles.brandSuffix}>ASSURANCE</Text></Text>
              <Text style={styles.brandCaption}>ESPACE PROFESSIONNEL</Text>
            </View>
          </Pressable>
        </Link>

        <View style={[styles.navigation, compact && styles.navigationCompact, mobile && styles.navigationMobile]}>
          {links.map((link) => {
            const active = link.id === 'overview'
              ? pathname === '/assureur'
              : link.id === 'dossiers'
                ? pathname === '/assureur/dossiers'
                : link.id === 'compare'
                  ? pathname.startsWith('/assureur/dossiers/')
                  : pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link key={link.id} href={link.href} asChild>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={link.label}
                  style={StyleSheet.flatten([styles.navItem, active && { backgroundColor: accent.active }, compact && styles.navItemCompact, mobile && styles.navItemMobile])}>
                  <Text style={[styles.navIcon, active && { color: accent.icon }]}>{link.icon}</Text>
                  {!mobile && <Text style={[styles.navLabel, active && styles.navLabelActive]}>{link.label}</Text>}
                </Pressable>
              </Link>
            );
          })}
        </View>

        {!compact && (
          <View style={styles.sidebarFooter}>
            <View style={[styles.footerPulse, { backgroundColor: accent.primary }]} />
            <Text style={styles.footerText}>Un suivi clair, dossier par dossier.</Text>
          </View>
        )}
      </View>

      <View style={styles.workspace}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.topbarEyebrow}>PORTAIL ASSUREUR</Text>
            <Text style={styles.topbarTitle}>Suivi des dossiers et des devis</Text>
          </View>
          <View style={styles.topbarRight}>
            <View style={[styles.locationBadge, { backgroundColor: accent.light }]}><View style={[styles.locationDot, { backgroundColor: accent.primary }]} /><Text style={styles.locationText}>Togo · XOF</Text></View>
            <WebAuthAction compact={compact} />
          </View>
        </View>
        <View style={styles.page}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: '100%', flexDirection: 'row', backgroundColor: '#F3F7FC' },
  frameCompact: { flexDirection: 'column' },
  sidebar: { width: 262, paddingHorizontal: 19, paddingTop: 25, paddingBottom: 22, backgroundColor: '#102D50', borderRightWidth: 1, borderRightColor: '#1B3B62' },
  sidebarCompact: { width: '100%', paddingHorizontal: 15, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRightWidth: 0, borderBottomWidth: 1, borderBottomColor: '#1B3B62' },
  sidebarMobile: { alignItems: 'stretch', gap: 9 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' },
  brandMark: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#72B5F2' },
  brandMarkText: { color: '#102D50', fontSize: 21, fontWeight: '900' },
  brandName: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.4 },
  brandSuffix: { color: '#A8D3FA', fontSize: 9 },
  brandCaption: { marginTop: 3, color: '#A5BCD3', fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  navigation: { marginTop: 42, gap: 7 },
  navigationCompact: { marginTop: 0, flexDirection: 'row', gap: 3 },
  navigationMobile: { justifyContent: 'space-between' },
  navItem: { minHeight: 45, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 11 },
  navItemCompact: { minHeight: 37, paddingHorizontal: 8, gap: 5 },
  navItemMobile: { flex: 1, minWidth: 35, justifyContent: 'center', paddingHorizontal: 5 },
  navItemActive: { backgroundColor: '#1B4776' },
  navIcon: { width: 20, color: '#A7BCD1', fontSize: 17, textAlign: 'center' },
  navIconActive: { color: '#83C1F7' },
  navLabel: { color: '#C7D5E3', fontSize: 10, fontWeight: '600' },
  navLabelActive: { color: '#FFFFFF', fontWeight: '800' },
  sidebarFooter: { marginTop: 'auto', paddingTop: 17, borderTopWidth: 1, borderTopColor: '#294A6E', flexDirection: 'row', alignItems: 'center', gap: 9 },
  footerPulse: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#6AB99C' },
  footerText: { color: '#B6C8D9', fontSize: 9 },
  workspace: { flex: 1, minWidth: 0 },
  topbar: { minHeight: 72, paddingHorizontal: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2EAF2' },
  topbarEyebrow: { color: '#8498AB', fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  topbarTitle: { marginTop: 4, color: '#173653', fontSize: 15, fontWeight: '800' },
  topbarRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  locationBadge: { paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 99, backgroundColor: '#EEF5FC' },
  locationDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4BA77C' },
  locationText: { color: '#496782', fontSize: 9, fontWeight: '700' },
  page: { flex: 1, minHeight: 0 },
});
