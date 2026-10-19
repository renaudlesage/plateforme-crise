-- Console Plateforme (apps/plateforme) : gestion des clients, des utilisateurs
-- et supervision, réservée au super-admin (admin du contexte « plateforme »).
--
-- Contenu :
--   1. Suspension d'un client (contextes.suspendu) : un client suspendu n'est
--      plus accessible à ses membres (mon_niveau_acces renvoie null) ; le
--      super-admin garde la main via a_capacite / les fonctions ci-dessous.
--   2. Journal de la plateforme (journal_plateforme) : ajout seul, alimenté
--      uniquement par les fonctions plateforme_*.
--   3. Fonctions plateforme_* (security definer, refusent tout appelant qui
--      n'est pas super-admin).
-- Ajout seul : aucune fonction existante n'est supprimée (lister_clients_v2,
-- creer_client, renommer_client restent utilisables).

-- 1. Suspension -------------------------------------------------------------

alter table public.contextes
  add column if not exists suspendu boolean not null default false,
  add column if not exists suspendu_le timestamptz,
  add column if not exists motif_suspension text,
  add column if not exists notes_plateforme text;

alter table public.contextes
  drop constraint if exists contextes_plateforme_non_suspendu;
alter table public.contextes
  add constraint contextes_plateforme_non_suspendu check (not (est_plateforme and suspendu));

create or replace function public.mon_niveau_acces(p_contexte_id uuid)
 returns text
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select au.niveau_acces
  from acces_utilisateurs au
  join contextes c on c.id = au.contexte_id
  where au.user_id = auth.uid()
    and au.contexte_id = p_contexte_id
    and not c.suspendu
  limit 1;
$function$;

-- 2. Journal ----------------------------------------------------------------

create table if not exists public.journal_plateforme (
  id uuid primary key default gen_random_uuid(),
  acteur_id uuid references auth.users(id) on delete set null,
  acteur_email text,
  action text not null,
  cible_type text not null check (cible_type in ('client', 'utilisateur', 'acces')),
  cible_id uuid,
  cible_libelle text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists journal_plateforme_created_at_idx on public.journal_plateforme (created_at desc);

alter table public.journal_plateforme enable row level security;

drop policy if exists "super-admin lit le journal plateforme" on public.journal_plateforme;
create policy "super-admin lit le journal plateforme" on public.journal_plateforme
  for select using (public.est_super_admin());
-- Pas de policy d'écriture : seules les fonctions security definer écrivent.

create or replace function public.plateforme_journaliser(
  p_action text, p_cible_type text, p_cible_id uuid, p_cible_libelle text, p_details jsonb default '{}'::jsonb
) returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  insert into journal_plateforme (acteur_id, acteur_email, action, cible_type, cible_id, cible_libelle, details)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), p_action, p_cible_type, p_cible_id, p_cible_libelle, coalesce(p_details, '{}'::jsonb));
$function$;

revoke all on function public.plateforme_journaliser(text, text, uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.plateforme_exiger_super_admin()
 returns void
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not est_super_admin() then
    raise exception 'Accès refusé : droits de super-administrateur requis' using errcode = '42501';
  end if;
end;
$function$;

-- 3. Clients ----------------------------------------------------------------

create or replace function public.plateforme_lister_clients()
 returns table(
   id uuid, type text, sous_type_territorial text, nom text, province text,
   created_at timestamptz, est_plateforme boolean, suspendu boolean, suspendu_le timestamptz,
   motif_suspension text, notes_plateforme text,
   nb_membres bigint, nb_admins bigint, nb_incidents_actifs bigint, derniere_activite timestamptz
 )
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  perform plateforme_exiger_super_admin();
  return query
  select c.id, c.type, c.sous_type_territorial, c.nom, c.province,
         c.created_at, c.est_plateforme, c.suspendu, c.suspendu_le,
         c.motif_suspension, c.notes_plateforme,
         (select count(*) from acces_utilisateurs au where au.contexte_id = c.id),
         (select count(*) from acces_utilisateurs au where au.contexte_id = c.id and au.niveau_acces = 'admin'),
         (select count(*) from incidents i where i.contexte_id = c.id and i.statut <> 'cloture'),
         (select max(u.last_sign_in_at) from acces_utilisateurs au join auth.users u on u.id = au.user_id where au.contexte_id = c.id)
  from contextes c
  order by c.est_plateforme desc, c.nom;
end;
$function$;

create or replace function public.plateforme_creer_client(
  p_type text, p_nom text, p_sous_type_territorial text default null,
  p_province text default null, p_me_rattacher boolean default true
) returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  perform plateforme_exiger_super_admin();
  if coalesce(btrim(p_nom), '') = '' then
    raise exception 'Le nom du client est requis';
  end if;

  insert into contextes (type, nom, sous_type_territorial, province)
  values (p_type, btrim(p_nom), p_sous_type_territorial, nullif(p_province, ''))
  returning id into v_id;

  if p_me_rattacher then
    insert into acces_utilisateurs (user_id, contexte_id, niveau_acces) values (auth.uid(), v_id, 'admin');
  end if;

  perform plateforme_journaliser('client_cree', 'client', v_id, btrim(p_nom),
    jsonb_build_object('type', p_type, 'sous_type_territorial', p_sous_type_territorial, 'province', p_province, 'createur_rattache', p_me_rattacher));
  return v_id;
end;
$function$;

create or replace function public.plateforme_modifier_client(
  p_contexte_id uuid, p_nom text, p_type text, p_sous_type_territorial text,
  p_province text, p_notes_plateforme text
) returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_avant contextes%rowtype;
begin
  perform plateforme_exiger_super_admin();
  select * into v_avant from contextes where id = p_contexte_id;
  if not found then raise exception 'Client introuvable'; end if;
  if coalesce(btrim(p_nom), '') = '' then raise exception 'Le nom du client est requis'; end if;

  update contextes
     set nom = btrim(p_nom),
         type = p_type,
         sous_type_territorial = p_sous_type_territorial,
         province = nullif(p_province, ''),
         notes_plateforme = nullif(btrim(coalesce(p_notes_plateforme, '')), '')
   where id = p_contexte_id;

  perform plateforme_journaliser('client_modifie', 'client', p_contexte_id, btrim(p_nom),
    jsonb_build_object(
      'avant', jsonb_build_object('nom', v_avant.nom, 'type', v_avant.type, 'sous_type_territorial', v_avant.sous_type_territorial, 'province', v_avant.province),
      'apres', jsonb_build_object('nom', btrim(p_nom), 'type', p_type, 'sous_type_territorial', p_sous_type_territorial, 'province', nullif(p_province, ''))));
end;
$function$;

create or replace function public.plateforme_suspendre_client(p_contexte_id uuid, p_suspendu boolean, p_motif text default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_client contextes%rowtype;
begin
  perform plateforme_exiger_super_admin();
  select * into v_client from contextes where id = p_contexte_id;
  if not found then raise exception 'Client introuvable'; end if;
  if v_client.est_plateforme then raise exception 'Le contexte plateforme ne peut pas être suspendu'; end if;

  update contextes
     set suspendu = p_suspendu,
         suspendu_le = case when p_suspendu then now() else null end,
         motif_suspension = case when p_suspendu then nullif(btrim(coalesce(p_motif, '')), '') else null end
   where id = p_contexte_id;

  perform plateforme_journaliser(case when p_suspendu then 'client_suspendu' else 'client_reactive' end,
    'client', p_contexte_id, v_client.nom, jsonb_build_object('motif', p_motif));
end;
$function$;

-- 4. Utilisateurs et accès --------------------------------------------------

create or replace function public.plateforme_lister_utilisateurs()
 returns table(
   user_id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz,
   invitation_en_attente boolean, desactive boolean, est_super_admin boolean, acces jsonb
 )
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  perform plateforme_exiger_super_admin();
  return query
  select u.id, u.email::text, u.created_at, u.last_sign_in_at,
         (u.invited_at is not null and u.last_sign_in_at is null),
         (u.banned_until is not null and u.banned_until > now()),
         exists (select 1 from acces_utilisateurs au join contextes c on c.id = au.contexte_id
                 where au.user_id = u.id and c.est_plateforme and au.niveau_acces = 'admin'),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'acces_id', au.id, 'contexte_id', c.id, 'contexte_nom', c.nom,
                    'est_plateforme', c.est_plateforme, 'niveau_acces', au.niveau_acces,
                    'role_id', au.role_id, 'role_libelle', r.libelle) order by c.nom)
           from acces_utilisateurs au
           join contextes c on c.id = au.contexte_id
           left join roles r on r.id = au.role_id
           where au.user_id = u.id), '[]'::jsonb)
  from auth.users u
  order by u.email;
end;
$function$;

create or replace function public.plateforme_membres_client(p_contexte_id uuid)
 returns table(acces_id uuid, user_id uuid, email text, role_id uuid, role_libelle text, niveau_acces text, last_sign_in_at timestamptz)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  perform plateforme_exiger_super_admin();
  return query
  select au.id, au.user_id, u.email::text, au.role_id, r.libelle, au.niveau_acces, u.last_sign_in_at
  from acces_utilisateurs au
  join auth.users u on u.id = au.user_id
  left join roles r on r.id = au.role_id
  where au.contexte_id = p_contexte_id
  order by u.email;
end;
$function$;

create or replace function public.plateforme_roles_client(p_contexte_id uuid)
 returns table(id uuid, code text, libelle text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  perform plateforme_exiger_super_admin();
  return query select r.id, r.code, r.libelle from roles r where r.contexte_id = p_contexte_id order by r.libelle;
end;
$function$;

-- Garde-fou commun : il doit toujours rester au moins un super-admin.
create or replace function public.plateforme_reste_un_super_admin(p_sauf_acces_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from acces_utilisateurs au
    join contextes c on c.id = au.contexte_id
    join auth.users u on u.id = au.user_id
    where c.est_plateforme and au.niveau_acces = 'admin' and au.id <> p_sauf_acces_id
      and (u.banned_until is null or u.banned_until <= now())
  );
$function$;

revoke all on function public.plateforme_reste_un_super_admin(uuid) from public, anon, authenticated;

create or replace function public.plateforme_definir_acces(
  p_user_id uuid, p_contexte_id uuid, p_niveau_acces text, p_role_id uuid default null
) returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_acces acces_utilisateurs%rowtype;
  v_id uuid;
  v_client contextes%rowtype;
  v_email text;
begin
  perform plateforme_exiger_super_admin();
  select * into v_client from contextes where id = p_contexte_id;
  if not found then raise exception 'Client introuvable'; end if;
  select email into v_email from auth.users where id = p_user_id;
  if v_email is null then raise exception 'Utilisateur introuvable'; end if;
  if p_role_id is not null and not exists (select 1 from roles where id = p_role_id and contexte_id = p_contexte_id) then
    raise exception 'Ce rôle n''appartient pas à ce client';
  end if;

  select * into v_acces from acces_utilisateurs where user_id = p_user_id and contexte_id = p_contexte_id;
  if found and v_client.est_plateforme and v_acces.niveau_acces = 'admin' and p_niveau_acces <> 'admin'
     and not plateforme_reste_un_super_admin(v_acces.id) then
    raise exception 'Impossible : ce compte est le dernier super-administrateur actif';
  end if;

  insert into acces_utilisateurs (user_id, contexte_id, niveau_acces, role_id)
  values (p_user_id, p_contexte_id, p_niveau_acces, p_role_id)
  on conflict (user_id, contexte_id) do update set niveau_acces = excluded.niveau_acces, role_id = excluded.role_id
  returning id into v_id;

  perform plateforme_journaliser(case when v_acces.id is null then 'acces_donne' else 'acces_modifie' end,
    'acces', v_id, v_email || ' → ' || v_client.nom,
    jsonb_build_object('user_id', p_user_id, 'contexte_id', p_contexte_id,
      'niveau_avant', v_acces.niveau_acces, 'niveau_apres', p_niveau_acces, 'role_id', p_role_id));
  return v_id;
end;
$function$;

create or replace function public.plateforme_retirer_acces(p_acces_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_acces acces_utilisateurs%rowtype;
  v_client contextes%rowtype;
  v_email text;
begin
  perform plateforme_exiger_super_admin();
  select * into v_acces from acces_utilisateurs where id = p_acces_id;
  if not found then raise exception 'Accès introuvable'; end if;
  select * into v_client from contextes where id = v_acces.contexte_id;
  select email into v_email from auth.users where id = v_acces.user_id;

  if v_client.est_plateforme and v_acces.niveau_acces = 'admin' and not plateforme_reste_un_super_admin(p_acces_id) then
    raise exception 'Impossible : ce compte est le dernier super-administrateur actif';
  end if;

  delete from acces_utilisateurs where id = p_acces_id;

  perform plateforme_journaliser('acces_retire', 'acces', p_acces_id, v_email || ' → ' || v_client.nom,
    jsonb_build_object('user_id', v_acces.user_id, 'contexte_id', v_acces.contexte_id, 'niveau', v_acces.niveau_acces));
end;
$function$;

-- Désactivation d'un compte : banned_until bloque toute nouvelle connexion et
-- le renouvellement de session (le jeton en cours expire au plus tard dans l'heure).
create or replace function public.plateforme_desactiver_utilisateur(p_user_id uuid, p_desactive boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_email text;
  v_acces_plateforme uuid;
begin
  perform plateforme_exiger_super_admin();
  select email into v_email from auth.users where id = p_user_id;
  if v_email is null then raise exception 'Utilisateur introuvable'; end if;

  if p_desactive then
    if p_user_id = auth.uid() then raise exception 'Vous ne pouvez pas désactiver votre propre compte'; end if;
    select au.id into v_acces_plateforme from acces_utilisateurs au join contextes c on c.id = au.contexte_id
     where au.user_id = p_user_id and c.est_plateforme and au.niveau_acces = 'admin';
    if v_acces_plateforme is not null and not plateforme_reste_un_super_admin(v_acces_plateforme) then
      raise exception 'Impossible : ce compte est le dernier super-administrateur actif';
    end if;
  end if;

  update auth.users
     set banned_until = case when p_desactive then 'infinity'::timestamptz else null end
   where id = p_user_id;

  perform plateforme_journaliser(case when p_desactive then 'utilisateur_desactive' else 'utilisateur_reactive' end,
    'utilisateur', p_user_id, v_email, '{}'::jsonb);
end;
$function$;

-- 5. Supervision ------------------------------------------------------------

create or replace function public.plateforme_statistiques()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  perform plateforme_exiger_super_admin();
  return jsonb_build_object(
    'nb_clients', (select count(*) from contextes where not est_plateforme),
    'nb_clients_suspendus', (select count(*) from contextes where suspendu),
    'clients_par_type', coalesce((select jsonb_object_agg(t, n) from (
        select coalesce(sous_type_territorial, type) t, count(*) n from contextes where not est_plateforme group by 1) x), '{}'::jsonb),
    'nb_utilisateurs', (select count(*) from auth.users),
    'nb_utilisateurs_actifs_30j', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'nb_invitations_en_attente', (select count(*) from auth.users where invited_at is not null and last_sign_in_at is null),
    'nb_utilisateurs_sans_acces', (select count(*) from auth.users u where not exists (select 1 from acces_utilisateurs au where au.user_id = u.id)),
    'nb_clients_sans_admin', (select count(*) from contextes c where not c.est_plateforme
        and not exists (select 1 from acces_utilisateurs au where au.contexte_id = c.id and au.niveau_acces = 'admin')),
    'incidents_actifs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'nom', i.nom, 'contexte_id', c.id, 'contexte_nom', c.nom, 'statut', i.statut,
        'phase_cycle_vie', i.phase_cycle_vie, 'degre_criticite', i.degre_criticite,
        'date_debut', i.date_debut, 'est_exercice', i.est_exercice) order by i.date_debut desc)
      from incidents i join contextes c on c.id = i.contexte_id
      where i.statut <> 'cloture'), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.plateforme_journal(p_limite integer default 100, p_cible_id uuid default null)
 returns setof public.journal_plateforme
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  perform plateforme_exiger_super_admin();
  return query
  select * from journal_plateforme j
  where p_cible_id is null or j.cible_id = p_cible_id
     or (j.details ->> 'contexte_id')::uuid = p_cible_id
     or (j.details ->> 'user_id')::uuid = p_cible_id
  order by j.created_at desc
  limit least(greatest(coalesce(p_limite, 100), 1), 500);
end;
$function$;

revoke all on function public.plateforme_exiger_super_admin() from public, anon;
grant execute on function
  public.plateforme_exiger_super_admin(),
  public.plateforme_lister_clients(),
  public.plateforme_creer_client(text, text, text, text, boolean),
  public.plateforme_modifier_client(uuid, text, text, text, text, text),
  public.plateforme_suspendre_client(uuid, boolean, text),
  public.plateforme_lister_utilisateurs(),
  public.plateforme_membres_client(uuid),
  public.plateforme_roles_client(uuid),
  public.plateforme_definir_acces(uuid, uuid, text, uuid),
  public.plateforme_retirer_acces(uuid),
  public.plateforme_desactiver_utilisateur(uuid, boolean),
  public.plateforme_statistiques(),
  public.plateforme_journal(integer, uuid)
to authenticated;
