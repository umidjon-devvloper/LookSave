import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../src/api/client';
import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/ui';
import { goBack } from '../src/navigation/back';
import { money } from '../src/theme/format';
import { colors, radius, spacing, text } from '../src/theme/tokens';

/**
 * AI stilist chat sahifasi. Foydalanuvchi matn yoki chip bilan savol beradi,
 * backend katalogdan mos mahsulotlarni qaytaradi va stilist javobi ko'rinishida
 * taqdim etadi.
 *
 * Hozir UI tayyor, backend javobi `POST /v1/ai/stylist` orqali keladi — agar
 * endpoint mavjud bo'lmasa, mahalliy mock javob ishlatiladi (OpenAI qo'shilgach
 * endpoint tashqariga chiqadi). Tier 1 funksiyasi #04.
 */

type Role = 'user' | 'assistant';
interface StylistProduct {
  id: string;
  title: string;
  price: string;
  currency: string;
  image: string | null;
  slot?: string;
  storeId?: string;
  storeName?: string;
}
interface Msg {
  id: string;
  role: Role;
  text: string;
  products?: StylistProduct[];
}

const INTRO: Msg = {
  id: 'intro',
  role: 'assistant',
  text:
    "Salom! Men LookSave stilist AI'siman. Qaysi kun uchun kiyinishga yordam berasiz? Chiplar orqali tanlang yoki o'z savolingizni yozing.",
};

const CHIPS = ["To'y uchun", "Ish uchun", "Uyg'oq kun", 'Sport', 'Sayohat', 'Uchrashuv', "Bayram"];

async function askStylist(prompt: string): Promise<Msg> {
  try {
    const res = await api<{ answer: string; products: StylistProduct[] }>('/ai/stylist', {
      method: 'POST',
      body: { prompt },
    });
    return {
      id: String(Date.now()),
      role: 'assistant',
      text: res.answer,
      products: res.products,
    };
  } catch {
    // API hali tayyor emas yoki tarmoq uzilgan — foydalanuvchiga tushunarli xabar
    return {
      id: String(Date.now()),
      role: 'assistant',
      text: `Kechirasiz, hozir stilist bilan aloqa yo'q. Biroz o'tib qayta urinib ko'ring.`,
    };
  }
}

export default function Stylist(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([INTRO]);
  const [busy, setBusy] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const listRef = useRef<FlatList<Msg>>(null);

  // iOS 27 simulyatorida `KeyboardAvoidingView` xato ishlaydi —
  // klaviatura ochilgan vaqtda qo'lda `paddingBottom`ni klaviatura
  // balandligiga tenglaymiz. Yopiq bo'lsa — pastki safe-area.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => {
      setKbHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const bottomPad = kbHeight > 0 ? spacing.sm : insets.bottom + spacing.sm;

  const send = async (text: string): Promise<void> => {
    if (!text.trim() || busy) return;
    const userMsg: Msg = { id: String(Date.now()), role: 'user', text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setBusy(true);
    try {
      const reply = await askStylist(text.trim());
      setMessages((prev) => [...prev, reply]);
    } finally {
      setBusy(false);
    }
  };

  // Yangi xabar, «yozmoqda» pufagi yoki yuklangan mahsulot rasmlari ro'yxatni
  // uzaytiradi — har safar oxiriga tushamiz, javob ekrandan pastda qolmasin.
  const scrollToEnd = (): void => listRef.current?.scrollToEnd({ animated: true });

  return (
    <Screen>
      <View style={[styles.head, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => goBack('/(tabs)')} hitSlop={10}>
          <Icon name="back" size={24} color={colors.text} />
        </Pressable>
        <View>
          <Text style={styles.title}>AI stilist</Text>
          <Text style={styles.subtitle}>{busy ? 'yozmoqda…' : 'Online · javob beradi'}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <View style={{ flex: 1, paddingBottom: kbHeight }}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <Bubble msg={item} onProduct={(id) => router.push(`/product/${id}` as any)} />}
          ListFooterComponent={busy ? <TypingBubble /> : null}
          onContentSizeChange={scrollToEnd}
        />

        <View style={styles.chips}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={CHIPS}
            keyExtractor={(c) => c}
            contentContainerStyle={{ gap: spacing.xs, paddingHorizontal: spacing.md }}
            renderItem={({ item }) => (
              <Pressable style={styles.chip} onPress={() => void send(item)}>
                <Text style={styles.chipText}>{item}</Text>
              </Pressable>
            )}
          />
        </View>

        <View style={[styles.inputRow, { paddingBottom: bottomPad }]}>
          <TextInput
            style={styles.input}
            placeholder="Savol yozing…"
            placeholderTextColor={colors.textDim}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => void send(input)}
            returnKeyType="send"
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || busy) && styles.sendBtnDisabled]}
            onPress={() => void send(input)}
            disabled={!input.trim() || busy}
          >
            <Text style={styles.sendText}>↑</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

/**
 * «Stilist yozmoqda» — javob kutilayotganda chap tomonda turadigan pufak,
 * uchta nuqta navbatma-navbat yonib-o'chadi (messenjerlardagi kabi).
 * `useNativeDriver` — animatsiya JS ipini band qilmaydi, so'rov kutilayotgan
 * paytda ham silliq yuradi.
 */
function TypingBubble(): JSX.Element {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);

  return (
    <View style={[styles.bubbleWrap, styles.typingWrap]} accessibilityLabel="Stilist yozmoqda">
      <View style={[styles.bubble, styles.typingBubble]}>
        <View style={styles.typingDots}>
          {dots.map((v, i) => (
            <Animated.View
              key={i}
              style={[
                styles.typingDot,
                {
                  opacity: v,
                  transform: [{ translateY: v.interpolate({ inputRange: [0.3, 1], outputRange: [0, -3] }) }],
                },
              ]}
            />
          ))}
        </View>
        <Text style={styles.typingText}>Stilist mahsulot tanlamoqda</Text>
      </View>
    </View>
  );
}

function Bubble({ msg, onProduct }: { msg: Msg; onProduct: (id: string) => void }): JSX.Element {
  const isUser = msg.role === 'user';
  return (
    <View style={[styles.bubbleWrap, isUser && styles.bubbleWrapUser]}>
      <View style={[styles.bubble, isUser && styles.bubbleUser]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{msg.text}</Text>
        {msg.products && msg.products.length > 0 ? (
          <View style={styles.products}>
            {msg.products.map((p) => (
              <Pressable key={p.id} style={styles.productCard} onPress={() => onProduct(p.id)}>
                {p.image ? (
                  <Image source={{ uri: p.image }} style={styles.productImg} resizeMode="cover" />
                ) : (
                  <View style={[styles.productImg, { backgroundColor: colors.surface2 }]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName} numberOfLines={2}>{p.title}</Text>
                  {p.storeName ? (
                    <Text style={styles.productStore} numberOfLines={1}>{p.storeName}</Text>
                  ) : null}
                  <Text style={styles.productPrice}>{money(p.price, p.currency)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...text.h3, color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 11, color: colors.success, textAlign: 'center' },
  list: { padding: spacing.md, gap: spacing.sm },
  bubbleWrap: { alignItems: 'flex-start' },
  bubbleWrapUser: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleUser: { backgroundColor: colors.primary, borderColor: colors.primary },
  typingWrap: { marginTop: spacing.sm },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  typingDots: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 20 },
  typingDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.primary },
  typingText: { fontSize: 13, color: colors.textMuted },
  bubbleText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  bubbleTextUser: { color: colors.textOnPrimary },
  products: { marginTop: spacing.sm, gap: spacing.xs },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xs,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
  },
  productImg: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.surface2 },
  productName: { fontSize: 13, color: colors.text, fontWeight: '600' },
  productStore: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  productPrice: { fontSize: 13, color: colors.primary, fontWeight: '700', marginTop: 4 },
  chips: {
    paddingVertical: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.surface2,
    borderRadius: radius.pill,
  },
  chipText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendText: { fontSize: 20, color: colors.textOnPrimary, fontWeight: '700' },
});
