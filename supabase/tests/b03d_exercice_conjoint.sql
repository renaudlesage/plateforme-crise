-- Tests du briefing 03, partie D (migration 20261102120000_b03d_exercice_conjoint.sql, après b03b), à exécuter
-- dans le SQL Editor après les migrations (ou, en répétition, à la suite de leur texte dans la même transaction).
-- Transaction annulée par l'exception finale, qui affiche les résultats. Chaque invariant E1 à E4 est éprouvé par
-- une tentative de violation. Aucun appel HTTP : envoyer_emission_evenement n'est jamais appelé ; la charge et
-- ses garde-fous sont vérifiés par emission_charge(), que l'envoi appelle avant toute requête.

begin;
create temp table t_rep (n serial, etape text, resultat text);

create function pg_temp.essai(p_role text, p_uid uuid, p_sql text, p_controle text default null, p_annuler boolean default true)
returns text language plpgsql as $f$
declare
  v_n bigint;
  v_ctl text;
  v_res text;
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then json_build_object('role', p_role)::text
         else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  perform set_config('role', p_role, true);
  begin
    execute p_sql;
    get diagnostics v_n = row_count;
    v_res := 'OK ' || v_n || ' ligne(s)';
    if p_controle is not null then
      execute p_controle into v_ctl;
      v_res := v_res || ' ; contrôle = ' || coalesce(v_ctl, 'null');
    end if;
    if p_annuler then
      raise exception 'ANNULE';
    end if;
  exception when others then
    if sqlerrm <> 'ANNULE' then
      v_res := 'REFUS ' || sqlstate || ' : ' || sqlerrm;
    end if;
  end;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  return v_res;
end $f$;

create function pg_temp.valeur(p_role text, p_uid uuid, p_sql text)
returns text language plpgsql as $f$
declare
  v text;
  v_res text;
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then json_build_object('role', p_role)::text
         else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  perform set_config('role', p_role, true);
  begin
    execute p_sql into v;
    v_res := 'OK ' || coalesce(v, 'null');
  exception when others then
    v_res := 'REFUS ' || sqlstate || ' : ' || sqlerrm;
  end;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  return v_res;
end $f$;


create temp table t_ids as
select c.id as commune,
  (select au.user_id from acces_utilisateurs au
   where au.contexte_id = c.id and au.niveau_acces = 'ecriture'
     and not exists (select 1 from acces_utilisateurs a2 join contextes p on p.id = a2.contexte_id
                     where a2.user_id = au.user_id and p.est_plateforme and a2.niveau_acces = 'admin')
   order by au.user_id limit 1) as membre,
  (select i.id from incidents i where i.contexte_id = c.id and not i.est_exercice and i.statut <> 'cloture'
   order by i.date_debut desc limit 1) as incident_reel
from contextes c where c.nom = 'Commune Test';
grant select on t_ids, t_rep to anon, authenticated, service_role;

-- Exercice conjoint créé par le membre (il en devient animateur), et un exercice ordinaire.
insert into t_rep (etape, resultat) select
  'D-1 exercice conjoint : code généré par le serveur (un code fourni est ignoré)',
  pg_temp.essai('authenticated', membre,
    format($q$insert into exercices (contexte_id, titre, mode_jeu, conjoint, code_conjoint) values (%L, 'Test D conjoint', 'dans_outil', true, 'CODE-CHOISI')$q$, commune),
    $q$select code_conjoint from exercices where titre = 'Test D conjoint'$q$, false)
from t_ids;
insert into exercices (contexte_id, titre, mode_jeu) select commune, 'Test D ordinaire', 'dans_outil' from t_ids;
alter table t_ids add column ex uuid, add column ex_ordinaire uuid;
update t_ids set ex = (select id from exercices where titre = 'Test D conjoint'),
                 ex_ordinaire = (select id from exercices where titre = 'Test D ordinaire');
insert into exercice_stimuli (exercice_id, heure_scenario_min, texte) select ex, 0, 'Début' from t_ids;

-- Événements suivis : un réel, un d'exercice ; sources : une réelle, une d'exercice.
insert into evenements_territoire (contexte_id, nom, jeton_public, url_recepteur)
select commune, 'Festival réel (test D)', gen_random_uuid(), 'https://recepteur-reel.example.org/hook' from t_ids;
insert into evenements_territoire (contexte_id, nom, jeton_public, url_recepteur, est_exercice, exercice_id)
select commune, 'Festival d''exercice (test D)', gen_random_uuid(), 'https://recepteur-exercice.example.org/hook', true, ex from t_ids;
insert into evenements_territoire_secrets (evenement_territoire_id, secret)
select id, 'secret-test-d' from evenements_territoire where nom like '% (test D)';
insert into sources_externes_alertes (contexte_id, libelle, secret)
select commune, 'Eventware réel (test D)', 'secret-test-d-reel' from t_ids;
insert into sources_externes_alertes (contexte_id, libelle, secret, est_exercice, exercice_id)
select commune, 'Eventware exercice (test D)', 'secret-test-d-exercice', true, ex from t_ids;

insert into t_rep (etape, resultat) select
  'D-2 événement d''exercice rattaché à un exercice non conjoint : refusé ; rattachement modifié : refusé',
  pg_temp.essai('postgres', null,
    format($q$insert into evenements_territoire (contexte_id, nom, est_exercice, exercice_id) values (%L, 'Mauvais lien', true, %L)$q$, commune, ex_ordinaire))
  || ' / ' ||
  pg_temp.essai('postgres', null,
    $q$update evenements_territoire set est_exercice = false, exercice_id = null where nom = 'Festival d''exercice (test D)'$q$)
from t_ids;

-- Incident d'exercice ouvert et exercice démarré par l'animateur.
insert into t_rep (etape, resultat) select
  'D-3 ouverture de l''incident d''exercice et démarrage',
  pg_temp.essai('authenticated', membre, format($q$select ouvrir_incident_exercice(%L, true)$q$, ex), null, false)
  || ' / ' || pg_temp.essai('authenticated', membre, format($q$select demarrer_exercice(%L)$q$, ex), null, false)
from t_ids;
alter table t_ids add column inc_ex uuid;
update t_ids set inc_ex = (select incident_id from exercices where id = t_ids.ex);

-- Propositions automatiques. Un incident naît en phase « alerte » : on le passe en phase active.
update incidents set phase_cycle_vie = 'phase_active' where id = (select inc_ex from t_ids);
insert into t_rep (etape, resultat) select
  'D-4 E1 propositions : l''incident d''exercice passe en phase active → événement d''exercice 1, événement réel 0',
  (select count(*) filter (where e.est_exercice) || ' / ' || count(*) filter (where not e.est_exercice)
          || ' ; titre : ' || coalesce(max(x.titre) filter (where e.est_exercice), '—')
   from emissions_evenements x join evenements_territoire e on e.id = x.evenement_territoire_id
   where x.incident_id = t_ids.inc_ex)
from t_ids;
update incidents set phase_cycle_vie = 'alerte' where id = (select incident_reel from t_ids)
  and phase_cycle_vie is distinct from 'alerte';
update incidents set phase_cycle_vie = 'phase_active' where id = (select incident_reel from t_ids)
  and phase_cycle_vie is distinct from 'phase_active'
  and not exists (select 1 from emissions_evenements x join evenements_territoire e on e.id = x.evenement_territoire_id
                  where x.incident_id = (select incident_reel from t_ids) and e.nom = 'Festival réel (test D)');
insert into t_rep (etape, resultat) select
  'D-5 E2 propositions : l''incident réel change de phase → événement réel 1, événement d''exercice 0'
  || case when incident_reel is null then ' [aucun incident réel en cours]' else '' end,
  (select count(*) filter (where e.nom = 'Festival réel (test D)') || ' / ' || count(*) filter (where e.est_exercice)
   from emissions_evenements x join evenements_territoire e on e.id = x.evenement_territoire_id
   where x.incident_id = t_ids.incident_reel)
from t_ids;

-- Tentatives de violation à l'écriture d'une émission.
insert into t_rep (etape, resultat) select
  'D-6 E1 : message manuel de l''incident d''exercice vers l''événement réel : refusé',
  pg_temp.essai('authenticated', membre,
    format($q$insert into emissions_evenements (evenement_territoire_id, incident_id, niveau, titre, message)
              values ((select id from evenements_territoire where nom = 'Festival réel (test D)'), %L, 'urgence', 'Évacuation', 'Message de test')$q$, inc_ex))
from t_ids;
insert into t_rep (etape, resultat) select
  'D-7 E2 : vers l''événement d''exercice, message de l''incident réel puis message sans incident : refusés',
  pg_temp.essai('authenticated', membre,
    format($q$insert into emissions_evenements (evenement_territoire_id, incident_id, niveau, titre, message)
              values ((select id from evenements_territoire where nom = 'Festival d''exercice (test D)'), %L, 'urgence', 'Évacuation', 'Message de test')$q$, incident_reel))
  || ' / ' ||
  pg_temp.essai('authenticated', membre,
    $q$insert into emissions_evenements (evenement_territoire_id, niveau, titre, message)
       values ((select id from evenements_territoire where nom = 'Festival d''exercice (test D)'), 'information', 'Info', 'Message de test')$q$)
from t_ids;

-- Charge envoyée (sans HTTP).
insert into t_rep (etape, resultat) select
  'D-8 charge de la proposition d''exercice : porte « exercice.code » = code de l''exercice',
  (select (emission_charge(x.id) -> 'exercice' ->> 'code') || ' = ' || (select code_conjoint from exercices where id = t_ids.ex)
   from emissions_evenements x join evenements_territoire e on e.id = x.evenement_territoire_id
   where x.incident_id = t_ids.inc_ex and e.est_exercice limit 1)
from t_ids;
insert into t_rep (etape, resultat) select
  'D-9 non-régression : la charge d''une proposition réelle n''a pas de clé « exercice » (attendu false)'
  || case when incident_reel is null then ' [aucun incident réel en cours]' else '' end,
  (select (emission_charge(x.id) ? 'exercice')::text
   from emissions_evenements x join evenements_territoire e on e.id = x.evenement_territoire_id
   where x.incident_id = t_ids.incident_reel and e.nom = 'Festival réel (test D)' limit 1)
from t_ids;

-- Réception d'alertes (E3, E4).
insert into t_rep (etape, resultat) select
  'D-10 E4 : charge marquée exercice reçue par la source réelle : refusée',
  pg_temp.essai('service_role', null,
    format($q$select recevoir_alerte_exercice((select id from sources_externes_alertes where secret = 'secret-test-d-reel'),
              jsonb_build_object('exercice', jsonb_build_object('code', %L), 'alerte', jsonb_build_object('titre', 'Évacuation scène B', 'message', 'Exercice')))$q$,
           (select code_conjoint from exercices where id = ex)))
from t_ids;
insert into t_rep (etape, resultat) select
  'D-11 E4 : charge non marquée (alerte publique) depuis la source d''exercice : refusée ; mauvais code : refusé',
  pg_temp.essai('service_role', null,
    format($q$insert into alertes_publiques (contexte_id, titre, message, niveau_alerte, provenance, source_externe_id)
              values (%L, 'Évacuation scène B', 'Exercice', 'urgence', 'externe', (select id from sources_externes_alertes where secret = 'secret-test-d-exercice'))$q$, commune))
  || ' / ' ||
  pg_temp.essai('service_role', null,
    $q$select recevoir_alerte_exercice((select id from sources_externes_alertes where secret = 'secret-test-d-exercice'),
       jsonb_build_object('exercice', jsonb_build_object('code', 'EXC-FAUX'), 'alerte', jsonb_build_object('titre', 'x', 'message', 'y')))$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'D-12 E3 : alerte d''exercice reçue par sa source : livre de bord (eventware) et chronologie, aucune alerte publique',
  pg_temp.essai('service_role', null,
    format($q$select recevoir_alerte_exercice((select id from sources_externes_alertes where secret = 'secret-test-d-exercice'),
              jsonb_build_object('exercice', jsonb_build_object('code', %L), 'alerte', jsonb_build_object('niveau', 'evacuation', 'titre', 'Évacuation scène B', 'message', 'Exercice : évacuez la scène B')))$q$,
           (select code_conjoint from exercices where id = ex)), null, false)
from t_ids;
insert into t_rep (etape, resultat) select
  'D-12 contrôle : livre de bord / chronologie / alertes publiques de la source d''exercice',
  (select count(*) from livre_de_bord where incident_id = t_ids.inc_ex and source_type = 'eventware') || ' / '
  || (select count(*) from exercice_observations where exercice_id = t_ids.ex and role_observateur = 'Organisateur (Eventware)') || ' / '
  || (select count(*) from alertes_publiques a join sources_externes_alertes s on s.id = a.source_externe_id where s.est_exercice)
from t_ids;
insert into t_rep (etape, resultat) select
  'D-13 une source d''exercice n''alimente pas les dossiers d''événements',
  pg_temp.essai('postgres', null,
    $q$insert into evenements_territoire_dossiers (contexte_id, evenement_territoire_id, reference, version, statut, source_externe_id)
       select e.contexte_id, e.id, gen_random_uuid(), 1, 'depose', (select id from sources_externes_alertes where secret = 'secret-test-d-exercice')
       from evenements_territoire e where e.nom = 'Festival d''exercice (test D)'$q$)
from t_ids;

-- Clôture.
insert into t_rep (etape, resultat) select
  'D-14 clore_exercice désactive l''événement et la source d''exercice ; réactivation refusée ; l''événement réel reste actif',
  pg_temp.essai('authenticated', membre, format($q$select clore_exercice(%L)$q$, ex),
    $q$select (select string_agg(nom || ' ' || actif, ', ' order by nom) from evenements_territoire where nom like '% (test D)')
              || ' ; source exercice ' || (select actif from sources_externes_alertes where secret = 'secret-test-d-exercice')$q$, false)
  || ' / ' ||
  pg_temp.essai('postgres', null, $q$update evenements_territoire set actif = true where nom = 'Festival d''exercice (test D)'$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'D-15 après la clôture, la proposition d''exercice ne peut plus partir (charge refusée)',
  pg_temp.valeur('postgres', null,
    format($q$select emission_charge(x.id)::text from emissions_evenements x join evenements_territoire e on e.id = x.evenement_territoire_id
              where x.incident_id = %L and e.est_exercice limit 1$q$, inc_ex))
from t_ids;
insert into t_rep (etape, resultat) values
  ('D-16 droits : emission_charge, recevoir_alerte_exercice (anon/auth/service) ; fonctions internes',
   (select string_agg(p.proname || ' ' || has_function_privilege('anon', p.oid, 'execute') || '/' || has_function_privilege('authenticated', p.oid, 'execute')
                      || '/' || has_function_privilege('service_role', p.oid, 'execute'), ', ' order by p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('emission_charge', 'recevoir_alerte_exercice', 'lien_exercice_controle', 'pas_de_source_exercice',
                                                  'exercices_conjoint_avant_ecriture', 'exercice_conjoint_de_incident')));

do $$
begin
  raise exception 'RESULTATS %', (select json_agg(json_build_object('etape', etape, 'resultat', resultat) order by n) from t_rep);
end $$;
