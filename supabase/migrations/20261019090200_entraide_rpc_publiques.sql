-- Entraide — partie 3 : accès sans compte (QR), déclaration d'un moyen privé, page publique.
-- Même patron que creer_signalement_citoyen : SECURITY DEFINER, idempotence par clé client, rien lisible en anonyme.

-- Vérifie un QR de point d'accueil : renvoie le minimum pour afficher le formulaire (jamais de nom de tiers).
create or replace function public.point_accueil_par_jeton(p_jeton uuid)
returns table (pab_id uuid, nom text, adresse text, consignes_briefing text, incident_nom text, commune text, age_minimum integer,
               taches_interdites text[], mention_rgpd text, briefing_texte text, ouvert boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.nom, p.adresse, p.consignes_briefing, i.nom, c.nom,
         coalesce(pe.age_minimum, 18), coalesce(pe.taches_interdites, '{}'), pe.mention_rgpd, pe.briefing_texte,
         (p.ferme_le is null and i.statut in ('en_cours','pre_alerte') and i.coordinateur_benevoles <> 'aucun')
  from public.points_accueil_benevoles p
  join public.incidents i on i.id = p.incident_id
  join public.contextes c on c.id = p.contexte_id
  left join public.parametres_entraide pe on pe.contexte_id = p.contexte_id
  where p.jeton_qr = p_jeton
$$;
revoke all on function public.point_accueil_par_jeton(uuid) from public;
grant execute on function public.point_accueil_par_jeton(uuid) to anon, authenticated, service_role;

-- Enregistrement spontané : idempotent sur (incident, clé client). Majeur obligatoire, consignes acceptées obligatoires.
create or replace function public.enregistrer_benevole_spontane(
  p_jeton_pab uuid, p_cle_client uuid, p_nom text, p_prenom text, p_telephone text,
  p_majeur boolean, p_consignes_acceptees boolean, p_contact_urgence_nom text default null, p_contact_urgence_telephone text default null,
  p_competences text[] default '{}', p_materiel_apporte text default null, p_email_preinscrit text default null)
returns table (numero text, statut text, jeton uuid, arrive_le timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_pab public.points_accueil_benevoles%rowtype; v_incident public.incidents%rowtype; v_existant public.presences_benevoles%rowtype;
        v_benevole uuid; v_age_min int;
begin
  select * into v_pab from public.points_accueil_benevoles p where p.jeton_qr = p_jeton_pab;
  if v_pab.id is null then raise exception 'Point d''accueil inconnu' using errcode = 'P0002'; end if;
  select * into v_incident from public.incidents i where i.id = v_pab.incident_id;

  select * into v_existant from public.presences_benevoles p where p.incident_id = v_pab.incident_id and p.cle_client = p_cle_client;
  if found then
    return query select v_existant.numero, v_existant.statut, v_existant.jeton, v_existant.arrive_le; return;
  end if;

  if v_pab.ferme_le is not null or v_incident.statut not in ('en_cours','pre_alerte') or v_incident.coordinateur_benevoles = 'aucun' then
    raise exception 'Point d''accueil fermé' using errcode = 'P0010';
  end if;
  select coalesce(pe.age_minimum, 18) into v_age_min from public.parametres_entraide pe where pe.contexte_id = v_pab.contexte_id;
  if not coalesce(p_majeur, false) then
    raise exception 'Âge minimum requis : % ans', coalesce(v_age_min, 18) using errcode = 'P0005';
  end if;
  if not coalesce(p_consignes_acceptees, false) then
    raise exception 'Les consignes de sécurité doivent être acceptées' using errcode = 'P0006';
  end if;
  if nullif(trim(coalesce(p_nom,'')), '') is null or nullif(trim(coalesce(p_prenom,'')), '') is null then
    raise exception 'Nom et prénom requis' using errcode = 'P0007';
  end if;

  -- Rattachement à une pré-inscription par adresse e-mail (même contexte), si fournie
  if nullif(trim(coalesce(p_email_preinscrit,'')), '') is not null then
    select b.id into v_benevole from public.benevoles_entraide b
    where b.contexte_id = v_pab.contexte_id and lower(b.email) = lower(trim(p_email_preinscrit)) and b.statut = 'valide' limit 1;
  end if;

  insert into public.presences_benevoles (incident_id, pab_id, benevole_id, nom, prenom, telephone, majeur_declare,
    contact_urgence_nom, contact_urgence_telephone, competences, materiel_apporte, consignes_acceptees_le, cle_client)
  values (v_pab.incident_id, v_pab.id, v_benevole, left(trim(p_nom), 80), left(trim(p_prenom), 80), left(nullif(trim(coalesce(p_telephone,'')),''), 30), true,
    left(nullif(trim(coalesce(p_contact_urgence_nom,'')),''), 120), left(nullif(trim(coalesce(p_contact_urgence_telephone,'')),''), 30),
    coalesce(p_competences, '{}'), left(nullif(trim(coalesce(p_materiel_apporte,'')),''), 300), clock_timestamp(), p_cle_client);

  return query select p.numero, p.statut, p.jeton, p.arrive_le from public.presences_benevoles p
    where p.incident_id = v_pab.incident_id and p.cle_client = p_cle_client;
end $$;
revoke all on function public.enregistrer_benevole_spontane(uuid, uuid, text, text, text, boolean, boolean, text, text, text[], text, text) from public;
grant execute on function public.enregistrer_benevole_spontane(uuid, uuid, text, text, text, boolean, boolean, text, text, text[], text, text) to anon, authenticated, service_role;

-- Suivi par le bénévole : son numéro, son statut, sa mission en cours. Jamais le nom d'un tiers.
create or replace function public.suivre_presence_benevole(p_jeton uuid)
returns table (numero text, statut text, arrive_le timestamptz, valide_le timestamptz, sorti_le timestamptz, sortie_demandee_le timestamptz,
               equipe_nom text, mission_numero text, mission_titre text, mission_point_rdv text, mission_adresse text, mission_statut text, pab_nom text)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.numero, p.statut, p.arrive_le, p.valide_le, p.sorti_le, p.sortie_demandee_le,
         e.nom, m.numero, m.titre, m.point_rdv, m.adresse, m.statut, pab.nom
  from public.presences_benevoles p
  join public.points_accueil_benevoles pab on pab.id = p.pab_id
  left join public.membres_equipe_entraide me on me.presence_id = p.id and me.a is null
  left join public.equipes_entraide e on e.id = me.equipe_id
  left join lateral (select m.* from public.missions_entraide m where m.equipe_id = e.id and m.statut in ('affectee','en_cours') order by m.priorite, m.created_at limit 1) m on true
  where p.jeton = p_jeton
$$;
revoke all on function public.suivre_presence_benevole(uuid) from public;
grant execute on function public.suivre_presence_benevole(uuid) to anon, authenticated, service_role;

-- « Je sors » : demande, confirmée ensuite par l'agent (le comptage reste sous contrôle du point d'accueil)
create or replace function public.demander_sortie_benevole(p_jeton uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  select id into v_id from public.presences_benevoles where jeton = p_jeton and statut not in ('sorti','refuse') and sortie_demandee_le is null;
  if v_id is null then return false; end if;
  -- colonne figée par le trigger : on passe par une mise à jour directe sous SECURITY DEFINER avec garde
  perform set_config('entraide.demande_sortie', '1', true);
  update public.presences_benevoles set sortie_demandee_le = clock_timestamp() where id = v_id;
  perform set_config('entraide.demande_sortie', '', true);
  return true;
end $$;
revoke all on function public.demander_sortie_benevole(uuid) from public;
grant execute on function public.demander_sortie_benevole(uuid) to anon, authenticated, service_role;

-- Déclaration d'un moyen privé par son propriétaire (sans compte). Entre dans le cadastre en « déclaration propriétaire », inactif tant que non vérifié.
create or replace function public.declarer_moyen_prive(
  p_contexte uuid, p_cle_client uuid, p_categorie text, p_nom text, p_proprietaire_type text, p_proprietaire_nom text, p_proprietaire_telephone text,
  p_capacite text default null, p_delai text default null, p_conditions text default null, p_latitude double precision default null, p_longitude double precision default null)
returns table (reference uuid, statut_juridique text, actif boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_existant public.ressources%rowtype; v_id uuid;
begin
  if not exists (select 1 from public.contextes c where c.id = p_contexte) then raise exception 'Contexte inconnu' using errcode = 'P0002'; end if;
  select * into v_existant from public.ressources r where r.declare_par_jeton = p_cle_client;
  if found then return query select v_existant.declare_par_jeton, v_existant.statut_juridique, v_existant.actif; return; end if;
  if nullif(trim(coalesce(p_nom,'')),'') is null or nullif(trim(coalesce(p_proprietaire_nom,'')),'') is null or nullif(trim(coalesce(p_proprietaire_telephone,'')),'') is null then
    raise exception 'Nom du moyen, nom et téléphone du propriétaire requis' using errcode = 'P0007';
  end if;
  if p_proprietaire_type not in ('entreprise','particulier','association') then raise exception 'Type de propriétaire inconnu' using errcode = 'P0008'; end if;
  insert into public.ressources (contexte_id, categorie, type_public_prive, nom, proprietaire_type, proprietaire_nom, proprietaire_telephone,
    capacite, delai_mise_a_dispo, conditions_partage, latitude, longitude, statut_juridique, declare_par_jeton, declare_le, actif, disponible_hors_contexte)
  values (p_contexte, left(trim(p_categorie), 80), 'prive', left(trim(p_nom), 160), p_proprietaire_type, left(trim(p_proprietaire_nom), 120), left(trim(p_proprietaire_telephone), 30),
    left(nullif(trim(coalesce(p_capacite,'')),''), 200), left(nullif(trim(coalesce(p_delai,'')),''), 120), left(nullif(trim(coalesce(p_conditions,'')),''), 500),
    p_latitude, p_longitude, 'declaration_proprietaire', p_cle_client, clock_timestamp(), false, false)
  returning id into v_id;
  return query select r.declare_par_jeton, r.statut_juridique, r.actif from public.ressources r where r.id = v_id;
end $$;
revoke all on function public.declarer_moyen_prive(uuid, uuid, text, text, text, text, text, text, text, text, double precision, double precision) from public;
grant execute on function public.declarer_moyen_prive(uuid, uuid, text, text, text, text, text, text, text, text, double precision, double precision) to anon, authenticated, service_role;

-- Page publique de l'entraide : points d'accueil ouverts, besoins publiés, consignes, points de collecte.
-- Jamais de nom, de téléphone ni de position de bénévole ; jamais alimentée par un exercice.
create or replace function public.etat_public_entraide(p_contexte uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  with inc as (
    select i.id, i.nom from public.incidents i
    where i.contexte_id = p_contexte and i.statut in ('en_cours','pre_alerte') and i.est_exercice = false
      and i.coordinateur_benevoles <> 'aucun' and i.phase_cycle_vie in ('alerte','phase_active')
  )
  select case when not exists (select 1 from inc) then jsonb_build_object('actif', false) else jsonb_build_object(
    'actif', true,
    'incidents', (select jsonb_agg(jsonb_build_object('nom', inc.nom)) from inc),
    'points_accueil', (select coalesce(jsonb_agg(jsonb_build_object('nom', p.nom, 'adresse', p.adresse, 'latitude', p.latitude, 'longitude', p.longitude, 'consignes', p.consignes_briefing) order by p.nom), '[]'::jsonb)
                       from public.points_accueil_benevoles p join inc on inc.id = p.incident_id where p.ferme_le is null),
    'besoins', (select coalesce(jsonb_agg(jsonb_build_object('libelle', b.libelle, 'categorie', b.categorie, 'quantite', b.quantite_souhaitee, 'statut', b.statut,
                        'point_collecte', pc.nom) order by b.statut, b.libelle), '[]'::jsonb)
                from public.besoins_nature b join inc on inc.id = b.incident_id left join public.points_collecte pc on pc.id = b.point_collecte_id
                where b.publie and b.statut in ('ouvert','couvert')),
    'missions_publiques', (select coalesce(jsonb_agg(jsonb_build_object('titre', m.titre, 'competences', m.competence_requise, 'nb_personnes', m.nb_personnes, 'adresse', m.adresse) order by m.priorite), '[]'::jsonb)
                           from public.missions_entraide m join inc on inc.id = m.incident_id where m.publie_besoin and m.statut = 'ouverte' and m.type_zone is distinct from 'rouge'),
    'points_collecte', (select coalesce(jsonb_agg(jsonb_build_object('nom', pc.nom, 'adresse', pc.adresse, 'horaires', pc.horaires, 'consignes', pc.consignes, 'latitude', pc.latitude, 'longitude', pc.longitude) order by pc.nom), '[]'::jsonb)
                        from public.points_collecte pc join inc on inc.id = pc.incident_id where pc.ferme_le is null),
    'consignes', (select jsonb_build_object('message', c.message, 'ne_pas_venir', c.ne_pas_venir) from public.consignes_entraide_publiques c join inc on inc.id = c.incident_id where c.publie limit 1),
    'maj_le', now()
  ) end
$$;
revoke all on function public.etat_public_entraide(uuid) from public;
grant execute on function public.etat_public_entraide(uuid) to anon, authenticated, service_role;

-- Le trigger des présences fige sortie_demandee_le : autoriser la pose unique par la RPC
create or replace function public.presences_benevoles_sortie_demandee() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if coalesce(current_setting('entraide.demande_sortie', true), '') = '1' and old.sortie_demandee_le is null then
    new.sortie_demandee_le := clock_timestamp();
  end if;
  return new;
end $$;
revoke all on function public.presences_benevoles_sortie_demandee() from public, anon, authenticated;
-- Doit s'exécuter APRÈS presences_benevoles_controle (ordre alphabétique des triggers BEFORE) : « z_ » le garantit
create or replace trigger z_presences_benevoles_sortie_demandee before update on public.presences_benevoles
  for each row execute function public.presences_benevoles_sortie_demandee();
