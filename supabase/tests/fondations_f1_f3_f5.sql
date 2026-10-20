-- Tests des fondations F1, F3 et F5 (sprint 1), à exécuter dans le SQL Editor
-- après les migrations 20261020213000 (F5), 20261020213100 (F3), 20261020213200
-- (F1) et le seed supabase/seed/communes_be.sql.
-- Tout se passe dans une transaction annulée par l'exception finale, qui affiche
-- les résultats : rien n'est conservé. Comptes utilisés : un membre « écriture »
-- de la Commune Test, le super-admin et le rôle anonyme (simulés par rôle et JWT).

begin;
create temp table t_rep (n serial, etape text, resultat text);

-- Exécute p_sql sous un rôle et un utilisateur donnés ; annule l'effet par défaut.
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

-- Renvoie la première valeur de p_sql exécuté sous un rôle et un utilisateur donnés.
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
   where au.contexte_id = c.id and au.niveau_acces in ('ecriture', 'admin')
     and not exists (select 1 from acces_utilisateurs a2 join contextes p on p.id = a2.contexte_id
                     where a2.user_id = au.user_id and p.est_plateforme and a2.niveau_acces = 'admin')
   limit 1) as membre,
  (select a2.user_id from acces_utilisateurs a2 join contextes p on p.id = a2.contexte_id
   where p.est_plateforme and a2.niveau_acces = 'admin' limit 1) as super_admin,
  (select i.id from incidents i where i.contexte_id = c.id and not i.est_exercice and i.statut = 'en_cours' limit 1) as incident,
  (select s.id from signalements_citoyens s where s.contexte_id = c.id and s.incident_id is null limit 1) as signalement
from contextes c where c.nom = 'Commune Test';
alter table t_ids add column alerte uuid;
update t_ids set alerte = (select a.id from alertes_publiques a
  where a.contexte_id = t_ids.commune and (a.incident_id is null or a.incident_id = t_ids.incident) limit 1);

-- F5 — journal des décisions ----------------------------------------------------------

insert into t_rep (etape, resultat) select
  'F5-1 un membre modifie une décision du journal',
  pg_temp.essai('authenticated', membre, format($q$update journal_decisions set decision = 'modifiée' where incident_id = %L$q$, incident))
from t_ids;
insert into t_rep (etape, resultat) select
  'F5-2 le propriétaire de la table (postgres) modifie une décision',
  pg_temp.essai('postgres', null, format($q$update journal_decisions set decision = 'modifiée' where incident_id = %L$q$, incident))
from t_ids;
insert into t_rep (etape, resultat) select
  'F5-3 suppression d''une décision réelle',
  pg_temp.essai('postgres', null, format($q$delete from journal_decisions where incident_id = %L and not est_exercice$q$, incident))
from t_ids;
insert into t_rep (etape, resultat) select
  'F5-4 un membre ajoute une décision liée à un signalement et à une alerte (contrôle : longueur de l''empreinte / empreinte précédente)',
  pg_temp.essai('authenticated', membre,
    format($q$insert into journal_decisions (incident_id, decision, base_decision, decide_par, decide_le, signalement_id, alerte_publique_id)
              values (%L, 'Fermeture de la rue du Moulin', 'Rapport D1', 'Bourgmestre', now() - interval '5 minutes', %L, %L)$q$,
           incident, signalement, alerte),
    format($q$select length(empreinte) || ' / ' || coalesce(empreinte_precedente, 'nulle (entrée précédente non scellée)')
              from journal_decisions where incident_id = %L order by numero_ordre desc limit 1$q$, incident),
    false)
from t_ids;
insert into t_rep (etape, resultat) select
  'F5-5 deuxième décision (contrôle : chaînée à la précédente)',
  pg_temp.essai('authenticated', membre,
    format($q$insert into journal_decisions (incident_id, decision, base_decision, decide_par, decide_le)
              values (%L, 'Ouverture du centre d''accueil', 'Évacuation de 40 personnes', 'Bourgmestre', now())$q$, incident),
    format($q$select (j.empreinte_precedente = p.empreinte)::text from journal_decisions j
              join journal_decisions p on p.incident_id = j.incident_id and p.numero_ordre = j.numero_ordre - 1
              where j.incident_id = %L order by j.numero_ordre desc limit 1$q$, incident),
    false)
from t_ids;
insert into t_rep (etape, resultat) select
  'F5-6 vérification de la chaîne (entrées / scellées / première anomalie)',
  pg_temp.valeur('authenticated', membre,
    format($q$select nb_entrees || ' / ' || nb_scellees || ' / ' || coalesce(premiere_anomalie::text, 'aucune')
              from verifier_journal_decisions(%L)$q$, incident))
from t_ids;
insert into t_rep (etape, resultat) select
  'F5-7 un membre fournit lui-même une empreinte (contrôle : remplacée par celle du serveur et chaînée)',
  pg_temp.essai('authenticated', membre,
    format($q$insert into journal_decisions (incident_id, decision, base_decision, decide_par, empreinte, empreinte_precedente)
              values (%L, 'x', 'x', 'x', 'falsifiée', 'falsifiée')$q$, incident),
    format($q$select (j.empreinte <> 'falsifiée' and length(j.empreinte) = 64
                      and j.empreinte_precedente = p.empreinte and j.empreinte = journal_decisions_empreinte(j))::text
              from journal_decisions j
              join journal_decisions p on p.incident_id = j.incident_id and p.numero_ordre = j.numero_ordre - 1
              where j.incident_id = %L order by j.numero_ordre desc limit 1$q$, incident))
from t_ids;
insert into t_rep (etape, resultat) select
  'F5-8 référence à un signalement inconnu',
  pg_temp.essai('authenticated', membre,
    format($q$insert into journal_decisions (incident_id, decision, base_decision, decide_par, signalement_id)
              values (%L, 'x', 'x', 'x', gen_random_uuid())$q$, incident))
from t_ids;
-- Falsification simulée : le propriétaire contourne l'ajout seul le temps d'une modification.
alter table public.journal_decisions disable trigger journal_decisions_ajout_seul_ligne_trg;
update public.journal_decisions set decision = 'Ouverture du centre d''accueil (falsifiée)'
where incident_id = (select incident from t_ids) and decision = 'Ouverture du centre d''accueil';
alter table public.journal_decisions enable trigger journal_decisions_ajout_seul_ligne_trg;
insert into t_rep (etape, resultat) select
  'F5-9 après falsification simulée (entrées / scellées / première anomalie = numéro falsifié)',
  pg_temp.valeur('authenticated', membre,
    format($q$select nb_entrees || ' / ' || nb_scellees || ' / ' || coalesce(premiere_anomalie::text, 'aucune')
                     || ' (falsifiée : n° ' || (select numero_ordre from journal_decisions
                        where incident_id = %L and decision like '%%falsifiée%%') || ')'
              from verifier_journal_decisions(%L)$q$, incident, incident))
from t_ids;

-- F3 — planification --------------------------------------------------------------------

insert into t_rep (etape, resultat) values
  ('F3-1 extensions installées', (select string_agg(e.extname || ' ' || e.extversion || ' (' || n.nspname || ')', ', ' order by e.extname)
     from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname in ('pg_cron', 'pg_net')));
insert into public.jobs_etat (nom, description, silence_max) values ('test_flux_plateforme', 'Tâche de test', interval '1 minute');
insert into t_rep (etape, resultat) select
  'F3-2 tâche de la plateforme vue par le super-admin / le membre / l''anonyme',
  pg_temp.valeur('authenticated', super_admin, $q$select count(*)::text from jobs_etat where nom = 'test_flux_plateforme'$q$) || ' / ' ||
  pg_temp.valeur('authenticated', membre, $q$select count(*)::text from jobs_etat where nom = 'test_flux_plateforme'$q$) || ' / ' ||
  pg_temp.valeur('anon', null, $q$select count(*)::text from jobs_etat$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'F3-3 un membre signale l''exécution d''une tâche',
  pg_temp.essai('authenticated', membre, $q$select jobs_signaler('test_flux_plateforme', true)$q$)
from t_ids;
insert into t_rep (etape, resultat) values
  ('F3-4 la tâche signale un échec puis un succès (clé de service ; contrôle : échecs consécutifs après l''échec)',
   pg_temp.essai('service_role', null, $q$select jobs_signaler('test_flux_plateforme', false, 'Flux injoignable')$q$,
                 $q$select echecs_consecutifs::text || ' / ' || derniere_erreur from jobs_etat where nom = 'test_flux_plateforme'$q$, false)
   || ' ; puis ' ||
   pg_temp.essai('service_role', null, $q$select jobs_signaler('test_flux_plateforme', true)$q$,
                 $q$select echecs_consecutifs::text from jobs_etat where nom = 'test_flux_plateforme'$q$, false));
update public.jobs_etat set dernier_succes_le = now() - interval '2 hours' where nom = 'test_flux_plateforme';
insert into t_rep (etape, resultat) select
  'F3-5 tâche sans succès depuis 2 h (silence toléré 1 min) : jobs_muets() pour le super-admin / le membre',
  pg_temp.valeur('authenticated', super_admin, $q$select string_agg(nom, ', ') from jobs_muets() where nom = 'test_flux_plateforme'$q$) || ' / ' ||
  pg_temp.valeur('authenticated', membre, $q$select count(*)::text from jobs_muets() where nom = 'test_flux_plateforme'$q$)
from t_ids;

-- F1 — communes belges -----------------------------------------------------------------

insert into t_rep (etape, resultat) values
  ('F1-1 une commune retrouvée par son NIS (anonyme, 62063)',
   pg_temp.valeur('anon', null, $q$select nom_fr || ' / ' || nom_nl || ' / ' || nom_de || ' / ' || province || ' / ' || array_to_string(langues, ',')
                                  from communes_be where code_nis = '62063'$q$));
insert into t_rep (etape, resultat) values
  ('F1-2 nombre de communes par région (anonyme)',
   pg_temp.valeur('anon', null, $q$select string_agg(region || ' ' || n, ', ' order by region) || ' — total ' || sum(n)
                                  from (select region, count(*) n from communes_be group by region) r$q$));
insert into t_rep (etape, resultat) values
  ('F1-3 communes germanophones',
   pg_temp.valeur('anon', null, $q$select string_agg(coalesce(nom_de, nom_fr), ', ' order by code_nis) from communes_be where langues = '{de}'$q$));
insert into t_rep (etape, resultat) values
  ('F1-4 l''anonyme ajoute une commune',
   pg_temp.essai('anon', null, $q$insert into communes_be (code_nis, nom_fr, code_arrondissement, province, region, source)
                                 values ('99999', 'Commune pirate', '99000', 'Namur', 'Région wallonne', 'test')$q$));
insert into t_rep (etape, resultat) select
  'F1-5 un membre modifie une commune',
  pg_temp.essai('authenticated', membre, $q$update communes_be set nom_fr = 'x' where code_nis = '62063'$q$)
from t_ids;
insert into t_rep (etape, resultat) values
  ('F1-7 zones de Liège (62063) : secours / police (numéro)',
   pg_temp.valeur('anon', null, $q$select zone_secours || ' / ' || zone_police || ' (' || zone_police_numero || ')'
                                  from communes_be where code_nis = '62063'$q$));
insert into t_rep (etape, resultat) values
  ('F1-8 communes avec zones / zones de secours / zones de police (attendu : 261 / 14 / 71)',
   (select count(*) || ' / ' || count(distinct zone_secours) || ' / ' || count(distinct zone_police_numero)
    from communes_be where zone_secours is not null));
insert into t_rep (etape, resultat) values
  ('F1-6 distance Liège – Namur entre points de commune (km)',
   (select round((public.st_distance(l.centroide, n.centroide) / 1000)::numeric, 1)::text
    from communes_be l, communes_be n where l.code_nis = '62063' and n.code_nis = '92094'));

do $$
begin
  raise exception 'RESULTATS %', (select json_agg(json_build_object('etape', etape, 'resultat', resultat) order by n) from t_rep);
end $$;
