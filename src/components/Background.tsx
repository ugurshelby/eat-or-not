"use client";

import { useMemo } from "react";

const EMOJIS = ["🍕", "🍩", "🥙", "🍉", "🧋", "🍟", "🍣", "🧁", "🌮", "🍦", "🥨", "🍓"];

export default function Background() {
  const floats = useMemo(
    () =>
      EMOJIS.map((e, i) => ({
        e,
        left: (i * 83) % 100,
        size: 22 + ((i * 37) % 26),
        dur: 16 + ((i * 13) % 14),
        delay: -((i * 7) % 20),
      })),
    [],
  );
  return (
    <div className="blob-bg" aria-hidden>
      <div className="blob" style={{ width: 340, height: 340, left: -90, top: -60, background: "#ff5e8a" }} />
      <div
        className="blob"
        style={{ width: 300, height: 300, right: -100, top: "30%", background: "#ff9f43", animationDelay: "-6s" }}
      />
      <div
        className="blob"
        style={{ width: 360, height: 360, left: "10%", bottom: -140, background: "#06d6a0", opacity: 0.35, animationDelay: "-12s" }}
      />
      {floats.map((f, i) => (
        <span
          key={i}
          className="float-emoji"
          style={{ left: `${f.left}%`, fontSize: f.size, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s` }}
        >
          {f.e}
        </span>
      ))}
    </div>
  );
}
