"use client";
import { sortColors } from "@/lib/images";
import { useEffect, useState } from "react";

export function PaletteGrid({
  colors,
  skies,
}: {
  colors: string[];
  skies: number;
}) {
  const sorted = sortColors(colors),
    [columns, setColumns] = useState(3);
  useEffect(() => {
    const update = () =>
      setColumns(innerWidth >= 1024 ? 6 : innerWidth >= 640 ? 4 : 3);
    update();
    addEventListener("resize", update);
    return () => removeEventListener("resize", update);
  }, []);
  const rows = Math.ceil(sorted.length / columns);
  return (
    <main className="relative h-[calc(100dvh-4rem)] overflow-hidden">
      <div
        className="grid h-full"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {sorted.map((color, i) => (
          <button
            key={i}
            style={{ backgroundColor: color }}
            className="group relative min-h-0"
            aria-label={`Color ${color}`}
          >
            <span
              className="absolute inset-x-0 bottom-1 text-[clamp(7px,1.25vh,10px)] leading-none opacity-0 group-hover:opacity-75 focus:opacity-75 transition-opacity"
              style={{
                color:
                  parseInt(color.slice(1), 16) > 0x888888 ? "#111" : "#fff",
              }}
            >
              {color}
            </span>
          </button>
        ))}
      </div>
      <div className="theme-ui absolute bottom-3 left-4 z-10 bg-[var(--bg)]/75 px-2 py-1 text-[10px] backdrop-blur-sm">
        {colors.length} colors from {skies} skies
      </div>
    </main>
  );
}
