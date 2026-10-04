/**
 * Copies the clip's own audio packets for the kept ranges, without decoding or
 * re-encoding. Used when the browser has no AudioEncoder (iPhone Safari before
 * WebCodecs audio), so the export still gets sound. Cuts land on packet
 * boundaries (about 20 ms for AAC), and noise reduction and fades are skipped.
 */
import type { Segment } from "./audio";

export type CopiedAudio = {
  codec: "aac" | "opus";
  sampleRate: number;
  numberOfChannels: number;
  decoderConfig: AudioDecoderConfig;
  /** Output-timeline packets, timestamps and durations in microseconds. */
  packets: { data: Uint8Array; timestamp: number; duration: number }[];
};

export async function copyAudioPackets(
  source: Blob,
  segments: Segment[],
): Promise<CopiedAudio | null> {
  const { ALL_FORMATS, BlobSource, EncodedPacketSink, Input } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(source), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    const codec = track?.codec;
    if (!track || (codec !== "aac" && codec !== "opus")) return null;
    const decoderConfig = await track.getDecoderConfig();
    if (!decoderConfig) return null;

    const sink = new EncodedPacketSink(track);
    const packets: CopiedAudio["packets"] = [];
    let outputStart = 0; // seconds of output before this segment
    let lastEnd = 0; // microseconds
    for (const segment of segments) {
      let packet = (await sink.getPacket(segment.start)) ?? (await sink.getFirstPacket());
      while (packet && packet.timestamp < segment.end) {
        if (packet.timestamp + packet.duration > segment.start) {
          const at = Math.round((outputStart + (packet.timestamp - segment.start)) * 1e6);
          const duration = Math.round(packet.duration * 1e6);
          // Where packets straddle a cut, drop one that mostly overlaps the
          // previous packet and nudge one that barely does. Every segment is
          // placed from its exact output start, so the nudge never adds up
          // across cuts (pushing every packet later used to drift audio
          // behind the picture by up to a packet per cut).
          if (at < lastEnd && lastEnd - at > duration / 2) {
            packet = await sink.getNextPacket(packet);
            continue;
          }
          const timestamp = Math.max(lastEnd, at);
          packets.push({ data: packet.data, timestamp, duration });
          lastEnd = timestamp + duration;
        }
        packet = await sink.getNextPacket(packet);
      }
      outputStart += segment.end - segment.start;
    }
    if (!packets.length) return null;
    return {
      codec,
      sampleRate: track.sampleRate,
      numberOfChannels: track.numberOfChannels,
      decoderConfig,
      packets,
    };
  } catch {
    return null;
  } finally {
    input.dispose();
  }
}
