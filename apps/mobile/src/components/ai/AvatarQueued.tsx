import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../Icon';
import { useI18n } from '../../i18n';
import { colors, radius, spacing, text } from '../../theme/tokens';

/**
 * Avatar operator navbatida turganda ko'rsatiladigan kutish ekrani.
 *
 * ⚠️ NEGA `AvatarBuilding` DAN ALOHIDA. U AI o'zi yasaydigan yo'l uchun:
 * 40 soniyaga mo'ljallangan bosqichlar («Yuzingiz o'qilmoqda…») va oxirida
 * «Deyarli tayyor». Navbatda ish besh daqiqa yoki undan ko'proq turadi —
 * o'sha bosqichlar 40 soniyada tugab, qolgan vaqt «deyarli tayyor» da
 * qotib turardi. Ya'ni ekran yolg'on gapirardi.
 *
 * Bu yerda aksincha: aniq vaqt ko'rsatiladi va u tugagach ham ekran
 * halol qoladi.
 *
 * ⚠️ SANOQ SERVERDAN KELGAN VAQTDAN. Ilova yopilib qayta ochilsa ham
 * qolgan vaqt to'g'ri qoladi — aks holda har ochilishda «5 daqiqa»
 * boshidan boshlanardi.
 */

/** Mijozga berilgan va'da. Panel ham shu chegara bo'yicha ogohlantiradi. */
const PROMISE_SECONDS = 5 * 60;

export interface QueueInfo {
  queuedAt: string;
  claimed: boolean;
}

function useElapsed(since: string): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return Math.max(0, Math.round((now - new Date(since).getTime()) / 1000));
}

function clock(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

export function AvatarQueued({
  queue,
  faceUrl,
  pushEnabled,
}: {
  queue: QueueInfo;
  faceUrl: string | null;
  /** Xabarnoma o'chiq bo'lsa boshqa matn — «xabar beramiz» deya olmaymiz */
  pushEnabled: boolean;
}): JSX.Element {
  const t = useI18n((state) => state.t);
  const elapsed = useElapsed(queue.queuedAt);
  const left = PROMISE_SECONDS - elapsed;
  const overdue = left <= 0;

  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [breathe]);

  /*
   * ⚠️ VAQT TUGAGACH VA'DA TAKRORLANMAYDI. Kechasi navbatni hech kim
   * olmasligi mumkin — o'sha payt «5 daqiqa» deb turish aldash bo'lardi.
   */
  const title = overdue
    ? t.avatar.queueOverdueTitle
    : queue.claimed
      ? t.avatar.queueClaimedTitle
      : t.avatar.queueWaitingTitle;

  const hint = overdue
    ? pushEnabled
      ? t.avatar.queueOverduePush
      : t.avatar.queueOverdueNoPush
    : pushEnabled
      ? t.avatar.queuePush
      : t.avatar.queueNoPush;

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <Animated.View
          style={[
            styles.glow,
            {
              transform: [
                { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.06] }) },
              ],
              opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.55] }),
            },
          ]}
        />

        <View style={styles.face}>
          {faceUrl ? (
            <Image source={{ uri: faceUrl }} style={styles.faceImage} resizeMode="cover" />
          ) : (
            <View style={[styles.faceImage, styles.facePlaceholder]}>
              <Icon name="profile" size={30} color={colors.primary} />
            </View>
          )}
        </View>

        {/*
          Qolgan vaqt suratning ustida — ekrandagi eng muhim son.
          Tugagach o'rniga «…» emas, o'tgan vaqt ko'rsatiladi: jarayon
          to'xtamagani bilinib tursin.
        */}
        <View style={[styles.timer, overdue && styles.timerOverdue]}>
          <Text style={[styles.timerText, overdue && styles.timerTextOverdue]}>
            {overdue ? clock(elapsed) : clock(left)}
          </Text>
        </View>
      </View>

      <Text style={styles.title}>{title}</Text>

      {!overdue ? (
        <Text style={styles.promise}>{t.avatar.queuePromise}</Text>
      ) : (
        <Text style={styles.promise}>
          {t.avatar.queueWaited.replace('{time}', clock(elapsed))}
        </Text>
      )}

      <View style={styles.steps}>
        <Step done label={t.avatar.queueStepAccepted} />
        <Step
          done={queue.claimed}
          active={!queue.claimed}
          label={queue.claimed ? t.avatar.queueStepWorking : t.avatar.queueStepWaiting}
        />
        <Step label={t.avatar.queueStepReady} />
      </View>

      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

function Step({
  label,
  done = false,
  active = false,
}: {
  label: string;
  done?: boolean;
  active?: boolean;
}): JSX.Element {
  return (
    <View style={styles.stepRow}>
      <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
        {done ? <Icon name="authentic" size={10} color={colors.bg} /> : null}
      </View>
      <Text style={[styles.stepText, (done || active) && styles.stepTextOn]}>{label}</Text>
    </View>
  );
}

const RING = 168;

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },

  stage: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  glow: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    backgroundColor: colors.primaryDark,
  },
  face: {
    width: RING - 24,
    height: RING - 24,
    borderRadius: (RING - 24) / 2,
    overflow: 'hidden',
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  faceImage: { width: '100%', height: '100%' },
  facePlaceholder: {
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  timer: {
    position: 'absolute',
    bottom: -14,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  timerOverdue: { borderColor: colors.border },
  timerText: { ...text.bodyMed, color: colors.accent, fontVariant: ['tabular-nums'] },
  timerTextOverdue: { color: colors.textMuted },

  title: { ...text.h2, color: colors.text, textAlign: 'center' },
  promise: {
    ...text.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },

  steps: { alignSelf: 'stretch', gap: spacing.sm, paddingHorizontal: spacing.md },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  dotActive: { borderColor: colors.accent, backgroundColor: colors.primarySoft },
  stepText: { ...text.small, color: colors.textDim, flex: 1 },
  stepTextOn: { color: colors.text },

  hint: {
    ...text.tiny,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
});
