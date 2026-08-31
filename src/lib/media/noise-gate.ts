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

export async function createNoiseGate(ctx: AudioContext, opts: NoiseGateOptions): Promise<NoiseGateNode> {
  const noiseFloor = Number.isFinite(opts.noiseFloor) ? Math.max(0, Math.min(1, opts.noiseFloor)) : 0;
  const openRatio = Number.isFinite(opts.openRatio) ? Math.max(1, opts.openRatio ?? 2.2) : 2.2;
  const threshold = Math.max(1e-6, noiseFloor * openRatio);
  const closeThreshold = threshold * 0.6;
  const floorGain = Number.isFinite(opts.floorGain) ? Math.max(0, Math.min(1, opts.floorGain ?? 0.06)) : 0.06;

  // AudioWorklet runs away from the UI/canvas thread. This prevents a heavy
  // 1080/4K paint from starving ScriptProcessorNode and freezing the export's
  // audio graph. Older browsers retain the guarded ScriptProcessor fallback.
  if (ctx.audioWorklet && typeof AudioWorkletNode !== "undefined") {
    const source = `
      class ShortCutNoiseGate extends AudioWorkletProcessor {
        constructor(options) {
          super();
          const values = options.processorOptions || {};
          this.threshold = values.threshold;
          this.closeThreshold = values.closeThreshold;
          this.floorGain = values.floorGain;
          this.gain = this.floorGain;
        }
        process(inputs, outputs) {
          const input = inputs[0] || [];
          const output = outputs[0] || [];
          let sum = 0;
          let count = 0;
          for (const channel of input) {
            for (let i = 0; i < channel.length; i++) {
              const value = Number.isFinite(channel[i]) ? channel[i] : 0;
              sum += value * value;
              count++;
            }
          }
          const rms = Math.sqrt(sum / Math.max(1, count));
          const open = rms >= (this.gain > 0.5 ? this.closeThreshold : this.threshold);
          const target = open ? 1 : this.floorGain;
          const seconds = 128 / sampleRate;
          const coefficient = Math.exp(-seconds / (target > this.gain ? 0.008 : 0.12));
          const next = target + (this.gain - target) * coefficient;
          for (let channelIndex = 0; channelIndex < output.length; channelIndex++) {
            const destination = output[channelIndex];
            const inputChannel = input[channelIndex] || input[0];
            for (let i = 0; i < destination.length; i++) {
              const value = inputChannel && Number.isFinite(inputChannel[i]) ? inputChannel[i] : 0;
              const gain = this.gain + ((next - this.gain) * i) / Math.max(1, destination.length);
              destination[i] = value * gain;
            }
          }
          this.gain = next;
          return true;
        }
      }
      registerProcessor("shortcut-noise-gate", ShortCutNoiseGate);
    `;
    const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    try {
      await ctx.audioWorklet.addModule(moduleUrl);
      const node = new AudioWorkletNode(ctx, "shortcut-noise-gate", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: { threshold, closeThreshold, floorGain },
      });
      return { input: node, output: node, dispose: () => node.disconnect() };
    } finally {
      URL.revokeObjectURL(moduleUrl);
    }
  }

  const size = 1024;
  const processor = ctx.createScriptProcessor(size, 2, 2);

  // attack เร็ว (คำแรกไม่ขาด) / release ช้ากว่า (หางเสียงไม่ถูกตัด)
  const release = Math.exp(-size / (0.12 * ctx.sampleRate));
  const attackCoef = Math.exp(-size / (0.008 * ctx.sampleRate));
  let gain = floorGain;


  processor.onaudioprocess = (event) => {
    const { inputBuffer, outputBuffer } = event;
    const inputChannels = inputBuffer.numberOfChannels;
    const outputChannels = outputBuffer.numberOfChannels;
    const channels = Math.min(inputChannels, outputChannels);
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
    // Up-mix mono safely instead of leaving an unexpected output channel with
    // stale samples. All indexing is guarded and every written value is finite.
    for (let c = channels; c < outputChannels; c++) {
      const output = outputBuffer.getChannelData(c);
      const input = inputChannels ? inputBuffer.getChannelData(Math.min(c, inputChannels - 1)) : undefined;
      for (let i = 0; i < output.length; i++) output[i] = (input?.[i] ?? 0) * next;
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
