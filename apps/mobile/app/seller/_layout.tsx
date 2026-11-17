import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';

import { Icon } from '../../src/components/Icon';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';
import { useI18n } from '../../src/i18n';
import { SELLER_TAB_BAR_BOTTOM, SELLER_TAB_BAR_HEIGHT } from '../../src/theme/sellerTabBar';
import { colors, text } from '../../src/theme/tokens';

/**
 * Sotuvchi paneli — alohida tab bar.
 *
 * ⚠️ MIJOZ TAB BAR'IDAN FARQ QILADI. Sotuvchiga 3D kiyintirish, savat
 * yoki sevimlilar kerak emas; unga buyurtma, mahsulot, statistika va
 * sozlamalar kerak. Shuning uchun bu bo'lak o'z Tabs qatorini yuritadi.
 *
 * `href: null` bilan belgilangan ekranlar tabda ko'rinmaydi, lekin
 * router orqali ochilishi mumkin (apply, product-new).
 */
export default function SellerLayout(): JSX.Element {
  const t = useI18n((state) => state.t);

  return (
    <Tabs
      // Har ekran o'z xato chegarasida: chizishdagi xato ilovani yopmaydi (`ScreenErrorBoundary`)
      screenLayout={withScreenErrorBoundary}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarActiveBackgroundColor: 'transparent',
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.sellerTabs.dashboard,
          tabBarIcon: ({ color, size }) => <Icon name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t.sellerTabs.orders,
          tabBarIcon: ({ color, size }) => <Icon name="orders" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: t.sellerTabs.products,
          tabBarIcon: ({ color, size }) => <Icon name="shop" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: t.sellerTabs.analytics,
          tabBarIcon: ({ color, size }) => <Icon name="premium" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t.sellerTabs.settings,
          tabBarIcon: ({ color, size }) => <Icon name="settings" size={size} color={color} />,
        }}
      />
      {/* Tabda ko'rinmaydigan ekranlar — qo'yishga arzimaydi, lekin ochilishi mumkin */}
      <Tabs.Screen name="product-new" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  /*
   * ⚠️ SUZUVCHI BAR: ekran uning ostiga ham chiziladi. Pastga yopishtirilgan
   * narsalar `SELLER_TAB_BAR_SPACE` dan yuqorida tursin (`sellerTabBar.ts`).
   */
  tabBar: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: SELLER_TAB_BAR_BOTTOM,
    backgroundColor: '#FFFFFF',
    borderTopColor: 'transparent',
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: '#EBE4F7',
    borderRadius: 30,
    overflow: 'hidden',
    height: SELLER_TAB_BAR_HEIGHT,
    paddingTop: 8,
    paddingHorizontal: 6,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    shadowColor: '#4C1D95',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  tabItem: { borderRadius: 22, marginHorizontal: 2, paddingVertical: 4 },
  tabLabel: { ...text.tiny, fontWeight: '700', marginTop: 2 },
});
