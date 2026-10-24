import { useRouter } from 'expo-router';
import { useWindowDimensions, Pressable, ImageBackground, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { MarketingShell } from '@/components/MarketingShell';

export default function ProblemPage() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 760;

  return (
    <MarketingShell active="problem">
      <View style={styles.page}>
        <Animated.View entering={FadeInDown.duration(650)} style={[styles.intro, compact && styles.introCompact]}>
          <View style={styles.introCopy}>
            <Text style={styles.eyebrow}>LE CONSTAT</Text>
            <Text style={[styles.title, compact && styles.titleCompact]}>Un devis arrive.{ '\n' }Le bon prix, lui, est moins évident.</Text>
            <Text style={styles.lead}>Quand une pièce doit être remplacée, la plupart des gens n’ont pas de repère simple pour vérifier le montant indiqué.</Text>
            <Pressable onPress={() => router.push('/fonctionnement')} style={styles.link}><Text style={styles.linkText}>Voir comment Check aide</Text><Text style={styles.linkArrow}>→</Text></Pressable>
          </View>
          <ImageBackground source={require('../../assets/images/part-brakes.webp')} resizeMode="cover" imageStyle={styles.imageRadius} style={[styles.imageCard, compact && styles.imageCardCompact]}>
            <View style={styles.imageLabel}><Text style={styles.imageLabelText}>FREINAGE · EXEMPLE DE PIÈCE</Text></View>
          </ImageBackground>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(700).delay(100)} style={[styles.exampleBand, compact && styles.exampleBandCompact]}>
          <View style={styles.exampleCopy}><Text style={styles.exampleEyebrow}>UN ÉCART QUI INTERROGE</Text><Text style={styles.exampleTitle}>Une pièce estimée à 10 000 XOF et facturée 30 000 XOF.</Text><Text style={styles.exampleText}>Cet exemple illustre le besoin de comparaison. À lui seul, un écart ne prouve pas une surfacturation : il faut vérifier le produit exact, la qualité, l’unité et la source du prix.</Text></View>
          <View style={styles.comparisonCard}>
            <View style={styles.comparisonItem}><Text style={styles.comparisonLabel}>REPÈRE EXEMPLE</Text><Text style={styles.comparisonPrice}>10 000</Text><Text style={styles.comparisonCurrency}>XOF</Text></View>
            <Text style={styles.comparisonArrow}>→</Text>
            <View style={styles.comparisonItem}><Text style={styles.comparisonLabel}>DEVIS EXEMPLE</Text><Text style={styles.comparisonPriceHigh}>30 000</Text><Text style={styles.comparisonCurrency}>XOF</Text></View>
          </View>
        </Animated.View>

        <View style={styles.section}>
          <Text style={styles.eyebrow}>POURQUOI C’EST COMPLIQUÉ</Text>
          <Text style={[styles.sectionTitle, compact && styles.titleCompact]}>Trois obstacles au moment de comparer.</Text>
          <View style={[styles.cards, compact && styles.cardsCompact]}>
            <Issue number="01" title="On ne connaît pas le prix" text="Sans catalogue de référence sous la main, difficile de savoir si le montant est dans le bon ordre de grandeur." />
            <Issue number="02" title="Les noms ne correspondent pas toujours" text="Un libellé commercial, une référence constructeur et une désignation courante peuvent désigner la même pièce." />
            <Issue number="03" title="Comparer demande du contexte" text="La marque, l’unité, la disponibilité et la provenance influencent le prix." />
          </View>
        </View>

        <View style={[styles.cta, compact && styles.ctaCompact]}>
          <View style={styles.ctaCopy}><Text style={styles.ctaTitle}>C’est précisément le rôle de Check.</Text><Text style={styles.ctaText}>Donner un point de comparaison clair, avec la référence et la source qui permettent de bien le lire.</Text></View>
          <Pressable onPress={() => router.push('/catalogue')} accessibilityRole="button" style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}><Text style={styles.ctaButtonText}>Explorer le catalogue</Text><Text style={styles.ctaArrow}>→</Text></Pressable>
        </View>
      </View>
    </MarketingShell>
  );
}

function Issue({ number, title, text }: { number: string; title: string; text: string }) {
  return <Animated.View entering={FadeInUp.duration(600).delay(Number(number) * 110)} style={styles.issue}><Text style={styles.issueNumber}>{number}</Text><Text style={styles.issueTitle}>{title}</Text><Text style={styles.issueText}>{text}</Text></Animated.View>;
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 1268, paddingHorizontal: 28, paddingBottom: 44, alignSelf: 'center' },
  intro: { paddingTop: 65, paddingBottom: 62, flexDirection: 'row', alignItems: 'center', gap: 50 },
  introCompact: { paddingTop: 43, paddingBottom: 43, flexDirection: 'column', alignItems: 'stretch', gap: 28 },
  introCopy: { flex: 1, maxWidth: 600 },
  eyebrow: { color: '#A05F3C', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  title: { marginTop: 14, color: '#20352D', fontSize: 46, lineHeight: 52, fontWeight: '800', letterSpacing: -1.7 },
  titleCompact: { fontSize: 32, lineHeight: 38, letterSpacing: -1 },
  lead: { maxWidth: 550, marginTop: 17, color: '#68776F', fontSize: 14, lineHeight: 23 },
  link: { alignSelf: 'flex-start', marginTop: 23, flexDirection: 'row', alignItems: 'center', gap: 13 },
  linkText: { color: '#37684A', fontSize: 11, fontWeight: '800' },
  linkArrow: { color: '#C8784C', fontSize: 17, fontWeight: '900' },
  imageCard: { width: 410, height: 320, padding: 16, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 21, backgroundColor: '#183D33' },
  imageCardCompact: { width: '100%', height: 280 },
  imageRadius: { borderRadius: 21 },
  imageLabel: { alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 99, backgroundColor: 'rgba(24,61,51,.84)' },
  imageLabelText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  exampleBand: { padding: 29, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 28, borderRadius: 18, backgroundColor: '#183D33' },
  exampleBandCompact: { padding: 22, flexDirection: 'column', alignItems: 'stretch' },
  exampleCopy: { flex: 1, maxWidth: 600 },
  exampleEyebrow: { color: '#F1A16D', fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  exampleTitle: { marginTop: 11, color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -.5 },
  exampleText: { marginTop: 9, color: '#D1DED6', fontSize: 10, lineHeight: 17 },
  comparisonCard: { minWidth: 320, padding: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 11, borderRadius: 13, backgroundColor: '#FFFFFF' },
  comparisonItem: { minWidth: 102 },
  comparisonLabel: { color: '#77877D', fontSize: 7, fontWeight: '900', letterSpacing: .7 },
  comparisonPrice: { marginTop: 7, color: '#397557', fontSize: 21, fontWeight: '900' },
  comparisonPriceHigh: { marginTop: 7, color: '#B66243', fontSize: 21, fontWeight: '900' },
  comparisonCurrency: { marginTop: 1, color: '#7D8A82', fontSize: 8, fontWeight: '700' },
  comparisonArrow: { color: '#A9B3AC', fontSize: 17 },
  section: { paddingTop: 73, paddingBottom: 58 },
  sectionTitle: { marginTop: 11, marginBottom: 28, color: '#20352D', fontSize: 30, lineHeight: 37, fontWeight: '800', letterSpacing: -.8 },
  cards: { flexDirection: 'row', gap: 14 },
  cardsCompact: { flexDirection: 'column' },
  issue: { flex: 1, minHeight: 190, padding: 20, borderWidth: 1, borderColor: '#E4EAE4', borderRadius: 15, backgroundColor: '#FFFFFF' },
  issueNumber: { color: '#C77A50', fontSize: 10, fontWeight: '900' },
  issueTitle: { marginTop: 23, color: '#20352D', fontSize: 15, fontWeight: '800' },
  issueText: { marginTop: 8, color: '#68776F', fontSize: 10, lineHeight: 17 },
  cta: { padding: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 22, borderRadius: 16, backgroundColor: '#F0EAE0' },
  ctaCompact: { flexDirection: 'column', alignItems: 'stretch' },
  ctaCopy: { maxWidth: 600 },
  ctaTitle: { color: '#20352D', fontSize: 20, fontWeight: '800' },
  ctaText: { marginTop: 7, color: '#68776F', fontSize: 10, lineHeight: 16 },
  ctaButton: { minHeight: 47, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 10, backgroundColor: '#183D33' },
  ctaButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  ctaArrow: { color: '#F1A16D', fontSize: 16, fontWeight: '900' },
  pressed: { opacity: .82, transform: [{ scale: .985 }] },
});
