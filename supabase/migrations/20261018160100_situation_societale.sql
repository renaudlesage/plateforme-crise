-- Page CC › « Situation » (veille sociétale) : sources, épingles personnelles, vérifications partagées.
--
-- Principes (briefing « Situation sociétale », 18/10/2026) :
--   * contexte_id NULL = référentiel national commun (écriture : super-administrateur) ; sinon source propre à la commune.
--   * lien sortant d'abord : mode_affichage reste 'lien' ; 'iframe' et 'flux' sont réservés au super-administrateur
--     et ne sont lus par aucun écran tant que les lecteurs officiels n'ont pas été testés source par source.
--   * aucune donnée personnelle, aucune clé d'API, aucun appel sortant dans ces tables.
--   * jamais de suppression silencieuse : on désactive (actif = false) ; une source déjà vérifiée ne peut pas être supprimée.
--   * les épingles sont strictement personnelles ; les vérifications sont partagées par contexte et en ajout seul.

-- ============================================================
-- 1. Sources
-- ============================================================
create table public.sources_situation (
  id uuid primary key default gen_random_uuid(),
  contexte_id uuid references public.contextes(id) on delete cascade,
  code text,
  categorie text not null,
  nom text not null,
  url text not null,
  type_source text not null,
  portee text,
  note text,
  avertissement text,
  mode_affichage text not null default 'lien',
  aleas_lies text[] not null default '{}',
  actif boolean not null default true,
  suggeree boolean not null default false,
  ordre_affichage integer not null default 100,
  responsable_traitement text,
  attestation_flux_public boolean not null default false,
  controle_le date,
  controle_note text,
  cree_par uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sources_situation_categorie_check
    check (categorie in ('marches', 'medias', 'routes', 'webcams', 'eau', 'nucleaire', 'societe')),
  constraint sources_situation_type_check
    check (type_source in ('video', 'donnees', 'carte', 'presse', 'cameras', 'officiel')),
  constraint sources_situation_mode_check
    check (mode_affichage in ('lien', 'iframe', 'flux')),
  -- Adresse web ordinaire : http(s) seulement, nom de domaine (pas d'adresse IP, pas d'identifiant avant le @, pas d'espace).
  constraint sources_situation_url_check
    check (char_length(url) <= 2000
           and url ~* '^https?://([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(:[0-9]{1,5})?([/?#][^\s]*)?$'),
  constraint sources_situation_code_check
    check (code is null or code ~ '^[a-z0-9_]{2,40}$'),
  constraint sources_situation_code_national_check
    check (contexte_id is not null or code is not null),
  constraint sources_situation_tailles_check
    check (char_length(nom) between 2 and 120
           and (portee is null or char_length(portee) <= 40)
           and (note is null or char_length(note) <= 500)
           and (avertissement is null or char_length(avertissement) <= 300)
           and (controle_note is null or char_length(controle_note) <= 300)
           and (responsable_traitement is null or char_length(responsable_traitement) <= 120)),
  constraint sources_situation_aleas_check
    check (aleas_lies <@ array['inondation', 'nucleaire', 'feu_de_foret', 'seisme', 'ferroviaire', 'tous']::text[]),
  constraint sources_situation_ordre_check
    check (ordre_affichage between 0 and 10000),
  -- Caméras et webcams ajoutées par une commune : responsable du flux nommé + attestation que le flux est public ou officiel.
  constraint sources_situation_camera_locale_check
    check (contexte_id is null
           or not (type_source = 'cameras' or categorie = 'webcams')
           or (nullif(btrim(responsable_traitement), '') is not null and attestation_flux_public))
);

comment on table public.sources_situation is
  'Sources de veille sociétale (page CC › Situation). contexte_id NULL = référentiel national. Liens sortants uniquement tant que mode_affichage = lien.';
comment on column public.sources_situation.aleas_lies is
  'Aléas pour lesquels la source est proposée dans CC › incident (widget « Sources utiles »). ''tous'' = proposée quel que soit l''aléa.';
comment on column public.sources_situation.suggeree is
  'Épinglée par défaut dans « Mon tableau » tant que l''utilisateur n''a rien choisi pour cette source.';
comment on column public.sources_situation.responsable_traitement is
  'Caméras et webcams locales : qui publie / est responsable du flux (obligatoire).';
comment on column public.sources_situation.attestation_flux_public is
  'Caméras et webcams locales : le membre atteste que le flux est public ou officiel (jamais de vidéosurveillance privée).';

create unique index sources_situation_code_national_uq on public.sources_situation (code) where contexte_id is null;
create unique index sources_situation_code_local_uq on public.sources_situation (contexte_id, code)
  where contexte_id is not null and code is not null;
create index sources_situation_contexte_idx on public.sources_situation (contexte_id, categorie, ordre_affichage);

create or replace function public.sources_situation_controle()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  new.nom := btrim(new.nom);
  new.url := btrim(new.url);
  new.portee := nullif(btrim(coalesce(new.portee, '')), '');
  new.note := nullif(btrim(coalesce(new.note, '')), '');
  new.avertissement := nullif(btrim(coalesce(new.avertissement, '')), '');
  new.controle_note := nullif(btrim(coalesce(new.controle_note, '')), '');
  new.responsable_traitement := nullif(btrim(coalesce(new.responsable_traitement, '')), '');

  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.cree_par := auth.uid();
    end if;
  else
    if new.contexte_id is distinct from old.contexte_id then
      raise exception 'Une source ne change pas de commune';
    end if;
    if new.code is distinct from old.code then
      raise exception 'Le code d''une source est stable : il ne se modifie pas';
    end if;
    new.cree_par := old.cree_par;
    new.created_at := old.created_at;
  end if;

  -- Lecteurs intégrés : pas ouverts aux membres (CSP, accord de l'éditeur et test source par source à faire d'abord).
  if new.mode_affichage <> 'lien'
     and (tg_op = 'INSERT' or new.mode_affichage is distinct from old.mode_affichage)
     and current_user = 'authenticated'
     and not public.est_super_admin() then
    raise exception 'Seul le lien sortant est ouvert : un lecteur intégré doit d''abord être testé et autorisé par le super-administrateur';
  end if;

  if new.controle_le is not null
     and new.controle_le > (now() at time zone 'Europe/Brussels')::date then
    raise exception 'La date de contrôle ne peut pas être dans le futur';
  end if;

  new.updated_at := now();
  return new;
end
$$;

create trigger sources_situation_controle_trg
  before insert or update on public.sources_situation
  for each row execute function public.sources_situation_controle();

alter table public.sources_situation enable row level security;

revoke all on public.sources_situation from public, anon, authenticated;
grant select on public.sources_situation to authenticated;
grant insert (contexte_id, code, categorie, nom, url, type_source, portee, note, avertissement, mode_affichage,
              aleas_lies, actif, suggeree, ordre_affichage, responsable_traitement, attestation_flux_public,
              controle_le, controle_note)
  on public.sources_situation to authenticated;
grant update (categorie, nom, url, type_source, portee, note, avertissement, mode_affichage, aleas_lies, actif,
              suggeree, ordre_affichage, responsable_traitement, attestation_flux_public, controle_le, controle_note)
  on public.sources_situation to authenticated;
grant delete on public.sources_situation to authenticated;

-- Lecture : le référentiel national actif est visible de tout utilisateur connecté ; les sources d'une commune,
-- de ses membres (les sources désactivées seulement de ceux qui peuvent les modifier).
create policy "lecture situation" on public.sources_situation
  for select to authenticated
  using (
    (contexte_id is null and (actif or public.est_super_admin()))
    or (contexte_id is not null
        and public.a_capacite(contexte_id, 'situation', 'lire')
        and (actif or public.a_capacite(contexte_id, 'situation', 'modifier')))
  );

create policy "ajout situation" on public.sources_situation
  for insert to authenticated
  with check (
    (contexte_id is null and public.est_super_admin())
    or (contexte_id is not null and public.a_capacite(contexte_id, 'situation', 'creer'))
  );

create policy "modif situation" on public.sources_situation
  for update to authenticated
  using (
    (contexte_id is null and public.est_super_admin())
    or (contexte_id is not null and public.a_capacite(contexte_id, 'situation', 'modifier'))
  )
  with check (
    (contexte_id is null and public.est_super_admin())
    or (contexte_id is not null and public.a_capacite(contexte_id, 'situation', 'modifier'))
  );

create policy "suppr situation" on public.sources_situation
  for delete to authenticated
  using (
    (contexte_id is null and public.est_super_admin())
    or (contexte_id is not null and public.a_capacite(contexte_id, 'situation', 'supprimer'))
  );

-- ============================================================
-- 2. Épingles personnelles (« Mon tableau »)
-- ============================================================
-- Une ligne n'existe que si l'utilisateur a fait un choix. Sans ligne, une source « suggérée » est épinglée par défaut ;
-- epingle = false enregistre le choix de la retirer.
create table public.epingles_situation (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_id uuid not null references public.sources_situation(id) on delete cascade,
  epingle boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, source_id)
);

comment on table public.epingles_situation is
  'Épingles de « Mon tableau », strictement personnelles (jamais lisibles par un autre utilisateur).';

create trigger epingles_situation_updated_at_trg
  before update on public.epingles_situation
  for each row execute function public.fn_set_updated_at();

alter table public.epingles_situation enable row level security;

revoke all on public.epingles_situation from public, anon, authenticated;
grant select on public.epingles_situation to authenticated;
grant insert (user_id, source_id, epingle) on public.epingles_situation to authenticated;
grant update (epingle) on public.epingles_situation to authenticated;

create policy "lecture de ses epingles" on public.epingles_situation
  for select to authenticated
  using (user_id = auth.uid());

-- On ne peut épingler qu'une source que l'on voit (le contrôle de clé étrangère, lui, ignore les droits de ligne).
create policy "ajout de ses epingles" on public.epingles_situation
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.sources_situation s where s.id = source_id)
  );

create policy "modif de ses epingles" on public.epingles_situation
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- 3. Vérifications partagées (« Marquer vu »)
-- ============================================================
create table public.verifications_situation (
  id uuid primary key default gen_random_uuid(),
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  source_id uuid not null references public.sources_situation(id),
  incident_id uuid references public.incidents(id),
  verifie_par uuid,
  verifie_le timestamptz not null default now(),
  constat text,
  constraint verifications_situation_constat_check check (constat is null or char_length(constat) <= 500)
);

comment on table public.verifications_situation is
  'Qui a regardé quelle source et quand, pour un contexte (et éventuellement un incident). Ajout seul. Pas de nom ni de donnée individuelle dans « constat ».';

create index verifications_situation_source_idx on public.verifications_situation (contexte_id, source_id, verifie_le desc);
create index verifications_situation_incident_idx on public.verifications_situation (incident_id) where incident_id is not null;

create or replace function public.verifications_situation_avant_insertion()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_source_contexte uuid;
  v_source_actif boolean;
  v_incident_contexte uuid;
  v_exercice boolean;
begin
  select s.contexte_id, s.actif into v_source_contexte, v_source_actif
    from public.sources_situation s where s.id = new.source_id;
  if not found then
    raise exception 'Source introuvable';
  end if;
  if not v_source_actif then
    raise exception 'Cette source est désactivée';
  end if;
  if v_source_contexte is not null and v_source_contexte <> new.contexte_id then
    raise exception 'Cette source appartient à une autre commune';
  end if;

  if new.incident_id is not null then
    select i.contexte_id, i.est_exercice into v_incident_contexte, v_exercice
      from public.incidents i where i.id = new.incident_id;
    if v_incident_contexte is null then
      raise exception 'Incident introuvable';
    end if;
    if v_incident_contexte <> new.contexte_id then
      raise exception 'Cet incident appartient à une autre commune';
    end if;
    if v_exercice then
      raise exception 'Incident d''exercice : la page Situation reste en lecture, aucune vérification n''y est enregistrée';
    end if;
  end if;

  new.constat := nullif(btrim(coalesce(new.constat, '')), '');
  new.verifie_par := auth.uid();
  new.verifie_le := clock_timestamp();
  return new;
end
$$;

create trigger verifications_situation_avant_insertion_trg
  before insert on public.verifications_situation
  for each row execute function public.verifications_situation_avant_insertion();

create or replace function public.verifications_situation_ajout_seul()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  raise exception 'verifications_situation est en ajout seul : une vérification ne se modifie ni ne se supprime, elle se complète par une nouvelle vérification';
end
$$;

create trigger verifications_situation_ajout_seul_ligne_trg
  before update or delete on public.verifications_situation
  for each row execute function public.verifications_situation_ajout_seul();

create trigger verifications_situation_ajout_seul_table_trg
  before truncate on public.verifications_situation
  for each statement execute function public.verifications_situation_ajout_seul();

alter table public.verifications_situation enable row level security;

revoke all on public.verifications_situation from public, anon, authenticated;
grant select on public.verifications_situation to authenticated;
grant insert (contexte_id, source_id, incident_id, constat) on public.verifications_situation to authenticated;

create policy "lecture si lecture situation" on public.verifications_situation
  for select to authenticated
  using (public.a_capacite(contexte_id, 'situation', 'lire'));

create policy "ajout si creation situation" on public.verifications_situation
  for insert to authenticated
  with check (public.a_capacite(contexte_id, 'situation', 'creer'));

-- Dernière vérification de chaque source par contexte (hérite des droits de l'appelant).
create view public.derniere_verification_situation
  with (security_invoker = true) as
  select distinct on (v.contexte_id, v.source_id)
         v.contexte_id, v.source_id, v.incident_id, v.verifie_le, v.constat
    from public.verifications_situation v
   order by v.contexte_id, v.source_id, v.verifie_le desc;

revoke all on public.derniere_verification_situation from public, anon, authenticated;
grant select on public.derniere_verification_situation to authenticated;

-- ============================================================
-- 4. Fonctions de trigger : jamais appelables comme RPC
-- ============================================================
revoke all on function public.sources_situation_controle() from public, anon, authenticated;
revoke all on function public.verifications_situation_avant_insertion() from public, anon, authenticated;
revoke all on function public.verifications_situation_ajout_seul() from public, anon, authenticated;
