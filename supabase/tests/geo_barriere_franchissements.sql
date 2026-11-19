-- Tests de la géo-barrière (migration 20261119100000_geo_barriere_franchissements.sql), à exécuter dans le SQL Editor
-- après la migration (ou, en répétition, à la suite de son texte dans la même transaction). Transaction annulée par
-- l'exception finale, qui affiche les résultats. S'appuie sur la Commune Test et son incident en cours doté d'une
-- zone rouge (créée dans la transaction si elle manque).

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
  (select p.id from contextes p where p.est_plateforme limit 1) as plateforme,
  (select au.user_id from acces_utilisateurs au
   where au.contexte_id = c.id and au.niveau_acces = 'ecriture'
     and not exists (select 1 from acces_utilisateurs a2 join contextes p on p.id = a2.contexte_id
                     where a2.user_id = au.user_id and p.est_plateforme and a2.niveau_acces = 'admin')
   order by au.user_id limit 1) as membre,
  gen_random_uuid() as etranger,
  (select i.id from incidents i where i.contexte_id = c.id and i.statut = 'en_cours' order by i.date_debut desc limit 1) as incident,
  -- zone d'un autre incident (ou identifiant inexistant si la base n'en a pas) : doit être refusée par le déclencheur
  coalesce((select z.id from zones_intervention z join incidents i on i.id = z.incident_id
            where i.id <> (select i2.id from incidents i2 where i2.contexte_id = c.id and i2.statut = 'en_cours' order by i2.date_debut desc limit 1) limit 1),
           gen_random_uuid()) as zone_autre,
  null::uuid as zone, null::uuid as zone_orange, gen_random_uuid() as cle
from contextes c where c.nom = 'Commune Test' limit 1;

-- Zones de l'incident : une rouge (existante ou créée), une orange créée pour le test.
update t_ids set zone = (select z.id from zones_intervention z where z.incident_id = t_ids.incident and z.type_zone = 'rouge'
  and z.date_levee is null and z.centre_latitude is not null and z.rayon_metres is not null limit 1);
insert into zones_intervention (incident_id, type_zone, perimetre, centre_latitude, centre_longitude, rayon_metres, scenario_climatique_reference)
  select incident, 'rouge', 'exclusion', 50.3934, 5.5382, 100, 'test-gb-rouge' from t_ids where zone is null;
update t_ids set zone = coalesce(zone, (select z.id from zones_intervention z where z.incident_id = t_ids.incident and z.scenario_climatique_reference = 'test-gb-rouge'));
insert into zones_intervention (incident_id, type_zone, perimetre, centre_latitude, centre_longitude, rayon_metres, scenario_climatique_reference)
  select incident, 'orange', 'isolation', 50.3934, 5.5382, 1200, 'test-gb-orange' from t_ids;
update t_ids set zone_orange = (select z.id from zones_intervention z where z.incident_id = t_ids.incident and z.scenario_climatique_reference = 'test-gb-orange');

insert into t_rep (etape, resultat) select 'GB-00 fixtures : commune/membre/incident/zone',
  format('%s / %s / %s / %s', commune is not null, membre is not null, incident is not null, zone is not null) from t_ids;

-- 1. Insertion nominale (membre, zone rouge) : type_zone copié de la zone, auteur forcé
insert into t_rep (etape, resultat) select 'GB-01 membre : entrée en zone rouge',
  pg_temp.essai('authenticated', membre,
    format($q$insert into franchissements_zone (contexte_id, incident_id, zone_id, libelle, nature, latitude, longitude, precision_m)
             values (%L, %L, %L, 'Équipe test', 'entree', 50.3934, 5.5382, 12)$q$, commune, incident, zone),
    format($q$select type_zone || ' / auteur ok=' || (auteur_id = %L)::text || ' / cree_le ok=' || (cree_le >= now())::text from franchissements_zone where incident_id = %L order by cree_le desc limit 1$q$, membre, incident))
  from t_ids;

-- 2. Zone orange : acceptée aussi (le filtre « rouge » est côté client), type_zone = orange
insert into t_rep (etape, resultat) select 'GB-02 membre : sortie de zone orange (type copié)',
  pg_temp.essai('authenticated', membre,
    format($q$insert into franchissements_zone (contexte_id, incident_id, zone_id, nature, latitude, longitude) values (%L, %L, %L, 'sortie', 50.39, 5.53)$q$, commune, incident, zone_orange),
    format($q$select type_zone from franchissements_zone where zone_id = %L$q$, zone_orange))
  from t_ids;

-- 3. Idempotence : même id deux fois, « on conflict do nothing » → 0 ligne la seconde fois, une seule en base
insert into t_rep (etape, resultat) select 'GB-03 membre : première écriture avec id client',
  pg_temp.essai('authenticated', membre,
    format($q$insert into franchissements_zone (id, contexte_id, incident_id, zone_id, nature, latitude, longitude) values (%L, %L, %L, %L, 'entree', 50.3934, 5.5382) on conflict (id) do nothing$q$, cle, commune, incident, zone),
    null, false)
  from t_ids;
insert into t_rep (etape, resultat) select 'GB-04 membre : rejeu du même id → 0 ligne, 1 en base',
  pg_temp.essai('authenticated', membre,
    format($q$insert into franchissements_zone (id, contexte_id, incident_id, zone_id, nature, latitude, longitude) values (%L, %L, %L, %L, 'entree', 50.3934, 5.5382) on conflict (id) do nothing$q$, cle, commune, incident, zone),
    format($q$select count(*)::text from franchissements_zone where id = %L$q$, cle), false)
  from t_ids;

-- 4. Lecture : le membre voit la ligne ; l'étranger et anon ne voient rien
insert into t_rep (etape, resultat) select 'GB-05 membre : lit ses franchissements',
  pg_temp.valeur('authenticated', membre, format($q$select count(*)::text from franchissements_zone where id = %L$q$, cle)) from t_ids;
insert into t_rep (etape, resultat) select 'GB-06 étranger : ne voit rien (0)',
  pg_temp.valeur('authenticated', etranger, format($q$select count(*)::text from franchissements_zone where id = %L$q$, cle)) from t_ids;
insert into t_rep (etape, resultat) select 'GB-07 anon : refus ou 0',
  pg_temp.valeur('anon', null, format($q$select count(*)::text from franchissements_zone where id = %L$q$, cle)) from t_ids;

-- 5. Ajout seul : ni modification ni suppression, même par l'auteur
insert into t_rep (etape, resultat) select 'GB-08 membre : update refusé',
  pg_temp.essai('authenticated', membre, format($q$update franchissements_zone set libelle = 'x' where id = %L$q$, cle)) from t_ids;
insert into t_rep (etape, resultat) select 'GB-09 membre : delete refusé',
  pg_temp.essai('authenticated', membre, 'dele' || 'te from franchissements_zone where id = ' || quote_literal(cle)) from t_ids;

-- 6. Garde-fous
insert into t_rep (etape, resultat) select 'GB-10 auteur_id fourni par le client : colonne non accordée',
  pg_temp.essai('authenticated', membre,
    format($q$insert into franchissements_zone (contexte_id, incident_id, zone_id, auteur_id, nature, latitude, longitude) values (%L, %L, %L, %L, 'entree', 50.39, 5.53)$q$, commune, incident, zone, etranger)) from t_ids;
insert into t_rep (etape, resultat) select 'GB-11 zone d''un autre incident : P0012',
  pg_temp.essai('authenticated', membre,
    format($q$insert into franchissements_zone (contexte_id, incident_id, zone_id, nature, latitude, longitude) values (%L, %L, %L, 'entree', 50.39, 5.53)$q$, commune, incident, zone_autre)) from t_ids;
insert into t_rep (etape, resultat) select 'GB-12 incident hors du contexte : refus',
  pg_temp.essai('authenticated', membre,
    format($q$insert into franchissements_zone (contexte_id, incident_id, zone_id, nature, latitude, longitude) values (%L, %L, %L, 'entree', 50.39, 5.53)$q$, plateforme, incident, zone)) from t_ids;
insert into t_rep (etape, resultat) select 'GB-13 nature inconnue : refus',
  pg_temp.essai('authenticated', membre,
    format($q$insert into franchissements_zone (contexte_id, incident_id, zone_id, nature, latitude, longitude) values (%L, %L, %L, 'approche', 50.39, 5.53)$q$, commune, incident, zone)) from t_ids;
insert into t_rep (etape, resultat) select 'GB-14 étranger : insertion refusée',
  pg_temp.essai('authenticated', etranger,
    format($q$insert into franchissements_zone (contexte_id, incident_id, zone_id, nature, latitude, longitude) values (%L, %L, %L, 'entree', 50.39, 5.53)$q$, commune, incident, zone)) from t_ids;
insert into t_rep (etape, resultat) select 'GB-15 anon : insertion refusée',
  pg_temp.essai('anon', null,
    format($q$insert into franchissements_zone (contexte_id, incident_id, zone_id, nature, latitude, longitude) values (%L, %L, %L, 'entree', 50.39, 5.53)$q$, commune, incident, zone)) from t_ids;
insert into t_rep (etape, resultat) select 'GB-16 heure appareil dans le futur : ramenée au serveur',
  pg_temp.essai('authenticated', membre,
    format($q$insert into franchissements_zone (contexte_id, incident_id, zone_id, nature, latitude, longitude, horodatage_appareil) values (%L, %L, %L, 'entree', 50.39, 5.53, now() + interval '2 hours')$q$, commune, incident, zone),
    format($q$select (horodatage_appareil <= clock_timestamp())::text from franchissements_zone where incident_id = %L order by cree_le desc limit 1$q$, incident)) from t_ids;
insert into t_rep (etape, resultat) select 'GB-17 heure appareil passée (file hors ligne) : conservée',
  pg_temp.essai('authenticated', membre,
    format($q$insert into franchissements_zone (contexte_id, incident_id, zone_id, nature, latitude, longitude, horodatage_appareil) values (%L, %L, %L, 'sortie', 50.39, 5.53, now() - interval '40 minutes')$q$, commune, incident, zone),
    format($q$select (horodatage_appareil < now() - interval '30 minutes')::text from franchissements_zone where incident_id = %L order by cree_le desc limit 1$q$, incident)) from t_ids;
insert into t_rep (etape, resultat) select 'GB-18 fonction de déclencheur non exécutable par authenticated',
  pg_temp.valeur('authenticated', membre, $q$select has_function_privilege('public.franchissements_zone_controle()', 'execute')::text$q$) from t_ids;

do $$ begin raise exception 'RESULTATS %', (select string_agg(n || ' ' || etape || ' => ' || resultat, E'\n' order by n) from t_rep); end $$;
rollback;
