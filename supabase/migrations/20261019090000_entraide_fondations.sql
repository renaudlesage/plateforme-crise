-- Entraide : bénévoles et ressources privées (briefing du 2026-10-19, blocs 1 à 5)
-- Partie 1 : capacité « entraide », enrichissements additifs des tables existantes, fonctions de commandement.

-- ---------------------------------------------------------------------------
-- Capacité « entraide »
-- ---------------------------------------------------------------------------
alter table public.role_capacites drop constraint if exists role_capacites_ressource_check;
alter table public.role_capacites add constraint role_capacites_ressource_check
  check (ressource = any (array['configuration','referentiels','plans_urgence','exercices','incidents','communication',
    'resilience_territoriale','conformite_legale','comptes','situation','entraide']));

-- ---------------------------------------------------------------------------
-- Incident : coordinateur des bénévoles (décision du CC)
-- ---------------------------------------------------------------------------
alter table public.incidents
  add column if not exists coordinateur_benevoles text not null default 'aucun',
  add column if not exists coordinateur_benevoles_user_id uuid references auth.users(id) on delete set null,
  add column if not exists coordinateur_benevoles_libelle text,
  add column if not exists coordinateur_benevoles_depuis timestamptz;
alter table public.incidents drop constraint if exists incidents_coordinateur_benevoles_check;
alter table public.incidents add constraint incidents_coordinateur_benevoles_check
  check (coordinateur_benevoles in ('aucun','d4','personne')
    and (coordinateur_benevoles <> 'personne' or coordinateur_benevoles_user_id is not null));

-- ---------------------------------------------------------------------------
-- Annuaire des pré-inscrits : champs utiles en crise (additifs)
-- ---------------------------------------------------------------------------
alter table public.benevoles_entraide
  add column if not exists type_inscription text not null default 'prealable',
  add column if not exists majeur_declare boolean not null default true,
  add column if not exists contact_urgence_nom text,
  add column if not exists contact_urgence_telephone text,
  add column if not exists permis text[] not null default '{}',
  add column if not exists vehicule text,
  add column if not exists zone_residence text;
alter table public.benevoles_entraide drop constraint if exists benevoles_entraide_type_inscription_check;
alter table public.benevoles_entraide add constraint benevoles_entraide_type_inscription_check
  check (type_inscription in ('prealable','spontane'));

-- ---------------------------------------------------------------------------
-- Cadastre : moyens privés déclarés par leurs propriétaires (additifs)
-- ---------------------------------------------------------------------------
alter table public.ressources
  add column if not exists proprietaire_type text,
  add column if not exists statut_juridique text,
  add column if not exists delai_mise_a_dispo text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists proprietaire_nom text,
  add column if not exists proprietaire_telephone text,
  add column if not exists capacite text,
  add column if not exists declare_par_jeton uuid,
  add column if not exists declare_le timestamptz,
  add column if not exists verifie_le timestamptz,
  add column if not exists verifie_par uuid,
  add column if not exists actif boolean not null default true;
alter table public.ressources drop constraint if exists ressources_proprietaire_type_check;
alter table public.ressources add constraint ressources_proprietaire_type_check
  check (proprietaire_type is null or proprietaire_type in ('commune','entreprise','particulier','association','autre_autorite'));
alter table public.ressources drop constraint if exists ressources_statut_juridique_check;
alter table public.ressources add constraint ressources_statut_juridique_check
  check (statut_juridique is null or statut_juridique in ('convention_signee','accord_oral','declaration_proprietaire','requisitionnable'));
alter table public.ressources drop constraint if exists ressources_coords_check;
alter table public.ressources add constraint ressources_coords_check
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180));
create unique index if not exists ressources_declare_par_jeton_idx on public.ressources (declare_par_jeton) where declare_par_jeton is not null;

-- Liens vers le cadastre
alter table public.moyens_engages add column if not exists ressource_id uuid references public.ressources(id) on delete set null;
alter table public.requisitions add column if not exists ressource_id uuid references public.ressources(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Commandement : qui coordonne, qui commande sur zone
-- ---------------------------------------------------------------------------
-- Code du rôle de l'utilisateur dans un contexte (null s'il n'en a pas)
create or replace function public.code_role_utilisateur(p_contexte_id uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select r.code from public.acces_utilisateurs au join public.roles r on r.id = au.role_id
  where au.contexte_id = p_contexte_id and au.user_id = auth.uid() limit 1
$$;
revoke all on function public.code_role_utilisateur(uuid) from public, anon;
grant execute on function public.code_role_utilisateur(uuid) to authenticated, service_role;

-- Peut coordonner l'entraide d'un incident : CC (admin / tout pouvoir), D4, ou la personne désignée.
create or replace function public.peut_coordonner_entraide(p_incident_id uuid)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_contexte uuid; v_mode text; v_user uuid; v_role text;
begin
  select i.contexte_id, i.coordinateur_benevoles, i.coordinateur_benevoles_user_id into v_contexte, v_mode, v_user
    from public.incidents i where i.id = p_incident_id;
  if v_contexte is null then return false; end if;
  if not public.a_capacite(v_contexte, 'entraide', 'modifier') then return false; end if;
  if public.est_super_admin() or public.a_acces(v_contexte, 'admin') then return true; end if;
  v_role := public.code_role_utilisateur(v_contexte);
  if v_role in ('DIR_D4_CC', 'DIR_LOG_PCOPS') then return true; end if;
  if v_mode = 'personne' and v_user = auth.uid() then return true; end if;
  return false;
end $$;
revoke all on function public.peut_coordonner_entraide(uuid) from public, anon;
grant execute on function public.peut_coordonner_entraide(uuid) to authenticated, service_role;

-- Peut commander les missions sur zone : Dir PC-Ops et ses directeurs, ou CC (admin / tout pouvoir).
create or replace function public.peut_commander_zone_entraide(p_incident_id uuid)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_contexte uuid; v_role text;
begin
  select i.contexte_id into v_contexte from public.incidents i where i.id = p_incident_id;
  if v_contexte is null then return false; end if;
  if not public.a_capacite(v_contexte, 'entraide', 'modifier') then return false; end if;
  if public.est_super_admin() or public.a_acces(v_contexte, 'admin') then return true; end if;
  v_role := public.code_role_utilisateur(v_contexte);
  return v_role in ('DIR_PC_OPS', 'DIR_SI_PCOPS', 'DIR_MED_PCOPS', 'DIR_POL_PCOPS', 'DIR_LOG_PCOPS', 'DIR_INFO_PCOPS');
end $$;
revoke all on function public.peut_commander_zone_entraide(uuid) from public, anon;
grant execute on function public.peut_commander_zone_entraide(uuid) to authenticated, service_role;

-- Zone d'intervention active la plus restrictive contenant un point (rouge > orange > jaune), ou null.
create or replace function public.zone_intervention_du_point(p_incident_id uuid, p_lat double precision, p_lon double precision)
returns table (zone_id uuid, type_zone text) language sql stable security definer set search_path = public, pg_temp as $$
  select z.id, z.type_zone from public.zones_intervention z
  where z.incident_id = p_incident_id and z.date_levee is null
    and z.centre_latitude is not null and z.centre_longitude is not null and z.rayon_metres is not null
    and p_lat is not null and p_lon is not null
    and public.st_dwithin(
      public.st_setsrid(public.st_makepoint(p_lon, p_lat), 4326)::public.geography,
      public.st_setsrid(public.st_makepoint(z.centre_longitude::double precision, z.centre_latitude::double precision), 4326)::public.geography,
      z.rayon_metres::double precision)
  order by case z.type_zone when 'rouge' then 1 when 'orange' then 2 else 3 end
  limit 1
$$;
revoke all on function public.zone_intervention_du_point(uuid, double precision, double precision) from public, anon;
grant execute on function public.zone_intervention_du_point(uuid, double precision, double precision) to authenticated, service_role;

-- Désignation du coordinateur : CC seulement (admin / tout pouvoir sur le contexte), tracée au journal des décisions.
create or replace function public.designer_coordinateur_benevoles(p_incident_id uuid, p_mode text, p_user_id uuid default null, p_libelle text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_contexte uuid; v_droit boolean; v_texte text;
begin
  select i.contexte_id into v_contexte from public.incidents i where i.id = p_incident_id;
  if v_contexte is null then raise exception 'Incident introuvable'; end if;
  if not (public.est_super_admin() or public.a_acces(v_contexte, 'admin')
          or (public.a_capacite(v_contexte, 'entraide', 'modifier') and public.code_role_utilisateur(v_contexte) in ('AUTORITE_COMMUNALE','AUTORITE_PROVINCIALE','PLANU'))) then
    raise exception 'Seul le Comité de Coordination désigne le coordinateur des bénévoles' using errcode = '42501';
  end if;
  if p_mode not in ('aucun','d4','personne') then raise exception 'Mode de coordination inconnu'; end if;
  if p_mode = 'personne' then
    if p_user_id is null then raise exception 'Une personne doit être désignée'; end if;
    if not exists (select 1 from public.acces_utilisateurs au where au.contexte_id = v_contexte and au.user_id = p_user_id) then
      raise exception 'La personne désignée n''est pas membre de ce contexte';
    end if;
  end if;
  update public.incidents set
    coordinateur_benevoles = p_mode,
    coordinateur_benevoles_user_id = case when p_mode = 'personne' then p_user_id else null end,
    coordinateur_benevoles_libelle = case when p_mode = 'personne' then nullif(trim(coalesce(p_libelle,'')),'') else null end,
    coordinateur_benevoles_depuis = case when p_mode = 'aucun' then null else clock_timestamp() end
  where id = p_incident_id;
  v_texte := case p_mode
    when 'aucun' then 'Fin de la coordination des bénévoles : volet entraide fermé'
    when 'd4' then 'Coordination des bénévoles confiée à la D4 (logistique)'
    else 'Coordination des bénévoles confiée à ' || coalesce(nullif(trim(coalesce(p_libelle,'')),''), 'une personne désignée') end;
  insert into public.journal_decisions (incident_id, nature, decision, base_decision, decide_par, decide_le)
  values (p_incident_id, 'decision', v_texte, 'Organisation de l''entraide (bénévoles et moyens privés)', 'Comité de Coordination', clock_timestamp());
end $$;
revoke all on function public.designer_coordinateur_benevoles(uuid, text, uuid, text) from public, anon;
grant execute on function public.designer_coordinateur_benevoles(uuid, text, uuid, text) to authenticated, service_role;
