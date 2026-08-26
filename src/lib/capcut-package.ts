import { zipSync, strToU8 } from "fflate";
import type { CaptionGroup } from "./captions";
import type { Segment } from "./media/audio";
import { buildCutListJson, buildSrt, mapToTrimmed } from "./export";

export function buildCapCutPackage(params: {
  baseName: string;
  video: Blob;
  duration: number;
  keep: Segment[];
  removed: Segment[];
  groups: CaptionGroup[];
}): Promise<Blob> {
  return params.video.arrayBuffer().then((buffer) => {
    const srt = buildSrt(params.groups, (time) => mapToTrimmed(time, params.keep));
    const manifest = buildCutListJson({
      clipName: `${params.baseName}-trimmed.webm`,
      duration: params.duration,
      keep: params.keep,
      removed: params.removed,
      groups: params.groups,
    });
    const readme = [
      "ShortCut Studio — CapCut Package",
      "1. Import the trimmed .webm video into CapCut.",
      "2. Import the .srt file as Local captions.",
      "3. Both files use the same silence-removed timeline.",
      "The JSON file is a timing backup and is not a CapCut project file.",
    ].join("\n");
    const zipped = zipSync({
      [`${params.baseName}-trimmed.webm`]: new Uint8Array(buffer),
      [`${params.baseName}-captions.srt`]: strToU8(srt),
      [`${params.baseName}-timing.json`]: strToU8(manifest),
      "README.txt": strToU8(readme),
    }, { level: 0 });
    return new Blob([zipped], { type: "application/zip" });
  });
}