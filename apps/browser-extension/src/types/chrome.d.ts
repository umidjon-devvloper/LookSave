/**
 * Chrome kengaytma API'sining BIZ ISHLATADIGAN qismi.
 *
 * ⚠️ NEGA `@types/chrome` EMAS. U 1 MB dan ortiq e'lon olib keladi va
 * omborga yangi bog'liqlik qo'shadi; bu yerda esa atigi to'rtta bo'lim
 * kerak. Yangi API ishlatilsa — shu faylga qo'shiladi.
 */

interface ChromeMessageSender {
  tab?: { id?: number; url?: string };
  url?: string;
}

interface ChromeStorageArea {
  get(keys: string[] | string | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[] | string): Promise<void>;
}

interface ChromeTab {
  id?: number;
  url?: string;
  active?: boolean;
  windowId?: number;
}

declare const chrome: {
  runtime: {
    id: string;
    lastError?: { message?: string };
    sendMessage(message: unknown): Promise<unknown>;
    onMessage: {
      addListener(
        handler: (
          message: unknown,
          sender: ChromeMessageSender,
          respond: (response?: unknown) => void,
        ) => boolean | undefined | void,
      ): void;
    };
    getURL(path: string): string;
    getManifest(): { version: string };
  };
  storage: {
    local: ChromeStorageArea;
    session: ChromeStorageArea;
  };
  scripting: {
    executeScript(injection: {
      target: { tabId: number; allFrames?: boolean };
      files?: string[];
    }): Promise<unknown>;
  };
  alarms: {
    create(name: string, info: { periodInMinutes?: number; delayInMinutes?: number }): void;
    clear(name: string): Promise<boolean>;
    onAlarm: { addListener(handler: (alarm: { name: string }) => void): void };
  };
  tabs: {
    query(info: {
      url?: string | string[];
      active?: boolean;
      currentWindow?: boolean;
    }): Promise<ChromeTab[]>;
    sendMessage(tabId: number, message: unknown): Promise<unknown>;
    create(info: { url: string; active?: boolean }): Promise<ChromeTab>;
    update(tabId: number, info: { active?: boolean; url?: string }): Promise<ChromeTab>;
    reload(tabId?: number, info?: { bypassCache?: boolean }): Promise<void>;
    onUpdated: {
      addListener(
        handler: (
          tabId: number,
          changeInfo: { status?: string; url?: string },
          tab: ChromeTab,
        ) => void,
      ): void;
      removeListener(
        handler: (
          tabId: number,
          changeInfo: { status?: string; url?: string },
          tab: ChromeTab,
        ) => void,
      ): void;
    };
  };
};
