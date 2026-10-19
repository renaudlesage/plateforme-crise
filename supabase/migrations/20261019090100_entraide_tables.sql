-- Entraide — partie 2 : points d'accueil, présences, équipes, missions, paramètres, incidents bénévoles, dons.
-- Aucune de ces tables n'est lisible en anonyme ; l'enregistrement sans compte passe par des RPC (partie 3).

-- ---------------------------------------------------------------------------
-- Paramètres communaux (bloc 4) — une ligne par contexte
-- ---------------------------------------------------------------------------
create table if not exists public.parametres_entraide (
  contexte_id uuid primary key references public.contextes(id) on delete cascade,
  assureur text,
  police_numero text,
  police_url text,
  age_minimum integer not null default 18 check (age_minimum between 16 and 21),
  taches_interdites text[] not null default '{zone_rouge,electricite,eau_contaminee,toiture,tronconnage}',
  duree_max_engagement_minutes integer not null default 360 check (duree_max_engagement_minutes between 60 and 1440),
  duree_repos_min_minutes integer not null default 60 check (duree_repos_min_minutes between 0 and 720),
  taille_equipe_min integer not null default 3 check (taille_equipe_min between 1 and 20),
  taille_equipe_max integer not null default 8 check (taille_equipe_max between 1 and 30),
  chef_agent_recommande boolean not null default true,
  briefing_texte text,
  mention_rgpd text,
  maj_par uuid,
  maj_le timestamptz not null default now(),
  check (taille_equipe_min <= taille_equipe_max)
);
alter table public.parametres_entraide enable row level security;
create policy "parametres_entraide_select" on public.parametres_entraide for select to authenticated
  using (public.a_capacite(contexte_id, 'entraide', 'lire'));
create policy "parametres_entraide_insert" on public.parametres_entraide for insert to authenticated
  with check (public.a_capacite(contexte_id, 'entraide', 'modifier') and (public.est_super_admin() or public.a_acces(contexte_id, 'admin')));
create policy "parametres_entraide_update" on public.parametres_entraide for update to authenticated
  using (public.a_capacite(contexte_id, 'entraide', 'modifier') and (public.est_super_admin() or public.a_acces(contexte_id, 'admin')))
  with check (public.a_capacite(contexte_id, 'entraide', 'modifier') and (public.est_super_admin() or public.a_acces(contexte_id, 'admin')));
revoke all on public.parametres_entraide from public, anon, authenticated;
grant select, insert, update on public.parametres_entraide to authenticated;

create or replace function public.parametres_entraide_controle() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.maj_par := auth.uid();
  new.maj_le := clock_timestamp();
  return new;
end $$;
revoke all on function public.parametres_entraide_controle() from public, anon, authenticated;
create or replace trigger parametres_entraide_controle before insert or update on public.parametres_entraide
  for each row execute function public.parametres_entraide_controle();

-- ---------------------------------------------------------------------------
-- Points d'accueil des bénévoles (bloc 1)
-- ---------------------------------------------------------------------------
create table if not exists public.points_accueil_benevoles (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  nom text not null check (char_length(nom) between 2 and 120),
  centre_accueil_id uuid references public.centres_accueil(id) on delete set null,
  adresse text,
  latitude double precision,
  longitude double precision,
  responsable_user_id uuid references auth.users(id) on delete set null,
  consignes_briefing text,
  jeton_qr uuid not null default gen_random_uuid(),
  ouvert_le timestamptz not null default now(),
  ferme_le timestamptz,
  cree_par uuid,
  created_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180)),
  check (ferme_le is null or ferme_le >= ouvert_le)
);
create unique index if not exists points_accueil_benevoles_jeton_idx on public.points_accueil_benevoles (jeton_qr);
create index if not exists points_accueil_benevoles_incident_idx on public.points_accueil_benevoles (incident_id);
alter table public.points_accueil_benevoles enable row level security;
create policy "pab_select" on public.points_accueil_benevoles for select to authenticated
  using (public.a_capacite(contexte_id, 'entraide', 'lire'));
create policy "pab_insert" on public.points_accueil_benevoles for insert to authenticated
  with check (public.peut_coordonner_entraide(incident_id));
create policy "pab_update" on public.points_accueil_benevoles for update to authenticated
  using (public.peut_coordonner_entraide(incident_id)) with check (public.peut_coordonner_entraide(incident_id));
revoke all on public.points_accueil_benevoles from public, anon, authenticated;
grant select on public.points_accueil_benevoles to authenticated;
grant insert (incident_id, nom, centre_accueil_id, adresse, latitude, longitude, responsable_user_id, consignes_briefing) on public.points_accueil_benevoles to authenticated;
grant update (nom, centre_accueil_id, adresse, latitude, longitude, responsable_user_id, consignes_briefing, ferme_le, jeton_qr) on public.points_accueil_benevoles to authenticated;

create or replace function public.pab_controle() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare v_contexte uuid; v_mode text;
begin
  select i.contexte_id, i.coordinateur_benevoles into v_contexte, v_mode from public.incidents i where i.id = new.incident_id;
  if v_contexte is null then raise exception 'Incident introuvable'; end if;
  if tg_op = 'INSERT' then
    if v_mode = 'aucun' then raise exception 'Désignez d''abord un coordinateur des bénévoles pour cet incident'; end if;
    new.contexte_id := v_contexte;
    new.cree_par := auth.uid();
    new.jeton_qr := gen_random_uuid();
    new.ouvert_le := clock_timestamp();
    new.ferme_le := null;
  else
    new.incident_id := old.incident_id;
    new.contexte_id := old.contexte_id;
    new.cree_par := old.cree_par;
    new.ouvert_le := old.ouvert_le;
    -- La fermeture est horodatée par le serveur et ne se modifie plus
    if old.ferme_le is not null then new.ferme_le := old.ferme_le;
    elsif new.ferme_le is not null then new.ferme_le := clock_timestamp(); end if;
    -- Nouveau QR : seulement une régénération (le client envoie n'importe quelle valeur différente)
    if new.jeton_qr is distinct from old.jeton_qr then new.jeton_qr := gen_random_uuid(); end if;
  end if;
  new.nom := trim(new.nom);
  return new;
end $$;
revoke all on function public.pab_controle() from public, anon, authenticated;
create or replace trigger pab_controle before insert or update on public.points_accueil_benevoles
  for each row execute function public.pab_controle();

-- ---------------------------------------------------------------------------
-- Présences (une ligne par passage au point d'accueil)
-- ---------------------------------------------------------------------------
create table if not exists public.presences_benevoles (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  pab_id uuid not null references public.points_accueil_benevoles(id) on delete restrict,
  benevole_id uuid references public.benevoles_entraide(id) on delete set null,
  numero text not null,
  nom text not null check (char_length(nom) between 1 and 80),
  prenom text not null check (char_length(prenom) between 1 and 80),
  telephone text check (telephone is null or char_length(telephone) <= 30),
  majeur_declare boolean not null,
  contact_urgence_nom text check (contact_urgence_nom is null or char_length(contact_urgence_nom) <= 120),
  contact_urgence_telephone text check (contact_urgence_telephone is null or char_length(contact_urgence_telephone) <= 30),
  competences text[] not null default '{}',
  materiel_apporte text check (materiel_apporte is null or char_length(materiel_apporte) <= 300),
  consignes_acceptees_le timestamptz,
  statut text not null default 'enregistre' check (statut in ('enregistre','valide','affecte','en_repos','sorti','refuse')),
  valide_par uuid,
  valide_le timestamptz,
  arrive_le timestamptz not null default now(),
  sorti_le timestamptz,
  sortie_demandee_le timestamptz,
  cle_client uuid,
  jeton uuid not null default gen_random_uuid(),
  note_interne text check (note_interne is null or char_length(note_interne) <= 1000),
  est_exercice boolean not null default false,
  created_at timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  check (majeur_declare = true),
  unique (incident_id, numero)
);
create unique index if not exists presences_benevoles_jeton_idx on public.presences_benevoles (jeton);
create unique index if not exists presences_benevoles_cle_client_idx on public.presences_benevoles (incident_id, cle_client) where cle_client is not null;
create index if not exists presences_benevoles_incident_statut_idx on public.presences_benevoles (incident_id, statut);
alter table public.presences_benevoles enable row level security;
create policy "presences_select" on public.presences_benevoles for select to authenticated
  using (public.a_capacite(contexte_id, 'entraide', 'lire'));
create policy "presences_insert" on public.presences_benevoles for insert to authenticated
  with check (public.peut_coordonner_entraide(incident_id));
create policy "presences_update" on public.presences_benevoles for update to authenticated
  using (public.peut_coordonner_entraide(incident_id)) with check (public.peut_coordonner_entraide(incident_id));
revoke all on public.presences_benevoles from public, anon, authenticated;
grant select on public.presences_benevoles to authenticated;
grant insert (incident_id, pab_id, benevole_id, nom, prenom, telephone, majeur_declare, contact_urgence_nom, contact_urgence_telephone,
  competences, materiel_apporte, consignes_acceptees_le, note_interne) on public.presences_benevoles to authenticated;
grant update (statut, note_interne, competences, materiel_apporte, telephone, contact_urgence_nom, contact_urgence_telephone, consignes_acceptees_le)
  on public.presences_benevoles to authenticated;

create or replace function public.presences_benevoles_controle() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare v_contexte uuid; v_exercice boolean; v_pab_incident uuid; v_pab_ferme timestamptz; v_n int;
begin
  if tg_op = 'INSERT' then
    select i.contexte_id, i.est_exercice into v_contexte, v_exercice from public.incidents i where i.id = new.incident_id;
    if v_contexte is null then raise exception 'Incident introuvable'; end if;
    select p.incident_id, p.ferme_le into v_pab_incident, v_pab_ferme from public.points_accueil_benevoles p where p.id = new.pab_id;
    if v_pab_incident is distinct from new.incident_id then raise exception 'Le point d''accueil n''appartient pas à cet incident'; end if;
    if v_pab_ferme is not null then raise exception 'Ce point d''accueil est fermé'; end if;
    if new.benevole_id is not null and not exists (select 1 from public.benevoles_entraide b where b.id = new.benevole_id and b.contexte_id = v_contexte) then
      raise exception 'Le bénévole pré-inscrit n''appartient pas à ce contexte';
    end if;
    new.contexte_id := v_contexte;
    new.est_exercice := v_exercice;
    new.statut := 'enregistre';
    new.valide_par := null; new.valide_le := null; new.sorti_le := null; new.sortie_demandee_le := null;
    new.arrive_le := clock_timestamp();
    new.jeton := gen_random_uuid();
    perform pg_advisory_xact_lock(hashtext('presences_benevoles:' || new.incident_id::text));
    select coalesce(max(substr(p.numero, 5)::int), 0) + 1 into v_n from public.presences_benevoles p where p.incident_id = new.incident_id;
    new.numero := 'BEN-' || lpad(v_n::text, 4, '0');
  else
    -- Colonnes figées
    new.incident_id := old.incident_id; new.contexte_id := old.contexte_id; new.pab_id := old.pab_id; new.benevole_id := old.benevole_id;
    new.numero := old.numero; new.nom := old.nom; new.prenom := old.prenom; new.majeur_declare := old.majeur_declare;
    new.arrive_le := old.arrive_le; new.jeton := old.jeton; new.cle_client := old.cle_client; new.est_exercice := old.est_exercice;
    new.valide_par := old.valide_par; new.valide_le := old.valide_le; new.sorti_le := old.sorti_le; new.sortie_demandee_le := old.sortie_demandee_le;
    if old.statut in ('sorti', 'refuse') and new.statut <> old.statut then
      raise exception 'Un bénévole sorti ou refusé ne revient pas sur cette présence : enregistrez un nouveau passage';
    end if;
    if new.statut <> old.statut then
      if old.statut = 'enregistre' and new.statut not in ('valide', 'refuse') then
        raise exception 'Un bénévole doit être validé au point d''accueil avant toute affectation';
      end if;
      if new.statut = 'refuse' and old.statut <> 'enregistre' then
        raise exception 'Seul un bénévole non encore validé peut être refusé ; sinon marquez-le sorti';
      end if;
      if new.statut = 'valide' and old.statut = 'enregistre' then
        if coalesce(new.consignes_acceptees_le, old.consignes_acceptees_le) is null then
          raise exception 'Les consignes de sécurité doivent être acceptées avant la validation';
        end if;
        new.valide_par := auth.uid(); new.valide_le := clock_timestamp();
      end if;
      -- « affecté » n'est posé que par l'entrée dans une équipe, jamais directement
      if (new.statut = 'affecte' or old.statut = 'affecte') and coalesce(current_setting('entraide.via_equipe', true), '') <> '1' then
        raise exception 'L''affectation passe par les équipes : ajoutez ou retirez le bénévole d''une équipe';
      end if;
      if new.statut = 'sorti' then new.sorti_le := clock_timestamp(); end if;
    end if;
  end if;
  new.nom := trim(new.nom); new.prenom := trim(new.prenom);
  new.maj_le := clock_timestamp();
  return new;
end $$;
revoke all on function public.presences_benevoles_controle() from public, anon, authenticated;
create or replace trigger presences_benevoles_controle before insert or update on public.presences_benevoles
  for each row execute function public.presences_benevoles_controle();

-- ---------------------------------------------------------------------------
-- Équipes (bloc 2)
-- ---------------------------------------------------------------------------
create table if not exists public.equipes_entraide (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  numero integer not null,
  nom text not null check (char_length(nom) between 1 and 80),
  chef_presence_id uuid references public.presences_benevoles(id) on delete set null,
  chef_user_id uuid references auth.users(id) on delete set null,
  chef_libelle text check (chef_libelle is null or char_length(chef_libelle) <= 120),
  statut text not null default 'constituee' check (statut in ('constituee','engagee','repos','dissoute')),
  engagee_depuis timestamptz,
  cree_par uuid,
  created_at timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  unique (incident_id, numero)
);
create index if not exists equipes_entraide_incident_idx on public.equipes_entraide (incident_id, statut);
alter table public.equipes_entraide enable row level security;
create policy "equipes_select" on public.equipes_entraide for select to authenticated
  using (public.a_capacite(contexte_id, 'entraide', 'lire'));
create policy "equipes_insert" on public.equipes_entraide for insert to authenticated
  with check (public.peut_coordonner_entraide(incident_id));
create policy "equipes_update" on public.equipes_entraide for update to authenticated
  using (public.peut_coordonner_entraide(incident_id) or public.peut_commander_zone_entraide(incident_id))
  with check (public.peut_coordonner_entraide(incident_id) or public.peut_commander_zone_entraide(incident_id));
revoke all on public.equipes_entraide from public, anon, authenticated;
grant select on public.equipes_entraide to authenticated;
grant insert (incident_id, nom, chef_presence_id, chef_user_id, chef_libelle) on public.equipes_entraide to authenticated;
grant update (nom, chef_presence_id, chef_user_id, chef_libelle, statut) on public.equipes_entraide to authenticated;

create or replace function public.equipes_entraide_controle() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare v_contexte uuid; v_n int;
begin
  select i.contexte_id into v_contexte from public.incidents i where i.id = new.incident_id;
  if v_contexte is null then raise exception 'Incident introuvable'; end if;
  if tg_op = 'INSERT' then
    new.contexte_id := v_contexte; new.cree_par := auth.uid(); new.statut := 'constituee'; new.engagee_depuis := null;
    perform pg_advisory_xact_lock(hashtext('equipes_entraide:' || new.incident_id::text));
    select coalesce(max(e.numero), 0) + 1 into v_n from public.equipes_entraide e where e.incident_id = new.incident_id;
    new.numero := v_n;
    if nullif(trim(coalesce(new.nom, '')), '') is null then new.nom := 'Équipe ' || v_n; end if;
  else
    new.incident_id := old.incident_id; new.contexte_id := old.contexte_id; new.numero := old.numero; new.cree_par := old.cree_par;
    if old.statut = 'dissoute' and new.statut <> 'dissoute' then raise exception 'Une équipe dissoute ne se réactive pas : constituez-en une nouvelle'; end if;
    if new.statut = 'engagee' and old.statut <> 'engagee' then new.engagee_depuis := clock_timestamp(); end if;
    if new.statut <> 'engagee' then new.engagee_depuis := null; end if;
  end if;
  if new.chef_presence_id is not null and (tg_op = 'INSERT' or new.chef_presence_id is distinct from old.chef_presence_id) and not exists (
    select 1 from public.presences_benevoles p where p.id = new.chef_presence_id and p.incident_id = new.incident_id and p.statut in ('valide','affecte','en_repos')) then
    raise exception 'Le chef d''équipe bénévole doit être un bénévole validé de cet incident';
  end if;
  new.nom := trim(new.nom);
  new.maj_le := clock_timestamp();
  return new;
end $$;
revoke all on function public.equipes_entraide_controle() from public, anon, authenticated;
create or replace trigger equipes_entraide_controle before insert or update on public.equipes_entraide
  for each row execute function public.equipes_entraide_controle();

create table if not exists public.membres_equipe_entraide (
  id uuid primary key default gen_random_uuid(),
  equipe_id uuid not null references public.equipes_entraide(id) on delete cascade,
  presence_id uuid not null references public.presences_benevoles(id) on delete cascade,
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  de timestamptz not null default now(),
  a timestamptz,
  check (a is null or a >= de)
);
create unique index if not exists membres_equipe_actif_idx on public.membres_equipe_entraide (presence_id) where a is null;
create index if not exists membres_equipe_equipe_idx on public.membres_equipe_entraide (equipe_id);
alter table public.membres_equipe_entraide enable row level security;
create policy "membres_select" on public.membres_equipe_entraide for select to authenticated
  using (public.a_capacite(contexte_id, 'entraide', 'lire'));
create policy "membres_insert" on public.membres_equipe_entraide for insert to authenticated
  with check (exists (select 1 from public.equipes_entraide e where e.id = equipe_id and public.peut_coordonner_entraide(e.incident_id)));
create policy "membres_update" on public.membres_equipe_entraide for update to authenticated
  using (exists (select 1 from public.equipes_entraide e where e.id = equipe_id and public.peut_coordonner_entraide(e.incident_id)))
  with check (exists (select 1 from public.equipes_entraide e where e.id = equipe_id and public.peut_coordonner_entraide(e.incident_id)));
revoke all on public.membres_equipe_entraide from public, anon, authenticated;
grant select on public.membres_equipe_entraide to authenticated;
grant insert (equipe_id, presence_id) on public.membres_equipe_entraide to authenticated;
grant update (a) on public.membres_equipe_entraide to authenticated;

-- Entrer dans une équipe = le bénévole passe « affecté » ; en sortir = il repasse « validé ». Une équipe dissoute libère tout le monde.
create or replace function public.membres_equipe_controle() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare v_incident uuid; v_contexte uuid; v_statut_equipe text; v_statut_pres text; v_inc_pres uuid;
begin
  select e.incident_id, e.contexte_id, e.statut into v_incident, v_contexte, v_statut_equipe from public.equipes_entraide e where e.id = new.equipe_id;
  if v_incident is null then raise exception 'Équipe introuvable'; end if;
  if tg_op = 'INSERT' then
    if v_statut_equipe = 'dissoute' then raise exception 'Cette équipe est dissoute'; end if;
    select p.statut, p.incident_id into v_statut_pres, v_inc_pres from public.presences_benevoles p where p.id = new.presence_id;
    if v_inc_pres is distinct from v_incident then raise exception 'Le bénévole n''appartient pas à cet incident'; end if;
    if v_statut_pres not in ('valide', 'en_repos') then raise exception 'Seul un bénévole validé et disponible peut rejoindre une équipe'; end if;
    new.contexte_id := v_contexte; new.de := clock_timestamp(); new.a := null;
    perform set_config('entraide.via_equipe', '1', true);
    update public.presences_benevoles set statut = 'affecte' where id = new.presence_id;
    perform set_config('entraide.via_equipe', '', true);
  else
    new.equipe_id := old.equipe_id; new.presence_id := old.presence_id; new.contexte_id := old.contexte_id; new.de := old.de;
    if old.a is not null then new.a := old.a; end if;
    if new.a is not null and old.a is null then
      new.a := clock_timestamp();
      perform set_config('entraide.via_equipe', '1', true);
      update public.presences_benevoles set statut = 'valide' where id = new.presence_id and statut = 'affecte';
      perform set_config('entraide.via_equipe', '', true);
    end if;
  end if;
  return new;
end $$;
revoke all on function public.membres_equipe_controle() from public, anon, authenticated;
create or replace trigger membres_equipe_controle before insert or update on public.membres_equipe_entraide
  for each row execute function public.membres_equipe_controle();

create or replace function public.equipe_dissoute_libere() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.statut = 'dissoute' and old.statut <> 'dissoute' then
    update public.membres_equipe_entraide set a = clock_timestamp() where equipe_id = new.id and a is null;
  end if;
  return new;
end $$;
revoke all on function public.equipe_dissoute_libere() from public, anon, authenticated;
create or replace trigger equipe_dissoute_libere after update on public.equipes_entraide
  for each row execute function public.equipe_dissoute_libere();

-- ---------------------------------------------------------------------------
-- Missions (bloc 2) + historique en ajout seul
-- ---------------------------------------------------------------------------
create table if not exists public.missions_entraide (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  numero text not null,
  titre text not null check (char_length(titre) between 3 and 160),
  description text check (description is null or char_length(description) <= 2000),
  priorite text not null default 'P3' check (priorite in ('P1','P2','P3','P4')),
  competence_requise text[] not null default '{}',
  nb_personnes integer check (nb_personnes is null or nb_personnes between 1 and 200),
  materiel_requis text check (materiel_requis is null or char_length(materiel_requis) <= 300),
  latitude double precision,
  longitude double precision,
  adresse text check (adresse is null or char_length(adresse) <= 300),
  point_rdv text check (point_rdv is null or char_length(point_rdv) <= 300),
  origine_type text check (origine_type is null or origine_type in ('cc','signalement_citoyen','observation_terrain','pc_ops','besoin_public')),
  origine_id uuid,
  zone_intervention_id uuid references public.zones_intervention(id) on delete set null,
  type_zone text check (type_zone is null or type_zone in ('rouge','orange','jaune')),
  sous_pc_ops boolean not null default false,
  derogation_zone_rouge_par uuid,
  derogation_motif text check (derogation_motif is null or char_length(derogation_motif) <= 500),
  equipe_id uuid references public.equipes_entraide(id) on delete set null,
  statut text not null default 'ouverte' check (statut in ('ouverte','affectee','en_cours','close','annulee','refusee')),
  raison_statut text check (raison_statut is null or char_length(raison_statut) <= 500),
  publie_besoin boolean not null default false,
  au_journal boolean not null default false,
  est_exercice boolean not null default false,
  cree_par uuid,
  created_at timestamptz not null default now(),
  debut_le timestamptz,
  fin_le timestamptz,
  maj_le timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180)),
  unique (incident_id, numero)
);
create index if not exists missions_entraide_incident_idx on public.missions_entraide (incident_id, statut);
alter table public.missions_entraide enable row level security;
create policy "missions_select" on public.missions_entraide for select to authenticated
  using (public.a_capacite(contexte_id, 'entraide', 'lire'));
create policy "missions_insert" on public.missions_entraide for insert to authenticated
  with check (public.peut_coordonner_entraide(incident_id) or public.peut_commander_zone_entraide(incident_id));
create policy "missions_update" on public.missions_entraide for update to authenticated
  using (public.peut_coordonner_entraide(incident_id) or public.peut_commander_zone_entraide(incident_id))
  with check (public.peut_coordonner_entraide(incident_id) or public.peut_commander_zone_entraide(incident_id));
revoke all on public.missions_entraide from public, anon, authenticated;
grant select on public.missions_entraide to authenticated;
-- `id` saisissable : la file hors ligne de Terrain pose l'identifiant côté client (clé d'idempotence)
grant insert (id, incident_id, titre, description, priorite, competence_requise, nb_personnes, materiel_requis, latitude, longitude, adresse, point_rdv,
  origine_type, origine_id, publie_besoin, derogation_motif) on public.missions_entraide to authenticated;
grant update (titre, description, priorite, competence_requise, nb_personnes, materiel_requis, latitude, longitude, adresse, point_rdv,
  equipe_id, statut, raison_statut, publie_besoin, au_journal, derogation_motif) on public.missions_entraide to authenticated;

create table if not exists public.missions_entraide_evenements (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions_entraide(id) on delete cascade,
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  type text not null check (type in ('creation','modification','affectation','desaffectation','demarrage','cloture','annulation','refus','passage_pc_ops','retour_coordinateur','derogation','reouverture')),
  de_user_id uuid,
  equipe_id uuid,
  commentaire text,
  created_at timestamptz not null default now()
);
create index if not exists missions_evenements_mission_idx on public.missions_entraide_evenements (mission_id, created_at);
alter table public.missions_entraide_evenements enable row level security;
create policy "missions_evenements_select" on public.missions_entraide_evenements for select to authenticated
  using (public.a_capacite(contexte_id, 'entraide', 'lire'));
revoke all on public.missions_entraide_evenements from public, anon, authenticated;
grant select on public.missions_entraide_evenements to authenticated;

create or replace function public.missions_evenements_ajout_seul() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'L''historique des missions est en ajout seul';
end $$;
revoke all on function public.missions_evenements_ajout_seul() from public, anon, authenticated;
create or replace trigger missions_evenements_ajout_seul_ligne before update or delete on public.missions_entraide_evenements
  for each row execute function public.missions_evenements_ajout_seul();
create or replace trigger missions_evenements_ajout_seul_table before truncate on public.missions_entraide_evenements
  for each statement execute function public.missions_evenements_ajout_seul();

-- Règles des missions : numéro serveur, zone recalculée, zone rouge, qui peut affecter quoi, transitions, historique.
create or replace function public.missions_entraide_controle() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_contexte uuid; v_exercice boolean; v_n int; v_zone uuid; v_type_zone text;
  v_coord boolean; v_zone_cmd boolean; v_statut_equipe text; v_inc_equipe uuid; v_evt text;
begin
  select i.contexte_id, i.est_exercice into v_contexte, v_exercice from public.incidents i where i.id = new.incident_id;
  if v_contexte is null then raise exception 'Incident introuvable'; end if;
  v_coord := public.peut_coordonner_entraide(new.incident_id);
  v_zone_cmd := public.peut_commander_zone_entraide(new.incident_id);

  if tg_op = 'INSERT' then
    new.contexte_id := v_contexte; new.est_exercice := v_exercice; new.cree_par := auth.uid();
    new.statut := 'ouverte'; new.equipe_id := null; new.debut_le := null; new.fin_le := null; new.raison_statut := null;
    new.derogation_zone_rouge_par := null; new.au_journal := false;
    perform pg_advisory_xact_lock(hashtext('missions_entraide:' || new.incident_id::text));
    select coalesce(max(substr(m.numero, 5)::int), 0) + 1 into v_n from public.missions_entraide m where m.incident_id = new.incident_id;
    new.numero := 'MIS-' || lpad(v_n::text, 4, '0');
    if new.origine_type = 'pc_ops' and not v_zone_cmd then new.origine_type := 'cc'; end if;
  else
    new.incident_id := old.incident_id; new.contexte_id := old.contexte_id; new.numero := old.numero; new.cree_par := old.cree_par;
    new.est_exercice := old.est_exercice; new.created_at := old.created_at; new.origine_type := old.origine_type; new.origine_id := old.origine_id;
    new.derogation_zone_rouge_par := old.derogation_zone_rouge_par;
    if old.statut in ('close', 'annulee') and new.statut not in ('close', 'annulee', 'ouverte') then
      raise exception 'Une mission close ou annulée ne peut que rouvrir';
    end if;
  end if;

  -- Zone d'intervention : recalculée à chaque changement de position
  if tg_op = 'INSERT' or new.latitude is distinct from old.latitude or new.longitude is distinct from old.longitude then
    select z.zone_id, z.type_zone into v_zone, v_type_zone from public.zone_intervention_du_point(new.incident_id, new.latitude, new.longitude) z;
    new.zone_intervention_id := v_zone; new.type_zone := v_type_zone;
    new.sous_pc_ops := v_zone is not null;
  else
    new.zone_intervention_id := old.zone_intervention_id; new.type_zone := old.type_zone; new.sous_pc_ops := old.sous_pc_ops;
  end if;

  -- Zone rouge : interdite sauf dérogation du commandement de zone, motivée
  if new.type_zone = 'rouge' then
    if nullif(trim(coalesce(new.derogation_motif, '')), '') is null then
      if new.statut not in ('refusee', 'annulee', 'close') then
        new.statut := 'refusee';
        new.raison_statut := 'Zone rouge : bénévoles interdits (dérogation motivée du Dir PC-Ops requise)';
        new.equipe_id := null;
      end if;
    elsif new.derogation_zone_rouge_par is null or (tg_op = 'UPDATE' and new.derogation_motif is distinct from old.derogation_motif) then
      if not v_zone_cmd then raise exception 'Seul le commandement de zone (Dir PC-Ops) peut déroger à l''interdiction en zone rouge' using errcode = '42501'; end if;
      new.derogation_zone_rouge_par := auth.uid();
      if tg_op = 'UPDATE' and old.statut = 'refusee' and new.statut = 'refusee' then new.statut := 'ouverte'; new.raison_statut := null; end if;
    end if;
  end if;

  -- Affectation / désaffectation
  if new.equipe_id is distinct from (case when tg_op = 'INSERT' then null else old.equipe_id end) then
    if tg_op = 'UPDATE' and old.statut in ('close', 'annulee', 'refusee') and new.statut = old.statut then
      raise exception 'Mission close, annulée ou refusée : rouvrez-la avant de l''affecter';
    end if;
    if new.sous_pc_ops and not v_zone_cmd then
      raise exception 'Mission sous PC-Ops : seul le commandement de zone l''affecte' using errcode = '42501';
    end if;
    if not new.sous_pc_ops and not v_coord and not v_zone_cmd then
      raise exception 'Seul le coordinateur des bénévoles affecte cette mission' using errcode = '42501';
    end if;
    if new.equipe_id is not null then
      select e.statut, e.incident_id into v_statut_equipe, v_inc_equipe from public.equipes_entraide e where e.id = new.equipe_id;
      if v_inc_equipe is distinct from new.incident_id then raise exception 'L''équipe n''appartient pas à cet incident'; end if;
      if v_statut_equipe = 'dissoute' then raise exception 'Cette équipe est dissoute'; end if;
      if new.statut = 'ouverte' then new.statut := 'affectee'; end if;
    elsif new.statut in ('affectee', 'en_cours') then
      new.statut := 'ouverte';
    end if;
  end if;

  -- Transitions
  if new.statut in ('affectee', 'en_cours') and new.equipe_id is null then
    raise exception 'Une mission affectée ou en cours doit avoir une équipe';
  end if;
  if new.statut = 'en_cours' and (tg_op = 'INSERT' or old.statut <> 'en_cours') then new.debut_le := clock_timestamp(); end if;
  if new.statut in ('close', 'annulee', 'refusee') and (tg_op = 'INSERT' or old.statut not in ('close', 'annulee', 'refusee')) then new.fin_le := clock_timestamp(); end if;
  if new.statut = 'ouverte' then new.debut_le := null; new.fin_le := null; new.equipe_id := null; end if;

  new.titre := trim(new.titre);
  new.maj_le := clock_timestamp();

  -- Historique
  if tg_op = 'INSERT' then v_evt := 'creation';
  elsif new.sous_pc_ops and not old.sous_pc_ops then v_evt := 'passage_pc_ops';
  elsif old.sous_pc_ops and not new.sous_pc_ops then v_evt := 'retour_coordinateur';
  elsif new.derogation_motif is distinct from old.derogation_motif and new.derogation_motif is not null then v_evt := 'derogation';
  elsif new.statut = 'ouverte' and old.statut in ('close', 'annulee') then v_evt := 'reouverture';
  elsif new.equipe_id is distinct from old.equipe_id then v_evt := case when new.equipe_id is null then 'desaffectation' else 'affectation' end;
  elsif new.statut <> old.statut then v_evt := case new.statut when 'en_cours' then 'demarrage' when 'close' then 'cloture' when 'annulee' then 'annulation'
      when 'refusee' then 'refus' when 'ouverte' then 'reouverture' else 'modification' end;
  else v_evt := 'modification'; end if;
  -- écrit par le trigger AFTER (la ligne doit exister pour la clé étrangère)
  perform set_config('entraide.evt', v_evt, true);
  perform set_config('entraide.evt_commentaire', coalesce(case when v_evt in ('refus','annulation') then new.raison_statut when v_evt = 'derogation' then new.derogation_motif else null end, ''), true);

  return new;
end $$;
revoke all on function public.missions_entraide_controle() from public, anon, authenticated;
create or replace trigger missions_entraide_controle before insert or update on public.missions_entraide
  for each row execute function public.missions_entraide_controle();

-- Équipe engagée / libérée selon ses missions (après coup)
create or replace function public.missions_entraide_equipe_statut() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Historique (ajout seul), événement calculé par le trigger BEFORE
  insert into public.missions_entraide_evenements (mission_id, contexte_id, type, de_user_id, equipe_id, commentaire)
  values (new.id, new.contexte_id, coalesce(nullif(current_setting('entraide.evt', true), ''), 'modification'), auth.uid(), new.equipe_id,
    nullif(current_setting('entraide.evt_commentaire', true), ''));
  perform set_config('entraide.evt', '', true);
  if new.equipe_id is not null and new.statut in ('affectee', 'en_cours') then
    update public.equipes_entraide set statut = 'engagee' where id = new.equipe_id and statut in ('constituee', 'repos');
  end if;
  if tg_op = 'UPDATE' and old.equipe_id is not null and (new.equipe_id is distinct from old.equipe_id or new.statut in ('close','annulee','refusee','ouverte')) then
    update public.equipes_entraide e set statut = 'constituee' where e.id = old.equipe_id and e.statut = 'engagee'
      and not exists (select 1 from public.missions_entraide m where m.equipe_id = e.id and m.statut in ('affectee', 'en_cours'));
  end if;
  return null;
end $$;
revoke all on function public.missions_entraide_equipe_statut() from public, anon, authenticated;
create or replace trigger missions_entraide_equipe_statut after insert or update on public.missions_entraide
  for each row execute function public.missions_entraide_equipe_statut();

-- ---------------------------------------------------------------------------
-- Incidents survenus à des bénévoles (bloc 4) — ajout seul
-- ---------------------------------------------------------------------------
create table if not exists public.incidents_benevoles (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  presence_id uuid not null references public.presences_benevoles(id) on delete restrict,
  mission_id uuid references public.missions_entraide(id) on delete set null,
  type text not null check (type in ('blessure','malaise','accident_materiel','comportement','autre')),
  description text not null check (char_length(description) between 3 and 2000),
  survenu_le timestamptz not null default now(),
  declare_par uuid,
  created_at timestamptz not null default now()
);
create index if not exists incidents_benevoles_incident_idx on public.incidents_benevoles (incident_id);
alter table public.incidents_benevoles enable row level security;
create policy "incidents_benevoles_select" on public.incidents_benevoles for select to authenticated
  using (public.a_capacite(contexte_id, 'entraide', 'lire'));
create policy "incidents_benevoles_insert" on public.incidents_benevoles for insert to authenticated
  with check (public.peut_coordonner_entraide(incident_id) or public.peut_commander_zone_entraide(incident_id));
revoke all on public.incidents_benevoles from public, anon, authenticated;
grant select on public.incidents_benevoles to authenticated;
grant insert (incident_id, presence_id, mission_id, type, description, survenu_le) on public.incidents_benevoles to authenticated;

create or replace function public.incidents_benevoles_controle() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare v_contexte uuid; v_inc_pres uuid;
begin
  if tg_op <> 'INSERT' then raise exception 'Le registre des incidents bénévoles est en ajout seul'; end if;
  select i.contexte_id into v_contexte from public.incidents i where i.id = new.incident_id;
  if v_contexte is null then raise exception 'Incident introuvable'; end if;
  select p.incident_id into v_inc_pres from public.presences_benevoles p where p.id = new.presence_id;
  if v_inc_pres is distinct from new.incident_id then raise exception 'Le bénévole n''appartient pas à cet incident'; end if;
  if new.mission_id is not null and not exists (select 1 from public.missions_entraide m where m.id = new.mission_id and m.incident_id = new.incident_id) then
    raise exception 'La mission n''appartient pas à cet incident';
  end if;
  if new.survenu_le > clock_timestamp() + interval '1 minute' then raise exception 'La date ne peut pas être dans le futur'; end if;
  new.contexte_id := v_contexte; new.declare_par := auth.uid(); new.created_at := clock_timestamp();
  return new;
end $$;
revoke all on function public.incidents_benevoles_controle() from public, anon, authenticated;
create or replace trigger incidents_benevoles_controle before insert or update or delete on public.incidents_benevoles
  for each row execute function public.incidents_benevoles_controle();

-- ---------------------------------------------------------------------------
-- Dons et besoins en nature (bloc 5)
-- ---------------------------------------------------------------------------
create table if not exists public.points_collecte (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  nom text not null check (char_length(nom) between 2 and 120),
  centre_accueil_id uuid references public.centres_accueil(id) on delete set null,
  adresse text check (adresse is null or char_length(adresse) <= 300),
  latitude double precision,
  longitude double precision,
  horaires text check (horaires is null or char_length(horaires) <= 200),
  consignes text check (consignes is null or char_length(consignes) <= 500),
  ouvert_le timestamptz not null default now(),
  ferme_le timestamptz,
  created_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))
);
alter table public.points_collecte enable row level security;
create policy "points_collecte_select" on public.points_collecte for select to authenticated using (public.a_capacite(contexte_id, 'entraide', 'lire'));
create policy "points_collecte_insert" on public.points_collecte for insert to authenticated with check (public.peut_coordonner_entraide(incident_id));
create policy "points_collecte_update" on public.points_collecte for update to authenticated using (public.peut_coordonner_entraide(incident_id)) with check (public.peut_coordonner_entraide(incident_id));
revoke all on public.points_collecte from public, anon, authenticated;
grant select on public.points_collecte to authenticated;
grant insert (incident_id, nom, centre_accueil_id, adresse, latitude, longitude, horaires, consignes) on public.points_collecte to authenticated;
grant update (nom, centre_accueil_id, adresse, latitude, longitude, horaires, consignes, ferme_le) on public.points_collecte to authenticated;

create table if not exists public.besoins_nature (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  libelle text not null check (char_length(libelle) between 2 and 160),
  categorie text not null default 'autre' check (categorie in ('eau_alimentation','hygiene','vetements','materiel_nettoyage','materiel_pompage','hebergement','transport','outillage','autre')),
  quantite_souhaitee text check (quantite_souhaitee is null or char_length(quantite_souhaitee) <= 80),
  statut text not null default 'ouvert' check (statut in ('ouvert','couvert','ferme')),
  point_collecte_id uuid references public.points_collecte(id) on delete set null,
  publie boolean not null default true,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  maj_le timestamptz not null default now()
);
create index if not exists besoins_nature_incident_idx on public.besoins_nature (incident_id, statut);
alter table public.besoins_nature enable row level security;
create policy "besoins_select" on public.besoins_nature for select to authenticated using (public.a_capacite(contexte_id, 'entraide', 'lire'));
create policy "besoins_insert" on public.besoins_nature for insert to authenticated with check (public.peut_coordonner_entraide(incident_id));
create policy "besoins_update" on public.besoins_nature for update to authenticated using (public.peut_coordonner_entraide(incident_id)) with check (public.peut_coordonner_entraide(incident_id));
revoke all on public.besoins_nature from public, anon, authenticated;
grant select on public.besoins_nature to authenticated;
grant insert (incident_id, libelle, categorie, quantite_souhaitee, point_collecte_id, publie, note) on public.besoins_nature to authenticated;
grant update (libelle, categorie, quantite_souhaitee, statut, point_collecte_id, publie, note) on public.besoins_nature to authenticated;

-- Consignes publiques de l'incident (« ne venez pas à… ») : une ligne par incident
create table if not exists public.consignes_entraide_publiques (
  incident_id uuid primary key references public.incidents(id) on delete cascade,
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  message text check (message is null or char_length(message) <= 1500),
  ne_pas_venir text check (ne_pas_venir is null or char_length(ne_pas_venir) <= 500),
  publie boolean not null default false,
  maj_par uuid,
  maj_le timestamptz not null default now()
);
alter table public.consignes_entraide_publiques enable row level security;
create policy "consignes_select" on public.consignes_entraide_publiques for select to authenticated using (public.a_capacite(contexte_id, 'entraide', 'lire'));
create policy "consignes_insert" on public.consignes_entraide_publiques for insert to authenticated with check (public.peut_coordonner_entraide(incident_id));
create policy "consignes_update" on public.consignes_entraide_publiques for update to authenticated using (public.peut_coordonner_entraide(incident_id)) with check (public.peut_coordonner_entraide(incident_id));
revoke all on public.consignes_entraide_publiques from public, anon, authenticated;
grant select on public.consignes_entraide_publiques to authenticated;
grant insert (incident_id, message, ne_pas_venir, publie) on public.consignes_entraide_publiques to authenticated;
grant update (message, ne_pas_venir, publie) on public.consignes_entraide_publiques to authenticated;

-- Contexte et horodatage posés par le serveur pour les tables simples de l'entraide
create or replace function public.entraide_contexte_depuis_incident() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare v_contexte uuid;
begin
  select i.contexte_id into v_contexte from public.incidents i where i.id = new.incident_id;
  if v_contexte is null then raise exception 'Incident introuvable'; end if;
  if tg_op = 'UPDATE' then new.incident_id := old.incident_id; end if;
  new.contexte_id := v_contexte;
  if tg_table_name = 'besoins_nature' then new.maj_le := clock_timestamp(); end if;
  if tg_table_name = 'consignes_entraide_publiques' then new.maj_le := clock_timestamp(); new.maj_par := auth.uid(); end if;
  if tg_table_name = 'points_collecte' and tg_op = 'UPDATE' then
    new.ouvert_le := old.ouvert_le;
    if old.ferme_le is not null then new.ferme_le := old.ferme_le;
    elsif new.ferme_le is not null then new.ferme_le := clock_timestamp(); end if;
  end if;
  return new;
end $$;
revoke all on function public.entraide_contexte_depuis_incident() from public, anon, authenticated;
create or replace trigger points_collecte_controle before insert or update on public.points_collecte for each row execute function public.entraide_contexte_depuis_incident();
create or replace trigger besoins_nature_controle before insert or update on public.besoins_nature for each row execute function public.entraide_contexte_depuis_incident();
create or replace trigger consignes_entraide_controle before insert or update on public.consignes_entraide_publiques for each row execute function public.entraide_contexte_depuis_incident();

-- ---------------------------------------------------------------------------
-- Vues de pilotage
-- ---------------------------------------------------------------------------
create or replace view public.v_equipes_a_relever with (security_invoker = true) as
  select e.id as equipe_id, e.incident_id, e.contexte_id, e.nom, e.engagee_depuis,
         extract(epoch from (now() - e.engagee_depuis)) / 60 as minutes_engagees,
         coalesce(p.duree_max_engagement_minutes, 360) as duree_max_minutes
  from public.equipes_entraide e
  left join public.parametres_entraide p on p.contexte_id = e.contexte_id
  where e.statut = 'engagee' and e.engagee_depuis is not null
    and now() - e.engagee_depuis > make_interval(mins => coalesce(p.duree_max_engagement_minutes, 360));
revoke all on public.v_equipes_a_relever from public, anon;
grant select on public.v_equipes_a_relever to authenticated;
