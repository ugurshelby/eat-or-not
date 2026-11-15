import type { Choice, RoomState } from "./api";
import { FOODS } from "./foods";

export const ROUND_SIZE = 10;

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(arr: T[], seed: number): T[] {
  const rnd = mulberry32(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Bir oda için sıradaki turun 10 yemeği. İki oyuncu da aynı sonucu üretir. */
export function nextRoundItems(roomId: string, used: string[], roundNo: number): string[] {
  const usedSet = new Set(used);
  const ids = FOODS.map((x) => x.id);
  let pool = shuffled(
    ids.filter((id) => !usedSet.has(id)),
    hash(roomId + ":" + roundNo),
  );
  if (pool.length < ROUND_SIZE) {
    // Liste bitti: baştan karıştır.
    pool = pool.concat(shuffled(ids.filter((id) => !pool.includes(id)), hash(roomId + ":r" + roundNo)));
  }
  return pool.slice(0, ROUND_SIZE);
}

export type Cell = { mine: Choice | null; theirs: Choice | null; theirsDone: boolean };

export type RoundView = {
  roundNo: number;
  items: string[];
  cells: Cell[];
  bothDone: number;
  complete: boolean;
  matches: number;
};

export function buildRounds(state: RoomState): RoundView[] {
  return state.rounds.map((r) => {
    const cells: Cell[] = r.items.map(() => ({ mine: null, theirs: null, theirsDone: false }));
    for (const a of state.answers) {
      if (a.round_no !== r.round_no || !cells[a.idx]) continue;
      cells[a.idx] = { mine: a.mine, theirs: a.theirs, theirsDone: a.theirs_done };
    }
    const both = cells.filter((c) => c.mine !== null && c.theirs !== null);
    return {
      roundNo: r.round_no,
      items: r.items,
      cells,
      bothDone: both.length,
      complete: both.length === r.items.length,
      matches: both.filter((c) => c.mine === c.theirs).length,
    };
  });
}

/** "Tur 2'ye", "Tur 3'e", "Tur 10'a" gibi yönelme eki. */
export function toRound(n: number): string {
  const last = n % 10;
  const tens = n % 100;
  let suf: string;
  if (tens === 0) suf = "e"; // yüz, bin
  else if (last !== 0) suf = ["", "e", "ye", "e", "e", "e", "ya", "ye", "e", "a"][last];
  else suf = { 10: "a", 20: "ye", 30: "a", 40: "a", 50: "ye", 60: "a", 70: "e", 80: "e", 90: "a" }[tens] ?? "e";
  return `Tur ${n}'${suf}`;
}

export function scorePercent(matches: number, total: number): number {
  return total ? Math.round((matches / total) * 100) : 0;
}

export function scoreTitle(pct: number): { title: string; emoji: string } {
  if (pct >= 90) return { title: "Ruh ikizi damak!", emoji: "💞" };
  if (pct >= 70) return { title: "Aynı sofranın insanları", emoji: "🥰" };
  if (pct >= 50) return { title: "Ortak menü bulunur", emoji: "😋" };
  if (pct >= 30) return { title: "Siparişleri ayrı verin", emoji: "😅" };
  return { title: "Zıt kutuplar çekişir", emoji: "🙃" };
}

export const CHOICE_META: Record<Choice, { label: string; emoji: string; color: string }> = {
  1: { label: "Yerim", emoji: "😋", color: "#22c55e" },
  0: { label: "Yemem", emoji: "🤢", color: "#ef4444" },
  2: { label: "Denemedim", emoji: "🤔", color: "#f59e0b" },
};
