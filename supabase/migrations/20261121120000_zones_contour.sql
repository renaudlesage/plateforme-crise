-- Zones d'intervention à contour libre (polygone), posées depuis le terrain.
--
-- Jusqu'ici une zone était un cercle (centre + rayon). On ajoute `contour` : un Polygon GeoJSON ([lon, lat],
-- anneau fermé, sans trou), tracé en touchant les coins sur la carte (Terrain › Commandement, CC › incident).
--  - Une zone est soit un cercle (contour null, comme avant), soit un contour.
--  - Pour une zone à contour, le déclencheur calcule `centre_latitude/longitude` (centroïde) et `rayon_metres`
--    (rayon ENGLOBANT : le cercle contient tout le contour). Les écrans à jour utilisent le contour ; un écran resté
--    en ancienne version (PWA en cache) voit un cercle qui couvre toute la zone : il prévient trop, jamais trop peu.
--  - Le contour ne se modifie pas : on lève la zone et on en pose une nouvelle (trace claire pour le CC et le REX,
--    cohérence du journal des franchissements). Les autres champs (accès, révision…) restent modifiables.
--  - Garde-fous : 3 à 50 sommets, contour valide (pas de croisement), 100 m² à 500 km², coordonnées plausibles.
-- `zone_intervention_du_point` (entraide : dans quelle zone tombe un point) tient compte du contour.
-- Aucune donnée existante n'est modifiée.

alter table public.zones_intervention add column if not exists contour jsonb;

comment on column public.zones_intervention.contour is
  'Contour libre de la zone (Polygon GeoJSON, [lon, lat], anneau fermé, 3 à 50 sommets). Null : zone circulaire (centre + rayon). Si présent, centre et rayon sont calculés (centroïde, rayon englobant). Non modifiable : lever et remplacer.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'zones_intervention_contour_objet') then
    alter table public.zones_intervention add constraint zones_intervention_contour_objet
      check (contour is null or jsonb_typeof(contour) = 'object');
  end if;
end $$;

create or replace function public.zones_intervention_contour()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_geom geometry;
  v_centre geometry;
  v_n integer;
  v_surface double precision;
  v_rayon double precision;
begin
  if tg_op = 'UPDATE' and new.contour is distinct from old.contour then
    raise exception 'Le contour d''une zone ne se modifie pas : levez-la et posez-en une nouvelle.' using errcode = 'P0021';
  end if;
  if new.contour is null then
    return new;
  end if;

  if new.contour->>'type' is distinct from 'Polygon' then
    raise exception 'Contour invalide : un polygone GeoJSON est attendu.' using errcode = 'P0022';
  end if;
  begin
    v_geom := st_setsrid(st_geomfromgeojson(new.contour::text), 4326);
  exception when others then
    raise exception 'Contour illisible.' using errcode = 'P0022';
  end;
  if geometrytype(v_geom) <> 'POLYGON' or st_nrings(v_geom) <> 1 then
    raise exception 'Contour invalide : un seul anneau, sans trou.' using errcode = 'P0022';
  end if;
  v_n := st_npoints(v_geom); -- anneau fermé : sommets + 1
  if v_n < 4 or v_n > 51 then
    raise exception 'Contour invalide : 3 à 50 coins.' using errcode = 'P0022';
  end if;
  if st_xmin(v_geom) < -180 or st_xmax(v_geom) > 180 or st_ymin(v_geom) < -90 or st_ymax(v_geom) > 90 then
    raise exception 'Contour invalide : coordonnées hors limites.' using errcode = 'P0022';
  end if;
  if not st_isvalid(v_geom) then
    raise exception 'Contour invalide : il se croise. Touchez les coins dans l''ordre du tour.' using errcode = 'P0022';
  end if;
  v_surface := st_area(v_geom::geography);
  if v_surface < 100 or v_surface > 500000000 then
    raise exception 'Contour invalide : surface hors limites (100 m² à 500 km²).' using errcode = 'P0022';
  end if;

  v_centre := st_centroid(v_geom);
  select max(st_distance(v_centre::geography, (d).geom::geography)) into v_rayon from st_dumppoints(v_geom) d;
  new.centre_latitude := round(st_y(v_centre)::numeric, 7);
  new.centre_longitude := round(st_x(v_centre)::numeric, 7);
  new.rayon_metres := ceil(v_rayon);
  return new;
end;
$$;
revoke all on function public.zones_intervention_contour() from public, anon, authenticated;

create or replace trigger zones_intervention_contour
  before insert or update on public.zones_intervention
  for each row execute function public.zones_intervention_contour();

-- Entraide : zone d'intervention d'un point (la plus grave). Contour pris en compte ; cercle inchangé.
create or replace function public.zone_intervention_du_point(p_incident_id uuid, p_lat double precision, p_lon double precision)
returns table(zone_id uuid, type_zone text)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select z.id, z.type_zone from public.zones_intervention z
  where z.incident_id = p_incident_id and z.date_levee is null
    and p_lat is not null and p_lon is not null
    and case
      when z.contour is not null then
        public.st_intersects(
          public.st_setsrid(public.st_geomfromgeojson(z.contour::text), 4326),
          public.st_setsrid(public.st_makepoint(p_lon, p_lat), 4326))
      when z.centre_latitude is not null and z.centre_longitude is not null and z.rayon_metres is not null then
        public.st_dwithin(
          public.st_setsrid(public.st_makepoint(p_lon, p_lat), 4326)::public.geography,
          public.st_setsrid(public.st_makepoint(z.centre_longitude::double precision, z.centre_latitude::double precision), 4326)::public.geography,
          z.rayon_metres::double precision)
      else false
    end
  order by case z.type_zone when 'rouge' then 1 when 'orange' then 2 else 3 end
  limit 1
$function$;
revoke all on function public.zone_intervention_du_point(uuid, double precision, double precision) from public, anon;
grant execute on function public.zone_intervention_du_point(uuid, double precision, double precision) to authenticated, service_role;
