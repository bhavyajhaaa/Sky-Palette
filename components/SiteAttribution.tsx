export function SiteAttribution({ className = "" }: { className?: string }) {
  return (
    <p className={`muted text-[10px] ${className}`}>
      Made to play. Work is at{" "}
      <a
        href="https://jhabhavya.com"
        className="hover:text-[var(--ink)] hover:underline focus-visible:text-[var(--ink)] focus-visible:underline"
      >
        jhabhavya.com
      </a>
    </p>
  );
}
