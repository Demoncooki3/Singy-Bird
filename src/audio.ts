import workletUrl from './worklet.js?worker&url';
import type { Reading } from './pitch';
export class Microphone {
  stream?: MediaStream;
  context?: AudioContext;
  node?: AudioWorkletNode;
  async start(onReading: (r: Reading) => void, onLost: () => void) {
    this.stop();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access needs HTTPS or localhost and a supported browser.');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      this.context = new AudioContext();
      await this.context.resume();
      await this.context.audioWorklet.addModule(workletUrl);
      this.node = new AudioWorkletNode(this.context, 'pitch-detector');
      this.node.port.onmessage = e => onReading(e.data);
      this.context.createMediaStreamSource(this.stream).connect(this.node);
      const mute = this.context.createGain(); mute.gain.value = 0;
      this.node.connect(mute).connect(this.context.destination);
      this.stream.getAudioTracks().forEach(t => t.onended = onLost);
      this.context.onstatechange = () => { if (this.context?.state === 'suspended') onLost(); };
    } catch (error) { this.stop(); throw error; }
  }
  stop() {
    this.node?.disconnect();
    this.stream?.getTracks().forEach(t => { t.onended = null; t.stop(); });
    if (this.context) { this.context.onstatechange = null; void this.context.close(); }
    this.stream = undefined; this.context = undefined; this.node = undefined;
  }
}
