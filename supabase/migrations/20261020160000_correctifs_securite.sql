-- Correctifs de sécurité relevés à la Session 0 (docs/roadmap/CORRESPONDANCE.md,
-- section 6), à appliquer avant d'ouvrir l'outil à une vraie commune.
--
-- Contenu :
--   1. contextes : un membre ne peut plus modifier que config, latitude,
--      longitude et province. est_plateforme, la suspension, le type, le nom et
--      les notes de la plateforme ne changent plus que par les fonctions
--      plateforme_* (super-admin) ; les notes de la plateforme ne se lisent
--      plus que par la console. Trigger de garde en second rideau.
--      (Passer est_plateforme à true échouait déjà sur l'index unique
--      contextes_plateforme_unique : un seul contexte plateforme.)
--   2. contextes_publics() : ni la plateforme ni les clients suspendus.
--   3. benevoles_entraide : une inscription publique (anonyme, ou compte sans
--      droit de modifier les référentiels de la commune) arrive toujours
--      « en_attente », sans note interne, dans une commune ouverte au public,
--      avec des champs bornés.
--   4. plans_urgence_menages : plus d'insertion directe ; la création passe
--      par creer_plan_urgence_menage, qui vérifie la commune et borne l'adresse.
--   5. journal_ingestions_externes : charge reçue tronquée, rejets anonymes
--      plafonnés à 50 par tranche de 10 minutes.
--   6. Droits inutiles : fonctions réservées aux comptes connectés retirées
--      d'anon ; TRUNCATE, REFERENCES et TRIGGER retirés d'anon et authenticated.
-- Non destructif : aucune table, colonne, ligne, politique ni fonction supprimée.
-- Aucune modification des apps n'est nécessaire.

-- 1. contextes ----------------------------------------------------------------

revoke all on public.contextes from public, anon, authenticated;
grant select (id, type, nom, config, created_at, est_plateforme, sous_type_territorial,
              latitude, longitude, province, suspendu, suspendu_le, motif_suspension)
  on public.contextes to authenticated;
grant update (config, latitude, longitude, province) on public.contextes to authenticated;

create or replace function public.contextes_avant_modification()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  -- Les fonctions plateforme_* (security definer) et la clé de service ne
  -- s'exécutent pas sous anon / authenticated : seuls les appels directs
  -- depuis l'API sont gardés.
  if current_user in ('anon', 'authenticated') and not est_super_admin() and (
       new.id is distinct from old.id
    or new.type is distinct from old.type
    or new.nom is distinct from old.nom
    or new.created_at is distinct from old.created_at
    or new.est_plateforme is distinct from old.est_plateforme
    or new.sous_type_territorial is distinct from old.sous_type_territorial
    or new.suspendu is distinct from old.suspendu
    or new.suspendu_le is distinct from old.suspendu_le
    or new.motif_suspension is distinct from old.motif_suspension
    or new.notes_plateforme is distinct from old.notes_plateforme
  ) then
    raise exception 'Modification réservée à la plateforme' using errcode = '42501';
  end if;
  return new;
end;
$function$;

revoke all on function public.contextes_avant_modification() from public, anon, authenticated;

create or replace trigger contextes_colonnes_plateforme
  before update on public.contextes
  for each row execute function public.contextes_avant_modification();

-- 2. contextes_publics() --------------------------------------------------------

create or replace function public.contextes_publics()
 returns table(id uuid, nom text, type text)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select c.id, c.nom, c.type
  from contextes c
  where not c.est_plateforme and not c.suspendu;
$function$;

-- 3. benevoles_entraide ---------------------------------------------------------

create or replace function public.benevoles_entraide_avant_insertion()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  -- Saisie par l'équipe communale (droit de modifier les référentiels), par la
  -- clé de service ou en SQL : valeurs conservées.
  if current_user not in ('anon', 'authenticated')
     or a_capacite(new.contexte_id, 'referentiels', 'modifier') then
    return new;
  end if;

  -- Inscription publique : commune ouverte au public uniquement…
  if not exists (select 1 from contextes_publics() c where c.id = new.contexte_id) then
    raise exception 'Commune inconnue' using errcode = 'P0002';
  end if;

  -- …statut et champs internes imposés…
  new.statut := 'en_attente';
  new.note_interne := null;
  new.type_inscription := 'prealable';
  new.date_inscription := now();

  -- …et champs bornés (mêmes limites que l'inscription spontanée au point d'accueil).
  new.nom := left(trim(new.nom), 80);
  new.prenom := left(trim(new.prenom), 80);
  new.email := left(trim(new.email), 254);
  new.telephone := left(new.telephone, 30);
  new.adresse := left(new.adresse, 300);
  new.competences := new.competences[1:30];
  new.competences_autre := left(new.competences_autre, 300);
  new.missions_possibles := new.missions_possibles[1:30];
  new.disponibilite := left(new.disponibilite, 300);
  new.contact_urgence_nom := left(new.contact_urgence_nom, 120);
  new.contact_urgence_telephone := left(new.contact_urgence_telephone, 30);
  new.permis := new.permis[1:30];
  new.vehicule := left(new.vehicule, 120);
  new.zone_residence := left(new.zone_residence, 120);
  return new;
end;
$function$;

revoke all on function public.benevoles_entraide_avant_insertion() from public, anon, authenticated;

create or replace trigger benevoles_entraide_inscription_publique
  before insert on public.benevoles_entraide
  for each row execute function public.benevoles_entraide_avant_insertion();

-- 4. plans_urgence_menages --------------------------------------------------------

-- L'app citoyen crée les plans par creer_plan_urgence_menage (security definer) ;
-- aucune app n'insère directement. La politique « creation publique » est fermée
-- pour qu'un futur GRANT ne rouvre pas l'insertion directe.
revoke insert on public.plans_urgence_menages from public, anon, authenticated;
alter policy "creation publique" on public.plans_urgence_menages with check (false);

create or replace function public.creer_plan_urgence_menage(p_contexte_id uuid, p_adresse text)
 returns plans_urgence_menages
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  nouveau plans_urgence_menages;
  v_adresse text := left(nullif(trim(coalesce(p_adresse, '')), ''), 300);
begin
  if not exists (select 1 from contextes_publics() c where c.id = p_contexte_id) then
    raise exception 'Commune inconnue' using errcode = 'P0002';
  end if;
  if v_adresse is null then
    raise exception 'Adresse requise' using errcode = 'P0007';
  end if;

  insert into plans_urgence_menages (contexte_id, adresse, consentement_rgpd)
  values (p_contexte_id, v_adresse, true)
  returning * into nouveau;
  return nouveau;
end;
$function$;

-- 5. journal_ingestions_externes ----------------------------------------------------

create index if not exists journal_ingestions_externes_anonymes_idx
  on public.journal_ingestions_externes (created_at)
  where source_externe_id is null;

create or replace function public.journal_ingestions_externes_avant_insertion()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_plafond integer := case when new.source_externe_id is null then 2000 else 20000 end;
  v_taille integer;
begin
  -- Appel sans secret valide (aucune source résolue) : au plus 50 rejets
  -- journalisés par tranche de 10 minutes, les suivants sont ignorés.
  if new.source_externe_id is null and (
    select count(*) from journal_ingestions_externes j
    where j.source_externe_id is null and j.created_at > now() - interval '10 minutes'
  ) >= 50 then
    return null;
  end if;

  if new.charge_recue is not null then
    v_taille := octet_length(new.charge_recue::text);
    if v_taille > v_plafond then
      new.charge_recue := jsonb_build_object(
        'tronque', true,
        'taille_octets', v_taille,
        'extrait', left(new.charge_recue::text, v_plafond / 2));
    end if;
  end if;
  new.motif_rejet := left(new.motif_rejet, 500);
  return new;
end;
$function$;

revoke all on function public.journal_ingestions_externes_avant_insertion() from public, anon, authenticated;

create or replace trigger journal_ingestions_externes_bornes
  before insert on public.journal_ingestions_externes
  for each row execute function public.journal_ingestions_externes_avant_insertion();

-- 6. Droits inutiles ------------------------------------------------------------------

-- Fonctions qui refusent déjà tout appelant non connecté (super-admin ou admin
-- du contexte exigé) : retirées d'anon. Restent ouvertes à anon : les fonctions
-- utilisées dans les politiques (a_acces, a_capacite, mon_niveau_acces,
-- est_super_admin, contexte_du_parent_risque) et les RPC publiques par jeton ou
-- par commune (signalements, entraide, plans d'urgence des ménages).
revoke all on function
  public.plateforme_creer_client(text, text, text, text, boolean),
  public.plateforme_definir_acces(uuid, uuid, text, uuid),
  public.plateforme_desactiver_utilisateur(uuid, boolean),
  public.plateforme_journal(integer, uuid),
  public.plateforme_lister_clients(),
  public.plateforme_lister_utilisateurs(),
  public.plateforme_membres_client(uuid),
  public.plateforme_modifier_client(uuid, text, text, text, text, text),
  public.plateforme_retirer_acces(uuid),
  public.plateforme_roles_client(uuid),
  public.plateforme_statistiques(),
  public.plateforme_suspendre_client(uuid, boolean, text),
  public.creer_client(text, text),
  public.renommer_client(uuid, text),
  public.lister_clients(),
  public.lister_clients_v2(),
  public.membres_contexte(uuid),
  public.modifier_acces_membre(uuid, text, uuid),
  public.ressources_partageables(uuid)
from public, anon;

grant execute on function
  public.plateforme_creer_client(text, text, text, text, boolean),
  public.plateforme_definir_acces(uuid, uuid, text, uuid),
  public.plateforme_desactiver_utilisateur(uuid, boolean),
  public.plateforme_journal(integer, uuid),
  public.plateforme_lister_clients(),
  public.plateforme_lister_utilisateurs(),
  public.plateforme_membres_client(uuid),
  public.plateforme_modifier_client(uuid, text, text, text, text, text),
  public.plateforme_retirer_acces(uuid),
  public.plateforme_roles_client(uuid),
  public.plateforme_statistiques(),
  public.plateforme_suspendre_client(uuid, boolean, text),
  public.creer_client(text, text),
  public.renommer_client(uuid, text),
  public.lister_clients(),
  public.lister_clients_v2(),
  public.membres_contexte(uuid),
  public.modifier_acces_membre(uuid, text, uuid),
  public.ressources_partageables(uuid)
to authenticated, service_role;

-- TRUNCATE contourne la RLS et les triggers d'ajout seul ; REFERENCES et TRIGGER
-- ne servent à aucun rôle de l'API. Tables dont postgres est propriétaire
-- (spatial_ref_sys appartient à supabase_admin et reste hors de portée).
do $$
declare
  v_table regclass;
begin
  for v_table in
    select c.oid::regclass
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relowner = 'postgres'::regrole
  loop
    execute format('revoke truncate, references, trigger on %s from public, anon, authenticated', v_table);
  end loop;
end $$;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;

notify pgrst, 'reload schema';
