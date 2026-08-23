# Sky Colors

A small digital museum for sky photographs and their extracted colors. Built with Next.js, TypeScript, Tailwind, browser Canvas, and optional Supabase persistence.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The included seed collection makes every view usable without credentials. To enable uploads, run `supabase.sql` in the Supabase SQL editor and add the four environment variables from `.env.example`. The upload endpoint verifies `SKY_UPLOAD_PASSWORD`, accepts only the browser-compressed WebP, uploads it to `sky-images`, and inserts its metadata.

## Deploy

Import the repository into Vercel, add the same environment variables, and deploy using the default Next.js settings.
