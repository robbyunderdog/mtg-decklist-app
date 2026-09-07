import { useState, type MouseEvent } from "react";

interface Props {
  small: string;
  large: string | null;
  alt: string;
  className?: string;
}

const PREVIEW_WIDTH = 280;

export function HoverZoomImage({ small, large, alt, className }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  function track(e: MouseEvent<HTMLImageElement>) {
    setPos({ x: e.clientX, y: e.clientY });
  }

  const previewLeft =
    pos && typeof window !== "undefined"
      ? Math.min(pos.x + 24, window.innerWidth - PREVIEW_WIDTH - 16)
      : 0;
  const previewTop =
    pos && typeof window !== "undefined"
      ? Math.min(Math.max(pos.y - 200, 16), window.innerHeight - 400)
      : 0;

  return (
    <>
      <img
        src={small}
        alt=""
        onMouseEnter={track}
        onMouseMove={track}
        onMouseLeave={() => setPos(null)}
        className={className ?? "h-12 w-auto cursor-zoom-in rounded"}
      />
      {pos && large && (
        <div
          className="pointer-events-none fixed z-50"
          style={{ left: previewLeft, top: previewTop, width: PREVIEW_WIDTH }}
        >
          <img
            src={large}
            alt={alt}
            className="w-full rounded-xl shadow-2xl ring-1 ring-neutral-700"
          />
        </div>
      )}
    </>
  );
}
