import type { InputAudioTrack, InputTrackQuery } from "mediabunny";

/**
 * Audio tracks the browser can decode. iPhone clips recorded with Spatial
 * Audio (Cinematic mode on newer iPhones) carry a stereo AAC track plus
 * Apple's APAC track, which is often marked as the main one and which no
 * browser decodes: picking it left the editor and the export silent.
 */
export const decodableAudio: InputTrackQuery<InputAudioTrack> = {
  filter: async (track) => track.codec !== null && (await track.canDecode()),
};
