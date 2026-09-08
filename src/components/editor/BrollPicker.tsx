import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { searchKlipyMedia, type KlipyItem } from "@/lib/klipy.functions";
import { uploadBrollAsset } from "@/lib/broll-upload";
import type { SceneAssetPatch } from "@/lib/scenes";
import { AlertTriangle, Loader2, Search, Upload } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** คำค้นตั้งต้น (ข้อความซับของซีน) */
  defaultQuery: string;
  onPick: (patch: SceneAssetPatch) => void;
};

/** รหัสผู้ใช้แบบคงที่ต่อเบราว์เซอร์ ใช้ให้คลังคลิปจัดผลลัพธ์ให้เหมาะ */
function customerId(): string {
  const key = "onerunai-klipy-customer";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function BrollPicker({ open, onOpenChange, defaultQuery, onPick }: Props) {
  const search = useServerFn(searchKlipyMedia);
  const [query, setQuery] = useState(defaultQuery);
  const [items, setItems] = useState<KlipyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const result = await search({ data: { query: q, kind: "gifs", customerId: customerId() } });
      setItems(result.items);
      if (!result.items.length) setError("ไม่พบคลิปที่ตรงกับคำค้นนี้ ลองคำอื่นดู");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ค้นหาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadBrollAsset(file);
      onPick({ assetUrl: uploaded.url, assetType: uploaded.type, assetSource: "upload" });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>เลือกสื่อ B-roll</DialogTitle>
          <DialogDescription>
            ค้นหาคลิปจากคลัง หรืออัปโหลดภาพ/วิดีโอของคุณเอง
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="search">
          <TabsList className="w-full">
            <TabsTrigger value="search" className="flex-1">
              ค้นหา
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex-1">
              อัปโหลดเอง
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={query}
                placeholder="พิมพ์คำค้น เช่น happy dance"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch();
                }}
              />
              <Button onClick={() => void runSearch()} disabled={loading || !query.trim()}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                ค้นหา
              </Button>
            </div>

            <div className="grid max-h-[46vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onPick({
                      assetUrl: item.assetUrl,
                      assetType: item.assetType,
                      assetSource: "klipy",
                      searchQuery: query.trim(),
                    });
                    onOpenChange(false);
                  }}
                  className="overflow-hidden rounded-lg border border-border bg-preview transition-colors hover:border-primary/60"
                >
                  <img
                    src={item.previewUrl}
                    alt={item.title}
                    loading="lazy"
                    className="aspect-video w-full object-cover"
                  />
                </button>
              ))}
              {!items.length && !loading && (
                <p className="col-span-full py-6 text-center text-xs text-muted-foreground">
                  ยังไม่มีผลลัพธ์ — กดค้นหาเพื่อเริ่ม
                </p>
              )}
            </div>

            <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-[11px] text-warning-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              คลิปจาก KLIPY อาจมีลิขสิทธิ์จากภาพยนตร์/รายการทีวี ตรวจสอบสิทธิ์การใช้งานก่อนเผยแพร่จริง
            </p>
          </TabsContent>

          <TabsContent value="upload" className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files?.[0])}
            />
            <Button
              variant="outline"
              className="h-24 w-full flex-col gap-2 border-dashed"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
              {uploading ? "กำลังอัปโหลด…" : "เลือกไฟล์ภาพหรือวิดีโอ (ไม่เกิน 50MB)"}
            </Button>
          </TabsContent>
        </Tabs>

        {error && <p className="text-xs text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
