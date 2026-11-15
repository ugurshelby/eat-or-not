"use client";

import { useEffect, useState } from "react";
import { animate, motion } from "framer-motion";
import FoodImage from "@/components/FoodImage";
import { FOOD_BY_ID } from "@/lib/foods";
import { CHOICE_META, scorePercent, scoreTitle, toRound, type RoundView } from "@/lib/game";
import { bigCelebration, sfx } from "@/lib/fx";

export default function Summary({
  round,
  myName,
  partnerName,
  isLatest,
  onNext,
  onArchive,
  onToast,
}: {
  round: RoundView;
  myName: string;
  partnerName: string;
  isLatest: boolean;
  onNext: () => void;
  onArchive: () => void;
  onToast: (t: string) => void;
}) {
  const pct = scorePercent(round.matches, round.items.length);
  const { title, emoji } = scoreTitle(pct);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const c = animate(0, pct, { duration: 1.4, ease: "easeOut", onUpdate: (v) => setShown(Math.round(v)) });
    const t = setTimeout(() => {
      sfx.fanfare();
      if (pct >= 60) bigCelebration();
    }, 900);
    return () => {
      c.stop();
      clearTimeout(t);
    };
  }, [pct]);

  function share() {
    const lines = round.items.map((id, i) => {
      const f = FOOD_BY_ID[id];
      const c = round.cells[i];
      const mark = c.mine === c.theirs ? "✅" : "❌";
      return `${mark} ${f?.emoji ?? ""} ${f?.name ?? id}`;
    });
    const text = `🍽️ Yer misin Yemez misin? Tur ${round.roundNo}\n${myName} & ${partnerName}: %${pct} uyum ${emoji}\n"${title}"\n\n${lines.join("\n")}`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => onToast("Sonuç kopyalandı 📋"));
  }

  const R = 64;
  const C = 2 * Math.PI * R;

  return (
    <div className="flex flex-1 flex-col pb-2">
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="mt-3 rounded-[2rem] bg-cream p-5 text-ink shadow-2xl"
      >
        <p className="text-center text-sm font-semibold tracking-widest uppercase opacity-60">
          Tur {round.roundNo} bitti
        </p>
        <div className="mt-2 flex items-center justify-center gap-4">
          <div className="relative h-40 w-40">
            <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
              <circle cx="80" cy="80" r={R} stroke="#eadfcd" strokeWidth="16" fill="none" />
              <motion.circle
                cx="80"
                cy="80"
                r={R}
                stroke="url(#g)"
                strokeWidth="16"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={C}
                initial={{ strokeDashoffset: C }}
                animate={{ strokeDashoffset: C * (1 - pct / 100) }}
                transition={{ duration: 1.4, ease: "easeOut" }}
              />
              <defs>
                <linearGradient id="g" x1="0" x2="1">
                  <stop offset="0%" stopColor="#ff5e8a" />
                  <stop offset="100%" stopColor="#ffb547" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold">%{shown}</span>
              <span className="text-sm opacity-60">uyum</span>
            </div>
          </div>
        </div>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1.2, type: "spring" }}
          className="mt-1 flex items-center justify-center gap-2"
        >
          <FoodImage emoji={emoji} size={40} />
          <h2 className="text-2xl font-bold">{title}</h2>
        </motion.div>
        <p className="mt-1 text-center text-sm opacity-60">
          {myName} & {partnerName} · {round.matches}/{round.items.length} eşleşme
        </p>

        <ul className="mt-4 grid grid-cols-2 gap-2">
          {round.items.map((id, i) => {
            const f = FOOD_BY_ID[id];
            const c = round.cells[i];
            const ok = c.mine !== null && c.mine === c.theirs;
            return (
              <motion.li
                key={id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className={`flex items-center gap-2 rounded-2xl border-2 px-2 py-1.5 ${ok ? "border-green-400 bg-green-50" : "border-red-300 bg-red-50"}`}
              >
                {f && <FoodImage emoji={f.emoji} size={30} />}
                <span className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-tight font-semibold">{f?.name ?? id}</span>
                <span className="shrink-0 text-sm">
                  {c.mine !== null ? CHOICE_META[c.mine].emoji : "·"}
                  {c.theirs !== null ? CHOICE_META[c.theirs].emoji : "·"}
                </span>
              </motion.li>
            );
          })}
        </ul>
        <p className="mt-2 text-center text-xs opacity-50">Sol emoji sen, sağ emoji {partnerName}</p>
      </motion.div>

      <div className="mt-4 flex flex-col gap-3">
        <button
          onClick={() => {
            sfx.select();
            onNext();
          }}
          className="btn-3d bg-accent py-4 text-2xl text-ink"
          style={{ ["--shade" as string]: "#c9962e" }}
        >
          {isLatest ? `${toRound(round.roundNo + 1)} geç 🚀` : "Son tura dön ➜"}
        </button>
        <div className="flex gap-3">
          <button onClick={share} className="btn-3d flex-1 bg-pink py-3 text-lg text-white" style={{ ["--shade" as string]: "#b23a60" }}>
            📤 Paylaş
          </button>
          <button onClick={onArchive} className="btn-3d flex-1 bg-white/20 py-3 text-lg">
            📜 Arşiv
          </button>
        </div>
      </div>
    </div>
  );
}
