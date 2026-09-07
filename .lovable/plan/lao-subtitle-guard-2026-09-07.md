# รั้วกันพังถาวรสำหรับซับลาว (2026-09-07)

## สิ่งที่เพิ่ม
- `scripts/lao-subtitle-guard.ts` (`bun run guard:lao`)
  - (ก) ถอดเสียง ensemble จริง (ElevenLabs Scribe + Gemini + GPT-4o) กับคลิปคงที่
    `tests/fixtures/lao-sample.wav` เทียบ CER/WER กับ `tests/fixtures/lao-sample.json`
    CER ห้ามสูงกว่า baseline แม้แต่นิดเดียว (WER เป็นตัวชี้วัดรอง เพราะการเว้นวรรคของ
    เครื่องถอดเสียงไม่คงที่ระหว่างรอบทั้งที่ตัวอักษรตรง 100%)
  - (ข) ความครบถ้วนของซับ: ใช้ Playwright + โค้ดวาดจริง (`createBurnRenderer`)
    ดัก `fillText` เพื่อนับคำที่ถูกวาดจริงและตรวจว่าทุกคำอยู่ในกรอบ 0–1080 px
    ทดสอบครบ **21 ฟอนต์ × 4 กรณี (ปกติ / Bold / Italic / Bold+Italic) = 84 กรณี**
    ด้วยประโยคลาว 16 คำที่ยาวเกินหนึ่งบรรทัด
- กฎถาวรใน `AGENTS.md` (ไฟล์ที่ agent อ่านทุกครั้ง): ต้องรัน guard ก่อนส่งทุกงาน
  ถ้าไม่ผ่านห้ามส่งงาน

## ผลรันล่าสุด (โค้ดปัจจุบัน หลังงาน Bold/Italic)
```
(ก) ถอดเสียง: "ສະບາຍດີ ທຸກຄົນ ມື້ນີ້ ພວກເຮົາ ຈະມາຮຽນ ພາສາລາວ ນຳກັນ"
    CER 0.000 (baseline 0.000) | WER 0.333 (ตัวชี้วัดรอง)
(ข) layout/burn: ตรวจ 84 กรณี — ผ่าน 84, ไม่ผ่าน 0 (ไม่มีคำหาย ไม่มีคำหลุดกรอบ)
✅ LAO SUBTITLE GUARD PASSED
```

## หมายเหตุการใช้งาน
- ต้องมี dev server ที่ `http://localhost:8080` (ปรับได้ด้วย `GUARD_APP_URL`)
- `--layout-only` ข้าม STT จริง, `--update-baseline` เขียน baseline ใหม่ (ใช้เมื่อผู้ใช้อนุมัติเท่านั้น)
