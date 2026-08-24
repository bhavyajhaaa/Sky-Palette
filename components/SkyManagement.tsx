"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

type Action = "visibility" | "delete";

export function SkyManagement({
  id,
  initiallyHidden,
}: {
  id: string;
  initiallyHidden: boolean;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState(initiallyHidden);
  const [action, setAction] = useState<Action | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  const close = () => {
    if (busy) return;
    setAction(null);
    setPassword("");
    setMessage("");
    requestAnimationFrame(() => trigger.current?.focus());
  };

  const open = (next: Action, event: React.MouseEvent<HTMLButtonElement>) => {
    trigger.current = event.currentTarget;
    setAction(next);
    setPassword("");
    setMessage("");
  };

  useEffect(() => {
    if (!action) return;
    input.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    addEventListener("keydown", onKeyDown);
    return () => removeEventListener("keydown", onKeyDown);
  }, [action, busy]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!action || !password) return;
    setBusy(true);
    setMessage("");
    const deleting = action === "delete";
    try {
      const response = await fetch(
        deleting ? `/api/skies/${id}` : `/api/skies/${id}/visibility`,
        {
          method: deleting ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            deleting ? { password } : { password, hidden: !hidden },
          ),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error || "The change could not be completed.");
        return;
      }
      if (deleting) {
        router.push("/archive");
        router.refresh();
        return;
      }
      setHidden(Boolean(body.hidden));
      setAction(null);
      setPassword("");
      router.refresh();
      requestAnimationFrame(() => trigger.current?.focus());
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
          className="muted hover:text-[var(--ink)] hover:underline"
          onClick={(event) => open("visibility", event)}
        >
          {hidden ? "Restore to palette" : "Hide from palette"}
        </button>
        <button
          className="text-[var(--muted-foreground)] hover:text-[var(--ink)] hover:underline"
          onClick={(event) => open("delete", event)}
        >
          Delete
        </button>
      </div>
      {action && (
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
              {action === "delete"
                ? "Delete this sky permanently?"
                : hidden
                  ? "Restore this sky to the palette?"
                  : "Hide this sky from the palette?"}
            </h2>
            <p className="muted mt-2 text-[11px]">
              {action === "delete"
                ? "This cannot be undone."
                : "The photograph will remain in the archive."}
            </p>
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
                <button disabled={busy || !password} className="disabled:opacity-40">
                  {busy
                    ? "Working…"
                    : action === "delete"
                      ? "Delete permanently"
                      : hidden
                        ? "Restore"
                        : "Hide"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
