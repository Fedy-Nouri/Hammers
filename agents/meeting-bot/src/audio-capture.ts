import { Page } from 'playwright';
import { EventEmitter } from 'events';

/**
 * In-page script (runs in the browser, NOT in Node).
 *
 * Patches RTCPeerConnection so every inbound remote audio track is routed into
 * a single AudioContext mixer feeding an AudioWorklet. The worklet buffers
 * Float32 frames and posts them to the main thread, which downsamples to
 * 16 kHz mono linear16 (Int16), base64-encodes, and hands them to Node via the
 * exposed `window.__sendAudioChunk` binding.
 *
 * Kept as a string so it is injected verbatim and not type-checked against the
 * Node lib (it references browser-only globals).
 */
const IN_PAGE_SCRIPT = String.raw`
(() => {
  if (window.__audioCaptureInstalled) return;
  window.__audioCaptureInstalled = true;

  var TARGET_RATE = 16000;
  var audioCtx = null;
  var mixer = null;
  var ctxReady = null;

  var WORKLET_CODE = [
    'class PCMProcessor extends AudioWorkletProcessor {',
    '  constructor() { super(); this._buf = []; this._count = 0; this._target = 2048; }',
    '  process(inputs) {',
    '    var ch = inputs[0] && inputs[0][0];',
    '    if (ch) {',
    '      this._buf.push(new Float32Array(ch));',
    '      this._count += ch.length;',
    '      if (this._count >= this._target) {',
    '        var merged = new Float32Array(this._count);',
    '        var o = 0;',
    '        for (var i = 0; i < this._buf.length; i++) { merged.set(this._buf[i], o); o += this._buf[i].length; }',
    '        this.port.postMessage(merged, [merged.buffer]);',
    '        this._buf = []; this._count = 0;',
    '      }',
    '    }',
    '    return true;',
    '  }',
    '}',
    'registerProcessor("pcm-processor", PCMProcessor);'
  ].join('\n');

  function downsampleToInt16(float32, inRate, outRate) {
    var ratio = inRate / outRate;
    var newLen = Math.max(1, Math.floor(float32.length / ratio));
    var out = new Int16Array(newLen);
    for (var i = 0; i < newLen; i++) {
      var s = float32[Math.floor(i * ratio)];
      if (s > 1) s = 1; else if (s < -1) s = -1;
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  function int16ToBase64(int16) {
    var bytes = new Uint8Array(int16.buffer);
    var binary = '';
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function ensureContext() {
    if (ctxReady) return ctxReady;
    ctxReady = (async () => {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
      try { await audioCtx.resume(); } catch (e) {}
      var blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
      var url = URL.createObjectURL(blob);
      await audioCtx.audioWorklet.addModule(url);
      mixer = audioCtx.createGain();
      var node = new AudioWorkletNode(audioCtx, 'pcm-processor');
      node.port.onmessage = function (e) {
        var int16 = downsampleToInt16(e.data, audioCtx.sampleRate, TARGET_RATE);
        if (window.__sendAudioChunk) {
          try { window.__sendAudioChunk(int16ToBase64(int16)); } catch (err) {}
        }
      };
      mixer.connect(node);
      // Keep the graph alive without audible feedback.
      var silent = audioCtx.createGain();
      silent.gain.value = 0;
      node.connect(silent);
      silent.connect(audioCtx.destination);
    })();
    return ctxReady;
  }

  function addStream(stream) {
    if (!stream || !stream.getAudioTracks || stream.getAudioTracks().length === 0) return;
    ensureContext().then(function () {
      try {
        var src = audioCtx.createMediaStreamSource(stream);
        src.connect(mixer);
      } catch (e) {}
    });
  }

  var OrigPC = window.RTCPeerConnection;
  if (OrigPC) {
    var Patched = function () {
      var pc = new (Function.prototype.bind.apply(OrigPC, [null].concat(Array.prototype.slice.call(arguments))))();
      pc.addEventListener('track', function (ev) {
        if (ev.streams && ev.streams[0]) addStream(ev.streams[0]);
        else if (ev.track) addStream(new MediaStream([ev.track]));
      });
      return pc;
    };
    Patched.prototype = OrigPC.prototype;
    try { Object.assign(Patched, OrigPC); } catch (e) {}
    window.RTCPeerConnection = Patched;
    window.webkitRTCPeerConnection = Patched;
  }
})();
`;

export interface AudioCapture {
  /** Emits 'chunk' events carrying a Buffer of 16 kHz mono linear16 PCM. */
  readonly events: EventEmitter;
  stop(): void;
}

/**
 * Install the audio-capture pipeline on a freshly created page, BEFORE it
 * navigates, so the RTCPeerConnection patch is in place before Meet opens any
 * peer connections.
 */
export async function startCapture(page: Page): Promise<AudioCapture> {
  const events = new EventEmitter();
  let stopped = false;

  await page.exposeFunction('__sendAudioChunk', (b64: string) => {
    if (stopped) return;
    events.emit('chunk', Buffer.from(b64, 'base64'));
  });

  await page.addInitScript({ content: IN_PAGE_SCRIPT });

  return {
    events,
    stop() {
      stopped = true;
      events.removeAllListeners();
    },
  };
}
