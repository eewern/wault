-- Supabase SQL for the Notion replica workspace.
-- Run this once in Supabase SQL Editor, then fill workspace-config.js.

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notion_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Workspace',
  owner uuid not null references auth.users(id) on delete cascade,
  seed_key text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notion_workspaces
add column if not exists seed_key text;

create unique index if not exists notion_workspaces_owner_seed_key_idx
on public.notion_workspaces(owner, seed_key)
where seed_key is not null;

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.notion_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.workspace_backups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.notion_workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  reason text not null default 'autosave',
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_invites (
  workspace_id uuid not null references public.notion_workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('admin', 'editor', 'viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (workspace_id, email)
);

alter table public.profiles enable row level security;
alter table public.notion_workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_backups enable row level security;
alter table public.workspace_invites enable row level security;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, lower(coalesce(new.email, '')))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (id, email)
select id, lower(email)
from auth.users
where email is not null
on conflict (id) do update set email = excluded.email;

create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function private.can_edit_workspace(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin', 'editor')
  );
$$;

create or replace function private.can_admin_workspace(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  );
$$;

create or replace function private.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  );
$$;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "workspaces_select_members" on public.notion_workspaces;
create policy "workspaces_select_members"
on public.notion_workspaces for select
to authenticated
using (
  owner = auth.uid()
  or private.is_workspace_member(id)
);

drop policy if exists "workspaces_insert_owner" on public.notion_workspaces;
create policy "workspaces_insert_owner"
on public.notion_workspaces for insert
to authenticated
with check (owner = auth.uid());

drop policy if exists "workspaces_update_editors" on public.notion_workspaces;
create policy "workspaces_update_editors"
on public.notion_workspaces for update
to authenticated
using (
  owner = auth.uid()
  or private.can_edit_workspace(id)
)
with check (
  owner = auth.uid()
  or private.can_edit_workspace(id)
);

drop policy if exists "members_select_workspace_members" on public.workspace_members;
create policy "members_select_workspace_members"
on public.workspace_members for select
to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists "members_insert_admins" on public.workspace_members;
create policy "members_insert_admins"
on public.workspace_members for insert
to authenticated
with check (
  (
    user_id = auth.uid()
    and exists (
      select 1
      from public.notion_workspaces nw
      where nw.id = workspace_id
        and nw.owner = auth.uid()
    )
  )
  or private.can_admin_workspace(workspace_id)
);

drop policy if exists "members_update_admins" on public.workspace_members;
create policy "members_update_admins"
on public.workspace_members for update
to authenticated
using (private.can_admin_workspace(workspace_id))
with check (private.can_admin_workspace(workspace_id));

drop policy if exists "members_delete_owners" on public.workspace_members;
create policy "members_delete_owners"
on public.workspace_members for delete
to authenticated
using (private.is_workspace_owner(workspace_id));

drop policy if exists "backups_select_members" on public.workspace_backups;
create policy "backups_select_members"
on public.workspace_backups for select
to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists "backups_insert_editors" on public.workspace_backups;
create policy "backups_insert_editors"
on public.workspace_backups for insert
to authenticated
with check (
  created_by = auth.uid()
  and private.can_edit_workspace(workspace_id)
);

drop policy if exists "invites_select_admins_or_self" on public.workspace_invites;
create policy "invites_select_admins_or_self"
on public.workspace_invites for select
to authenticated
using (
  private.can_admin_workspace(workspace_id)
  or email = lower((auth.jwt() ->> 'email'))
);

drop policy if exists "invites_insert_admins" on public.workspace_invites;
create policy "invites_insert_admins"
on public.workspace_invites for insert
to authenticated
with check (private.can_admin_workspace(workspace_id));

drop policy if exists "invites_update_admins_or_self" on public.workspace_invites;
create policy "invites_update_admins_or_self"
on public.workspace_invites for update
to authenticated
using (
  private.can_admin_workspace(workspace_id)
  or email = lower((auth.jwt() ->> 'email'))
)
with check (
  private.can_admin_workspace(workspace_id)
  or email = lower((auth.jwt() ->> 'email'))
);

do $$
begin
  alter publication supabase_realtime add table public.notion_workspaces;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

create or replace function public.invite_workspace_member_by_email(
  target_workspace_id uuid,
  target_email text,
  target_role text default 'editor'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invited_user_id uuid;
  normalized_email text := lower(trim(target_email));
begin
  if target_role not in ('admin', 'editor', 'viewer') then
    raise exception 'Invalid role';
  end if;

  if not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  ) then
    raise exception 'Only workspace owners or admins can invite members';
  end if;

  if normalized_email = '' then
    raise exception 'Email is required';
  end if;

  insert into public.workspace_invites (workspace_id, email, role, invited_by)
  values (target_workspace_id, normalized_email, target_role, auth.uid())
  on conflict (workspace_id, email)
  do update set role = excluded.role, invited_by = excluded.invited_by, accepted_at = null;

  select id into invited_user_id
  from public.profiles
  where email = normalized_email
  limit 1;

  if invited_user_id is not null then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (target_workspace_id, invited_user_id, target_role)
    on conflict (workspace_id, user_id) do update set role = excluded.role;

    update public.workspace_invites
    set accepted_at = coalesce(accepted_at, now())
    where workspace_id = target_workspace_id
      and email = normalized_email;
  end if;
end;
$$;

create or replace function public.accept_workspace_invites_for_current_user()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(coalesce((auth.jwt() ->> 'email'), ''));
  accepted_count integer := 0;
begin
  if auth.uid() is null or normalized_email = '' then
    return 0;
  end if;

  insert into public.profiles (id, email)
  values (auth.uid(), normalized_email)
  on conflict (id) do update set email = excluded.email;

  insert into public.workspace_members (workspace_id, user_id, role)
  select wi.workspace_id, auth.uid(), wi.role
  from public.workspace_invites wi
  where wi.email = normalized_email
  on conflict (workspace_id, user_id) do update set role = excluded.role;

  get diagnostics accepted_count = row_count;

  update public.workspace_invites
  set accepted_at = now()
  where email = normalized_email
    and accepted_at is null;

  return accepted_count;
end;
$$;

grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;
revoke all on function public.invite_workspace_member_by_email(uuid, text, text) from public;
grant execute on function public.invite_workspace_member_by_email(uuid, text, text) to authenticated;
revoke all on function public.accept_workspace_invites_for_current_user() from public;
grant execute on function public.accept_workspace_invites_for_current_user() to authenticated;

-- Project owner bootstrap. This keeps every existing workspace owned by Ee Wern,
-- regardless of editable workspace names.
do $$
declare
  owner_user_id uuid;
begin
  select id into owner_user_id
  from auth.users
  where lower(email) = 'eewern21@gmail.com'
  limit 1;

  if owner_user_id is not null then
    insert into public.profiles (id, email)
    values (owner_user_id, 'eewern21@gmail.com')
    on conflict (id) do update set email = excluded.email;

    update public.notion_workspaces
    set owner = owner_user_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    select id, owner_user_id, 'owner'
    from public.notion_workspaces
    on conflict (workspace_id, user_id)
    do update set role = 'owner';
  end if;
end;
$$;
