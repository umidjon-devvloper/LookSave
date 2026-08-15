# _base — bir marta yasaladigan fayllar

Bu papkadagi hamma narsa **butun katalog uchun umumiy**. Bu yerda xato
bo'lsa, keyin yasalgan har bir model ham xato bo'ladi — shuning uchun
birinchi model yasalgunga qadar QA ro'yxatidan (04-3d-pipeline §11)
to'liq o'tkazing.

```
body_male_v3.blend        tana + 15 mesh (body_head … body_foot_R)
body_female_v3.blend      + socket'lar + 6 ta mt_* shape key
skeleton_mixamo.blend     mixamorig: prefiksli standart skelet
animations/
  idle.glb  turn.glb  walk.glb  run.glb  sit.glb
```

## Nima tekshiriladi

- [ ] Suyak nomlari `mixamorig:` prefiksi bilan, o'zgartirilmagan
- [ ] Tana 15 ta alohida mesh (bir butun emas) — `hide_body_parts` shunga tayanadi
- [ ] 8 ta socket bor: `socket_head` `socket_face` `socket_neck`
      `socket_wrist_L/R` `socket_foot_L/R` `socket_bag`
- [ ] Oltita shape key: `mt_height` `mt_weight` `mt_shoulderWidth`
      `mt_chest` `mt_waist` `mt_hips`
- [ ] Neytral holat = shape key `0.5`, `0.0` emas
- [ ] Oyoq panjasi `y = 0` da, avatar `+Z` ga qaragan

Batafsil: [`docs/04-3d-pipeline.md`](../../docs/04-3d-pipeline.md) §2-3

## Versiya

`v3` — fayl nomidagi raqam. O'zgarish kiritilsa **yangi raqam**, eski
fayl ustiga yozilmaydi: serverda `AVATAR_SKELETON_VERSION` shu raqamga
bog'liq va eski ilovalar eski faylni so'rashda davom etadi.
