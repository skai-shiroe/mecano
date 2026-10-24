import { useEffect, useState, type PropsWithChildren } from 'react';
import { Link, usePathname } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { WebAuthAction } from '@/components/WebAuthAction';
import { useAuth } from '@/hooks/useAuth';
import { canManageCatalogPrices } from '@/lib/catalog';

const navigation = [
  { label: 'Vue d’ensemble', href: '/' as const, icon: '⌂' },
  { label: 'Catalogue automobile', href: '/catalogue' as const, icon: '▦' },
  { label: 'Comparer un devis', href: '/comparer' as const, icon: '≈' },
  { label: 'Offres partenaires', href: '/offres' as const, icon: '↗' },
];

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { loading: authLoading, session } = useAuth();
  const [adminAccess, setAdminAccess] = useState<{ userId: string; allowed: boolean } | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || authLoading || !session) return;

    let active = true;
    void canManageCatalogPrices()
      .then((allowed) => { if (active) setAdminAccess({ userId: session.user.id, allowed }); })
      .catch(() => { if (active) setAdminAccess({ userId: session.user.id, allowed: false }); });
    return () => { active = false; };
  }, [authLoading, session]);

  if (Platform.OS !== 'web') return <>{children}</>;

  const compact = width < 900;
  const isCatalogAdmin = Boolean(session && adminAccess?.userId === session.user.id && adminAccess.allowed);
  const visibleNavigation = isCatalogAdmin
    ? [...navigation, { label: 'Fournisseurs', href: '/admin/suppliers' as const, icon: '✓' }, { label: 'Assureurs', href: '/admin/assureurs' as const, icon: '▤' }]
    : navigation;
  return (
    <View style={[styles.frame, compact && styles.compactFrame]}>
      <View style={[styles.sidebar, compact && styles.topbar]}>
        <Link href="/" asChild>
          <Pressable style={styles.brand} accessibilityRole="link">
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>C</Text></View>
            <View>
              <Text style={styles.brandName}>Check</Text>
              <Text style={styles.brandCaption}>PRIX EN TOUTE CONFIANCE</Text>
            </View>
          </Pressable>
        </Link>

        <View style={[styles.navigation, compact && styles.navigationCompact]}>
          {visibleNavigation.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link href={item.href} asChild key={item.href}>
                <Pressable
                  accessibilityRole="link"
                  style={StyleSheet.flatten([styles.navItem, active && styles.navItemActive, compact && styles.navItemCompact])}>
                  <Text style={[styles.navIcon, active && styles.navIconActive]}>{item.icon}</Text>
                  <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
                </Pressable>
              </Link>
            );
          })}
        </View>

        {!compact && (
          <View style={styles.sidebarNote}>
            <View style={styles.noteDot} />
            <Text style={styles.sidebarNoteText}>Édition de référence 2026</Text>
          </View>
        )}
      </View>

      <View style={styles.workspace}>
        <View style={styles.topline}>
          <Text style={styles.toplineLabel}>{compact ? 'PRIX DE RÉFÉRENCE' : 'PLATEFORME DE CONTRÔLE DES PRIX'}</Text>
          <View style={styles.toplineActions}>
            <View style={styles.locationPill}><Text style={styles.locationDot}>●</Text><Text style={styles.locationText}>Togo · XOF</Text></View>
            <WebAuthAction compact={compact} />
          </View>
        </View>
        <View style={styles.page}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: '100%', flexDirection: 'row', backgroundColor: '#F5F7F4' },
  compactFrame: { flexDirection: 'column' },
  sidebar: { width: 258, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24, backgroundColor: '#173A32', borderRightWidth: 1, borderRightColor: '#25473F' },
  topbar: { width: '100%', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRightWidth: 0, borderBottomWidth: 1, borderBottomColor: '#25473F' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11, alignSelf: 'flex-start' },
  brandMark: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2A36F' },
  brandMarkText: { color: '#173A32', fontSize: 23, fontWeight: '900' },
  brandName: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  brandCaption: { marginTop: 2, color: '#A9C1B9', fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },
  navigation: { marginTop: 48, gap: 8 },
  navigationCompact: { marginTop: 0, flexDirection: 'row', gap: 4 },
  navItem: { minHeight: 48, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12 },
  navItemCompact: { minHeight: 40, paddingHorizontal: 10, gap: 7 },
  navItemActive: { backgroundColor: '#2A5146' },
  navIcon: { width: 22, color: '#A9C1B9', fontSize: 22, textAlign: 'center' },
  navIconActive: { color: '#F2A36F' },
  navLabel: { color: '#C5D4CE', fontSize: 13, fontWeight: '600' },
  navLabelActive: { color: '#FFFFFF', fontWeight: '700' },
  sidebarNote: { marginTop: 'auto', paddingTop: 18, borderTopWidth: 1, borderTopColor: '#31544B', flexDirection: 'row', alignItems: 'center', gap: 9 },
  noteDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#82B79D' },
  sidebarNoteText: { color: '#B7CBC3', fontSize: 11 },
  workspace: { flex: 1, minWidth: 0 },
  topline: { height: 62, paddingHorizontal: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8ECE8' },
  toplineLabel: { color: '#84928B', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  toplineActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  locationPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99, backgroundColor: '#F2F6F3' },
  locationDot: { color: '#4C8E6A', fontSize: 8 },
  locationText: { color: '#456256', fontSize: 11, fontWeight: '700' },
  page: { flex: 1, minHeight: 0 },
});
