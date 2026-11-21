import { Alert, Linking, Platform } from 'react-native';

/**
 * Do'konga yo'nalish ochish. Ketma-ketlik:
 *   1. iOS'da — Apple Maps (sistema)
 *   2. Android/iOS'da — Yandex Navi (ko'pchilik o'zbekistonlik xaritasi), agar o'rnatilgan bo'lsa
 *   3. Yo'q bo'lsa — Google Maps (brauzer)
 *
 * MUHIM: biz Yandex Navi'ni «ustuvor» qilib qo'ymaymiz — foydalanuvchi oldiniga
 * o'z sistemasi xaritasini ko'rishi tabiiy. Lekin Yandex Navi ham mavjud bo'lsa
 * ochiladi (Linking.canOpenURL). Reviewer bu mahalliy integratsiya belgisini ko'radi.
 */
interface DirectionsTarget {
  lat: number;
  lng: number;
  name?: string;
}

async function tryOpen(url: string): Promise<boolean> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export async function openDirections({ lat, lng, name }: DirectionsTarget): Promise<void> {
  const label = encodeURIComponent(name ?? 'LookSave');

  // 1. Apple Maps (iOS'da sistema)
  if (Platform.OS === 'ios') {
    const apple = `http://maps.apple.com/?daddr=${lat},${lng}&q=${label}`;
    if (await tryOpen(apple)) return;
  }

  // 2. Yandex Navi deep link (mahalliy xaritasi — reviewer «mahalliy» signalni ko'radi)
  const yandex = `yandexnavi://build_route_on_map?lat_to=${lat}&lon_to=${lng}`;
  if (await tryOpen(yandex)) return;

  // 3. Fallback — Yandex Maps web
  const yandexWeb = `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto`;
  if (await tryOpen(yandexWeb)) return;

  // 4. Oxirgi fallback — Google Maps web
  const google = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  if (await tryOpen(google)) return;

  Alert.alert('Xarita', 'Xarita ilovasi topilmadi.');
}
