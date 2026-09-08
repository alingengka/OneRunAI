# แบ่ง/เพิ่มซีนเอง (manual scene split)

## ขอบเขตที่ทำเสร็จ
- `src/lib/scenes.ts`: เพิ่ม `splitSceneAt(scenes, time)` — แบ่งซีนที่ครอบคลุมเวลานั้นเป็นสองซีน
  (ไม่แบ่งถ้าใกล้ขอบซีนน้อยกว่า `MIN_SPLIT_GAP` = 0.3 วินาที), แยก `segments` ตรงจุดตัด,
  แบ่งข้อความตามสัดส่วนเวลา, จัด `index` ใหม่ต่อเนื่อง
  ซีนแรกคง `id` เดิม ซีนที่สองได้ `id` ใหม่ `<เดิม>+<เวลา>` (เสถียร ไม่ชนกันเมื่อแบ่งซ้ำ)
- `reassignElementsAfterSplit(elements, oldScene, newScenes)`: element (Motion/Sound/ViralText/B-roll)
  ที่ timing อยู่หลังจุดแบ่ง จะย้าย `sceneId`/`id` ไปซีนที่สองและปรับ `offset` ให้สัมพัทธ์กับ start ใหม่
  ส่วนที่อยู่ก่อนจุดแบ่งคงเดิม
- `src/routes/index.tsx`: เพิ่ม state `splitPoints` (บันทึกลงงานที่เซฟไว้ผ่าน `project-store`)
  และ `scenes` = ผลของ `splitSceneAt` ทับบน `buildScenes(segments, words)` ตามลำดับเวลา
  ล้าง `splitPoints` เมื่ออัปโหลดไฟล์ใหม่ ทำให้ทุกเส้นทาง (พรีวิว motion/B-roll, drop scene, export) ใช้ซีนชุดเดียวกัน
- `ScenesPanel.tsx`: ปุ่มกรรไกรสีม่วง (theme token) ในการ์ดซีน — แบ่งตรง playhead ถ้าอยู่ในซีนนั้น
  ไม่งั้นแบ่งกึ่งกลางซีน; ปิดปุ่มเมื่อซีนสั้นกว่า 0.6 วินาที

## Backward compatible
- ไม่มี `splitPoints` = พฤติกรรมเดิมจากการตัดเงียบอัตโนมัติทุกประการ
- ไม่แตะ `transcribe.server.ts`, `forced-align.ts`, `audio.ts`

## การตรวจรับ
- typecheck ผ่าน; ทดสอบ `splitSceneAt`/`reassignElementsAfterSplit` โดยตรง: แบ่งที่ 5 วินาทีของซีน 0–10
  ได้ 2 ซีน index 0/1 และ Viral text ที่ offset 7 ย้ายไปซีนที่สองด้วย offset 2, Motion ยังอยู่ซีนแรก
- `bun run guard:lao`: (ก) CER/WER 0.000 เท่า baseline, (ข) layout/burn 84/84, (ง) ซับหาย 0 จุด,
  (ฉ) code-switching ผ่าน — ส่วน (ค) integration ผ่าน UI ใช้เวลานานมากและยังรันค้างอยู่ตอนปิดงาน

---

# ข้อความตัวอย่างสไตล์ตามภาษาถอดเสียง

## ขอบเขตที่ทำเสร็จ
- `src/lib/captions.ts`: `sampleTextByLanguage` = คำเดียวต่อภาษา (lo: "ຕົວຢ່າງ", th: "ตัวอย่าง",
  en: "Example") และ helper `sampleTextForLanguage(language)` — fallback ไทยเมื่อไม่รู้จักภาษา
  (คำลาวมีวรรณยุกต์ ່ และสระ ົ / າ ครบ ใช้ทดสอบการแสดงผลสไตล์ได้)
- `StylePicker.tsx`: `PresetPreview` รับ `text` prop; การ์ดทุกแท็บ (สไตล์คงที่/อนิเมชัน/ของฉัน) ใช้ข้อความตามภาษา
  ผ่าน prop `language` ใหม่ — สไตล์ (สี/ฟอนต์/stroke/shadow) apply เหมือนเดิมทุกอย่าง
- `StyleControls.tsx`: กล่องพรีวิวหน้า "แก้คำบรรยาย" ใช้ `sampleTextForLanguage(language)` เช่นกัน
- `src/routes/index.tsx`: ส่ง `language={languages[0] ?? "th"}` ให้ทั้งสองคอมโพเนนต์ — reactive ทันทีเมื่อสลับภาษา
- `scripts/lao-subtitle-guard.ts`: ทำให้ด่าน (ค) เสถียรขึ้น — ใช้ locator ของ input ไฟล์ตัวแรกพร้อม timeout 90 วิ
  และขยายเวลารอถอดเสียงเป็น 300 วิ (ไม่ลดขอบเขตการตรวจใด ๆ)

## การตรวจรับ
- Playwright: สลับภาษา ລາວ/ไทย/English แล้วข้อความตัวอย่างในทุกการ์ดและกล่องพรีวิวเปลี่ยนทันที
- `bun run guard:lao` เต็มรูปแบบ: ✅ PASSED ครบ 6 ด่าน — (ก) CER/WER 0.000 เท่า baseline,
  (ข) layout/burn 84/84, (ค) integration ผ่าน UI 84/84, (ง) ซับหาย 0 จุด,
  (จ) คลิปยาว 27.5 วิ ช่องว่างรวม 0.49 วิ (เกณฑ์ 1.2), (ฉ) code-switching ผ่าน
- ไม่แตะ logic ถอดเสียง/ตัดเงียบ
