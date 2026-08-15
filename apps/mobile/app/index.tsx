import { Redirect } from 'expo-router';

import { useAuthStore } from '../src/store/authStore';

/**
 * Kirish nuqtasi. Auth holatiga qarab yo'naltiradi.
 *
 * ⚠️ Hujjatda (05-mobile §6.2) telefon → OTP oqimi ko'zda tutilgan.
 * Faza 1 da OTP yo'q — telefon + parol (5-bosqich qarori).
 */
export default function Index(): JSX.Element {
  const status = useAuthStore((state) => state.status);
  return <Redirect href={status === 'signedIn' ? '/(tabs)' : '/(auth)/welcome'} />;
}
