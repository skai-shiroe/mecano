import type { PropsWithChildren } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { WebAuthAction } from '@/components/WebAuthAction';

const NAV = [
  { key: 'home', label: 'Accueil', href: '/' as const },
  { key: 'problem', label: 'Le problème', href: '/problem' as const },
  { key: 'approach', label: 'Notre approche', href: '/fonctionnement' as const },
  { key: 'professionals', label: 'Professionnels', href: '/professionnels' as const },
  { key: 'suppliers', label: 'Espace fournisseur', href: '/fournisseurs' as const },
];

export type MarketingPageKey = (typeof NAV)[number]['key'];

export function MarketingShell({ children, active }: PropsWithChildren<{ active: MarketingPageKey }>) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 850;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <View style={styles.headerOuter}>
        <View style={[styles.headerInner, compact && styles.headerInnerCompact]}>
          <View style={styles.headerMain}>
            <Pressable onPress={() => router.push('/')} accessibilityRole="link" style={styles.brand}>
              <View style={styles.brandMark}><Text style={styles.brandMarkText}>C</Text></View>
              <Text style={styles.brandName}>check<Text style={styles.brandDot}>.</Text></Text>
            </Pressable>
            {!compact && (
              <View style={styles.navLinks}>
                {NAV.map((item) => (
                  <Pressable key={item.key} onPress={() => router.push(item.href)} accessibilityRole="link" style={styles.navPressable}>
                    <Text style={[styles.navText, active === item.key && styles.navTextActive]}>{item.label}</Text>
                    {active === item.key && <View style={styles.navUnderline} />}
                  </Pressable>
                ))}
              </View>
            )}
            <Pressable onPress={() => router.push('/catalogue')} accessibilityRole="button" style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
              <Text style={styles.headerButtonText}>{compact ? 'Catalogue' : 'Rechercher une pièce'}</Text><Text style={styles.headerButtonArrow}>↗</Text>
            </Pressable>
            <WebAuthAction compact={compact} />
          </View>
          {compact && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileNav}>
              {NAV.map((item) => (
                <Pressable key={item.key} onPress={() => router.push(item.href)} accessibilityRole="link" style={[styles.mobileNavItem, active === item.key && styles.mobileNavItemActive]}>
                  <Text style={[styles.mobileNavText, active === item.key && styles.mobileNavTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      <View style={styles.content}>{children}</View>

      <View style={styles.footerOuter}>
        <View style={[styles.footerInner, compact && styles.footerInnerCompact]}>
          <View style={styles.footerBrandBlock}>
            <Text style={styles.footerBrand}>check<Text style={styles.brandDot}>.</Text></Text>
            <Text style={styles.footerTagline}>Le bon prix, en toute clarté.</Text>
          </View>
          <Text style={styles.footerText}>Des prix de référence documentés pour mieux comprendre les devis et prendre des décisions éclairées.</Text>
          <Text style={styles.footerLocale}>Togo · XOF · Première famille : automobile</Text>
        </View>
      </View>
    </ScrollView>
  );
}

export const marketingStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8F5' },
  scrollContent: { alignItems: 'center', paddingBottom: 0 },
  headerOuter: { width: '100%', borderBottomWidth: 1, borderBottomColor: '#E9EDE8', backgroundColor: '#FCFDFB' },
  headerInner: { width: '100%', maxWidth: 1320, minHeight: 82, paddingHorizontal: 34, alignSelf: 'center', justifyContent: 'center' },
  headerInnerCompact: { minHeight: 92, paddingHorizontal: 18, paddingVertical: 10 },
  headerMain: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 22 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#183D33' },
  brandMarkText: { color: '#FFF9F1', fontSize: 21, fontWeight: '900' },
  brandName: { color: '#20352D', fontSize: 23, fontWeight: '900', letterSpacing: -1.3 },
  brandDot: { color: '#D77F4E' },
  navLinks: { flexDirection: 'row', alignItems: 'center', gap: 29 },
  navPressable: { minHeight: 42, justifyContent: 'center' },
  navText: { color: '#66766D', fontSize: 12, fontWeight: '600' },
  navTextActive: { color: '#244D3C', fontWeight: '800' },
  navUnderline: { position: 'absolute', bottom: 1, left: 0, right: 0, height: 2, borderRadius: 2, backgroundColor: '#E89361' },
  headerButton: { minHeight: 43, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11, borderRadius: 10, backgroundColor: '#183D33' },
  headerButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  headerButtonArrow: { color: '#F1A16D', fontSize: 15, fontWeight: '900' },
  mobileNav: { alignItems: 'center', gap: 8, paddingVertical: 4 },
  mobileNavItem: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: '#F0F3EF' },
  mobileNavItemActive: { backgroundColor: '#E3ECE4' },
  mobileNavText: { color: '#6A7A70', fontSize: 10, fontWeight: '700' },
  mobileNavTextActive: { color: '#244D3C' },
  content: { width: '100%', alignItems: 'center' },
  footerOuter: { width: '100%', borderTopWidth: 1, borderTopColor: '#E5EAE5', backgroundColor: '#F7F8F5' },
  footerInner: { width: '100%', maxWidth: 1268, minHeight: 108, paddingHorizontal: 28, paddingVertical: 22, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 24 },
  footerInnerCompact: { paddingHorizontal: 20, alignItems: 'flex-start', flexDirection: 'column', gap: 11 },
  footerBrandBlock: { minWidth: 190 },
  footerBrand: { color: '#20352D', fontSize: 21, fontWeight: '900', letterSpacing: -1 },
  footerTagline: { marginTop: 3, color: '#75837A', fontSize: 9 },
  footerText: { flex: 1, maxWidth: 490, color: '#7A8880', fontSize: 9, lineHeight: 15 },
  footerLocale: { color: '#7A8880', fontSize: 9 },
  pressed: { opacity: .82, transform: [{ scale: .98 }] },
});

const styles = marketingStyles;
