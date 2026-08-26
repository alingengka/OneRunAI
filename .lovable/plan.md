# ยกระดับ Lao Subtitle และ Workflow ทั้ง 6 ส่วน

## เป้าหมาย
ทำให้การถอดเสียงลาวสำเนียงเวียงจันทน์/ลาวกลางตรวจสอบและแก้ได้จริง พร้อม workflow ครบตามภาพอ้างอิงทั้ง 6 ส่วน โดยเน้นการทำงาน ไม่คัดลอกหน้าตา และไม่อ้างความแม่นยำ 99% จนกว่าจะมีคลิปพร้อม transcript อ้างอิงสำหรับวัด CER/WER

## 1. แก้ Lao Subtitle จากต้นเหตุ
- ปรับ preprocessing เป็น mono mix ทุกช่องเสียง, resample คุณภาพดี และ normalization แบบไม่ทำลายพยัญชนะต้น/ท้าย
- แยก VAD สำหรับ “ตัด dead-air” ออกจากช่วงเสียงที่ส่งให้ ASR เพื่อไม่ให้การตัดเสียงสั้นเกินไปทำคำลาวหาย
- ทำ phrase chunks แบบมี acoustic overlap จริง โดยคง silence/context ที่จำเป็น และเก็บ timeline mapping ของเสียงแต่ละ chunk
- ถอดลาวหลาย candidate เฉพาะ chunk ที่คุณภาพต่ำ ใช้ prompt สำหรับลาวกลาง/เวียงจันทน์, rolling context และ glossary
- รวม overlap ด้วย sequence matching ที่รองรับจำนวนคำไม่เท่ากัน แทนการเทียบเฉพาะคำตำแหน่งเดียว
- แสดง candidate/ความมั่นใจต่อช่วง และให้ผู้ใช้เลือกผลหรือ re-transcribe เฉพาะช่วงได้
- ใช้ `openai/gpt-4o-transcribe` เฉพาะ speech-to-text endpoint ตาม model catalog; ถ้ามี chat/text call ใหม่ให้ใช้ `openai/gpt-5.6-sol`

## 2. Word timing และการแก้ซับ
- แก้ forced alignment ไม่ให้ frame จากคนละ speech segment ถูกนับต่อกันจนคำคร่อม silence
- จัดคำลง phrase anchors ก่อน แล้ว refine boundary ภายใน phrase ด้วย energy valley/onset และข้อจำกัด duration/order
- หลังแก้ข้อความ ให้ re-align เฉพาะ caption/ช่วงที่แก้ ไม่กระจายเวลาใหม่ทั้งคลิป
- Timeline editor เพิ่ม waveform lane, playhead, drag ขอบเวลา, multi-select, split/merge, jump-to-issue และสถานะ confidence ที่อธิบายได้
- เพิ่ม transcript benchmark utilities สำหรับ CER/WER และ timing median/p95; ตอนนี้ใช้ deterministic fixtures ก่อนเพราะยังไม่มีคลิปอ้างอิงจริง

## 3. Workflow ตาม Ref ครบ 6 ส่วน
- **AI Tools:** การ์ด Caption, Remove silence, Noise cleanup และการตั้งค่า/สถานะ/แก้ไขของแต่ละงาน
- **Style:** gallery พร้อม preview จริง, ค้น/กรอง, ตำแหน่งและขนาด รวม preset ภาษาลาว
- **Animation:** แยก “ทีละคำ” กับ “ทั้งประโยค”, preview animation, speed และ sound mapping ที่เปิด/ปิดได้
- **Caption editor:** แก้ข้อความบน preview, manual line breaks, font/weight/color/stroke/shadow/background/opacity/width/height/radius/position และ per-line overrides
- **Scenes:** scene rows พร้อม keep/drop, B-roll, Motion และ Sound tracks; เพิ่ม/ลบ/เปิดปิด/ตั้งค่ารายซีน และเห็นผลบน preview/timeline
- **Preview/export:** header actions, undo/redo, save state, TikTok safe area, export preflight, progress/cancel และไฟล์ video/SRT/CapCut package ที่ใช้ timeline เดียวกัน

## 4. โครงสร้างข้อมูลและความเสถียร
- เพิ่ม `SceneElement` สำหรับ B-roll/Motion/Sound และ persist ทุกค่าที่ผู้ใช้แก้
- เพิ่ม undo/redo history สำหรับ transcript, timing, style, scene elements และ keep/drop โดยไม่เก็บ media blob ซ้ำ
- ใช้ timeline map กลางเดียวสำหรับ preview, captions, dead-air, scene elements, SRT, XML และ burned video
- เพิ่ม export preflight ตรวจ media support, tracks, duration, caption bounds และ codec/extension
- ทำ cancellation cleanup ให้หยุด media tracks, recorder, animation callbacks และ audio context ทุกเส้นทาง

## 5. การตรวจรับ
- Unit tests: Lao normalization/tokenization, variable-length overlap merge, no word crossing silence, monotonic timing, timeline remap และ scene element persistence
- Browser tests: upload → Lao subtitle → เลือก candidate/แก้คำ → re-align → ตัด dead-air → เพิ่ม B-roll/Motion/Sound → export/cancel
- ตรวจ desktop และ mobile ว่า workflow ใช้งานได้, preview ไม่ล้น safe area และทุกปุ่มมีผลจริง
- ทดสอบ STT endpoint จริงอย่างน้อยหนึ่งคำขอและตรวจ error/status ตาม Gateway contract

## ลำดับดำเนินงาน
1. แก้ audio preprocessing, chunk timeline และ forced alignment พร้อม tests
2. เพิ่ม targeted candidate/re-transcribe และ caption timing workflow
3. ทำ Style/Animation/Caption editor ให้ครบตาม Ref
4. ทำ Scene elements และ timeline integration
5. รวม persistence, undo/redo, export preflight/cancel
6. ทดสอบ end-to-end; เมื่อมีคลิปอ้างอิงภายหลังจึงวัด CER/WER และปรับต่อจากข้อมูลจริง

## Technical details
- `*.functions.ts` เป็น thin server-function wrappers เท่านั้น; runtime helpers อยู่ใน `*.server.ts`/client-safe helper files
- STT ส่ง multipart WAV ที่ container/type ตรงจริง, ไม่ส่ง language code `lo`, และ surface ข้อผิดพลาด 4xx โดยไม่ retry
- UI ใช้ design tokens และ components เดิม; ภาพ Ref ใช้เป็น functional reference เท่านั้น ไม่ฝังลงแอป
- แยกงานเป็น focused modules เพื่อลด route หลักที่มีขนาดใหญ่และลด regression
