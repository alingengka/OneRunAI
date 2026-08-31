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

## อัปเดต 2026-08-27 — เปลี่ยน engine ถอดเสียงลาวเป็น ElevenLabs Scribe
- ภาษาลาว (`language === "lo"`) เรียก ElevenLabs Speech-to-Text `scribe_v2` (`https://api.elevenlabs.io/v1/speech-to-text`) ด้วย `ELEVENLABS_API_KEY` จาก connector, `language_code=lao`, และส่ง glossary เป็น `biased_keywords`
- ตรวจจริงพบว่า Scribe ถอดเสียงลาวได้ (`language_probability = 1.0`) แต่คืนข้อความเป็น "อักษรไทย" แม้ตั้ง `language_code=lao` จึงเพิ่ม `src/lib/lao-script.ts` แปลงอักษรไทย→ลาว (karan, cluster ร, สระ เ-ีย/เ-ือ/-ัว/-อ, ตัวสะกด) พร้อม unit test `src/lib/lao-script.test.ts`
- Scribe เป็น candidate เพิ่มเข้าไปในชุดเดิม ไม่ตัด gateway ออก: `th`/`en` และ pass ของลาวจาก `openai/gpt-4o-transcribe` ยังทำงานเหมือนเดิม; candidate ที่ผ่าน transliteration ถูกหักคะแนน 0.03 เพราะเป็นการแปลงแบบประมาณ
- คงพฤติกรรมเดิม: multi-candidate, `cleanup()` กรอง hallucination/สคริปต์ไทย, `scoreCandidate()` (agreement + script purity), context prompt ของ gateway, error 4xx โยนออกโดยไม่ retry (จะโยนก็ต่อเมื่อไม่มี candidate เหลือ)
- ผลวัดจริงกับคลิปลาว 4 คำจาก Lingua Libre (ref: `ປະເທດລາວ ພາສາ ວຽງຈັນ ສະບາຍດີ`): Scribe+transliteration CER 0.04, gpt-4o-transcribe CER 0.00 — ตัวอย่างเดียวยังไม่พอสรุปว่าแม่นขึ้น ต้อง benchmark คลิปพูดต่อเนื่องจริงก่อน
- ทดสอบซ้ำ (27 ส.ค. 2026) กับตัวอย่าง `ປະເທດລາວ ພາສາ ວຽງຈັນ`: Scribe HTTP 200 คืน `ประเทศลาว ภาษาเวียงจันทน์` (อักษรไทย) → แปลงแล้ว CER 0.000, gateway CER 0.000 → ยังเสมอกัน ยังไม่พิสูจน์ว่าดีขึ้น ต้องใช้คลิปพูดต่อเนื่องจริงวัด
- ถ้าไม่มี `LOVABLE_API_KEY` ภาษาลาวยังทำงานได้ด้วย ElevenLabs อย่างเดียว (gateway pass ถูกข้าม)

## อัปเดต 2026-08-27 (2) — เพิ่ม Google Gemini เป็นเอนจินที่ 3 ใน ensemble
- ตรวจ catalog จริง: Lovable AI Gateway **ไม่มี** โมเดล `google/*-transcribe` บน `/v1/audio/transcriptions` (มีเฉพาะ `openai/gpt-4o-transcribe` และ `-mini`) — Gemini ถอดเสียงผ่าน multimodal chat: `POST /v1/chat/completions` model `google/gemini-3.7-flash` + content part `input_audio` (base64 wav) ทดสอบจริงได้ HTTP 200
- `language === "lo"` ตอนนี้ยิง Scribe + Gemini ขนานกัน (`Promise.allSettled`) แล้วต่อด้วย gateway `openai/gpt-4o-transcribe` 2 pass เหมือนเดิม — ไม่มีเอนจินไหนถูกถอดออก
- Gemini คืน "อักษรลาวโดยตรง" ไม่ต้องผ่าน `thaiToLaoScript`; penalty 0.03 ผูกกับ candidate ที่ transliterate จริง (ใช้ Set แทน index) ไม่ hardcode ผู้ชนะ; ให้คะแนนด้วย `scoreCandidate()` เดิม
- ถ้าไม่มี `LOVABLE_API_KEY` → เหลือ Scribe อย่างเดียวเหมือนเดิม; `th`/`en` ไม่เปลี่ยน
- Benchmark จริง (คลิปลาว 12.6 วิ, 9 คำต่อเนื่องจาก Lingua Libre, ref `ສະບາຍດີ ປະເທດລາວ ພາສາ ລາວ ວຽງຈັນ ຫຼວງພະບາງ ແຂວງ ອາຊີອາຄະເນ ຮ້ອຍ`):
  - ElevenLabs Scribe (Thai script → transliterate): **CER 0.109**
  - `openai/gpt-4o-transcribe`: **CER 0.000** (pass ที่สองได้ 0.018)
  - `google/gemini-3.7-flash` (input_audio): **CER 0.000**
  - ผลรวม ensemble เลือกได้ CER 0.018 (แพ้ candidate ที่ดีที่สุด 0.018 เพราะ majority agreement เลือก ຫລ แทน ຫຼ)
- สรุปตามข้อมูลจริงเท่าที่มี: Gemini ดีเท่า gpt-4o บนคลิปนี้และดีกว่า Scribe ชัดเจน แต่ยังเป็นคลิปสั้น 12.6 วิที่ต่อจากคำเดี่ยว ยังไม่ใช่คำพูดต่อเนื่องธรรมชาติ — ห้ามสรุปว่าแม่นขึ้นทั่วไปจนกว่าจะ benchmark คลิปพูดจริง

## อัปเดต 2026-08-31 — Word timing จริงจาก Scribe + `alignTextToTiming`

### สถานะปัจจุบันของระบบซับ (อ่านต่อได้ทันที)
- **ข้อความ**: ensemble 3 เอนจินสำหรับ `language === "lo"` ใน `src/lib/transcribe.server.ts`
  1. ElevenLabs Scribe (`scribe_v2`, `language_code=lao`, `ELEVENLABS_API_KEY`) → คืน "อักษรไทย" ต้องผ่าน `thaiToLaoScript`
  2. `google/gemini-3.7-flash` ผ่าน Lovable Gateway `/v1/chat/completions` + `input_audio` (คืนอักษรลาวตรง)
  3. `openai/gpt-4o-transcribe` ผ่าน Gateway 2 pass (rolling context + glossary)
  ผู้ชนะเลือกด้วย `scoreCandidate()` (agreement + script purity) และหักคะแนน 0.03 ให้ candidate ที่ผ่าน transliteration
- **เวลา (ใหม่)**: `TranscriptionResult` เพิ่ม `words?: TimedWord[]` + `wordSource`; `buildScribeTiming()` รวม token ระดับอักษรของ Scribe เป็น "คำ" ด้วย `tokenizeWords` เดิม แล้วแปลงไทย→ลาว **รายคำ** (ไม่ใช่รายตัวอักษร) — เก็บ timing ไว้เสมอแม้ Scribe จะแพ้ ensemble
- `alignTextToTiming(text, timing)` ใน `src/lib/media/forced-align.ts`: Needleman–Wunsch จับคู่คำผู้ชนะกับคำที่ Scribe วัดเวลาไว้ (similarity ระดับตัวอักษร รองรับสะกดต่างเล็กน้อย), คำที่จับคู่ได้ใช้เวลาจริง, คำที่จับไม่ได้ interpolate ตาม `speechWeight` เฉพาะช่วงระหว่าง anchor สองข้าง, ถ้าจับคู่ได้ < 40% คืน `null` → fallback `forcedAlignWords` เดิม
- `alignTextToTimingOnTimeline()` แม็ปเวลาจาก chunk-local กลับไทม์ไลน์ต้นฉบับ; `src/routes/index.tsx` ใช้ที่ทุกจุด (chunk loop, whole-file, retry sync, retranscribe range) และเก็บ `measuredTimingRef` ไว้ให้ `applyTranscriptEdit` ใช้เวลาจริงตอนผู้ใช้แก้ข้อความ
- retranscribe เฉพาะช่วง, accuracy panel, glossary/lex rules, multi-candidate scoring ยังอยู่ครบ ไม่ถูกลดทอน

### ผลวัดจริง 2026-08-31 (มี ground truth)
คลิป: ต่อไฟล์คำเดี่ยว Lingua Libre 6 คำ + ความเงียบ 0.35–0.4 วิ คั่น (รวม 10.77 วิ) — ground truth คือขอบไฟล์แต่ละคำ (รวม padding เงียบในไฟล์ต้นทาง)
- ผู้ชนะ ensemble: `ສະບາຍດີ ປະເທດລາວ ພາສາ ວຽງຈັນ ຫລວງພະບາງ ຮ້ອຍ` (สะกด `ຫລ` ต่างจาก ground truth `ຫຼ` → เป็นเคสที่ต้องการทดสอบ alignment ข้ามสะกด)
- Scribe คืน 10 คำพร้อมเวลาจริง; ผู้ชนะถูกตัดเป็น 9 คำ (`ປະເທດ`+`ລາວ`, `ຫລວງ`+`ພະ`+`ບາງ` แยกกัน) → จับคู่กับ ground truth ได้ตรงคำ 4/6
- **mean |offset| เทียบ ground truth (start+end):**
  - `forcedAlignWords` (energy envelope เดิม): **1.147 s** (drift สะสม เช่น `ວຽງຈັນ` เร็วไป 1.57 s, ทั้งประโยคจบที่ 9.17 s ทั้งที่เสียงจบ 10.42 s)
  - `alignTextToTiming` (เวลา Scribe จริง): **0.299 s** (ทุกคำ start ช้ากว่า ground truth 0.20–0.43 s เพราะ ground truth นับ padding เงียบหัวไฟล์ต้นทางด้วย; ขอบจริงของเสียงพูดตรงกัน)
- สรุปตามข้อมูลนี้: บนคลิปนี้ timing จาก Scribe ตรงกว่าชัดเจน แต่เป็นคลิปต่อจากคำเดี่ยว 1 ตัวอย่าง ยังไม่ใช่คำพูดต่อเนื่องธรรมชาติ — **ห้ามสรุปว่าตรงขึ้นทั่วไป** จนกว่าจะวัดคลิปพูดจริง

### Edge case ที่ทดสอบแล้ว (regression tests ใน `src/lib/media/forced-align.test.ts`)
- คำซ้ำในประโยค (`ພາສາ ລາວ ເວົ້າ ພາສາ ລາວ`) → จับคู่ตำแหน่งถูกทั้งคู่ (global alignment รักษาลำดับ)
- ผู้ชนะมีคำเกินที่ Scribe ไม่มี → คำนั้น interpolate อยู่ในช่องว่างระหว่าง anchor เท่านั้น
- สะกดต่างเล็กน้อย (`ຫຼວງພະບາງ` vs `ຫລວງພະບາງ`) → ยังจับคู่ได้และใช้เวลาจริง
- ข้อความไม่เกี่ยวกันเลย → คืน `null` แล้ว fallback ไป forced-align

### Known issues / ต่อไป
- ถ้า Scribe ล้มเหลว (เช่นไม่มี `ELEVENLABS_API_KEY` หรือ 4xx) จะไม่มี timing จริงเลย → ทั้งคลิปกลับไปใช้ energy envelope ซึ่งวัดแล้วว่า drift มาก
- gpt-4o-transcribe บน Lovable Gateway **ไม่รองรับ** `response_format=verbose_json` / `timestamp_granularities` (ทดสอบจริงได้ HTTP 400 `This model does not support the format you provided.`) และ Gemini เป็น chat completion → ไม่มีเวลาจริงจากสองเอนจินนี้
- ground truth ที่ใช้ยังเป็นคลิปสังเคราะห์จากคำเดี่ยว ยังขาด benchmark คำพูดต่อเนื่องพร้อม timestamp อ้างอิงจริง
