/**
 * Noise gate / downward expander ตัวจริง (ไม่ใช่แค่ EQ)
 *
 * ใช้ noise floor ที่วัดได้จากคลิป (estimateNoiseFloor) เป็น threshold
 * ช่วงที่เบากว่า threshold จะถูกลดระดับลงจริงตาม ratio ส่วนช่วงที่ดังกว่า
 * (เสียงพูด) ปล่อยผ่านเต็ม พร้อม attack/release กันเสียงกระตุก
 */
export type NoiseGateOptions = {
  /** RMS ของ noise floor (0–1) */
  noiseFloor: number;
  /** เกนต่ำสุดตอนปิดประตู (0 = เงียบสนิท) */
  floorGain?: number;
  /** ตัวคูณเหนือ noise floor ที่ถือว่าเป็นเสียงพูด */
  openRatio?: number;
};

export type NoiseGateNode = { input: AudioNode; output: AudioNode; dispose: () => void };

export function createNoiseGate(ctx: BaseAudioContext, opts: NoiseGateOptions): NoiseGateNode {
  const threshold = Math.max(1e-6, opts.noiseFloor * (opts.openRatio ?? 2.2));
  const closeThreshold = threshold * 0.6;
  const floorGain = opts.floorGain ?? 0.06;
  const size = 1024;
  const processor = ctx.createScriptProcessor(size, 2, 2);

  // attack เร็ว (คำแรกไม่ขาด) / release ช้ากว่า (หางเสียงไม่ถูกตัด)
  const release = Math.exp(-size / (0.12 * ctx.sampleRate));
  const attackCoef = Math.exp(-size / (0.008 * ctx.sampleRate));
  let gain = floorGain;


  processor.onaudioprocess = (event) => {
    const { inputBuffer, outputBuffer } = event;
    const channels = Math.min(inputBuffer.numberOfChannels, outputBuffer.numberOfChannels);
    // RMS ของบล็อกนี้ (รวมทุกช่อง)
    let sum = 0;
    let count = 0;
    for (let c = 0; c < channels; c++) {
      const data = inputBuffer.getChannelData(c);
      for (let i = 0; i < data.length; i++) {
        const v = data[i] ?? 0;
        sum += v * v;
        count++;
      }
    }
    const rms = Math.sqrt(sum / Math.max(1, count));
    const open = rms >= (gain > 0.5 ? closeThreshold : threshold);
    const target = open ? 1 : floorGain;
    const coef = target > gain ? attackCoef : release;
    const next = target + (gain - target) * coef;

    for (let c = 0; c < channels; c++) {
      const input = inputBuffer.getChannelData(c);
      const output = outputBuffer.getChannelData(c);
      for (let i = 0; i < output.length; i++) {
        // ไล่เกนภายในบล็อกเพื่อไม่ให้เกิดเสียงป็อปตรงรอยต่อ
        const g = gain + ((next - gain) * i) / output.length;
        output[i] = (input[i] ?? 0) * g;
      }
    }
    gain = next;
  };

  return {
    input: processor,
    output: processor,
    dispose: () => {
      processor.onaudioprocess = null;
      processor.disconnect();
    },
  };
}
