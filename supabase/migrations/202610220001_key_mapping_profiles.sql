-- Keep this migration with the mobile app so standalone checkouts can deploy it.
-- Safe to reapply: all changes commit together, including the API schema reload.
begin;

create table if not exists public.key_mapping_profiles (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  game_id text not null check (length(game_id) between 1 and 200),
  game_title text not null,
  name text not null check (length(btrim(name)) between 1 and 80),
  description text not null default '' check (length(description) <= 2000),
  screenshot_path text not null,
  screenshot jsonb not null check (jsonb_typeof(screenshot) = 'object'),
  bindings jsonb not null check (jsonb_typeof(bindings) = 'array' and jsonb_array_length(bindings) between 1 and 64),
  settings jsonb not null default '{"markerOpacity":0.85}'::jsonb check (jsonb_typeof(settings) = 'object'),
  schema_version integer not null default 1 check (schema_version = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint key_mapping_owned_screenshot check (
    screenshot_path like user_id::text || '/' || id::text || '/%'
    and position('..' in screenshot_path) = 0
  )
);
create index if not exists key_mapping_profiles_user_game_idx on public.key_mapping_profiles(user_id, game_id, updated_at desc);
alter table public.key_mapping_profiles enable row level security;
revoke all on public.key_mapping_profiles from public, anon;
grant select, insert, update, delete on public.key_mapping_profiles to authenticated;

drop policy if exists key_mapping_profiles_select_self on public.key_mapping_profiles;
create policy key_mapping_profiles_select_self on public.key_mapping_profiles for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists key_mapping_profiles_insert_self on public.key_mapping_profiles;
create policy key_mapping_profiles_insert_self on public.key_mapping_profiles for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists key_mapping_profiles_update_self on public.key_mapping_profiles;
create policy key_mapping_profiles_update_self on public.key_mapping_profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists key_mapping_profiles_delete_self on public.key_mapping_profiles;
create policy key_mapping_profiles_delete_self on public.key_mapping_profiles for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.touch_key_mapping_profile()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.user_id <> old.user_id then raise exception 'mapping_identity_immutable'; end if;
    new.created_at := old.created_at;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
drop trigger if exists key_mapping_profiles_touch on public.key_mapping_profiles;
create trigger key_mapping_profiles_touch before insert or update on public.key_mapping_profiles for each row execute function public.touch_key_mapping_profile();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('key-mapping-screenshots', 'key-mapping-screenshots', false, 10485760, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists key_mapping_screenshots_select_self on storage.objects;
create policy key_mapping_screenshots_select_self on storage.objects for select to authenticated using (bucket_id = 'key-mapping-screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists key_mapping_screenshots_insert_self on storage.objects;
create policy key_mapping_screenshots_insert_self on storage.objects for insert to authenticated with check (bucket_id = 'key-mapping-screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text and array_length(storage.foldername(name), 1) = 2);
-- Objects are immutable: replacement always uses a new path, then removes the old object.
drop policy if exists key_mapping_screenshots_delete_self on storage.objects;
create policy key_mapping_screenshots_delete_self on storage.objects for delete to authenticated using (bucket_id = 'key-mapping-screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);

notify pgrst, 'reload schema';
commit;
