import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';

const parts = [
  { label: 'FREINAGE', name: 'Disque & plaquettes', note: 'L’essentiel pour un freinage maîtrisé.', image: require('../../assets/images/part-brakes.webp') },
  { label: 'ÉCLAIRAGE', name: 'Bloc optique', note: 'Voir et être vu sur la route.', image: require('../../assets/images/part-headlight.webp') },
  { label: 'ÉLECTRICITÉ', name: 'Alternateur', note: 'L’énergie au cœur du véhicule.', image: require('../../assets/images/part-alternator.webp') },
  { label: 'SUSPENSION', name: 'Amortisseur', note: 'Confort et tenue de route.', image: require('../../assets/images/part-suspension.webp') },
];

export function PartsCarousel() {
  const router = useRouter();
  const listRef = useRef<ScrollViewInstance>(null);
  const activeIndex = useRef(0);
  const [activeDot, setActiveDot] = useState(0);
  const [playing, setPlaying] = useState(true);
  const { width } = useWindowDimensions();
  const cardWidth = width < 520 ? 238 : width < 900 ? 266 : 292;
  const stride = cardWidth + 16;

  const move = useCallback((direction: number) => {
    const current = activeIndex.current;
    const next = current + direction;
    if (direction > 0 && next === parts.length) {
      activeIndex.current = 0;
      setActiveDot(0);
      listRef.current?.scrollTo({ x: parts.length * stride, animated: true });
      setTimeout(() => listRef.current?.scrollTo({ x: 0, animated: false }), 520);
      return;
    }
    const normalized = next < 0 ? parts.length - 1 : next;
    activeIndex.current = normalized;
    setActiveDot(normalized);
    listRef.current?.scrollTo({ x: normalized * stride, animated: true });
  }, [stride]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => move(1), 3600);
    return () => clearInterval(timer);
  }, [move, playing]);

  return (
    <Animated.View entering={FadeInUp.duration(750).delay(140)} style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>UN APERÇU DU MONDE AUTO</Text>
          <Text style={styles.title}>Les pièces défilent.{ '\n' }Les bons repères aussi.</Text>
          <Text style={styles.subtitle}>Freinage, éclairage, électricité, suspension… Explorez les grandes familles de pièces suivies par Check.</Text>
        </View>
        <View style={styles.controls}>
          <Pressable onPress={() => move(-1)} accessibilityLabel="Pièce précédente" accessibilityRole="button" style={styles.arrowButton}><Text style={styles.arrowText}>←</Text></Pressable>
          <Pressable onPress={() => setPlaying((value) => !value)} accessibilityLabel={playing ? 'Mettre le carrousel en pause' : 'Lire le carrousel'} accessibilityRole="button" style={styles.playButton}><Text style={styles.playText}>{playing ? 'Ⅱ' : '▶'}</Text></Pressable>
          <Pressable onPress={() => move(1)} accessibilityLabel="Pièce suivante" accessibilityRole="button" style={styles.arrowButton}><Text style={styles.arrowText}>→</Text></Pressable>
        </View>
      </View>

      <View style={styles.viewport}>
        <ScrollView
          ref={listRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={stride}
          contentContainerStyle={styles.track}
          onMomentumScrollEnd={(event) => {
            const raw = Math.round(event.nativeEvent.contentOffset.x / stride);
            const normalized = raw % parts.length;
            activeIndex.current = normalized;
            setActiveDot(normalized);
            if (raw >= parts.length) listRef.current?.scrollTo({ x: normalized * stride, animated: false });
          }}>
          {[...parts, ...parts].map((part, index) => (
            <Pressable key={`${part.label}-${index}`} onPress={() => router.push('/catalogue')} accessibilityRole="button" accessibilityLabel={`Explorer le catalogue automobile : ${part.name}`} style={({ pressed }) => [styles.card, { width: cardWidth }, pressed && styles.cardPressed]}>
              <ImageBackground source={part.image} resizeMode="cover" style={styles.cardImage} imageStyle={styles.cardImageRadius}>
                <View style={styles.cardTop}><Text style={styles.cardCategory}>{part.label}</Text><View style={styles.cardCorner}><Text style={styles.cardCornerText}>↗</Text></View></View>
                <View style={styles.cardBottom}><Text style={styles.cardName}>{part.name}</Text><Text style={styles.cardNote}>{part.note}</Text><View style={styles.cardLink}><Text style={styles.cardLinkText}>Voir les références</Text><Text style={styles.cardLinkArrow}>→</Text></View></View>
              </ImageBackground>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.railFooter}>
        <View style={styles.dots}>{parts.map((part, index) => <Pressable key={part.label} onPress={() => { activeIndex.current = index; setActiveDot(index); listRef.current?.scrollTo({ x: index * stride, animated: true }); }} accessibilityLabel={`Afficher ${part.name}`} style={[styles.dot, activeDot === index && styles.dotActive]} />)}</View>
        <Text style={styles.railHint}>Images illustratives · Références et prix affichés dans le catalogue selon disponibilité</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%', paddingVertical: 74, overflow: 'hidden', backgroundColor: '#F7F8F5' },
  sectionHead: { width: '100%', maxWidth: 1230, marginBottom: 30, paddingHorizontal: 26, alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 22 },
  copy: { maxWidth: 650 },
  eyebrow: { color: '#9B6243', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  title: { marginTop: 11, color: '#20352D', fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1.1 },
  subtitle: { maxWidth: 600, marginTop: 10, color: '#68776F', fontSize: 13, lineHeight: 21 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrowButton: { width: 43, height: 43, borderWidth: 1, borderColor: '#DCE4DD', borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  arrowText: { color: '#274B3A', fontSize: 20, fontWeight: '600' },
  playButton: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5ECE6' },
  playText: { color: '#305740', fontSize: 12, fontWeight: '900' },
  viewport: { width: '100%', overflow: 'hidden' },
  track: { gap: 16, paddingHorizontal: 26, paddingBottom: 8 },
  card: { height: 320, overflow: 'hidden', borderRadius: 18, backgroundColor: '#183D33', shadowColor: '#19382C', shadowOpacity: .12, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  cardPressed: { opacity: .88, transform: [{ scale: .985 }] },
  cardImage: { flex: 1, justifyContent: 'space-between', padding: 16 },
  cardImageRadius: { borderRadius: 18 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardCategory: { paddingHorizontal: 10, paddingVertical: 7, overflow: 'hidden', borderRadius: 99, color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 1, backgroundColor: 'rgba(24,61,51,.78)' },
  cardCorner: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.9)' },
  cardCornerText: { color: '#284B3B', fontSize: 16, fontWeight: '900' },
  cardBottom: { marginHorizontal: -16, marginBottom: -16, paddingHorizontal: 17, paddingTop: 42, paddingBottom: 17, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, backgroundColor: 'rgba(17,43,35,.88)' },
  cardName: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: -.3 },
  cardNote: { marginTop: 4, color: '#D4E1D8', fontSize: 10 },
  cardLink: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLinkText: { color: '#F3B486', fontSize: 9, fontWeight: '800' },
  cardLinkArrow: { color: '#F3B486', fontSize: 17, fontWeight: '800' },
  railFooter: { width: '100%', maxWidth: 1230, marginTop: 18, paddingHorizontal: 26, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 18 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#C9D3CC' },
  dotActive: { width: 23, backgroundColor: '#D47D4F' },
  railHint: { color: '#859189', fontSize: 9 },
});
