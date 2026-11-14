import type { InputAudioTrack, InputTrackQuery } from "mediabunny";

/**
 * Audio tracks of a known codec. iPhone clips recorded with Spatial Audio
 * (Cinematic mode on newer iPhones) carry a stereo AAC track plus Apple's
 * APAC track, which is often marked as the main one and which no browser
 * decodes: picking it left the editor and the export silent. APAC has no
 * codec name here, so it is left out.
 *
 * Not `canDecode()`: iPhone Safari has no WebCodecs AudioDecoder, so that
 * rejected every track, and the fallback of decoding the whole video failed
 * there ("Decoding failed"). The audio-only copy needs no decoder.
 */
export const knownAudio: InputTrackQuery<InputAudioTrack> = {
  filter: (track) => track.codec !== null,
};
