"use client";

import { motion } from "framer-motion";
import FoodImage from "@/components/FoodImage";

export default function Lobby({ code, onShare }: { code: string; onShare: () => void }) {
  return (
    <div className="mt-6 flex flex-1 flex-col items-center text-center">
      <motion.div
        animate={{ rotate: [0, -8, 8, 0], y: [0, -8, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <FoodImage emoji="🍽️" size={130} />
      </motion.div>
      <h2 className="mt-4 text-3xl font-bold">Masan hazır!</h2>
      <p className="mt-1 text-lg opacity-85">Arkadaşın bu kodla katılsın</p>

      <div className="mt-6 flex gap-3">
        {code.split("").map((ch, i) => (
          <motion.span
            key={i}
            initial={{ y: 40, opacity: 0, rotate: -15 }}
            animate={{ y: [0, -10, 0], opacity: 1, rotate: 0 }}
            transition={{
              y: { duration: 1.4, repeat: Infinity, delay: 0.5 + i * 0.15 },
              opacity: { delay: i * 0.1 },
              rotate: { type: "spring", delay: i * 0.1 },
            }}
            className="grid h-20 w-16 place-items-center rounded-2xl bg-cream text-5xl font-bold text-ink shadow-[0_6px_0_#cdbfa9]"
          >
            {ch}
          </motion.span>
        ))}
      </div>

      <button
        onClick={onShare}
        className="btn-3d mt-8 w-full bg-pink py-4 text-2xl text-white"
        style={{ ["--shade" as string]: "#b23a60" }}
      >
        📨 Davet linkini gönder
      </button>

      <div className="mt-8 flex items-center gap-2 text-lg opacity-90">
        Arkadaşın bekleniyor
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="inline-block h-2 w-2 rounded-full bg-white"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
