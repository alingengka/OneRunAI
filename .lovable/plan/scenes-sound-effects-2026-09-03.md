# Scenes: Sound effects (เสร็จ + ผลทดสอบจริง)

## สิ่งที่ทำ
- `src/lib/media/sfx.ts` — 5 preset สังเคราะห์ด้วย Web Audio ล้วน (whoosh / impact / ding / riser / click) รับ `BaseAudioContext` จึงใช้ได้ทั้งพรีวิว (AudioContext) และ export (OfflineAudioContext)
- `src/lib/scenes.ts` — `soundId` + `offset` + `intensity` (ความดัง) และ `sceneSoundCues()` แปลงเป็นคิวเรียงตามเวลา
- `ScenesPanel` — เลือก preset, ปุ่มทดสอบเสียง, ตั้งจังหวะ (พร้อมปุ่มตั้งจากเวลาที่เล่นอยู่), slider ความดัง
- `routes/index.tsx` — พรีวิวเล่นเสียงจริงตอนเล่นวิดีโอ กันเล่นซ้ำ/รีเซ็ตเมื่อ seek ย้อน
- `export-webcodecs.ts` `renderAudio()` — ผสมเสียงเอฟเฟกต์เข้า offline graph ต่อตรง destination (ไม่ผ่าน noise gate ของเสียงพูด) และ map เวลาไป output timeline

## ผลทดสอบจริง (Chromium headless, dev server)
1. เรนเดอร์ทุก preset ใน OfflineAudioContext ที่ t=0.5s — ได้เสียงจริงทุกตัว
   peak/rms/onset: whoosh 0.173 / 0.0081 / 0.625s (สวีปค่อยดังขึ้น), impact 0.712 / 0.0728 / 0.500s,
   ding 0.408 / 0.0231 / 0.504s, riser 0.374 / 0.0263 / 0.932s (ไต่ระดับ), click 0.307 / 0.0148 / 0.502s
2. ผสมลงไฟล์จริง: คลิป 20s, เก็บ 0–5s และ 12–17s (ตัด 5–12s), total 10s
   วางคิว 3 จุด: ในซีนที่เก็บไว้ (source 2s), ในช่วงที่ถูกตัดทิ้ง (source 8s), ซีนหลัง (source 13s)
   diff กับเสียงที่ไม่มี sfx พบ onset ที่ **2.00s / 5.00s / 6.00s** ตรงตามที่คาด —
   จุดที่ตกในช่วงเงียบถูกเลื่อนมาต้นช่วงที่เก็บไว้ถัดไป (5.00s) ไม่ error ไม่หลุด และความยาวไฟล์ยังเป๊ะ 10.00s
3. unit test `src/lib/scenes.test.ts` เพิ่มเคส cue (เวลา/preset/ความดัง/clamp/ปิดใช้งาน) — ผ่านทั้งหมด

## เหลือ
- Scenes element ตัวสุดท้าย: B-roll
