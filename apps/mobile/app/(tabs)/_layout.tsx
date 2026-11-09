import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '../../src/components/Icon';
import { useI18n } from '../../src/i18n';
import { colors, radius, text } from '../../src/theme/tokens';

/**
 * Beshta tab (05-mobile §4). Markaziy tugma ko'tarilgan — deckdagi
 * eng ko'zga tashlanadigan element (01, 08-slayd).
 *
 * Ikonkalar `src/components/Icon.tsx` dagi yagona jadvaldan keladi —
 * to'plamni almashtirish uchun faqat o'sha fayl o'zgaradi.
 */

/**
 * Markaziy tugma — 3D kiyib ko'rish (deck 05-slayd).
 *
 * ⚠️ ILGARI `/ai` GA OLIB BORARDI. Sabab: Try-On ekranidagi 3D sahna
 * qurilmada chizilmasdi va tugma buzuq ekranga tushirardi. Qobiq
 * almashtirilgach (`AvatarView`) tugma o'z vazifasiga qaytdi.
 *
 * Q-1 qarori (12-tz.md §3): 3D va AI — raqobatchi emas. 3D tez va bepul
 * (svayp, hamma slot), AI esa yakuniy realistik surat. Shuning uchun
 * markaziy tugma 3D ga kiradi, AI esa o'sha ekrandan chaqiriladi.
 *
 * iOS'da rangli soya nurlanish beradi; Android'da `elevation` faqat qora soya
 * chizadi (06-dizayn.md §5), shuning uchun u yerda chegara bilan cheklanamiz.
 */
const TAB_ICONS: Record<string, IconName> = {
  index: 'home',
  marketplace: 'cart',
  tryon: 'tryon',
  cart: 'bag',
  profile: 'profile',
};

function PremiumTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps): JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tabDock,
        { paddingBottom: Math.max(insets.bottom, 8) },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
        const focused = state.index === index;
        const center = route.name === 'tryon';
        const options = descriptors[route.key]?.options;
        const title = typeof options?.title === 'string' ? options.title : route.name;
        const color = focused ? colors.accent : colors.textMuted;

        const open = (): void => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            // React Navigation 7 docs: tabni fokuslash uchun merge: true
            navigation.navigate({ name: route.name, params: route.params, merge: true } as never);
          }
        };

        if (center) {
          return (
            <View key={route.key} style={styles.tabItem} pointerEvents="box-none">
              <Pressable
                accessibilityRole="tab"
                accessibilityLabel={title}
                accessibilityState={{ selected: focused }}
                onPress={open}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.centerButton,
                  { backgroundColor: pressed ? colors.primaryDim : colors.primary },
                  focused && styles.centerButtonActive,
                ]}
              >
                <Icon name="tryon" size={25} color={colors.textOnPrimary} />
              </Pressable>
            </View>
          );
        }

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={title}
            accessibilityState={{ selected: focused }}
            onPress={open}
            /*
             * ⚠️ hitSlop (2026-11-09) — iPhone 17 Pro Max'da tab label'lari
             * pastki chetga yaqin, pastki piksel'larga tap bo'lsa register
             * bo'lmasdi. hitSlop invisible tap zonani kengaytirmaydi, faqat
             * tap maydonini oshiradi.
             */
            hitSlop={{ top: 12, bottom: 24, left: 4, right: 4 }}
            style={({ pressed }) => [styles.tabItem, pressed && styles.tabPressed]}
          >
            <View
              style={[
                styles.tabInner,
                focused && styles.tabInnerActive,
              ]}
            >
              <Icon name={TAB_ICONS[route.name] ?? 'home'} size={22} color={color} />
              <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
                {title}
              </Text>
            </View>
          </Pressable>
        );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout(): JSX.Element {
  const t = useI18n((state) => state.t);
  const dark = useColorScheme() === 'dark';

  return (
    <Tabs
      tabBar={(props) => <PremiumTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: dark ? '#0A0812' : colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.home,
          // Ekranning o'zida "◆ LOOK SAVE" logotipi bor — ikkinchi sarlavha ortiqcha
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: t.marketplace.tab,
          // Ekranning o'zida "MARKETPLACE" sarlavhasi bor
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="tryon"
        options={{
          title: t.product.tryOn,
          // Ekranning o'zida «Kiyintirish» sarlavhasi bor — ikkinchisi ortiqcha
          headerShown: false,
          // Svayp tasmasi GL kontekstni ushlab turadi — tabdan chiqilganda
          // chizish to'xtatiladi. React Navigation 7 da `unmountOnBlur`
          // olib tashlangan, uning o'rniga `freezeOnBlur`.
          freezeOnBlur: true,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t.tabs.cart,
          // Savatda o'z sarlavhasi bor (nom va tozalash tugmasi bir qatorda)
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabs.profile,
          // Ekranda o'z sarlavhasi (surat, ism, raqamlar) bor
          headerShown: false,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 6,
    backgroundColor: 'transparent',
    zIndex: 100,
    elevation: 10,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    paddingTop: 8,
    height: 72,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    // overflow 'visible' — markaziy AI tugmasi tab bar ustiga chiqib to'liq ko'rinishi uchun
    overflow: 'visible',
    shadowColor: '#27134A',
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    zIndex: 100,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
    paddingHorizontal: 4,
    // Pressable vertikal to'liq joy olsin — label'ga tap ham ushlanadi
    alignSelf: 'stretch',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  tabInnerActive: {
    backgroundColor: '#F0E7FB',
  },
  tabPressed: { opacity: 0.62 },
  tabLabel: { ...text.tiny },
  // Atelier: tab qatoridan ko'tarilgan anor doira. Ilgari primary rangli
  // "glow" soya chizilardi (SaaS klişesi); Atelier uslubida u yo'q —
  // shaklning o'zi ("markazda qizil doira") kuchli to'xtash nuqtasi.
  centerButton: {
    width: 62,
    height: 62,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    borderWidth: 3,
    borderColor: colors.surface,
    shadowColor: colors.primary,
    shadowOpacity: 0.42,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 9,
  },
  centerButtonActive: {
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
