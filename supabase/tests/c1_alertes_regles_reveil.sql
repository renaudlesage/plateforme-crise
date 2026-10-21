-- Tests de la migration C1 20261021090000 (alertes_externes, regles_reveil), à exécuter
-- dans le SQL Editor après la migration.
-- Tout se passe dans une transaction annulée par l'exception finale, qui affiche les
-- résultats : rien n'est conservé. Comptes utilisés : un membre « écriture » de la Commune
-- Test (province de Liège), le super-admin, l'anonyme et la clé de service (simulés par rôle
-- et JWT). Seuils : S0 et S1 de la fiche STARTER-REX-2026-ORAGES de la Commune Test.

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
  (select p.id from contextes p where p.est_plateforme limit 1) as plateforme,
  (select s.id from seuils_action s join risques_territoire r on r.id = s.risque_id
   where r.contexte_id = c.id and r.code = 'STARTER-REX-2026-ORAGES' and s.ordre = 1) as seuil_s0,
  (select s.id from seuils_action s join risques_territoire r on r.id = s.risque_id
   where r.contexte_id = c.id and r.code = 'STARTER-REX-2026-ORAGES' and s.ordre = 2) as seuil_s1
from contextes c where c.nom = 'Commune Test';

-- Avertissements ----------------------------------------------------------------------------

insert into t_rep (etape, resultat) values
  ('C1-1 l''anonyme lit les avertissements',
   pg_temp.valeur('anon', null, $q$select count(*)::text from alertes_externes$q$));
insert into t_rep (etape, resultat) values
  ('C1-2 l''ingestion (clé de service) enregistre l''orange orages Liège (contrôle : fil / empreinte du CAP / reçu à l''heure du serveur, pas celle envoyée)',
   pg_temp.essai('service_role', null,
     $q$insert into alertes_externes (source, identifiant, segment, expediteur, emis_le, statut_cap, type_message, portee,
          langue, evenement, type_alerte, niveau, severite, debut_le, fin_le, titre, zones, provinces, lien, cap_brut, recu_le)
        values ('meteoalarm', 'test.c1.orange-orages-liege', 0, 'fixtures@crisiware.invalid', now() - interval '15 minutes',
          'Actual', 'Alert', 'Public', 'fr-be', 'Avertissement orages', 'orage', 'orange', 'Severe',
          now() - interval '10 minutes', now() + interval '6 hours', 'Avertissement orange pour les orages en province de Liège',
          '[{"nom": "Liège", "geocodes": [], "provinces": ["Liège"]}]', '{Liège}', 'https://www.meteoalarm.org',
          '<alert>test</alert>', '2000-01-01')$q$,
     $q$select (fil = identifiant)::text || ' / ' || length(empreinte_brut) || ' / ' || (recu_le = now())::text
        from alertes_externes where identifiant = 'test.c1.orange-orages-liege'$q$, false));
insert into t_rep (etape, resultat) values
  ('C1-3 le même message relu (dédoublonnage par source, identifiant, segment)',
   pg_temp.essai('service_role', null,
     $q$insert into alertes_externes (source, identifiant, segment, expediteur, emis_le, evenement, type_alerte, niveau)
        values ('meteoalarm', 'test.c1.orange-orages-liege', 0, 'x', now(), 'x', 'orage', 'orange')
        on conflict (source, identifiant, segment) do nothing$q$));
insert into t_rep (etape, resultat) select
  'C1-4 un membre lit les avertissements des flux',
  pg_temp.valeur('authenticated', membre, $q$select count(*)::text from alertes_externes where source = 'meteoalarm'$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'C1-5 un membre écrit un avertissement de flux',
  pg_temp.essai('authenticated', membre,
    $q$insert into alertes_externes (source, evenement, type_alerte, niveau) values ('meteoalarm', 'Faux avertissement', 'orage', 'rouge')$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'C1-6 un membre saisit un avertissement pour sa commune (contrôle : identifiant serveur / expéditeur / province / auteur / fil)',
  pg_temp.essai('authenticated', membre,
    format($q$insert into alertes_externes (source, contexte_id, evenement, type_alerte, niveau, titre)
              values ('saisie', %L, 'Avertissement orages reçu par téléphone', 'orage', 'orange', 'Orange orages, appel du CORTEX')$q$, commune),
    $q$select (identifiant like 'saisie.%')::text || ' / ' || expediteur || ' / ' || array_to_string(provinces, ',') || ' / '
              || (saisi_par = auth.uid())::text || ' / ' || (fil = identifiant)::text
       from alertes_externes where titre = 'Orange orages, appel du CORTEX'$q$, false)
from t_ids;
insert into t_rep (etape, resultat) select
  'C1-7 un membre saisit un avertissement pour une autre commune (la plateforme)',
  pg_temp.essai('authenticated', membre,
    format($q$insert into alertes_externes (source, contexte_id, evenement, type_alerte, niveau) values ('saisie', %L, 'x', 'orage', 'orange')$q$, plateforme))
from t_ids;
insert into t_rep (etape, resultat) select
  'C1-8 un membre crée une fixture',
  pg_temp.essai('authenticated', membre,
    format($q$insert into alertes_externes (source, contexte_id, evenement, type_alerte, niveau) values ('fixture', %L, 'x', 'orage', 'orange')$q$, commune))
from t_ids;
insert into t_rep (etape, resultat) select
  'C1-9 le super-admin crée une fixture pour la Commune Test (contrôle : expéditeur)',
  pg_temp.essai('authenticated', super_admin,
    format($q$insert into alertes_externes (source, contexte_id, evenement, type_alerte, niveau, titre) values ('fixture', %L, 'Démonstration', 'orage', 'orange', 'Fixture C1-9')$q$, commune),
    $q$select expediteur from alertes_externes where titre = 'Fixture C1-9'$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'C1-10 un membre impose l''identifiant d''une saisie',
  pg_temp.essai('authenticated', membre,
    format($q$insert into alertes_externes (source, contexte_id, evenement, type_alerte, niveau, identifiant) values ('saisie', %L, 'x', 'orage', 'orange', 'pirate')$q$, commune))
from t_ids;
insert into t_rep (etape, resultat) values
  ('C1-11 le propriétaire de la table (postgres) modifie un avertissement',
   pg_temp.essai('postgres', null, $q$update alertes_externes set niveau = 'jaune' where identifiant = 'test.c1.orange-orages-liege'$q$));
insert into t_rep (etape, resultat) select
  'C1-12 un membre modifie un avertissement',
  pg_temp.essai('authenticated', membre, $q$update alertes_externes set niveau = 'jaune' where identifiant = 'test.c1.orange-orages-liege'$q$)
from t_ids;
insert into t_rep (etape, resultat) values
  ('C1-13 mise à jour rouge de l''orange (contrôle : fil rejoint)',
   pg_temp.essai('service_role', null,
     $q$insert into alertes_externes (source, identifiant, segment, expediteur, emis_le, type_message, references_cap,
          evenement, type_alerte, niveau, debut_le, fin_le, provinces)
        values ('meteoalarm', 'test.c1.rouge-orages-liege', 0, 'fixtures@crisiware.invalid', now() - interval '5 minutes', 'Update',
          '{test.c1.orange-orages-liege}', 'Avertissement orages', 'orage', 'rouge', now() - interval '5 minutes', now() + interval '6 hours', '{Liège}')$q$,
     $q$select fil from alertes_externes where identifiant = 'test.c1.rouge-orages-liege'$q$, false));
insert into t_rep (etape, resultat) select
  'C1-14 avertissements en cours vus par le membre (le rouge remplace l''orange)',
  pg_temp.valeur('authenticated', membre, $q$select string_agg(source || ' ' || niveau, ', ' order by source, niveau) from alertes_externes_en_cours$q$)
from t_ids;
insert into t_rep (etape, resultat) values
  ('C1-15 annulation du rouge, sans bloc info (contrôle : fil rejoint)',
   pg_temp.essai('service_role', null,
     $q$insert into alertes_externes (source, identifiant, segment, expediteur, emis_le, type_message, references_cap,
          evenement, type_alerte, niveau, debut_le, fin_le)
        values ('meteoalarm', 'test.c1.annulation', 0, 'fixtures@crisiware.invalid', now() - interval '1 minute', 'Cancel',
          '{test.c1.rouge-orages-liege}', 'Annulation', 'autre', 'vert', now() - interval '1 minute', now() - interval '1 minute')$q$,
     $q$select fil from alertes_externes where identifiant = 'test.c1.annulation'$q$, false));
insert into t_rep (etape, resultat) select
  'C1-16 avertissements en cours après l''annulation (reste la saisie)',
  pg_temp.valeur('authenticated', membre, $q$select string_agg(source || ' ' || niveau, ', ' order by source, niveau) from alertes_externes_en_cours$q$)
from t_ids;

-- Règles de réveil --------------------------------------------------------------------------

insert into t_rep (etape, resultat) select
  'C1-17 un membre crée « orage orange → S1 » (contrôle : auteur imposé par le serveur / origine / source)',
  pg_temp.essai('authenticated', membre,
    format($q$insert into regles_reveil (contexte_id, seuil_action_id, type_alerte, niveau_min, cree_par)
              values (%L, %L, 'orage', 'orange', gen_random_uuid())$q$, commune, seuil_s1),
    format($q$select (cree_par = auth.uid())::text || ' / ' || origine || ' / ' || source from regles_reveil where seuil_action_id = %L$q$, seuil_s1),
    false)
from t_ids;
insert into t_rep (etape, resultat) select
  'C1-18 un membre crée « orage jaune → S0 »',
  pg_temp.essai('authenticated', membre,
    format($q$insert into regles_reveil (contexte_id, seuil_action_id, type_alerte, niveau_min) values (%L, %L, 'orage', 'jaune')$q$, commune, seuil_s0),
    null, false)
from t_ids;
insert into t_rep (etape, resultat) select
  'C1-19 un membre relie une règle à un seuil d''une autre commune',
  pg_temp.essai('authenticated', membre,
    format($q$insert into regles_reveil (contexte_id, seuil_action_id, type_alerte, niveau_min) values (%L, gen_random_uuid(), 'vent', 'orange')$q$, commune))
from t_ids;
insert into t_rep (etape, resultat) select
  'C1-20 l''anonyme crée une règle',
  pg_temp.essai('anon', null,
    format($q$insert into regles_reveil (contexte_id, seuil_action_id, type_alerte, niveau_min) values (%L, %L, 'vent', 'orange')$q$, commune, seuil_s1))
from t_ids;
insert into t_rep (etape, resultat) select
  'C1-21 règle en double',
  pg_temp.essai('authenticated', membre,
    format($q$insert into regles_reveil (contexte_id, seuil_action_id, type_alerte, niveau_min) values (%L, %L, 'orage', 'orange')$q$, commune, seuil_s1))
from t_ids;
insert into t_rep (etape, resultat) select
  'C1-22 règles armées par l''orange du flux (vu par le membre)',
  pg_temp.valeur('authenticated', membre,
    $q$select string_agg(seuil_libelle, ' + ') from regles_reveil_correspondantes(
         (select id from alertes_externes where identifiant = 'test.c1.orange-orages-liege'))$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'C1-23 règles armées par une saisie jaune de la commune',
  pg_temp.essai('authenticated', membre,
    format($q$insert into alertes_externes (source, contexte_id, evenement, type_alerte, niveau, titre)
              values ('saisie', %L, 'Avertissement orages', 'orage', 'jaune', 'Jaune orages C1-23')$q$, commune),
    $q$select string_agg(seuil_libelle, ' + ') from regles_reveil_correspondantes(
         (select id from alertes_externes where titre = 'Jaune orages C1-23'))$q$, false)
from t_ids;
insert into t_rep (etape, resultat) select
  'C1-24 règles armées par un orange du flux sur Namur seulement',
  pg_temp.essai('service_role', null,
    $q$insert into alertes_externes (source, identifiant, segment, expediteur, emis_le, evenement, type_alerte, niveau, provinces)
       values ('meteoalarm', 'test.c1.orange-namur', 0, 'fixtures@crisiware.invalid', now(), 'Avertissement orages', 'orage', 'orange', '{Namur}')$q$,
    $q$select count(*)::text from regles_reveil_correspondantes((select id from alertes_externes where identifiant = 'test.c1.orange-namur'))$q$, false)
from t_ids;
insert into t_rep (etape, resultat) select
  'C1-25 règles armées par un message de test (statut CAP Test) sur Liège',
  pg_temp.essai('service_role', null,
    $q$insert into alertes_externes (source, identifiant, segment, expediteur, emis_le, statut_cap, evenement, type_alerte, niveau, provinces)
       values ('meteoalarm', 'test.c1.statut-test', 0, 'fixtures@crisiware.invalid', now(), 'Test', 'Avertissement orages', 'orage', 'rouge', '{Liège}')$q$,
    $q$select count(*)::text from regles_reveil_correspondantes((select id from alertes_externes where identifiant = 'test.c1.statut-test'))$q$, false)
from t_ids;
insert into t_rep (etape, resultat) select
  'C1-26 la règle S1 réservée à la source IRM, puis l''orange MeteoAlarm (contrôle : règles armées)',
  pg_temp.essai('authenticated', membre,
    format($q$update regles_reveil set source = 'irm' where seuil_action_id = %L$q$, seuil_s1),
    $q$select string_agg(seuil_libelle, ' + ') from regles_reveil_correspondantes(
         (select id from alertes_externes where identifiant = 'test.c1.orange-orages-liege'))$q$, false)
from t_ids;
insert into t_rep (etape, resultat) select
  'C1-27 une fixture orange du super-admin arme aussi la règle réservée à l''IRM',
  pg_temp.essai('authenticated', super_admin,
    format($q$insert into alertes_externes (source, contexte_id, evenement, type_alerte, niveau, titre)
              values ('fixture', %L, 'Démonstration D1', 'orage', 'orange', 'Fixture C1-27')$q$, commune),
    null, false)
  || ' ; vu par le membre : ' ||
  pg_temp.valeur('authenticated', membre,
    $q$select string_agg(seuil_libelle, ' + ') from regles_reveil_correspondantes(
         (select id from alertes_externes where titre = 'Fixture C1-27'))$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'C1-28 fenêtre horaire de S0 qui exclut l''heure de réception, puis qui l''inclut (passage de minuit possible)',
  pg_temp.essai('authenticated', membre,
    format($q$update regles_reveil set heure_debut = ((now() at time zone 'Europe/Brussels') + interval '2 hours')::time,
                                         heure_fin = ((now() at time zone 'Europe/Brussels') + interval '3 hours')::time
              where seuil_action_id = %L$q$, seuil_s0),
    $q$select string_agg(seuil_libelle, ' + ') from regles_reveil_correspondantes((select id from alertes_externes where titre = 'Fixture C1-27'))$q$,
    false)
  || ' | ' ||
  pg_temp.essai('authenticated', membre,
    format($q$update regles_reveil set heure_debut = ((now() at time zone 'Europe/Brussels') - interval '1 hour')::time,
                                         heure_fin = ((now() at time zone 'Europe/Brussels') + interval '1 hour')::time
              where seuil_action_id = %L$q$, seuil_s0),
    $q$select string_agg(seuil_libelle, ' + ') from regles_reveil_correspondantes((select id from alertes_externes where titre = 'Fixture C1-27'))$q$,
    false)
from t_ids;
insert into t_rep (etape, resultat) select
  'C1-29 commune suspendue : règles armées par la fixture (clé de service) avant / pendant la suspension',
  pg_temp.valeur('service_role', null,
    $q$select count(*)::text from regles_reveil_correspondantes((select id from alertes_externes where titre = 'Fixture C1-27'))$q$)
  || ' / ' ||
  pg_temp.essai('postgres', null, format($q$update contextes set suspendu = true where id = %L$q$, commune),
    $q$select count(*)::text from regles_reveil_correspondantes((select id from alertes_externes where titre = 'Fixture C1-27'))$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'C1-30 règles lues par le membre / par l''anonyme',
  pg_temp.valeur('authenticated', membre, format($q$select count(*)::text from regles_reveil where contexte_id = %L$q$, commune))
  || ' / ' ||
  pg_temp.valeur('anon', null, $q$select count(*)::text from regles_reveil$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'C1-31 un membre « écriture » retire la règle S0 (attendu : 0 ligne, suppression réservée à l''admin de la commune, comme pour seuils_action)',
  pg_temp.essai('authenticated', membre, format($q$delete from regles_reveil where seuil_action_id = %L$q$, seuil_s0))
from t_ids;
insert into t_rep (etape, resultat) values
  ('C1-32 droits : anon (alertes, règles, vue) ; authenticated (modifier une alerte, insérer identifiant, insérer evenement)',
   has_table_privilege('anon', 'public.alertes_externes', 'select')::text || ', '
   || has_table_privilege('anon', 'public.regles_reveil', 'select')::text || ', '
   || has_table_privilege('anon', 'public.alertes_externes_en_cours', 'select')::text || ' ; '
   || has_table_privilege('authenticated', 'public.alertes_externes', 'update')::text || ', '
   || has_column_privilege('authenticated', 'public.alertes_externes', 'identifiant', 'insert')::text || ', '
   || has_column_privilege('authenticated', 'public.alertes_externes', 'evenement', 'insert')::text);

do $$
begin
  raise exception 'RESULTATS %', (select json_agg(json_build_object('etape', etape, 'resultat', resultat) order by n) from t_rep);
end $$;
