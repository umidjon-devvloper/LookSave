import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getGroupTryon,
  voteGroupTryon,
  type GroupTryonEmoji,
} from '../../src/api/endpoints';
import { Icon } from '../../src/components/Icon';
import { Screen } from '../../src/components/ui';
import { goBack } from '../../src/navigation/back';
import { colors, radius, spacing, text } from '../../src/theme/tokens';

/**
 * Group try-on viewer — do'st ulashilgan havola orqali ochadi.
 *
 * Tier 1 funksiyasi №01: do'stlar try-on natijasiga emoji ovoz berishadi.
 * Akkaunt shart emas — anonim qurilma barmog'i bo'yicha bitta ovoz
 * (keyingi chaqiruv emoji'ni almashtiradi).
 *
 * Deep link: `looksave://group/<id>` yoki `https://looksave.uz/g/<id>`.
 */

const EMOJIS: Array<{ key: GroupTryonEmoji; char: string; label: string }> = [
  { key: 'love', char: '❤️', label: 'Yoqdi' },
  { key: 'fire', char: '🔥', label: 'Zo`r' },
  { key: 'like', char: '👍', label: 'Yaxshi' },
  { key: 'cool', char: '😎', label: 'Styl' },
  { key: 'no', char: '🙅', label: 'Yo`q' },
];

export default function GroupTryonViewer(): JSX.Element {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [voting, setVoting] = useState<GroupTryonEmoji | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['group-tryon', id],
    queryFn: () => getGroupTryon(id as string),
    enabled: Boolean(id),
    // Jonli hissiyot: har 4 soniyada yangi ovozlarni olib keladi
    refetchInterval: 4_000,
  });

  const vote = useMutation({
    mutationFn: (emoji: GroupTryonEmoji) => voteGroupTryon(id as string, emoji),
    onMutate: (emoji) => setVoting(emoji),
    onSettled: () => {
      setVoting(null);
      void qc.invalidateQueries({ queryKey: ['group-tryon', id] });
    },
  });

  const share = async (): Promise<void> => {
    if (!data) return;
    const url = `https://looksave.uz/g/${data.id}`;
    try {
      await Share.share({
        url,
        message: `Qanday ko'rinadi? ${url}`,
      });
    } catch {
      /* foydalanuvchi bekor qildi */
    }
  };

  return (
    <Screen>
      <View style={[styles.head, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => goBack('/(tabs)')} hitSlop={10}>
          <Icon name="back" size={24} color={colors.text} />
        </Pressable>
        <View>
          <Text style={styles.title}>Do`stlar bilan sinash</Text>
          <Text style={styles.subtitle}>
            {data ? `${data.totalVotes} ta ovoz` : '…'}
          </Text>
        </View>
        <Pressable onPress={share} hitSlop={10}>
          <Icon name="share" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : isError || !data ? (
          <View style={styles.loading}>
            <Text style={styles.errorText}>Sessiya topilmadi yoki muddati tugagan.</Text>
            <Pressable onPress={() => void refetch()} style={styles.retryBtn}>
              <Text style={styles.retryText}>Qayta urinish</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.imageWrap}>
              <Image
                source={{ uri: data.imageUrl }}
                style={styles.image}
                resizeMode="contain"
              />
            </View>

            {data.caption ? (
              <Text style={styles.caption}>{data.caption}</Text>
            ) : null}

            {data.isExpired ? (
              <View style={styles.expiredBanner}>
                <Text style={styles.expiredText}>
                  Sessiya muddati tugagan — endi ovoz berib bo`lmaydi.
                </Text>
              </View>
            ) : (
              <View style={styles.voteRow}>
                {EMOJIS.map((e) => {
                  const count = data.counts[e.key];
                  const mine = data.myEmoji === e.key;
                  const busy = voting === e.key;
                  return (
                    <Pressable
                      key={e.key}
                      style={[styles.voteBtn, mine && styles.voteBtnActive]}
                      onPress={() => vote.mutate(e.key)}
                      disabled={busy || data.isExpired}
                    >
                      <Text style={styles.voteEmoji}>{e.char}</Text>
                      <Text style={[styles.voteCount, mine && styles.voteCountActive]}>
                        {count}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {data.comments.length > 0 ? (
              <View style={styles.commentsBlock}>
                <Text style={styles.commentsTitle}>Izohlar</Text>
                {data.comments.map((c, idx) => {
                  const emoji = EMOJIS.find((e) => e.key === c.emoji);
                  return (
                    <View key={idx} style={styles.commentRow}>
                      <Text style={styles.commentEmoji}>{emoji?.char ?? '💬'}</Text>
                      <Text style={styles.commentText}>{c.comment}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {data.isMine ? (
              <View style={styles.ownerHint}>
                <Text style={styles.ownerHintText}>
                  Siz bu sessiya egasisiz. Ovozlar jonli yangilanadi.
                </Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
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
  subtitle: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  loading: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: { color: colors.textMuted, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  retryText: { color: colors.textOnPrimary, fontWeight: '600' },
  imageWrap: {
    aspectRatio: 3 / 4,
    backgroundColor: colors.surface2,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  caption: {
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  voteRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  voteBtn: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 54,
  },
  voteBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  voteEmoji: { fontSize: 24 },
  voteCount: { fontSize: 13, fontWeight: '700', color: colors.text },
  voteCountActive: { color: colors.textOnPrimary },
  expiredBanner: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
  },
  expiredText: { color: colors.textMuted, textAlign: 'center', fontSize: 13 },
  commentsBlock: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  commentsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  commentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    alignItems: 'flex-start',
  },
  commentEmoji: { fontSize: 18 },
  commentText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  ownerHint: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ownerHintText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
