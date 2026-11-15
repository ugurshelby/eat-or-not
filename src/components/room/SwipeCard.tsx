"use client";

import { animate, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import FoodImage from "@/components/FoodImage";
import { CATEGORIES, type Food } from "@/lib/foods";
import { CHOICE_META } from "@/lib/game";
import type { Choice } from "@/lib/api";

type Props = {
  food: Food;
  index: number;
  total: number;
  myChoice: Choice | null;
  partnerDone: boolean;
  partnerName: string;
  partnerOnline: boolean;
  disabled: boolean;
  onChoose: (c: Choice) => void;
};

export default function SwipeCard(p: Props) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-16, 16]);
  const yesOp = useTransform(x, [25, 120], [0, 1]);
  const noOp = useTransform(x, [-120, -25], [1, 0]);
  const maybeOp = useTransform(y, [-120, -30], [1, 0]);
  const cat = CATEGORIES[p.food.cat];

  function onDragEnd(_: unknown, info: PanInfo) {
    const { offset, velocity } = info;
    let c: Choice | null = null;
    if (offset.x > 110 || velocity.x > 700) c = 1;
    else if (offset.x < -110 || velocity.x < -700) c = 0;
    else if (offset.y < -110 || velocity.y < -700) c = 2;
    animate(x, 0, { type: "spring", stiffness: 400, damping: 28 });
    animate(y, 0, { type: "spring", stiffness: 400, damping: 28 });
    if (c !== null) p.onChoose(c);
  }

  const chosen = p.myChoice;

  return (
    <div className="mt-3 flex flex-1 flex-col">
      <div className="relative flex flex-1 items-center justify-center">
        {/* arkadaki kartlar: deste hissi */}
        <div className="absolute h-[92%] w-[86%] translate-y-5 rotate-3 rounded-[2.2rem] bg-white/10" />
        <div className="absolute h-[94%] w-[90%] translate-y-2.5 -rotate-2 rounded-[2.2rem] bg-white/15" />

        <motion.div
          drag={!p.disabled}
          dragSnapToOrigin={false}
          dragElastic={0.9}
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          onDragEnd={onDragEnd}
          style={{ x, y, rotate }}
          initial={{ scale: 0.6, y: 80, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, y: 0, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="relative z-10 flex aspect-[3/4] max-h-[52dvh] w-[92%] cursor-grab touch-none flex-col overflow-hidden rounded-[2.2rem] shadow-[0_24px_60px_rgba(0,0,0,0.45)] active:cursor-grabbing"
        >
          <div className="relative flex flex-1 flex-col items-center justify-center"
            style={{ background: `linear-gradient(160deg, ${cat.from}, ${cat.to})` }}
          >
            <span className="absolute top-4 left-4 rounded-full bg-black/20 px-3 py-1 text-sm font-semibold">
              {cat.label}
            </span>
            <span className="absolute top-4 right-4 rounded-full bg-black/20 px-3 py-1 text-sm font-semibold">
              {p.index + 1}/{p.total}
            </span>
            <div className="absolute h-52 w-52 rounded-full bg-white/35 blur-2xl" />
            <motion.div
              animate={{ y: [0, -10, 0], rotate: [0, 3, -3, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <FoodImage emoji={p.food.emoji} size={190} className="drop-shadow-[0_18px_18px_rgba(0,0,0,0.3)]" />
            </motion.div>

            {/* sürükleme damgaları */}
            <Stamp style={{ opacity: chosen === 1 ? 1 : chosen === null ? yesOp : 0 }} color="var(--yes)" className="top-14 left-5 -rotate-12">
              YERİM
            </Stamp>
            <Stamp style={{ opacity: chosen === 0 ? 1 : chosen === null ? noOp : 0 }} color="var(--no)" className="top-14 right-5 rotate-12">
              YEMEM
            </Stamp>
            <Stamp style={{ opacity: chosen === 2 ? 1 : chosen === null ? maybeOp : 0 }} color="var(--maybe)" className="bottom-6 left-1/2 -translate-x-1/2 -rotate-3">
              DENEMEDİM
            </Stamp>
          </div>
          <div className="bg-cream px-5 py-4 text-center text-ink">
            <h2 className="text-3xl leading-tight font-bold">{p.food.name}</h2>
            {p.food.note && <p className="mt-0.5 text-sm opacity-70">{p.food.note}</p>}
          </div>
        </motion.div>
      </div>

      <PartnerStatus
        name={p.partnerName}
        online={p.partnerOnline}
        partnerDone={p.partnerDone}
        meDone={chosen !== null}
      />

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <ChoiceButton c={0} onClick={() => p.onChoose(0)} disabled={p.disabled} active={chosen === 0} big />
        <ChoiceButton c={2} onClick={() => p.onChoose(2)} disabled={p.disabled} active={chosen === 2} />
        <ChoiceButton c={1} onClick={() => p.onChoose(1)} disabled={p.disabled} active={chosen === 1} big />
      </div>
    </div>
  );
}

function Stamp({
  children,
  color,
  className,
  style,
}: {
  children: React.ReactNode;
  color: string;
  className: string;
  style: React.ComponentProps<typeof motion.div>["style"];
}) {
  return (
    <motion.div
      style={{ ...style, color, borderColor: color }}
      className={`pointer-events-none absolute rounded-xl border-4 bg-white/85 px-3 py-1 text-3xl font-bold tracking-wider ${className}`}
    >
      {children}
    </motion.div>
  );
}

function PartnerStatus({
  name,
  online,
  partnerDone,
  meDone,
}: {
  name: string;
  online: boolean;
  partnerDone: boolean;
  meDone: boolean;
}) {
  let text: React.ReactNode;
  if (meDone && !partnerDone)
    text = (
      <>
        <b>{name}</b> düşünüyor
        <Dots />
      </>
    );
  else if (partnerDone && !meDone)
    text = (
      <>
        <b>{name}</b> seçti ✓ sıra sende!
      </>
    );
  else if (!online)
    text = (
      <>
        <b>{name}</b> şu an çevrimdışı · sen yine seç
      </>
    );
  else text = <>Kaydır ya da dokun: sağ yerim, sol yemem</>;

  return (
    <motion.p
      key={String(meDone) + String(partnerDone)}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 flex min-h-7 items-center justify-center gap-1 text-center text-base"
    >
      {text}
    </motion.p>
  );
}

function Dots() {
  return (
    <span className="ml-1 inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full bg-white"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }}
        />
      ))}
    </span>
  );
}

function ChoiceButton({
  c,
  onClick,
  disabled,
  active,
  big,
}: {
  c: Choice;
  onClick: () => void;
  disabled: boolean;
  active: boolean;
  big?: boolean;
}) {
  const meta = CHOICE_META[c];
  const shade = c === 1 ? "var(--yes-dark)" : c === 0 ? "var(--no-dark)" : "var(--maybe-dark)";
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      disabled={disabled}
      animate={active ? { scale: [1, 1.12, 1] } : {}}
      className={`btn-3d flex flex-col items-center justify-center text-white ${big ? "h-20 text-xl" : "h-16 w-20 text-xs"} ${active ? "ring-4 ring-white" : ""}`}
      style={{ background: meta.color, ["--shade" as string]: shade }}
    >
      <span className={big ? "text-3xl" : "text-2xl"}>{meta.emoji}</span>
      <span className="leading-none">{c === 2 ? "Denemedim" : meta.label}</span>
    </motion.button>
  );
}
