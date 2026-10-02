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
import { searchKlipyMedia } from "@/lib/klipy.functions";
import { searchPixabayMedia, suggestBrollKeywords } from "@/lib/pixabay.functions";
import { uploadBrollAsset } from "@/lib/broll-upload";
import type { SceneAssetPatch } from "@/lib/scenes";
import { AlertTriangle, Loader2, Search, Sparkles, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** คำค้นตั้งต้น (ข้อความซับของซีน) */
  defaultQuery: string;
  onPick: (patch: SceneAssetPatch) => void;
  /** caption language, used for Pixabay search */
  language?: string | undefined;
};

type Source = "pixabay-videos" | "pixabay-images" | "klipy";

type ResultItem = {
  id: string;
  previewUrl: string;
  assetUrl: string;
  assetType: "image" | "video";
  title: string;
  duration?: number | undefined;
};

const SOURCES: { id: Source; label: string }[] = [
  { id: "pixabay-videos", label: "วิดีโอฟรี" },
  { id: "pixabay-images", label: "รูปฟรี" },
  { id: "klipy", label: "GIF / มีม" },
];

/** Copies a Pixabay file into the user's storage (Pixabay forbids permanent hotlinks). */
async function copyIntoStorage(item: ResultItem) {
  // Straight from the CDN when it allows it (no size limit), else through our proxy.
  let response: Response | null = null;
  try {
    response = await fetch(item.assetUrl, { mode: "cors" });
    if (!response.ok) response = null;
  } catch {
    response = null;
  }
  response ??= await fetch(`/api/public/broll-media?url=${encodeURIComponent(item.assetUrl)}`);
  if (!response.ok) throw new Error(`ดาวน์โหลดคลิปไม่สำเร็จ [${response.status}]`);
  const blob = await response.blob();
  const ext =
    item.assetType === "video" ? "mp4" : (item.assetUrl.split(".").pop() ?? "jpg").split("?")[0];
  const type = blob.type || (item.assetType === "video" ? "video/mp4" : "image/jpeg");
  return uploadBrollAsset(new File([blob], `pixabay-${item.id}.${ext}`, { type }));
}

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

export function BrollPicker({ open, onOpenChange, defaultQuery, onPick, language }: Props) {
  const search = useServerFn(searchKlipyMedia);
  const searchPixabay = useServerFn(searchPixabayMedia);
  const suggest = useServerFn(suggestBrollKeywords);
  const [source, setSource] = useState<Source>("pixabay-videos");
  const [query, setQuery] = useState(defaultQuery);
  const [items, setItems] = useState<ResultItem[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [copying, setCopying] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const runSearch = async (override?: string, from: Source = source) => {
    const q = (override ?? query).trim();
    if (!q) return;
    if (override) setQuery(override);
    setLoading(true);
    setError(null);
    try {
      let found: ResultItem[];
      if (from === "klipy") {
        const result = await search({ data: { query: q, kind: "gifs", customerId: customerId() } });
        found = result.items.map((item) => ({ ...item }));
      } else {
        const result = await searchPixabay({
          data: { query: q, kind: from === "pixabay-videos" ? "videos" : "images", lang: language },
        });
        found = result.items.map((item) => ({
          id: item.id,
          previewUrl: item.previewUrl,
          assetUrl: item.assetUrl,
          assetType: item.assetType,
          title: `${item.author} · Pixabay`,
          duration: item.duration,
        }));
      }
      setItems(found);
      if (!found.length) setError("ไม่พบคลิปที่ตรงกับคำค้นนี้ ลองคำอื่น หรือกด “AI แนะนำคำค้น”");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ค้นหาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const suggestKeywords = async () => {
    const text = (defaultQuery || query).trim();
    if (!text) return;
    setSuggesting(true);
    setError(null);
    try {
      const result = await suggest({ data: { text } });
      setKeywords(result.keywords);
      if (result.keywords[0]) void runSearch(result.keywords[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "แนะนำคำค้นไม่สำเร็จ");
    } finally {
      setSuggesting(false);
    }
  };

  const pick = async (item: ResultItem) => {
    if (source === "klipy") {
      onPick({
        assetUrl: item.assetUrl,
        assetType: item.assetType,
        assetSource: "klipy",
        searchQuery: query.trim(),
      });
      onOpenChange(false);
      return;
    }
    setCopying(item.id);
    setError(null);
    try {
      const stored = await copyIntoStorage(item);
      onPick({
        assetUrl: stored.url,
        assetType: stored.type,
        assetSource: "pixabay",
        searchQuery: query.trim(),
      });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เตรียมคลิปไม่สำเร็จ");
    } finally {
      setCopying(null);
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
          <DialogDescription>ค้นหาคลิปจากคลัง หรืออัปโหลดภาพ/วิดีโอของคุณเอง</DialogDescription>
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
            <div
              role="radiogroup"
              aria-label="แหล่งคลิป"
              className="flex rounded-lg bg-secondary p-1"
            >
              {SOURCES.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="radio"
                  aria-checked={source === entry.id}
                  onClick={() => {
                    setSource(entry.id);
                    setItems([]);
                    if (query.trim()) void runSearch(undefined, entry.id);
                  }}
                  className={cn(
                    "h-9 flex-1 rounded-md px-2 text-sm transition-colors",
                    source === entry.id
                      ? "bg-background font-semibold text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                value={query}
                placeholder="พิมพ์คำค้น (ภาษาอังกฤษได้ผลดีที่สุด) เช่น coffee shop"
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

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                className="h-8"
                disabled={suggesting || !(defaultQuery || query).trim()}
                onClick={() => void suggestKeywords()}
              >
                {suggesting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                AI แนะนำคำค้น
              </Button>
              {keywords.map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => void runSearch(keyword)}
                  className={cn(
                    "h-8 rounded-full border px-3 text-xs transition-colors",
                    query.trim() === keyword
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {keyword}
                </button>
              ))}
            </div>

            <div className="grid max-h-[46vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={copying !== null}
                  title={item.title}
                  onClick={() => void pick(item)}
                  className="relative overflow-hidden rounded-lg border border-border bg-preview transition-colors hover:border-primary/60 disabled:opacity-60"
                >
                  <img
                    src={item.previewUrl}
                    alt={item.title}
                    loading="lazy"
                    className="aspect-video w-full object-cover"
                  />
                  {item.duration ? (
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
                      {Math.round(item.duration)}s
                    </span>
                  ) : null}
                  {copying === item.id && (
                    <span className="absolute inset-0 grid place-items-center bg-black/60 text-xs text-white">
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-4 w-4 animate-spin" /> กำลังเตรียมคลิป…
                      </span>
                    </span>
                  )}
                </button>
              ))}
              {!items.length && !loading && (
                <p className="col-span-full py-6 text-center text-xs text-muted-foreground">
                  ยังไม่มีผลลัพธ์ — พิมพ์คำค้นแล้วกดค้นหา หรือกด “AI แนะนำคำค้น”
                </p>
              )}
            </div>

            {source === "klipy" ? (
              <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-[11px] text-warning-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                คลิปจาก KLIPY อาจมีลิขสิทธิ์จากภาพยนตร์/รายการทีวี
                ตรวจสอบสิทธิ์การใช้งานก่อนเผยแพร่จริง
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                คลิปและรูปจาก Pixabay ใช้เชิงพาณิชย์ได้ฟรี ไม่ต้องใส่เครดิต ·
                เมื่อเลือกแล้วระบบจะเก็บสำเนาไว้ในโปรเจกต์ของคุณ
              </p>
            )}
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
