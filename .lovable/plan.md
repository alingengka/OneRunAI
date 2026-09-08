# เลือกแพทเทิร์นกล้อง + ตำแหน่ง/ขนาดข้อความไวรัล

## 1. แพทเทิร์นกล้อง (Motion) ต่อซีน
- `SceneElement` เพิ่ม `motionKind?: MotionKind` — มีค่า = ใช้ค่าที่เลือก, ไม่มี = อัตโนมัติตามลำดับซีน (เข้ากับงานเก่า)
- `updateSceneElementMotionKind()` ใน `src/lib/scenes.ts`
- `motionTransform()` / `motionAt()` รับและใช้ `motionKind`
- การ์ด 4 แพทเทิร์นใน `ScenesPanel.tsx` กดเลือกได้จริง badge "ใช้อยู่" ตามค่าที่เลือก
- พรีวิว (`routes/index.tsx` → `motionAt`) และไฟล์ส่งออก (`burn-render.ts`) ใช้ค่าเดียวกัน

## 2. ตำแหน่ง X/Y และขนาดข้อความไวรัล
- `SceneElement` เพิ่ม `offsetX`, `offsetY` (px อ้างอิงเฟรมสูง 1280) และ `scalePercent` (default 100)
- `updateSceneElementLayout()` clamp ขนาด 20–300%
- `ScenesPanel.tsx` เพิ่ม 3 แถบเลื่อน (X, Y, ขนาด) พร้อมตัวเลขและปุ่มรีเซ็ตแยกอัน
- พรีวิว `ViralTextOverlay.tsx` ใช้ `translate(...) scale(...)`, ส่งออก `burn-render.ts` ใช้ `ctx.translate`/`ctx.scale` สเกลตามความสูงเฟรมให้ตรงกัน
- element เก่าที่ไม่มีค่า แสดงผลเหมือนเดิมทุกอย่าง

## การตรวจรับ
- `bun run guard:lao` ผ่านครบทุกด้าน
- ตรวจภาพจริง desktop/mobile และ dark/light mode
