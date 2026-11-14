<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## กฎบังคับ: Lao subtitle regression guard

ทุกงานที่แก้โค้ดในโปรเจกต์นี้ **ไม่ว่าจะเกี่ยวกับซับหรือไม่** (ฟอนต์, สี, UI, motion,
sound, export ฯลฯ) ต้องรัน

```sh
bun run guard:lao        # = bun run scripts/lao-subtitle-guard.ts
```

**ก่อนตอบว่างานเสร็จเสมอ** ถ้าผลแย่ลงกว่า baseline (CER สูงขึ้น หรือมีคำหาย/หลุดกรอบ
จาก layout ของซับ) **ห้ามส่งงานนั้น** ต้องแก้ให้ผ่านก่อน แม้จะเป็นผลข้างเคียงที่ไม่ได้ตั้งใจ

- คลิปทดสอบคงที่: `tests/fixtures/lao-sample.wav`
- baseline: `tests/fixtures/lao-sample.json` (อัปเดตได้ด้วย `--update-baseline` เฉพาะเมื่อผู้ใช้อนุมัติ)
- ต้องมี dev server รันอยู่ที่ `http://localhost:8080` (ส่วนตรวจ layout ใช้เบราว์เซอร์จริง)
- `--layout-only` ข้ามการเรียก STT จริง (ใช้เมื่อไม่มีคีย์ API)
- `--integration-only` รันเฉพาะ (ค)+(ง)

guard ตรวจ 6 ด้าน: (ก) CER การถอดเสียง (ข) layout/burn 84 กรณี
(ค) integration ผ่าน UI จริง — อัปโหลดคลิป กด "สร้างซับด้วย AI" แล้วเรนเดอร์จาก state จริง
(ง) กลุ่มซับที่ "ซ้อนเวลากัน" ต้องไม่หายจาก `findWindow`
(จ) คลิปยาวข้ามรอยต่อ chunk (`tests/fixtures/lao-long.wav`) — ทุกช่วงที่พูดจริงต้องมีซับคลุม
(ฉ) ประโยคลาวปนอังกฤษ (`tests/fixtures/lao-codeswitch.wav`) — คำอังกฤษที่พูดจริงต้องไม่ถูกกรองทิ้ง
    และต้องไม่ถูกทับศัพท์เป็นอักษรลาว
ห้ามลดขอบเขตข้อใดข้อหนึ่งเพื่อให้ผ่าน

## กฎบังคับ: Media regression guard (วิดีโอ/เสียง)

ทุกงานที่แตะการอ่านคลิป เสียง พรีวิว หรือส่งออก (`src/lib/media/**`, ส่วน video/preview/export
ใน `src/routes/app.tsx`) ต้องรัน

```sh
bun run guard:media      # = bun run scripts/media-guard.ts
```

**ก่อนตอบว่างานเสร็จ** ถ้าไม่ผ่าน **ห้ามส่งงานนั้น**

- ต้องมี dev server ที่ `http://localhost:8080` (หรือ `GUARD_APP_URL`) และ ffmpeg/ffprobe
- สร้างคลิปทดสอบเองตอนรัน: HD, 4K หมุนด้วย metadata, Spatial Audio (แทร็กเสียงหลักเล่นไม่ได้),
  เฟรมดำต้นคลิป แล้วอัปโหลด → ส่งออกผ่าน UI จริง ทั้งใน Chrome และ "Safari บน iPhone" จำลอง
  (ไม่มี WebCodecs AudioDecoder/AudioEncoder, decodeAudioData อ่านวิดีโอทั้งไฟล์ไม่ได้)
- ตรวจ: อ่านเสียงได้ไม่มี error, ขนาดภาพ/จำนวนเฟรมถูก, มีเสียงไม่เงียบ, ไม่มีเฟรมดำต้นคลิป,
  และคลิปหนักใช้ไฟล์พรีวิว 720p (`?proxy=1`) ที่เล่นได้และมีเสียง
- การจำลองไม่เท่า iPhone จริง: งานที่เสี่ยงกับ iPhone ให้ผู้ใช้ทดสอบบนเครื่องจริงด้วย
ห้ามลดขอบเขตข้อใดข้อหนึ่งเพื่อให้ผ่าน
