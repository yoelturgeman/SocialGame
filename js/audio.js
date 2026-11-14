// Soft, calm sound effects (WebAudio) and optional Hebrew narration (browser speech synthesis).
let ctx = null;
export const audio = { sound: true, speech: true, hasVoice: false };

function tone(freq, at, dur, type = 'sine', vol = 0.14) {
  if (!audio.sound || !ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + at;
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

export const sfx = {
  init() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* no audio */ } } ctx?.resume?.(); },
  good() { tone(660, 0, 0.25); tone(880, 0.12, 0.35); },
  oops() { tone(300, 0, 0.22, 'sine', 0.1); tone(250, 0.14, 0.3, 'sine', 0.1); },   // gentle, never harsh
  tick() { tone(740, 0, 0.12, 'triangle', 0.08); },
  pop() { tone(420 + Math.random() * 80, 0, 0.1, 'triangle', 0.1); },
  clap() { tone(180, 0, 0.08, 'square', 0.08); },
  star() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.4)); },
};

let voice = null;
function findVoice() {
  if (!('speechSynthesis' in window)) return;
  voice = speechSynthesis.getVoices().find((v) => /^he|^iw/i.test(v.lang)) || null;
  audio.hasVoice = !!voice;
  audio.onVoice?.();
}
if ('speechSynthesis' in window) { findVoice(); speechSynthesis.addEventListener('voiceschanged', findVoice); }

export function speak(textHe) {
  if (!audio.speech || !voice || !textHe) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(textHe);
  u.voice = voice; u.lang = voice.lang; u.rate = 0.9;
  speechSynthesis.speak(u);
}
