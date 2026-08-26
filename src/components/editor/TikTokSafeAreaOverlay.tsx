import tiktokFrame from "@/assets/tiktok-frame.png.asset.json";

export function TikTokSafeAreaOverlay() {
  return (
    <img
      src={tiktokFrame.url}
      alt="กรอบพรีวิวหน้าจอ TikTok"
      className="pointer-events-none absolute inset-0 z-20 h-full w-full object-cover"
      aria-hidden="true"
    />
  );
}
