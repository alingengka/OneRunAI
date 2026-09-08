import { supabase } from "@/integrations/supabase/client";

const BUCKET = "broll-assets";
const YEAR_SECONDS = 60 * 60 * 24 * 365;

export type UploadedAsset = { url: string; type: "image" | "video" };

/** อัปโหลดสื่อของผู้ใช้เองเข้าคลังไฟล์ แล้วคืนลิงก์ที่ใช้ได้ยาว 1 ปี */
export async function uploadBrollAsset(file: File): Promise<UploadedAsset> {
  const type: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${crypto.randomUUID()}.${ext}`;
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
