"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAddSky } from "./AddSkyModal";

export function Header() {
  const path = usePathname(),
    { open } = useAddSky(),
    [dark, setDark] = useState(false),
    fluid = path === "/" || path === "/fluid";
  useEffect(
    () => setDark(document.documentElement.classList.contains("dark")),
    [],
  );
  const toggle = () => {
    const value = !dark;
    setDark(value);
    document.documentElement.classList.toggle("dark", value);
    localStorage.setItem("sky-theme", value ? "dark" : "light");
  };
  return (
    <header className="h-16 px-4 md:px-8 flex items-center justify-between border-b line relative z-20 bg-[var(--bg)]">
      <Link
        href="/"
        className="site-mark text-[11px] font-semibold tracking-[.1em] sm:text-[13px] sm:tracking-[.14em]"
      >
        SKY PALETTE
      </Link>
      <nav className="flex items-center gap-2 text-[11px] sm:gap-4 sm:text-xs md:gap-7">
        <Link className={fluid ? "" : "muted"} href="/">
          Fluid
        </Link>
        <Link className={path === "/palette" ? "" : "muted"} href="/palette">
          Palette
        </Link>
        <Link
          className={
            path === "/archive" || path.startsWith("/sky/") ? "" : "muted"
          }
          href="/archive"
        >
          Archive
        </Link>
        <button
          className="theme-toggle muted grid size-7 place-items-center"
          aria-label={`Switch to ${dark ? "light" : "dark"} theme`}
          onClick={toggle}
        >
          <span key={dark ? "dark" : "light"} aria-hidden="true">
            {dark ? "☼" : "◐"}
          </span>
        </button>
        <button onClick={open} className="add-sky hidden sm:block">
          + Add a sky
        </button>
        <button
          onClick={open}
          aria-label="Add a sky"
          className="add-sky sm:hidden"
        >
          +
        </button>
      </nav>
    </header>
  );
}
