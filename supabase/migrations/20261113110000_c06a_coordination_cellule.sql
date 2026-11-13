-- C6 — coordination de la cellule et du terrain. Idées reprises de SCRIBE (nocomp/scribe, AGPL-3.0 : idées seulement,
-- aucun code repris) et de Kalisio Crisis (kalisio/crisis, MIT ; autre pile technique, aucun code repris).
--
-- 1. Consignes avec accusé de lecture (SCRIBE) : le CC émet une consigne ; les destinataires (membres de la commune,
--    éventuellement filtrés par rôle) sont figés à l'émission ; chacun accuse lecture ; le CC voit qui ne l'a pas lue.
-- 2. Présences en cellule (SCRIBE) : qui est au CC ou au PC-Ops, fonction, arrivée, départ ; chaque mouvement est
--    tracé au livre de bord de l'incident.
-- 3. Capacités des centres d'accueil (SCRIBE) : relevés d'occupation horodatés, niveau normal / tension / critique
--    selon des seuils propres à chaque centre ; franchissement à la hausse tracé au livre de bord.
-- 4. Processus d'intervention (Kalisio) : modèles d'étapes question-réponses ; lancés sur un incident pour des équipes ;
--    chaque équipe répond depuis Terrain (ou le CC pour elle) ; le CC suit l'avancement.
-- 5. Catalogue de couches cartographiques (Kalisio) : couches WMS, WMTS ou XYZ, de la plateforme ou de la commune,
--    superposables aux cartes du QG et de Terrain. Aucune couche n'est préremplie : leurs adresses sont à fournir.
-- (6. Historique et statistiques des incidents : écran seul, sur les tables existantes ; aucune migration.)

-- 1. Consignes ------------------------------------------------------------------------------------------

create table if not exists public.consignes (
  id uuid primary key default gen_random_uuid(),
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  incident_id uuid references public.incidents(id) on delete cascade,
  titre text not null check (char_length(btrim(titre)) between 1 and 200),
  texte text not null check (char_length(btrim(texte)) between 1 and 4000),
  priorite text not null default 'normale' check (priorite in ('normale', 'urgente')),
  roles_cibles uuid[],
  est_exercice boolean not null default false,
  emise_le timestamptz not null default now(),
  emise_par uuid references auth.users(id) on delete set null,
  annulee_le timestamptz,
  annulee_par uuid references auth.users(id) on delete set null
);
create index if not exists consignes_contexte on public.consignes (contexte_id, emise_le desc);
create index if not exists consignes_incident on public.consignes (incident_id);

create table if not exists public.consignes_destinataires (
  consigne_id uuid not null references public.consignes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lu_le timestamptz,
  primary key (consigne_id, user_id)
);
create index if not exists consignes_destinataires_user on public.consignes_destinataires (user_id) where lu_le is null;

alter table public.consignes enable row level security;
alter table public.consignes_destinataires enable row level security;
revoke all on public.consignes, public.consignes_destinataires from public, anon, authenticated;
grant select on public.consignes, public.consignes_destinataires to authenticated;

create policy "lecture membres" on public.consignes
  for select to authenticated using (a_capacite(contexte_id, 'incidents', 'lire'));
create policy "lecture membres" on public.consignes_destinataires
  for select to authenticated
  using (exists (select 1 from consignes c where c.id = consigne_id and a_capacite(c.contexte_id, 'incidents', 'lire')));

create or replace function public.emettre_consigne(
  p_contexte uuid, p_titre text, p_texte text, p_incident uuid default null,
  p_priorite text default 'normale', p_roles uuid[] default null
) returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
  v_exercice boolean := false;
begin
  if auth.uid() is null or p_contexte is null or not a_capacite(p_contexte, 'incidents', 'creer') then
    raise exception 'Accès refusé';
  end if;
  if p_incident is not null then
    select i.est_exercice into v_exercice from incidents i where i.id = p_incident and i.contexte_id = p_contexte;
    if not found then raise exception 'Incident introuvable dans cette commune'; end if;
  end if;
  if p_roles is not null and (cardinality(p_roles) = 0 or exists (
       select 1 from unnest(p_roles) r where not exists (select 1 from roles x where x.id = r and x.contexte_id = p_contexte))) then
    raise exception 'Rôle inconnu dans cette commune';
  end if;

  insert into consignes (contexte_id, incident_id, titre, texte, priorite, roles_cibles, est_exercice, emise_par)
  values (p_contexte, p_incident, btrim(p_titre), btrim(p_texte), coalesce(p_priorite, 'normale'), p_roles, coalesce(v_exercice, false), auth.uid())
  returning id into v_id;

  -- Destinataires figés à l'émission : ce qui compte, c'est qui devait la lire à ce moment-là.
  insert into consignes_destinataires (consigne_id, user_id)
  select distinct v_id, au.user_id
  from acces_utilisateurs au
  where au.contexte_id = p_contexte
    and (p_roles is null or au.role_id = any (p_roles));

  if p_incident is not null then
    insert into livre_de_bord (incident_id, message)
    values (p_incident, '[Consigne' || case when p_priorite = 'urgente' then ' urgente' else '' end || '] ' || btrim(p_titre));
  end if;
  return v_id;
end;
$function$;

create or replace function public.accuser_lecture_consigne(p_consigne uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null then raise exception 'Accès refusé'; end if;
  update consignes_destinataires set lu_le = now()
   where consigne_id = p_consigne and user_id = auth.uid() and lu_le is null;
  if not found and not exists (select 1 from consignes_destinataires where consigne_id = p_consigne and user_id = auth.uid()) then
    raise exception 'Cette consigne ne vous est pas adressée';
  end if;
end;
$function$;

create or replace function public.annuler_consigne(p_consigne uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v consignes%rowtype;
begin
  select * into v from consignes where id = p_consigne;
  if not found or auth.uid() is null or not a_capacite(v.contexte_id, 'incidents', 'modifier') then
    raise exception 'Accès refusé';
  end if;
  if v.annulee_le is not null then return; end if;
  update consignes set annulee_le = now(), annulee_par = auth.uid() where id = p_consigne;
  if v.incident_id is not null then
    insert into livre_de_bord (incident_id, message) values (v.incident_id, '[Consigne annulée] ' || v.titre);
  end if;
end;
$function$;

-- Consignes de l'utilisateur, non annulées : bandeau du QG et de Terrain.
create or replace function public.mes_consignes(p_contexte uuid, p_non_lues boolean default true)
 returns table (id uuid, incident_id uuid, titre text, texte text, priorite text, est_exercice boolean, emise_le timestamptz, lu_le timestamptz)
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select c.id, c.incident_id, c.titre, c.texte, c.priorite, c.est_exercice, c.emise_le, d.lu_le
  from consignes c
  join consignes_destinataires d on d.consigne_id = c.id and d.user_id = auth.uid()
  where c.contexte_id = p_contexte and c.annulee_le is null and (not p_non_lues or d.lu_le is null)
  order by c.priorite = 'urgente' desc, c.emise_le desc
  limit 50;
$function$;

revoke all on function public.emettre_consigne(uuid, text, text, uuid, text, uuid[]) from public, anon;
revoke all on function public.accuser_lecture_consigne(uuid) from public, anon;
revoke all on function public.annuler_consigne(uuid) from public, anon;
revoke all on function public.mes_consignes(uuid, boolean) from public, anon;
grant execute on function public.emettre_consigne(uuid, text, text, uuid, text, uuid[]) to authenticated;
grant execute on function public.accuser_lecture_consigne(uuid) to authenticated;
grant execute on function public.annuler_consigne(uuid) to authenticated;
grant execute on function public.mes_consignes(uuid, boolean) to authenticated;

-- 2. Présences en cellule -------------------------------------------------------------------------------

create table if not exists public.presences_cellule (
  id uuid primary key default gen_random_uuid(),
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  nom text not null check (char_length(btrim(nom)) between 1 and 120),
  fonction text check (fonction is null or char_length(fonction) <= 120),
  organe text not null default 'cc' check (organe in ('cc', 'pcops', 'autre')),
  arrivee_le timestamptz not null default now(),
  depart_le timestamptz,
  saisi_par uuid default auth.uid() references auth.users(id) on delete set null,
  check (depart_le is null or depart_le >= arrivee_le)
);
create index if not exists presences_cellule_incident on public.presences_cellule (incident_id, arrivee_le);
-- Une seule présence ouverte par compte et par incident.
create unique index if not exists presences_cellule_ouverte on public.presences_cellule (incident_id, user_id)
  where depart_le is null and user_id is not null;

alter table public.presences_cellule enable row level security;
revoke all on public.presences_cellule from public, anon, authenticated;
grant select, insert, update on public.presences_cellule to authenticated;

create policy "lecture membres" on public.presences_cellule
  for select to authenticated using (a_capacite(contexte_id, 'incidents', 'lire'));
create policy "arrivee" on public.presences_cellule
  for insert to authenticated
  with check (a_capacite(contexte_id, 'incidents', 'creer')
              and exists (select 1 from incidents i where i.id = incident_id and i.contexte_id = presences_cellule.contexte_id));
create policy "depart" on public.presences_cellule
  for update to authenticated
  using (a_capacite(contexte_id, 'incidents', 'creer') and (user_id = auth.uid() or a_capacite(contexte_id, 'incidents', 'modifier')))
  with check (a_capacite(contexte_id, 'incidents', 'creer'));

create or replace function public.presences_cellule_trace()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_organe text := case new.organe when 'cc' then 'au CC' when 'pcops' then 'au PC-Ops' else 'en cellule' end;
begin
  if tg_op = 'INSERT' then
    new.saisi_par := auth.uid();
    insert into livre_de_bord (incident_id, message)
    values (new.incident_id, '[Présence] ' || new.nom || coalesce(' (' || nullif(btrim(new.fonction), '') || ')', '') || ' arrive ' || v_organe);
    return new;
  end if;
  -- Seul le départ se modifie ; l'arrivée, l'identité et l'incident restent ceux de la saisie.
  if (new.contexte_id, new.incident_id, new.user_id, new.nom, new.organe, new.arrivee_le)
     is distinct from (old.contexte_id, old.incident_id, old.user_id, old.nom, old.organe, old.arrivee_le) then
    raise exception 'Seuls la fonction et l''heure de départ se modifient';
  end if;
  if old.depart_le is not null and new.depart_le is distinct from old.depart_le then
    raise exception 'Départ déjà enregistré';
  end if;
  if old.depart_le is null and new.depart_le is not null then
    insert into livre_de_bord (incident_id, message)
    values (new.incident_id, '[Présence] ' || new.nom || ' quitte ' || case new.organe when 'cc' then 'le CC' when 'pcops' then 'le PC-Ops' else 'la cellule' end);
  end if;
  return new;
end;
$function$;
revoke all on function public.presences_cellule_trace() from public, anon, authenticated;

create or replace trigger presences_cellule_trace
  before insert or update on public.presences_cellule
  for each row execute function public.presences_cellule_trace();

-- 3. Capacités des centres d'accueil ---------------------------------------------------------------------

alter table public.centres_accueil
  add column if not exists seuil_tension_pct integer not null default 80,
  add column if not exists seuil_critique_pct integer not null default 95;
alter table public.centres_accueil
  add constraint centres_accueil_seuils_check
    check (seuil_tension_pct between 1 and 100 and seuil_critique_pct between 1 and 100 and seuil_tension_pct < seuil_critique_pct);

create table if not exists public.occupations_centres (
  id uuid primary key default gen_random_uuid(),
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  centre_id uuid not null references public.centres_accueil(id) on delete cascade,
  incident_id uuid references public.incidents(id) on delete set null,
  places_ouvertes integer not null check (places_ouvertes between 0 and 100000),
  places_occupees integer not null check (places_occupees between 0 and 100000),
  note text check (note is null or char_length(note) <= 500),
  releve_le timestamptz not null default now(),
  auteur_id uuid default auth.uid() references auth.users(id) on delete set null
);
create index if not exists occupations_centres_centre on public.occupations_centres (centre_id, releve_le desc);

alter table public.occupations_centres enable row level security;
revoke all on public.occupations_centres from public, anon, authenticated;
grant select, insert on public.occupations_centres to authenticated;

create policy "lecture membres" on public.occupations_centres
  for select to authenticated using (a_capacite(contexte_id, 'incidents', 'lire'));
create policy "releve" on public.occupations_centres
  for insert to authenticated
  with check (a_capacite(contexte_id, 'incidents', 'creer')
              and exists (select 1 from centres_accueil c where c.id = centre_id and c.contexte_id = occupations_centres.contexte_id)
              and (incident_id is null or exists (select 1 from incidents i where i.id = incident_id and i.contexte_id = occupations_centres.contexte_id)));

-- Niveau d'un relevé : critique si plus aucune place ou au-delà du seuil critique.
create or replace function public.niveau_tension(p_occupees integer, p_ouvertes integer, p_tension integer, p_critique integer)
 returns text
 language sql
 immutable
 set search_path to 'public', 'pg_temp'
as $function$
  select case
    when p_ouvertes <= 0 or p_occupees >= p_ouvertes or p_occupees * 100 >= p_critique * p_ouvertes then 'critique'
    when p_occupees * 100 >= p_tension * p_ouvertes then 'tension'
    else 'normal' end;
$function$;

create or replace function public.occupations_centres_avant()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_c centres_accueil%rowtype;
  v_prec occupations_centres%rowtype;
  v_niveau text;
  v_niveau_prec text;
begin
  new.auteur_id := auth.uid();
  -- Heure réelle de l'instruction (pas celle de la transaction) : deux relevés gardent leur ordre.
  new.releve_le := clock_timestamp();
  select * into v_c from centres_accueil where id = new.centre_id;
  v_niveau := niveau_tension(new.places_occupees, new.places_ouvertes, v_c.seuil_tension_pct, v_c.seuil_critique_pct);
  select * into v_prec from occupations_centres where centre_id = new.centre_id order by releve_le desc, id desc limit 1;
  v_niveau_prec := case when v_prec.id is null then 'normal'
                        else niveau_tension(v_prec.places_occupees, v_prec.places_ouvertes, v_c.seuil_tension_pct, v_c.seuil_critique_pct) end;
  -- Franchissement à la hausse : tracé au livre de bord de l'incident.
  if new.incident_id is not null and v_niveau <> v_niveau_prec
     and (v_niveau = 'critique' or (v_niveau = 'tension' and v_niveau_prec = 'normal')) then
    insert into livre_de_bord (incident_id, message)
    values (new.incident_id, '[Capacité] ' || v_c.nom || ' : ' || v_niveau || ' (' || new.places_occupees || ' / ' || new.places_ouvertes || ' places)');
  end if;
  return new;
end;
$function$;
revoke all on function public.occupations_centres_avant() from public, anon, authenticated;

create or replace trigger occupations_centres_avant
  before insert on public.occupations_centres
  for each row execute function public.occupations_centres_avant();

-- Dernier relevé de chaque centre, avec son niveau (droits de l'appelant).
create or replace view public.centres_accueil_occupation with (security_invoker = true) as
select c.id as centre_id, c.contexte_id, c.nom, c.type_lieu, c.latitude, c.longitude,
       c.capacite_hebergement, c.capacite_debout, c.seuil_tension_pct, c.seuil_critique_pct,
       o.places_ouvertes, o.places_occupees, o.releve_le, o.incident_id, o.note,
       case when o.id is null then null
            else niveau_tension(o.places_occupees, o.places_ouvertes, c.seuil_tension_pct, c.seuil_critique_pct) end as niveau
from centres_accueil c
left join lateral (
  select * from occupations_centres x where x.centre_id = c.id order by x.releve_le desc, x.id desc limit 1
) o on true;
grant select on public.centres_accueil_occupation to authenticated;
revoke all on public.centres_accueil_occupation from anon;

-- 4. Processus d'intervention ----------------------------------------------------------------------------

create table if not exists public.processus_modeles (
  id uuid primary key default gen_random_uuid(),
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  nom text not null check (char_length(btrim(nom)) between 1 and 120),
  description text check (description is null or char_length(description) <= 1000),
  etapes jsonb not null,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Étapes : [{ "question": "Arrivés sur place ?", "reponses": [{ "libelle": "Oui" }, { "libelle": "Impossible", "fin": true }] }]
create or replace function public.processus_etapes_valides(p_etapes jsonb)
 returns boolean
 language plpgsql
 immutable
 set search_path to 'public', 'pg_temp'
as $function$
declare
  e jsonb;
  r jsonb;
begin
  if jsonb_typeof(p_etapes) <> 'array' or jsonb_array_length(p_etapes) not between 1 and 20 then
    raise exception 'Un processus compte de 1 à 20 étapes';
  end if;
  for e in select * from jsonb_array_elements(p_etapes) loop
    if char_length(btrim(coalesce(e ->> 'question', ''))) not between 1 and 300 then
      raise exception 'Chaque étape pose une question (300 caractères au plus)';
    end if;
    if jsonb_typeof(e -> 'reponses') is distinct from 'array' or jsonb_array_length(e -> 'reponses') not between 1 and 8 then
      raise exception 'Chaque étape propose de 1 à 8 réponses';
    end if;
    for r in select * from jsonb_array_elements(e -> 'reponses') loop
      if char_length(btrim(coalesce(r ->> 'libelle', ''))) not between 1 and 80 then
        raise exception 'Chaque réponse a un libellé (80 caractères au plus)';
      end if;
    end loop;
    if (select count(distinct lower(btrim(x ->> 'libelle'))) from jsonb_array_elements(e -> 'reponses') x) <> jsonb_array_length(e -> 'reponses') then
      raise exception 'Deux réponses d''une même étape portent le même libellé';
    end if;
  end loop;
  return true;
end;
$function$;

alter table public.processus_modeles
  add constraint processus_modeles_etapes_check check (processus_etapes_valides(etapes));

create table if not exists public.processus_lances (
  id uuid primary key default gen_random_uuid(),
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  modele_id uuid references public.processus_modeles(id) on delete set null,
  titre text not null check (char_length(btrim(titre)) between 1 and 160),
  etapes jsonb not null check (processus_etapes_valides(etapes)),
  lance_le timestamptz not null default now(),
  lance_par uuid default auth.uid() references auth.users(id) on delete set null,
  clos_le timestamptz
);
create index if not exists processus_lances_incident on public.processus_lances (incident_id);

create table if not exists public.processus_participants (
  id uuid primary key default gen_random_uuid(),
  processus_id uuid not null references public.processus_lances(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  libelle text not null check (char_length(btrim(libelle)) between 1 and 120),
  etape_courante integer not null default 0,
  termine_le timestamptz,
  maj_le timestamptz not null default now()
);
create index if not exists processus_participants_user on public.processus_participants (user_id) where termine_le is null;

create table if not exists public.processus_reponses (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.processus_participants(id) on delete cascade,
  etape integer not null,
  reponse text not null,
  commentaire text check (commentaire is null or char_length(commentaire) <= 1000),
  repondu_le timestamptz not null default now(),
  auteur_id uuid references auth.users(id) on delete set null
);
create index if not exists processus_reponses_participant on public.processus_reponses (participant_id, repondu_le);

alter table public.processus_modeles enable row level security;
alter table public.processus_lances enable row level security;
alter table public.processus_participants enable row level security;
alter table public.processus_reponses enable row level security;
revoke all on public.processus_modeles, public.processus_lances, public.processus_participants, public.processus_reponses
  from public, anon, authenticated;
grant select, insert, update, delete on public.processus_modeles to authenticated;
grant select on public.processus_lances, public.processus_participants, public.processus_reponses to authenticated;

create policy "lecture" on public.processus_modeles for select to authenticated using (a_capacite(contexte_id, 'referentiels', 'lire'));
create policy "creation" on public.processus_modeles for insert to authenticated with check (a_capacite(contexte_id, 'referentiels', 'creer'));
create policy "modification" on public.processus_modeles for update to authenticated
  using (a_capacite(contexte_id, 'referentiels', 'modifier')) with check (a_capacite(contexte_id, 'referentiels', 'modifier'));
create policy "suppression" on public.processus_modeles for delete to authenticated using (a_capacite(contexte_id, 'referentiels', 'supprimer'));

create policy "lecture" on public.processus_lances for select to authenticated using (a_capacite(contexte_id, 'incidents', 'lire'));
create policy "lecture" on public.processus_participants for select to authenticated
  using (exists (select 1 from processus_lances p where p.id = processus_id and a_capacite(p.contexte_id, 'incidents', 'lire')));
create policy "lecture" on public.processus_reponses for select to authenticated
  using (exists (select 1 from processus_participants pa join processus_lances p on p.id = pa.processus_id
                 where pa.id = participant_id and a_capacite(p.contexte_id, 'incidents', 'lire')));

create or replace function public.processus_modeles_maj()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;
revoke all on function public.processus_modeles_maj() from public, anon, authenticated;
create or replace trigger processus_modeles_maj before update on public.processus_modeles
  for each row execute function public.processus_modeles_maj();

-- Lance un processus sur un incident. p_equipes : [{ "libelle": "Équipe D4 Nord", "user_id": "…" (facultatif) }].
-- Les étapes sont recopiées : modifier le modèle ensuite ne change pas un processus en cours.
create or replace function public.lancer_processus(p_incident uuid, p_modele uuid, p_equipes jsonb, p_titre text default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_i incidents%rowtype;
  v_m processus_modeles%rowtype;
  v_id uuid;
  v_eq jsonb;
  v_user uuid;
begin
  select * into v_i from incidents where id = p_incident;
  if not found or auth.uid() is null or not a_capacite(v_i.contexte_id, 'incidents', 'creer') then
    raise exception 'Accès refusé';
  end if;
  select * into v_m from processus_modeles where id = p_modele and contexte_id = v_i.contexte_id and actif;
  if not found then raise exception 'Modèle introuvable ou inactif'; end if;
  if jsonb_typeof(p_equipes) is distinct from 'array' or jsonb_array_length(p_equipes) not between 1 and 50 then
    raise exception 'De 1 à 50 équipes';
  end if;

  insert into processus_lances (contexte_id, incident_id, modele_id, titre, etapes)
  values (v_i.contexte_id, p_incident, p_modele, coalesce(nullif(btrim(p_titre), ''), v_m.nom), v_m.etapes)
  returning id into v_id;

  for v_eq in select * from jsonb_array_elements(p_equipes) loop
    v_user := nullif(v_eq ->> 'user_id', '')::uuid;
    if v_user is not null and not exists (select 1 from acces_utilisateurs au where au.user_id = v_user and au.contexte_id = v_i.contexte_id) then
      raise exception 'Un participant n''est pas membre de la commune';
    end if;
    insert into processus_participants (processus_id, user_id, libelle)
    values (v_id, v_user, btrim(coalesce(v_eq ->> 'libelle', '')));
  end loop;

  insert into livre_de_bord (incident_id, message)
  values (p_incident, '[Processus] ' || coalesce(nullif(btrim(p_titre), ''), v_m.nom) || ' lancé pour ' || jsonb_array_length(p_equipes) || ' équipe(s)');
  return v_id;
end;
$function$;

-- Réponse d'une équipe à son étape en cours : l'équipe elle-même (compte lié) ou le CC pour elle (modifier).
create or replace function public.repondre_processus(p_participant uuid, p_reponse text, p_commentaire text default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_pa processus_participants%rowtype;
  v_p processus_lances%rowtype;
  v_etape jsonb;
  v_rep jsonb;
  v_fin boolean;
begin
  select * into v_pa from processus_participants where id = p_participant for update;
  if not found then raise exception 'Accès refusé'; end if;
  select * into v_p from processus_lances where id = v_pa.processus_id;
  if auth.uid() is null or not a_capacite(v_p.contexte_id, 'incidents', 'lire')
     or not (v_pa.user_id = auth.uid() or a_capacite(v_p.contexte_id, 'incidents', 'modifier')) then
    raise exception 'Accès refusé';
  end if;
  if v_p.clos_le is not null or v_pa.termine_le is not null then
    raise exception 'Ce processus est terminé pour cette équipe';
  end if;

  v_etape := v_p.etapes -> v_pa.etape_courante;
  select r into v_rep from jsonb_array_elements(v_etape -> 'reponses') r
   where lower(btrim(r ->> 'libelle')) = lower(btrim(p_reponse)) limit 1;
  if v_rep is null then raise exception 'Réponse non prévue à cette étape'; end if;
  v_fin := coalesce((v_rep ->> 'fin')::boolean, false) or v_pa.etape_courante + 1 >= jsonb_array_length(v_p.etapes);

  insert into processus_reponses (participant_id, etape, reponse, commentaire, auteur_id)
  values (p_participant, v_pa.etape_courante, v_rep ->> 'libelle', nullif(btrim(p_commentaire), ''), auth.uid());

  update processus_participants
     set etape_courante = case when v_fin then etape_courante else etape_courante + 1 end,
         termine_le = case when v_fin then now() end,
         maj_le = now()
   where id = p_participant;

  insert into livre_de_bord (incident_id, message)
  values (v_p.incident_id, '[Processus] ' || v_p.titre || ' — ' || v_pa.libelle || ' : « ' || (v_etape ->> 'question') || ' » → ' || (v_rep ->> 'libelle')
          || coalesce(' (' || nullif(btrim(p_commentaire), '') || ')', ''));
end;
$function$;

create or replace function public.clore_processus(p_processus uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_p processus_lances%rowtype;
begin
  select * into v_p from processus_lances where id = p_processus;
  if not found or auth.uid() is null or not a_capacite(v_p.contexte_id, 'incidents', 'modifier') then
    raise exception 'Accès refusé';
  end if;
  if v_p.clos_le is not null then return; end if;
  update processus_lances set clos_le = now() where id = p_processus;
  insert into livre_de_bord (incident_id, message) values (v_p.incident_id, '[Processus] ' || v_p.titre || ' clos');
end;
$function$;

revoke all on function public.lancer_processus(uuid, uuid, jsonb, text) from public, anon;
revoke all on function public.repondre_processus(uuid, text, text) from public, anon;
revoke all on function public.clore_processus(uuid) from public, anon;
grant execute on function public.lancer_processus(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.repondre_processus(uuid, text, text) to authenticated;
grant execute on function public.clore_processus(uuid) to authenticated;

-- 5. Catalogue de couches cartographiques ----------------------------------------------------------------

create table if not exists public.couches_carte (
  id uuid primary key default gen_random_uuid(),
  contexte_id uuid references public.contextes(id) on delete cascade, -- vide : catalogue de la plateforme
  nom text not null check (char_length(btrim(nom)) between 1 and 120),
  type text not null check (type in ('wms', 'xyz')),
  url text not null check (url ~ '^https://[^\s"''<>]+$' and char_length(url) <= 500),
  couches text check (couches is null or char_length(couches) <= 300),
  format text not null default 'image/png' check (format in ('image/png', 'image/jpeg')),
  transparent boolean not null default true,
  attribution text check (attribution is null or char_length(attribution) <= 300),
  opacite numeric(3,2) not null default 0.7 check (opacite between 0.1 and 1),
  zoom_max integer not null default 19 check (zoom_max between 1 and 22),
  visible_par_defaut boolean not null default false,
  apps text[] not null default array['qg', 'terrain'] check (apps <@ array['qg', 'terrain'] and cardinality(apps) >= 1),
  ordre integer not null default 100,
  actif boolean not null default true,
  source text check (source is null or char_length(source) <= 500),
  created_at timestamptz not null default now(),
  check (type <> 'wms' or nullif(btrim(couches), '') is not null)
);

alter table public.couches_carte enable row level security;
revoke all on public.couches_carte from public, anon, authenticated;
grant select, insert, update, delete on public.couches_carte to authenticated;

create policy "lecture" on public.couches_carte for select to authenticated
  using (contexte_id is null or a_acces(contexte_id, 'lecture'));
create policy "creation" on public.couches_carte for insert to authenticated
  with check (case when contexte_id is null then est_super_admin() else a_capacite(contexte_id, 'referentiels', 'creer') end);
create policy "modification" on public.couches_carte for update to authenticated
  using (case when contexte_id is null then est_super_admin() else a_capacite(contexte_id, 'referentiels', 'modifier') end)
  with check (case when contexte_id is null then est_super_admin() else a_capacite(contexte_id, 'referentiels', 'modifier') end);
create policy "suppression" on public.couches_carte for delete to authenticated
  using (case when contexte_id is null then est_super_admin() else a_capacite(contexte_id, 'referentiels', 'supprimer') end);
