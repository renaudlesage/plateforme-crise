-- Risques du territoire : distinguer la menace potentielle (le risque) de la
-- particularité localisée du territoire (l'objet à risque).
--
-- Avant : les scénarios génériques du pack de démarrage (inondation, cyberattaque,
-- canicule…) étaient rangés dans objets_a_risque faute de table dédiée (catégorie
-- « non_localisable »), exercices.fiche_risque_id était documenté comme « alias de
-- objet_risque_id », et la notion de risque existait trois fois à moitié
-- (objets_a_risque, matrice_risques, risques_identifies_pgui.risque en texte libre).
--
-- Après :
--   1. risques_territoire : la menace — code, titre, catégorie NCCN, statut,
--      probabilité × impact (reprise de matrice_risques), les huit champs scénario,
--      sources ;
--   2. objets_a_risque_risques : lien N:N objet ↔ risque, avec le rôle de l'objet
--      (source du risque, ou enjeu exposé) ; risques_territoire_fonctions_critiques :
--      fonctions critiques menacées par un risque ;
--   3. seuils_action, seuils_meteo_declencheurs, plans_reference, plans_action_risque,
--      evaluations_risque, mesures_compensatoires_suivi : rattachables à un risque
--      et/ou à un objet ;
--   4. données : les fiches STARTER-* (avec seuils, étapes, évaluations, mesures,
--      fonctions critiques) passent dans risques_territoire en gardant leur id ;
--      exercices.fiche_risque_id et risques_identifies_pgui.risque_id pointent vers
--      le risque ; les objets réels ne bougent pas ;
--   5. matrice_risques est absorbée puis supprimée ;
--   6. objets_a_risque perd les huit champs scénario ;
--   7. les politiques des tables à double parent lisent le contexte de l'un ou l'autre.

-- 1. Risques du territoire ---------------------------------------------------

create table if not exists public.risques_territoire (
  id uuid primary key default gen_random_uuid(),
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  code text,
  titre text not null,
  categorie text not null references public.categories_risques_nccn(categorie),
  type_risque text,
  statut text not null default 'retenu' check (statut in ('a_evaluer', 'retenu', 'ecarte')),
  probabilite smallint check (probabilite between 1 and 5),
  impact smallint check (impact between 1 and 5),
  niveau_calcule smallint generated always as (probabilite * impact) stored,
  date_evaluation date,
  declencheur text,
  effets_directs text,
  effets_cascade text,
  signaux_faibles text,
  mesures_preventives text,
  mesures_compensatoires text,
  decisions_a_preparer text,
  messages_publics_predefinis text,
  sources text,
  niveau_confidentialite text not null default 'restreint'
    check (niveau_confidentialite in ('public', 'restreint', 'confidentiel')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contexte_id, code)
);
create index if not exists risques_territoire_contexte_idx on public.risques_territoire (contexte_id);

drop trigger if exists trg_risques_territoire_updated_at on public.risques_territoire;
create trigger trg_risques_territoire_updated_at
  before update on public.risques_territoire
  for each row execute function public.fn_set_updated_at();

alter table public.risques_territoire enable row level security;
grant select, insert, update, delete on public.risques_territoire to authenticated, service_role;

drop policy if exists "lecture si membre" on public.risques_territoire;
drop policy if exists "ecriture si ecriture" on public.risques_territoire;
drop policy if exists "modif si ecriture" on public.risques_territoire;
drop policy if exists "suppr si admin" on public.risques_territoire;
create policy "lecture si membre" on public.risques_territoire
  for select using (public.a_capacite(contexte_id, 'referentiels', 'lire'));
create policy "ecriture si ecriture" on public.risques_territoire
  for insert with check (public.a_capacite(contexte_id, 'referentiels', 'creer'));
create policy "modif si ecriture" on public.risques_territoire
  for update using (public.a_capacite(contexte_id, 'referentiels', 'modifier'));
create policy "suppr si admin" on public.risques_territoire
  for delete using (public.a_capacite(contexte_id, 'referentiels', 'supprimer'));

-- 2. Liens -------------------------------------------------------------------

create table if not exists public.objets_a_risque_risques (
  objet_id uuid not null references public.objets_a_risque(id) on delete cascade,
  risque_id uuid not null references public.risques_territoire(id) on delete cascade,
  role text not null default 'enjeu' check (role in ('source', 'enjeu')),
  commentaire text,
  primary key (objet_id, risque_id)
);
alter table public.objets_a_risque_risques enable row level security;
grant select, insert, update, delete on public.objets_a_risque_risques to authenticated, service_role;

drop policy if exists "lecture via risque" on public.objets_a_risque_risques;
drop policy if exists "ecriture via risque" on public.objets_a_risque_risques;
drop policy if exists "modif via risque" on public.objets_a_risque_risques;
drop policy if exists "suppr via risque" on public.objets_a_risque_risques;
create policy "lecture via risque" on public.objets_a_risque_risques
  for select using (public.a_capacite((select r.contexte_id from public.risques_territoire r where r.id = risque_id), 'referentiels', 'lire'));
create policy "ecriture via risque" on public.objets_a_risque_risques
  for insert with check (
    public.a_capacite((select r.contexte_id from public.risques_territoire r where r.id = risque_id), 'referentiels', 'modifier')
    and (select o.contexte_id from public.objets_a_risque o where o.id = objet_id)
      = (select r.contexte_id from public.risques_territoire r where r.id = risque_id)
  );
create policy "modif via risque" on public.objets_a_risque_risques
  for update using (public.a_capacite((select r.contexte_id from public.risques_territoire r where r.id = risque_id), 'referentiels', 'modifier'));
create policy "suppr via risque" on public.objets_a_risque_risques
  for delete using (public.a_capacite((select r.contexte_id from public.risques_territoire r where r.id = risque_id), 'referentiels', 'modifier'));

create table if not exists public.risques_territoire_fonctions_critiques (
  risque_id uuid not null references public.risques_territoire(id) on delete cascade,
  fonction_critique_id uuid not null references public.fonctions_critiques(id) on delete cascade,
  primary key (risque_id, fonction_critique_id)
);
alter table public.risques_territoire_fonctions_critiques enable row level security;
grant select, insert, delete on public.risques_territoire_fonctions_critiques to authenticated, service_role;

drop policy if exists "lecture via risque" on public.risques_territoire_fonctions_critiques;
drop policy if exists "ecriture via risque" on public.risques_territoire_fonctions_critiques;
drop policy if exists "suppr via risque" on public.risques_territoire_fonctions_critiques;
create policy "lecture via risque" on public.risques_territoire_fonctions_critiques
  for select using (public.a_capacite((select r.contexte_id from public.risques_territoire r where r.id = risque_id), 'referentiels', 'lire'));
create policy "ecriture via risque" on public.risques_territoire_fonctions_critiques
  for insert with check (
    public.a_capacite((select r.contexte_id from public.risques_territoire r where r.id = risque_id), 'referentiels', 'modifier')
    and (select f.contexte_id from public.fonctions_critiques f where f.id = fonction_critique_id)
      = (select r.contexte_id from public.risques_territoire r where r.id = risque_id)
  );
create policy "suppr via risque" on public.risques_territoire_fonctions_critiques
  for delete using (public.a_capacite((select r.contexte_id from public.risques_territoire r where r.id = risque_id), 'referentiels', 'modifier'));

-- 3. Tables enfants : rattachables à un risque et/ou à un objet -----------------

alter table public.seuils_action
  add column if not exists risque_id uuid references public.risques_territoire(id) on delete cascade;
alter table public.seuils_meteo_declencheurs
  add column if not exists risque_id uuid references public.risques_territoire(id) on delete cascade;
alter table public.plans_reference
  add column if not exists risque_id uuid references public.risques_territoire(id) on delete set null;
alter table public.plans_action_risque
  add column if not exists risque_id uuid references public.risques_territoire(id) on delete cascade;
alter table public.evaluations_risque
  add column if not exists risque_id uuid references public.risques_territoire(id) on delete cascade;
alter table public.mesures_compensatoires_suivi
  add column if not exists risque_id uuid references public.risques_territoire(id) on delete cascade;

create index if not exists seuils_action_risque_idx on public.seuils_action (risque_id);
create index if not exists seuils_meteo_declencheurs_risque_idx on public.seuils_meteo_declencheurs (risque_id);
create index if not exists plans_reference_risque_idx on public.plans_reference (risque_id);
create index if not exists plans_action_risque_risque_idx on public.plans_action_risque (risque_id);
create index if not exists evaluations_risque_risque_idx on public.evaluations_risque (risque_id);
create index if not exists mesures_compensatoires_suivi_risque_idx on public.mesures_compensatoires_suivi (risque_id);

-- Les trois tables sans contexte_id propre ont exactement un parent.
alter table public.plans_action_risque alter column objet_risque_id drop not null;
alter table public.evaluations_risque alter column objet_risque_id drop not null;
alter table public.mesures_compensatoires_suivi alter column objet_risque_id drop not null;
alter table public.plans_action_risque drop constraint if exists plans_action_risque_un_parent;
alter table public.plans_action_risque
  add constraint plans_action_risque_un_parent check (num_nonnulls(objet_risque_id, risque_id) = 1);
alter table public.evaluations_risque drop constraint if exists evaluations_risque_un_parent;
alter table public.evaluations_risque
  add constraint evaluations_risque_un_parent check (num_nonnulls(objet_risque_id, risque_id) = 1);
alter table public.mesures_compensatoires_suivi drop constraint if exists mesures_compensatoires_suivi_un_parent;
alter table public.mesures_compensatoires_suivi
  add constraint mesures_compensatoires_suivi_un_parent check (num_nonnulls(objet_risque_id, risque_id) = 1);

-- 4. Données : les fiches du pack sont des risques, pas des objets -----------------

-- 4.1 Les fiches STARTER-* passent dans risques_territoire, même id.
--     Catégorie NCCN : man_made pour le sécuritaire et le cyber, naturel pour le
--     naturel, technologique pour le reste (industriel, nucléaire, TMD, bâtiment).
insert into public.risques_territoire (
  id, contexte_id, code, titre, categorie, type_risque,
  declencheur, effets_directs, effets_cascade, signaux_faibles,
  mesures_preventives, mesures_compensatoires, decisions_a_preparer, messages_publics_predefinis,
  niveau_confidentialite
)
select
  o.id, o.contexte_id, o.code, o.identification,
  case
    when o.code in ('STARTER-06', 'STARTER-07', 'STARTER-REX-2026-CYBER') then 'man_made'
    when o.categorie = 'naturel' then 'naturel'
    else 'technologique'
  end,
  o.type_risque,
  o.declencheur, o.effets_directs, o.effets_cascade, o.signaux_faibles,
  o.mesures_preventives, o.mesures_compensatoires, o.decisions_a_preparer, o.messages_publics_predefinis,
  coalesce(o.niveau_confidentialite, 'restreint')
from public.objets_a_risque o
where o.code like 'STARTER-%'
on conflict do nothing;

-- 4.2 Leurs enfants suivent.
update public.seuils_action set risque_id = objet_risque_id, objet_risque_id = null
  where objet_risque_id in (select id from public.risques_territoire);
update public.seuils_meteo_declencheurs set risque_id = objet_risque_id, objet_risque_id = null
  where objet_risque_id in (select id from public.risques_territoire);
update public.plans_reference set risque_id = objet_risque_id, objet_risque_id = null
  where objet_risque_id in (select id from public.risques_territoire);
update public.plans_action_risque set risque_id = objet_risque_id, objet_risque_id = null
  where objet_risque_id in (select id from public.risques_territoire);
update public.evaluations_risque set risque_id = objet_risque_id, objet_risque_id = null
  where objet_risque_id in (select id from public.risques_territoire);
update public.mesures_compensatoires_suivi set risque_id = objet_risque_id, objet_risque_id = null
  where objet_risque_id in (select id from public.risques_territoire);
insert into public.risques_territoire_fonctions_critiques (risque_id, fonction_critique_id)
  select objet_id, fonction_critique_id from public.objets_a_risque_fonctions_critiques
  where objet_id in (select id from public.risques_territoire)
  on conflict do nothing;

-- 4.3 Exercices : fiche_risque_id désigne le risque joué, objet_risque_id l'objet concerné.
--     La clé est rebranchée sur risques_territoire avant la suppression des anciennes lignes.
update public.exercices
  set objet_risque_id = coalesce(objet_risque_id, fiche_risque_id), fiche_risque_id = null
  where fiche_risque_id is not null
    and fiche_risque_id not in (select id from public.risques_territoire);
update public.exercices
  set fiche_risque_id = coalesce(fiche_risque_id, objet_risque_id), objet_risque_id = null
  where objet_risque_id in (select id from public.risques_territoire);
alter table public.exercices drop constraint if exists exercices_fiche_risque_id_fkey;
alter table public.exercices
  add constraint exercices_fiche_risque_id_fkey
  foreign key (fiche_risque_id) references public.risques_territoire(id) on delete set null;
comment on column public.exercices.fiche_risque_id is
  'Risque du territoire (scénario) joué par l''exercice ; objet_risque_id désigne l''objet concerné, s''il y en a un.';

-- 4.4 Triage PGUI : la « fiche détaillée » liée est un risque.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'risques_identifies_pgui' and column_name = 'objet_risque_id') then
    alter table public.risques_identifies_pgui drop constraint if exists risques_identifies_pgui_objet_risque_id_fkey;
    update public.risques_identifies_pgui set objet_risque_id = null
      where objet_risque_id is not null and objet_risque_id not in (select id from public.risques_territoire);
    alter table public.risques_identifies_pgui rename column objet_risque_id to risque_id;
    alter table public.risques_identifies_pgui
      add constraint risques_identifies_pgui_risque_id_fkey
      foreign key (risque_id) references public.risques_territoire(id) on delete set null;
  end if;
end $$;
comment on table public.risques_identifies_pgui is
  'Triage des risques au niveau PGUI (chapitre administratif 3B) : classement vers un mode de traitement, avec renvoi éventuel vers la fiche de risque détaillée (risques_territoire).';

-- 4.5 Les fiches n'ont plus rien à faire dans les objets.
delete from public.objets_a_risque where id in (select id from public.risques_territoire);

-- 5. matrice_risques est absorbée -------------------------------------------------

do $$
declare
  v_sans_categorie integer;
begin
  if to_regclass('public.matrice_risques') is null then
    return;
  end if;
  select count(*) into v_sans_categorie from public.matrice_risques where categorie_id is null;
  if v_sans_categorie > 0 then
    raise exception 'matrice_risques : % ligne(s) sans catégorie NCCN, à corriger avant la fusion', v_sans_categorie;
  end if;
  insert into public.risques_territoire (contexte_id, titre, categorie, probabilite, impact, date_evaluation)
    select m.contexte_id, m.risque, c.categorie, m.probabilite, m.impact, m.date_evaluation
    from public.matrice_risques m
    join public.categories_risques_nccn c on c.id = m.categorie_id;
  drop table public.matrice_risques;
end $$;

-- 6. L'objet à risque n'est plus un scénario ------------------------------------------

do $$
declare
  v_restants integer;
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'objets_a_risque' and column_name = 'declencheur') then
    return;
  end if;
  execute $q$
    select count(*) from public.objets_a_risque
    where coalesce(declencheur, effets_directs, effets_cascade, signaux_faibles,
                   mesures_preventives, mesures_compensatoires, decisions_a_preparer, messages_publics_predefinis) is not null
  $q$ into v_restants;
  if v_restants > 0 then
    raise exception 'objets_a_risque : % objet(s) portent encore un texte de scénario ; à déplacer vers risques_territoire avant de supprimer les colonnes', v_restants;
  end if;
  alter table public.objets_a_risque
    drop column declencheur,
    drop column effets_directs,
    drop column effets_cascade,
    drop column signaux_faibles,
    drop column mesures_preventives,
    drop column mesures_compensatoires,
    drop column decisions_a_preparer,
    drop column messages_publics_predefinis;
end $$;

-- 7. Politiques des tables à double parent ---------------------------------------------

-- Contexte du parent, quel qu'il soit. Security definer : la politique a besoin du
-- contexte même quand l'appelant ne peut pas lire le parent ; a_capacite tranche ensuite.
create or replace function public.contexte_du_parent_risque(p_objet_id uuid, p_risque_id uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select contexte_id from objets_a_risque where id = p_objet_id),
    (select contexte_id from risques_territoire where id = p_risque_id)
  );
$$;
revoke all on function public.contexte_du_parent_risque(uuid, uuid) from public;
grant execute on function public.contexte_du_parent_risque(uuid, uuid) to anon, authenticated, service_role;

drop policy if exists "lecture via objet" on public.plans_action_risque;
drop policy if exists "ecriture via objet" on public.plans_action_risque;
drop policy if exists "modif via objet" on public.plans_action_risque;
drop policy if exists "suppr via objet" on public.plans_action_risque;
drop policy if exists "lecture via parent" on public.plans_action_risque;
drop policy if exists "ecriture via parent" on public.plans_action_risque;
drop policy if exists "modif via parent" on public.plans_action_risque;
drop policy if exists "suppr via parent" on public.plans_action_risque;
create policy "lecture via parent" on public.plans_action_risque
  for select using (public.a_capacite(public.contexte_du_parent_risque(objet_risque_id, risque_id), 'incidents', 'lire'));
create policy "ecriture via parent" on public.plans_action_risque
  for insert with check (public.a_capacite(public.contexte_du_parent_risque(objet_risque_id, risque_id), 'incidents', 'creer'));
create policy "modif via parent" on public.plans_action_risque
  for update using (public.a_capacite(public.contexte_du_parent_risque(objet_risque_id, risque_id), 'incidents', 'modifier'));
create policy "suppr via parent" on public.plans_action_risque
  for delete using (public.a_capacite(public.contexte_du_parent_risque(objet_risque_id, risque_id), 'incidents', 'supprimer'));

drop policy if exists "lecture via objet" on public.evaluations_risque;
drop policy if exists "ecriture via objet" on public.evaluations_risque;
drop policy if exists "modif via objet" on public.evaluations_risque;
drop policy if exists "suppr via objet" on public.evaluations_risque;
drop policy if exists "lecture via parent" on public.evaluations_risque;
drop policy if exists "ecriture via parent" on public.evaluations_risque;
drop policy if exists "modif via parent" on public.evaluations_risque;
drop policy if exists "suppr via parent" on public.evaluations_risque;
create policy "lecture via parent" on public.evaluations_risque
  for select using (public.a_capacite(public.contexte_du_parent_risque(objet_risque_id, risque_id), 'incidents', 'lire'));
create policy "ecriture via parent" on public.evaluations_risque
  for insert with check (public.a_capacite(public.contexte_du_parent_risque(objet_risque_id, risque_id), 'incidents', 'creer'));
create policy "modif via parent" on public.evaluations_risque
  for update using (public.a_capacite(public.contexte_du_parent_risque(objet_risque_id, risque_id), 'incidents', 'modifier'));
create policy "suppr via parent" on public.evaluations_risque
  for delete using (public.a_capacite(public.contexte_du_parent_risque(objet_risque_id, risque_id), 'incidents', 'supprimer'));

drop policy if exists "lecture via objet" on public.mesures_compensatoires_suivi;
drop policy if exists "ecriture via objet" on public.mesures_compensatoires_suivi;
drop policy if exists "modif via objet" on public.mesures_compensatoires_suivi;
drop policy if exists "suppr via objet" on public.mesures_compensatoires_suivi;
drop policy if exists "lecture via parent" on public.mesures_compensatoires_suivi;
drop policy if exists "ecriture via parent" on public.mesures_compensatoires_suivi;
drop policy if exists "modif via parent" on public.mesures_compensatoires_suivi;
drop policy if exists "suppr via parent" on public.mesures_compensatoires_suivi;
create policy "lecture via parent" on public.mesures_compensatoires_suivi
  for select using (public.a_capacite(public.contexte_du_parent_risque(objet_risque_id, risque_id), 'incidents', 'lire'));
create policy "ecriture via parent" on public.mesures_compensatoires_suivi
  for insert with check (public.a_capacite(public.contexte_du_parent_risque(objet_risque_id, risque_id), 'incidents', 'creer'));
create policy "modif via parent" on public.mesures_compensatoires_suivi
  for update using (public.a_capacite(public.contexte_du_parent_risque(objet_risque_id, risque_id), 'incidents', 'modifier'));
create policy "suppr via parent" on public.mesures_compensatoires_suivi
  for delete using (public.a_capacite(public.contexte_du_parent_risque(objet_risque_id, risque_id), 'incidents', 'supprimer'));

-- 8. Ce que chaque table veut dire ----------------------------------------------------

comment on table public.risques_territoire is
  'Risque du territoire : menace potentielle (inondation, cyberattaque, canicule…), distincte de l''objet à risque qui est une particularité localisée du territoire. Porte la fiche de risque (scénario, seuils, plan d''action) et l''évaluation probabilité × impact (ex-matrice_risques).';
comment on column public.risques_territoire.code is
  'Code interne ; préfixe STARTER- pour les fiches du pack de démarrage (sert à ne pas les importer deux fois).';
comment on column public.risques_territoire.statut is
  'a_evaluer : inventorié, pas encore analysé ; retenu : fait l''objet d''une fiche ; ecarte : analysé et non retenu pour la commune.';
comment on table public.objets_a_risque is
  'Particularité localisée du territoire : site Seveso, école, barrage, maison de repos, festival… Source d''un risque ou enjeu exposé (voir objets_a_risque_risques). Les scénarios sont dans risques_territoire.';
comment on table public.objets_a_risque_risques is
  'Lien objet ↔ risque : l''objet est source du risque (le site Seveso génère l''incendie industriel) ou enjeu exposé (l''école est exposée à l''inondation).';
comment on column public.objets_a_risque_risques.role is
  'source : l''objet génère le risque ; enjeu : l''objet y est exposé.';
comment on table public.risques_territoire_fonctions_critiques is
  'Fonctions critiques menacées par un risque (pendant de objets_a_risque_fonctions_critiques).';
comment on column public.seuils_action.risque_id is
  'Risque auquel le seuil se rattache (scénario). objet_risque_id : objet précis. Les deux peuvent être vides (seuil générique) ou renseignés.';
