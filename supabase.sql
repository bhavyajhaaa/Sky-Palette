create table public.skies (
  id uuid primary key default gen_random_uuid(),
  image_path text not null,
  width integer not null,
  height integer not null,
  colors jsonb not null default '[]'::jsonb,
  -- Legacy/future global-admin exclusion flag. Visitor curation is localStorage-only.
  hidden_from_palette boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.skies
  add column if not exists hidden_from_palette boolean not null default false;
alter table public.skies enable row level security;
create policy "Public can view skies" on public.skies for select using (true);
insert into storage.buckets (id, name, public) values ('sky-images', 'sky-images', true) on conflict do nothing;
create policy "Public can view sky images" on storage.objects for select using (bucket_id = 'sky-images');
