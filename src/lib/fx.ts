"use client";

import confetti from "canvas-confetti";

const MUTE_KEY = "ymym.muted";
let ctx: AudioContext | null = null;

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(v: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, v ? "1" : "0");
  } catch {}
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || isMuted()) return null;
  try {
    ctx ??= new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType = "sine",
  gain = 0.18,
  slideTo?: number,
) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

export const sfx = {
  tap() {
    tone(520, 0, 0.09, "triangle", 0.12, 760);
    vibrate(12);
  },
  select() {
    tone(660, 0, 0.12, "triangle", 0.14, 990);
    vibrate(20);
  },
  match() {
    [523.25, 659.25, 783.99, 1046.5].forEach((fq, i) => tone(fq, i * 0.09, 0.28, "triangle", 0.16));
    tone(1318.5, 0.36, 0.5, "sine", 0.1);
    vibrate([30, 40, 30, 40, 80]);
  },
  mismatch() {
    tone(392, 0, 0.3, "sawtooth", 0.07, 370);
    tone(370, 0.3, 0.3, "sawtooth", 0.07, 349);
    tone(349, 0.6, 0.7, "sawtooth", 0.07, 260);
    vibrate([120, 60, 220]);
  },
  joined() {
    tone(587, 0, 0.15, "sine", 0.14);
    tone(880, 0.12, 0.25, "sine", 0.14);
    vibrate([20, 30, 20]);
  },
  fanfare() {
    [392, 523.25, 659.25, 783.99, 659.25, 783.99, 1046.5].forEach((fq, i) =>
      tone(fq, i * 0.11, 0.3, "triangle", 0.15),
    );
    vibrate([40, 50, 40, 50, 160]);
  },
};

export function burstConfetti() {
  const colors = ["#ff5e8a", "#ffd166", "#06d6a0", "#7c5cff", "#ff9f43", "#ffffff"];
  confetti({ particleCount: 90, spread: 80, startVelocity: 45, origin: { y: 0.55 }, colors });
  setTimeout(
    () => confetti({ particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors }),
    150,
  );
  setTimeout(
    () => confetti({ particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors }),
    300,
  );
}

export function bigCelebration() {
  const end = Date.now() + 1600;
  const colors = ["#ff5e8a", "#ffd166", "#06d6a0", "#7c5cff"];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
