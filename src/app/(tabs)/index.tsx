import { useRouter } from 'expo-router';
import { useWindowDimensions, Pressable, ImageBackground, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { MarketingShell } from '@/components/MarketingShell';
import { PartsCarousel } from '@/components/PartsCarousel';

export default function HomeScreen() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 760;

  return (
    <MarketingShell active="home">
      <View style={styles.page}>
        <View style={[styles.heroOuter, compact && styles.heroOuterCompact]}>
          <ImageBackground source={require('../../../assets/images/check-workshop-hero.png')} resizeMode="cover" imageStyle={styles.heroImage} style={[styles.hero, compact && styles.heroCompact]}>
            <View style={styles.heroShade} />
            <View style={[styles.heroContent, compact && styles.heroContentCompact]}>
              <Animated.View entering={FadeInDown.duration(580).delay(80)} style={styles.heroEyebrow}><View style={styles.liveDot} /><Text style={styles.heroEyebrowText}>CHECK AUTO · TOGO</Text></Animated.View>
              <Animated.Text entering={FadeInDown.duration(700).delay(170)} style={[styles.heroTitle, compact && styles.heroTitleCompact]}>Avant de payer,{ '\n' }<Text style={styles.heroAccent}>vérifiez le prix.</Text></Animated.Text>
              <Animated.Text entering={FadeInDown.duration(700).delay(280)} style={styles.heroDescription}>Les pièces automobiles peuvent coûter très différemment d’un devis à l’autre. Check vous donne des repères documentés pour comparer en toute clarté.</Animated.Text>
              <Animated.View entering={FadeInDown.duration(650).delay(390)} style={[styles.heroActions, compact && styles.heroActionsCompact]}>
                <Pressable onPress={() => router.push('/catalogue')} accessibilityRole="button" style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>Rechercher une pièce</Text><Text style={styles.primaryArrow}>→</Text></Pressable>
                <Pressable onPress={() => router.push('/fonctionnement')} accessibilityRole="link" style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Découvrir Check</Text><Text style={styles.secondaryArrow}>↗</Text></Pressable>
              </Animated.View>
            </View>
            <Animated.View entering={FadeInUp.duration(800).delay(430)} style={[styles.heroFloatingCard, compact && styles.heroFloatingCardCompact]}>
              <View style={styles.floatingIcon}><Text style={styles.floatingIconText}>✓</Text></View>
              <View style={styles.floatingCopy}><Text style={styles.floatingEyebrow}>UN REPÈRE UTILE</Text><Text style={styles.floatingTitle}>Prix documentés</Text><Text style={styles.floatingText}>Source · unité · contexte</Text></View>
              <Text style={styles.floatingArrow}>↗</Text>
            </Animated.View>
            <Text style={styles.heroCaption}>Une pièce identifiée. Un repère plus clair.</Text>
          </ImageBackground>
        </View>

        <PartsCarousel />

        <Animated.View entering={FadeInUp.duration(700).delay(100)} style={[styles.problemBand, compact && styles.problemBandCompact]}>
          <View style={styles.problemCopy}>
            <Text style={styles.sectionEyebrow}>LE PROBLÈME</Text>
            <Text style={[styles.problemTitle, compact && styles.problemTitleCompact]}>Quand on ne connaît pas le prix, comment savoir si le devis est juste ?</Text>
            <Text style={styles.problemText}>Un nom de pièce, une référence ou une unité qui change : comparer devient vite compliqué. Check est conçu pour rendre ces repères plus lisibles.</Text>
            <Pressable onPress={() => router.push('/problem')} style={styles.textLink}><Text style={styles.textLinkLabel}>Comprendre le problème</Text><Text style={styles.textLinkArrow}>→</Text></Pressable>
          </View>
          <View style={styles.priceContrast}>
            <View style={styles.contrastHeader}><Text style={styles.contrastHeaderText}>POURQUOI COMPARER ?</Text><View style={styles.contrastIcon}><Text style={styles.contrastIconText}>↗</Text></View></View>
            <View style={styles.contrastRow}><View><Text style={styles.contrastLabel}>REPÈRE EXEMPLE</Text><Text style={styles.contrastPrice}>10 000 <Text style={styles.currency}>XOF</Text></Text></View><Text style={styles.contrastArrow}>→</Text><View><Text style={styles.contrastLabel}>DEVIS EXEMPLE</Text><Text style={styles.contrastPriceHigh}>30 000 <Text style={styles.currency}>XOF</Text></Text></View></View>
            <Text style={styles.contrastFoot}>Illustration uniquement. Une comparaison fiable tient compte de la référence, de l’unité et de la source.</Text>
          </View>
        </Animated.View>

        <View style={[styles.discoverySection, compact && styles.discoverySectionCompact]}>
          <View style={styles.discoveryHeading}><Text style={styles.sectionEyebrow}>UNE PLATEFORME, PLUSIEURS PARCOURS</Text><Text style={[styles.discoveryTitle, compact && styles.discoveryTitleCompact]}>Check vous accompagne à chaque étape.</Text></View>
          <View style={[styles.discoveryGrid, compact && styles.discoveryGridCompact]}>
            <DiscoveryCard index="01" title="Comprendre le problème" text="Pourquoi le prix d’une pièce est parfois difficile à contrôler." href="/problem" onPress={() => router.push('/problem')} />
            <DiscoveryCard index="02" title="Découvrir la méthode" text="Rechercher, comparer les repères, examiner un devis." href="/fonctionnement" onPress={() => router.push('/fonctionnement')} />
            <DiscoveryCard index="03" title="Pour les professionnels" text="Des repères utiles aux assureurs et aux fournisseurs partenaires." href="/professionnels" onPress={() => router.push('/professionnels')} />
          </View>
        </View>

        <Animated.View entering={FadeInDown.duration(720).delay(90)} style={[styles.finalCta, compact && styles.finalCtaCompact]}>
          <View style={styles.finalCtaCopy}><Text style={styles.finalCtaEyebrow}>PRÊT À COMPARER ?</Text><Text style={[styles.finalCtaTitle, compact && styles.finalCtaTitleCompact]}>Commencez par rechercher votre pièce.</Text><Text style={styles.finalCtaText}>Ouvrez le catalogue automobile Check et consultez les références disponibles.</Text></View>
          <Pressable onPress={() => router.push('/catalogue')} accessibilityRole="button" style={({ pressed }) => [styles.finalButton, pressed && styles.pressed]}><Text style={styles.finalButtonText}>Explorer le catalogue</Text><Text style={styles.finalButtonArrow}>→</Text></Pressable>
        </Animated.View>
      </View>
    </MarketingShell>
  );
}

function DiscoveryCard({ index, title, text, onPress }: { index: string; title: string; text: string; href: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={({ pressed }) => [styles.discoveryCard, pressed && styles.pressed]}>
      <View style={styles.discoveryTop}><Text style={styles.discoveryIndex}>{index}</Text><Text style={styles.discoveryArrow}>↗</Text></View>
      <Text style={styles.discoveryCardTitle}>{title}</Text><Text style={styles.discoveryCardText}>{text}</Text>
      <View style={styles.discoveryRule} />
      <Text style={styles.discoveryRead}>Découvrir la page <Text style={styles.discoveryReadArrow}>→</Text></Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', alignItems: 'center' },
  heroOuter: { width: '100%', maxWidth: 1320, paddingHorizontal: 20, paddingTop: 18, alignSelf: 'center' },
  heroOuterCompact: { paddingHorizontal: 12, paddingTop: 12 },
  hero: { minHeight: 510, padding: 48, justifyContent: 'center', overflow: 'hidden', borderRadius: 23, backgroundColor: '#183D33' },
  heroCompact: { minHeight: 635, padding: 26, paddingTop: 39, paddingBottom: 34, justifyContent: 'flex-start' },
  heroImage: { borderRadius: 23 },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10, 29, 23, .24)' },
  heroContent: { maxWidth: 635, zIndex: 1 },
  heroContentCompact: { maxWidth: '100%' },
  heroEyebrow: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,.16)', borderRadius: 99, backgroundColor: 'rgba(19,50,40,.8)' },
  liveDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: '#F1A16D' },
  heroEyebrowText: { color: '#E1EAE4', fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { marginTop: 25, color: '#FFFFFF', fontSize: 58, lineHeight: 64, fontWeight: '800', letterSpacing: -2 },
  heroTitleCompact: { marginTop: 24, fontSize: 41, lineHeight: 47, letterSpacing: -1.4 },
  heroAccent: { color: '#F5B281' },
  heroDescription: { maxWidth: 550, marginTop: 17, color: '#E1E9E3', fontSize: 14, lineHeight: 23 },
  heroActions: { marginTop: 26, flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroActionsCompact: { flexWrap: 'wrap' },
  primaryButton: { minHeight: 51, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 17, borderRadius: 11, backgroundColor: '#F1A16D' },
  primaryButtonText: { color: '#23392F', fontSize: 12, fontWeight: '900' },
  primaryArrow: { color: '#23392F', fontSize: 17, fontWeight: '900' },
  secondaryButton: { minHeight: 49, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,.38)', borderRadius: 11, backgroundColor: 'rgba(18,44,35,.35)' },
  secondaryButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  secondaryArrow: { color: '#F5B281', fontSize: 14, fontWeight: '800' },
  heroFloatingCard: { position: 'absolute', right: 40, bottom: 42, width: 270, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,.7)', borderRadius: 15, backgroundColor: 'rgba(255,255,255,.95)', zIndex: 2 },
  heroFloatingCardCompact: { right: 18, bottom: 53, width: '90%' },
  floatingIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F0E8' },
  floatingIconText: { color: '#3E7956', fontSize: 16, fontWeight: '900' },
  floatingCopy: { flex: 1 },
  floatingEyebrow: { color: '#87948B', fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  floatingTitle: { marginTop: 3, color: '#20352D', fontSize: 12, fontWeight: '900' },
  floatingText: { marginTop: 3, color: '#718078', fontSize: 9 },
  floatingArrow: { color: '#C97B4C', fontSize: 16, fontWeight: '900' },
  heroCaption: { position: 'absolute', bottom: 13, left: 22, color: 'rgba(255,255,255,.7)', fontSize: 8, zIndex: 1 },
  problemBand: { width: '100%', maxWidth: 1268, paddingHorizontal: 28, paddingVertical: 78, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 58 },
  problemBandCompact: { paddingHorizontal: 22, paddingVertical: 52, flexDirection: 'column', alignItems: 'stretch', gap: 28 },
  problemCopy: { flex: 1, maxWidth: 590 },
  sectionEyebrow: { color: '#A05F3C', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  problemTitle: { marginTop: 13, color: '#20352D', fontSize: 34, lineHeight: 41, fontWeight: '800', letterSpacing: -1 },
  problemTitleCompact: { fontSize: 29, lineHeight: 35 },
  problemText: { maxWidth: 520, marginTop: 12, color: '#68776F', fontSize: 13, lineHeight: 21 },
  textLink: { alignSelf: 'flex-start', marginTop: 19, flexDirection: 'row', alignItems: 'center', gap: 12 },
  textLinkLabel: { color: '#356648', fontSize: 11, fontWeight: '800' },
  textLinkArrow: { color: '#C8784C', fontSize: 17, fontWeight: '900' },
  priceContrast: { flex: 1, minWidth: 270, maxWidth: 490, padding: 23, borderRadius: 17, backgroundColor: '#FFFFFF', shadowColor: '#204232', shadowOpacity: .07, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  contrastHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contrastHeaderText: { color: '#819087', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  contrastIcon: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBEDE2' },
  contrastIconText: { color: '#C87548', fontSize: 15, fontWeight: '900' },
  contrastRow: { marginTop: 19, paddingVertical: 16, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderRadius: 12, backgroundColor: '#F7F8F5' },
  contrastLabel: { color: '#819087', fontSize: 7, fontWeight: '900', letterSpacing: .6 },
  contrastPrice: { marginTop: 7, color: '#377557', fontSize: 19, fontWeight: '900' },
  contrastPriceHigh: { marginTop: 7, color: '#B66243', fontSize: 19, fontWeight: '900' },
  currency: { fontSize: 8 },
  contrastArrow: { color: '#A9B3AC', fontSize: 17 },
  contrastFoot: { marginTop: 13, color: '#77847D', fontSize: 9, lineHeight: 15 },
  discoverySection: { width: '100%', paddingHorizontal: 26, paddingVertical: 76, backgroundColor: '#FFFFFF' },
  discoverySectionCompact: { paddingHorizontal: 21, paddingVertical: 52 },
  discoveryHeading: { width: '100%', maxWidth: 1216, marginBottom: 27, alignSelf: 'center' },
  discoveryTitle: { marginTop: 11, color: '#20352D', fontSize: 32, lineHeight: 39, fontWeight: '800', letterSpacing: -1 },
  discoveryTitleCompact: { fontSize: 27, lineHeight: 33 },
  discoveryGrid: { width: '100%', maxWidth: 1216, alignSelf: 'center', flexDirection: 'row', gap: 14 },
  discoveryGridCompact: { flexDirection: 'column' },
  discoveryCard: { flex: 1, minHeight: 220, padding: 20, borderWidth: 1, borderColor: '#E6EBE6', borderRadius: 15, backgroundColor: '#FBFCFA' },
  discoveryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  discoveryIndex: { color: '#C57B50', fontSize: 10, fontWeight: '900' },
  discoveryArrow: { color: '#5C7A66', fontSize: 17, fontWeight: '700' },
  discoveryCardTitle: { marginTop: 22, color: '#20352D', fontSize: 16, fontWeight: '800' },
  discoveryCardText: { minHeight: 42, marginTop: 8, color: '#68776F', fontSize: 11, lineHeight: 18 },
  discoveryRule: { height: 1, marginTop: 19, backgroundColor: '#E7ECE7' },
  discoveryRead: { marginTop: 13, color: '#477458', fontSize: 9, fontWeight: '800' },
  discoveryReadArrow: { color: '#CF7A4C', fontSize: 15 },
  finalCta: { width: '100%', maxWidth: 1216, marginVertical: 30, paddingHorizontal: 37, paddingVertical: 35, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 24, borderRadius: 18, backgroundColor: '#F0EAE0' },
  finalCtaCompact: { marginHorizontal: 18, width: 'auto', paddingHorizontal: 23, flexDirection: 'column', alignItems: 'stretch' },
  finalCtaCopy: { maxWidth: 620 },
  finalCtaEyebrow: { color: '#9B6243', fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  finalCtaTitle: { marginTop: 9, color: '#20352D', fontSize: 25, lineHeight: 31, fontWeight: '800' },
  finalCtaTitleCompact: { fontSize: 23, lineHeight: 29 },
  finalCtaText: { marginTop: 7, color: '#68776F', fontSize: 10, lineHeight: 16 },
  finalButton: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15, borderRadius: 10, backgroundColor: '#183D33' },
  finalButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  finalButtonArrow: { color: '#F1A16D', fontSize: 16, fontWeight: '900' },
  pressed: { opacity: .84, transform: [{ scale: .985 }] },
});
