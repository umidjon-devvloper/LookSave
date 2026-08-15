import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';

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
 * Kirgan foydalanuvchi uchun qurilmani ro'yxatga oladi va
 * bildirishnoma bosilganda buyurtma sahifasiga o'tkazadi.
 */
export function usePushRegistration(): void {
  const router = useRouter();
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

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      const orderId = data?.['orderId'];
      if (typeof orderId === 'string') router.push(`/order/${orderId}`);
    });

    return () => subscription.remove();
  }, [router]);
}
