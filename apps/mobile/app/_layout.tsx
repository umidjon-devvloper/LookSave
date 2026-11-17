import {
  Fraunces_500Medium,
  Fraunces_500Medium_Italic,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { requireOptionalNativeModule } from 'expo';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '../src/api/queryClient';
import { AnimatedSplash } from '../src/components/AnimatedSplash';
import type { VideoSplash as VideoSplashComponent } from '../src/components/VideoSplash';
import { withScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { ErrorView } from '../src/components/ui';
import { usePushRegistration } from '../src/hooks/usePush';
import { useI18n } from '../src/i18n';
import { useAiFlowStore } from '../src/store/aiFlowStore';
import { useAuthStore } from '../src/store/authStore';
import { useLookStore } from '../src/store/lookStore';
import { useOnboardingStore } from '../src/store/onboardingStore';
import { colors } from '../src/theme/tokens';

/*
 * Brend videosi faqat `expo-video` native moduli bor build'da.
 *
 * ⚠️ `import` EMAS, SHARTLI `require`. `expo-video` yuklanishi bilan
 * native modulni talab qiladi va u bo'lmasa DARHOL yiqiladi. Modul yo'q
 * build'ga (masalan, eski ilovaga OTA update tushganda) splash videosiz,
 * eski animatsiya bilan ochiladi.
 */
const VideoSplash = requireOptionalNativeModule('ExpoVideo')
  ? (require('../src/components/VideoSplash') as { VideoSplash: typeof VideoSplashComponent })
      .VideoSplash
  : null;

// Native splash o'zi yashirinmasin — uni `AnimatedSplash` chizilgach o'zimiz
// yashiramiz, aks holda ikkisi orasida bo'sh kadr ko'rinib qoladi.
void SplashScreen.preventAutoHideAsync().catch(() => {
  // Modul ikki marta yuklansa xato beradi — sahnaga ta'siri yo'q
});

function AppShell(): JSX.Element {
  const status = useAuthStore((state) => state.status);
  const restore = useAuthStore((state) => state.restore);
  const restoreStore = useAiFlowStore((state) => state.restoreStore);
  const restoreLook = useLookStore((state) => state.restore);
  const restoreOnboarding = useOnboardingStore((state) => state.restore);
  const onboardingSeen = useOnboardingStore((state) => state.seen);
  const t = useI18n((state) => state.t);

  usePushRegistration();

  // Atelier identity (06-dizayn.md §3): Fraunces editorial serif display +
  // Inter humanist sans body. Shrift yuklanmaguncha ekran ko'rsatilmaydi —
  // aks holda tizim shriftidan sakrash sezilib qoladi va sarlavhalar o'z
  // tortishini yo'qotadi.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Fraunces_500Medium,
    Fraunces_500Medium_Italic,
    Fraunces_600SemiBold,
  });

  useEffect(() => {
    void restore();
    /*
     * Onboarding bayrog'ini qurilmadan tiklaymiz — kirish nuqtasi
     * (`app/index.tsx`) ilk ochilishni shunga qarab aniqlaydi. Kirishdan
     * mustaqil, tokensiz o'qiladi.
     */
    void restoreOnboarding();
    /*
     * Saqlangan do'konni tiklaymiz.
     *
     * ⚠️ KIRISHDAN MUSTAQIL. Do'kon akkauntga emas, QURILMAGA bog'langan
     * va uni tiklash uchun token kerak emas. Kirish tiklanishini kutsak,
     * tarmoq sekin bo'lganda kiyintirish ekrani do'konsiz ochilib,
     * foydalanuvchini sehrgarga yuborib yuborardi.
     */
    void restoreStore();
    /*
     * «Look» savati va kiyib ko'rish urinishlari ham qurilmada saqlangan.
     * Tiklanadi — shunda nishon darhol to'g'ri sonni ko'rsatadi, primerka
     * esa navbatda qolgan (yoki tayyor bo'lgan) natijani topadi.
     */
    void restoreLook();
  }, [restore, restoreStore, restoreLook, restoreOnboarding]);

  // Splash animatsiyasi tugagunicha qatlam ekranda turadi. `appReady` — sahnaga
  // "endi chiqishing mumkin" degan signal; sahna o'z animatsiyasini yarim yo'lda
  // uzmaydi, shuning uchun tez yuklanganda ham to'liq ko'rinadi.
  // Onboarding bayrog'i o'qilmaguncha (`null`) splash ushlab turiladi: aks
  // holda kirish nuqtasi ilk-ochilishni bilmay (tabs) ga sakrab, onboarding
  // uning ustidan ochilib miltillardi.
  const normalReady = fontsLoaded && status !== 'loading' && onboardingSeen !== null;

  /*
   * ⚠️ SPLASH TIMEOUT — ILOVANI "DOIM OCHILADIGAN" QILADI.
   *
   * Google Play 2026-11-03 da «ilova ochilmayapti» uchun politika buzilishi
   * yubordi. Agar font yuklash, auth tiklash yoki SecureStore bironta sabab
   * bilan osilib qolsa (sekin tarmoq, native modul kutilmagan xato), splash
   * cheksiz turardi — Google reviewer buni "yiqilgan" deb hisoblaydi.
   *
   * 6 soniyadan keyin baribir UI ni ochamiz: `status === 'loading'` bo'lsa
   * ekran kerakli joyga (sign-in yoki (tabs)) o'zi yo'naltirib yuboradi.
   */
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 6000);
    return () => clearTimeout(timer);
  }, []);
  const appReady = normalReady || timedOut;
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashFinish = useCallback(() => setSplashDone(true), []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Atelier yorug' fon — status bar ikoni va soati qora chiziladi */}
      <StatusBar style="dark" />
      {appReady ? (
        <Stack
          // Har ekran o'z xato chegarasida: chizishdagi xato ilovani yopmaydi (`ScreenErrorBoundary`)
          screenLayout={withScreenErrorBoundary}
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            // Orqaga tugmasida marshrut nomi ko'rinmasin: "(tabs)" chiqib qolardi
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          {/*
            ⚠️ KIRISH MARSHRUTI HAM SARLAVHASIZ. `app/index.tsx` faqat
            yo'naltiradi, lekin bu yerda e'lon qilinmagani uchun standart
            sarlavha bilan ochilib, darhol sarlavhasiz ekranga (onboarding yoki
            tablar) almashardi. iOS 27 da shu almashuvdan keyin yangi ekranning
            native ramkasi sarlavha balandligicha (116 pt) kalta qolardi:
            onboarding'dagi «Next» tugmasi ko'rinardi, lekin BOSILMASDI
            (ramkadan tashqarida). Sarlavha umuman chiqmasa, almashuv ham yo'q.
          */}
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* Ilk ochilish onboarding'i — to'liq ekran, o'z tugmalari bilan */}
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          {/* AI oqimi to'liq ekran — tab qatori ustidan ochiladi va uni yashiradi */}
          <Stack.Screen name="ai" options={{ headerShown: false }} />
          {/*
            Sotuvchi paneli o'z sarlavhalarini chizadi. Bu qator bo'lmasa
            ildiz Stack ham sarlavha qo'yadi va ekranda IKKITA sarlavha
            hamda ikkita orqaga tugmasi ko'rinadi.
          */}
          <Stack.Screen name="seller" options={{ headerShown: false }} />
          {/*
            Do'kon ochish arizasi — seller Tabs ichida yashirin ekran edi
            va iOS'da TextInput fokusi klaviatura ochmasdi. Root Stack'ga
            olib chiqildi (2026-11-10) — Tabs rendering intercepti yo'q.
          */}
          <Stack.Screen name="become-seller" options={{ headerShown: false }} />
          {/* Rasm status bar ostiga chiqadi — sahifa o'z tugmalarini chizadi */}
          <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="store/[id]" options={{ headerShown: false }} />
          {/* Checkout'da o'z sarlavhasi bor */}
          <Stack.Screen name="checkout" options={{ headerShown: false }} />
          <Stack.Screen name="order/[id]" options={{ title: t.order.title }} />
          {/* Buyurtmalarda o'z sarlavhasi bor */}
          <Stack.Screen name="orders" options={{ headerShown: false }} />
          <Stack.Screen name="favorites" options={{ title: t.profile.myFavorites }} />
          <Stack.Screen name="looks" options={{ title: t.profile.myLooks }} />
          {/* Katalog va kolleksiyada o'z sarlavhasi bor (orqaga, nom, savat) */}
          <Stack.Screen name="catalog" options={{ headerShown: false }} />
          <Stack.Screen name="collection" options={{ headerShown: false }} />
          {/* Market ichma-ich oqimi: do`konlar → kategoriyalar (o`z sarlavhasi bor) */}
          <Stack.Screen name="market" options={{ headerShown: false }} />
          <Stack.Screen name="stores" options={{ title: t.tabs.stores }} />
          <Stack.Screen name="anywear" options={{ headerShown: false }} />
          {/* O'lchamlar ekranida o'z sarlavhasi bor */}
          <Stack.Screen name="settings/measurements" options={{ headerShown: false }} />
          <Stack.Screen name="settings/profile" options={{ title: t.profile.editProfile }} />
          {/* Bu qator bo'lmasa sarlavhada marshrut nomi chiqadi: «settings/face-photo» */}
          <Stack.Screen name="settings/face-photo" options={{ title: t.profile.facePhoto }} />
          <Stack.Screen
            name="settings/delete-account"
            options={{ title: t.profile.deleteAccount }}
          />
          {/* Mavjud bo'lmagan havola — expo-router'ning qora standart sahifasi o'rniga */}
          <Stack.Screen name="+not-found" options={{ headerShown: false }} />
        </Stack>
      ) : null}
      {splashDone ? null : VideoSplash ? (
        <VideoSplash appReady={appReady} onFinish={handleSplashFinish} />
      ) : (
        <AnimatedSplash
          fontsLoaded={fontsLoaded}
          appReady={appReady}
          onFinish={handleSplashFinish}
        />
      )}
    </View>
  );
}

/**
 * Ekranni CHIZISH paytidagi kutilmagan xato — ilova yopilib ketmasin.
 *
 * ⚠️ NEGA KERAK. Release build'da chizish xatosi (masalan, serverdan
 * kutilmagan shakldagi javob kelib, `undefined.map` chaqirilsa) hech kim
 * ushlamasa butun ilovani yopadi — foydalanuvchi uchun bu «qulash», App
 * Review uchun esa 2.1(a). Ilovada shu paytgacha bironta ham xato chegarasi
 * yo'q edi. expo-router shu nomli eksportni o'zi topib, ildiz tartibni u
 * bilan o'raydi (`useScreens` → `Try`): xato chiqsa quyidagi ekran
 * ko'rsatiladi, «Qayta urinish» esa ilovani boshidan chizadi.
 *
 * ⚠️ BU YERDA ILDIZ TARTIBNING O'ZI YO'Q. Chegara ishlaganda `RootLayout`
 * (provayderlari bilan) chizilmaydi, shuning uchun bu ekran faqat hech
 * narsaga bog'liq bo'lmagan qismlardan yig'ilgan: matn lug'atdan
 * (`zustand` — provayder kerak emas), `ErrorView` esa so'rov keshiga tegmaydi.
 * Native splash hali yopilmagan bo'lishi mumkin — u ham shu yerda yopiladi,
 * aks holda bu ekran splash ostida ko'rinmay qolardi.
 *
 * ⚠️ BU — OXIRGI TO'SIQ. Odatda xato bu yergacha yetib kelmaydi: har
 * ekranning o'z chegarasi bor (`ScreenErrorBoundary`, navigatorlarning
 * `screenLayout` i) va u navigatsiyani saqlab qoladi. Bu yer navigator yoki
 * tartibning o'zi yiqilgan holat uchun.
 *
 * Bu faqat CHIZISH xatolarini ushlaydi; tugma bosilgandagi yoki tarmoq
 * so'rovidagi xatolar o'z joyida (`onError`, `explainError`) hal qilinadi.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps): JSX.Element {
  useEffect(() => {
    console.warn('[app] chizishda xato ushlandi', error);
    void SplashScreen.hideAsync().catch(() => {
      // Allaqachon yopilgan bo'lishi mumkin — bu xato emas
    });
  }, [error]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="dark" />
      <ErrorView onRetry={() => void retry()} />
    </View>
  );
}

export default function RootLayout(): JSX.Element {
  return (
    // ⚠️ GestureHandlerRootView ILDIZDA SHART. Usiz ba'zi qurilmalarda
    // (ayniqsa iPad va yangi iOS) touch tizimi noto'g'ri ishlashi mumkin.
    // Expo/RN rasmiy tavsiyasi — butun ilovani shu bilan o'rash.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppShell />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
