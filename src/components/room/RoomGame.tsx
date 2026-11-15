"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { RealtimeChannel } from "@supabase/supabase-js";
import Background from "@/components/Background";
import Lobby from "./Lobby";
import SwipeCard from "./SwipeCard";
import RevealOverlay, { type Reveal } from "./RevealOverlay";
import Summary from "./Summary";
import Archive from "./Archive";
import { api, friendlyError, loadIdentity, type Choice, type Identity, type RoomState } from "@/lib/api";
import { buildRounds, nextRoundItems, toRound, type RoundView } from "@/lib/game";
import { emojiUrl, getFood } from "@/lib/foods";
import { supabase } from "@/lib/supabase";
import { isMuted, setMuted, sfx } from "@/lib/fx";

export default function RoomGame({ id }: { id: string }) {
  const router = useRouter();
  const [me, setMe] = useState<Identity | null>(null);
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"play" | "archive">("play");
  const [activeRound, setActiveRound] = useState<number | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [muted, setMutedState] = useState(false);

  const stateRef = useRef<RoomState | null>(null);
  const activeRoundRef = useRef<number | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const creatingRef = useRef(false);
  const revealedRef = useRef(new Set<string>());
  const seqRef = useRef(0);
  const appliedSeqRef = useRef(0);

  useEffect(() => {
    activeRoundRef.current = activeRound;
  }, [activeRound]);

  const showToast = useCallback((t: string) => {
    setToast(t);
    setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 2600);
  }, []);

  const markRevealed = useCallback((round: number, idx: number) => {
    const k = `${round}:${idx}`;
    if (revealedRef.current.has(k)) return false;
    revealedRef.current.add(k);
    return true;
  }, []);

  const refresh = useCallback(async () => {
    const ident = loadIdentity();
    if (!ident) return;
    const mySeq = ++seqRef.current;
    try {
      const next = await api.state(ident.token, id);
      // Daha yeni bir istek zaten uygulandıysa bu eski cevabı at.
      if (mySeq < appliedSeqRef.current) return;
      appliedSeqRef.current = mySeq;
      const prev = stateRef.current;
      const nextRounds = buildRounds(next);
      const maxNext = nextRounds.reduce((m, r) => Math.max(m, r.roundNo), 0);

      if (!prev) {
        // İlk yükleme: zaten açılmış kartlar için animasyon oynatma.
        for (const r of nextRounds)
          r.cells.forEach((c, i) => c.mine !== null && c.theirs !== null && markRevealed(r.roundNo, i));
      } else {
        // Partner az önce katıldı mı?
        if (!prev.partner && next.partner) {
          sfx.joined();
          showToast(`${next.partner.name} katıldı! 🎉`);
        }
        // Yeni tur açıldıysa (kim açarsa açsın) oraya geç.
        const maxPrev = prev.rounds.reduce((m, r) => Math.max(m, r.round_no), 0);
        if (maxPrev > 0 && maxNext > maxPrev) {
          activeRoundRef.current = maxNext;
          setActiveRound(maxNext);
          setView("play");
          if (!creatingRef.current) showToast(`Tur ${maxNext} başladı 🚀`);
        }
        // Aktif turda yeni iki-taraflı tamamlanan kart → açılış animasyonu
        const ar = activeRoundRef.current;
        const nr = nextRounds.find((r) => r.roundNo === ar);
        if (nr) {
          nr.cells.forEach((c, i) => {
            if (c.mine !== null && c.theirs !== null && markRevealed(nr.roundNo, i)) {
              setReveal({ round: nr.roundNo, idx: i, foodId: nr.items[i], mine: c.mine, theirs: c.theirs });
            }
          });
        }
        // Diğer turlarda tamamlananları sessizce işaretle
        for (const r of nextRounds)
          if (r.roundNo !== ar)
            r.cells.forEach((c, i) => c.mine !== null && c.theirs !== null && markRevealed(r.roundNo, i));
      }

      stateRef.current = next;
      setState(next);
      setError(null);
      setActiveRound((cur) => {
        if (cur === null || !next.rounds.some((r) => r.round_no === cur)) {
          activeRoundRef.current = maxNext || null;
          return maxNext || null;
        }
        return cur;
      });
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [id, showToast, markRevealed]);

  // İlk yükleme
  useEffect(() => {
    const ident = loadIdentity();
    if (!ident) {
      router.replace("/");
      return;
    }
    setMe(ident);
    setMutedState(isMuted());
    void refresh();
  }, [refresh, router]);

  // Realtime: broadcast + presence
  useEffect(() => {
    if (!me) return;
    const ch = supabase().channel(`room:${id}`, {
      config: { broadcast: { self: false }, presence: { key: me.id } },
    });
    ch.on("broadcast", { event: "answered" }, () => void refresh())
      .on("broadcast", { event: "round" }, () => void refresh())
      .on("broadcast", { event: "joined" }, () => void refresh())
      .on("presence", { event: "sync" }, () => {
        const keys = Object.keys(ch.presenceState());
        setPartnerOnline(keys.some((k) => k !== me.id));
      })
      .on("presence", { event: "join" }, ({ key }) => {
        if (key !== me.id) void refresh();
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({ name: me.name });
          await ch.send({ type: "broadcast", event: "joined", payload: { by: me.name } });
        }
      });
    channelRef.current = ch;
    return () => {
      channelRef.current = null;
      void supabase().removeChannel(ch);
    };
  }, [id, me, refresh, showToast]);

  // Sekme geri gelince ve beklerken yedek senkron
  const rounds = useMemo(() => (state ? buildRounds(state) : []), [state]);
  const cur: RoundView | undefined = rounds.find((r) => r.roundNo === activeRound) ?? rounds[rounds.length - 1];
  const curIdx = cur ? cur.cells.findIndex((c) => c.mine === null || c.theirs === null) : -1;
  const waiting =
    !state?.partner || (cur && curIdx >= 0 && cur.cells[curIdx].mine !== null && cur.cells[curIdx].theirs === null);

  useEffect(() => {
    const onVis = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(() => waiting && void refresh(), 4000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(t);
    };
  }, [refresh, waiting]);

  const broadcast = useCallback((event: string, payload: Record<string, unknown>) => {
    void channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  const startRound = useCallback(
    async (n: number) => {
      const ident = loadIdentity();
      const s = stateRef.current;
      if (!ident || !s || creatingRef.current) return;
      creatingRef.current = true;
      try {
        const used = s.rounds.flatMap((r) => r.items);
        await api.ensureRound(ident.token, id, n, nextRoundItems(id, used, n));
        setActiveRound(n);
        await refresh();
        setActiveRound(n);
        setView("play");
        broadcast("round", { round: n, by: ident.name });
      } catch (e) {
        setError(friendlyError(e));
      } finally {
        creatingRef.current = false;
      }
    },
    [broadcast, id, refresh],
  );

  // Turdaki görselleri önceden indir: kart geçişleri takılmasın.
  const curItemsKey = cur?.items.join(",") ?? "";
  useEffect(() => {
    if (!curItemsKey) return;
    for (const fid of curItemsKey.split(",")) {
      const img = new Image();
      img.src = emojiUrl(getFood(fid).emoji);
    }
  }, [curItemsKey]);

  // Partner geldiyse ve hiç tur yoksa ilk turu oluştur
  useEffect(() => {
    if (state?.partner && state.rounds.length === 0) void startRound(1);
  }, [state, startRound]);

  async function choose(choice: Choice) {
    const ident = loadIdentity();
    if (!ident || !cur || curIdx < 0 || submitting) return;
    setSubmitting(true);
    sfx.select();
    try {
      const res = await api.answer(ident.token, id, cur.roundNo, curIdx, choice);
      if (res.theirs !== null && res.mine !== null && markRevealed(cur.roundNo, curIdx)) {
        setReveal({ round: cur.roundNo, idx: curIdx, foodId: cur.items[curIdx], mine: res.mine, theirs: res.theirs });
      }
      broadcast("answered", { round: cur.roundNo, idx: curIdx });
      await refresh();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSubmitting(false);
    }
  }

  function share() {
    if (!state) return;
    const url = `${location.origin}/?kod=${state.room.code}`;
    const text = `Yer misin Yemez misin? oynayalım! Oda kodu: ${state.room.code}`;
    if (navigator.share) {
      navigator.share({ title: "Yer misin Yemez misin?", text, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(`${text}\n${url}`).then(() => showToast("Link kopyalandı 📋"));
    }
  }

  function toggleMute() {
    const v = !muted;
    setMuted(v);
    setMutedState(v);
    if (!v) sfx.tap();
  }

  const maxRound = rounds.reduce((m, r) => Math.max(m, r.roundNo), 0);

  // ---------- render ----------
  let body: React.ReactNode;
  if (error && !state) {
    body = (
      <div className="mt-20 flex flex-col items-center gap-4 text-center">
        <p className="text-6xl">😵</p>
        <p className="text-xl">{error}</p>
        <button onClick={() => router.push("/")} className="btn-3d bg-accent px-6 py-3 text-ink">
          Ana sayfa
        </button>
      </div>
    );
  } else if (!state || !me) {
    body = <Loading text="Masa hazırlanıyor..." />;
  } else if (!state.partner) {
    body = <Lobby code={state.room.code} onShare={share} />;
  } else if (!cur) {
    body = <Loading text="İlk tur hazırlanıyor..." />;
  } else if (view === "archive") {
    body = (
      <Archive
        rounds={rounds}
        myName={state.me.name}
        partnerName={state.partner.name}
        onOpen={(r) => {
          setActiveRound(r);
          setView("play");
        }}
        onClose={() => setView("play")}
      />
    );
  } else if (curIdx < 0 && !reveal) {
    body = (
      <Summary
        key={cur.roundNo}
        round={cur}
        myName={state.me.name}
        partnerName={state.partner.name}
        isLatest={cur.roundNo === maxRound}
        onNext={() => (cur.roundNo === maxRound ? startRound(maxRound + 1) : setActiveRound(maxRound))}
        onArchive={() => setView("archive")}
        onToast={showToast}
      />
    );
  } else {
    const idx = reveal && reveal.round === cur.roundNo ? reveal.idx : curIdx;
    const cell = cur.cells[idx];
    const food = getFood(cur.items[idx]);
    body = (
      <div data-testid="play" data-round={cur.roundNo} className="flex flex-1 flex-col">
        <ProgressDots round={cur} active={idx} />
        <SwipeCard
          key={`${cur.roundNo}-${idx}`}
          food={food}
          index={idx}
          total={cur.items.length}
          myChoice={cell.mine}
          partnerDone={cell.theirsDone}
          partnerName={state.partner.name}
          partnerOnline={partnerOnline}
          disabled={submitting || cell.mine !== null || !!reveal}
          onChoose={choose}
        />
      </div>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Background />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col px-4 safe-top safe-bottom">
        {state && me && (
          <TopBar
            code={state.room.code}
            partnerName={state.partner?.name ?? null}
            partnerOnline={partnerOnline}
            roundNo={cur?.roundNo ?? null}
            muted={muted}
            onHome={() => router.push("/")}
            onMute={toggleMute}
            onArchive={state.partner && cur ? () => setView(view === "archive" ? "play" : "archive") : undefined}
            onSkip={
              state.partner && cur && view === "play"
                ? () => {
                    if (confirm(`Bu turu bırakıp ${toRound(maxRound + 1)} geçilsin mi? Yarım kalan tur arşivde durur.`))
                      void startRound(maxRound + 1);
                  }
                : undefined
            }
          />
        )}
        {body}
      </div>

      <AnimatePresence>
        {reveal && state?.partner && (
          <RevealOverlay
            key={`${reveal.round}-${reveal.idx}`}
            reveal={reveal}
            myName={state.me.name}
            partnerName={state.partner.name}
            onDone={() => setReveal(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            className="fixed inset-x-0 top-3 z-50 mx-auto w-fit max-w-[90vw] rounded-full bg-cream px-5 py-2 text-center font-semibold text-ink shadow-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div className="mt-32 flex flex-col items-center gap-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
        className="text-6xl"
      >
        🍽️
      </motion.div>
      <p className="text-xl opacity-90">{text}</p>
    </div>
  );
}

function TopBar(props: {
  code: string;
  partnerName: string | null;
  partnerOnline: boolean;
  roundNo: number | null;
  muted: boolean;
  onHome: () => void;
  onMute: () => void;
  onArchive?: () => void;
  onSkip?: () => void;
}) {
  const iconBtn = "glass grid h-11 w-11 place-items-center rounded-2xl text-xl transition active:scale-90";
  return (
    <header className="flex items-center gap-2 py-2">
      <button className={iconBtn} onClick={props.onHome} aria-label="Ana sayfa">
        🏠
      </button>
      <div className="glass flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-3 py-2">
        <span className="relative flex h-3 w-3 shrink-0">
          {props.partnerOnline && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          )}
          <span
            className={`relative inline-flex h-3 w-3 rounded-full ${props.partnerOnline ? "bg-green-400" : "bg-white/40"}`}
          />
        </span>
        <span className="truncate text-sm font-semibold">{props.partnerName ?? "Bekleniyor"}</span>
        <span className="ml-auto shrink-0 text-xs opacity-70">
          {props.roundNo ? `Tur ${props.roundNo}` : props.code}
        </span>
      </div>
      {props.onSkip && (
        <button className={iconBtn} onClick={props.onSkip} aria-label="Sonraki tura atla">
          ⏭️
        </button>
      )}
      {props.onArchive && (
        <button className={iconBtn} onClick={props.onArchive} aria-label="Arşiv">
          📜
        </button>
      )}
      <button className={iconBtn} onClick={props.onMute} aria-label="Ses">
        {props.muted ? "🔇" : "🔊"}
      </button>
    </header>
  );
}

function ProgressDots({ round, active }: { round: RoundView; active: number }) {
  return (
    <div className="mt-2 flex justify-center gap-1.5">
      {round.cells.map((c, i) => {
        const done = c.mine !== null && c.theirs !== null;
        const color = done ? (c.mine === c.theirs ? "bg-green-400" : "bg-red-400") : "bg-white/30";
        return (
          <motion.span
            key={i}
            layout
            className={`h-2.5 rounded-full ${color}`}
            animate={{ width: i === active ? 26 : 10, opacity: i === active || done ? 1 : 0.7 }}
          />
        );
      })}
    </div>
  );
}
