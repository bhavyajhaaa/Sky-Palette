"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "sky-palette-hidden-skies";

type SkySelection = {
  hiddenIds: Set<string>;
  isHidden: (id: string) => boolean;
  toggleHidden: (id: string) => void;
  hide: (id: string) => void;
  show: (id: string) => void;
  clearHidden: () => void;
};

const SkySelectionContext = createContext<SkySelection | null>(null);

function readHiddenIds() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return new Set(
      Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [],
    );
  } catch {
    return new Set<string>();
  }
}

export function SkySelectionProvider({ children }: { children: React.ReactNode }) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());

  useEffect(() => setHiddenIds(readHiddenIds()), []);

  const update = useCallback((change: (ids: Set<string>) => void) => {
    setHiddenIds((current) => {
      const next = new Set(current);
      change(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);
  const hide = useCallback((id: string) => update((ids) => ids.add(id)), [update]);
  const show = useCallback((id: string) => update((ids) => ids.delete(id)), [update]);
  const toggleHidden = useCallback(
    (id: string) => update((ids) => (ids.has(id) ? ids.delete(id) : ids.add(id))),
    [update],
  );
  const clearHidden = useCallback(() => update((ids) => ids.clear()), [update]);
  const value = useMemo(
    () => ({ hiddenIds, isHidden: (id: string) => hiddenIds.has(id), toggleHidden, hide, show, clearHidden }),
    [hiddenIds, toggleHidden, hide, show, clearHidden],
  );

  return <SkySelectionContext.Provider value={value}>{children}</SkySelectionContext.Provider>;
}

export function useHiddenSkies() {
  const value = useContext(SkySelectionContext);
  if (!value) throw new Error("useHiddenSkies must be used within SkySelectionProvider");
  return value;
}
