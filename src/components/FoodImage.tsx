"use client";

import { useState } from "react";
import { emojiUrl } from "@/lib/foods";

export default function FoodImage({
  emoji,
  size = 160,
  className = "",
}: {
  emoji: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className={className} style={{ fontSize: size * 0.8, lineHeight: 1 }} aria-hidden>
        {emoji}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={emojiUrl(emoji)}
      alt=""
      width={size}
      height={size}
      draggable={false}
      onError={() => setFailed(true)}
      className={`select-none pointer-events-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
