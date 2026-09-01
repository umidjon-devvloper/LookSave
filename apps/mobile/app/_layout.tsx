import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplash } from '../src/components/AnimatedSplash';
import { usePushRegistration } from '../src/hooks/usePush';
import { useI18n } from '../src/i18n';
import { useAuthStore } from '../src/store/authStore';
import { colors } from '../src/theme/tokens';

// Native splash o'zi yashirinmasin — uni `AnimatedSplash` chizilgach o'zimiz
// yashiramiz, aks holda ikkisi orasida bo'sh kadr ko'rinib qoladi.
void SplashScreen.preventAutoHideAsync().catch(() => {
  // Modul ikki marta yuklansa xato beradi — sahnaga ta'siri yo'q
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      // Mobil tarmoq beqaror — oyna fokusida qayta so'rash trafikni yeydi
      refetchOnWindowFocus: false,
    },
  },
});

function AppShell(): JSX.Element {
  const status = useAuthStore((state) => state.status);
  const restore = useAuthStore((state) => state.restore);
  const t = useI18n((state) => state.t);

  usePushRegistration();

  // Deckdagi grotesk o'rniga Inter (06-dizayn.md §3). Shrift yuklanmaguncha
  // ekran ko'rsatilmaydi — aks holda tizim shriftidan Inter'ga sakrash sezilib qoladi.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    void restore();
  }, [restore]);

  // Splash animatsiyasi tugagunicha qatlam ekranda turadi. `appReady` — sahnaga
  // "endi chiqishing mumkin" degan signal; sahna o'z animatsiyasini yarim yo'lda
  // uzmaydi, shuning uchun tez yuklanganda ham to'liq ko'rinadi.
  const appReady = fontsLoaded && status !== 'loading';
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashFinish = useCallback(() => setSplashDone(true), []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      {appReady ? (
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            // Orqaga tugmasida marshrut nomi ko'rinmasin: "(tabs)" chiqib qolardi
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          {/* AI oqimi to'liq ekran — tab qatori ustidan ochiladi va uni yashiradi */}
          <Stack.Screen name="ai" options={{ headerShown: false }} />
          {/*
            Sotuvchi paneli o'z sarlavhalarini chizadi. Bu qator bo'lmasa
            ildiz Stack ham sarlavha qo'yadi va ekranda IKKITA sarlavha
            hamda ikkita orqaga tugmasi ko'rinadi.
          */}
          <Stack.Screen name="seller" options={{ headerShown: false }} />
          {/* Rasm status bar ostiga chiqadi — sahifa o'z tugmalarini chizadi */}
          <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="store/[id]" options={{ title: '' }} />
          {/* Checkout'da o'z sarlavhasi bor */}
          <Stack.Screen name="checkout" options={{ headerShown: false }} />
          <Stack.Screen name="order/[id]" options={{ title: t.order.title }} />
          {/* Buyurtmalarda o'z sarlavhasi bor */}
          <Stack.Screen name="orders" options={{ headerShown: false }} />
          <Stack.Screen name="favorites" options={{ title: 'Sevimlilar' }} />
          <Stack.Screen name="looks" options={{ title: 'Komplektlarim' }} />
          {/* Katalog va kolleksiyada o'z sarlavhasi bor (orqaga, nom, savat) */}
          <Stack.Screen name="catalog" options={{ headerShown: false }} />
          <Stack.Screen name="collection" options={{ headerShown: false }} />
          <Stack.Screen name="stores" options={{ title: t.tabs.stores }} />
          {/* O'lchamlar ekranida o'z sarlavhasi bor */}
          <Stack.Screen name="settings/measurements" options={{ headerShown: false }} />
          <Stack.Screen
            name="settings/delete-account"
            options={{ title: t.profile.deleteAccount }}
          />
        </Stack>
      ) : null}
      {splashDone ? null : (
        <AnimatedSplash
          fontsLoaded={fontsLoaded}
          appReady={appReady}
          onFinish={handleSplashFinish}
        />
      )}
    </View>
  );
}

export default function RootLayout(): JSX.Element {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppShell />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
