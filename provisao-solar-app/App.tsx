import {
  DMSans_400Regular,
  DMSans_500Medium,
  useFonts as useDmSans,
} from '@expo-google-fonts/dm-sans';
import {
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts as useOutfit,
} from '@expo-google-fonts/outfit';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AppShell() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </>
  );
}

export default function App() {
  const [dmLoaded] = useDmSans({
    DMSans_400Regular,
    DMSans_500Medium,
  });
  const [outfitLoaded] = useOutfit({
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  const fontsReady = dmLoaded && outfitLoaded;

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsReady]);

  if (!fontsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppShell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
