"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Background from "@/components/Background";
import FoodImage from "@/components/FoodImage";
import { api, friendlyError, saveIdentity, type Identity } from "@/lib/api";
import { sfx } from "@/lib/fx";

/** Kişisel davet linki: kimliği geri yükler, "Hoş geldin" der, ortak odaya sokar. */
export default function Welcome({ linkKey }: { linkKey: string }) {
  const router = useRouter();
  const [me, setMe] = useState<Identity | null>(null);
  const [partner, setPartner] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "bad" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const id = await api.claimLink(linkKey);
        if (!alive) return;
        if (!id) {
          setStatus("bad");
          return;
        }
        saveIdentity(id);
        setMe(id);
        setStatus("ok");
        if (id.home_room) {
          api
            .state(id.token, id.home_room)
            .then((s) => alive && setPartner(s.partner?.name ?? null))
            .catch(() => {});
        }
      } catch (e) {
        if (!alive) return;
        setError(friendlyError(e));
        setStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [linkKey]);

  const hearts = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({ left: (i * 37) % 100, delay: (i * 0.35) % 3, size: 18 + ((i * 11) % 22) })),
    [],
  );

  function enter() {
    if (!me) return;
    sfx.match();
    router.push(me.home_room ? `/oda/${me.home_room}` : "/");
  }

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Background />
      {status === "ok" &&
        hearts.map((h, i) => (
          <motion.span
            key={i}
            className="pointer-events-none fixed z-0"
            style={{ left: `${h.left}%`, bottom: -40, fontSize: h.size }}
            animate={{ y: ["0vh", "-115vh"], rotate: [0, i % 2 ? 25 : -25], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 6, delay: h.delay, repeat: Infinity, ease: "easeOut" }}
          >
            💖
          </motion.span>
        ))}

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center safe-top safe-bottom">
        {status === "loading" && (
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} className="text-6xl">
            🍽️
          </motion.div>
        )}

        {status === "ok" && me && (
          <>
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 12 }}
            >
              <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 1.6, repeat: Infinity }}>
                <FoodImage emoji="🥰" size={140} />
              </motion.div>
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-4 text-2xl font-semibold opacity-90"
            >
              Hoş geldin
            </motion.p>
            <motion.h1
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.45, type: "spring", stiffness: 200, damping: 10 }}
              className="text-stroke text-7xl leading-tight font-bold text-accent"
            >
              {me.name}!
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="mt-3 text-xl"
            >
              {partner ? (
                <>
                  <b className="text-pink">{partner}</b> ile masanız hazır 🍽️
                </>
              ) : (
                "Masanız hazır 🍽️"
              )}
            </motion.p>
            <motion.button
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
              onClick={enter}
              className="btn-3d mt-10 w-full bg-pink py-5 text-3xl text-white"
              style={{ ["--shade" as string]: "#b23a60" }}
            >
              Oyuna gir 💖
            </motion.button>
          </>
        )}

        {(status === "bad" || status === "error") && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-6xl">🤔</p>
            <p className="text-xl">{status === "bad" ? "Bu link geçersiz." : error}</p>
            <button
              onClick={() => (status === "bad" ? router.push("/") : location.reload())}
              className="btn-3d bg-accent px-6 py-3 text-lg text-ink"
              style={{ ["--shade" as string]: "#c9962e" }}
            >
              {status === "bad" ? "Ana sayfa" : "Tekrar dene"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
