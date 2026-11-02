-- Briefing 03, partie A — garde-fous des alertes publiques.
--
-- A1. Une alerte reçue d'un organisateur (provenance « externe », écrite par
--     ingestion-alerte-externe) n'est plus jamais publiée d'office : elle arrive
--     inactive, « à valider », une notification part vers les comptes de
--     permanence de la commune (mêmes rôles que le réveil C1), et seule
--     valider_alerte_recue(), réservée à la capacité communication/modifier,
--     peut la publier ou la rejeter. Décision de Ren du 2 novembre 2026.
-- A2. Filet en base : une alerte interne active doit être rattachée à un
--     incident, ou explicitement marquée « hors incident » (prévention, par
--     exemple). Pendant un exercice « dans l'outil » en cours dans la commune,
--     une alerte hors incident exige en plus une confirmation renforcée
--     (« alerte réelle »). Une alerte rattachée à un incident réel n'est jamais
--     bloquée ; une alerte rattachée à un incident d'exercice reste refusée par
--     pas_de_lien_public_avec_exercice (inchangé). Décision de Ren du 2 novembre 2026.
--
-- Ajout seul : aucune donnée existante n'est modifiée. Les alertes déjà en base
-- gardent leur état ; les nouvelles règles ne s'appliquent qu'aux insertions et
-- aux changements d'état (activation, changement d'incident).

-- 1. Colonnes ------------------------------------------------------------------------------

alter table public.alertes_publiques
  add column if not exists statut_reception text,
  add column if not exists recue_le timestamptz,
  add column if not exists decision_par uuid references auth.users(id) on delete set null,
  add column if not exists decision_le timestamptz,
  add column if not exists motif_decision text,
  add column if not exists hors_incident boolean not null default false,
  add column if not exists alerte_reelle_confirmee boolean not null default false,
  add column if not exists confirmee_par uuid references auth.users(id) on delete set null;

alter table public.alertes_publiques
  add constraint alertes_publiques_statut_reception_check
    check (statut_reception is null or statut_reception in ('a_valider', 'validee', 'rejetee')),
  add constraint alertes_publiques_motif_decision_check
    check (motif_decision is null or length(motif_decision) <= 500);

comment on column public.alertes_publiques.statut_reception is
  'Alertes reçues d''un organisateur (provenance externe) : a_valider à la réception, validee ou rejetee par valider_alerte_recue(). Null pour une alerte interne.';
comment on column public.alertes_publiques.hors_incident is
  'Alerte interne volontairement non rattachée à un incident (prévention, par exemple). Sans incident, obligatoire pour publier.';
comment on column public.alertes_publiques.alerte_reelle_confirmee is
  'Confirmation renforcée exigée pour publier une alerte hors incident pendant un exercice « dans l''outil » en cours.';

-- 2. Notifications : nouveau motif --------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_motif_check;
alter table public.notifications
  add constraint notifications_motif_check check (motif in ('reveil', 'escalade', 'alerte_recue'));

-- 3. Règles d'écriture -----------------------------------------------------------------------

-- Exercice « dans l'outil » en cours dans la commune ?
create or replace function public.exercice_dans_outil_en_cours(p_contexte_id uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from exercices e
    where e.contexte_id = p_contexte_id and e.statut = 'en_cours' and e.mode_jeu = 'dans_outil'
  );
$function$;

revoke all on function public.exercice_dans_outil_en_cours(uuid) from public, anon, authenticated;

create or replace function public.alertes_publiques_garde_fous()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_par_validation boolean := coalesce(current_setting('crisiware.validation_alerte', true), '') = 'on';
begin
  -- A1 : alerte reçue d'un organisateur.
  if tg_op = 'INSERT' then
    if new.provenance = 'externe' then
      new.actif := false;
      new.statut_reception := 'a_valider';
      new.recue_le := now();
      new.decision_par := null;
      new.decision_le := null;
      new.motif_decision := null;
    else
      new.statut_reception := null;
    end if;
  else
    if old.provenance is distinct from new.provenance or old.source_externe_id is distinct from new.source_externe_id then
      raise exception 'La provenance d''une alerte ne se modifie pas';
    end if;
    if not v_par_validation and (
         new.statut_reception is distinct from old.statut_reception
         or new.decision_par is distinct from old.decision_par
         or new.decision_le is distinct from old.decision_le
         or new.recue_le is distinct from old.recue_le) then
      raise exception 'La décision sur une alerte reçue passe par « Publier » ou « Rejeter »';
    end if;
  end if;

  if new.provenance = 'externe' and new.actif and new.statut_reception is distinct from 'validee' then
    raise exception 'Alerte reçue d''un organisateur : elle doit être validée par la commune avant publication';
  end if;

  -- A2 : alerte interne publiée (insertion active, activation ou changement d'incident).
  if new.provenance is distinct from 'externe' and new.actif and new.incident_id is null
     and (tg_op = 'INSERT' or not old.actif or old.incident_id is not null
          or old.hors_incident is distinct from new.hors_incident) then
    if not new.hors_incident then
      raise exception 'Rattachez cette alerte à un incident, ou cochez « alerte hors incident » (prévention, par exemple)';
    end if;
    if exercice_dans_outil_en_cours(new.contexte_id) then
      if not new.alerte_reelle_confirmee then
        raise exception 'Un exercice « dans l''outil » est en cours : confirmez explicitement qu''il s''agit d''une alerte réelle, hors exercice';
      end if;
      new.confirmee_par := auth.uid();
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public.alertes_publiques_garde_fous() from public, anon, authenticated;

create or replace trigger alertes_publiques_garde_fous_trg
  before insert or update on public.alertes_publiques
  for each row execute function public.alertes_publiques_garde_fous();

-- Notification de la permanence à la réception (file F2 : rien n'est encore envoyé).
create or replace function public.alertes_publiques_notifier_reception()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.provenance = 'externe' and new.statut_reception = 'a_valider' then
    insert into notifications (contexte_id, destinataire_user_id, canal, motif, titre, message, lien, est_exercice)
    select new.contexte_id, d.user_id, c.canal, 'alerte_recue',
           left('Alerte reçue d''un organisateur, à valider : ' || new.titre, 200),
           left('Reçue à ' || to_char(now() at time zone 'Europe/Brussels', 'HH24:MI')
                || '. Elle n''est pas publiée : relisez-la puis « Publier » ou « Rejeter ».', 2000),
           '/alertes-publiques', false
    from (select distinct user_id from reveil_destinataires(new.contexte_id)) d
    cross join (values ('push'), ('email')) as c(canal);
  end if;
  return null;
end;
$function$;

revoke all on function public.alertes_publiques_notifier_reception() from public, anon, authenticated;

create or replace trigger alertes_publiques_notifier_reception_trg
  after insert on public.alertes_publiques
  for each row execute function public.alertes_publiques_notifier_reception();

-- Fonction de déclencheur existante : jamais appelable directement.
revoke all on function public.pas_de_lien_public_avec_exercice() from public, anon, authenticated;

-- 4. Décision sur une alerte reçue ---------------------------------------------------------

create or replace function public.valider_alerte_recue(p_alerte uuid, p_publier boolean, p_motif text default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_a alertes_publiques%rowtype;
begin
  select * into v_a from alertes_publiques where id = p_alerte for update;
  if not found or not a_capacite(v_a.contexte_id, 'communication', 'modifier') then
    raise exception 'Accès refusé';
  end if;
  if v_a.provenance is distinct from 'externe' or v_a.statut_reception is distinct from 'a_valider' then
    raise exception 'Cette alerte n''attend pas de validation';
  end if;
  if not p_publier and coalesce(btrim(p_motif), '') = '' then
    raise exception 'Indiquez le motif du rejet';
  end if;

  perform set_config('crisiware.validation_alerte', 'on', true);
  update alertes_publiques
     set statut_reception = case when p_publier then 'validee' else 'rejetee' end,
         actif = p_publier,
         date_publication = case when p_publier then now() else date_publication end,
         decision_par = auth.uid(),
         decision_le = now(),
         motif_decision = nullif(left(btrim(coalesce(p_motif, '')), 500), '')
   where id = p_alerte;
  perform set_config('crisiware.validation_alerte', 'off', true);
end;
$function$;

revoke all on function public.valider_alerte_recue(uuid, boolean, text) from public, anon;
grant execute on function public.valider_alerte_recue(uuid, boolean, text) to authenticated;
