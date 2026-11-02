-- Tests du briefing 03, partie C (migration 20261102100000_b03c_exercice_trames_pieges.sql),
-- à exécuter dans le SQL Editor après la migration (ou, en répétition, à la suite de son texte dans
-- la même transaction). Transaction annulée par l'exception finale, qui affiche les résultats.
-- Comptes : un membre « écriture » de la Commune Test, le super-admin, un compte étranger, l'anonyme.
-- Une commune de test vide est créée dans la transaction pour vérifier les pièges « à vide ».

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
  (select a2.user_id from acces_utilisateurs a2 join contextes p on p.id = a2.contexte_id
   where p.est_plateforme and a2.niveau_acces = 'admin' limit 1) as super_admin,
  '00000000-0000-0000-0000-0000000000c1'::uuid as etranger,
  (select t.id from exercice_trames t where t.contexte_id is null and t.code = 'REX-2026-ORAGES') as trame_orages,
  (select t.id from exercice_trames t where t.contexte_id is null and t.code = 'PUI-PPUI-NUCLEAIRE') as trame_nucleaire
from contextes c where c.nom = 'Commune Test';

-- Commune de test vide : une instance sans membre, une discipline sans contact, aucun centre d'accueil.
insert into contextes (type, nom) values ('commune', 'Commune vide (test C)');
alter table t_ids add column vide uuid;
update t_ids set vide = (select id from contextes where nom = 'Commune vide (test C)');
insert into acces_utilisateurs (user_id, contexte_id, niveau_acces) select membre, vide, 'ecriture' from t_ids;
insert into instances_coordination (contexte_id, type, statut_activation) select vide, 'CC_COM', 'veille' from t_ids;
insert into disciplines (contexte_id, code, libelle, actif) select vide, 'D4', 'Logistique', true from t_ids;
grant select on t_ids, t_rep to anon, authenticated, service_role;

-- Pièges --------------------------------------------------------------------------------------------

insert into t_rep (etape, resultat) select
  'C-1 pièges de la Commune Test (nombre par code ; attendu au moins instance_sans_membre)',
  pg_temp.valeur('authenticated', membre,
    format($q$select string_agg(code || ' ' || n, ', ' order by code) from (select code, count(*) n from pieges_commune(%L) group by code) x$q$, commune))
from t_ids;
insert into t_rep (etape, resultat) select
  'C-2 pièges d''une commune vide (attendu : instance_sans_membre, aucun_centre_accueil, discipline_sans_contact)',
  pg_temp.valeur('authenticated', membre,
    format($q$select string_agg(code || ' [' || gravite || '] ' || titre, ' ; ' order by code) from pieges_commune(%L)$q$, vide))
from t_ids;
insert into t_rep (etape, resultat) select
  'C-3 l''anonyme et un compte étranger appellent pieges_commune : refusés',
  pg_temp.valeur('anon', null, format($q$select count(*)::text from pieges_commune(%L)$q$, commune))
  || ' / ' || pg_temp.valeur('authenticated', etranger, format($q$select count(*)::text from pieges_commune(%L)$q$, commune))
from t_ids;

-- Trames : droits et contrôles ------------------------------------------------------------------------

insert into t_rep (etape, resultat) select
  'C-4 trames de départ lues par le membre (attendu 3) / par l''anonyme (refus)',
  pg_temp.valeur('authenticated', membre, $q$select count(*)::text from exercice_trames where contexte_id is null$q$)
  || ' / ' || pg_temp.valeur('anon', null, $q$select count(*)::text from exercice_trames$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'C-5 le membre crée une trame de la plateforme : refusé (RLS)',
  pg_temp.essai('authenticated', membre,
    $q$insert into exercice_trames (code, titre, stimuli) values ('TEST-C5', 'Test C5', '[{"heure_scenario_min": 0, "canal": "radio", "texte": "x"}]')$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'C-6 le membre crée une trame de sa commune (OK), puis une trame au canal inconnu (refus)',
  pg_temp.essai('authenticated', membre,
    format($q$insert into exercice_trames (contexte_id, code, titre, stimuli, objectifs)
              values (%L, 'COMMUNE-C6', 'Trame communale', '[{"heure_scenario_min": 5, "canal": "radio", "texte": "Message radio"}]',
                      '[{"code": "O1", "intitule": "Objectif", "discipline": "d1"}]')$q$, commune), null, false)
  || ' / ' ||
  pg_temp.essai('authenticated', membre,
    format($q$insert into exercice_trames (contexte_id, code, titre, stimuli)
              values (%L, 'COMMUNE-C6B', 'Trame invalide', '[{"heure_scenario_min": 5, "canal": "pigeon", "texte": "x"}]')$q$, commune))
from t_ids;
insert into t_rep (etape, resultat) select
  'C-7 le super-admin modifie une trame de la plateforme : OK',
  pg_temp.essai('authenticated', super_admin, $q$update exercice_trames set ordre = 11 where code = 'REX-2026-ORAGES' and contexte_id is null$q$)
from t_ids;

-- Génération et cycle de vie ---------------------------------------------------------------------------

insert into t_rep (etape, resultat) select
  'C-8 le membre génère un exercice sur table (orages, 120 min, 3 pièges) : objectifs, stimuli, actions, sources, facteur, fiche liée',
  pg_temp.essai('authenticated', membre,
    format($q$select generer_exercice_commune(%L, %L, 'Test C orages', 'sur_table', 120, 3)$q$, commune, trame_orages),
    $q$select e.statut || ', ' || e.type_exercice || ', facteur ' || e.facteur_temps || ', fiche liée ' || (e.fiche_risque_id is not null)
              || ' | objectifs ' || (select count(*) from exercice_objectifs o where o.exercice_id = e.id)
              || ', stimuli ' || (select count(*) from exercice_stimuli s where s.exercice_id = e.id)
              || ', actions ' || (select count(*) from exercice_actions_attendues a where a.exercice_id = e.id)
              || ', sources ' || (select string_agg(so.code_controle, '+' order by so.code_controle) from exercice_sources so where so.exercice_id = e.id)
              || ', animateur créateur ' || exists (select 1 from exercice_animateurs a where a.exercice_id = e.id and a.user_id = auth.uid())
       from exercices e where e.titre = 'Test C orages'$q$, false)
from t_ids;
insert into t_rep (etape, resultat) select
  'C-9 démarrage, lancement du premier stimulus, clôture avec les fonctions existantes',
  pg_temp.essai('authenticated', membre,
    $q$select demarrer_exercice((select id from exercices where titre = 'Test C orages'))$q$, null, false)
  || ' / ' ||
  pg_temp.essai('authenticated', membre,
    $q$select lancer_stimulus((select s.id from exercice_stimuli s join exercices e on e.id = s.exercice_id where e.titre = 'Test C orages' order by s.heure_scenario_min, s.ordre limit 1))$q$, null, false)
  || ' / ' ||
  pg_temp.essai('authenticated', membre,
    $q$select clore_exercice((select id from exercices where titre = 'Test C orages'))$q$,
    $q$select statut || ', synthèse ' || (synthese is not null) from exercices where titre = 'Test C orages'$q$, false)
from t_ids;
insert into t_rep (etape, resultat) select
  'C-10 exercice nucléaire « dans l''outil » : incident d''exercice (dérogation, un incident réel est en cours), stimulus au livre de bord, clôture',
  pg_temp.essai('authenticated', membre,
    format($q$select generer_exercice_commune(%L, %L, 'Test C nucléaire', 'dans_outil', null, 2)$q$, commune, trame_nucleaire), null, false)
  || ' / ' ||
  pg_temp.essai('authenticated', membre,
    $q$select ouvrir_incident_exercice((select id from exercices where titre = 'Test C nucléaire'), true)$q$, null, false)
  || ' / ' ||
  pg_temp.essai('authenticated', membre,
    $q$select demarrer_exercice((select id from exercices where titre = 'Test C nucléaire'))$q$, null, false)
  || ' / ' ||
  pg_temp.essai('authenticated', membre,
    $q$select lancer_stimulus((select s.id from exercice_stimuli s join exercices e on e.id = s.exercice_id where e.titre = 'Test C nucléaire' order by s.heure_scenario_min, s.ordre limit 1))$q$,
    $q$select count(*) || ' entrée(s) au livre de bord' from livre_de_bord l join exercices e on e.incident_id = l.incident_id where e.titre = 'Test C nucléaire'$q$, false)
  || ' / ' ||
  pg_temp.essai('authenticated', membre,
    $q$select clore_exercice((select id from exercices where titre = 'Test C nucléaire'))$q$,
    $q$select e.statut || ', incident ' || i.statut || ', exercice ' || i.est_exercice from exercices e join incidents i on i.id = e.incident_id where e.titre = 'Test C nucléaire'$q$, false)
from t_ids;
insert into t_rep (etape, resultat) select
  'C-11 un compte étranger génère un exercice dans la Commune Test : refusé ; trame d''une autre commune : refusée',
  pg_temp.essai('authenticated', etranger,
    format($q$select generer_exercice_commune(%L, %L, 'x', 'sur_table', null, 1)$q$, commune, trame_orages))
  || ' / ' ||
  pg_temp.essai('authenticated', membre,
    format($q$select generer_exercice_commune(%L, (select id from exercice_trames where code = 'COMMUNE-C6'), 'x', 'sur_table', null, 1)$q$, vide))
from t_ids;
insert into t_rep (etape, resultat) values
  ('C-12 fonction de déclencheur non exécutable ; pieges_commune et generer_exercice_commune : anon false / authenticated true',
   (select string_agg(p.proname || ' ' || has_function_privilege('anon', p.oid, 'execute') || '/' || has_function_privilege('authenticated', p.oid, 'execute'), ', ' order by p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('exercice_trames_avant_ecriture', 'pieges_commune', 'generer_exercice_commune')));

do $$
begin
  raise exception 'RESULTATS %', (select json_agg(json_build_object('etape', etape, 'resultat', resultat) order by n) from t_rep);
end $$;
