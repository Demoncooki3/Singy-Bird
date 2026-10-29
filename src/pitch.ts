export type Reading = { pitch: number; confidence: number; volume: number };
// Cumulative mean normalized difference (YIN), with parabolic refinement.
export function detectPitch(samples: Float32Array, rate: number): Reading {
  let power = 0;
  for (const s of samples) power += s * s;
  const volume = Math.sqrt(power / samples.length);
  if (volume < 0.002) return { pitch: 0, confidence: 0, volume };
  const max = Math.min(Math.floor(rate / 50), Math.floor(samples.length / 2));
  const min = Math.floor(rate / 1100);
  const diff = new Float32Array(max + 1);
  let sum = 0;
  for (let tau = 1; tau <= max; tau++) {
    let d = 0;
    for (let i = 0; i < samples.length - max; i++) d += (samples[i] - samples[i + tau]) ** 2;
    sum += d;
    diff[tau] = sum ? d * tau / sum : 1;
  }
  for (let tau = min; tau < max - 1; tau++) {
    if (diff[tau] < 0.15) {
      while (tau < max - 1 && diff[tau + 1] < diff[tau]) tau++;
      const a = diff[tau - 1], b = diff[tau], c = diff[tau + 1];
      const divisor = 2 * (2 * b - c - a);
      const offset = divisor ? (c - a) / divisor : 0;
      return { pitch: rate / (tau + offset), confidence: 1 - b, volume };
    }
  }
  return { pitch: 0, confidence: 0, volume };
}
export function pitchHeight(pitch: number, low: number, high: number): number {
  const fraction = Math.max(0, Math.min(1, Math.log(pitch / low) / Math.log(high / low)));
  return 445 - fraction * 365;
}
// Full flight height needs at most three semitones above the relaxed low hum.
export function comfortableHigh(low: number, measuredHigh: number): number {
  return Math.min(measuredHigh, low * 2 ** (3 / 12));
}
