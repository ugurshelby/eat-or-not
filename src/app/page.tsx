"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Background from "@/components/Background";
import FoodImage from "@/components/FoodImage";
import { api, ensureIdentity, friendlyError, loadIdentity, type Identity, type MyRoom } from "@/lib/api";
import { sfx } from "@/lib/fx";

export default function Page() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}

function Home() {
  const router = useRouter();
  const params = useSearchParams();
  const inviteCode = (params.get("kod") ?? "").toUpperCase().slice(0, 4);

  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Identity | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState(inviteCode);
  const [joining, setJoining] = useState(!!inviteCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<MyRoom[] | null>(null);

  useEffect(() => {
    const id = loadIdentity();
    setMe(id);
    if (id) setName(id.name);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!me) return;
    api.myRooms(me.token).then(setRooms).catch(() => setRooms([]));
  }, [me]);

  const homeRoom = rooms?.find((r) => r.is_home && r.id === me?.home_room) ?? rooms?.find((r) => r.is_home) ?? null;
  const otherRooms = (rooms ?? []).filter((r) => !r.is_home);

  async function removeRoom(r: MyRoom) {
    if (!me) return;
    const who = r.partner ? `${r.partner} ile oynadığın` : "bu";
    if (!confirm(`${who} odayı ve tüm cevaplarını kalıcı olarak silmek istiyor musun?`)) return;
    try {
      await api.deleteRoom(me.token, r.id);
      setRooms((list) => (list ?? []).filter((x) => x.id !== r.id));
      sfx.tap();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function saveName() {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setError(null);
    try {
      sfx.select();
      const id = await ensureIdentity(n);
      setMe(id);
      if (inviteCode) await join(id, inviteCode);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!me) return;
    setBusy(true);
    setError(null);
    try {
      sfx.select();
      const r = await api.createRoom(me.token);
      router.push(`/oda/${r.id}`);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  async function join(id: Identity, c: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await api.joinRoom(id.token, c);
      sfx.select();
      router.push(`/oda/${r.id}`);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden">
      <Background />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col px-4 safe-top safe-bottom">
        <Logo />

        <AnimatePresence mode="wait">
          {!ready ? null : !me ? (
            <motion.section
              key="name"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="mt-6 flex flex-col gap-4"
            >
              {inviteCode && (
                <p className="glass rounded-2xl px-4 py-3 text-center text-lg">
                  <b className="text-accent">{inviteCode}</b> odasına davet edildin! 🎉
                </p>
              )}
              <label className="text-center text-xl font-semibold">Sana ne diyelim?</label>
              <input
                autoFocus
                value={name}
                maxLength={24}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                placeholder="Kullanıcı adın"
                className="rounded-2xl bg-cream px-5 py-4 text-center text-2xl font-semibold text-ink outline-none ring-4 ring-transparent focus:ring-accent"
              />
              <button
                disabled={!name.trim() || busy}
                onClick={saveName}
                className="btn-3d bg-accent py-4 text-2xl text-ink"
                style={{ ["--shade" as string]: "#c9962e" }}
              >
                {busy ? "..." : "Hadi başlayalım!"}
              </button>
            </motion.section>
          ) : (
            <motion.section
              key="menu"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="mt-4 flex flex-col gap-4"
            >
              {me.home_room ? (
                <p className="text-center text-2xl">
                  Hoş geldin <b className="text-accent">{me.name}</b>! 💖
                </p>
              ) : (
                <p className="text-center text-xl">
                  Selam <b className="text-accent">{me.name}</b>! 👋{" "}
                  <button className="text-sm underline opacity-70" onClick={() => setMe(null)}>
                    değiştir
                  </button>
                </p>
              )}

              {homeRoom && (
                <button
                  onClick={() => {
                    sfx.select();
                    router.push(`/oda/${homeRoom.id}`);
                  }}
                  className="btn-3d flex items-center justify-center gap-3 bg-accent py-5 text-2xl text-ink"
                  style={{ ["--shade" as string]: "#c9962e" }}
                >
                  <FoodImage emoji="💞" size={40} />
                  {homeRoom.partner ? `${homeRoom.partner} ile oyna` : "Ana masaya git"}
                </button>
              )}

              {!joining ? (
                <>
                  <button
                    disabled={busy}
                    onClick={create}
                    className="btn-3d bg-pink py-5 text-2xl text-white"
                    style={{ ["--shade" as string]: "#b23a60" }}
                  >
                    🍽️ Oda kur
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      sfx.tap();
                      setJoining(true);
                    }}
                    className="btn-3d bg-cream py-5 text-2xl text-ink"
                    style={{ ["--shade" as string]: "#cdbfa9" }}
                  >
                    🔑 Koda katıl
                  </button>
                </>
              ) : (
                <div className="glass flex flex-col gap-3 rounded-3xl p-4">
                  <p className="text-center text-lg font-semibold">Arkadaşının oda kodu</p>
                  <input
                    autoFocus
                    value={code}
                    maxLength={4}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && code.length === 4 && join(me, code)}
                    placeholder="ABCD"
                    className="rounded-2xl bg-cream px-5 py-4 text-center text-4xl font-bold tracking-[0.5em] text-ink uppercase outline-none ring-4 ring-transparent focus:ring-accent"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => setJoining(false)}
                      className="btn-3d flex-1 bg-white/20 py-3 text-lg"
                    >
                      Geri
                    </button>
                    <button
                      disabled={code.length !== 4 || busy}
                      onClick={() => join(me, code)}
                      className="btn-3d flex-[2] bg-accent py-3 text-xl text-ink"
                      style={{ ["--shade" as string]: "#c9962e" }}
                    >
                      {busy ? "..." : "Katıl"}
                    </button>
                  </div>
                </div>
              )}

              {otherRooms.length > 0 && (
                <div className="mt-2">
                  <h2 className="mb-2 text-lg font-semibold opacity-90">Kaldığın yerden devam et</h2>
                  <ul className="flex flex-col gap-2">
                    {otherRooms.slice(0, 8).map((r) => (
                      <li key={r.id} data-testid="room-row" data-code={r.code} className="glass flex items-center rounded-2xl">
                        <button
                          onClick={() => {
                            sfx.tap();
                            router.push(`/oda/${r.id}`);
                          }}
                          className="flex min-w-0 flex-1 items-center justify-between px-4 py-3 text-left transition active:scale-[0.98]"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-lg font-semibold">
                              {r.partner ? `${r.partner} ile` : "Arkadaş bekleniyor"}
                            </span>
                            <span className="text-sm opacity-70">
                              Oda {r.code} · {r.rounds} tur
                            </span>
                          </span>
                          <span className="text-2xl">▶</span>
                        </button>
                        <button
                          aria-label="Odayı sil"
                          onClick={() => removeRoom(r)}
                          className="mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-black/20 text-xl transition active:scale-90"
                        >
                          🗑️
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-2xl bg-red-500/90 px-4 py-3 text-center font-semibold"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <p className="mt-auto pt-8 text-center text-sm opacity-60">
          Aynı yemeğe aynı cevabı verin, uyumunuzu görün 💞
        </p>
      </div>
    </main>
  );
}

function Logo() {
  const foods = ["🍔", "🍩", "🥙"];
  return (
    <div className="mt-6 flex flex-col items-center">
      <div className="relative flex h-32 items-end justify-center gap-1">
        {foods.map((e, i) => (
          <motion.div
            key={e}
            initial={{ y: 60, opacity: 0, rotate: -20 }}
            animate={{ y: [0, -14, 0], opacity: 1, rotate: [(i - 1) * 12, (i - 1) * 12 + 6, (i - 1) * 12] }}
            transition={{
              y: { duration: 1.6, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" },
              rotate: { duration: 1.6, repeat: Infinity, delay: i * 0.2 },
              opacity: { duration: 0.4, delay: i * 0.1 },
            }}
          >
            <FoodImage emoji={e} size={i === 1 ? 110 : 84} />
          </motion.div>
        ))}
      </div>
      <motion.h1
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.2 }}
        className="text-stroke mt-2 text-center text-5xl leading-[0.95] font-bold"
      >
        <span className="text-accent">Yer misin</span>
        <br />
        <span className="text-pink">Yemez misin?</span>
      </motion.h1>
    </div>
  );
}
