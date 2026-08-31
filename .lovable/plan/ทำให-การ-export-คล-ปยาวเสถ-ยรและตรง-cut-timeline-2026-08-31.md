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
