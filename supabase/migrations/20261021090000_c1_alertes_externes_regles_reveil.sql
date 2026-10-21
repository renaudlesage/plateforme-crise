-- C1 Réveil automatique, première partie : stockage des avertissements météo
-- officiels et règles de réveil. Indépendant de la source (open data IRM ou
-- MeteoAlarm, question ouverte 7) : aucune tâche planifiée, aucune Edge
-- Function, aucune notification, aucun événement créé ici.
--
-- Contenu :
--   1. alertes_externes : un avertissement par ligne (un segment d'un message
--      CAP, voir supabase/functions/_shared/cap.ts), en ajout seul.
--      Écrit par l'ingestion (clé de service) pour les flux ; saisie manuelle
--      par une commune (mode dégradé, si le flux manque) et fixture de
--      démonstration par le super-admin, rattachées à une seule commune.
--      Distinct d'alertes_publiques (messages de la commune à la population,
--      alimentés aussi par le pont Eventware) : rien n'y est écrit.
--   2. alertes_externes_en_cours : dernier message de chaque fil (alerte, mises
--      à jour, annulation), encore valide, aux droits de l'appelant.
--   3. regles_reveil : (source, type, niveau minimal, fenêtre horaire) → seuil
--      d'action d'une fiche de la commune ; données éditables (CRUD).
--   4. regles_reveil_correspondantes(alerte) : règles armées par un
--      avertissement, aux droits de l'appelant.

-- 1. alertes_externes -----------------------------------------------------------------

create table if not exists public.alertes_externes (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('irm', 'meteoalarm', 'saisie', 'fixture')),
  identifiant text not null check (identifiant ~ '^[^\s,<&]{1,255}$'),
  segment smallint not null default 0 check (segment between 0 and 50),
  contexte_id uuid references public.contextes(id) on delete cascade,
  expediteur text not null check (length(expediteur) <= 255),
  emis_le timestamptz not null,
  statut_cap text not null default 'Actual' check (statut_cap in ('Actual', 'Exercise', 'System', 'Test', 'Draft')),
  type_message text not null default 'Alert' check (type_message in ('Alert', 'Update', 'Cancel')),
  portee text check (length(portee) <= 50),
  references_cap text[] not null default '{}' check (cardinality(references_cap) <= 50),
  fil text not null,
  langue text not null default 'fr' check (length(langue) <= 20),
  evenement text not null check (length(evenement) <= 300),
  type_alerte text not null check (type_alerte in ('orage', 'pluie', 'vent', 'chaleur', 'froid', 'neige_verglas', 'brouillard', 'autre')),
  niveau text not null check (niveau in ('vert', 'jaune', 'orange', 'rouge')),
  severite text check (length(severite) <= 20),
  urgence text check (length(urgence) <= 20),
  certitude text check (length(certitude) <= 20),
  debut_le timestamptz not null default now(),
  fin_le timestamptz,
  titre text check (length(titre) <= 500),
  description text check (length(description) <= 10000),
  consignes text check (length(consignes) <= 10000),
  zones jsonb not null default '[]' check (jsonb_typeof(zones) = 'array' and length(zones::text) <= 100000),
  provinces text[] not null default '{}' check (provinces <@ array['Anvers', 'Brabant flamand', 'Brabant wallon',
    'Bruxelles-Capitale', 'Flandre-Occidentale', 'Flandre-Orientale', 'Hainaut', 'Liège', 'Limbourg', 'Luxembourg', 'Namur']::text[]),
  lien text check (length(lien) <= 2000),
  cap_brut text check (length(cap_brut) <= 1000000),
  empreinte_brut text,
  recu_le timestamptz not null default now(),
  saisi_par uuid,
  constraint alertes_externes_cle unique (source, identifiant, segment),
  constraint alertes_externes_flux_ou_commune check ((source in ('irm', 'meteoalarm')) = (contexte_id is null))
);

comment on table public.alertes_externes is
  'Avertissements météo officiels (C1), un segment de message CAP par ligne, en ajout seul. Distinct d''alertes_publiques (messages de la commune à la population).';
comment on column public.alertes_externes.source is 'irm ou meteoalarm : ingestion d''un flux ; saisie : encodé par la commune quand le flux manque ; fixture : démonstration (super-admin)';
comment on column public.alertes_externes.segment is 'Rang du segment dans le message CAP : un segment par type, niveau, période ou zones distincts (0 = le plus grave)';
comment on column public.alertes_externes.contexte_id is 'null pour un flux (vaut pour les provinces citées) ; commune visée pour une saisie ou une fixture';
comment on column public.alertes_externes.fil is 'Identifiant du premier message du fil : une mise à jour ou une annulation rejoint le fil du message qu''elle référence (calculé à l''insertion)';
comment on column public.alertes_externes.provinces is 'Provinces au vocabulaire de contextes.province ; la zone MeteoAlarm « Brabant » vaut pour le Brabant flamand, le Brabant wallon et Bruxelles-Capitale';
comment on column public.alertes_externes.cap_brut is 'Message CAP tel que reçu, gardé pour pouvoir fournir l''information non modifiée (conditions MeteoAlarm)';
comment on column public.alertes_externes.recu_le is 'Heure de réception par le serveur : répond à « à quelle heure avez-vous reçu l''alerte ? »';

create index if not exists alertes_externes_fil_idx on public.alertes_externes (source, fil, emis_le desc);
create index if not exists alertes_externes_provinces_idx on public.alertes_externes using gin (provinces);
create index if not exists alertes_externes_recu_idx on public.alertes_externes (recu_le desc);
create index if not exists alertes_externes_contexte_idx on public.alertes_externes (contexte_id) where contexte_id is not null;

-- Droits de l'appelant : current_user distingue un appel direct de l'API (anon,
-- authenticated) de l'ingestion (service_role) et des migrations (postgres).
create or replace function public.alertes_externes_avant_insertion()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_fil text;
begin
  if current_user in ('anon', 'authenticated') then
    if new.source not in ('saisie', 'fixture') then
      raise exception 'Seule l''ingestion enregistre les avertissements des flux' using errcode = '42501';
    end if;
    new.identifiant := new.source || '.' || gen_random_uuid();
    new.segment := 0;
    new.expediteur := case new.source when 'saisie' then 'saisie manuelle' else 'fixture de démonstration' end;
    new.emis_le := now();
    new.statut_cap := 'Actual';
    new.type_message := 'Alert';
    new.portee := 'Restricted';
    new.references_cap := '{}';
    new.langue := 'fr';
    new.zones := '[]';
    new.cap_brut := null;
    new.saisi_par := auth.uid();
    new.provinces := coalesce((select array[c.province] from contextes c
                               where c.id = new.contexte_id and c.province is not null), '{}');
  end if;
  new.recu_le := now();
  new.empreinte_brut := case when new.cap_brut is null then null
                             else encode(extensions.digest(convert_to(new.cap_brut, 'UTF8'), 'sha256'), 'hex') end;
  if new.type_message in ('Update', 'Cancel') and cardinality(new.references_cap) > 0 then
    select a.fil into v_fil
    from alertes_externes a
    where a.source = new.source and a.identifiant = any(new.references_cap)
    order by a.emis_le desc
    limit 1;
  end if;
  new.fil := coalesce(v_fil, new.identifiant);
  return new;
end;
$function$;

create or replace function public.alertes_externes_ajout_seul()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  raise exception 'Les avertissements sont en ajout seul : une correction arrive par un nouveau message' using errcode = '42501';
end;
$function$;

revoke all on function public.alertes_externes_avant_insertion() from public, anon, authenticated;
revoke all on function public.alertes_externes_ajout_seul() from public, anon, authenticated;

create or replace trigger alertes_externes_avant_insertion_trg
  before insert on public.alertes_externes
  for each row execute function public.alertes_externes_avant_insertion();
create or replace trigger alertes_externes_ajout_seul_trg
  before update on public.alertes_externes
  for each row execute function public.alertes_externes_ajout_seul();

alter table public.alertes_externes enable row level security;
revoke all on public.alertes_externes from public, anon, authenticated;
grant select on public.alertes_externes to authenticated;
grant insert (source, contexte_id, evenement, type_alerte, niveau, debut_le, fin_le, titre, description, consignes, lien)
  on public.alertes_externes to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'alertes_externes'
                 and policyname = 'lecture : flux pour tous, saisie et fixture pour la commune') then
    create policy "lecture : flux pour tous, saisie et fixture pour la commune" on public.alertes_externes
      for select to authenticated
      using (contexte_id is null or a_acces(contexte_id, 'lecture') or est_super_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'alertes_externes'
                 and policyname = 'saisie par la commune, fixture par le super-admin') then
    create policy "saisie par la commune, fixture par le super-admin" on public.alertes_externes
      for insert to authenticated
      with check ((source = 'saisie' and contexte_id is not null and a_acces(contexte_id, 'ecriture'))
                  or (source = 'fixture' and contexte_id is not null and est_super_admin()));
  end if;
end $$;

-- 2. alertes_externes_en_cours -------------------------------------------------------------

create or replace view public.alertes_externes_en_cours with (security_invoker = true) as
select a.*
from public.alertes_externes a
where a.statut_cap = 'Actual'
  and a.type_message <> 'Cancel'
  and a.niveau <> 'vert'
  and (a.fin_le is null or a.fin_le > now())
  and not exists (
    select 1 from public.alertes_externes b
    where b.source = a.source and b.fil = a.fil
      and (b.emis_le, b.recu_le) > (a.emis_le, a.recu_le)
  );

comment on view public.alertes_externes_en_cours is
  'Avertissements valides : dernier message de chaque fil, ni annulé, ni expiré, ni vert (droits de l''appelant)';

revoke all on public.alertes_externes_en_cours from public, anon, authenticated;
grant select on public.alertes_externes_en_cours to authenticated;

-- 3. regles_reveil ---------------------------------------------------------------------------

create table if not exists public.regles_reveil (
  id uuid primary key default gen_random_uuid(),
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  seuil_action_id uuid not null references public.seuils_action(id) on delete cascade,
  source text not null default 'toutes' check (source in ('toutes', 'irm', 'meteoalarm', 'saisie')),
  type_alerte text not null check (type_alerte in ('orage', 'pluie', 'vent', 'chaleur', 'froid', 'neige_verglas', 'brouillard', 'autre')),
  niveau_min text not null check (niveau_min in ('jaune', 'orange', 'rouge')),
  heure_debut time,
  heure_fin time,
  actif boolean not null default true,
  origine text not null default 'manuelle' check (origine in ('manuelle', 'import_fiche')),
  note text check (length(note) <= 500),
  cree_le timestamptz not null default now(),
  cree_par uuid,
  maj_le timestamptz not null default now(),
  maj_par uuid,
  constraint regles_reveil_fenetre check ((heure_debut is null) = (heure_fin is null) and (heure_debut is null or heure_debut <> heure_fin)),
  constraint regles_reveil_unique unique (seuil_action_id, source, type_alerte, niveau_min)
);

comment on table public.regles_reveil is
  'Règles de réveil (C1) : un avertissement de ce type, de ce niveau ou plus, arme ce seuil d''action de la commune';
comment on column public.regles_reveil.source is 'toutes, ou une source précise ; une fixture de démonstration arme toutes les règles concernées';
comment on column public.regles_reveil.heure_debut is 'Fenêtre horaire facultative, en heure de Belgique, comparée à l''heure de réception de l''avertissement ; fin < début : la fenêtre passe minuit';
comment on column public.regles_reveil.origine is 'manuelle, ou import_fiche pour une règle livrée avec une fiche (orages, canicule)';

create index if not exists regles_reveil_contexte_idx on public.regles_reveil (contexte_id, type_alerte) where actif;

-- Droits de l'appelant : le seuil doit être lisible par l'appelant et appartenir à la même commune.
create or replace function public.regles_reveil_avant_ecriture()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if not exists (select 1 from seuils_action s where s.id = new.seuil_action_id and s.contexte_id = new.contexte_id) then
    raise exception 'Seuil d''action inconnu pour cette commune' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    new.cree_le := now();
    new.cree_par := auth.uid();
  end if;
  new.maj_le := now();
  new.maj_par := auth.uid();
  return new;
end;
$function$;

revoke all on function public.regles_reveil_avant_ecriture() from public, anon, authenticated;

create or replace trigger regles_reveil_avant_ecriture_trg
  before insert or update on public.regles_reveil
  for each row execute function public.regles_reveil_avant_ecriture();

alter table public.regles_reveil enable row level security;
revoke all on public.regles_reveil from public, anon;

-- Mêmes capacités que seuils_action (référentiels de la commune).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'regles_reveil' and policyname = 'lecture si membre') then
    create policy "lecture si membre" on public.regles_reveil
      for select to authenticated using (a_capacite(contexte_id, 'referentiels', 'lire'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'regles_reveil' and policyname = 'ecriture si ecriture') then
    create policy "ecriture si ecriture" on public.regles_reveil
      for insert to authenticated with check (a_capacite(contexte_id, 'referentiels', 'creer'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'regles_reveil' and policyname = 'modif si ecriture') then
    create policy "modif si ecriture" on public.regles_reveil
      for update to authenticated using (a_capacite(contexte_id, 'referentiels', 'modifier'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'regles_reveil' and policyname = 'suppr si admin') then
    create policy "suppr si admin" on public.regles_reveil
      for delete to authenticated using (a_capacite(contexte_id, 'referentiels', 'supprimer'));
  end if;
end $$;

-- 4. regles_reveil_correspondantes -----------------------------------------------------------

-- Droits de l'appelant : un membre ne voit que les règles de ses communes ; l'ingestion (clé de
-- service) les voit toutes. Seuls les avertissements réels (statut CAP Actual) arment une règle ;
-- une annulation n'en arme aucune. Un flux vaut pour les communes des provinces citées, une saisie
-- ou une fixture pour la seule commune visée. Fiche écartée, seuil inactif, commune suspendue ou
-- plateforme : rien.
create or replace function public.regles_reveil_correspondantes(p_alerte_id uuid)
 returns table(regle_id uuid, contexte_id uuid, seuil_action_id uuid, seuil_libelle text, risque_id uuid, niveau_min text)
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  select r.id, r.contexte_id, r.seuil_action_id, s.libelle, s.risque_id, r.niveau_min
  from alertes_externes a
  join regles_reveil r on r.actif and r.type_alerte = a.type_alerte
  join seuils_action s on s.id = r.seuil_action_id and s.actif
  join contextes c on c.id = r.contexte_id
  left join risques_territoire rt on rt.id = s.risque_id
  where a.id = p_alerte_id
    and a.statut_cap = 'Actual'
    and a.type_message <> 'Cancel'
    and (case a.niveau when 'rouge' then 3 when 'orange' then 2 when 'jaune' then 1 else 0 end)
        >= (case r.niveau_min when 'rouge' then 3 when 'orange' then 2 else 1 end)
    and (r.source = 'toutes' or r.source = a.source or a.source = 'fixture')
    and ((a.contexte_id is null and c.province = any(a.provinces)) or a.contexte_id = r.contexte_id)
    and not c.suspendu
    and not c.est_plateforme
    and (rt.id is null or rt.statut <> 'ecarte')
    and (r.heure_debut is null
         or (r.heure_debut < r.heure_fin
             and (a.recu_le at time zone 'Europe/Brussels')::time >= r.heure_debut
             and (a.recu_le at time zone 'Europe/Brussels')::time < r.heure_fin)
         or (r.heure_debut > r.heure_fin
             and ((a.recu_le at time zone 'Europe/Brussels')::time >= r.heure_debut
                  or (a.recu_le at time zone 'Europe/Brussels')::time < r.heure_fin)))
  order by c.nom, s.ordre;
$function$;

revoke all on function public.regles_reveil_correspondantes(uuid) from public, anon;
grant execute on function public.regles_reveil_correspondantes(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
