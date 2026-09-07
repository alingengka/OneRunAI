# สาเหตุจริงที่ guard:lao ไม่ผ่าน (2026-09-07)

## 1. ปุ่ม "สร้างซับด้วย AI" ค้างที่ disabled ระหว่าง integration test
- ไม่ใช่ผลจากการลบ StepBar และไม่ใช่บั๊กของแอป
- `input[type="file"]` ที่ผูกกับ `onPickFile` เป็นตัวเดียวจริง (ไม่ชนกับ input ฟอนต์/เสียง)
- `onPickFile` ไม่ได้ throw ระหว่าง decode/analyze
- สาเหตุจริง: สคริปต์ทดสอบเรียก `setInputFiles` ก่อนหน้า hydrate เสร็จ → React ยังไม่ผูก
  `onChange` กับ input ทำให้ event หลุด และ state `file` ไม่ถูกตั้งค่า
- แก้: guard script รอหน้าพร้อม (`__shortcutState` ปรากฏ) แล้วรอปุ่มอยู่ในสถานะกดได้
  ก่อนเดินขั้นต่อไป

## 2. WER 0.833 ทั้งที่ CER 0.000
- สาเหตุจริง: `wordErrorRate` ตัดคำด้วยช่องว่าง แต่ภาษาลาวไม่เว้นวรรคระหว่างคำ
  เครื่องถอดเสียงจึงวางช่องว่างไม่คงที่ ทำให้ WER สูงทั้งที่ตัวอักษรตรง 100%
- แก้ที่ `src/lib/transcript-metrics.ts`: ตัดคำด้วย `Intl.Segmenter("lo", { granularity: "word" })`
  และตัดเครื่องหมายวรรคตอนออกก่อนเทียบ

## ผลลัพธ์
`bun run guard:lao` (เต็ม) ผ่านครบ: CER 0.000 / WER 0.000, layout 84/84,
integration ผ่าน UI จริง 84/84, ช่วงซ้อนเวลาไม่มีซับหาย
