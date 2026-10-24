import type { PropsWithChildren } from 'react';
import { Link, usePathname } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { WebAuthAction } from '@/components/WebAuthAction';

const links = [
  { label: 'Mon espace', href: '/fournisseurs' as const, icon: '▦' },
  { label: 'Offres partenaires', href: '/offres' as const, icon: '↗' },
  { label: 'Catalogue Check', href: '/catalogue' as const, icon: '⌕' },
];

export function SupplierShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const compact = useWindowDimensions().width < 900;

  if (Platform.OS !== 'web') return <>{children}</>;

  return (
    <View style={[styles.frame, compact && styles.frameCompact]}>
      <View style={[styles.sidebar, compact && styles.sidebarCompact]}>
        <Link href="/fournisseurs" asChild>
          <Pressable accessibilityRole="link" style={styles.brand}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>S</Text></View>
            <View>
              <Text style={styles.brandName}>CHECK <Text style={styles.brandSuffix}>PRO</Text></Text>
              <Text style={styles.brandCaption}>ESPACE FOURNISSEUR</Text>
            </View>
          </Pressable>
        </Link>

        <View style={[styles.navigation, compact && styles.navigationCompact]}>
          {links.map((link) => {
            const active = link.href === '/fournisseurs'
              ? pathname.startsWith('/fournisseurs')
              : pathname === link.href;
            return (
              <Link key={link.href} href={link.href} asChild>
                <Pressable
                  accessibilityRole="link"
                  style={StyleSheet.flatten([styles.navItem, active && styles.navItemActive, compact && styles.navItemCompact])}>
                  <Text style={[styles.navIcon, active && styles.navIconActive]}>{link.icon}</Text>
                  <Text style={[styles.navLabel, active && styles.navLabelActive]}>{link.label}</Text>
                </Pressable>
              </Link>
            );
          })}
        </View>

        {!compact && (
          <View style={styles.sidebarFooter}>
            <View style={styles.footerPulse} />
            <Text style={styles.footerText}>Votre catalogue, plus visible.</Text>
          </View>
        )}
      </View>

      <View style={styles.workspace}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.topbarEyebrow}>PORTAIL PARTENAIRE</Text>
            <Text style={styles.topbarTitle}>Gérer mes offres</Text>
          </View>
          <View style={styles.topbarRight}>
            <View style={styles.pilotBadge}><View style={styles.pilotDot} /><Text style={styles.pilotText}>Togo · XOF</Text></View>
            <WebAuthAction compact={compact} />
          </View>
        </View>
        <View style={styles.page}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: '100%', flexDirection: 'row', backgroundColor: '#F8F6FB' },
  frameCompact: { flexDirection: 'column' },
  sidebar: { width: 252, paddingHorizontal: 19, paddingTop: 25, paddingBottom: 22, backgroundColor: '#2A2040', borderRightWidth: 1, borderRightColor: '#40325A' },
  sidebarCompact: { width: '100%', paddingHorizontal: 15, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRightWidth: 0, borderBottomWidth: 1, borderBottomColor: '#40325A' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' },
  brandMark: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#B999EF' },
  brandMarkText: { color: '#2A2040', fontSize: 21, fontWeight: '900' },
  brandName: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.6 },
  brandSuffix: { color: '#C7B0FF', fontSize: 12 },
  brandCaption: { marginTop: 3, color: '#C0B5D2', fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  navigation: { marginTop: 44, gap: 7 },
  navigationCompact: { marginTop: 0, flexDirection: 'row', gap: 3 },
  navItem: { minHeight: 46, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 11 },
  navItemCompact: { minHeight: 37, paddingHorizontal: 9, gap: 6 },
  navItemActive: { backgroundColor: '#463367' },
  navIcon: { width: 20, color: '#B0A4C4', fontSize: 18, textAlign: 'center' },
  navIconActive: { color: '#D0BAFF' },
  navLabel: { color: '#DED7E8', fontSize: 11, fontWeight: '600' },
  navLabelActive: { color: '#FFFFFF', fontWeight: '800' },
  sidebarFooter: { marginTop: 'auto', paddingTop: 17, borderTopWidth: 1, borderTopColor: '#4A3B61', flexDirection: 'row', alignItems: 'center', gap: 9 },
  footerPulse: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#68C4A0' },
  footerText: { color: '#CEC4DB', fontSize: 10 },
  workspace: { flex: 1, minWidth: 0 },
  topbar: { minHeight: 72, paddingHorizontal: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EAE6F0' },
  topbarEyebrow: { color: '#91869F', fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  topbarTitle: { marginTop: 4, color: '#382750', fontSize: 16, fontWeight: '800' },
  topbarRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pilotBadge: { paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 99, backgroundColor: '#F3EFF9' },
  pilotDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#42A77B' },
  pilotText: { color: '#766987', fontSize: 10, fontWeight: '700' },
  page: { flex: 1, minHeight: 0 },
});
