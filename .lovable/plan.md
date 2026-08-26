# ยกระดับ ShortCut Studio และ Lao AI Subtitle

## เป้าหมาย
พัฒนา editor ให้มี workflow ที่ชัดและใช้งานคล้ายตัวอย่าง Ref หรือดีกว่า โดยให้ Lao AI Subtitle เป็นหัวใจหลัก: ถอดคำลาวให้ถูกขึ้น จับเวลาระดับคำให้ตรงเสียง แสดงจุดที่ไม่มั่นใจให้แก้ได้เร็ว และส่งออกวิดีโอที่เสถียร

> เป้าหมาย 99% จะวัดกับชุดคลิปทดสอบที่กำหนดได้ แต่ไม่สามารถรับประกัน 99% กับทุกคลิป เพราะสำเนียง เสียงซ้อน ไมค์ และเสียงรบกวนมีผลโดยตรง ระบบจะแสดงคะแนนแบบตรวจสอบได้แทนการอ้างเปอร์เซ็นต์จาก heuristic อย่างเดียว

## สิ่งที่จะสร้าง

### 1. Lao High-Accuracy transcription pipeline
- แยกเสียงพูดด้วย VAD ที่รักษาพยางค์ต้น/ท้ายและไม่ตัดลมหายใจสั้นเกินไป
- สร้างช่วงถอดเสียงแบบ overlap เพื่อไม่ให้คำลาวตรงรอยต่อ chunk หาย
- ถอดเสียงแบบหลาย candidate เฉพาะช่วงที่คุณภาพต่ำ แล้วเลือกผลด้วยความสอดคล้องระหว่าง candidate, อักษรลาว, บริบทก่อนหน้า และความยาวเสียง
- รวมข้อความบริเวณ overlap โดยตัดคำซ้ำและคงลำดับเดิม
- เพิ่ม glossary คำลาว/ชื่อเฉพาะของโปรเจกต์ เพื่อช่วยสะกดคำที่เกิดซ้ำให้คงที่
- ทำ error handling ตามสถานะ Gateway และไม่ retry ข้อผิดพลาดถาวร

### 2. Word timing ที่ตรวจสอบได้
- แทนการกระจายคำตาม energy อย่างเดียวด้วย two-stage alignment: phrase anchors จาก VAD + acoustic boundary refinement ภายในวลี
- ป้องกันคำข้าม silence gap, เวลาซ้อนกัน และคำสั้น/ยาวผิดปกติ
- เก็บ confidence รายคำจาก transcript agreement, acoustic fit และ boundary quality
- แสดงสถานะ “มั่นใจสูง / ควรฟังตรวจ / ต้องแก้” ไม่ใช้เปอร์เซ็นต์ที่ไม่มีหลักฐาน
- ปุ่ม re-transcribe เฉพาะช่วงและ re-align หลังแก้ข้อความ โดยไม่ต้องประมวลผลทั้งคลิป

### 3. Editor workflow ตาม Ref
- จัดหน้าจอ desktop เป็นแผงเครื่องมือด้านซ้าย + preview 9:16 แบบ sticky ด้านขวา และปรับเป็น stacked layout บนมือถือ
- แบ่งโหมดชัดเจน: AI Subtitles, Style, Animation, Edit captions, Audio/Dead-air และ Export
- Style gallery แสดงตัวอย่างจริง, animation gallery แยกทีละคำ/ทั้งประโยค และ controls รายบรรทัด
- Caption inspector แสดงรายการช่วงเวลา, คำ, confidence และปุ่มฟังเฉพาะช่วง
- Timeline ระดับคำด้านล่าง พร้อมเลือกหลายคำ แยก/รวม แก้เวลา และ jump ไปยังจุดผิดปกติ
- Preview รองรับลากตำแหน่ง ดับเบิลคลิกแก้ แยกบรรทัด และ TikTok safe-area โดยไม่ให้ข้อความหลุดกรอบ

### 4. Dead-air และ export
- ปรับ cut boundaries ด้วย pre/post-roll และรวมช่องว่างสั้นเพื่อให้รอยตัดลื่น
- ใช้ timeline mapping เดียวกันกับ preview, captions, SRT และ burned video เพื่อไม่ให้เวลาคลาดหลังตัด silence
- เพิ่ม export preflight ตรวจ codec, duration, audio track, caption bounds และขนาดไฟล์ก่อนดาวน์โหลด
- ถ้า browser ไม่รองรับ MP4 จะระบุ WebM อย่างชัดเจน ไม่ตั้งนามสกุลผิด codec
- แสดง progress/cancel และข้อความผิดพลาดที่แก้ไขได้

### 5. การวัดผล
- เพิ่ม deterministic tests สำหรับ Lao tokenization, overlap merge, word ordering, silence boundaries และ timeline remap
- เพิ่ม benchmark runner สำหรับคลิปลาวที่มี transcript อ้างอิง วัด CER/WER และ timing error (median/p95)
- เกณฑ์รับงาน: ไม่มีคำข้ามช่วงเงียบ, ไม่มี timestamp ซ้อน, export duration ตรงกับ kept timeline และผลซ้ำได้จาก input เดิม
- ตรวจ UI และ flow จริงใน desktop/mobile ด้วยคลิปทดสอบ ตั้งแต่อัปโหลด → Lao subtitle → แก้คำ → ตัด dead-air → export

## Technical details
- แยก runtime helpers ออกจาก `*.functions.ts` ให้ server function เป็น thin wrapper ตามข้อกำหนด TanStack Start
- ใช้ `openai/gpt-4o-transcribe` ผ่าน Lovable AI สำหรับ STT; เก็บ API key และ prompt ฝั่ง server เท่านั้น
- เพิ่มชนิดข้อมูล `TranscriptCandidate`, `AlignedWord`, `WordConfidence`, `TimelineMap` และใช้ timeline map เดียวตลอด pipeline
- ปรับหลัก ๆ ใน audio analysis, transcription helper/server function, forced alignment, caption editing, timeline editor, route composition และ video exporters
- Ref images ใช้เป็นแนวทาง UX เท่านั้น ไม่ฝังภาพ Ref ลงในแอป

## ลำดับดำเนินงาน
1. สร้าง tests/benchmark และชนิดข้อมูลกลางก่อน เพื่อวัด regression ได้
2. ทำ Lao overlapping transcription + candidate scoring/merge
3. ทำ confidence-aware forced alignment และ targeted retry
4. ปรับ editor layout/inspector/timeline ตาม Ref
5. รวม timeline mapping กับ dead-air และ export preflight
6. ทดสอบ end-to-end ด้วยการเรียก STT จริงและ browser ทั้ง desktop/mobile
