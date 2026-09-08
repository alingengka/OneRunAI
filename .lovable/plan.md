# B-roll (cutaway) ต่อซีน — ค้นหาจาก KLIPY + อัปโหลดเอง

## ขอบเขตที่ทำเสร็จ
- `SceneElement` เพิ่ม `assetUrl`, `assetType`, `assetSource`, `searchQuery` + `updateSceneElementAsset()`
- `BrollPicker.tsx`: dialog 2 แท็บ — "ค้นหา" (KLIPY ผ่าน `klipy.functions.ts` + คำเตือนลิขสิทธิ์สีเหลืองใต้กริด) และ "อัปโหลดเอง" (bucket `broll-assets` แบบส่วนตัว ผู้ใช้เห็นเฉพาะไฟล์ตัวเอง)
- `BrollEditor.tsx` ในการ์ดซีน: thumbnail, ปุ่มเปลี่ยนสื่อ/เอาสื่อออก, คำเตือนเมื่อใช้สื่อจาก KLIPY
- พรีวิว `BrollOverlay.tsx`: cutaway เต็มเฟรม (cover) ซับ/ข้อความไวรัลยังทับด้านบน วิดีโอเริ่มจาก 0 ทุกครั้งที่เข้าซีนและวนซ้ำ
- ส่งออก: `broll.ts` (`brollWindows`/`createBrollTrack`/`coverRect`) ใช้ร่วมกับ `burn-render.ts`, `export-webcodecs.ts` (seek ต่อเฟรม) และ `export-burned.ts` (เรียลไทม์) — รองรับทั้งรูปและวิดีโอ
- `/api/public/broll-media`: พร็อกซีสื่อภายนอกให้เป็น origin เดียวกัน กัน canvas ถูก taint ตอน export (จำกัดเฉพาะโฮสต์ KLIPY/Storage, โฮสต์อื่น 403)
- เพิ่ม token สี `--warning` / `--warning-foreground` ในธีม

## ข้อจำกัดที่พบ
- GIF ที่ใช้เป็น "รูปภาพ" จะถูกวาดเฟรมแรกในไฟล์ส่งออก — เลือกไฟล์ mp4/webm จาก KLIPY จึงได้ภาพเคลื่อนไหวเต็ม
- ยังไม่มีการปรับ trim/ตำแหน่งของสื่อ B-roll ในซีน (ใช้เต็มช่วงซีนแบบ cover)

## การตรวจรับ
- `bun run guard:lao` ผ่านครบทุกด้าน (ก–ฉ)
