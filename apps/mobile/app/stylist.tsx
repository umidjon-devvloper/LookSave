import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
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
interface Msg {
  id: string;
  role: Role;
  text: string;
  products?: Array<{ id: string; title: string; price: string; currency: string; image: string | null }>;
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
    const res = await api<{ answer: string; products: Msg['products'] }>('/ai/stylist', {
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
    // Mock javob — endpoint hali tayyor emas
    return {
      id: String(Date.now()),
      role: 'assistant',
      text: `«${prompt}» bo'yicha tavsiya: katalogda yoqimli variantlar bor. Keyingi versiyada sizga aniq mahsulotlar taqdim etiladi.`,
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
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={[styles.head, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => goBack('/(tabs)')} hitSlop={10}>
          <Icon name="back" size={24} color={colors.text} />
        </Pressable>
        <View>
          <Text style={styles.title}>AI stilist</Text>
          <Text style={styles.subtitle}>Online · javob beradi</Text>
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

function Bubble({ msg, onProduct }: { msg: Msg; onProduct: (id: string) => void }): JSX.Element {
  const isUser = msg.role === 'user';
  return (
    <View style={[styles.bubbleWrap, isUser && styles.bubbleWrapUser]}>
      <View style={[styles.bubble, isUser && styles.bubbleUser]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{msg.text}</Text>
        {msg.products && msg.products.length > 0 ? (
          <View style={styles.products}>
            {msg.products.slice(0, 3).map((p) => (
              <Pressable key={p.id} style={styles.productCard} onPress={() => onProduct(p.id)}>
                {p.image ? (
                  <Image source={{ uri: p.image }} style={styles.productImg} resizeMode="contain" />
                ) : (
                  <View style={[styles.productImg, { backgroundColor: colors.surface2 }]} />
                )}
                <Text style={styles.productName} numberOfLines={2}>{p.title}</Text>
                <Text style={styles.productPrice}>{money(p.price, p.currency)}</Text>
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
  productImg: { width: 48, height: 48, borderRadius: radius.sm },
  productName: { flex: 1, fontSize: 12, color: colors.text, fontWeight: '500' },
  productPrice: { fontSize: 12, color: colors.primary, fontWeight: '700' },
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
