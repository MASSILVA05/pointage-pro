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

-- ============================================================
-- V2 : RH complète (heures, congés, paye) + sécurité renforcée
-- ============================================================
--
-- Décision de conception importante : le numéro de sécurité sociale et les
-- informations de paye (pay_type, hourly_rate, monthly_salary) NE SONT PAS
-- ajoutés à la table employees. RLS Postgres filtre des LIGNES, pas des
-- colonnes : il n'existe aucun moyen d'autoriser un employé à lire sa propre
-- ligne "employees" tout en lui masquant certaines colonnes via une policy,
-- surtout que owner et employé partagent le même rôle Postgres "authenticated"
-- (la distinction est purement applicative, pas au niveau rôle SQL). La seule
-- garantie robuste (pas juste un masquage côté interface) est de séparer ces
-- données dans une table dédiée dont AUCUNE policy n'autorise l'employé,
-- quelles que soient les colonnes demandées dans sa requête.

create table if not exists employee_payroll (
  employee_id uuid primary key references employees on delete cascade,
  org_id uuid not null references organizations on delete cascade,
  social_security_number text,
  pay_type text not null default 'hourly' check (pay_type in ('hourly', 'monthly')),
  hourly_rate numeric(10, 2),
  monthly_salary numeric(10, 2),
  updated_at timestamptz not null default now()
);

create index if not exists employee_payroll_org_id_idx on employee_payroll (org_id);

create table if not exists leaves (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees on delete cascade,
  org_id uuid not null references organizations on delete cascade,
  type text not null check (type in ('paid', 'sick', 'unpaid')),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists leaves_org_id_idx on leaves (org_id);
create index if not exists leaves_employee_id_idx on leaves (employee_id);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  actor_user_id uuid,
  action text not null,
  target_table text not null,
  target_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_org_id_idx on audit_log (org_id, created_at desc);

-- Choix explicite entrée/sortie (voir src/pages/EmployeePointer.jsx) : le
-- calcul des heures travaillées pair les pointages 'entrée'/'sortie' d'un
-- même jour, dans cet ordre, plutôt que de déduire le sens du pointage.
alter table pointages add column if not exists type text not null default 'entrée'
  check (type in ('entrée', 'sortie'));

-- ------------------------------------------------------------
-- Fonctions utilitaires supplémentaires
-- ------------------------------------------------------------

create or replace function is_org_owner(p_org_id uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from organizations where id = p_org_id and owner_user_id = auth.uid())
$$;
grant execute on function is_org_owner(uuid) to authenticated;

create or replace function is_own_employee(p_employee_id uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from employees where id = p_employee_id and user_id = auth.uid())
$$;
grant execute on function is_own_employee(uuid) to authenticated;

-- ------------------------------------------------------------
-- Audit : enregistre qui a modifié quoi sur les données employé.
-- Les triggers sont security definer pour pouvoir écrire dans audit_log
-- (aucune policy n'autorise authenticated à y insérer directement).
-- Le numéro de sécurité sociale n'est jamais recopié en clair dans le log.
-- ------------------------------------------------------------

create or replace function log_employee_created() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into audit_log (org_id, actor_user_id, action, target_table, target_id, details)
  values (
    new.org_id, auth.uid(), 'employee_created', 'employees', new.id,
    jsonb_build_object('first_name', new.first_name, 'last_name', new.last_name, 'phone', new.phone)
  );
  return new;
end;
$$;

drop trigger if exists trg_log_employee_created on employees;
create trigger trg_log_employee_created
  after insert on employees
  for each row execute function log_employee_created();

create or replace function log_payroll_change() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into audit_log (org_id, actor_user_id, action, target_table, target_id, details)
  values (
    new.org_id, auth.uid(),
    case when tg_op = 'INSERT' then 'payroll_created' else 'payroll_updated' end,
    'employee_payroll', new.employee_id,
    jsonb_build_object(
      'pay_type', new.pay_type,
      'hourly_rate', new.hourly_rate,
      'monthly_salary', new.monthly_salary,
      'ssn_set', new.social_security_number is not null
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_log_payroll_change on employee_payroll;
create trigger trg_log_payroll_change
  after insert or update on employee_payroll
  for each row execute function log_payroll_change();

create or replace function log_leave_status_change() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into audit_log (org_id, actor_user_id, action, target_table, target_id, details)
    values (
      new.org_id, auth.uid(), 'leave_status_changed', 'leaves', new.id,
      jsonb_build_object('type', new.type, 'old_status', old.status, 'new_status', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_leave_status_change on leaves;
create trigger trg_log_leave_status_change
  after update on leaves
  for each row execute function log_leave_status_change();

-- ------------------------------------------------------------
-- RLS : employee_payroll — accès manager uniquement, jamais l'employé,
-- quelles que soient les colonnes demandées.
-- ------------------------------------------------------------

alter table employee_payroll enable row level security;

create policy "Owner voit la paye de son organisation"
  on employee_payroll for select
  using (is_org_owner(org_id));

create policy "Owner crée les infos de paye"
  on employee_payroll for insert
  with check (is_org_owner(org_id));

create policy "Owner modifie les infos de paye"
  on employee_payroll for update
  using (is_org_owner(org_id))
  with check (is_org_owner(org_id));

-- ------------------------------------------------------------
-- RLS : leaves — le manager crée/approuve, l'employé voit seulement les siens.
-- ------------------------------------------------------------

alter table leaves enable row level security;

create policy "Owner voit les congés de son organisation"
  on leaves for select
  using (is_org_owner(org_id));

create policy "Employé voit ses propres congés"
  on leaves for select
  using (is_own_employee(employee_id));

create policy "Owner crée des congés"
  on leaves for insert
  with check (is_org_owner(org_id));

create policy "Owner approuve ou rejette les congés"
  on leaves for update
  using (is_org_owner(org_id))
  with check (is_org_owner(org_id));

-- ------------------------------------------------------------
-- RLS : audit_log — lecture manager uniquement, écriture réservée aux
-- triggers (security definer), aucune policy d'insertion pour le client.
-- ------------------------------------------------------------

alter table audit_log enable row level security;

create policy "Owner voit le journal d'audit de son organisation"
  on audit_log for select
  using (is_org_owner(org_id));

-- ============================================================
-- V3 : verrouillage de la création d'organisation, super_admin,
-- désactivation de client, durcissement de l'authentification
-- ============================================================
--
-- Un seul rôle peut désormais créer une organisation : super_admin (le
-- vendeur). Le formulaire d'inscription public a été supprimé côté client ;
-- la policy INSERT sur organizations empêche aussi toute tentative directe
-- via l'API. La création réelle passe par admin_create_client() ci-dessous,
-- qui crée l'auth.users du patron directement en SQL (avec mot de passe
-- temporaire) car cette opération nécessite des privilèges que le rôle
-- "authenticated" n'a jamais, quel que soit le compte.

alter table organizations add column if not exists active boolean not null default true;

create table if not exists super_admins (
  user_id uuid primary key references auth.users on delete cascade,
  phone text not null unique,
  created_at timestamptz not null default now()
);

create or replace function is_super_admin() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from super_admins where user_id = auth.uid())
$$;
grant execute on function is_super_admin() to authenticated;

-- is_org_owner / is_own_employee exigent désormais que l'organisation soit
-- active : même si banned_until (voir plus bas) n'était pas posé sur un
-- compte pour une raison quelconque, l'accès aux données resterait bloqué.
create or replace function is_org_owner(p_org_id uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from organizations where id = p_org_id and owner_user_id = auth.uid() and active = true)
$$;

create or replace function is_own_employee(p_employee_id uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from employees e
    join organizations o on o.id = e.org_id
    where e.id = p_employee_id and e.user_id = auth.uid() and o.active = true
  )
$$;

-- Utilisée côté employé pour afficher un message clair si son organisation
-- est désactivée, sans lui exposer le reste de la ligne organizations
-- (owner_phone, invite_token, etc.).
create or replace function get_my_org_status() returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('name', o.name, 'active', o.active)
  from employees e join organizations o on o.id = e.org_id
  where e.user_id = auth.uid()
  limit 1
$$;
grant execute on function get_my_org_status() to authenticated;

-- ------------------------------------------------------------
-- RLS : organizations — remplace la policy d'auto-inscription.
-- ------------------------------------------------------------

drop policy if exists "Création d'organisation à l'inscription" on organizations;
create policy "Seul un super admin crée une organisation"
  on organizations for insert
  with check (is_super_admin());

create policy "Super admin voit toutes les organisations"
  on organizations for select
  using (is_super_admin());

create policy "Super admin active ou désactive un client"
  on organizations for update
  using (is_super_admin())
  with check (is_super_admin());

-- ------------------------------------------------------------
-- RLS : super_admins
-- ------------------------------------------------------------

alter table super_admins enable row level security;

create policy "Un utilisateur sait s'il est super admin"
  on super_admins for select
  using (user_id = auth.uid());

-- ------------------------------------------------------------
-- Création de compte manager par le super admin (avec mot de passe
-- temporaire) et activation/désactivation d'un client.
--
-- banned_until (colonne native auth.users) est la protection principale :
-- GoTrue refuse l'authentification d'un compte banni au niveau du serveur
-- d'auth lui-même, pas seulement via nos policies RLS. On la pose sur le
-- patron ET tous ses employés à la désactivation.
-- ------------------------------------------------------------

create or replace function admin_create_client(
  p_org_name text, p_owner_name text, p_owner_phone text, p_seats integer, p_price numeric
) returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_phone text := regexp_replace(p_owner_phone, '\D', '', 'g');
  v_email text := v_phone || '@phone.pointage-pro.internal';
  v_user_id uuid;
  v_org_id uuid;
  v_password text;
begin
  if not is_super_admin() then
    raise exception 'Réservé au super administrateur';
  end if;

  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Ce numéro de téléphone est déjà utilisé par un autre compte';
  end if;

  -- Mot de passe temporaire lisible (évite les caractères ambigus), avec au
  -- moins une majuscule, une minuscule et un chiffre garantis par
  -- construction, pour rester cohérent avec la politique de robustesse.
  v_password := (
    select
      substr('ABCDEFGHJKLMNPQRSTUVWXYZ', ceil(random() * 24)::int, 1) ||
      substr('abcdefghjkmnpqrstuvwxyz', ceil(random() * 23)::int, 1) ||
      substr('23456789', ceil(random() * 8)::int, 1) ||
      string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789', ceil(random() * 57)::int, 1), '')
    from generate_series(1, 7)
  );

  v_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token,
    recovery_token, email_change_token_new, email_change, is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '',
    '', '', '', false, false
  );

  -- email est une colonne générée (à partir de identity_data) : on ne
  -- l'insère pas directement.
  insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  values (
    v_user_id::text, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now()
  );

  insert into organizations (name, owner_name, owner_phone, owner_user_id, active)
  values (p_org_name, p_owner_name, v_phone, v_user_id, true)
  returning id into v_org_id;

  insert into packs (org_id, seats, price, purchased_at)
  values (v_org_id, p_seats, p_price, now());

  insert into audit_log (org_id, actor_user_id, action, target_table, target_id, details)
  values (
    v_org_id, auth.uid(), 'client_created', 'organizations', v_org_id,
    jsonb_build_object('org_name', p_org_name, 'owner_phone', v_phone, 'seats', p_seats)
  );

  return jsonb_build_object('org_id', v_org_id, 'owner_phone', v_phone, 'temp_password', v_password);
end;
$$;
grant execute on function admin_create_client(text, text, text, integer, numeric) to authenticated;

create or replace function admin_set_org_active(p_org_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_ban timestamptz;
begin
  if not is_super_admin() then
    raise exception 'Réservé au super administrateur';
  end if;

  v_ban := case when p_active then null else 'infinity'::timestamptz end;

  update organizations set active = p_active where id = p_org_id;

  update auth.users set banned_until = v_ban
  where id = (select owner_user_id from organizations where id = p_org_id);

  update auth.users set banned_until = v_ban
  where id in (select user_id from employees where org_id = p_org_id and user_id is not null);

  insert into audit_log (org_id, actor_user_id, action, target_table, target_id, details)
  values (p_org_id, auth.uid(), case when p_active then 'client_reactivated' else 'client_deactivated' end, 'organizations', p_org_id, '{}'::jsonb);
end;
$$;
grant execute on function admin_set_org_active(uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- Verrouillage anti-bruteforce.
--
-- La protection robuste pour ça est le hook Auth "Password Verification
-- Attempt" : GoTrue l'appelle pour CHAQUE tentative de connexion, quel que
-- soit le client qui appelle l'API, donc impossible à contourner en
-- appelant directement l'endpoint d'auth. CE HOOK N'EST PAS DISPONIBLE sur
-- le plan Supabase gratuit de ce projet (rejeté par l'API Management :
-- "HOOK_PASSWORD_VERIFICATION_ATTEMPT cannot be configured for this
-- organization") — il nécessite un passage au plan Pro ou supérieur.
--
-- En attendant, ce verrou est appliqué au niveau applicatif : l'écran de
-- connexion appelle check_login_lockout() avant de tenter l'authentification
-- et record_login_result() après. LIMITE CONNUE, à corriger en activant le
-- hook une fois le plan payant actif : un script qui appellerait
-- directement l'API Supabase Auth avec la clé publique (en contournant
-- notre écran de connexion) contournerait ce verrou.
-- ------------------------------------------------------------

create table if not exists login_lockouts (
  identifier text primary key,
  failed_attempts integer not null default 0,
  locked_until timestamptz
);

create or replace function check_login_lockout(p_identifier text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_locked_until timestamptz;
begin
  select locked_until into v_locked_until from login_lockouts where identifier = p_identifier;
  if v_locked_until is not null and v_locked_until > now() then
    return jsonb_build_object('locked', true, 'retry_after', v_locked_until);
  end if;
  return jsonb_build_object('locked', false);
end;
$$;
grant execute on function check_login_lockout(text) to anon, authenticated;

create or replace function record_login_result(p_identifier text, p_success boolean) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_success then
    delete from login_lockouts where identifier = p_identifier;
  else
    insert into login_lockouts (identifier, failed_attempts, locked_until)
    values (p_identifier, 1, null)
    on conflict (identifier) do update set
      failed_attempts = login_lockouts.failed_attempts + 1,
      locked_until = case
        when login_lockouts.failed_attempts + 1 >= 5 then now() + interval '15 minutes'
        else login_lockouts.locked_until
      end;
  end if;
end;
$$;
grant execute on function record_login_result(text, boolean) to anon, authenticated;

-- ------------------------------------------------------------
-- RLS : login_lockouts — table de bookkeeping interne (identifiant =
-- téléphone normalisé + compteur d'échecs). Aucune policy : ni le manager
-- ni l'employé n'ont besoin d'y accéder directement, uniquement via
-- check_login_lockout()/record_login_result() ci-dessus (security definer,
-- même modèle que audit_log). RLS activée sans policy = accès refusé par
-- défaut à anon/authenticated via l'API REST.
-- ------------------------------------------------------------

alter table login_lockouts enable row level security;

-- ============================================================
-- V4 : champs paye algérienne (CNAS) + import Excel en masse
-- ============================================================
--
-- matricule, situation familiale, adresse, lieu de naissance, poste et
-- informations de contrat sont des champs d'identité/RH classiques : ils
-- restent sur employees, visibles par l'employé lui-même (comme birthdate
-- déjà) et par le manager.
--
-- cnas_fund, bank_account, bank_name, bank_branch et loan_balance sont des
-- données bancaires/financières : elles vont sur employee_payroll, la
-- même table déjà utilisée pour social_security_number et le salaire, qui
-- n'a AUCUNE policy RLS accordant l'accès à l'employé — même règle de
-- sécurité, appliquée par construction plutôt que par une nouvelle policy.

alter table employees
  add column if not exists matricule text,
  add column if not exists family_status text check (family_status in ('Marié', 'Célibataire', 'Divorcé', 'Veuf')),
  add column if not exists address text,
  add column if not exists birth_place text,
  add column if not exists job_title text,
  add column if not exists contract_type text check (contract_type in ('Permanent', 'Contractuel', 'CDD', 'CDI')),
  add column if not exists contract_start_date date,
  add column if not exists contract_end_date date,
  add column if not exists hire_date date,
  add column if not exists termination_date date,
  add column if not exists termination_reason text;

-- Unique par organisation (pas globalement) : deux clients différents
-- peuvent tout à fait utiliser le même schéma de matricules. NULL autorisé
-- et non contraint par l'unicité (comportement standard Postgres).
create unique index if not exists employees_org_matricule_idx on employees (org_id, matricule) where matricule is not null;

alter table employee_payroll
  add column if not exists cnas_fund text,
  add column if not exists bank_account text,
  add column if not exists bank_name text,
  add column if not exists bank_branch text,
  add column if not exists loan_balance numeric(12, 2);

-- ============================================================
-- V5 : téléphone optionnel à l'import Excel
-- ============================================================
--
-- L'import en masse ne doit plus bloquer une ligne pour absence de
-- téléphone (courant sur les listes RH existantes) : la fiche est créée en
-- 'pending' comme les autres, simplement sans possibilité d'invitation
-- (check_pending_employee/l'activation par téléphone) tant qu'un téléphone
-- n'est pas ajouté manuellement. La contrainte unique sur phone reste en
-- place ; Postgres autorise nativement plusieurs NULL sous une contrainte
-- unique (NULL n'est jamais égal à NULL), donc aucune ligne supplémentaire
-- n'est nécessaire pour ça.
alter table employees alter column phone drop not null;

-- Édition d'une fiche employé par le manager (ex : ajouter le téléphone
-- manquant d'un employé importé sans, pour pouvoir ensuite l'inviter). Cette
-- policy n'existait pas jusqu'ici : la seule policy UPDATE sur employees
-- était réservée à l'auto-activation de l'employé via son téléphone (voir
-- ci-dessus), pas au manager. Alignée sur is_org_owner() comme les policies
-- UPDATE plus récentes (leaves, employee_payroll) pour bénéficier du
-- verrouillage "organisation active" au lieu de la sous-requête brute
-- utilisée par les policies SELECT/INSERT historiques d'employees.
create policy "Owner modifie les employés de son organisation"
  on employees for update
  using (is_org_owner(org_id))
  with check (is_org_owner(org_id));

-- check_pending_employee filtrait status='pending' directement dans la
-- requête : un téléphone correspondant à un employé déjà 'active' (compte
-- déjà créé) renvoyait 0 ligne, exactement comme un téléphone inconnu — le
-- message affiché côté client ("numéro non enregistré") était donc ambigu
-- et trompeur dans ce cas précis. On retire le filtre et on renvoie le
-- statut : la page d'invitation distingue maintenant "numéro inconnu" de
-- "compte déjà activé". Signature de retour changée (colonne status en
-- plus) : DROP obligatoire, CREATE OR REPLACE seul refuse de changer le
-- type de retour d'une fonction existante.
drop function if exists check_pending_employee(uuid, text);

create function check_pending_employee(p_org_id uuid, p_phone text)
returns table(id uuid, first_name text, status text)
language sql stable security definer set search_path = public
as $$
  select id, first_name, status from employees
  where org_id = p_org_id and phone = p_phone
$$;
grant execute on function check_pending_employee(uuid, text) to anon, authenticated;
