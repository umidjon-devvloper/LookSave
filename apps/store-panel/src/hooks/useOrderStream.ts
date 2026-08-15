import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { authHeaders } from '../api/client';

/**
 * Do'kon paneli uchun real vaqt oqimi (07-web-panels §4.4).
 *
 * ⚠️ HUJJATDAN CHEKINISH: hujjatda `new EventSource(...)` ishlatilgan.
 * EventSource **maxsus sarlavha yubora olmaydi** — `Authorization: Bearer`
 * ham, `X-Store-Id` ham. Hujjat tokenni cookie'da deb hisoblagan, bizda esa
 * u sarlavhada. Tokenni URL'ga qo'yish mumkin edi, lekin u proksi va server
 * loglariga tushadi.
 *
 * Shuning uchun oqim `fetch` + `ReadableStream` bilan o'qiladi. Natija bir xil,
 * faqat qayta ulanishni o'zimiz boshqaramiz.
 *
 * > Asosiy kanal baribir Telegram (K-11). Panel ochiq turmasligi mumkin —
 * > SSE qo'shimcha qulaylik, yagona umid emas.
 */

export type StreamState = 'connecting' | 'live' | 'offline';

interface Options {
  onNewOrder?: (order: { orderNumber: string }) => void;
}

export function useOrderStream(enabled: boolean, options: Options = {}): StreamState {
  const queryClient = useQueryClient();
  const [state, setState] = useState<StreamState>('connecting');
  const onNewOrder = useRef(options.onNewOrder);
  onNewOrder.current = options.onNewOrder;

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    let retryTimer: number | undefined;
    let stopped = false;

    const handle = (event: string, data: string): void => {
      if (event === 'ping' || event === 'connected') return;

      if (event === 'order.new') {
        try {
          onNewOrder.current?.(JSON.parse(data) as { orderNumber: string });
        } catch {
          // Xabar o'qilmasa ham ro'yxatni yangilaymiz
        }
      }

      void queryClient.invalidateQueries({ queryKey: ['store'] });
    };

    const connect = async (): Promise<void> => {
      try {
        const response = await fetch('/v1/store/events/stream', {
          headers: { ...authHeaders(), Accept: 'text/event-stream' },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) throw new Error('stream ochilmadi');

        setState('live');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE xabarlari bo'sh qator bilan ajratiladi
          let boundary = buffer.indexOf('\n\n');
          while (boundary !== -1) {
            const chunk = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);

            let eventName = 'message';
            let data = '';
            for (const line of chunk.split('\n')) {
              if (line.startsWith('event:')) eventName = line.slice(6).trim();
              else if (line.startsWith('data:')) data += line.slice(5).trim();
            }
            if (data) handle(eventName, data);

            boundary = buffer.indexOf('\n\n');
          }
        }

        throw new Error('stream yopildi');
      } catch {
        if (stopped) return;
        setState('offline');
        // Eksponensial emas, sodda: 5 soniyadan keyin qayta urinamiz
        retryTimer = window.setTimeout(() => void connect(), 5000);
      }
    };

    void connect();

    return () => {
      stopped = true;
      controller.abort();
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [enabled, queryClient]);

  return state;
}
