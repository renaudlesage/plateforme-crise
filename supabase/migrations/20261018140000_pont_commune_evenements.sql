-- =====================================================================
-- Pont descendant commune -> événements (Crisiware -> Eventware)
-- ---------------------------------------------------------------------
-- Quand une commune passe en pré-alerte / alerte / phase active, les organisateurs d'événements
-- suivis sur son territoire reçoivent un message PROPOSÉ au Comité de Coordination, qui le relit,
-- le corrige si besoin et l'envoie d'un clic. Rien ne part sans validation humaine.
--
--   evenements_territoire          registre des événements suivis par la commune (CRUD)
--   evenements_territoire_secrets  secrets d'émission : jamais lisibles par un compte utilisateur
--   emissions_evenements           messages proposés / envoyés, avec le résultat de chaque envoi
--
-- Droits : ressource « communication » (lire / creer / modifier / supprimer), comme les alertes publiques.
-- Contrat HTTP (récepteur côté organisateur) : voir claude/pont-commune-evenements-2026-10-18.md
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Validation d'une adresse de réception (limite le risque d'« appel vers l'intérieur »)
-- ---------------------------------------------------------------------
create or replace function public.url_recepteur_valide(p_url text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_hote text;
begin
  if p_url is null then
    return null;
  end if;
  if length(p_url) > 500 then
    return 'Adresse trop longue (500 caractères au plus)';
  end if;
  -- https uniquement, nom de domaine uniquement : ni identifiant@, ni port, ni adresse IP entre crochets
  if p_url !~* '^https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(/[^[:space:]]*)?$' then
    return 'L''adresse doit commencer par https:// suivi d''un nom de domaine (sans identifiant, sans port, sans adresse IP)';
  end if;
  v_hote := lower(substring(p_url from '^https://([^/]+)'));
  if v_hote !~ '\.' then
    return 'Nom de domaine complet requis (ex. exemple.org)';
  end if;
  if v_hote ~ '\.(0x[0-9a-f]+|[0-9]+)$' then
    return 'Adresse IP interdite : utilisez un nom de domaine';
  end if;
  if v_hote ~ '(^|\.)(localhost|local|internal|lan|intranet|home|corp)$' then
    return 'Adresse interne interdite';
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Registre des événements suivis
-- ---------------------------------------------------------------------
create table if not exists public.evenements_territoire (
  id uuid primary key default gen_random_uuid(),
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  nom text not null check (length(btrim(nom)) between 2 and 200),
  organisateur text check (organisateur is null or length(organisateur) <= 200),
  jeton_public uuid,
  url_recepteur text,
  entete_secret text not null default 'X-Diffusion-Secret' check (entete_secret ~ '^[A-Za-z0-9-]{2,60}$'),
  secret_defini boolean not null default false,
  date_debut date,
  date_fin date,
  actif boolean not null default true,
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint evenements_territoire_dates check (date_fin is null or date_debut is null or date_fin >= date_debut)
);

create unique index if not exists evenements_territoire_jeton_unique
  on public.evenements_territoire (contexte_id, jeton_public) where jeton_public is not null;
create index if not exists evenements_territoire_contexte on public.evenements_territoire (contexte_id, actif);

comment on table public.evenements_territoire is
  'Événements (festivals, marchés, courses…) suivis par une commune. Rattachement explicite : pas de base partagée avec Eventware.';
comment on column public.evenements_territoire.jeton_public is
  'Jeton public Eventware de l''événement (non secret) : permettra de lire son état public.';
comment on column public.evenements_territoire.url_recepteur is
  'Point de réception de l''alerte côté organisateur (https, nom de domaine). Le modifier efface le secret : il ne part que vers l''adresse pour laquelle il a été donné.';

create table if not exists public.evenements_territoire_secrets (
  evenement_territoire_id uuid primary key references public.evenements_territoire(id) on delete cascade,
  secret text,
  updated_at timestamptz not null default now()
);
alter table public.evenements_territoire_secrets enable row level security;
revoke all on public.evenements_territoire_secrets from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Messages proposés / envoyés
-- ---------------------------------------------------------------------
create table if not exists public.emissions_evenements (
  id uuid primary key default gen_random_uuid(),
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  evenement_territoire_id uuid not null references public.evenements_territoire(id) on delete restrict,
  incident_id uuid references public.incidents(id) on delete set null,
  declencheur text not null default 'manuel' check (declencheur in ('phase_incident', 'manuel')),
  phase_incident text,
  niveau text not null check (niveau in ('information', 'vigilance', 'urgence', 'evacuation')),
  titre text not null check (length(btrim(titre)) between 3 and 200),
  message text not null check (length(btrim(message)) between 3 and 2000),
  consigne text check (consigne is null or length(consigne) <= 1000),
  statut text not null default 'a_valider' check (statut in ('a_valider', 'envoye', 'echec', 'annule')),
  motif_annulation text,
  propose_le timestamptz not null default now(),
  propose_par uuid,
  envoye_le timestamptz,
  envoye_par uuid,
  tentatives integer not null default 0,
  derniere_tentative_le timestamptz,
  code_reponse integer,
  reponse_extrait text,
  erreur text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists emissions_evenements_proposition_unique
  on public.emissions_evenements (evenement_territoire_id, incident_id)
  where statut = 'a_valider' and incident_id is not null;
create index if not exists emissions_evenements_contexte on public.emissions_evenements (contexte_id, statut, propose_le desc);

comment on table public.emissions_evenements is
  'Messages de la commune aux organisateurs d''événements : proposés par le système ou écrits à la main, envoyés après validation humaine. Une émission envoyée ou annulée est définitive.';

-- ---------------------------------------------------------------------
-- 3. Contrôles du registre
-- ---------------------------------------------------------------------
create or replace function public.evenements_territoire_controle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_erreur text;
begin
  if exists (select 1 from contextes c where c.id = new.contexte_id and c.est_plateforme) then
    raise exception 'Le contexte plateforme ne suit pas d''événements' using errcode = '23514';
  end if;

  v_erreur := url_recepteur_valide(new.url_recepteur);
  if v_erreur is not null then
    raise exception '%', v_erreur using errcode = '23514';
  end if;

  -- secret_defini n'est modifiable par aucun compte (absent des droits d'écriture) : seul definir_secret_evenement le pose.
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    new.secret_defini := false;
  else
    if new.contexte_id is distinct from old.contexte_id then
      raise exception 'Le contexte d''un événement suivi ne se change pas' using errcode = '23514';
    end if;
    -- Le secret ne part que vers l'adresse pour laquelle il a été donné : changer l'adresse l'efface.
    if new.url_recepteur is distinct from old.url_recepteur then
      update evenements_territoire_secrets set secret = null, updated_at = now() where evenement_territoire_id = new.id;
      new.secret_defini := false;
    end if;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger evenements_territoire_controle_trg
  before insert or update on public.evenements_territoire
  for each row execute function public.evenements_territoire_controle();

-- ---------------------------------------------------------------------
-- 4. Contrôles des émissions
-- ---------------------------------------------------------------------
create or replace function public.emissions_evenements_avant_insertion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lien evenements_territoire%rowtype;
  v_incident incidents%rowtype;
begin
  select * into v_lien from evenements_territoire where id = new.evenement_territoire_id;
  if not found then
    raise exception 'Événement suivi introuvable' using errcode = '23503';
  end if;
  new.contexte_id := v_lien.contexte_id;

  if new.incident_id is not null then
    select * into v_incident from incidents where id = new.incident_id;
    if not found or v_incident.contexte_id <> new.contexte_id then
      raise exception 'L''incident n''appartient pas au contexte de l''événement suivi' using errcode = '23514';
    end if;
    if v_incident.est_exercice then
      raise exception 'Un incident d''exercice n''envoie jamais de message à un événement réel' using errcode = '23514';
    end if;
  end if;

  -- Un compte utilisateur n'écrit que des messages manuels, à valider. Les propositions automatiques
  -- viennent du déclencheur sur les incidents, qui l'annonce par un réglage valable le temps de la transaction.
  if coalesce(current_setting('crisiware.proposition_auto', true), '') <> '1' then
    if not v_lien.actif then
      raise exception 'Cet événement n''est plus suivi (désactivé)' using errcode = '23514';
    end if;
    new.declencheur := 'manuel';
    new.phase_incident := null;
    new.statut := 'a_valider';
    new.propose_par := auth.uid();
  end if;
  new.motif_annulation := null;
  new.propose_le := now();
  new.envoye_le := null;
  new.envoye_par := null;
  new.tentatives := 0;
  new.derniere_tentative_le := null;
  new.code_reponse := null;
  new.reponse_extrait := null;
  new.erreur := null;
  return new;
end;
$$;

create trigger emissions_evenements_avant_insertion_trg
  before insert on public.emissions_evenements
  for each row execute function public.emissions_evenements_avant_insertion();

create or replace function public.emissions_evenements_avant_modification()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.statut in ('envoye', 'annule') then
    raise exception 'Cette émission est définitive (statut : %)', old.statut using errcode = '23514';
  end if;
  if new.id is distinct from old.id
     or new.contexte_id is distinct from old.contexte_id
     or new.evenement_territoire_id is distinct from old.evenement_territoire_id
     or new.incident_id is distinct from old.incident_id
     or new.declencheur is distinct from old.declencheur
     or (new.phase_incident is distinct from old.phase_incident and current_user = 'authenticated')
     or (new.propose_le is distinct from old.propose_le and current_user = 'authenticated')
     or new.propose_par is distinct from old.propose_par
     or new.created_at is distinct from old.created_at then
    raise exception 'Ces champs d''une émission ne se modifient pas' using errcode = '23514';
  end if;
  if current_user = 'authenticated' then
    -- Un compte utilisateur modifie le texte, ou annule : jamais « envoyé » ni « échec » (c'est l'envoi qui les pose).
    if new.statut is distinct from old.statut then
      if new.statut <> 'annule' then
        raise exception 'Seul l''envoi change le statut d''une émission (hors annulation)' using errcode = '23514';
      end if;
      new.motif_annulation := coalesce(nullif(btrim(new.motif_annulation), ''), 'Annulée par le Comité de Coordination');
    else
      new.motif_annulation := old.motif_annulation;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger emissions_evenements_avant_modification_trg
  before update on public.emissions_evenements
  for each row execute function public.emissions_evenements_avant_modification();

-- ---------------------------------------------------------------------
-- 5. Droits et RLS
-- ---------------------------------------------------------------------
alter table public.evenements_territoire enable row level security;
alter table public.emissions_evenements enable row level security;

revoke all on public.evenements_territoire from public, anon, authenticated;
revoke all on public.emissions_evenements from public, anon, authenticated;

grant select on public.evenements_territoire to authenticated;
grant insert (contexte_id, nom, organisateur, jeton_public, url_recepteur, entete_secret, date_debut, date_fin, actif, notes)
  on public.evenements_territoire to authenticated;
grant update (nom, organisateur, jeton_public, url_recepteur, entete_secret, date_debut, date_fin, actif, notes)
  on public.evenements_territoire to authenticated;
grant delete on public.evenements_territoire to authenticated;

grant select on public.emissions_evenements to authenticated;
grant insert (evenement_territoire_id, incident_id, niveau, titre, message, consigne)
  on public.emissions_evenements to authenticated;
grant update (niveau, titre, message, consigne, statut, motif_annulation)
  on public.emissions_evenements to authenticated;

create policy "lecture si lecture communication" on public.evenements_territoire
  for select to authenticated using (a_capacite(contexte_id, 'communication', 'lire'));
create policy "ajout si creation communication" on public.evenements_territoire
  for insert to authenticated with check (a_capacite(contexte_id, 'communication', 'creer'));
create policy "modif si modification communication" on public.evenements_territoire
  for update to authenticated using (a_capacite(contexte_id, 'communication', 'modifier'))
  with check (a_capacite(contexte_id, 'communication', 'modifier'));
create policy "suppr si suppression communication" on public.evenements_territoire
  for delete to authenticated using (a_capacite(contexte_id, 'communication', 'supprimer'));

create policy "lecture si lecture communication" on public.emissions_evenements
  for select to authenticated using (a_capacite(contexte_id, 'communication', 'lire'));
create policy "ajout si creation communication" on public.emissions_evenements
  for insert to authenticated with check (a_capacite(contexte_id, 'communication', 'creer'));
create policy "modif si creation communication" on public.emissions_evenements
  for update to authenticated using (a_capacite(contexte_id, 'communication', 'creer'))
  with check (a_capacite(contexte_id, 'communication', 'creer'));

-- ---------------------------------------------------------------------
-- 6. Secret d'émission : écriture seule
-- ---------------------------------------------------------------------
create or replace function public.definir_secret_evenement(p_evenement_id uuid, p_secret text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contexte uuid;
begin
  select contexte_id into v_contexte from evenements_territoire where id = p_evenement_id;
  if v_contexte is null then
    raise exception 'Événement suivi introuvable' using errcode = 'P0002';
  end if;
  if not a_capacite(v_contexte, 'communication', 'modifier') then
    raise exception 'Droits insuffisants' using errcode = '42501';
  end if;
  if p_secret is not null and btrim(p_secret) <> '' and length(btrim(p_secret)) < 16 then
    raise exception 'Le secret doit comporter au moins 16 caractères' using errcode = '23514';
  end if;

  if p_secret is null or btrim(p_secret) = '' then
    update evenements_territoire_secrets set secret = null, updated_at = now() where evenement_territoire_id = p_evenement_id;
    update evenements_territoire set secret_defini = false where id = p_evenement_id;
  else
    insert into evenements_territoire_secrets (evenement_territoire_id, secret)
    values (p_evenement_id, btrim(p_secret))
    on conflict (evenement_territoire_id) do update set secret = excluded.secret, updated_at = now();
    update evenements_territoire set secret_defini = true where id = p_evenement_id;
  end if;
end;
$$;

revoke all on function public.definir_secret_evenement(uuid, text) from public, anon;
grant execute on function public.definir_secret_evenement(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7. Propositions automatiques quand la phase de l'incident change
-- ---------------------------------------------------------------------
create or replace function public.texte_proposition_evenement(p_niveau text, p_commune text, p_type text)
returns table(titre text, message text, consigne text)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    case p_niveau
      when 'vigilance' then format('%s : pré-alerte communale (%s)', p_commune, p_type)
      when 'urgence' then format('%s : alerte communale (%s)', p_commune, p_type)
      else format('%s : fin de l''alerte communale (%s)', p_commune, p_type)
    end,
    case p_niveau
      when 'vigilance' then format(
        'La commune de %s est en pré-alerte (%s). Organisateurs d''événements sur son territoire : suivez l''évolution de la situation et préparez dès maintenant l''information du public et l''évacuation de votre site.',
        p_commune, p_type)
      when 'urgence' then format(
        'La commune de %s est en phase d''alerte (%s). Organisateurs d''événements sur son territoire : évaluez immédiatement l''impact sur votre événement (public présent, accès des secours), appliquez votre plan d''urgence et prenez contact avec le poste de commandement communal. L''autorité peut décider la suspension ou l''évacuation.',
        p_commune, p_type)
      else format(
        'L''alerte communale (%s) de %s est levée. Ne reprenez le cours de votre événement qu''après avoir vérifié la sécurité du site.',
        p_type, p_commune)
    end,
    case p_niveau
      when 'vigilance' then 'Préparer votre plan d''urgence ; rester joignable par le Comité de Coordination communal.'
      when 'urgence' then 'Évaluer l''impact, appliquer votre plan d''urgence, informer le public, contacter le poste de commandement communal.'
      else null
    end;
$$;

create or replace function public.incidents_proposer_emissions_evenements()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_niveau text;
  v_commune text;
  v_type text;
  v_texte record;
  v_lien record;
  v_rang constant text[] := array['information', 'vigilance', 'urgence', 'evacuation'];
begin
  -- Ce déclencheur est accessoire : il ne doit JAMAIS empêcher le Comité de Coordination de changer la phase.
  begin
    if new.est_exercice then
      return new;
    end if;
    if tg_op = 'UPDATE' then
      if new.phase_cycle_vie is not distinct from old.phase_cycle_vie then
        return new;
      end if;
    end if;

    v_niveau := case new.phase_cycle_vie
      when 'pre_alerte' then 'vigilance'
      when 'alerte' then 'urgence'
      when 'phase_active' then 'urgence'
      when 'levee' then 'information'
      else null
    end;
    if v_niveau is null then
      return new;
    end if;

    select c.nom into v_commune from contextes c where c.id = new.contexte_id and not c.est_plateforme;
    if v_commune is null then
      return new;
    end if;
    v_type := coalesce(nullif(btrim(new.type_evenement), ''), 'événement');
    select * into v_texte from texte_proposition_evenement(v_niveau, v_commune, v_type);
    perform set_config('crisiware.proposition_auto', '1', true);

    for v_lien in
      select e.id
      from evenements_territoire e
      where e.contexte_id = new.contexte_id
        and e.actif
        and (e.date_fin is null or e.date_fin >= (now() at time zone 'Europe/Brussels')::date)
        and (e.date_debut is null or e.date_debut <= (now() at time zone 'Europe/Brussels')::date + 2)
    loop
      if new.phase_cycle_vie = 'levee' then
        -- Une proposition jamais envoyée n'a plus lieu d'être ; une levée n'est proposée que si une alerte est réellement partie.
        update emissions_evenements
          set statut = 'annule', motif_annulation = 'Alerte levée avant l''envoi'
          where evenement_territoire_id = v_lien.id and incident_id = new.id and statut = 'a_valider';
        if exists (
          select 1 from emissions_evenements
          where evenement_territoire_id = v_lien.id and incident_id = new.id and statut = 'envoye' and niveau <> 'information'
        ) then
          insert into emissions_evenements (evenement_territoire_id, incident_id, declencheur, phase_incident, niveau, titre, message, consigne, propose_par)
          values (v_lien.id, new.id, 'phase_incident', new.phase_cycle_vie, v_niveau, v_texte.titre, v_texte.message, v_texte.consigne, auth.uid())
          on conflict (evenement_territoire_id, incident_id) where statut = 'a_valider' and incident_id is not null do nothing;
        end if;
      else
        -- Pas de doublon : si un message de ce niveau (ou plus grave) est déjà parti pour cet incident, on ne repropose pas.
        if not exists (
          select 1 from emissions_evenements x
          where x.evenement_territoire_id = v_lien.id and x.incident_id = new.id and x.statut = 'envoye'
            and array_position(v_rang, x.niveau) >= array_position(v_rang, v_niveau)
        ) then
          insert into emissions_evenements (evenement_territoire_id, incident_id, declencheur, phase_incident, niveau, titre, message, consigne, propose_par)
          values (v_lien.id, new.id, 'phase_incident', new.phase_cycle_vie, v_niveau, v_texte.titre, v_texte.message, v_texte.consigne, auth.uid())
          on conflict (evenement_territoire_id, incident_id) where statut = 'a_valider' and incident_id is not null
          do update set phase_incident = excluded.phase_incident, niveau = excluded.niveau, titre = excluded.titre,
                        message = excluded.message, consigne = excluded.consigne, propose_le = now();
        end if;
      end if;
    end loop;
    perform set_config('crisiware.proposition_auto', '', true);
  exception when others then
    perform set_config('crisiware.proposition_auto', '', true);
    raise warning 'incidents_proposer_emissions_evenements : %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger incidents_proposer_emissions_evenements_trg
  after insert or update of phase_cycle_vie on public.incidents
  for each row execute function public.incidents_proposer_emissions_evenements();

-- ---------------------------------------------------------------------
-- 8. Envoi d'une émission (appel HTTP depuis la base, un message à la fois)
-- ---------------------------------------------------------------------
create or replace function public.envoyer_emission_evenement(p_emission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  e emissions_evenements%rowtype;
  l evenements_territoire%rowtype;
  v_secret text;
  v_commune text;
  v_incident incidents%rowtype;
  v_charge jsonb;
  v_reponse extensions.http_response;
  v_statut text;
  v_erreur text;
  v_code integer;
  v_extrait text;
begin
  select * into e from emissions_evenements where id = p_emission_id for update;
  if not found then
    raise exception 'Émission introuvable' using errcode = 'P0002';
  end if;
  if not a_capacite(e.contexte_id, 'communication', 'creer') then
    raise exception 'Droits insuffisants' using errcode = '42501';
  end if;
  if e.statut not in ('a_valider', 'echec') then
    raise exception 'Cette émission n''est plus à envoyer (statut : %)', e.statut using errcode = '23514';
  end if;

  select * into l from evenements_territoire where id = e.evenement_territoire_id;
  if not l.actif then
    raise exception 'Cet événement n''est plus suivi (désactivé)' using errcode = '23514';
  end if;
  if l.url_recepteur is null then
    raise exception 'Aucune adresse de réception n''est renseignée pour cet événement' using errcode = '23514';
  end if;
  select secret into v_secret from evenements_territoire_secrets where evenement_territoire_id = l.id;
  if v_secret is null then
    raise exception 'Aucun secret n''est défini pour cet événement' using errcode = '23514';
  end if;

  if e.incident_id is not null then
    select * into v_incident from incidents where id = e.incident_id;
    if found and v_incident.est_exercice then
      raise exception 'Un incident d''exercice n''envoie jamais de message à un événement réel' using errcode = '23514';
    end if;
  end if;
  select nom into v_commune from contextes where id = e.contexte_id;

  v_charge := jsonb_build_object(
    'source', 'crisiware',
    'commune', v_commune,
    'evenement', jsonb_build_object('nom', l.nom, 'jeton_public', l.jeton_public),
    'incident', case when e.incident_id is null then null
                     else jsonb_build_object('type', v_incident.type_evenement, 'phase', e.phase_incident) end,
    'alerte', jsonb_build_object(
      'reference', e.id,
      'niveau', e.niveau,
      'titre', e.titre,
      'message', e.message,
      'consigne', e.consigne,
      'emise_le', now()
    )
  );

  begin
    -- Le rôle de l'API (authenticated) est coupé par la base à 8 s : si la requête sortante durait autant, l'envoi pourrait
    -- aboutir chez l'organisateur sans que son résultat soit enregistré. Délais volontairement plus courts.
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '5000');
    perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS', '3000');
    v_reponse := extensions.http((
      'POST',
      l.url_recepteur,
      array[
        extensions.http_header(l.entete_secret, v_secret),
        extensions.http_header('Accept', 'application/json'),
        extensions.http_header('User-Agent', 'Crisiware-pont/1')
      ],
      'application/json',
      v_charge::text
    )::extensions.http_request);
    v_code := v_reponse.status;
    -- Un récepteur qui renverrait nos en-têtes ne doit pas faire entrer le secret dans notre journal.
    v_extrait := replace(left(coalesce(v_reponse.content, ''), 500), v_secret, '[secret]');
    if v_code between 200 and 299 then
      v_statut := 'envoye';
    else
      v_statut := 'echec';
      v_erreur := 'Réponse HTTP ' || v_code;
    end if;
  exception when others then
    v_statut := 'echec';
    v_erreur := replace(left(sqlerrm, 300), v_secret, '[secret]');
  end;

  update emissions_evenements
  set statut = v_statut,
      code_reponse = v_code,
      reponse_extrait = nullif(v_extrait, ''),
      erreur = v_erreur,
      tentatives = tentatives + 1,
      derniere_tentative_le = now(),
      envoye_le = case when v_statut = 'envoye' then now() else envoye_le end,
      envoye_par = case when v_statut = 'envoye' then auth.uid() else envoye_par end
  where id = e.id;

  return jsonb_build_object('statut', v_statut, 'code', v_code, 'erreur', v_erreur);
end;
$$;

revoke all on function public.envoyer_emission_evenement(uuid) from public, anon;
grant execute on function public.envoyer_emission_evenement(uuid) to authenticated, service_role;

-- Les fonctions de déclencheur ne sont pas faites pour être appelées à la main : on retire EXECUTE aux rôles de l'API.
-- (Les déclencheurs continuent de fonctionner : le droit EXECUTE n'est vérifié qu'à la création du déclencheur.)
revoke all on function public.evenements_territoire_controle() from public, anon, authenticated;
revoke all on function public.emissions_evenements_avant_insertion() from public, anon, authenticated;
revoke all on function public.incidents_proposer_emissions_evenements() from public, anon, authenticated;
revoke all on function public.emissions_evenements_avant_modification() from public, anon, authenticated;
