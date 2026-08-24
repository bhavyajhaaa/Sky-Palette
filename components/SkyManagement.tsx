"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useHiddenSkies } from "./SkySelectionProvider";

export function SkyManagement({ id }: { id: string }) {
  const router = useRouter();
  const { show } = useHiddenSkies();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setPassword("");
    setMessage("");
    requestAnimationFrame(() => trigger.current?.focus());
  };

  const openDialog = (event: React.MouseEvent<HTMLButtonElement>) => {
    trigger.current = event.currentTarget;
    setOpen(true);
    setPassword("");
    setMessage("");
  };

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    addEventListener("keydown", onKeyDown);
    return () => removeEventListener("keydown", onKeyDown);
  }, [open, busy]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!password) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/skies/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error || "The change could not be completed.");
        return;
      }
      show(id);
      router.push("/archive");
      router.refresh();
      return;
    } catch {
      setMessage("The change could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mt-12 flex items-center gap-6 border-t line pt-5 text-[11px]">
        <button
          className="text-[var(--muted-foreground)] hover:text-[var(--ink)] hover:underline"
          onClick={openDialog}
        >
          Delete
        </button>
      </div>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onMouseDown={(event) => event.target === event.currentTarget && close()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="manage-sky-title"
            className="w-full max-w-sm border line bg-[var(--bg)] p-6 text-[var(--ink)]"
          >
            <h2 id="manage-sky-title" className="text-sm">
              Delete this sky permanently?
            </h2>
            <p className="muted mt-2 text-[11px]">This cannot be undone.</p>
            <form onSubmit={submit}>
              <label className="mt-6 block text-[11px]">
                Admin password
                <input
                  ref={input}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  className="mt-2 block w-full border-b line bg-transparent py-2 outline-none"
                />
              </label>
              {message && <p className="mt-3 text-[11px]">{message}</p>}
              <div className="mt-6 flex justify-end gap-5 text-[11px]">
                <button type="button" className="muted" onClick={close}>
                  Cancel
                </button>
                <button
                  disabled={busy || !password}
                  className="disabled:opacity-40"
                >
                  {busy ? "Working…" : "Delete permanently"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
