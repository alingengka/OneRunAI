import { supabase } from "@/integrations/supabase/client";

const BUCKET = "broll-assets";
const YEAR_SECONDS = 60 * 60 * 24 * 365;
/** Same limit as the bucket (see the storage_limits migration). */
const MAX_BYTES = 100 * 1024 * 1024;

export type UploadedAsset = { url: string; type: "image" | "video" };

/** อัปโหลดสื่อของผู้ใช้เองเข้าคลังไฟล์ แล้วคืนลิงก์ที่ใช้ได้ยาว 1 ปี */
export async function uploadBrollAsset(file: File): Promise<UploadedAsset> {
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    throw new Error("อัปโหลดได้เฉพาะรูปภาพหรือวิดีโอ");
  }
  if (file.size > MAX_BYTES) throw new Error("ไฟล์ใหญ่เกิน 100 MB");
  const type: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
  const ext =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "bin";
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("กรุณาเข้าสู่ระบบก่อนอัปโหลด");
  // Storage policies only allow writes inside the user's own folder.
  const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    ...(file.type ? { contentType: file.type } : {}),
    upsert: false,
  });
  if (error) throw new Error(`อัปโหลดไม่สำเร็จ: ${error.message}`);
  const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, YEAR_SECONDS);
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error("สร้างลิงก์ไฟล์ไม่สำเร็จ");
  }
  return { url: signed.data.signedUrl, type };
}
