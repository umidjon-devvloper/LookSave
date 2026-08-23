import { useEffect, useState } from 'react';

/**
 * `assets-3d/export/manifest.json` ning web tomondagi ko'rinishi.
 *
 * Manifest ilova ichiga `import` qilinmaydi, `fetch` bilan olinadi: modellar
 * dizayner tomonidan yangilanganda saytni qayta yig'ish shart bo'lmasin.
 */

export type Slot = 'top' | 'outer' | 'bottom' | 'feet' | 'head' | 'wrist';

export type Garment = {
  key: string;
  file: string;
  slot: Slot;
  title: string;
  colorName: string;
  colorHex: string;
  /** Kiyim ostida qolib, teri bilan kesishadigan gavda qismlari. */
  hideBodyParts: string[];
  hasMorphs: boolean;
};

export type Body = 'male' | 'female';

/** Avatarga kiydirilgan buyumlar — sahna shu ro'yxatni chizadi. */
export type Outfit = { file: string; hideBodyParts: string[] }[];

export type Manifest = {
  version: string;
  bodies: Body[];
  garments: Garment[];
  animations: { name: string; file: string }[];
};

/** `apps/web/scripts/sync-models.mjs` shu manzilga ko'chiradi. */
export const MODELS_BASE = '/models';

export const modelUrl = (file: string): string => `${MODELS_BASE}/${file}`;
export const bodyUrl = (body: Body): string => modelUrl(`${body}-base-v1.glb`);

/** Ko'rgazmada bo'limlar shu tartibda — ustdan pastga, so'ng aksessuar. */
export const SLOT_ORDER: Slot[] = ['top', 'outer', 'bottom', 'feet', 'head', 'wrist'];

export const SLOT_LABEL: Record<Slot, string> = {
  top: 'Tops',
  outer: 'Outerwear',
  bottom: 'Bottoms',
  feet: 'Footwear',
  head: 'Headwear',
  wrist: 'Accessories',
};

type ManifestState =
  | { status: 'loading'; manifest: null }
  | { status: 'ready'; manifest: Manifest }
  | { status: 'error'; manifest: null };

/**
 * Manifestni bir marta oladi va natijani modul darajasida saqlaydi —
 * sahifada bir nechta 3D blok bor, ular bitta so'rovni bo'lishadi.
 */
let cached: Promise<Manifest> | null = null;

function loadManifest(): Promise<Manifest> {
  cached ??= fetch(`${MODELS_BASE}/manifest.json`).then((response) => {
    if (!response.ok) throw new Error(`manifest.json: HTTP ${response.status}`);
    return response.json() as Promise<Manifest>;
  });

  return cached;
}

export function useManifest(): ManifestState {
  const [state, setState] = useState<ManifestState>({ status: 'loading', manifest: null });

  useEffect(() => {
    let alive = true;

    loadManifest().then(
      (manifest) => alive && setState({ status: 'ready', manifest }),
      (error: unknown) => {
        console.error('[three] manifest yuklanmadi', error);
        if (alive) setState({ status: 'error', manifest: null });
      },
    );

    return () => {
      alive = false;
    };
  }, []);

  return state;
}

/** Slot bo'yicha guruhlangan kiyimlar — ko'rgazma va kiyintirish uchun. */
export function groupBySlot(garments: Garment[]): Map<Slot, Garment[]> {
  const grouped = new Map<Slot, Garment[]>();

  for (const slot of SLOT_ORDER) {
    const items = garments.filter((garment) => garment.slot === slot);
    if (items.length > 0) grouped.set(slot, items);
  }

  return grouped;
}
