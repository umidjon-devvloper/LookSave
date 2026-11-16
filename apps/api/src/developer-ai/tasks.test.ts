import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `completeTask` — operator natijasini qabul qilishdagi QAROR mantiqi.
 *
 * ⚠️ BAZA BU YERDA SOXTA, va bu ataylab. SQL shartlarining to'g'riligi
 * haqiqiy baza bilan uchidan-uchiga tekshiriladi (soxta `pool` buni
 * isbotlamaydi). Bu yerda boshqa narsa qo'riqlanadi: kerakli so'rov
 * UMUMAN yuboriladimi. 2026-11-14 da topilgan xato aynan shunday edi —
 * komplektning qo'shni yozuvlarini yangilaydigan so'rov to'g'ri yozilgan,
 * lekin undan oldingi `return` sababli yakka rasmda unga yetilmasdi.
 */

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  clientQuery: vi.fn(),
  storeAvatarSheet: vi.fn(),
  putCustomerFace: vi.fn(),
  faceReference: vi.fn(),
  makeCutout: vi.fn(),
  warnFaceNotApplied: vi.fn(),
}));

vi.mock('../db/pool', () => ({
  pool: {
    query: mocks.poolQuery,
    connect: async () => ({ query: mocks.clientQuery, release: () => undefined }),
  },
}));

vi.mock('../integrations/r2', () => ({
  isOwnCdnUrl: () => true,
  presignRead: async (url: string) => url,
}));

vi.mock('../store/cutout', () => ({ makeCutout: mocks.makeCutout }));
vi.mock('../tryon/avatar-sheet', () => ({ storeAvatarSheet: mocks.storeAvatarSheet }));

vi.mock('./face', () => ({
  faceReference: mocks.faceReference,
  putCustomerFace: mocks.putCustomerFace,
  faceNeedsAttention: (face: string) => ['failed', 'unchanged', 'no-reference'].includes(face),
}));

vi.mock('./notify', () => ({
  announceTask: vi.fn(),
  notifyCustomer: vi.fn(),
  updateAnnouncement: vi.fn(),
  warnFaceNotApplied: mocks.warnFaceNotApplied,
}));

import { completeTask } from './tasks';

const TASK = '11111111-1111-4111-8111-111111111111';
const RENDER = '22222222-2222-4222-8222-222222222222';
const CUSTOMER = '33333333-3333-4333-8333-333333333333';
const OPERATOR = '44444444-4444-4444-8444-444444444444';
const VARIANT = '55555555-5555-4555-8555-555555555555';
const HASH = 'a'.repeat(32);

const RAW = 'https://cdn.test/avatar/raw.jpg';
const SWAPPED = 'https://cdn.test/tryon/manual/swapped.png';

interface Sent {
  sql: string;
  params: unknown[];
}
let sent: Sent[] = [];
let status: 'claimed' | 'done' = 'claimed';
let claimedBy = OPERATOR;

const taskRow = () => ({
  id: TASK,
  kind: 'render',
  user_id: CUSTOMER,
  ref_id: RENDER,
  status,
  payload: {},
  claimed_by: claimedBy,
  claimed_by_name: 'Operator',
  claimed_at: new Date('2026-11-14T10:00:00Z'),
  result_url: null,
  error: null,
  created_at: new Date('2026-11-14T09:59:00Z'),
  completed_at: null,
});

const flat = (sql: string): string => sql.replace(/\s+/g, ' ').trim();
const find = (part: string): Sent | undefined => sent.find((query) => query.sql.includes(part));

const SIBLINGS = "WHERE user_id = $1 AND source_hash = $2 AND status != 'ready' AND id != $5";
const ADOPT = 'UPDATE tryon_renders SET cutout_url = result_url';

beforeEach(() => {
  sent = [];
  status = 'claimed';
  claimedBy = OPERATOR;

  mocks.storeAvatarSheet.mockReset().mockResolvedValue(null);
  mocks.faceReference.mockReset().mockResolvedValue('https://signed.test/face.jpg');
  mocks.putCustomerFace.mockReset().mockResolvedValue({ url: SWAPPED, face: 'swapped', transparent: true });
  mocks.makeCutout.mockReset().mockResolvedValue(null);
  mocks.warnFaceNotApplied.mockReset();

  mocks.poolQuery.mockReset().mockImplementation(async (text: string, params: unknown[] = []) => {
    const sql = flat(text);
    sent.push({ sql, params });

    if (sql.includes('FROM developer_ai_tasks t')) return { rows: [taskRow()], rowCount: 1 };
    if (sql.startsWith('SELECT user_id, angle FROM tryon_renders')) {
      return { rows: [{ user_id: CUSTOMER, angle: 'front' }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });

  mocks.clientQuery.mockReset().mockImplementation(async (text: string, params: unknown[] = []) => {
    const sql = flat(text);
    sent.push({ sql, params });

    if (sql.startsWith('UPDATE developer_ai_tasks AS t')) {
      // `finish` — shart: ish band va shu operatorda
      if (status !== 'claimed' || claimedBy !== params[1]) return { rows: [], rowCount: 0 };
      status = 'done';
      return { rows: [taskRow()], rowCount: 1 };
    }
    if (sql.startsWith('UPDATE tryon_renders SET result_url') && sql.includes('WHERE id = $1 RETURNING')) {
      return {
        rows: [{ user_id: CUSTOMER, variant_id: VARIANT, angle: 'front', source_hash: HASH, base_render_id: null }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  });
});

describe('completeTask — kiyintirish natijasi', () => {
  it('YAKKA rasmda ham komplektning qo`shni yozuvlariga natija ko`chiriladi', async () => {
    const task = await completeTask(TASK, OPERATOR, RAW);

    expect(task.status).toBe('done');
    // Qo'shnilarga yuzi almashtirilgan natija ketadi, operator yuklagan xom surat emas
    expect(find(SIBLINGS)?.params).toEqual([CUSTOMER, HASH, SWAPPED, '{}', RENDER]);
    // Yakka rasmda boshqa burchak yozuvlari ochilmaydi
    expect(find('INSERT INTO tryon_renders')).toBeUndefined();
  });

  it('shaffof natija — hamma yozuvda «kesimi tayyor», qayta kesilmaydi', async () => {
    await completeTask(TASK, OPERATOR, RAW);

    expect(find(ADOPT)?.params).toEqual([CUSTOMER, [SWAPPED]]);
    expect(mocks.makeCutout).not.toHaveBeenCalled();
  });

  it('uch panelli varaqda burchaklar yoziladi VA qo`shnilar yangilanadi', async () => {
    mocks.storeAvatarSheet.mockResolvedValue({ front: 'f.webp', side: 's.webp', back: 'b.webp' });
    mocks.putCustomerFace.mockImplementation(async (url: string, _reference: unknown, angle: string) => ({
      url: `https://cdn.test/tryon/manual/${angle}.png`,
      face: angle === 'front' ? 'swapped' : 'skipped',
      transparent: true,
    }));

    await completeTask(TASK, OPERATOR, RAW);

    const inserted = sent.filter((query) => query.sql.startsWith('INSERT INTO tryon_renders'));
    expect(inserted.map((query) => query.params[2])).toEqual(['side', 'back']);

    const angles = JSON.parse(String(find(SIBLINGS)?.params[3]));
    expect(Object.keys(angles)).toEqual(['front', 'side', 'back']);
    // Burchaklar ketma-ket ishlanadi — xizmat bir vaqtda ikkitadan ortig'ini rad etadi
    expect(mocks.putCustomerFace.mock.calls.map((call) => call[2])).toEqual(['front', 'side', 'back']);
  });

  it('yuz qo`yilmasa natija baribir yetkaziladi, lekin ogohlantirish ketadi', async () => {
    mocks.putCustomerFace.mockResolvedValue({
      url: RAW,
      face: 'failed',
      transparent: false,
      reason: 'HTTP 502',
    });

    const task = await completeTask(TASK, OPERATOR, RAW);

    expect(task.status).toBe('done');
    expect(find(SIBLINGS)?.params[2]).toBe(RAW);
    expect(mocks.warnFaceNotApplied).toHaveBeenCalledWith({ kind: 'render', id: TASK, reason: 'HTTP 502' });
    // Shaffof emas — kesim alohida yasaladi
    expect(mocks.makeCutout).toHaveBeenCalledWith(RAW, 'tryon');
  });

  it('ish boshqa operatorda bo`lsa og`ir ish boshlanmaydi va so`rov rad etiladi', async () => {
    claimedBy = 'boshqa-operator';

    await expect(completeTask(TASK, OPERATOR, RAW)).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(mocks.storeAvatarSheet).not.toHaveBeenCalled();
    expect(mocks.putCustomerFace).not.toHaveBeenCalled();
    expect(find(SIBLINGS)).toBeUndefined();
  });

  it('allaqachon yopilgan ishga ikkinchi natija — og`ir ishsiz rad', async () => {
    status = 'done';

    await expect(completeTask(TASK, OPERATOR, RAW)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    expect(mocks.putCustomerFace).not.toHaveBeenCalled();
  });
});
