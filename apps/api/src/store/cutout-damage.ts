import sharp from 'sharp';

/**
 * Kesim «yo'l-yo'l» buzilganmi — 2026-11-09 … 11-13 orasidagi nuqson izi.
 *
 * ⚠️ NEGA KERAK. O'sha kunlarda zaxira model yasagan HAR kesim buzuq
 * chiqqan (`cutout.ts` → `refineAlpha` izohi): alfa uch barobar cho'zilib,
 * har satri uch bo'lakka sochilgan. Bunday fayllar omborda qolgan va
 * `cutout_url` ularga ishora qilib turibdi — ilova ularni ko'rsataveradi.
 * Bazada ularni sog'lomidan ajratadigan belgi yo'q (kalit bir xil, hajm
 * o'xshash); farq faqat piksellarda. `scripts/repair-striped-cutouts.ts`
 * shu funksiya bilan ularni topadi.
 *
 * BELGI. Sog'lom kesimda qo'shni satrlar deyarli bir xil — farq faqat
 * siluet chekkasida (o'lchangan: piksellarning 0,01–0,04%), uch satr
 * naridagisi esa undan ko'proq farq qiladi. Buzuq kesimda aksincha:
 * qo'shni satrlar asl suratning BOSHQA-BOSHQA uchdan birini ko'rsatadi
 * (farq ~43%), uch satr naridagisi esa yana o'sha bo'lakka qaytadi
 * (~0,04%). Bu ikki nisbat bir vaqtda tabiiy suratda uchramaydi.
 */
export async function isStripedCutout(input: Buffer): Promise<boolean> {
  try {
    const { data, info } = await sharp(input)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.channels !== 4) return false;

    const { width, height } = info;
    if (width < 6 || height < 6) return false;

    /** `step` satr naridagi piksel bilan alfasi keskin farq qiladiganlar ulushi. */
    const flips = (step: number): number => {
      let changed = 0;
      for (let y = 0; y + step < height; y += 1) {
        const here = y * width;
        const there = (y + step) * width;
        for (let x = 0; x < width; x += 1) {
          const a = data[(here + x) * 4 + 3]!;
          const b = data[(there + x) * 4 + 3]!;
          if (Math.abs(a - b) > 127) changed += 1;
        }
      }
      return changed / ((height - step) * width);
    };

    const adjacent = flips(1);
    if (adjacent < 0.02) return false;

    return flips(3) < adjacent * 0.25;
  } catch {
    return false;
  }
}
