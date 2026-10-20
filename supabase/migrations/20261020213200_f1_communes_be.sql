-- F1 Référentiel des communes belges.
--
-- communes_be : une ligne par commune (code NIS à 5 chiffres), noms FR / NL / DE,
-- arrondissement, province (même vocabulaire que contextes.province, Bruxelles
-- compris), région, langue(s) administrative(s), point de la commune, emprise
-- (vide jusqu'au chargement des géométries, au chantier C2), zone de secours et
-- zone de police (communes wallonnes).
-- Les lignes viennent de supabase/seed/communes_be.sql, généré par
-- scripts/seed/communes_be.py depuis l'export « communes et localités » d'Open
-- Data Wallonie-Bruxelles (codes INS de la nomenclature REFNIS de Statbel au
-- 1er janvier 2025) et, pour les zones, d'une copie datée de la table communes
-- d'Eventware (pas de base partagée) ; jamais saisies dans le code des apps.
-- Lecture ouverte à tous (référentiel public), aucune écriture par l'API.

create table if not exists public.communes_be (
  code_nis text primary key check (code_nis ~ '^[0-9]{5}$'),
  nom_fr text,
  nom_nl text,
  nom_de text,
  code_arrondissement text not null check (code_arrondissement ~ '^[0-9]{5}$'),
  province text not null check (province = any (array[
    'Anvers', 'Brabant flamand', 'Brabant wallon', 'Bruxelles-Capitale', 'Flandre-Occidentale',
    'Flandre-Orientale', 'Hainaut', 'Liège', 'Limbourg', 'Luxembourg', 'Namur'])),
  region text not null check (region in ('Région de Bruxelles-Capitale', 'Région flamande', 'Région wallonne')),
  langues text[] not null default '{}' check (langues <@ array['fr', 'nl', 'de']),
  centroide geography(Point, 4326),
  emprise geometry(Polygon, 4326),
  zone_secours text,
  zone_police text,
  zone_police_numero text check (zone_police_numero ~ '^[0-9]{4}$'),
  valide_depuis date,
  source text not null,
  maj_le timestamptz not null default now(),
  check (coalesce(nom_fr, nom_nl, nom_de) is not null)
);

comment on table public.communes_be is 'Référentiel des communes belges (F1). Source : Open Data Wallonie-Bruxelles, codes INS (nomenclature REFNIS de Statbel).';
comment on column public.communes_be.centroide is 'Point de la commune fourni par l''export source (centroïde probable)';
comment on column public.communes_be.province is 'Même vocabulaire que contextes.province ; « Bruxelles-Capitale » pour les 19 communes bruxelloises';
comment on column public.communes_be.langues is 'Langue(s) administrative(s) : fr, nl, de (les facilités linguistiques ne sont pas représentées)';
comment on column public.communes_be.zone_secours is 'Zone de secours (communes wallonnes, d''après Eventware, vérifié le 16/09/2026) ; vide ailleurs pour l''instant';
comment on column public.communes_be.zone_police_numero is 'Numéro officiel de la zone de police (découpage par arrêté royal)';

create index if not exists communes_be_province_idx on public.communes_be (province);
create index if not exists communes_be_zone_secours_idx on public.communes_be (zone_secours) where zone_secours is not null;

alter table public.communes_be enable row level security;
revoke all on public.communes_be from public, anon, authenticated;
grant select on public.communes_be to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'communes_be' and policyname = 'lecture publique'
  ) then
    create policy "lecture publique" on public.communes_be for select to anon, authenticated using (true);
  end if;
end $$;
