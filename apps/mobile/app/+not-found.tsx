import { useRouter } from 'expo-router';

import { Button, Empty, Screen } from '../src/components/ui';
import { useI18n } from '../src/i18n';

/**
 * Mavjud bo'lmagan manzil — eskirgan chuqur havola yoki xato yozilgan yo'l.
 *
 * NEGA KERAK: bu fayl bo'lmasa expo-router o'zining standart sahifasini
 * ko'rsatadi — qora fon, inglizcha «Unmatched Route» va ishlab chiquvchilar
 * uchun «Sitemap» havolasi. Yorug' ilovada u begona ko'rinardi va
 * foydalanuvchini ilovaning ichki marshrutlar ro'yxatiga olib kirardi.
 */
export default function NotFound(): JSX.Element {
  const router = useRouter();
  const t = useI18n((state) => state.t);

  return (
    <Screen>
      <Empty
        title={t.errors.pageNotFound}
        action={<Button title={t.errors.goHome} onPress={() => router.replace('/(tabs)')} />}
      />
    </Screen>
  );
}
