class PitchProcessor extends AudioWorkletProcessor {
  constructor() { super(); this.buffer = new Float32Array(2048); this.index = 0; this.hop = 0; }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (const sample of channel) {
      this.buffer[this.index++] = sample;
      if (this.index === this.buffer.length) {
        let power = 0;
        for (const value of this.buffer) power += value * value;
        this.port.postMessage({ pitch: 0, confidence: 0, volume: Math.sqrt(power / this.buffer.length) });
        this.buffer.copyWithin(0, 1024); this.index = 1024;
      }
    }
    return true;
  }
}
registerProcessor('pitch-detector', PitchProcessor);
