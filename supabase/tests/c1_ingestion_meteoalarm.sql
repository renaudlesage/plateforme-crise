-- Tests de C1, ingestion MeteoAlarm et règles par défaut (migration 20261113120000_c1_ingestion_meteoalarm.sql), à exécuter
-- dans le SQL Editor après la migration (ou, en répétition, à la suite de son texte dans la même transaction). Transaction
-- annulée par l'exception finale. Aucun appel réseau : le lot est fabriqué ici, au format produit par l'Edge Function.

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
  gen_random_uuid() as etranger
from contextes c where c.nom = 'Commune Test';
grant select on t_ids to anon, authenticated, service_role;
grant select, insert on t_rep to anon, authenticated, service_role;
grant usage on sequence t_rep_n_seq to anon, authenticated, service_role;

-- Lot fabriqué (préfixe TEST-C1I) : A orange orages Liège puis B, sa mise à jour en jaune ; C rouge orages expiré ;
-- D jaune orages, nouveau fil. Attendu : A remplacé par B (pas traité), C expiré (pas traité), B et D traités.
create temp table t_lot as select jsonb_build_array(
  jsonb_build_object('identifiant', 'TEST-C1I.A', 'segment', 0, 'expediteur', 'kmi-irm', 'emis_le', now() - interval '3 hours',
    'statut_cap', 'Actual', 'type_message', 'Alert', 'portee', 'Public', 'references_cap', '[]'::jsonb, 'langue', 'fr-be',
    'evenement', 'Avertissement orange orages', 'type_alerte', 'orage', 'niveau', 'orange', 'debut_le', now() - interval '3 hours',
    'fin_le', now() + interval '6 hours', 'titre', 'TEST A', 'zones', '[]'::jsonb, 'provinces', '["Liège"]'::jsonb, 'cap_brut', '<alert/>'),
  jsonb_build_object('identifiant', 'TEST-C1I.B', 'segment', 0, 'expediteur', 'kmi-irm', 'emis_le', now() - interval '1 hour',
    'statut_cap', 'Actual', 'type_message', 'Update', 'portee', 'Public', 'references_cap', '["TEST-C1I.A"]'::jsonb, 'langue', 'fr-be',
    'evenement', 'Avertissement jaune orages', 'type_alerte', 'orage', 'niveau', 'jaune', 'debut_le', now() - interval '1 hour',
    'fin_le', now() + interval '6 hours', 'titre', 'TEST B', 'zones', '[]'::jsonb, 'provinces', '["Liège"]'::jsonb),
  jsonb_build_object('identifiant', 'TEST-C1I.C', 'segment', 0, 'expediteur', 'kmi-irm', 'emis_le', now() - interval '2 days',
    'statut_cap', 'Actual', 'type_message', 'Alert', 'portee', 'Public', 'langue', 'fr-be',
    'evenement', 'Avertissement rouge orages', 'type_alerte', 'orage', 'niveau', 'rouge', 'debut_le', now() - interval '2 days',
    'fin_le', now() - interval '1 day', 'titre', 'TEST C', 'provinces', '["Liège"]'::jsonb),
  jsonb_build_object('identifiant', 'TEST-C1I.D', 'segment', 0, 'expediteur', 'kmi-irm', 'emis_le', now() - interval '30 minutes',
    'statut_cap', 'Actual', 'type_message', 'Alert', 'portee', 'Public', 'langue', 'fr-be',
    'evenement', 'Avertissement jaune orages', 'type_alerte', 'orage', 'niveau', 'jaune', 'debut_le', now(),
    'fin_le', now() + interval '6 hours', 'titre', 'TEST D', 'provinces', '["Liège"]'::jsonb)
) as lot;
grant select on t_lot to authenticated, service_role;

-- État du flux et réservation
insert into t_rep (etape, resultat) select 'C1I-1 état du flux lisible par un membre',
  pg_temp.valeur('authenticated', membre, $q$select nom || ' / silence ' || silence_max from jobs_etat where nom = 'ingest_meteoalarm'$q$) from t_ids;
insert into t_rep (etape, resultat) select 'C1I-2 autres tâches de la plateforme invisibles à un membre',
  pg_temp.valeur('authenticated', membre, $q$select count(*) from jobs_etat where contexte_id is null and nom <> 'ingest_meteoalarm'$q$) from t_ids;
insert into t_rep (etape, resultat) select 'C1I-3 réservation refusée à un membre', pg_temp.valeur('authenticated', membre, 'select meteoalarm_reserver()::text') from t_ids;
insert into t_rep (etape, resultat) select 'C1I-4 réservation : première accordée', pg_temp.valeur('service_role', null, 'select meteoalarm_reserver()::text');
insert into t_rep (etape, resultat) select 'C1I-5 réservation : seconde refusée (moins de 4 min)', pg_temp.valeur('service_role', null, 'select meteoalarm_reserver()::text');

-- Règles par défaut
insert into t_rep (etape, resultat) select 'C1I-6 règles proposées à la Commune Test',
  pg_temp.valeur('authenticated', membre, format($q$select string_agg(seuil_libelle || ' ← ' || type_alerte || ' ' || niveau_min || ' (' || deja_presente || ')', ' | ' order by seuil_libelle) from regles_reveil_proposees(%L)$q$, commune)) from t_ids;
insert into t_rep (etape, resultat) select 'C1I-7 non-membre : aucune proposition',
  pg_temp.valeur('authenticated', etranger, format($q$select count(*) from regles_reveil_proposees(%L)$q$, commune)) from t_ids;
insert into t_rep (etape, resultat) select 'C1I-8 non-membre : application refusée',
  pg_temp.valeur('authenticated', etranger, format($q$select appliquer_regles_reveil_modeles(%L)::text$q$, commune)) from t_ids;
insert into t_rep (etape, resultat) select 'C1I-9 application par un membre « écriture »',
  pg_temp.essai('authenticated', membre, format($q$select appliquer_regles_reveil_modeles(%L)$q$, commune),
    format($q$select string_agg(type_alerte || ' ' || niveau_min || ' ' || origine, ', ' order by niveau_min) from regles_reveil where contexte_id = %L$q$, commune), false) from t_ids;
insert into t_rep (etape, resultat) select 'C1I-10 seconde application : rien de plus',
  pg_temp.valeur('authenticated', membre, format($q$select appliquer_regles_reveil_modeles(%L)::text$q$, commune)) from t_ids;
insert into t_rep (etape, resultat) select 'C1I-11 modèle modifié par un membre : refusé',
  pg_temp.essai('authenticated', membre, $q$update regles_reveil_modeles set niveau_min = 'rouge'$q$) from t_ids;

-- Ingestion
insert into t_rep (etape, resultat) select 'C1I-12 ingestion refusée à un membre',
  pg_temp.valeur('authenticated', membre, 'select meteoalarm_ingerer((select lot from t_lot))::text') from t_ids;
insert into t_rep (etape, resultat) select 'C1I-13 lot ingéré', pg_temp.valeur('service_role', null, 'select meteoalarm_ingerer((select lot from t_lot))::text');
insert into t_rep (etape, resultat) select 'C1I-14 fils (B rejoint le fil de A)',
  (select string_agg(right(identifiant, 1) || '→' || right(fil, 1), ' ' order by identifiant) from alertes_externes where identifiant like 'TEST-C1I.%');
insert into t_rep (etape, resultat) select 'C1I-15 traitements du moteur (A et C non traités)',
  (select string_agg(right(a.identifiant, 1) || ':' || coalesce(t.nb_reveils::text, '—'), ' ' order by a.identifiant)
   from alertes_externes a left join alertes_externes_traitements t on t.alerte_externe_id = a.id where a.identifiant like 'TEST-C1I.%');
insert into t_rep (etape, resultat) select 'C1I-16 réveil de la Commune Test (S0, jaune)',
  (select string_agg(r.niveau || ' ' || s.libelle, ' | ') from reveils r join seuils_action s on s.id = r.seuil_action_id
   join alertes_externes a on a.id = r.alerte_externe_id where a.identifiant like 'TEST-C1I.%');
insert into t_rep (etape, resultat) select 'C1I-17 lot rejoué : rien d''inséré', pg_temp.valeur('service_role', null, 'select meteoalarm_ingerer((select lot from t_lot))::text');
insert into t_rep (etape, resultat) select 'C1I-18 en cours pour Liège (B et D ; ni A remplacé, ni C expiré)',
  (select string_agg(titre, ', ' order by titre) from alertes_externes_en_cours where titre like 'TEST %');
insert into t_rep (etape, resultat) select 'C1I-19 lot invalide', pg_temp.valeur('service_role', null, $q$select meteoalarm_ingerer('{}')::text$q$);
insert into t_rep (etape, resultat) select 'C1I-20 saisie manuelle : moteur toujours lancé à l''insertion',
  pg_temp.essai('authenticated', membre, format($q$insert into alertes_externes (source, contexte_id, evenement, type_alerte, niveau) values ('saisie', %L, 'Orage saisi (test)', 'orage', 'orange')$q$, commune),
    $q$select count(*)::text from alertes_externes_traitements t join alertes_externes a on a.id = t.alerte_externe_id where a.evenement = 'Orage saisi (test)'$q$, false) from t_ids;
insert into t_rep (etape, resultat) select 'C1I-21 tâche planifiée', (select schedule || ' ' || command from cron.job where jobname = 'ingest_meteoalarm');
insert into t_rep (etape, resultat) select 'C1I-22 déclencheur non appelable par un membre',
  pg_temp.valeur('authenticated', (select membre from t_ids), 'select meteoalarm_declencher()::text');

do $$ begin raise exception 'RESULTATS %', (select string_agg(n || ' ' || etape || ' => ' || resultat, E'\n' order by n) from t_rep); end $$;
rollback;
