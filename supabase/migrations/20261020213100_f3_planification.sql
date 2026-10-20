-- F3 Planification : pg_cron et pg_net (Supabase Cron) pour lancer les Edge
-- Functions à intervalle, et jobs_etat pour repérer une tâche ou un flux muet.
--
-- Contenu :
--   1. Extensions pg_net (schéma extensions) et pg_cron (schéma cron).
--   2. jobs_etat : une ligne par tâche planifiée (dernier lancement, dernier
--      succès, dernière erreur, échecs consécutifs, silence toléré). Chaque
--      chantier déclare ses tâches dans sa propre migration (C1 d'abord).
--   3. jobs_signaler(nom, succes, erreur) : appelée par la tâche elle-même (clé
--      de service ou SQL planifié) ; jobs_muets() : tâches actives sans succès
--      depuis plus longtemps que leur silence toléré.
-- Aucune tâche n'est planifiée ici ; le Vault reste vide jusqu'à C1.

-- 1. Extensions -------------------------------------------------------------------

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- 2. jobs_etat --------------------------------------------------------------------

create table if not exists public.jobs_etat (
  nom text primary key check (nom ~ '^[a-z0-9_]{3,60}$'),
  description text not null default '',
  contexte_id uuid references public.contextes(id) on delete cascade,
  silence_max interval not null default interval '1 hour' check (silence_max > interval '0'),
  actif boolean not null default true,
  dernier_lancement_le timestamptz,
  dernier_succes_le timestamptz,
  derniere_erreur_le timestamptz,
  derniere_erreur text,
  echecs_consecutifs integer not null default 0,
  cree_le timestamptz not null default now()
);

comment on table public.jobs_etat is 'État des tâches planifiées (F3) ; une tâche muette se repère par jobs_muets().';
comment on column public.jobs_etat.contexte_id is 'null : tâche de la plateforme, commune à tous les clients';
comment on column public.jobs_etat.silence_max is 'Durée sans succès au-delà de laquelle la tâche est considérée muette';

alter table public.jobs_etat enable row level security;
revoke all on public.jobs_etat from public, anon, authenticated;
grant select on public.jobs_etat to authenticated;

-- Écriture uniquement par les migrations et par jobs_signaler.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'jobs_etat' and policyname = 'lecture super-admin ou membre du contexte'
  ) then
    create policy "lecture super-admin ou membre du contexte" on public.jobs_etat
      for select to authenticated
      using (est_super_admin() or (contexte_id is not null and a_acces(contexte_id, 'lecture')));
  end if;
end $$;

-- 3. Fonctions --------------------------------------------------------------------

create or replace function public.jobs_signaler(p_nom text, p_succes boolean, p_erreur text default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  update jobs_etat set
    dernier_lancement_le = now(),
    dernier_succes_le = case when p_succes then now() else dernier_succes_le end,
    derniere_erreur_le = case when p_succes then derniere_erreur_le else now() end,
    derniere_erreur = case when p_succes then derniere_erreur else left(coalesce(p_erreur, 'Erreur non précisée'), 2000) end,
    echecs_consecutifs = case when p_succes then 0 else echecs_consecutifs + 1 end
  where nom = p_nom;
  if not found then
    raise exception 'Tâche planifiée inconnue : %', p_nom using errcode = 'P0002';
  end if;
end;
$function$;

revoke all on function public.jobs_signaler(text, boolean, text) from public, anon, authenticated;
grant execute on function public.jobs_signaler(text, boolean, text) to service_role;

-- Droits de l'appelant : le super-admin voit toutes les tâches, un membre celles de sa commune.
create or replace function public.jobs_muets()
 returns table(nom text, description text, contexte_id uuid, dernier_succes_le timestamptz,
               silence interval, derniere_erreur text, echecs_consecutifs integer)
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  select j.nom, j.description, j.contexte_id, j.dernier_succes_le,
         now() - coalesce(j.dernier_succes_le, j.cree_le), j.derniere_erreur, j.echecs_consecutifs
  from jobs_etat j
  where j.actif and now() - coalesce(j.dernier_succes_le, j.cree_le) > j.silence_max
  order by 5 desc;
$function$;

revoke all on function public.jobs_muets() from public, anon;
grant execute on function public.jobs_muets() to authenticated, service_role;
