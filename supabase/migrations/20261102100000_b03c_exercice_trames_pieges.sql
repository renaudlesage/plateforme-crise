-- Briefing 03, partie C — trames d'exercice et pièges de la commune.
--
-- 1. exercice_trames : scénarios réutilisables, même structure que celle d'Eventware (catalogue
--    commun à venir). contexte_id null = catalogue de la plateforme (super-admin) ; sinon trame
--    propre à une commune. CRUD complet par l'interface ; cette migration n'initialise que trois
--    trames de départ.
-- 2. pieges_commune(p_contexte) : défauts de préparation de la commune qu'un exercice peut
--    exploiter. Même signature de retour que avant_vol d'Eventware.
-- 3. generer_exercice_commune(...) : crée un exercice en préparation (objectifs, stimuli, actions
--    attendues, sources) à partir d'une trame et des pièges détectés. Il se joue ensuite avec
--    demarrer_exercice, lancer_stimulus et clore_exercice, inchangés.
--
-- Trames initiales : tirées des fiches du dépôt, sans fait ajouté. Orages (STARTER-REX-2026-ORAGES)
-- et cyberattaque (STARTER-REX-2026-CYBER) reprennent les « injects d'exercice table-top » et les
-- « pièges observés » des fiches ; le scénario nucléaire enchaîne les déclencheurs des fiches PUI/PPUI
-- STARTER-N1 à N6 (horaires indicatifs : les fiches n'en donnent pas). Les cartes REX « Hautes
-- Fagnes » et « confinement Moselle » sont introuvables dans le code et la base : pas de trame
-- tant que leur contenu n'est pas fourni.

-- 1. Table ------------------------------------------------------------------------------------

create table if not exists public.exercice_trames (
  id uuid primary key default gen_random_uuid(),
  contexte_id uuid references public.contextes(id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9-]{1,59}$'),
  titre text not null check (char_length(btrim(titre)) between 3 and 200),
  risque text check (risque is null or char_length(risque) <= 100),
  risque_territoire_id uuid references public.risques_territoire(id) on delete set null,
  objectifs jsonb not null default '[]'::jsonb,
  pieges_couverts text[] not null default '{}',
  stimuli jsonb not null default '[]'::jsonb,
  ordre integer not null default 100 check (ordre between 0 and 10000),
  actif boolean not null default true,
  source text check (source is null or char_length(source) <= 2000),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  constraint exercice_trames_risque_communal check (contexte_id is not null or risque_territoire_id is null)
);

create unique index if not exists exercice_trames_code_plateforme_uq on public.exercice_trames (code) where contexte_id is null;
create unique index if not exists exercice_trames_code_commune_uq on public.exercice_trames (contexte_id, code) where contexte_id is not null;

comment on table public.exercice_trames is
  'Trames d''exercice (briefing 03, partie C). contexte_id null : catalogue de la plateforme, modifiable par le super-admin ; sinon trame de la commune. objectifs : [{code, intitule, discipline}] ; stimuli : [{heure_scenario_min, canal, emetteur, discipline_cible, texte, note_animateur, piege}] ; pieges_couverts : codes de pieges_commune().';

-- Contrôle du contenu : mêmes vocabulaires que exercice_objectifs et exercice_stimuli.
create or replace function public.exercice_trames_avant_ecriture()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v jsonb;
  v_disciplines constant text[] := array['d1', 'd2', 'd3', 'd4', 'd5', 'pcops', 'bourgmestre'];
  v_canaux constant text[] := array['telephone', 'radio', 'mail', 'be_alert', 'terrain', 'media', 'citoyen', 'autre'];
begin
  if jsonb_typeof(new.objectifs) <> 'array' or jsonb_typeof(new.stimuli) <> 'array' then
    raise exception 'Objectifs et stimuli : listes attendues';
  end if;
  if jsonb_array_length(new.stimuli) > 100 or jsonb_array_length(new.objectifs) > 50 then
    raise exception 'Trame trop longue (100 stimuli et 50 objectifs au plus)';
  end if;
  for v in select * from jsonb_array_elements(new.objectifs) loop
    if coalesce(btrim(v ->> 'intitule'), '') = '' then
      raise exception 'Chaque objectif doit avoir un intitulé';
    end if;
    if (v ->> 'discipline') is not null and not (v ->> 'discipline') = any (v_disciplines) then
      raise exception 'Discipline d''objectif inconnue : %', v ->> 'discipline';
    end if;
  end loop;
  for v in select * from jsonb_array_elements(new.stimuli) loop
    if coalesce(btrim(v ->> 'texte'), '') = '' then
      raise exception 'Chaque stimulus doit avoir un texte';
    end if;
    if jsonb_typeof(v -> 'heure_scenario_min') is distinct from 'number' or (v ->> 'heure_scenario_min')::numeric < 0 then
      raise exception 'Heure de scénario invalide (minutes depuis le début, 0 ou plus)';
    end if;
    if not coalesce(v ->> 'canal', 'autre') = any (v_canaux) then
      raise exception 'Canal inconnu : %', v ->> 'canal';
    end if;
    if (v ->> 'discipline_cible') is not null and not (v ->> 'discipline_cible') = any (v_disciplines) then
      raise exception 'Discipline cible inconnue : %', v ->> 'discipline_cible';
    end if;
  end loop;
  if new.risque_territoire_id is not null and not exists (
       select 1 from risques_territoire r where r.id = new.risque_territoire_id and r.contexte_id = new.contexte_id) then
    raise exception 'Le risque lié doit appartenir à la même commune';
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function public.exercice_trames_avant_ecriture() from public, anon, authenticated;

create or replace trigger exercice_trames_avant_ecriture_trg
  before insert or update on public.exercice_trames
  for each row execute function public.exercice_trames_avant_ecriture();

alter table public.exercice_trames enable row level security;
revoke all on public.exercice_trames from public, anon;
grant select, insert, update, delete on public.exercice_trames to authenticated;

create policy "lecture trames" on public.exercice_trames
  for select to authenticated
  using (contexte_id is null or a_capacite(contexte_id, 'exercices', 'lire'));
create policy "creation trames" on public.exercice_trames
  for insert to authenticated
  with check (case when contexte_id is null then est_super_admin() else a_capacite(contexte_id, 'exercices', 'creer') end);
create policy "modification trames" on public.exercice_trames
  for update to authenticated
  using (case when contexte_id is null then est_super_admin() else a_capacite(contexte_id, 'exercices', 'modifier') end)
  with check (case when contexte_id is null then est_super_admin() else a_capacite(contexte_id, 'exercices', 'modifier') end);
create policy "suppression trames" on public.exercice_trames
  for delete to authenticated
  using (case when contexte_id is null then est_super_admin() else a_capacite(contexte_id, 'exercices', 'supprimer') end);

-- 2. Pièges de la commune ---------------------------------------------------------------------

create or replace function public.pieges_commune(p_contexte uuid)
 returns table(code text, gravite text, titre text, detail text, table_source text, source_id uuid, stimulus text, objectif text)
 language plpgsql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if p_contexte is null or not a_capacite(p_contexte, 'exercices', 'lire') then
    raise exception 'Accès refusé';
  end if;

  -- Instance de coordination sans membre.
  return query
  select 'instance_sans_membre'::text, 'haute'::text,
         'Instance « ' || i.type || ' » sans membre',
         'Aucun membre n''est rattaché à cette instance : personne n''est désigné pour la convoquer ni pour y siéger.',
         'instances_coordination'::text, i.id,
         'Il faut réunir l''instance « ' || i.type || ' » maintenant. Qui convoquez-vous, et par quel moyen ?',
         'Convoquer l''instance « ' || i.type || ' » et nommer ses membres.'
  from instances_coordination i
  where i.contexte_id = p_contexte
    and i.statut_activation is distinct from 'desactivee'
    and not exists (select 1 from instances_coordination_membres m where m.instance_id = i.id);

  -- Seuil d'action actif sans responsable.
  return query
  select 'seuil_sans_responsable'::text, 'moyenne'::text,
         'Seuil « ' || s.libelle || ' » sans responsable',
         'Aucun rôle n''est désigné pour déclencher ce seuil.',
         'seuils_action'::text, s.id,
         'Le seuil « ' || s.libelle || ' » est atteint. Qui le déclenche ?',
         'Désigner qui déclenche le seuil « ' || s.libelle || ' ».'
  from seuils_action s
  where s.contexte_id = p_contexte and s.actif and s.responsable_role_id is null;

  -- Seuil d'action actif sans action en mode dégradé.
  return query
  select 'seuil_sans_action_degradee'::text, 'moyenne'::text,
         'Seuil « ' || s.libelle || ' » sans mode dégradé',
         'Aucune action n''est prévue si les réseaux ou l''outil tombent.',
         'seuils_action'::text, s.id,
         'Le seuil « ' || s.libelle || ' » est atteint, mais le réseau et l''outil sont indisponibles. Comment l''appliquez-vous ?',
         'Appliquer le seuil « ' || s.libelle || ' » sans réseau.'
  from seuils_action s
  where s.contexte_id = p_contexte and s.actif and nullif(btrim(coalesce(s.action_degradee, '')), '') is null;

  -- Aucun centre d'accueil encodé.
  return query
  select 'aucun_centre_accueil'::text, 'haute'::text,
         'Aucun centre d''accueil encodé'::text,
         'Aucun lieu n''est prévu pour accueillir des personnes évacuées ou sinistrées.'::text,
         'centres_accueil'::text, null::uuid,
         'Des habitants doivent être mis à l''abri hors de chez eux. Où les accueillez-vous ?'::text,
         'Désigner et ouvrir un centre d''accueil.'::text
  where not exists (select 1 from centres_accueil c where c.contexte_id = p_contexte);

  -- Discipline sans contact actif.
  return query
  select 'discipline_sans_contact'::text, 'haute'::text,
         'Discipline « ' || d.libelle || ' » sans contact',
         'Aucun contact actif n''est rattaché à cette discipline dans l''annuaire.',
         'disciplines'::text, d.id,
         'Vous devez joindre la discipline « ' || d.libelle || ' ». Qui appelez-vous ?',
         'Joindre la discipline « ' || d.libelle || ' ».'
  from disciplines d
  where d.contexte_id = p_contexte and d.actif
    and not exists (select 1 from contacts c where c.discipline_id = d.id and c.actif);

  -- Discipline sans suppléant.
  return query
  select 'discipline_sans_suppleant'::text, 'moyenne'::text,
         'Discipline « ' || d.libelle || ' » sans suppléant',
         'Les contacts de cette discipline n''ont aucun suppléant actif dans l''annuaire.',
         'disciplines'::text, d.id,
         'Le contact habituel de la discipline « ' || d.libelle || ' » est injoignable. Qui le remplace ?',
         'Joindre un suppléant de la discipline « ' || d.libelle || ' ».'
  from disciplines d
  where d.contexte_id = p_contexte and d.actif
    and exists (select 1 from contacts c where c.discipline_id = d.id and c.actif)
    and not exists (select 1 from contacts s join contacts t on t.id = s.est_suppleant_de
                    where t.discipline_id = d.id and t.actif and s.actif);

  -- Risque du territoire sans message public prédéfini.
  return query
  select 'risque_sans_message'::text, 'moyenne'::text,
         'Risque « ' || r.titre || ' » sans message public',
         'Aucun message à la population n''est préparé pour ce risque.',
         'risques_territoire'::text, r.id,
         'La population demande quoi faire face au risque « ' || r.titre || ' ». Quel message publiez-vous, et quand ?',
         'Rédiger et valider le message public du risque « ' || r.titre || ' ».'
  from risques_territoire r
  where r.contexte_id = p_contexte and r.statut is distinct from 'ecarte'
    and nullif(btrim(coalesce(r.messages_publics_predefinis, '')), '') is null;
end;
$function$;

revoke all on function public.pieges_commune(uuid) from public, anon;
grant execute on function public.pieges_commune(uuid) to authenticated;

-- 3. Génération d'un exercice -----------------------------------------------------------------

create or replace function public.generer_exercice_commune(
  p_contexte uuid, p_trame uuid, p_titre text, p_mode_jeu text default 'sur_table',
  p_duree_min integer default null, p_max_pieges integer default 3
) returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_t exercice_trames%rowtype;
  v_ex uuid;
  v_risque uuid;
  v_max_heure integer;
  v_heure_piege integer;
  v_ordre integer := 0;
  v_obj jsonb;
  v_sti jsonb;
  v_obj_id uuid;
  v_sti_id uuid;
  p record;
begin
  if p_contexte is null or not a_capacite(p_contexte, 'exercices', 'creer') then
    raise exception 'Accès refusé';
  end if;
  select * into v_t from exercice_trames t
   where t.id = p_trame and t.actif and (t.contexte_id is null or t.contexte_id = p_contexte);
  if not found then
    raise exception 'Trame introuvable ou inactive';
  end if;
  if p_mode_jeu not in ('sur_table', 'dans_outil') then
    raise exception 'Mode de jeu inconnu';
  end if;
  if p_duree_min is not null and p_duree_min <= 0 then
    raise exception 'Durée invalide';
  end if;
  if jsonb_array_length(v_t.stimuli) = 0 then
    raise exception 'Cette trame n''a aucun stimulus';
  end if;

  v_risque := coalesce(v_t.risque_territoire_id,
                       (select r.id from risques_territoire r where r.contexte_id = p_contexte and r.code = v_t.risque limit 1));
  select max((s ->> 'heure_scenario_min')::integer) into v_max_heure from jsonb_array_elements(v_t.stimuli) s;

  -- Le temps du scénario est ramené à la durée réelle demandée (facteur de temps).
  insert into exercices (contexte_id, titre, type_exercice, mode_jeu, duree_minutes, facteur_temps, fiche_risque_id, objectifs)
  values (p_contexte, coalesce(nullif(btrim(p_titre), ''), v_t.titre),
          case when p_mode_jeu = 'dans_outil' then 'cpx' else 'ttx' end, p_mode_jeu, p_duree_min,
          case when p_duree_min is not null and v_max_heure > p_duree_min then round(v_max_heure::numeric / p_duree_min, 2) else 1 end,
          v_risque, 'Généré depuis la trame ' || v_t.code)
  returning id into v_ex;

  -- Objectifs de la trame.
  for v_obj in select * from jsonb_array_elements(v_t.objectifs) loop
    v_ordre := v_ordre + 1;
    insert into exercice_objectifs (exercice_id, ordre, code, intitule, discipline)
    values (v_ex, v_ordre, nullif(v_obj ->> 'code', ''), v_obj ->> 'intitule', nullif(v_obj ->> 'discipline', ''));
  end loop;

  -- Stimuli de la trame.
  v_ordre := 0;
  for v_sti in select * from jsonb_array_elements(v_t.stimuli) order by (value ->> 'heure_scenario_min')::integer loop
    v_ordre := v_ordre + 1;
    insert into exercice_stimuli (exercice_id, ordre, heure_scenario_min, canal, emetteur, discipline_cible, texte, note_animateur, objectif_id)
    values (v_ex, v_ordre, (v_sti ->> 'heure_scenario_min')::integer, coalesce(v_sti ->> 'canal', 'autre'),
            nullif(v_sti ->> 'emetteur', ''), nullif(v_sti ->> 'discipline_cible', ''), v_sti ->> 'texte',
            nullif(v_sti ->> 'note_animateur', ''),
            (select o.id from exercice_objectifs o where o.exercice_id = v_ex and o.code = v_sti ->> 'objectif' limit 1));
  end loop;

  -- Pièges : un par type de défaut, d'abord ceux que la trame couvre, puis les plus graves.
  v_heure_piege := greatest(1, coalesce(v_max_heure, 0) / 2);
  for p in
    select x.* from (
      select distinct on (pc.code) pc.*, (pc.code = any (v_t.pieges_couverts)) as couvert
      from pieges_commune(p_contexte) pc
      order by pc.code, pc.titre
    ) x
    order by x.couvert desc, case x.gravite when 'haute' then 0 when 'moyenne' then 1 else 2 end, x.titre
    limit greatest(coalesce(p_max_pieges, 3), 0)
  loop
    v_ordre := v_ordre + 1;
    insert into exercice_objectifs (exercice_id, ordre, code, intitule)
    values (v_ex, v_ordre, 'P-' || left(p.code, 30), p.objectif)
    returning id into v_obj_id;

    -- Un stimulus de la trame qui vise ce piège le porte ; sinon un stimulus d'animation est ajouté.
    select s.id into v_sti_id
    from exercice_stimuli s
    where s.exercice_id = v_ex
      and s.ordre = (select x.n from (select row_number() over (order by (e ->> 'heure_scenario_min')::integer) as n, e
                                      from jsonb_array_elements(v_t.stimuli) e) x
                     where x.e ->> 'piege' = p.code limit 1)
      and not exists (select 1 from exercice_sources so where so.stimulus_id = s.id);
    if v_sti_id is null then
      insert into exercice_stimuli (exercice_id, ordre, heure_scenario_min, canal, emetteur, texte, note_animateur, objectif_id)
      values (v_ex, v_ordre, v_heure_piege, 'autre', 'Animation', p.stimulus,
              'Piège : ' || p.titre || '. ' || p.detail, v_obj_id)
      returning id into v_sti_id;
    else
      update exercice_stimuli
         set objectif_id = coalesce(objectif_id, v_obj_id),
             note_animateur = left(coalesce(note_animateur || ' ', '') || 'Piège : ' || p.titre || '.', 2000)
       where id = v_sti_id;
    end if;

    insert into exercice_actions_attendues (exercice_id, objectif_id, stimulus_id, ordre, action)
    values (v_ex, v_obj_id, v_sti_id, v_ordre, p.objectif);
    insert into exercice_sources (exercice_id, stimulus_id, table_source, id_source, code_controle, description)
    values (v_ex, v_sti_id, p.table_source, p.source_id::text, p.code, p.titre || ' : ' || p.detail);
    v_sti_id := null;
  end loop;

  return v_ex;
end;
$function$;

revoke all on function public.generer_exercice_commune(uuid, uuid, text, text, integer, integer) from public, anon;
grant execute on function public.generer_exercice_commune(uuid, uuid, text, text, integer, integer) to authenticated;

-- 4. Trames de départ (catalogue de la plateforme) -------------------------------------------

insert into public.exercice_trames (contexte_id, code, titre, risque, objectifs, pieges_couverts, stimuli, ordre, source, created_by)
values
(null, 'REX-2026-ORAGES', 'Orages éclair du 30 mai 2026 : ruissellement et coulées de boue', 'STARTER-REX-2026-ORAGES',
 $j$[
  {"code": "O1", "intitule": "Pré-activer dès l'avertissement orange IRM (seuil S1), sans attendre l'appel du CORTEX ou du gouverneur.", "discipline": "bourgmestre"},
  {"code": "O2", "intitule": "Convoquer le CC sur les premiers signaux : au moins 3 signalements citoyens concordants ou la première intervention de la zone de secours (seuil S2).", "discipline": "bourgmestre"},
  {"code": "O3", "intitule": "Ne pas oublier le psychosocial et l'eau potable au profit du pompage.", "discipline": "d2"},
  {"code": "O4", "intitule": "Ne pas démobiliser trop tôt : la levée provinciale ne vide pas les caves.", "discipline": "bourgmestre"},
  {"code": "O5", "intitule": "Documenter : décisions horodatées au journal, heure de réception de l'alerte, photos.", "discipline": "d5"}
 ]$j$::jsonb,
 array['seuil_sans_responsable', 'instance_sans_membre', 'aucun_centre_accueil', 'discipline_sans_suppleant'],
 $j$[
  {"heure_scenario_min": 0, "canal": "autre", "emetteur": "IRM", "discipline_cible": "bourgmestre", "texte": "16h00 : avertissement orange IRM « orages ». Que faites-vous dans les 30 minutes ?", "note_animateur": "Inject de la fiche orages. Attendu : seuil S1, sans attendre le CORTEX ni le gouverneur (piège 1 du REX).", "piege": "seuil_sans_responsable", "objectif": "O1"},
  {"heure_scenario_min": 160, "canal": "citoyen", "emetteur": "Signalements citoyens", "discipline_cible": "bourgmestre", "texte": "18h40 : trois signalements « cave inondée » rue [X], une « coulée de boue » route [Y], une « personne bloquée en voiture » au passage sous voie [Z].", "note_animateur": "Inject de la fiche orages. Seuil S2 : convoquer le CC. Remplacer [X], [Y], [Z] par des lieux de la commune.", "piege": "instance_sans_membre", "objectif": "O2"},
  {"heure_scenario_min": 195, "canal": "telephone", "emetteur": "Zone de secours", "discipline_cible": "d4", "texte": "19h15 : la zone de secours annonce 40 interventions en attente et demande vos pompes.", "note_animateur": "Inject de la fiche orages. Ressources de la mutuelle, relèves (piège 6 : nuit et week-end).", "piege": "discipline_sans_suppleant"},
  {"heure_scenario_min": 270, "canal": "telephone", "emetteur": "Intercommunale d'eau", "discipline_cible": "d2", "texte": "20h30 : l'intercommunale signale un risque sur l'eau potable.", "note_animateur": "Inject de la fiche orages. Message M3 (eau) ; piège 4 : l'eau potable oubliée au profit du pompage.", "objectif": "O3"},
  {"heure_scenario_min": 300, "canal": "telephone", "emetteur": "Gouverneur", "discipline_cible": "bourgmestre", "texte": "21h00 : le gouverneur déclenche la phase provinciale.", "note_animateur": "Inject de la fiche orages."},
  {"heure_scenario_min": 615, "canal": "telephone", "emetteur": "Gouverneur", "discipline_cible": "bourgmestre", "texte": "02h15 : levée de la phase provinciale ; 30 caves sont encore sous eau chez vous.", "note_animateur": "Inject de la fiche orages. Piège 3 : démobiliser trop tôt. Centre d'accueil pour les sinistrés (message M4).", "piege": "aucun_centre_accueil", "objectif": "O4"},
  {"heure_scenario_min": 2880, "canal": "media", "emetteur": "Journaliste", "discipline_cible": "d5", "texte": "J+2 : un journaliste demande à quelle heure vous avez reçu l'alerte.", "note_animateur": "Inject de la fiche orages (J+2, heure non précisée : 48 h par défaut). Piège 5 : sans journal ni photos, pas de réponse.", "objectif": "O5"}
 ]$j$::jsonb,
 10, 'Fiche STARTER-REX-2026-ORAGES : injects d''exercice table-top et pièges observés (REX orages des 30 et 31 mai 2026).', null),

(null, 'REX-2026-CYBER', 'Cyberattaque du système d''information communal', 'STARTER-REX-2026-CYBER',
 $j$[
  {"code": "O1", "intitule": "Décider qui peut couper le système d'information, sur quels critères, et qui signe.", "discipline": "bourgmestre"},
  {"code": "O2", "intitule": "Assurer les services essentiels sans le serveur communal (contacts, PUI, registre des vulnérables, guichet papier).", "discipline": "bourgmestre"},
  {"code": "O3", "intitule": "Communiquer sans se précipiter sur la cause : le bourgmestre reste porte-parole, pas le prestataire.", "discipline": "d5"},
  {"code": "O4", "intitule": "Prévenir les fraudes dérivées envers les citoyens (phishing, faux appels).", "discipline": "d5"},
  {"code": "O5", "intitule": "Ne pas croire l'incident clos quand les services reviennent : les comptes volés restent exploitables.", "discipline": "bourgmestre"}
 ]$j$::jsonb,
 array['seuil_sans_responsable', 'seuil_sans_action_degradee', 'risque_sans_message'],
 $j$[
  {"heure_scenario_min": 0, "canal": "telephone", "emetteur": "Intercommunale informatique", "discipline_cible": "bourgmestre", "texte": "Vendredi 17h20 : l'intercommunale signale des connexions anormales depuis votre pare-feu ; le CCB a publié le matin un avertissement sur votre modèle.", "note_animateur": "Inject de la fiche cyberattaque."},
  {"heure_scenario_min": 25, "canal": "autre", "emetteur": "Service informatique", "discipline_cible": "bourgmestre", "texte": "17h45 : des fichiers du serveur partagé portent une extension inconnue.", "note_animateur": "Inject de la fiche cyberattaque."},
  {"heure_scenario_min": 50, "canal": "autre", "emetteur": "Animation", "discipline_cible": "bourgmestre", "texte": "18h10 : décidez-vous la coupure totale ? Qui signe ?", "note_animateur": "Inject de la fiche cyberattaque. Piège 2 : ne pas avoir décidé à l'avance qui peut couper le SI.", "piege": "seuil_sans_responsable", "objectif": "O1"},
  {"heure_scenario_min": 3760, "canal": "terrain", "emetteur": "Guichet population", "discipline_cible": "bourgmestre", "texte": "Lundi 08h00 : 60 citoyens au guichet, un décès à déclarer ; le CPAS ne peut pas payer les avances du 1er.", "note_animateur": "Inject de la fiche cyberattaque. Piège 4 : contacts, PUI et registre uniquement sur le serveur communal.", "piege": "seuil_sans_action_degradee", "objectif": "O2"},
  {"heure_scenario_min": 3940, "canal": "media", "emetteur": "Journaliste", "discipline_cible": "d5", "texte": "Lundi 11h00 : un journaliste annonce que des données de la commune sont en vente.", "note_animateur": "Inject de la fiche cyberattaque. Piège 5 : communiquer trop vite sur la cause ; piège 6 : fraudes dérivées.", "piege": "risque_sans_message", "objectif": "O3"},
  {"heure_scenario_min": 4720, "canal": "autre", "emetteur": "IRM", "discipline_cible": "bourgmestre", "texte": "Mardi : l'IRM passe en avertissement orange orages.", "note_animateur": "Inject de la fiche cyberattaque, à combiner avec la fiche orages (mardi, heure non précisée : minuit par défaut, à ajuster).", "objectif": "O4"},
  {"heure_scenario_min": 64800, "canal": "mail", "emetteur": "Prestataire informatique", "discipline_cible": "bourgmestre", "texte": "J+45 : le prestataire confirme que trois comptes administrateur volés étaient encore actifs.", "note_animateur": "Inject de la fiche cyberattaque. Piège 1 : croire l'incident clos.", "objectif": "O5"}
 ]$j$::jsonb,
 20, 'Fiche STARTER-REX-2026-CYBER : injects d''exercice table-top et pièges observés (REX cyberattaques 2026).', null),

(null, 'PUI-PPUI-NUCLEAIRE', 'Accident nucléaire : de la préalerte à la fin de crise (PUI / PPUI)', 'STARTER-N2',
 $j$[
  {"code": "O1", "intitule": "Décider du niveau de communication proactive vers la population, en lien avec le gouverneur (fiche N1).", "discipline": "bourgmestre"},
  {"code": "O2", "intitule": "Décider la fermeture des écoles et des lieux publics du périmètre ; activer le centre de crise communal en soutien du niveau provincial ou fédéral (fiche N2).", "discipline": "bourgmestre"},
  {"code": "O3", "intitule": "Relayer la consigne exacte de prise d'iode (heure), sans la déformer (fiche N4).", "discipline": "d5"},
  {"code": "O4", "intitule": "Fixer l'ordre de priorité de l'évacuation : écoles, personnes à risque, population générale ; boucler le périmètre évacué (fiche N3).", "discipline": "bourgmestre"},
  {"code": "O5", "intitule": "Organiser le retour par zone et communiquer sur les suites : suivi sanitaire, indemnisations, retour d'expérience (fiche N6).", "discipline": "bourgmestre"}
 ]$j$::jsonb,
 array['instance_sans_membre', 'aucun_centre_accueil', 'risque_sans_message'],
 $j$[
  {"heure_scenario_min": 0, "canal": "telephone", "emetteur": "Exploitant / gouverneur", "discipline_cible": "bourgmestre", "texte": "Déclenchement du Plan Interne d'Urgence (PUI) de la centrale nucléaire, sans rejet radioactif ni menace immédiate pour l'extérieur.", "note_animateur": "Fiche N1 (préalerte). Horaires du scénario indicatifs : les fiches n'en fixent pas.", "objectif": "O1"},
  {"heure_scenario_min": 30, "canal": "telephone", "emetteur": "Gouverneur / Centre de crise national", "discipline_cible": "bourgmestre", "texte": "Rejet radioactif accidentel avéré ou imminent, avec consigne officielle de mise à l'abri dans le périmètre concerné.", "note_animateur": "Fiche N2 (mise à l'abri).", "piege": "instance_sans_membre", "objectif": "O2"},
  {"heure_scenario_min": 45, "canal": "citoyen", "emetteur": "Riverains", "discipline_cible": "d5", "texte": "Afflux de questions de la population vers les services communaux.", "note_animateur": "Fiche N2, effets en cascade.", "piege": "risque_sans_message"},
  {"heure_scenario_min": 60, "canal": "telephone", "emetteur": "Centre de crise national", "discipline_cible": "d5", "texte": "Consigne officielle de prise de comprimés d'iode stable, en prévention d'une contamination thyroïdienne par iode radioactif.", "note_animateur": "Fiche N4 (iode).", "objectif": "O3"},
  {"heure_scenario_min": 90, "canal": "telephone", "emetteur": "Gouverneur / Centre de crise national", "discipline_cible": "bourgmestre", "texte": "Consigne officielle d'évacuation d'un périmètre donné autour de la centrale, suite à un rejet radioactif significatif.", "note_animateur": "Fiche N3 (évacuation) : centres d'accueil hors périmètre activés en amont.", "piege": "aucun_centre_accueil", "objectif": "O4"},
  {"heure_scenario_min": 150, "canal": "telephone", "emetteur": "Centre de crise national", "discipline_cible": "bourgmestre", "texte": "Confirmation officielle de la fin de la phase aiguë de l'incident nucléaire et levée progressive des mesures de protection (mise à l'abri, évacuation).", "note_animateur": "Fiche N6 (fin de crise).", "objectif": "O5"}
 ]$j$::jsonb,
 30, 'Fiches STARTER-N1 à N6 (doctrine PUI/PPUI belge publique) : déclencheurs, effets et décisions à préparer.', null)
on conflict do nothing;
