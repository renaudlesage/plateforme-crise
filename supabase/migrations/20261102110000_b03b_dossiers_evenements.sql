-- Briefing 03, partie B — réception du dossier de sécurité d'un événement (contrat du briefing 01, Eventware).
--
-- 1. sources_externes_alertes.objets : ce qu'une source jumelée peut envoyer ('alerte', 'dossier').
--    Les sources existantes gardent 'alerte' seul : un dossier n'est accepté que d'une source qui le déclare.
-- 2. evenements_territoire : un événement proposé par un organisateur (dossier reçu sans événement suivi
--    correspondant) est créé inactif, « à examiner » ; la commune l'accepte ou le rejette
--    (decider_evenement_propose). Inactif, il ne reçoit aucune émission du pont.
-- 3. evenements_territoire_dossiers : dernier état connu de chaque dossier (statut, version, niveau DMP,
--    fréquentation, lien de consultation). Lecture par les seuls membres de la commune (a_acces) ; écriture
--    par recevoir_dossier_evenement() seule, appelée par l'Edge Function ingestion-dossier-evenement avec la
--    clé de service. Une version déjà reçue (ou plus ancienne) est sans effet.
-- 4. journal_ingestions_externes : objet reçu et dossier concerné. Le lien de consultation (jeton d'accès)
--    n'est jamais recopié dans le journal : l'Edge Function le masque avant journalisation.

-- 1. Sources --------------------------------------------------------------------------------------

alter table public.sources_externes_alertes
  add column if not exists objets text[] not null default '{alerte}';
alter table public.sources_externes_alertes
  add constraint sources_externes_alertes_objets_check
    check (cardinality(objets) >= 1 and objets <@ array['alerte', 'dossier']);

-- 2. Événements proposés par un organisateur ----------------------------------------------------

alter table public.evenements_territoire
  add column if not exists propose_par_organisateur boolean not null default false,
  add column if not exists statut_proposition text,
  add column if not exists decision_proposition_par uuid references auth.users(id) on delete set null,
  add column if not exists decision_proposition_le timestamptz;
alter table public.evenements_territoire
  add constraint evenements_territoire_statut_proposition_check
    check (statut_proposition is null or statut_proposition in ('a_examiner', 'accepte', 'rejete')),
  add constraint evenements_territoire_proposition_coherente
    check (propose_par_organisateur = (statut_proposition is not null));

-- Un événement proposé n'est suivi qu'après acceptation : ni la création ni une modification ne l'activent.
create or replace function public.evenements_territoire_proposition_garde()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_decision boolean := coalesce(current_setting('crisiware.decision_evenement', true), '') = 'on';
begin
  if tg_op = 'UPDATE' and not v_decision and (
       new.propose_par_organisateur is distinct from old.propose_par_organisateur
       or new.statut_proposition is distinct from old.statut_proposition
       or new.decision_proposition_par is distinct from old.decision_proposition_par
       or new.decision_proposition_le is distinct from old.decision_proposition_le) then
    raise exception 'La décision sur un événement proposé passe par « Accepter » ou « Rejeter »';
  end if;
  if new.statut_proposition in ('a_examiner', 'rejete') and new.actif then
    raise exception 'Événement proposé par un organisateur : acceptez-le avant de le suivre';
  end if;
  return new;
end;
$function$;

revoke all on function public.evenements_territoire_proposition_garde() from public, anon, authenticated;

create or replace trigger evenements_territoire_proposition_garde_trg
  before insert or update on public.evenements_territoire
  for each row execute function public.evenements_territoire_proposition_garde();

create or replace function public.decider_evenement_propose(p_evenement uuid, p_accepter boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_e evenements_territoire%rowtype;
begin
  select * into v_e from evenements_territoire where id = p_evenement for update;
  if not found or not a_capacite(v_e.contexte_id, 'communication', 'modifier') then
    raise exception 'Accès refusé';
  end if;
  if v_e.statut_proposition is distinct from 'a_examiner' then
    raise exception 'Cet événement n''attend pas de décision';
  end if;
  perform set_config('crisiware.decision_evenement', 'on', true);
  update evenements_territoire
     set statut_proposition = case when p_accepter then 'accepte' else 'rejete' end,
         actif = p_accepter,
         decision_proposition_par = auth.uid(),
         decision_proposition_le = now()
   where id = p_evenement;
  perform set_config('crisiware.decision_evenement', 'off', true);
end;
$function$;

revoke all on function public.decider_evenement_propose(uuid, boolean) from public, anon;
grant execute on function public.decider_evenement_propose(uuid, boolean) to authenticated;

-- 3. Dossiers ----------------------------------------------------------------------------------------

create table if not exists public.evenements_territoire_dossiers (
  id uuid primary key default gen_random_uuid(),
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  evenement_territoire_id uuid not null references public.evenements_territoire(id) on delete cascade,
  reference uuid not null,
  version integer not null check (version >= 1),
  statut text not null check (statut in ('depose', 'en_instruction', 'autorise', 'refuse', 'retire')),
  niveau_dmp smallint check (niveau_dmp is null or niveau_dmp between 1 and 5),
  frequentation_max integer check (frequentation_max is null or frequentation_max >= 0),
  lien_consultation text check (lien_consultation is null or (char_length(lien_consultation) <= 1000 and lien_consultation ~* '^https://')),
  maj_le timestamptz,
  source_externe_id uuid references public.sources_externes_alertes(id) on delete set null,
  premiere_reception_le timestamptz not null default now(),
  derniere_reception_le timestamptz not null default now(),
  unique (evenement_territoire_id, reference)
);

create index if not exists evenements_territoire_dossiers_contexte on public.evenements_territoire_dossiers (contexte_id);

comment on table public.evenements_territoire_dossiers is
  'Dossier de sécurité d''un événement, reçu de l''organisateur (Eventware, briefing 01). Dernier état connu ; écrit par recevoir_dossier_evenement() seule. Le lien de consultation porte un jeton : lisible par les seuls membres de la commune.';

alter table public.evenements_territoire_dossiers enable row level security;
revoke all on public.evenements_territoire_dossiers from public, anon, authenticated;
grant select on public.evenements_territoire_dossiers to authenticated;

create policy "lecture membres" on public.evenements_territoire_dossiers
  for select to authenticated using (a_acces(contexte_id, 'lecture'));

-- 4. Journal -------------------------------------------------------------------------------------------

alter table public.journal_ingestions_externes
  add column if not exists objet text not null default 'alerte',
  add column if not exists dossier_id uuid references public.evenements_territoire_dossiers(id) on delete set null;
alter table public.journal_ingestions_externes
  add constraint journal_ingestions_externes_objet_check check (objet in ('alerte', 'dossier'));

-- 5. Réception (clé de service seulement) ---------------------------------------------------------------

create or replace function public.recevoir_dossier_evenement(p_source uuid, p_charge jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_src sources_externes_alertes%rowtype;
  v_ev jsonb := p_charge -> 'evenement';
  v_do jsonb := p_charge -> 'dossier';
  v_jeton uuid;
  v_ref uuid;
  v_version integer;
  v_evenement uuid;
  v_cree boolean := false;
  v_existant evenements_territoire_dossiers%rowtype;
  v_id uuid;
begin
  select * into v_src from sources_externes_alertes where id = p_source;
  if not found or not v_src.actif or v_src.deleted_at is not null or not 'dossier' = any (v_src.objets) then
    raise exception 'Source inconnue, inactive ou non autorisée pour les dossiers';
  end if;
  if p_charge ->> 'type' is distinct from 'dossier_securite' then
    raise exception 'Type de charge inattendu';
  end if;
  begin
    v_jeton := (v_ev ->> 'jeton_public')::uuid;
    v_ref := (v_do ->> 'reference')::uuid;
    v_version := (v_do ->> 'version')::integer;
  exception when others then
    raise exception 'Charge invalide : jeton_public, reference ou version illisible';
  end;
  if v_jeton is null or v_ref is null or v_version is null or v_version < 1 then
    raise exception 'Charge invalide : jeton_public, reference et version sont requis';
  end if;
  if coalesce(v_do ->> 'statut', '') not in ('depose', 'en_instruction', 'autorise', 'refuse', 'retire') then
    raise exception 'Charge invalide : statut du dossier inconnu';
  end if;
  if (v_do ->> 'lien_consultation') is not null and (v_do ->> 'lien_consultation') !~* '^https://' then
    raise exception 'Charge invalide : lien de consultation non https';
  end if;

  -- Rapprochement avec un événement suivi de la commune ; sinon, proposition inactive.
  select e.id into v_evenement from evenements_territoire e
   where e.contexte_id = v_src.contexte_id and e.jeton_public = v_jeton;
  if v_evenement is null then
    insert into evenements_territoire (contexte_id, nom, organisateur, jeton_public, date_debut, date_fin, actif,
                                       propose_par_organisateur, statut_proposition, notes)
    values (v_src.contexte_id,
            left(coalesce(nullif(btrim(v_ev ->> 'nom'), ''), 'Événement sans nom'), 200),
            left(v_src.libelle, 200), v_jeton,
            nullif(v_ev ->> 'date_debut', '')::date,
            greatest(nullif(v_ev ->> 'date_fin', '')::date, nullif(v_ev ->> 'date_debut', '')::date),
            false, true, 'a_examiner',
            'Proposé par l''organisateur à la réception de son dossier de sécurité.')
    returning id into v_evenement;
    v_cree := true;
  end if;

  select * into v_existant from evenements_territoire_dossiers
   where evenement_territoire_id = v_evenement and reference = v_ref for update;
  if found and v_existant.version >= v_version then
    return jsonb_build_object('resultat', 'deja_recu', 'dossier_id', v_existant.id, 'version_connue', v_existant.version,
                              'evenement_territoire_id', v_evenement);
  end if;

  insert into evenements_territoire_dossiers (contexte_id, evenement_territoire_id, reference, version, statut, niveau_dmp,
                                              frequentation_max, lien_consultation, maj_le, source_externe_id)
  values (v_src.contexte_id, v_evenement, v_ref, v_version, v_do ->> 'statut',
          nullif(v_do ->> 'niveau_dmp', '')::smallint,
          nullif(v_ev ->> 'frequentation_max', '')::integer,
          nullif(v_do ->> 'lien_consultation', ''),
          nullif(v_do ->> 'maj_le', '')::timestamptz,
          v_src.id)
  on conflict (evenement_territoire_id, reference) do update
     set version = excluded.version, statut = excluded.statut, niveau_dmp = excluded.niveau_dmp,
         frequentation_max = excluded.frequentation_max, lien_consultation = excluded.lien_consultation,
         maj_le = excluded.maj_le, source_externe_id = excluded.source_externe_id, derniere_reception_le = now()
  returning id into v_id;

  return jsonb_build_object('resultat', case when v_existant.id is null then 'cree' else 'mis_a_jour' end,
                            'dossier_id', v_id, 'evenement_territoire_id', v_evenement, 'evenement_propose', v_cree);
end;
$function$;

revoke all on function public.recevoir_dossier_evenement(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.recevoir_dossier_evenement(uuid, jsonb) to service_role;
