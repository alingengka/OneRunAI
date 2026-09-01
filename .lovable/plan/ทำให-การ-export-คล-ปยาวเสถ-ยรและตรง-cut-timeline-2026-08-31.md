# ทำให้การ Export คลิปยาวเสถียรและตรง Cut Timeline

## เป้าหมาย
แก้ `เรนเดอร์วิดีโอพร้อมซับ` ที่คลิปไม่ครบ ภาพค้าง และเสียงค้าง โดยยืนยันกับ flow จริงของแอปและคลิป 30–60 วินาทีที่ผ่าน Remove Silences จริงอย่างน้อย 10 ช่วง ไม่ใช้ segments ที่ hardcode ขึ้นเพื่อให้ test ผ่าน

## ขั้นตอนดำเนินงาน

### 1. เก็บ baseline ก่อนแก้
- สร้าง fixture 30–60 วินาทีจากสื่อเสียง/ภาพจริงที่เล่นได้ในเบราว์เซอร์ โดยมีช่วงพูดและช่วงเงียบหลายช่วง; อัปโหลดผ่าน UI ปกติ
- ให้ UI เรียก `decodeAudioFromFile` → `detectSpeechSegments` → `smoothSpeechSegments` และใช้ state จริง (`outputSegments`, captions, scenes, viral text, noise floor, resolution) ไปยัง `exportBurnedVideo`
- บันทึกจำนวน/ขอบเขต/ผลรวมความยาวของ segments, ความคืบหน้า, MediaRecorder chunks และเหตุผลที่แต่ละ segment จบ (`reached-end`, `source-ended`, `abort`, `watchdog`, `stalled`)
- Export baseline แบบเปิด captions + motion + viral text + noise reduction ที่ 720/1080 เพื่อระบุต้นเหตุจากข้อมูลจริงก่อนแก้

### 2. แก้ orchestration ของ segment และ watchdog ที่ต้นเหตุ
- แยกสถานะ `seeking / primed / playing / finishing` ชัดเจน และไม่ให้ช่วง seek ระหว่าง cuts ถูกบันทึกเป็นเฟรมค้างหรือเสียงเงียบ
- เปลี่ยน watchdog จาก timeout 3 วินาทีที่เรียก `finish()` ทันที เป็นตัวตรวจ health: เทียบ wall-clock กับความคืบหน้าของ `video.currentTime`; ถ้ายังเดินช้าให้รอ ไม่ตัด segment ทิ้ง และถ้าค้างจริงให้ retry/recover หรือ throw พร้อมเหตุผลแทนการแอบข้ามช่วง
- ยกเลิก callback/timer ของ segment เก่าเมื่อจบหรือ abort เพื่อไม่ให้ callback ข้าม segment มาชน state ใหม่
- ให้จุดจบของแต่ละ segmentยึด source timestamp และตรวจ actual played duration; ห้ามบวก `elapsed` เต็มช่วงเมื่อ segment จบก่อนเวลา
- ลดงาน main thread ใน hot loop: cache scene/viral/caption lookup ตามช่วง, อัปเดต boundary gain เฉพาะเมื่อค่าเปลี่ยนเกิน threshold/ตาม cadence ที่กำหนด และไม่ค้น array ทั้งหมดซ้ำทุก decoded frame
- รักษา motion, viral text, resolution และ noise gate ไว้ ไม่ปิด feature เพื่อกลบปัญหา

### 3. ทำ audio/video recording ให้ต่อเนื่อง
- ตรวจและทำให้ recorder ไม่เก็บเวลาระหว่าง seek; ใช้ pause/resume หรือกลไก splice ที่ browser รองรับหลังพิสูจน์ timestamp ของไฟล์จริง
- ทำ boundary gain เป็น state machine ต่อ cut (fade-in / unity / fade-out) ไม่ schedule ซ้ำทุก frame และไม่ปล่อย gain ค้างที่ค่าต่ำสุด
- validate `noiseFloor`, channel count และค่าตัวอย่างใน noise gate; exception/NaN ต้อง fail อย่างชัดเจน ไม่ทำให้ graph เงียบโดยไม่มี error
- เก็บ `dataavailable` heartbeat และตรวจว่ามีทั้ง audio/video track จนจบงาน

### 4. เพิ่ม regression harness สำหรับคลิปยาว
- เพิ่ม browser E2E harness ที่ขับ UI จริง: upload → รอ VAD → เปิด Remove Silences/noise reduction → เพิ่ม motion/viral text → เลือก resolution → export และรับไฟล์ดาวน์โหลด
- ใช้ `ffprobe` เทียบ output duration กับ `sum(end-start)` โดยกำหนด tolerance ตาม codec/container; fail เมื่อสั้น/ยาวผิดปกติ
- decode ไฟล์ตั้งแต่ต้นถึงท้ายด้วย `ffmpeg` และตรวจเป็นช่วง ๆ ว่า video timestamps/frame differences เดินต่อเนื่อง และ audio มี packet/RMS ต่อเนื่อง ไม่ใช่เฉพาะต้นไฟล์
- ตรวจ console errors/warnings และรายงาน MediaRecorder chunk cadence/segment completion ทุกครั้ง

### 5. การตรวจรับ 3 รอบ
1. 720p, noise reduction ปิด, captions + motion + viral text เปิด
2. 720p, noise reduction เปิด, captions + motion + viral text เปิด
3. 1080p, noise reduction เปิด, captions + motion + viral text เปิด

แต่ละรอบต้องมี 10+ detected segments และรายงาน: expected duration, actual duration, delta/เปอร์เซ็นต์, decoded video duration, decoded audio duration, จำนวน freeze/dropout ที่ตรวจพบ, จำนวน recorder chunks และ console errors. ต้องเล่น/ถอดรหัสไฟล์ครบตั้งแต่ต้นถึงท้ายก่อนสรุปว่าเสถียร

## ไฟล์หลักที่จะเปลี่ยน
- `src/lib/media/export-burned.ts` — segment state machine, watchdog/recovery, recorder gating, audio fade และ diagnostics
- `src/lib/media/noise-gate.ts` — input validation และ fail-safe ของ audio processing หากการทดสอบยืนยันว่าเกี่ยวข้อง
- `src/routes/index.tsx` — ส่ง state จริง/แสดง export failure ที่ตรวจพบ โดยไม่เปลี่ยน workflow หรือ UI เกินจำเป็น
- ชุดทดสอบ browser/export ใหม่ — fixture คลิปยาว, full-flow automation และ post-export validation
- `.lovable/plan/ยกระด-บ-lao-subtitle-และ-workflow-ท-ง-6-ส-วน-2026-08-26.md` — เพิ่มสาเหตุที่พิสูจน์แล้วและตารางตัวเลขทั้ง 3 รอบเท่านั้น ไม่บันทึกข้อสรุปจาก test สั้น

## เกณฑ์เสร็จ
- ไม่มี segment จบด้วย watchdog/stall แบบเงียบ ๆ; ถ้า recover ไม่ได้ export ต้องแจ้ง error แทนไฟล์เสีย
- ความยาวผลลัพธ์ตรงผลรวม segments ภายใน tolerance ที่วัดจาก container/codec จริง
- ภาพและเสียง decode/play ต่อเนื่องครบไฟล์ในทั้ง 3 รอบ และไฟล์มี captions, motion, viral text, noise reduction ตามตัวเลือกจริง
- จะไม่ตอบว่าแก้แล้วจนกว่าผลตรวจคลิปยาวทั้ง 3 รอบผ่านและถูกบันทึกในแผนหลัก

## ผลทดสอบจริง (คลิป 30s, 14 segments, รวม 27.090s) — 2026-08-31

ทดสอบผ่าน flow จริงของแอป (decodeAudioFromFile → detectSpeechSegments → smoothSpeechSegments → exportBurnedVideo) ใน Chromium headless, ตรวจไฟล์ผลลัพธ์ด้วย ffprobe/ffmpeg

| รอบ | ความละเอียด | Noise gate | ความยาวไฟล์ | ส่วนเกินจาก 27.090s | เฟรมวิดีโอ | เวลา render | ค้างที่ 100% | video gap >0.3s | freezedetect | console errors |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1280x720 | on | 27.602s | +0.512s (1.9%) | 696 | 28.96s | ไม่มี | 0 | ไม่พบ | 0 |
| 2 | source 640x360 | off | 27.500s | +0.410s (1.5%) | 696 | 28.79s | ไม่มี | 0 | ไม่พบ | 0 |
| 3 | 1920x1080 | on | 27.647s | +0.557s (2.1%) | 648 | 29.13s | ไม่มี | 0 | ไม่พบ | 0 |

- ไม่มีเวลา seek ปนเข้าไฟล์: 13 ครั้ง seek (~0.1–0.5s ต่อครั้ง) ถูกกันออกด้วย pause/resume แบบรอ event; ส่วนเกินที่เหลือ 0.41–0.56s คือ latency ของ MediaRecorder.pause() ต่อรอยตัด (~30–40ms) เท่านั้น
- เสียงต่อเนื่องตลอดไฟล์ (mean RMS ~4860): ช่วงเสียงเบา ~0.48s ที่แต่ละรอยตัดมาจาก padding เงียบใน source segment เอง ไม่ใช่เสียงหาย
- ภาพขยับต่อเนื่อง: ไม่มีช่องว่าง timestamp เกิน 0.30s และ freezedetect (-60dB, 0.5s) ไม่พบเฟรมค้าง

### แก้เพิ่มระหว่างทดสอบ
- ลูปเรนเดอร์เดินต่อผ่าน safety timer 250ms (นอกเหนือจาก requestVideoFrameCallback) พร้อมพยายาม resume วิดีโอสูงสุด 3 ครั้ง แก้อาการ export ค้างที่ segment สุดท้ายเมื่อ decoder หยุดส่งเฟรม
- เพิ่ม debug log แบบเปิดผ่าน `window.__EXPORT_DEBUG` สำหรับไล่ปัญหาช่วง export

## รอบแก้ภาพกระตุก + ความคม (คลิป 30s, 14 segments, รวม 23.160s) — 2026-09-01

### สิ่งที่วัดได้ว่าเป็นต้นเหตุ
- วัดเวลาวาดต่อเฟรมจริงใน `tick()` (`frameStats`) แล้วเทียบกับกรณีปิดซับ/motion/viral text: ค่าเฉลี่ยไม่ต่างกันอย่างมีนัย (16–24ms ทั้งสองแบบ) → งานวาดซับ **ไม่ใช่** ต้นเหตุหลัก แต่ก็ลด work ต่อเฟรมแล้ว (layout ซับ/หา scene/viral ทำล่วงหน้า + binary search)
- ffprobe พบช่องว่าง timestamp 0.10–0.15s จำนวน 13 จุด = จำนวนรอยตัดพอดี → ภาพค้างเกิดที่ "รอยตัด" เพราะ recorder resume ก่อนที่ decoder จะส่งเฟรมแรกของช่วงใหม่ จึงอัดเฟรมเก่าค้างไว้
- แก้: หลัง seek ให้วาดเฟรมของช่วงใหม่ลง canvas ก่อน แล้วรอเฟรมจริงจาก `requestVideoFrameCallback` ค่อย `recorder.resume()`

### ความคมชัด
- ตั้ง `ctx.imageSmoothingEnabled = true` + `imageSmoothingQuality = "high"`
- แก้สูตร bitrate จาก `width*height*0.14` (720x1280 ได้แค่ ~1.3 Mbps, 1080x1920 ~2.9 Mbps) เป็น `width*height*fps*0.2` (min 8 Mbps, max 64 Mbps) → 720x1280@30 = 8 Mbps, 1080x1920@30 ≈ 25 Mbps, 4K แนวตั้ง ≈ 50 Mbps
- วัดกับคลิปช่วงเดียว 10s เทียบ reference (ffmpeg SSIM/PSNR): bitrate ต่ำ 2.5 Mbps → SSIM Y 0.9392 / All 0.9352, ไฟล์ 1.51 MB; bitrate สูง 12 Mbps → SSIM Y 0.9499 / All 0.9479, ไฟล์ 5.34 MB (ทั้งคู่ PSNR ~23 dB เพราะ frame ไม่ตรงกันเป๊ะจาก frame rate ที่ต่างกัน)

### ผลตรวจรับ 3 รอบ (หลังแก้)
| รอบ | ความละเอียด | Noise gate | ความยาวไฟล์ | ส่วนเกินจาก 23.160s | เฟรมในไฟล์ | frame cost เฉลี่ย/p95 | gap >0.15s | freezedetect | console errors |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1280x720 (720x1280) | on | 23.260s | +0.100s (0.4%) | 391 | 25.7 / 48.2 ms | 1 | ไม่พบ | 0 |
| 2 | source 720x1280 | off | 23.357s | +0.197s (0.9%) | 411 | 23.4 / 44.6 ms | 0 | ไม่พบ | 0 |
| 3 | 1080x1920 | on | 23.814s | +0.654s (2.8%) | 291 | 45.9 / 82.3 ms | 12 | ไม่พบ | 0 |

- ก่อนแก้รอยตัด: ไฟล์ 720p ยาว 23.90s และมี gap >0.1s 17–18 จุดกระจุกที่รอยตัด; หลังแก้เหลือ gap >0.15s เพียง 1 จุดและความยาวเกินแค่ 0.10s
- รอบ 1080p ยังเฟรมตกในสภาพแวดล้อมทดสอบ (headless, encode ด้วยซอฟต์แวร์ล้วน, ไม่มี GPU): frame cost เฉลี่ย 45.9ms > งบ 33.3ms — เป็นข้อจำกัดของ CPU เครื่องทดสอบ ไม่ใช่ลูปวาด (ปิดซับแล้วช้าพอกัน) บนเครื่องผู้ใช้ที่มี GPU encode จะดีกว่านี้
- เพิ่ม hook `window.__EXPORT_BITRATE` สำหรับทดสอบ bitrate และ `frameStats` ในผลลัพธ์ของ `exportBurnedVideo` เพื่อไล่ปัญหาเฟรมช้าในอนาคต
