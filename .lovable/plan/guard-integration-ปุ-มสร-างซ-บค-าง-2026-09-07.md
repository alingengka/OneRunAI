# สาเหตุจริง: integration test ค้างที่ปุ่ม "สร้างซับด้วย AI" (2026-09-07)

## อาการ
`bun run guard:lao` ส่วน (ค) integration ล้ม เพราะปุ่ม "สร้างซับด้วย AI" ยัง disable
(`transcribing || !file`) หลังสคริปต์ `setInputFiles`

## สาเหตุจริง (ยืนยันด้วยเบราว์เซอร์จริง)
ไม่เกี่ยวกับการลบ StepBar และไม่ใช่บั๊กของแอป — เป็น **hydration race ในสคริปต์ทดสอบ**
- guard เดิมใช้ `waitForTimeout(2000)` แบบตายตัวหลัง `goto`
- ถ้า React ยัง hydrate ไม่เสร็จ event `change` ของ `<input type="file">` ยิงออกมาจริง
  (นับได้ 1 ครั้ง) แต่ยังไม่มี handler ของ React มารับ → `onPickFile` ไม่ทำงาน →
  `file` ไม่ถูกตั้งค่า → ปุ่มค้าง disable
- ทดสอบซ้ำโดยรอ hydrate ก่อน: `change` ยิง, `videoUrl` ถูกตั้ง, ปุ่ม enable ภายใน ~1.5 วินาที
- ยืนยันซ้ำอีกทางว่าเป็น race: การกดปุ่ม "อัปโหลดคลิป" ก่อน hydrate ก็ไม่เปิด file chooser เช่นกัน

## การแก้
`scripts/lao-subtitle-guard.ts` → `checkIntegration()`
- รอ `window.__shortcutState` ปรากฏ (สัญญาณว่า hydrate เสร็จ) แทน `waitForTimeout`
- รอปุ่ม "สร้างซับด้วย AI" มองเห็นได้ ก่อนป้อนไฟล์
- หลัง `setInputFiles` รอจนปุ่ม **ไม่ disable** จริง (retry ได้สูงสุด 3 รอบ, เคลียร์ไฟล์ก่อนลองใหม่)
- ปุ่มภาษาใช้ `.first()` กันชนกับปุ่มแปลชื่อเดียวกัน
- ลบการ `classList.remove("hidden")` ที่ไม่จำเป็น (คลาสอยู่ที่ `<span>` ครอบ ไม่ใช่ที่ input)

## ผลรัน `bun run guard:lao` (เต็ม)
```
(ก) CER 0.000 (baseline 0.000)
(ข) layout/burn 84 กรณี — ผ่าน 84
(ง) ช่วงเวลาซ้อนกัน 153,490 จุด — ซับหาย 0
(ค) integration ผ่าน UI จริง 84 กรณี — ผ่าน 84
✅ LAO SUBTITLE GUARD PASSED
```

## ทดสอบมือ (ไม่ผ่าน guard)
กดปุ่ม "อัปโหลดคลิป" → เลือก `tests/fixtures/lao-sample.wav` → ปุ่ม "สร้างซับด้วย AI" enable →
กดแล้วได้ซับ: `ສະບາຍດີ ທຸກ ຄົນ , ມື້ ນີ້ ພວກ ເຮົາ ຈະ ມາ ຮຽນ ພາສາ ລາວ ນຳ ກັນ .`
