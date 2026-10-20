/**
 * ElevenLabs Voice Isolator: removes background noise (traffic, wind, music,
 * other people) from speech far better than the small in-browser model.
 */
export function voiceIsolationAvailable(): boolean {
  return !!process.env["ELEVENLABS_API_KEY"];
}

export async function isolateVoiceServer(
  wavBase64: string,
): Promise<{ audioBase64: string; mime: string }> {
  const apiKey = process.env["ELEVENLABS_API_KEY"];
  if (!apiKey) throw new Error("ยังไม่ได้ตั้งค่า ELEVENLABS_API_KEY สำหรับลดเสียงรบกวน");
  const form = new FormData();
  form.append(
    "audio",
    new Blob([Buffer.from(wavBase64, "base64")], { type: "audio/wav" }),
    "audio.wav",
  );
  form.append("file_format", "other");
  const response = await fetch("https://api.elevenlabs.io/v1/audio-isolation", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[isolate] ElevenLabs failed [${response.status}]`, body.slice(0, 300));
    throw new Error(`ลดเสียงรบกวนไม่สำเร็จ [${response.status}]`);
  }
  const audio = Buffer.from(await response.arrayBuffer());
  return {
    audioBase64: audio.toString("base64"),
    mime: response.headers.get("content-type") ?? "audio/mpeg",
  };
}
