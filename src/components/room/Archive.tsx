"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import FoodImage from "@/components/FoodImage";
import { FOOD_BY_ID } from "@/lib/foods";
import { CHOICE_META, scorePercent, type RoundView } from "@/lib/game";
import { sfx } from "@/lib/fx";

export default function Archive({
  rounds,
  myName,
  partnerName,
  onOpen,
  onClose,
}: {
  rounds: RoundView[];
  myName: string;
  partnerName: string;
  onOpen: (round: number) => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const pairs = rounds.reduce((n, r) => n + r.bothDone, 0);
  const matches = rounds.reduce((n, r) => n + r.matches, 0);
  const bothEat = rounds.flatMap((r) =>
    r.items.filter((_, i) => r.cells[i].mine === 1 && r.cells[i].theirs === 1),
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-1 flex-col pb-4">
      <div className="mt-2 flex items-center justify-between">
        <h2 className="text-3xl font-bold">📜 Arşiv</h2>
        <button onClick={onClose} className="glass rounded-2xl px-4 py-2 font-semibold">
          Oyuna dön
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Genel uyum" value={`%${scorePercent(matches, pairs)}`} />
        <Stat label="Eşleşme" value={`${matches}/${pairs}`} />
        <Stat label="Tur" value={String(rounds.length)} />
      </div>

      {bothEat.length > 0 && (
        <div className="glass mt-3 rounded-2xl p-3">
          <p className="mb-2 text-sm font-semibold opacity-80">İkinizin de yediği 😋 — ortak menü</p>
          <div className="flex flex-wrap gap-1.5">
            {bothEat.map((id) => {
              const f = FOOD_BY_ID[id];
              return (
                <span key={id} className="flex items-center gap-1 rounded-full bg-white/15 py-0.5 pr-2.5 pl-1 text-sm">
                  {f && <FoodImage emoji={f.emoji} size={20} />}
                  {f?.name ?? id}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <ul className="mt-3 flex flex-col gap-2">
        {[...rounds].reverse().map((r) => {
          const pct = scorePercent(r.matches, r.bothDone || 1);
          const isOpen = open === r.roundNo;
          return (
            <li key={r.roundNo} className="glass overflow-hidden rounded-2xl">
              <button
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                onClick={() => {
                  sfx.tap();
                  setOpen(isOpen ? null : r.roundNo);
                }}
              >
                <span className="text-lg font-bold">Tur {r.roundNo}</span>
                <span className="text-sm opacity-75">
                  {r.complete ? `%${pct} uyum` : `yarım · ${r.bothDone}/${r.items.length}`}
                </span>
                <span className="ml-auto flex -space-x-2">
                  {r.items.slice(0, 4).map((id) => (
                    <span key={id} className="rounded-full bg-white/80 p-0.5">
                      <FoodImage emoji={FOOD_BY_ID[id]?.emoji ?? "🍽️"} size={22} />
                    </span>
                  ))}
                </span>
                <motion.span animate={{ rotate: isOpen ? 90 : 0 }}>▶</motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <ul className="flex flex-col gap-1 px-3 pb-3">
                      {r.items.map((id, i) => {
                        const f = FOOD_BY_ID[id];
                        const c = r.cells[i];
                        const done = c.mine !== null && c.theirs !== null;
                        return (
                          <li key={id} className="flex items-center gap-2 rounded-xl bg-black/15 px-2 py-1.5">
                            {f && <FoodImage emoji={f.emoji} size={26} />}
                            <span className="min-w-0 flex-1 truncate">{f?.name ?? id}</span>
                            <Pill who={myName} c={c.mine} />
                            <Pill who={partnerName} c={done ? c.theirs : null} />
                            <span className="w-5 text-center">{done ? (c.mine === c.theirs ? "✅" : "❌") : "⏳"}</span>
                          </li>
                        );
                      })}
                    </ul>
                    {!r.complete && (
                      <button
                        onClick={() => onOpen(r.roundNo)}
                        className="btn-3d mx-3 mb-3 w-[calc(100%-1.5rem)] bg-accent py-2.5 text-lg text-ink"
                        style={{ ["--shade" as string]: "#c9962e" }}
                      >
                        Bu tura devam et ▶
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl px-2 py-3">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-70">{label}</div>
    </div>
  );
}

function Pill({ who, c }: { who: string; c: 0 | 1 | 2 | null }) {
  return (
    <span title={who} className="w-7 text-center text-lg">
      {c === null ? "·" : CHOICE_META[c].emoji}
    </span>
  );
}
