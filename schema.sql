-- Schéma Supabase : Pointage Pro (SaaS multi-organisations)
-- À exécuter dans l'éditeur SQL de Supabase (Database > SQL Editor)
--
-- Auth : Supabase Auth n'offre pas nativement le téléphone+mot de passe sans
-- fournisseur SMS. On simule ça côté client avec un email interne dérivé du
-- téléphone (voir src/lib/phone.js), jamais affiché à l'utilisateur. Le vrai
-- numéro est stocké dans nos tables. current_phone() ci-dessous permet aux
-- policies RLS de retrouver le téléphone de l'utilisateur connecté.

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text not null,
  owner_phone text not null,
  owner_user_id uuid not null references auth.users on delete cascade,
  invite_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create unique index if not exists organizations_owner_user_id_idx on organizations (owner_user_id);
create unique index if not exists organizations_invite_token_idx on organizations (invite_token);

create table if not exists packs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  seats integer not null check (seats > 0),
  price numeric(10, 2),
  purchased_at timestamptz not null default now()
);

create index if not exists packs_org_id_idx on packs (org_id);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  first_name text not null,
  last_name text not null,
  birthdate date,
  phone text not null unique,
  status text not null default 'pending' check (status in ('pending', 'active')),
  user_id uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists employees_org_id_idx on employees (org_id);
create unique index if not exists employees_user_id_idx on employees (user_id) where user_id is not null;

create table if not exists pointages (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees on delete cascade,
  org_id uuid not null references organizations on delete cascade,
  time timestamptz not null default now(),
  lat double precision not null,
  lon double precision not null,
  photo_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists pointages_org_id_time_idx on pointages (org_id, time desc);
create index if not exists pointages_employee_id_idx on pointages (employee_id);

-- ============================================================
-- Fonctions utilitaires
-- ============================================================

-- Téléphone de l'utilisateur connecté, extrait de son email interne
-- (partie locale avant le @, voir phoneToEmail côté client).
create or replace function current_phone() returns text
language sql stable
as $$
  select split_part(coalesce((auth.jwt() ->> 'email'), ''), '@', 1)
$$;

-- Infos publiques d'une organisation à partir de son lien d'invitation,
-- sans exposer le reste (owner_phone, etc.) à un visiteur non authentifié.
create or replace function get_org_by_invite_token(p_token uuid)
returns table(id uuid, name text)
language sql stable security definer set search_path = public
as $$
  select id, name from organizations where invite_token = p_token
$$;
grant execute on function get_org_by_invite_token(uuid) to anon, authenticated;

-- Vérifie qu'un téléphone correspond à un employé pré-enregistré (pending)
-- de cette organisation, sans exposer la liste complète des employés.
create or replace function check_pending_employee(p_org_id uuid, p_phone text)
returns table(id uuid, first_name text)
language sql stable security definer set search_path = public
as $$
  select id, first_name from employees
  where org_id = p_org_id and phone = p_phone and status = 'pending'
$$;
grant execute on function check_pending_employee(uuid, text) to anon, authenticated;

-- Empêche d'ajouter plus d'employés que de places achetées (défense en
-- profondeur en plus de la vérification côté client).
create or replace function check_employee_quota() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  seats_total integer;
  employees_count integer;
begin
  select coalesce(sum(seats), 0) into seats_total from packs where org_id = new.org_id;
  select count(*) into employees_count from employees where org_id = new.org_id;
  if employees_count >= seats_total then
    raise exception 'Quota de places atteint pour cette organisation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_employee_quota on employees;
create trigger trg_check_employee_quota
  before insert on employees
  for each row execute function check_employee_quota();

-- Force org_id à correspondre à l'employé réel : le client ne peut pas
-- pointer pour le compte d'une autre organisation.
create or replace function set_pointage_org() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  select org_id into new.org_id from employees where id = new.employee_id;
  return new;
end;
$$;

drop trigger if exists trg_set_pointage_org on pointages;
create trigger trg_set_pointage_org
  before insert on pointages
  for each row execute function set_pointage_org();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table organizations enable row level security;
alter table packs enable row level security;
alter table employees enable row level security;
alter table pointages enable row level security;

-- organizations
create policy "Owner voit son organisation"
  on organizations for select
  using (owner_user_id = auth.uid());

create policy "Création d'organisation à l'inscription"
  on organizations for insert
  with check (owner_user_id = auth.uid());

-- packs
create policy "Owner voit ses packs"
  on packs for select
  using (org_id in (select id from organizations where owner_user_id = auth.uid()));

create policy "Owner achète un pack"
  on packs for insert
  with check (org_id in (select id from organizations where owner_user_id = auth.uid()));

-- employees
create policy "Owner voit les employés de son organisation"
  on employees for select
  using (org_id in (select id from organizations where owner_user_id = auth.uid()));

create policy "Employé voit sa propre fiche"
  on employees for select
  using (user_id = auth.uid());

-- Nécessaire en plus de la policy UPDATE ci-dessous : PostgREST exige que la
-- ligne soit visible via une policy SELECT pour pouvoir la cibler en UPDATE,
-- la clause USING de la policy UPDATE seule ne suffit pas.
create policy "Employé voit sa fiche en attente via son téléphone"
  on employees for select
  using (status = 'pending' and user_id is null and phone = current_phone());

create policy "Owner ajoute des employés à son organisation"
  on employees for insert
  with check (org_id in (select id from organizations where owner_user_id = auth.uid()));

create policy "Employé réclame sa fiche pré-enregistrée via son téléphone"
  on employees for update
  using (status = 'pending' and user_id is null)
  with check (user_id = auth.uid() and phone = current_phone() and status = 'active');

-- pointages
create policy "Owner voit les pointages de son organisation"
  on pointages for select
  using (org_id in (select id from organizations where owner_user_id = auth.uid()));

create policy "Employé pointe pour lui-même"
  on pointages for insert
  with check (employee_id in (select id from employees where user_id = auth.uid()));

-- ============================================================
-- Storage : bucket public pour les photos de pointage
-- ============================================================

insert into storage.buckets (id, name, public)
values ('pointage-photos', 'pointage-photos', true)
on conflict (id) do nothing;

create policy "Lecture publique des photos de pointage"
  on storage.objects for select
  using (bucket_id = 'pointage-photos');

create policy "Upload de photos par les utilisateurs connectés"
  on storage.objects for insert
  with check (bucket_id = 'pointage-photos' and auth.role() = 'authenticated');
