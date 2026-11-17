import { router } from 'expo-router';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View } from 'react-native';

import { useI18n } from '../i18n';
import { colors, spacing } from '../theme/tokens';
import { Button, Empty } from './ui';

/**
 * Bitta ekranning xato chegarasi.
 *
 * ⚠️ NEGA KERAK. Release build'da ekranni chizish paytidagi kutilmagan xato
 * (masalan, serverdan kutilmagan shakldagi javob kelib, `undefined.map`
 * chaqirilsa) hech kim ushlamasa BUTUN ILOVANI yopadi. Ilovada shu
 * paytgacha bironta ham chegara yo'q edi — bitta buzuq mahsulot yozuvi
 * ilovani qulatishi mumkin edi (App Review 2.1(a)).
 *
 * ⚠️ NEGA HAR EKRANGA ALOHIDA. Chegara faqat o'sha ekranning ichini
 * almashtiradi: navigatsiya (orqaga, tablar) joyida qoladi va odam xatoli
 * ekranda qamalib qolmaydi. Navigatorlarga `screenLayout` orqali ulanadi
 * (`app/_layout.tsx` va ichki tartiblar). Ildizda esa oxirgi to'siq —
 * expo-router'ning `ErrorBoundary` eksporti (`app/_layout.tsx`).
 *
 * Bu faqat CHIZISH xatolarini ushlaydi; tugma bosilgandagi yoki tarmoq
 * so'rovidagi xatolar o'z joyida (`onError`, `explainError`) hal qilinadi.
 */
interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class ScreenErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.warn('[screen] chizishda xato ushlandi', error, info.componentStack);
  }

  private readonly retry = (): void => {
    this.setState({ failed: false });
  };

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return <ScreenErrorFallback onRetry={this.retry} />;
  }
}

function ScreenErrorFallback({ onRetry }: { onRetry: () => void }): JSX.Element {
  const t = useI18n((state) => state.t);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Empty
        icon="close"
        title={t.errors.generic}
        action={
          <View style={{ gap: spacing.sm }}>
            <Button title={t.common.retry} onPress={onRetry} />
            {/*
              Xato takrorlansa «Qayta urinish» yordam bermaydi — chiqish yo'li
              ham bo'lsin. `replace`: xatoli ekran tarixda qolmaydi.
            */}
            <Button
              title={t.errors.goHome}
              variant="ghost"
              onPress={() => router.replace('/(tabs)')}
            />
          </View>
        }
      />
    </View>
  );
}

/** Navigatorning `screenLayout` propi uchun: har ekranni chegara bilan o'raydi. */
export function withScreenErrorBoundary({ children }: { children: ReactNode }): JSX.Element {
  return <ScreenErrorBoundary>{children}</ScreenErrorBoundary>;
}
