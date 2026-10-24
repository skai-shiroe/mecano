import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '@/config/env';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider } from '@/hooks/useAuth';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  anchor: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) return null;

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
        <Stack.Screen name="admin/review" options={{ headerShown: false }} />
        <Stack.Screen name="admin/suppliers" options={{ headerShown: false }} />
        <Stack.Screen name="admin/assureurs" options={{ headerShown: false }} />
        <Stack.Screen name="fournisseurs" options={{ headerShown: false }} />
        <Stack.Screen name="offres" options={{ headerShown: false }} />
        <Stack.Screen name="comparer" options={{ headerShown: false }} />
        <Stack.Screen name="assureur" options={{ headerShown: false }} />
        <Stack.Screen name="assureur/dossiers" options={{ headerShown: false }} />
        <Stack.Screen name="assureur/dossiers/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="assureur/catalogue" options={{ headerShown: false }} />
        <Stack.Screen name="assureur/offres" options={{ headerShown: false }} />
        <Stack.Screen name="assureur/parametres" options={{ headerShown: false }} />
        <Stack.Screen name="assureur/invitation" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
