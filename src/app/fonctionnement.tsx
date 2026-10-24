import { useRouter } from 'expo-router';
import { useWindowDimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { MarketingShell } from '@/components/MarketingShell';

const steps = [
  { n: '01', title: 'Recherchez la pièce', text: 'Entrez un nom courant ou une référence pour retrouver le produit qui correspond au devis.', icon: '⌕' },
  { n: '02', title: 'Vérifiez le repère', text: 'Lisez le prix publié avec son unité, sa source et les informations utiles à la comparaison.', icon: '◎' },
  { n: '03', title: 'Comparez le devis', text: 'Rapprochez les mêmes références et posez les bonnes questions avant de décider.', icon: '✓' },
];

export default function HowItWorksPage() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 760;
  return (
    <MarketingShell active="approach">
      <View style={styles.page}>
        <Animated.View entering={FadeInDown.duration(650)} style={[styles.hero, compact && styles.heroCompact]}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>NOTRE APPROCHE</Text>
            <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>Un repère clair.{ '\n' }Une décision mieux éclairée.</Text>
            <Text style={styles.heroText}>Check rend la recherche et la comparaison des pièces plus simples, en gardant visibles les éléments qui donnent du sens à un prix.</Text>
            <Pressable onPress={() => router.push('/catalogue')} accessibilityRole="button" style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}><Text style={styles.heroButtonText}>Rechercher une pièce</Text><Text style={styles.heroButtonArrow}>→</Text></Pressable>
          </View>
          <View style={styles.visualCard}>
            <View style={styles.visualTop}><Text style={styles.visualEyebrow}>VOTRE COMPARAISON</Text><View style={styles.visualCheck}><Text style={styles.visualCheckText}>✓</Text></View></View>
            <View style={styles.visualProduct}><View style={styles.productMark}><Text style={styles.productMarkText}>◉</Text></View><View><Text style={styles.productName}>Pièce identifiée</Text><Text style={styles.productDetail}>Référence · unité · source</Text></View></View>
            <View style={styles.visualRule} />
            <View style={styles.rangeHead}><Text style={styles.rangeTitle}>Repère de prix</Text><Text style={styles.rangeUnit}>XOF</Text></View>
            <View style={styles.rangeBar}><View style={styles.rangeStart} /><View style={styles.rangeMiddle} /><View style={styles.rangeEnd} /></View>
            <View style={styles.rangeLabels}><Text style={styles.rangeLabel}>BAS</Text><Text style={styles.rangeLabel}>MOYEN</Text><Text style={styles.rangeLabel}>HAUT</Text></View>
            <Text style={styles.visualFoot}>Le contexte accompagne toujours le chiffre.</Text>
          </View>
        </Animated.View>

        <View style={styles.section}>
          <Text style={styles.eyebrow}>TROIS ÉTAPES, SANS DÉTOUR</Text>
          <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>Du nom de la pièce à la comparaison.</Text>
          <View style={[styles.stepsGrid, compact && styles.stepsGridCompact]}>
            {steps.map((step, index) => <StepCard key={step.n} step={step} delay={index * 130} />)}
          </View>
        </View>

        <Animated.View entering={FadeInUp.duration(700).delay(100)} style={[styles.noteBand, compact && styles.noteBandCompact]}>
          <View style={styles.noteIcon}><Text style={styles.noteIconText}>i</Text></View>
          <View style={styles.noteCopy}><Text style={styles.noteTitle}>Un prix de référence aide à comparer, il ne remplace pas le jugement.</Text><Text style={styles.noteText}>La bonne comparaison porte sur le produit exact, son état, son unité et les conditions de l’offre. Check garde la source et le contexte visibles pour guider cette lecture.</Text></View>
        </Animated.View>

        <View style={[styles.lastCall, compact && styles.lastCallCompact]}>
          <View><Text style={styles.lastCallEyebrow}>À VOUS DE JOUER</Text><Text style={styles.lastCallTitle}>Trouvez votre référence automobile.</Text></View>
          <Pressable onPress={() => router.push('/catalogue')} accessibilityRole="button" style={({ pressed }) => [styles.lastCallButton, pressed && styles.pressed]}><Text style={styles.lastCallButtonText}>Ouvrir le catalogue</Text><Text style={styles.lastCallArrow}>→</Text></Pressable>
        </View>
      </View>
    </MarketingShell>
  );
}

function StepCard({ step, delay }: { step: (typeof steps)[number]; delay: number }) {
  return <Animated.View entering={FadeInUp.duration(650).delay(delay)} style={styles.stepCard}><View style={styles.stepCardTop}><Text style={styles.stepNumber}>{step.n}</Text><View style={styles.stepIcon}><Text style={styles.stepIconText}>{step.icon}</Text></View></View><Text style={styles.stepTitle}>{step.title}</Text><Text style={styles.stepText}>{step.text}</Text><View style={styles.stepUnderline} /></Animated.View>;
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 1268, paddingHorizontal: 28, paddingBottom: 50, alignSelf: 'center' },
  hero: { minHeight: 440, marginTop: 36, padding: 40, flexDirection: 'row', alignItems: 'center', gap: 50, overflow: 'hidden', borderRadius: 22, backgroundColor: '#183D33' },
  heroCompact: { marginTop: 15, padding: 24, paddingVertical: 32, flexDirection: 'column', alignItems: 'stretch', gap: 30 },
  heroCopy: { flex: 1, maxWidth: 540 },
  eyebrow: { color: '#A56543', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  heroTitle: { marginTop: 14, color: '#FFFFFF', fontSize: 43, lineHeight: 50, fontWeight: '800', letterSpacing: -1.5 },
  heroTitleCompact: { fontSize: 34, lineHeight: 40 },
  heroText: { maxWidth: 500, marginTop: 14, color: '#D6E1DA', fontSize: 13, lineHeight: 22 },
  heroButton: { alignSelf: 'flex-start', minHeight: 47, marginTop: 22, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 15, borderRadius: 10, backgroundColor: '#F1A16D' },
  heroButtonText: { color: '#20352D', fontSize: 10, fontWeight: '900' },
  heroButtonArrow: { color: '#20352D', fontSize: 16, fontWeight: '900' },
  visualCard: { width: 330, padding: 21, borderRadius: 17, backgroundColor: '#FFFFFF', shadowColor: '#051E17', shadowOpacity: .18, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  visualTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  visualEyebrow: { color: '#78877E', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  visualCheck: { width: 27, height: 27, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9F2E9' },
  visualCheckText: { color: '#3F7A55', fontWeight: '900' },
  visualProduct: { marginTop: 17, flexDirection: 'row', alignItems: 'center', gap: 11 },
  productMark: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4EDE4' },
  productMarkText: { color: '#B56F4A', fontSize: 19 },
  productName: { color: '#20352D', fontSize: 12, fontWeight: '800' },
  productDetail: { marginTop: 3, color: '#819087', fontSize: 9 },
  visualRule: { height: 1, marginTop: 17, backgroundColor: '#E8ECE8' },
  rangeHead: { marginTop: 15, flexDirection: 'row', justifyContent: 'space-between' },
  rangeTitle: { color: '#42564A', fontSize: 10, fontWeight: '800' },
  rangeUnit: { color: '#829087', fontSize: 8, fontWeight: '800' },
  rangeBar: { height: 7, marginTop: 13, flexDirection: 'row', overflow: 'hidden', borderRadius: 99, backgroundColor: '#E8EFE8' },
  rangeStart: { width: '28%', backgroundColor: '#A7C9AE' },
  rangeMiddle: { width: '44%', backgroundColor: '#4C8C64' },
  rangeEnd: { flex: 1, backgroundColor: '#E8B18A' },
  rangeLabels: { marginTop: 7, flexDirection: 'row', justifyContent: 'space-between' },
  rangeLabel: { color: '#849087', fontSize: 7, fontWeight: '800' },
  visualFoot: { marginTop: 14, color: '#77847D', fontSize: 8 },
  section: { paddingTop: 72, paddingBottom: 67 },
  sectionTitle: { marginTop: 10, marginBottom: 26, color: '#20352D', fontSize: 31, lineHeight: 38, fontWeight: '800', letterSpacing: -.9 },
  sectionTitleCompact: { fontSize: 27, lineHeight: 33 },
  stepsGrid: { flexDirection: 'row', gap: 15 },
  stepsGridCompact: { flexDirection: 'column' },
  stepCard: { flex: 1, minHeight: 250, padding: 22, borderWidth: 1, borderColor: '#E6EBE6', borderRadius: 16, backgroundColor: '#FFFFFF' },
  stepCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepNumber: { color: '#C67A4F', fontSize: 10, fontWeight: '900' },
  stepIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF3ED' },
  stepIconText: { color: '#447A56', fontSize: 19, fontWeight: '800' },
  stepTitle: { marginTop: 28, color: '#20352D', fontSize: 16, fontWeight: '800' },
  stepText: { marginTop: 8, color: '#68776F', fontSize: 11, lineHeight: 18 },
  stepUnderline: { width: 38, height: 3, marginTop: 21, borderRadius: 3, backgroundColor: '#E89865' },
  noteBand: { padding: 24, flexDirection: 'row', gap: 14, borderWidth: 1, borderColor: '#DDE8DD', borderRadius: 15, backgroundColor: '#F0F5EF' },
  noteBandCompact: { padding: 19 },
  noteIcon: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCE9DC' },
  noteIconText: { color: '#447A56', fontSize: 15, fontWeight: '900' },
  noteCopy: { flex: 1 },
  noteTitle: { color: '#274B37', fontSize: 12, fontWeight: '800' },
  noteText: { marginTop: 6, color: '#63746A', fontSize: 10, lineHeight: 17 },
  lastCall: { marginTop: 29, padding: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20, borderRadius: 15, backgroundColor: '#F0EAE0' },
  lastCallCompact: { flexDirection: 'column', alignItems: 'stretch' },
  lastCallEyebrow: { color: '#9B6243', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  lastCallTitle: { marginTop: 8, color: '#20352D', fontSize: 19, fontWeight: '800' },
  lastCallButton: { minHeight: 45, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 10, backgroundColor: '#183D33' },
  lastCallButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  lastCallArrow: { color: '#F1A16D', fontSize: 16, fontWeight: '900' },
  pressed: { opacity: .83, transform: [{ scale: .98 }] },
});
