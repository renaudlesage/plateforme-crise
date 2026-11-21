-- Tests des zones à contour (migration 20261121120000_zones_contour.sql), à exécuter dans le SQL Editor après la
-- migration (ou, en répétition, à la suite de son texte dans la même requête). Annulés par l'exception finale, qui
-- affiche les résultats. S'appuie sur la Commune Test et son incident en cours.

create temp table t_rep (n serial, etape text, resultat text);
create temp table t_ids as
select c.id as commune,
  (select au.user_id from acces_utilisateurs au where au.contexte_id = c.id and au.niveau_acces = 'ecriture' order by au.user_id limit 1) as membre,
  (select i.id from incidents i where i.contexte_id = c.id and i.statut = 'en_cours' order by i.date_debut desc limit 1) as incident
from contextes c where c.nom = 'Commune Test' limit 1;

create function pg_temp.essai(p_uid uuid, p_sql text) returns text language plpgsql as $f$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    execute p_sql into v;
    v := 'OK ' || coalesce(v, 'null');
  exception when others then
    v := 'REFUS ' || sqlstate || ' : ' || sqlerrm;
  end;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  return v;
end $f$;

-- Carré d'environ 200 m de côté autour du centre de la zone rouge d'« Inondation Logne » (50.3934, 5.5382).
create temp table t_formes as select
  '{"type":"Polygon","coordinates":[[[5.5368,50.3925],[5.5396,50.3925],[5.5396,50.3943],[5.5368,50.3943],[5.5368,50.3925]]]}'::jsonb as carre,
  '{"type":"Polygon","coordinates":[[[5.5368,50.3925],[5.5396,50.3943],[5.5396,50.3925],[5.5368,50.3943],[5.5368,50.3925]]]}'::jsonb as papillon,
  '{"type":"Polygon","coordinates":[[[5.5368,50.3925],[5.53681,50.3925],[5.53681,50.39251],[5.5368,50.3925]]]}'::jsonb as minuscule,
  '{"type":"Point","coordinates":[5.5382,50.3934]}'::jsonb as point;

insert into t_rep (etape, resultat) select 'ZC-00 fixtures commune/membre/incident', format('%s / %s / %s', commune is not null, membre is not null, incident is not null) from t_ids;

-- 1. Membre d'écriture : pose d'une zone rouge à contour ; centre et rayon englobant calculés
insert into t_rep (etape, resultat) select 'ZC-01 membre : zone rouge à contour',
  pg_temp.essai(membre, format($q$with z as (insert into zones_intervention (incident_id, type_zone, perimetre, contour, scenario_climatique_reference)
    values (%L, 'rouge', 'exclusion', %L, 'test-zc') returning centre_latitude, centre_longitude, rayon_metres)
    select centre_latitude || ' / ' || centre_longitude || ' / rayon ' || rayon_metres from z$q$, incident, (select carre from t_formes)))
  from t_ids;

-- 2. Le contour ne se modifie pas
insert into t_rep (etape, resultat) select 'ZC-02 modification du contour refusée',
  pg_temp.essai(membre, format($q$with z as (update zones_intervention set contour = %L where scenario_climatique_reference = 'test-zc' returning 1) select count(*)::text from z$q$,
    (select jsonb_set(carre, '{coordinates,0,1,0}', '5.5400'::jsonb) from t_formes)))
  from t_ids;

-- 3. Les autres champs restent modifiables ; centre et rayon recalculés depuis le contour (pas de dérive)
insert into t_rep (etape, resultat) select 'ZC-03 accès modifiable, centre forcé',
  pg_temp.essai(membre, $q$with z as (update zones_intervention set acces_autorise = 'test', centre_latitude = 0, rayon_metres = 1 where scenario_climatique_reference = 'test-zc' returning centre_latitude, rayon_metres) select centre_latitude || ' / ' || rayon_metres from z$q$)
  from t_ids;

-- 4 à 6. Contours refusés
insert into t_rep (etape, resultat) select 'ZC-04 nœud papillon refusé',
  pg_temp.essai(membre, format($q$insert into zones_intervention (incident_id, type_zone, perimetre, contour) values (%L, 'orange', 'isolation', %L) returning 'inséré'$q$, incident, (select papillon from t_formes)))
  from t_ids;
insert into t_rep (etape, resultat) select 'ZC-05 surface < 100 m² refusée',
  pg_temp.essai(membre, format($q$insert into zones_intervention (incident_id, type_zone, perimetre, contour) values (%L, 'orange', 'isolation', %L) returning 'inséré'$q$, incident, (select minuscule from t_formes)))
  from t_ids;
insert into t_rep (etape, resultat) select 'ZC-06 point GeoJSON refusé',
  pg_temp.essai(membre, format($q$insert into zones_intervention (incident_id, type_zone, perimetre, contour) values (%L, 'orange', 'isolation', %L) returning 'inséré'$q$, incident, (select point from t_formes)))
  from t_ids;

-- 7. Zone circulaire : inchangée (pas de contour, rayon saisi conservé)
insert into t_rep (etape, resultat) select 'ZC-07 cercle inchangé',
  pg_temp.essai(membre, format($q$with z as (insert into zones_intervention (incident_id, type_zone, perimetre, centre_latitude, centre_longitude, rayon_metres, scenario_climatique_reference)
    values (%L, 'jaune', 'dissuasion', 50.39, 5.53, 250, 'test-zc-cercle') returning rayon_metres, contour) select rayon_metres || ' / contour ' || coalesce(contour::text, 'null') from z$q$, incident))
  from t_ids;

-- 8. zone_intervention_du_point : le contour compte, pas le cercle englobant
-- (50.3942, 5.5395) : dans le carré, mais à ~128 m du centre, donc hors du cercle rouge réel de 100 m
insert into t_rep (etape, resultat) select 'ZC-08 point dans un coin du carré → zone test',
  coalesce((select z.scenario_climatique_reference from zone_intervention_du_point((select incident from t_ids), 50.3942, 5.5395) p
            join zones_intervention z on z.id = p.zone_id), 'aucune');
insert into t_rep (etape, resultat) select 'ZC-09 point dans le cercle englobant mais hors du carré',
  coalesce((select z.scenario_climatique_reference from zone_intervention_du_point((select incident from t_ids), 50.3945, 5.5382) p
            join zones_intervention z on z.id = p.zone_id), 'aucune zone test (attendu)');

-- 9. Anonyme : ne peut pas poser de zone
insert into t_rep (etape, resultat) select 'ZC-10 anon refusé',
  (select case when has_table_privilege('anon', 'public.zones_intervention', 'INSERT') then 'privilège insert présent (RLS décide)' else 'pas de privilège insert' end);

do $$ begin raise exception 'RESULTATS %', (select string_agg(n || ' ' || etape || ' => ' || resultat, E'\n' order by n) from t_rep); end $$;
