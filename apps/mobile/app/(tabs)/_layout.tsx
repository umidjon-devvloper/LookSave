import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';

import { Icon } from '../../src/components/Icon';
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
 * Markaziy tugma — AI Designer oqimiga kirish.
 *
 * NEGA TABGA EMAS, `/ai` MARSHRUTIGA: oqim to'liq ekran bo'lishi kerak
 * (tab qatorisiz). Shuning uchun tugma tab almashtirmaydi, ildiz `Stack`
 * ustiga yangi ekran ochadi. Try-On tabi o'z joyida qoladi va oqim oxirida
 * o'sha yerga olib boriladi.
 *
 * iOS'da rangli soya nurlanish beradi; Android'da `elevation` faqat qora soya
 * chizadi (06-dizayn.md §5), shuning uchun u yerda chegara bilan cheklanamiz.
 */
function AiButton({
  focused,
  onPress,
  label,
}: {
  focused: boolean;
  onPress: ((event: GestureResponderEvent) => void) | undefined;
  label: string;
}): JSX.Element {
  return (
    <View style={styles.centerSlot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [
          styles.centerButton,
          { backgroundColor: pressed ? colors.primaryDim : colors.primary },
          focused && styles.centerButtonActive,
        ]}
      >
        <Icon name="tryon" size={24} color={colors.textOnPrimary} />
      </Pressable>
    </View>
  );
}

export default function TabsLayout(): JSX.Element {
  const t = useI18n((state) => state.t);
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 88,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: text.tiny,
        tabBarItemStyle: { paddingHorizontal: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.home,
          // Ekranning o'zida "◆ LOOK SAVE" logotipi bor — ikkinchi sarlavha ortiqcha
          headerShown: false,
          tabBarIcon: ({ color }) => <Icon name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: t.marketplace.tab,
          // Ekranning o'zida "MARKETPLACE" sarlavhasi bor
          headerShown: false,
          tabBarIcon: ({ color }) => <Icon name="cart" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tryon"
        options={{
          title: t.product.tryOn,
          // 3D sahna GPU xotirasini ushlab turadi — tabdan chiqilganda render
          // to'xtatiladi (04-3d-pipeline.md). React Navigation 7 da `unmountOnBlur`
          // olib tashlangan, uning o'rniga `freezeOnBlur`.
          freezeOnBlur: true,
          tabBarButton: (props) => (
            <AiButton
              focused={props.accessibilityState?.selected ?? false}
              // Tabga o'tmaymiz — AI oqimi tab qatori ustidan ochiladi
              onPress={() => router.push('/ai')}
              label="AI Designer"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t.tabs.cart,
          tabBarIcon: ({ color }) => <Icon name="bag" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabs.profile,
          // Ekranda o'z sarlavhasi (surat, ism, raqamlar) bor
          headerShown: false,
          tabBarIcon: ({ color }) => <Icon name="profile" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // Tab qatoridan yuqoriga ko'tarilish
    marginTop: -18,
    shadowColor: colors.primary,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  centerButtonActive: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
});
