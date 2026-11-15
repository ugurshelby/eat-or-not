import { supabase } from "./supabase";

export type Choice = 0 | 1 | 2; // 0 yemem, 1 yerim, 2 hiç denemedim

export type Identity = { id: string; token: string; name: string };

export type RoomState = {
  room: { id: string; code: string; created_at: string };
  me: { id: string; name: string };
  partner: { id: string; name: string } | null;
  rounds: { round_no: number; items: string[] }[];
  answers: {
    round_no: number;
    idx: number;
    mine: Choice | null;
    theirs: Choice | null;
    theirs_done: boolean;
  }[];
};

export type MyRoom = {
  id: string;
  code: string;
  updated_at: string;
  partner: string | null;
  rounds: number;
};

const KEY = "ymym.identity";

export function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

function saveIdentity(id: Identity) {
  try {
    localStorage.setItem(KEY, JSON.stringify(id));
  } catch {}
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function ensureIdentity(name: string): Promise<Identity> {
  const existing = loadIdentity();
  if (existing) {
    if (existing.name !== name) {
      await rpc("rename_player", { p_token: existing.token, p_name: name });
      existing.name = name;
      saveIdentity(existing);
    }
    return existing;
  }
  const created = await rpc<Identity>("create_player", { p_name: name });
  saveIdentity(created);
  return created;
}

export const api = {
  createRoom: (token: string) =>
    rpc<{ id: string; code: string }>("create_room", { p_token: token }),
  joinRoom: (token: string, code: string) =>
    rpc<{ id: string; code: string }>("join_room", { p_token: token, p_code: code }),
  state: (token: string, room: string) =>
    rpc<RoomState>("get_room_state", { p_token: token, p_room: room }),
  ensureRound: (token: string, room: string, round: number, items: string[]) =>
    rpc<string[]>("ensure_round", {
      p_token: token,
      p_room: room,
      p_round: round,
      p_items: items,
    }),
  answer: (token: string, room: string, round: number, idx: number, choice: Choice) =>
    rpc<{ mine: Choice | null; theirs: Choice | null }>("submit_answer", {
      p_token: token,
      p_room: room,
      p_round: round,
      p_idx: idx,
      p_choice: choice,
    }),
  myRooms: (token: string) => rpc<MyRoom[]>("list_my_rooms", { p_token: token }),
};

export function friendlyError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes("room not found")) return "Böyle bir oda yok. Kodu kontrol et.";
  if (m.includes("room full")) return "Bu oda dolu, iki kişi zaten oynuyor.";
  if (m.includes("not a member")) return "Bu odaya erişimin yok.";
  if (m.includes("unknown player")) return "Oturum bulunamadı, ana sayfadan tekrar gir.";
  if (m.includes("Failed to fetch")) return "Bağlantı sorunu. İnternetini kontrol et.";
  return "Bir şeyler ters gitti. Tekrar dene.";
}
