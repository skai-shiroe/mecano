import { useRouter } from 'expo-router';
import { useWindowDimensions, Pressable, ImageBackground, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { MarketingShell } from '@/components/MarketingShell';

export default function ProfessionalsPage() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 760;
  return (
    <MarketingShell active="professionals">
      <View style={styles.page}>
        <ImageBackground source={require('../../assets/images/check-workshop-hero.png')} resizeMode="cover" imageStyle={styles.heroImage} style={[styles.hero, compact && styles.heroCompact]}>
          <View style={styles.heroShade} />
          <Animated.View entering={FadeInDown.duration(700)} style={styles.heroCopy}>
            <Text style={styles.eyebrow}>POUR LES PROFESSIONNELS</Text>
            <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>Un meilleur repère{ '\n' }pour chaque décision.</Text>
            <Text style={styles.heroText}>Check veut rapprocher les prix documentés des personnes qui examinent, paient ou fournissent les pièces automobiles.</Text>
            <Pressable onPress={() => router.push('/assureur')} accessibilityRole="button" style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}><Text style={styles.heroButtonText}>Accéder à l’espace assureur</Text><Text style={styles.heroButtonArrow}>→</Text></Pressable>
          </Animated.View>
        </ImageBackground>

        <View style={[styles.audienceGrid, compact && styles.audienceGridCompact]}>
          <PartnerCard delay={90} index="01" tag="ASSUREURS" title="Examiner les coûts avec davantage de contexte." text="Les prix de référence peuvent aider les équipes à rapprocher une ligne de devis d’un produit identifié, d’une unité et d’une source." icon="▤" />
          <PartnerCard delay={210} index="02" tag="FOURNISSEURS" title="Valoriser un catalogue fiable." text="À mesure que les partenariats se construisent, Check pourra présenter des offres et disponibilités de fournisseurs référencés." icon="▦" />
        </View>

        <Animated.View entering={FadeInUp.duration(650).delay(120)} style={[styles.futureBand, compact && styles.futureBandCompact]}>
          <View style={styles.futureMark}><Text style={styles.futureMarkText}>↗</Text></View>
          <View style={styles.futureCopy}><Text style={styles.futureEyebrow}>UNE PLATEFORME QUI GRANDIT</Text><Text style={styles.futureTitle}>Du prix de référence à la commande.</Text><Text style={styles.futureText}>La livraison fait partie de la vision de Check. Elle sera développée avec les partenaires et les parcours de commande, au fil des prochaines étapes.</Text></View>
          <View style={styles.futureSteps}><FutureStep number="1" label="Référence" /><View style={styles.futureConnector} /><FutureStep number="2" label="Fournisseur" /><View style={styles.futureConnector} /><FutureStep number="3" label="Livraison" /></View>
        </Animated.View>

        <View style={styles.trustSection}>
          <Text style={styles.eyebrow}>LES PRINCIPES DU SERVICE</Text>
          <Text style={[styles.trustTitle, compact && styles.trustTitleCompact]}>Des comparaisons utiles, avec leur contexte.</Text>
          <View style={[styles.trustGrid, compact && styles.trustGridCompact]}>
            <TrustItem title="Source visible" text="Chaque référence conserve les informations qui permettent de comprendre son origine." />
            <TrustItem title="Produit rapproché" text="La désignation, l’unité et la référence comptent pour comparer le bon article." />
            <TrustItem title="Accès maîtrisé" text="Les prix publiés restent soumis aux règles d’accès définies pour la plateforme." />
          </View>
        </View>

        <View style={[styles.finalCta, compact && styles.finalCtaCompact]}>
          <View><Text style={styles.finalEyebrow}>DÉCOUVREZ CHECK</Text><Text style={styles.finalTitle}>Explorez les références automobiles.</Text></View>
          <Pressable onPress={() => router.push('/assureur')} accessibilityRole="button" style={({ pressed }) => [styles.finalButton, pressed && styles.pressed]}><Text style={styles.finalButtonText}>Ouvrir l’espace assureur</Text><Text style={styles.finalArrow}>→</Text></Pressable>
        </View>
      </View>
    </MarketingShell>
  );
}

function PartnerCard({ delay, index, tag, title, text, icon }: { delay: number; index: string; tag: string; title: string; text: string; icon: string }) {
  return <Animated.View entering={FadeInUp.duration(650).delay(delay)} style={styles.partnerCard}><View style={styles.partnerTop}><View style={styles.partnerIcon}><Text style={styles.partnerIconText}>{icon}</Text></View><Text style={styles.partnerIndex}>{index}</Text></View><Text style={styles.partnerTag}>{tag}</Text><Text style={styles.partnerTitle}>{title}</Text><Text style={styles.partnerText}>{text}</Text></Animated.View>;
}

function FutureStep({ number, label }: { number: string; label: string }) {
  return <View style={styles.futureStep}><View style={styles.futureStepNumber}><Text style={styles.futureStepNumberText}>{number}</Text></View><Text style={styles.futureStepLabel}>{label}</Text></View>;
}

function TrustItem({ title, text }: { title: string; text: string }) {
  return <View style={styles.trustItem}><View style={styles.trustTick}><Text style={styles.trustTickText}>✓</Text></View><View style={styles.trustItemCopy}><Text style={styles.trustItemTitle}>{title}</Text><Text style={styles.trustItemText}>{text}</Text></View></View>;
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 1268, paddingHorizontal: 28, paddingBottom: 45, alignSelf: 'center' },
  hero: { minHeight: 425, marginTop: 23, padding: 42, justifyContent: 'center', overflow: 'hidden', borderRadius: 22, backgroundColor: '#183D33' },
  heroCompact: { minHeight: 485, marginTop: 13, padding: 24, paddingVertical: 35, justifyContent: 'flex-start' },
  heroImage: { borderRadius: 22 },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(11, 31, 25, .36)' },
  heroCopy: { maxWidth: 650, zIndex: 1 },
  eyebrow: { color: '#F1A16D', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  heroTitle: { marginTop: 15, color: '#FFFFFF', fontSize: 48, lineHeight: 55, fontWeight: '800', letterSpacing: -1.6 },
  heroTitleCompact: { fontSize: 36, lineHeight: 42 },
  heroText: { maxWidth: 540, marginTop: 13, color: '#E1E9E3', fontSize: 13, lineHeight: 22 },
  heroButton: { alignSelf: 'flex-start', minHeight: 47, marginTop: 22, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 10, backgroundColor: '#F1A16D' },
  heroButtonText: { color: '#20352D', fontSize: 10, fontWeight: '900' },
  heroButtonArrow: { color: '#20352D', fontSize: 16, fontWeight: '900' },
  audienceGrid: { marginTop: 25, flexDirection: 'row', gap: 15 },
  audienceGridCompact: { flexDirection: 'column' },
  partnerCard: { flex: 1, minHeight: 255, padding: 24, borderWidth: 1, borderColor: '#E4EAE4', borderRadius: 16, backgroundColor: '#FFFFFF' },
  partnerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  partnerIcon: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF3ED' },
  partnerIconText: { color: '#477758', fontSize: 20 },
  partnerIndex: { color: '#C77A50', fontSize: 10, fontWeight: '900' },
  partnerTag: { marginTop: 19, color: '#7C8A80', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  partnerTitle: { maxWidth: 480, marginTop: 8, color: '#20352D', fontSize: 19, lineHeight: 25, fontWeight: '800' },
  partnerText: { maxWidth: 510, marginTop: 8, color: '#68776F', fontSize: 11, lineHeight: 18 },
  futureBand: { marginTop: 23, padding: 25, flexDirection: 'row', alignItems: 'center', gap: 17, borderRadius: 17, backgroundColor: '#F1EEE7' },
  futureBandCompact: { padding: 20, flexDirection: 'column', alignItems: 'stretch' },
  futureMark: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8D9C9' },
  futureMarkText: { color: '#A56946', fontSize: 18, fontWeight: '900' },
  futureCopy: { flex: 1, maxWidth: 500 },
  futureEyebrow: { color: '#9D6545', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  futureTitle: { marginTop: 6, color: '#20352D', fontSize: 16, fontWeight: '800' },
  futureText: { marginTop: 5, color: '#69786F', fontSize: 10, lineHeight: 16 },
  futureSteps: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  futureStep: { alignItems: 'center', gap: 5 },
  futureStepNumber: { width: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  futureStepNumberText: { color: '#3E7552', fontSize: 9, fontWeight: '900' },
  futureStepLabel: { color: '#708076', fontSize: 7, fontWeight: '700' },
  futureConnector: { width: 17, height: 1, marginBottom: 13, backgroundColor: '#CFC6B9' },
  trustSection: { paddingTop: 73, paddingBottom: 67 },
  trustTitle: { marginTop: 10, marginBottom: 25, color: '#20352D', fontSize: 29, lineHeight: 36, fontWeight: '800', letterSpacing: -.8 },
  trustTitleCompact: { fontSize: 25, lineHeight: 31 },
  trustGrid: { flexDirection: 'row', gap: 18 },
  trustGridCompact: { flexDirection: 'column' },
  trustItem: { flex: 1, flexDirection: 'row', gap: 11 },
  trustTick: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5EFE5' },
  trustTickText: { color: '#3B7651', fontSize: 12, fontWeight: '900' },
  trustItemCopy: { flex: 1 },
  trustItemTitle: { color: '#20352D', fontSize: 11, fontWeight: '800' },
  trustItemText: { marginTop: 5, color: '#718078', fontSize: 10, lineHeight: 16 },
  finalCta: { padding: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18, borderRadius: 15, backgroundColor: '#183D33' },
  finalCtaCompact: { flexDirection: 'column', alignItems: 'stretch' },
  finalEyebrow: { color: '#F1A16D', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  finalTitle: { marginTop: 7, color: '#FFFFFF', fontSize: 19, fontWeight: '800' },
  finalButton: { minHeight: 45, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 10, backgroundColor: '#2A5043' },
  finalButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  finalArrow: { color: '#F1A16D', fontSize: 15, fontWeight: '900' },
  pressed: { opacity: .83, transform: [{ scale: .98 }] },
});
