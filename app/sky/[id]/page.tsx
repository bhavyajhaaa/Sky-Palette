import Link from "next/link";
import { notFound } from "next/navigation";
import { getSky } from "@/lib/data";
import { CopyColor } from "@/components/CopyColor";
import { SkyManagement } from "@/components/SkyManagement";

export default async function SkyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    s = await getSky(id);
  if (!s) notFound();
  return (
    <main className="px-6 md:px-[10vw] py-10 md:py-16">
      <Link href="/archive" className="text-xs muted">
        ← Archive
      </Link>
      <div className="mt-14 md:mt-20 max-w-5xl mx-auto">
        <img
          src={s.image_path}
          alt="Uploaded sky photograph"
          className="w-full max-h-[64vh] object-cover"
        />
        <div className="mt-10 flex justify-between text-[11px] muted">
          <span>{s.colors.length} extracted colors</span>
          <time>
            {new Date(s.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
        </div>
        <div className="mt-5 grid grid-cols-4 md:grid-cols-12 gap-2">
          {s.colors.map((c) => (
            <div key={c}>
              <div className="aspect-square" style={{ background: c }} />
              <CopyColor color={c} />
            </div>
          ))}
        </div>
        <SkyManagement id={s.id} initiallyHidden={s.hidden_from_palette} />
      </div>
    </main>
  );
}
