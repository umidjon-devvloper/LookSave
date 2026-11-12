import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { notificationTarget } from './pushTarget';

/**
 * Push bildirishnomalar (05-mobile §9).
 *
 * ⚠️ Simulyatorda ishlamaydi — Expo push tokeni faqat haqiqiy qurilmada
 * beriladi. Shuning uchun `Device.isDevice` tekshiriladi va simulyatorda
 * jim o'tkazib yuboriladi.
 *
 * Push YETKAZILISHI KAFOLATLANMAGAN. Buyurtma holati ilovada ham
 * ko'rinadi — push faqat qulaylik.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Qurilmani serverga tanitish uchun barqaror id. */
function deviceId(): string {
  const parts = [Device.osName ?? 'unknown', Device.modelId ?? Device.modelName ?? 'device'];
  return parts.join('-').replace(/\s+/g, '-').slice(0, 120).padEnd(8, '0');
}

async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    // Kanal bo'lmasa Android'da bildirishnoma ovozsiz keladi
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Buyurtmalar',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8B5CF6',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  // Ruxsat berilmasa ham qurilma ro'yxatga olinadi — token'siz
  if (status !== 'granted') return null;

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    // `projectId` sozlanmagan yoki tarmoq yo'q
    return null;
  }
}

/**
 * Kirgan foydalanuvchi uchun qurilmani ro'yxatga oladi.
 *
 * Bildirishnoma BOSILISHI bu yerda emas — `useNotificationOpen` da.
 */
export function usePushRegistration(): void {
  const status = useAuthStore((state) => state.status);
  const registered = useRef(false);

  useEffect(() => {
    if (status !== 'signedIn' || registered.current) return;
    registered.current = true;

    void (async () => {
      const pushToken = await registerForPush();

      try {
        await api('/devices', {
          method: 'POST',
          body: {
            deviceId: deviceId(),
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
            pushToken,
          },
        });
      } catch {
        // Qurilma yozilmasa ham ilova ishlaydi, faqat push kelmaydi
      }
    })();
  }, [status]);
}

type Router = ReturnType<typeof useRouter>;

/*
 * Oxirgi qayta ishlangan bosish. Bitta bosish ikki yo'ldan kelishi mumkin
 * (tinglovchi va `getLastNotificationResponse`) — ekran ikki marta ochilmasin.
 */
let handledResponse: string | null = null;

function openNotification(response: Notifications.NotificationResponse, router: Router): void {
  const key = `${response.notification.request.identifier}|${response.actionIdentifier}`;
  if (key === handledResponse) return;
  handledResponse = key;

  try {
    // Native tomonda qolsa, JS qayta yuklanganda (OTA, dev) eski bosish yana ochilardi
    Notifications.clearLastNotificationResponse();
  } catch {
    // Eski native build'da bu metod yo'q — `handledResponse` yetarli
  }

  const target = notificationTarget(response.notification.request.content.data);
  if (target) router.push(target);
}

/**
 * Bildirishnoma bosilganda kerakli ekranni ochadi (`pushTarget.ts`).
 *
 * ⚠️ TAB LAYOUT ICHIDA CHAQIRILADI (`app/(tabs)/_layout.tsx`), ILDIZDA EMAS.
 *
 * Ilova YOPIQ paytda bildirishnoma bosilsa, expo-notifications javobni native
 * modul yaratilgan zahoti jo'natadi — JS tinglovchisi hali ulanmagan bo'ladi
 * va hodisa tushib qoladi: ilova ochilardi-yu, bosh sahifada qolardi
 * (2026-11-12 da simulyatorda takrorlandi). Shuning uchun ochilishda
 * `getLastNotificationResponse()` ham o'qiladi.
 *
 * Uni ildiz layout'da o'qish xavfli: u yerda Stack splash tugaguncha
 * chizilmaydi, kirish nuqtasi (`app/index.tsx`) esa keyin `/(tabs)` ga
 * `replace` qiladi va undan oldin qilingan `push` ni bosib ketishi mumkin.
 * Tab layout o'rnatilganda ikkalasi ham ortda qolgan bo'ladi.
 */
export function useNotificationOpen(): void {
  const router = useRouter();

  useEffect(() => {
    let launch: Notifications.NotificationResponse | null = null;
    try {
      launch = Notifications.getLastNotificationResponse();
    } catch {
      // Eski native build'da bu metod yo'q — faqat tinglovchi ishlaydi
    }
    if (launch) openNotification(launch, router);

    const subscription = Notifications.addNotificationResponseReceivedListener((response) =>
      openNotification(response, router),
    );

    return () => subscription.remove();
  }, [router]);
}
