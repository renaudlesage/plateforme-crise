-- Briefing 03, partie D — exercice conjoint avec un organisateur (miroir du briefing 02, Eventware).
--
-- Invariants, imposés en base (l'Edge Function ne fait qu'aiguiller) :
--   E1. Un incident d'exercice n'envoie jamais rien à un événement suivi réel.
--   E2. Un incident réel (ou un message sans incident) n'envoie jamais rien à un événement suivi d'exercice.
--   E3. Une alerte reçue marquée exercice n'entre jamais dans alertes_publiques.
--   E4. Une source réelle n'accepte jamais une charge marquée exercice ; une source d'exercice refuse une charge
--       non marquée.
--
-- 1. exercices.conjoint et code_conjoint (généré, unique, à transmettre à l'organisateur).
-- 2. evenements_territoire et sources_externes_alertes : est_exercice et exercice_id. Un événement suivi ou une
--    source d'exercice n'appartient qu'à son exercice (même commune, exercice conjoint) ; ils sont désactivés à
--    la clôture et ne se réactivent plus.
-- 3. Propositions automatiques : un incident d'exercice conjoint ne propose qu'aux événements d'exercice de son
--    exercice ; un incident réel, qu'aux événements réels (comportement réel inchangé sinon).
-- 4. Envoi : un incident d'exercice n'envoie qu'à un événement d'exercice de son exercice en cours, avec
--    « exercice » : { « code » } dans la charge ; l'inverse est refusé. La charge est construite par
--    emission_charge(), testable sans appel HTTP.
-- 5. Réception : recevoir_alerte_exercice() (clé de service) écrit l'alerte d'exercice au livre de bord de
--    l'incident d'exercice et dans la chronologie de l'exercice, jamais dans alertes_publiques. Une source
--    d'exercice ne peut alimenter ni alertes_publiques ni les dossiers d'événements.
-- 6. clore_exercice désactive les événements suivis et les sources de l'exercice.

-- 1. Exercices conjoints ------------------------------------------------------------------------

alter table public.exercices
  add column if not exists conjoint boolean not null default false,
  add column if not exists code_conjoint text;
create unique index if not exists exercices_code_conjoint_uq on public.exercices (code_conjoint) where code_conjoint is not null;

create or replace function public.exercices_conjoint_avant_ecriture()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if tg_op = 'UPDATE' and old.statut <> 'preparation' and new.conjoint is distinct from old.conjoint then
    raise exception 'Le caractère conjoint d''un exercice se fixe avant le démarrage';
  end if;
  -- Le code est toujours généré par le serveur et ne change plus une fois attribué.
  if new.conjoint then
    if tg_op = 'UPDATE' and old.code_conjoint is not null then
      new.code_conjoint := old.code_conjoint;
    else
      new.code_conjoint := 'EXC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    end if;
  else
    new.code_conjoint := null;
  end if;
  return new;
end;
$function$;

revoke all on function public.exercices_conjoint_avant_ecriture() from public, anon, authenticated;

create or replace trigger exercices_conjoint_avant_ecriture_trg
  before insert or update on public.exercices
  for each row execute function public.exercices_conjoint_avant_ecriture();

-- 2. Événements suivis et sources d'exercice ----------------------------------------------------

alter table public.evenements_territoire
  add column if not exists est_exercice boolean not null default false,
  add column if not exists exercice_id uuid references public.exercices(id) on delete cascade;
alter table public.evenements_territoire
  add constraint evenements_territoire_exercice_coherent check (est_exercice = (exercice_id is not null));

alter table public.sources_externes_alertes
  add column if not exists est_exercice boolean not null default false,
  add column if not exists exercice_id uuid references public.exercices(id) on delete cascade;
alter table public.sources_externes_alertes
  add constraint sources_externes_alertes_exercice_coherent check (est_exercice = (exercice_id is not null));

-- Commun aux deux tables : l'exercice appartient à la commune et est conjoint ; le lien ne change pas ;
-- rien ne se réactive après la clôture.
create or replace function public.lien_exercice_controle()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_ex exercices%rowtype;
begin
  if tg_op = 'UPDATE' and (new.est_exercice is distinct from old.est_exercice or new.exercice_id is distinct from old.exercice_id) then
    raise exception 'Le rattachement à un exercice ne se modifie pas';
  end if;
  if new.exercice_id is null then
    return new;
  end if;
  select * into v_ex from exercices where id = new.exercice_id;
  if not found or v_ex.contexte_id <> new.contexte_id then
    raise exception 'L''exercice n''appartient pas à cette commune';
  end if;
  if not v_ex.conjoint then
    raise exception 'Seul un exercice conjoint a des événements suivis et des sources d''exercice';
  end if;
  if v_ex.statut = 'termine' and new.actif then
    raise exception 'Exercice terminé : son événement ou sa source ne se réactive plus';
  end if;
  return new;
end;
$function$;

revoke all on function public.lien_exercice_controle() from public, anon, authenticated;

create or replace trigger evenements_territoire_lien_exercice_trg
  before insert or update on public.evenements_territoire
  for each row execute function public.lien_exercice_controle();
create or replace trigger sources_externes_alertes_lien_exercice_trg
  before insert or update on public.sources_externes_alertes
  for each row execute function public.lien_exercice_controle();

-- Une source d'exercice n'alimente ni les alertes publiques (E3) ni les dossiers d'événements.
create or replace function public.pas_de_source_exercice()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.source_externe_id is not null
     and exists (select 1 from sources_externes_alertes s where s.id = new.source_externe_id and s.est_exercice) then
    raise exception 'Une source d''exercice n''alimente jamais %', case tg_table_name
      when 'alertes_publiques' then 'les alertes publiques' else 'les dossiers d''événements' end;
  end if;
  return new;
end;
$function$;

revoke all on function public.pas_de_source_exercice() from public, anon, authenticated;

create or replace trigger alertes_publiques_pas_de_source_exercice_trg
  before insert or update on public.alertes_publiques
  for each row execute function public.pas_de_source_exercice();
create or replace trigger evenements_territoire_dossiers_pas_de_source_exercice_trg
  before insert or update on public.evenements_territoire_dossiers
  for each row execute function public.pas_de_source_exercice();

-- Le livre de bord accepte la provenance « eventware » (alerte d'exercice reçue de l'organisateur).
alter table public.livre_de_bord drop constraint if exists livre_de_bord_source_type_check;
alter table public.livre_de_bord
  add constraint livre_de_bord_source_type_check check (source_type in ('rapport_can', 'photo', 'eventware'));

-- 3. Propositions et contrôle des émissions ---------------------------------------------------------

-- Exercice conjoint non terminé dont l'incident est p_incident (null sinon).
create or replace function public.exercice_conjoint_de_incident(p_incident uuid)
 returns uuid
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select x.id from exercices x where x.incident_id = p_incident and x.conjoint and x.statut <> 'termine' limit 1;
$function$;

revoke all on function public.exercice_conjoint_de_incident(uuid) from public, anon, authenticated;

create or replace function public.emissions_evenements_avant_insertion()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
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
  end if;

  -- E1 / E2 : un événement d'exercice ne reçoit que de l'incident de son exercice, un événement réel jamais d'un exercice.
  if v_lien.est_exercice then
    if new.incident_id is null or not v_incident.est_exercice
       or exercice_conjoint_de_incident(new.incident_id) is distinct from v_lien.exercice_id then
      raise exception 'Un événement suivi d''exercice ne reçoit que les messages de l''incident de son exercice' using errcode = '23514';
    end if;
  elsif new.incident_id is not null and v_incident.est_exercice then
    raise exception 'Un incident d''exercice n''envoie jamais de message à un événement réel' using errcode = '23514';
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
$function$;

create or replace function public.incidents_proposer_emissions_evenements()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_niveau text;
  v_commune text;
  v_type text;
  v_texte record;
  v_lien record;
  v_exercice uuid;
  v_titre text;
  v_rang constant text[] := array['information', 'vigilance', 'urgence', 'evacuation'];
begin
  -- Ce déclencheur est accessoire : il ne doit JAMAIS empêcher le Comité de Coordination de changer la phase.
  begin
    -- Un incident d'exercice ne propose rien, sauf celui d'un exercice conjoint, à ses seuls événements d'exercice.
    if new.est_exercice then
      v_exercice := exercice_conjoint_de_incident(new.id);
      if v_exercice is null then
        return new;
      end if;
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
    v_titre := case when new.est_exercice then left('EXERCICE — ' || v_texte.titre, 200) else v_texte.titre end;
    perform set_config('crisiware.proposition_auto', '1', true);

    for v_lien in
      select e.id
      from evenements_territoire e
      where e.contexte_id = new.contexte_id
        and e.actif
        and e.est_exercice = new.est_exercice
        and (not new.est_exercice or e.exercice_id = v_exercice)
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
          values (v_lien.id, new.id, 'phase_incident', new.phase_cycle_vie, v_niveau, v_titre, v_texte.message, v_texte.consigne, auth.uid())
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
          values (v_lien.id, new.id, 'phase_incident', new.phase_cycle_vie, v_niveau, v_titre, v_texte.message, v_texte.consigne, auth.uid())
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
$function$;

-- 4. Envoi -------------------------------------------------------------------------------------------

-- Charge envoyée à l'organisateur pour une émission ; refuse toute émission qui violerait E1 ou E2.
create or replace function public.emission_charge(p_emission uuid)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  e emissions_evenements%rowtype;
  l evenements_territoire%rowtype;
  v_incident incidents%rowtype;
  v_commune text;
  v_code text;
  v_charge jsonb;
begin
  select * into e from emissions_evenements where id = p_emission;
  if not found then
    raise exception 'Émission introuvable' using errcode = 'P0002';
  end if;
  select * into l from evenements_territoire where id = e.evenement_territoire_id;
  if e.incident_id is not null then
    select * into v_incident from incidents where id = e.incident_id;
  end if;

  if l.est_exercice then
    -- E2 : seul l'incident de l'exercice, en cours, écrit à un événement d'exercice.
    select x.code_conjoint into v_code from exercices x
     where x.id = l.exercice_id and x.conjoint and x.statut = 'en_cours'
       and e.incident_id is not null and x.incident_id = e.incident_id;
    if v_code is null then
      raise exception 'Un événement suivi d''exercice ne reçoit que les messages de l''incident de son exercice en cours' using errcode = '23514';
    end if;
  elsif v_incident.est_exercice then
    -- E1.
    raise exception 'Un incident d''exercice n''envoie jamais de message à un événement réel' using errcode = '23514';
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
  if v_code is not null then
    v_charge := v_charge || jsonb_build_object('exercice', jsonb_build_object('code', v_code));
  end if;
  return v_charge;
end;
$function$;

revoke all on function public.emission_charge(uuid) from public, anon, authenticated;

create or replace function public.envoyer_emission_evenement(p_emission_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  e emissions_evenements%rowtype;
  l evenements_territoire%rowtype;
  v_secret text;
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

  -- E1 et E2 sont vérifiés ici, avant tout appel HTTP : une violation lève une exception.
  v_charge := emission_charge(e.id);

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
$function$;

revoke all on function public.envoyer_emission_evenement(uuid) from public, anon;
grant execute on function public.envoyer_emission_evenement(uuid) to authenticated, service_role;

-- 5. Réception d'une alerte d'exercice (clé de service seulement) -----------------------------------------

create or replace function public.recevoir_alerte_exercice(p_source uuid, p_charge jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_src sources_externes_alertes%rowtype;
  v_ex exercices%rowtype;
  v_a jsonb := p_charge -> 'alerte';
  v_texte text;
  v_ldb uuid;
  v_obs uuid;
begin
  select * into v_src from sources_externes_alertes where id = p_source;
  if not found or not v_src.actif or v_src.deleted_at is not null or not 'alerte' = any (v_src.objets) then
    raise exception 'Source inconnue, inactive ou non autorisée pour les alertes';
  end if;
  -- E4.
  if not v_src.est_exercice then
    raise exception 'Une source réelle n''accepte jamais une charge marquée exercice';
  end if;
  select * into v_ex from exercices where id = v_src.exercice_id;
  if coalesce(p_charge -> 'exercice' ->> 'code', '') is distinct from v_ex.code_conjoint then
    raise exception 'Code d''exercice inconnu pour cette source';
  end if;
  if v_ex.statut <> 'en_cours' then
    raise exception 'L''exercice n''est pas en cours';
  end if;
  if coalesce(btrim(v_a ->> 'titre'), '') = '' or coalesce(btrim(v_a ->> 'message'), '') = '' then
    raise exception 'Charge invalide : titre et message requis';
  end if;

  v_texte := left('Alerte reçue de l''organisateur (' || coalesce(nullif(v_a ->> 'niveau', ''), 'niveau non précisé') || ') : '
                  || (v_a ->> 'titre') || ' — ' || (v_a ->> 'message')
                  || coalesce(' Consigne : ' || nullif(v_a ->> 'consigne', ''), ''), 2000);

  -- E3 : rien dans alertes_publiques ; le livre de bord de l'incident d'exercice et la chronologie de l'exercice.
  if v_ex.incident_id is not null then
    insert into livre_de_bord (incident_id, message, source_type)
    values (v_ex.incident_id, '[EXERCICE] ' || v_texte, 'eventware')
    returning id into v_ldb;
  end if;
  insert into exercice_observations (exercice_id, note, role_observateur, observateur_id)
  values (v_ex.id, v_texte, 'Organisateur (Eventware)', null)
  returning id into v_obs;

  return jsonb_build_object('resultat', 'recu', 'exercice_id', v_ex.id, 'livre_de_bord_id', v_ldb, 'observation_id', v_obs);
end;
$function$;

revoke all on function public.recevoir_alerte_exercice(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.recevoir_alerte_exercice(uuid, jsonb) to service_role;

-- 6. Clôture ------------------------------------------------------------------------------------------------

create or replace function public.clore_exercice(p_exercice uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_ex public.exercices%rowtype;
  v_syn jsonb;
begin
  select * into v_ex from public.exercices where id = p_exercice;
  if not found or not public.peut_animer_exercice(p_exercice, 'modifier') then
    raise exception 'Accès refusé';
  end if;
  if v_ex.statut <> 'en_cours' then
    raise exception 'Seul un exercice en cours peut être clos';
  end if;
  update public.exercices set fin_reelle = now() where id = p_exercice;
  v_syn := public.synthese_exercice(p_exercice);
  update public.exercices
     set statut = 'termine',
         synthese = v_syn,
         date_realisee = (now() at time zone 'Europe/Brussels')::date
   where id = p_exercice;
  if v_ex.incident_id is not null then
    update public.incidents set statut = 'cloture', date_fin = now()
     where id = v_ex.incident_id and est_exercice and statut <> 'cloture';
  end if;
  -- Exercice conjoint : ses événements suivis et ses sources cessent de recevoir et d'envoyer.
  update public.evenements_territoire set actif = false where exercice_id = p_exercice and actif;
  update public.sources_externes_alertes set actif = false where exercice_id = p_exercice and actif;
  return v_syn;
end $function$;
