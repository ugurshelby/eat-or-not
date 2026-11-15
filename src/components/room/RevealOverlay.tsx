"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import FoodImage from "@/components/FoodImage";
import { getFood } from "@/lib/foods";
import { CHOICE_META } from "@/lib/game";
import { burstConfetti, sfx } from "@/lib/fx";
import type { Choice } from "@/lib/api";

export type Reveal = { round: number; idx: number; foodId: string; mine: Choice; theirs: Choice };

const MATCH_LINES = ["Aynı kafa!", "Damak ikizi!", "Tam isabet!", "Bu iş olur!", "Ortak sofra!"];
const MISS_LINES = ["Olmadı be...", "Zevkler ayrı...", "Anlaşamadık", "Ayrı masa mı?", "Kalbim kırıldı"];

export default function RevealOverlay({
  reveal,
  myName,
  partnerName,
  onDone,
}: {
  reveal: Reveal;
  myName: string;
  partnerName: string;
  onDone: () => void;
}) {
  const match = reveal.mine === reveal.theirs;
  const food = getFood(reveal.foodId);
  const line = useMemo(() => {
    if (match && reveal.mine === 2) return "İkiniz de denemediniz! Birlikte deneyin 🤝";
    if (match && reveal.mine === 0) return "İkiniz de yemezsiniz!";
    const arr = match ? MATCH_LINES : MISS_LINES;
    return arr[(reveal.round * 7 + reveal.idx) % arr.length];
  }, [match, reveal]);

  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const t1 = setTimeout(() => {
      if (match) {
        sfx.match();
        burstConfetti();
      } else sfx.mismatch();
    }, 650);
    const t2 = setTimeout(() => doneRef.current(), match ? 3000 : 3300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [match]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      onClick={onDone}
      data-testid="reveal"
      data-match={String(match)}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center px-6"
      style={{
        background: match
          ? "radial-gradient(circle at 50% 40%, rgba(255,209,102,0.95), rgba(34,197,94,0.92) 55%, rgba(21,128,61,0.97))"
          : "radial-gradient(circle at 50% 40%, rgba(129,140,248,0.92), rgba(67,56,202,0.94) 55%, rgba(30,27,75,0.98))",
      }}
    >
      {/* ışık halkaları / yağmur */}
      {match ? <Rays /> : <Rain />}

      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={match ? { scale: [0, 1.2, 1], rotate: 0 } : { scale: [0, 1, 0.9], rotate: 0, y: [0, 0, 6] }}
        transition={{ duration: 0.6, ease: "backOut" }}
        className="relative"
      >
        {food && <FoodImage emoji={food.emoji} size={120} className={match ? "" : "grayscale-[0.5]"} />}
      </motion.div>
      {food && <p className="relative mt-1 text-2xl font-bold drop-shadow">{food.name}</p>}

      <div className="relative mt-6 flex w-full max-w-sm items-center justify-center gap-3">
        <PlayerChip name={myName} choice={reveal.mine} side={-1} match={match} />
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.4, 1] }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="z-10 shrink-0"
        >
          <FoodImage emoji={match ? "💞" : "💔"} size={58} />
        </motion.div>
        <PlayerChip name={partnerName} choice={reveal.theirs} side={1} match={match} />
      </div>

      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={
          match
            ? { scale: [0, 1.25, 1], opacity: 1, rotate: [0, -4, 4, 0] }
            : { scale: 1, opacity: 1, x: [0, -10, 10, -6, 6, 0] }
        }
        transition={{ delay: 0.7, duration: 0.7 }}
        className="relative mt-8 flex flex-col items-center"
      >
        {!match && (
          <motion.div
            animate={{ rotate: [-6, 6, -6] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            className="relative mb-2"
          >
            <FoodImage emoji="😢" size={96} />
            <motion.span
              className="absolute top-12 left-5 h-3 w-2 rounded-full bg-sky-300"
              animate={{ y: [0, 40], opacity: [1, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: 1 }}
            />
          </motion.div>
        )}
        {match && reveal.mine === 1 && (
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="mb-2"
          >
            <FoodImage emoji="🥳" size={96} />
          </motion.div>
        )}
        <h2 className="text-stroke text-center text-5xl leading-tight font-bold text-white">{line}</h2>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ delay: 1.6 }}
        className="relative mt-10 text-sm"
      >
        devam etmek için dokun
      </motion.p>
    </motion.div>
  );
}

function PlayerChip({ name, choice, side, match }: { name: string; choice: Choice; side: number; match: boolean }) {
  const meta = CHOICE_META[choice];
  return (
    <motion.div
      initial={{ x: side * 160, rotateY: 180, opacity: 0 }}
      animate={
        match
          ? { x: [side * 160, 0, side * -10, 0], rotateY: 0, opacity: 1 }
          : { x: [side * 160, 0, side * 18], rotateY: 0, opacity: 1, rotate: side * 6 }
      }
      transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
      className="flex w-32 flex-col items-center rounded-3xl bg-white/95 px-2 py-3 text-ink shadow-2xl"
      style={{ transformPerspective: 600 }}
    >
      <span className="w-full truncate text-center text-sm font-semibold opacity-70">{name}</span>
      <FoodImage emoji={meta.emoji} size={60} />
      <span className="text-xl font-bold" style={{ color: meta.color }}>
        {meta.label}
      </span>
    </motion.div>
  );
}

function Rays() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      animate={{ rotate: 360 }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
    >
      <div
        className="h-[160vmax] w-[160vmax] opacity-25"
        style={{
          background:
            "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.9) 0deg 10deg, transparent 10deg 30deg)",
          maskImage: "radial-gradient(circle, black 10%, transparent 60%)",
          WebkitMaskImage: "radial-gradient(circle, black 10%, transparent 60%)",
        }}
      />
    </motion.div>
  );
}

function Rain() {
  const drops = useMemo(
    () => Array.from({ length: 24 }, (_, i) => ({ left: (i * 41) % 100, delay: (i * 0.13) % 1.4, dur: 0.9 + ((i * 7) % 6) / 10 })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {drops.map((d, i) => (
        <motion.span
          key={i}
          className="absolute top-0 h-6 w-0.5 rounded-full bg-sky-200/60"
          style={{ left: `${d.left}%` }}
          initial={{ y: "-10vh" }}
          animate={{ y: "110vh" }}
          transition={{ duration: d.dur, delay: d.delay, repeat: Infinity, ease: "linear" }}
        />
      ))}
    </div>
  );
}
