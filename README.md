# OneRunAI

AI Short Video Editor: ถอดเสียงภาษาลาวเป็นซับทีละคำ ตัดช่วงเงียบ ใส่ B-roll และส่งออกวิดีโอพร้อมโพสต์

- ทดลองใช้ฟรี 5 วัน (AI ถอดเสียงรวม 30 นาที)
- รายเดือน 199,000 KIP และรายปี 1,990,000 KIP (AI ถอดเสียง 300 นาทีต่อเดือน)
- โค้ด `ONERUN` ลดเหลือ 99,000 KIP ต่อเดือน หรือ 990,000 KIP ต่อปี
- ชำระผ่าน QR แล้วอัปโหลดสลิป ผู้ดูแลกดอนุมัติในหน้า `/admin`

## หน้าต่างๆ

| หน้า | ใช้ทำอะไร |
|---|---|
| `/` | หน้าแรก แนะนำแอปและราคา |
| `/login` | เข้าสู่ระบบ สมัครสมาชิก และลืมรหัสผ่าน |
| `/app` | โปรแกรมตัดต่อ ต้องล็อกอินและอยู่ในช่วงทดลองหรือมีแพ็กเกจ |
| `/billing` | เลือกแพ็กเกจ ใส่โค้ด สแกน QR และส่งสลิป |
| `/admin` | อนุมัติสลิป ตั้งค่า QR และบัญชี จัดการโค้ดส่วนลด |

## สแตก

- TanStack Start (React 19, SSR) + Tailwind v4 + shadcn/ui
- Supabase: Auth, Postgres, Storage
- Gemini API (ถอดเสียงและแปล), ElevenLabs Scribe (ถอดเสียงลาว), OpenAI (ไม่บังคับ)
- Deploy บน Vercel

## ตั้งค่าครั้งแรก

### 1. สร้างโปรเจกต์ Supabase

1. สมัครหรือเข้าสู่ระบบที่ [supabase.com](https://supabase.com) แล้วกด **New project** (แพ็กเกจฟรีใช้ได้)
2. ไปที่ **SQL Editor** แล้วรันไฟล์ใน `supabase/migrations/` เรียงตามชื่อไฟล์ทีละไฟล์
3. ไปที่ **Authentication → URL Configuration**
   - **Site URL**: โดเมนเว็บของคุณ เช่น `https://onerunai.vercel.app`
   - **Redirect URLs**: เพิ่ม `https://onerunai.vercel.app/**` และ `http://localhost:8080/**`
4. ไปที่ **Settings → API** แล้วคัดลอก Project URL, anon/publishable key และ service_role key

### 2. API key ของ AI

| ตัวแปร | จำเป็นไหม | ขอได้ที่ |
|---|---|---|
| `GEMINI_API_KEY` | จำเป็น | https://aistudio.google.com/apikey |
| `ELEVENLABS_API_KEY` | แนะนำ (ถอดเสียงลาวแม่นที่สุด) | https://elevenlabs.io |
| `OPENAI_API_KEY` | ไม่บังคับ | https://platform.openai.com |
| `KLIPY_API_KEY` | ไม่บังคับ (ค้นหา GIF/B-roll) | https://partner.klipy.com |

### 3. Deploy บน Vercel

1. ที่ [vercel.com](https://vercel.com) กด **Add New → Project** แล้วเลือก repo นี้
2. ใน **Environment Variables** ใส่ทุกตัวตาม `.env.example`
3. กด **Deploy** ส่วนคำสั่ง build ตั้งไว้แล้วใน `vercel.json`

### 4. ตั้งตัวเองเป็นผู้ดูแลระบบ

สมัครสมาชิกบนเว็บด้วยอีเมลของคุณก่อน แล้วรันคำสั่งนี้ใน Supabase SQL Editor:

```sql
update public.profiles set is_admin = true where email = 'อีเมลของคุณ';
```

จากนั้นเข้า `/admin` → **ตั้งค่าการรับเงิน** เพื่ออัปโหลด QR และกรอกชื่อบัญชี

## เปลี่ยนราคา โควตา หรือโค้ดส่วนลด

- **โค้ดส่วนลด:** แก้ในหน้า `/admin` → **โค้ดส่วนลด** ตั้งวันหมดอายุและจำนวนครั้งได้
- **ราคาและโควตา:** แก้ในตาราง `plans` ผ่าน Supabase Table Editor
  - `price_kip` คือราคา
  - `duration_days` คือจำนวนวันของแพ็กเกจ
  - `quota_seconds` คือโควตาเป็นวินาที (ทดลองใช้: รวมทั้งช่วง / แพ็กเกจที่จ่ายเงิน: ต่อเดือน)

## พัฒนาบนเครื่อง

```sh
cp .env.example .env.local   # แล้วใส่ค่าจริง
bun install
bun run dev                  # http://localhost:8080
```

Lao subtitle regression guard (ดู `AGENTS.md`): ตอนนี้ `/app` ต้องล็อกอินก่อน
ให้รันกับ dev server ที่ล็อกอินแล้ว และตั้ง `GUARD_APP_URL=http://localhost:8080/app`
