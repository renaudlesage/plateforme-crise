-- Géo-barrière, palier 1 : journal des franchissements de zone rouge par les intervenants Terrain.
--
-- L'app Terrain prévient déjà localement (bandeau + vibration) quand l'appareil entre dans une zone ROUGE de
-- l'incident suivi. Ce palier ajoute :
--  - une pré-alerte d'approche (côté client, aucune donnée serveur) ;
--  - la journalisation côté CC des entrées et sorties de zone rouge, UNIQUEMENT quand l'intervenant partage déjà
--    sa position avec le CC (même consentement que `positions_equipes` : rien n'est envoyé sans ce choix).
--
-- La table est en ajout seul pour les rôles applicatifs : ni modification ni suppression (c'est une trace).
-- Les franchissements ne sont PAS un contrôle d'accès : le droit d'entrer en zone rouge se décide sur place
-- (Dir PC-Ops) ; le journal sert au CC pour savoir qui est entré, et au REX.

create table if not exists public.franchissements_zone (
  id uuid primary key default gen_random_uuid(),
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  zone_id uuid not null references public.zones_intervention(id) on delete cascade,
  auteur_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  libelle text check (libelle is null or char_length(libelle) <= 120),
  nature text not null check (nature in ('entree', 'sortie')),
  type_zone text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  precision_m double precision check (precision_m is null or precision_m >= 0),
  -- heure de l'appareil au moment du franchissement : l'écriture peut arriver plus tard (file hors ligne)
  horodatage_appareil timestamptz not null default now(),
  cree_le timestamptz not null default now()
);

comment on table public.franchissements_zone is
  'Entrées et sorties de zone rouge détectées par l''app Terrain (géo-barrière), envoyées quand la position est partagée avec le CC. Ajout seul.';

create index if not exists franchissements_zone_incident_idx on public.franchissements_zone (incident_id, cree_le desc);

-- Cohérence : l'incident appartient au contexte, la zone à l'incident ; le type de zone vient de la zone,
-- l'auteur est toujours l'utilisateur connecté, l'heure appareil ne peut pas être dans le futur (dérive d'horloge).
create or replace function public.franchissements_zone_controle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  if auth.uid() is not null then
    new.auteur_id := auth.uid();
  end if;
  if not exists (select 1 from public.incidents i where i.id = new.incident_id and i.contexte_id = new.contexte_id) then
    raise exception 'Incident inconnu dans ce contexte' using errcode = 'P0011';
  end if;
  select z.type_zone into v_type
  from public.zones_intervention z
  where z.id = new.zone_id and z.incident_id = new.incident_id;
  if not found then
    raise exception 'Zone inconnue pour cet incident' using errcode = 'P0012';
  end if;
  new.type_zone := v_type;
  if new.horodatage_appareil > clock_timestamp() + interval '5 minutes' then
    new.horodatage_appareil := clock_timestamp();
  end if;
  new.cree_le := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.franchissements_zone_controle() from public, anon, authenticated;

create or replace trigger franchissements_zone_controle
  before insert on public.franchissements_zone
  for each row execute function public.franchissements_zone_controle();

alter table public.franchissements_zone enable row level security;

create policy franchissements_zone_select on public.franchissements_zone
  for select to authenticated
  using (public.a_capacite(contexte_id, 'incidents', 'lire'));

create policy franchissements_zone_insert on public.franchissements_zone
  for insert to authenticated
  with check (auteur_id = auth.uid() and public.a_capacite(contexte_id, 'incidents', 'creer'));

-- Ajout seul : aucune politique ni aucun droit de modification ou de suppression pour les rôles applicatifs.
revoke all on public.franchissements_zone from public, anon, authenticated;
grant select on public.franchissements_zone to authenticated;
grant insert (id, contexte_id, incident_id, zone_id, libelle, nature, latitude, longitude, precision_m, horodatage_appareil)
  on public.franchissements_zone to authenticated;
