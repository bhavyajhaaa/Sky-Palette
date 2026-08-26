"use client";

import Link from "next/link";
import type { Sky } from "@/types/sky";
import { SiteAttribution } from "./SiteAttribution";
import { useHiddenSkies } from "./SkySelectionProvider";

export function ArchiveGrid({ skies }: { skies: Sky[] }) {
  const { hiddenIds, isHidden, toggleHidden, clearHidden } = useHiddenSkies();
  return (
    <main className="px-8 md:px-[8vw] py-16 md:py-24">
      <div className="mb-16 md:mb-24">
        <p className="text-[11px] uppercase tracking-[.16em] muted">
          The collection
        </p>
        <h1 className="mt-3 text-2xl font-normal">An archive of looking up.</h1>
        {hiddenIds.size > 0 && (
          <button
            type="button"
            onClick={clearHidden}
            className="muted mt-5 text-[11px] hover:text-[var(--ink)] hover:underline"
          >
            Show all
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-x-[7vw] gap-y-24 md:gap-y-32">
        {skies.map((s, i) => (
          <article
            key={s.id}
            className={`group ${i % 3 === 1 ? "md:mt-14" : ""}`}
          >
            <button
              type="button"
              style={{ aspectRatio: `${s.width}/${s.height}` }}
              aria-label={
                isHidden(s.id)
                  ? "Include this sky in palette and fluid"
                  : "Hide this sky from palette and fluid"
              }
              aria-pressed={isHidden(s.id)}
              title={
                isHidden(s.id) ? "Include in palette" : "Hide from palette"
              }
              onClick={() => toggleHidden(s.id)}
              className="block w-full cursor-pointer overflow-hidden text-left"
            >
              <img
                src={s.image_path}
                alt="Uploaded sky photograph"
                loading={i > 4 ? "lazy" : "eager"}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
                style={{
                  objectPosition: `${30 + ((i * 13) % 45)}% ${25 + ((i * 17) % 55)}%`,
                }}
              />
            </button>
            <div className="muted mt-2 grid min-h-4 grid-cols-[1fr_auto_1fr] items-center text-[10px]">
              <Link
                href={`/sky/${s.id}`}
                className="justify-self-start opacity-0 transition-opacity hover:text-[var(--ink)] hover:underline group-hover:opacity-100 group-focus-within:opacity-100"
              >
                {s.colors.length} colors
              </Link>
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full border border-[var(--muted-foreground)] ${
                  isHidden(s.id)
                    ? "bg-[var(--muted-foreground)]"
                    : "bg-transparent opacity-60"
                }`}
              />
              <time className="justify-self-end opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                {new Date(s.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </time>
            </div>
          </article>
        ))}
      </div>
      <SiteAttribution className="mt-20 md:mt-28" />
    </main>
  );
}
