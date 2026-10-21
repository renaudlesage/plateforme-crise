-- C1 Réveil automatique, deuxième partie : le moteur. Suppose appliquée
-- 20261021090000_c1_alertes_externes_regles_reveil.sql.
-- Décisions de Ren du 2026-10-21 :
--   - réveiller les comptes qui portent les rôles PLANU (fonctionnaire
--     planification urgence) et AUTORITE_COMMUNALE (bourgmestre), par push et
--     e-mail, puis les suppléants de l'annuaire par e-mail si personne n'a
--     acquitté après 15 minutes ;
--   - n'armer que le seuil le plus élevé de chaque fiche ;
--   - une fixture crée un événement d'exercice, une saisie manuelle un
--     événement réel.
--
-- Contenu :
--   1. parametres_reveil : par commune, rôles à réveiller et délai d'escalade
--      (valeurs par défaut ci-dessus si la commune n'a rien encodé).
--   2. declenchements_seuils_action.alerte_externe_id : avertissement qui a
--      armé le seuil (non modifiable depuis l'API).
--   3. reveils : un réveil par seuil armé, avec acquittement « Vu, je prends »
--      et escalade.
--   4. notifications : file et journal des envois internes (F2). Rien n'est
--      encore envoyé : l'envoi push et e-mail viendra avec F2 (questions 3, 4).
--   5. alertes_externes_traitements : passage de chaque avertissement dans le
--      moteur (nombre de réveils ou erreur) ; une erreur du moteur n'empêche
--      jamais d'enregistrer l'avertissement.
--   6. reveil_traiter_alerte (moteur, lancé à l'insertion d'un avertissement),
--      acquitter_reveil (RPC), reveil_escalader (tâche de chaque minute).
--   7. Tâche planifiée reveil_escalade, déclarée dans jobs_etat.
-- Le moteur ne renvoie un réveil que si le niveau monte pour la fiche tant que
-- l'événement est ouvert ; il rattache l'avertissement à l'événement ouvert qui
-- suit déjà la fiche (même avertissement mis à jour, ou seuil de la même fiche
-- déclenché), sinon il ouvre un événement en veille (statut pré-alerte, phase
-- veille : ni proposition vers Eventware, ni ouverture des signalements).

-- 1. parametres_reveil ------------------------------------------------------------------

create table if not exists public.parametres_reveil (
  contexte_id uuid primary key references public.contextes(id) on delete cascade,
  roles_a_reveiller text[] not null default array['PLANU', 'AUTORITE_COMMUNALE']
    check (cardinality(roles_a_reveiller) between 1 and 20),
  delai_escalade interval not null default interval '15 minutes'
    check (delai_escalade between interval '1 minute' and interval '24 hours'),
  maj_le timestamptz not null default now(),
  maj_par uuid
);

comment on table public.parametres_reveil is
  'Réveil automatique (C1), par commune : codes des rôles à réveiller et délai avant escalade vers les suppléants. Sans ligne : PLANU et AUTORITE_COMMUNALE, 15 minutes.';

create or replace function public.parametres_reveil_avant_ecriture()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  new.maj_le := now();
  new.maj_par := auth.uid();
  return new;
end;
$function$;

revoke all on function public.parametres_reveil_avant_ecriture() from public, anon, authenticated;

create or replace trigger parametres_reveil_avant_ecriture_trg
  before insert or update on public.parametres_reveil
  for each row execute function public.parametres_reveil_avant_ecriture();

alter table public.parametres_reveil enable row level security;
revoke all on public.parametres_reveil from public, anon;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'parametres_reveil' and policyname = 'lecture si membre') then
    create policy "lecture si membre" on public.parametres_reveil
      for select to authenticated using (a_capacite(contexte_id, 'referentiels', 'lire'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'parametres_reveil' and policyname = 'ecriture si ecriture') then
    create policy "ecriture si ecriture" on public.parametres_reveil
      for insert to authenticated with check (a_capacite(contexte_id, 'referentiels', 'creer'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'parametres_reveil' and policyname = 'modif si ecriture') then
    create policy "modif si ecriture" on public.parametres_reveil
      for update to authenticated using (a_capacite(contexte_id, 'referentiels', 'modifier'));
  end if;
end $$;

-- 2. declenchements_seuils_action.alerte_externe_id ------------------------------------

alter table public.declenchements_seuils_action
  add column if not exists alerte_externe_id uuid references public.alertes_externes(id) on delete set null;

comment on column public.declenchements_seuils_action.alerte_externe_id is
  'Avertissement officiel qui a armé ce seuil (réveil automatique, C1) ; null pour un déclenchement manuel';

-- Droits de l'appelant : seul le moteur (propriétaire) renseigne ce lien.
create or replace function public.declenchements_alerte_externe_garde()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      if new.alerte_externe_id is not null then
        raise exception 'Le lien vers l''avertissement est fixé par le réveil automatique' using errcode = '42501';
      end if;
    elsif new.alerte_externe_id is distinct from old.alerte_externe_id then
      raise exception 'Le lien vers l''avertissement est fixé par le réveil automatique' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.declenchements_alerte_externe_garde() from public, anon, authenticated;

create or replace trigger declenchements_alerte_externe_garde_trg
  before insert or update on public.declenchements_seuils_action
  for each row execute function public.declenchements_alerte_externe_garde();

-- 3. reveils -----------------------------------------------------------------------------------

create table if not exists public.reveils (
  id uuid primary key default gen_random_uuid(),
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  declenchement_id uuid not null references public.declenchements_seuils_action(id) on delete cascade,
  alerte_externe_id uuid not null references public.alertes_externes(id) on delete cascade,
  source text not null,
  fil text not null,
  seuil_action_id uuid not null references public.seuils_action(id) on delete cascade,
  niveau text not null check (niveau in ('jaune', 'orange', 'rouge')),
  est_exercice boolean not null,
  arme_le timestamptz not null default now(),
  acquitte_le timestamptz,
  acquitte_par uuid,
  escalade_le timestamptz,
  constraint reveils_acquittement check ((acquitte_le is null) = (acquitte_par is null))
);

comment on table public.reveils is
  'Réveils (C1) : un seuil armé par un avertissement, à acquitter (« Vu, je prends ») ; sans acquittement, escalade vers les suppléants';
comment on column public.reveils.arme_le is 'Heure du serveur à laquelle le seuil a été armé et les destinataires mis en file';
comment on column public.reveils.acquitte_le is 'Heure du serveur de l''acquittement : répond à « à quelle heure avez-vous pris l''alerte ? »';

create index if not exists reveils_fiche_idx on public.reveils (contexte_id, seuil_action_id);
create index if not exists reveils_incident_idx on public.reveils (incident_id);
create index if not exists reveils_a_escalader_idx on public.reveils (arme_le) where acquitte_le is null and escalade_le is null;

alter table public.reveils enable row level security;
revoke all on public.reveils from public, anon, authenticated;
grant select on public.reveils to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reveils' and policyname = 'lecture si membre') then
    create policy "lecture si membre" on public.reveils
      for select to authenticated using (a_acces(contexte_id, 'lecture'));
  end if;
end $$;

-- 4. notifications (F2) ----------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  contexte_id uuid not null references public.contextes(id) on delete cascade,
  reveil_id uuid references public.reveils(id) on delete cascade,
  destinataire_user_id uuid references auth.users(id) on delete cascade,
  destinataire_contact_id uuid references public.contacts(id) on delete cascade,
  canal text not null check (canal in ('push', 'email')),
  motif text not null check (motif in ('reveil', 'escalade')),
  titre text not null check (length(titre) <= 200),
  message text not null check (length(message) <= 2000),
  lien text check (length(lien) <= 500),
  est_exercice boolean not null default false,
  statut text not null default 'a_envoyer' check (statut in ('a_envoyer', 'envoye', 'echec', 'sans_canal')),
  cree_le timestamptz not null default now(),
  envoye_le timestamptz,
  tentatives integer not null default 0,
  erreur text check (length(erreur) <= 2000),
  constraint notifications_destinataire check (num_nonnulls(destinataire_user_id, destinataire_contact_id) = 1)
);

comment on table public.notifications is
  'Notifications internes (F2) : file d''envoi et journal (push, e-mail), une ligne par destinataire et par canal ; écrite par le serveur seulement. Aucune adresse n''y est copiée : elle est lue au moment de l''envoi.';
comment on column public.notifications.statut is 'a_envoyer, envoye, echec, ou sans_canal (pas d''abonnement push ou pas d''adresse)';

create index if not exists notifications_a_envoyer_idx on public.notifications (cree_le) where statut = 'a_envoyer';
create index if not exists notifications_reveil_idx on public.notifications (reveil_id);
create index if not exists notifications_destinataire_idx on public.notifications (destinataire_user_id, cree_le desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'lecture : destinataire ou membre de la commune') then
    create policy "lecture : destinataire ou membre de la commune" on public.notifications
      for select to authenticated using (destinataire_user_id = auth.uid() or a_acces(contexte_id, 'lecture'));
  end if;
end $$;

-- 5. alertes_externes_traitements -------------------------------------------------------------

create table if not exists public.alertes_externes_traitements (
  alerte_externe_id uuid primary key references public.alertes_externes(id) on delete cascade,
  traite_le timestamptz not null default now(),
  nb_reveils integer not null default 0,
  erreur text check (length(erreur) <= 2000)
);

comment on table public.alertes_externes_traitements is
  'Passage de chaque avertissement dans le moteur de réveil : nombre de réveils créés, ou erreur (l''avertissement reste enregistré)';

alter table public.alertes_externes_traitements enable row level security;
revoke all on public.alertes_externes_traitements from public, anon, authenticated;
grant select on public.alertes_externes_traitements to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'alertes_externes_traitements' and policyname = 'lecture si l''avertissement est visible') then
    create policy "lecture si l'avertissement est visible" on public.alertes_externes_traitements
      for select to authenticated using (exists (select 1 from alertes_externes a where a.id = alerte_externe_id));
  end if;
end $$;

-- 6. Fonctions ----------------------------------------------------------------------------------

-- Comptes à réveiller : rôles encodés par la commune, sinon PLANU et AUTORITE_COMMUNALE.
create or replace function public.reveil_destinataires(p_contexte_id uuid)
 returns table(user_id uuid, role_code text, role_libelle text)
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select distinct au.user_id, r.code, r.libelle
  from acces_utilisateurs au
  join roles r on r.id = au.role_id
  where au.contexte_id = p_contexte_id
    and r.code = any(coalesce((select p.roles_a_reveiller from parametres_reveil p where p.contexte_id = p_contexte_id),
                              array['PLANU', 'AUTORITE_COMMUNALE']));
$function$;

revoke all on function public.reveil_destinataires(uuid) from public, anon, authenticated;

create or replace function public.reveil_traiter_alerte(p_alerte_id uuid)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  a alertes_externes%rowtype;
  m record;
  v_rang integer;
  v_exercice boolean;
  v_type text;
  v_source text;
  v_heure text;
  v_incident uuid;
  v_commune text;
  v_declenchement uuid;
  v_reveil uuid;
  v_titre text;
  v_nb integer := 0;
begin
  select * into a from alertes_externes where id = p_alerte_id;
  if not found then
    raise exception 'Avertissement introuvable' using errcode = 'P0002';
  end if;
  if a.statut_cap <> 'Actual' or a.type_message = 'Cancel' or a.niveau = 'vert' then
    return 0;
  end if;

  v_rang := case a.niveau when 'rouge' then 3 when 'orange' then 2 else 1 end;
  v_exercice := a.source = 'fixture';
  v_type := case a.type_alerte when 'orage' then 'orages' when 'neige_verglas' then 'neige ou verglas' when 'autre' then 'météo'
                               else a.type_alerte end;
  v_source := case a.source when 'irm' then 'IRM' when 'meteoalarm' then 'IRM via MeteoAlarm'
                            when 'saisie' then 'saisie manuelle' else 'fixture de démonstration' end;
  v_heure := to_char(a.recu_le at time zone 'Europe/Brussels', 'HH24:MI');

  -- Seuil le plus élevé de chaque fiche parmi les règles armées.
  for m in
    select distinct on (r.contexte_id, coalesce(s.risque_id, s.objet_risque_id, s.id))
           r.contexte_id, s.id as seuil_id, s.libelle as seuil_libelle,
           coalesce(s.risque_id, s.objet_risque_id, s.id) as fiche
    from regles_reveil_correspondantes(p_alerte_id) r
    join seuils_action s on s.id = r.seuil_action_id
    order by r.contexte_id, coalesce(s.risque_id, s.objet_risque_id, s.id), s.ordre desc
  loop
    -- Pas de nouveau réveil si un événement ouvert a déjà été réveillé pour cette fiche à ce niveau ou plus haut.
    if exists (
      select 1 from reveils v
      join seuils_action s2 on s2.id = v.seuil_action_id
      join incidents i on i.id = v.incident_id
      where v.contexte_id = m.contexte_id and v.est_exercice = v_exercice and i.statut <> 'cloture'
        and coalesce(s2.risque_id, s2.objet_risque_id, s2.id) = m.fiche
        and (case v.niveau when 'rouge' then 3 when 'orange' then 2 else 1 end) >= v_rang
    ) then
      continue;
    end if;

    -- Événement ouvert par ce même avertissement (mise à jour), sinon événement ouvert qui suit déjà la fiche.
    v_incident := null;
    select v.incident_id into v_incident
    from reveils v join incidents i on i.id = v.incident_id
    where v.contexte_id = m.contexte_id and v.source = a.source and v.fil = a.fil
      and v.est_exercice = v_exercice and i.statut <> 'cloture'
    order by v.arme_le desc
    limit 1;
    if v_incident is null then
      select i.id into v_incident
      from incidents i
      join declenchements_seuils_action d on d.incident_id = i.id
      join seuils_action s2 on s2.id = d.seuil_action_id
      where i.contexte_id = m.contexte_id and i.statut <> 'cloture' and i.est_exercice = v_exercice
        and coalesce(s2.risque_id, s2.objet_risque_id, s2.id) = m.fiche
      order by i.date_debut desc
      limit 1;
    end if;
    if v_incident is null then
      insert into incidents (contexte_id, nom, type_evenement, statut, phase_cycle_vie, dynamique_evenement, est_exercice)
      values (m.contexte_id,
              left('Veille — avertissement ' || a.niveau || ' ' || v_type
                   || coalesce(' (' || nullif(array_to_string(a.provinces, ', '), '') || ')', ''), 200),
              'Météo', 'pre_alerte', 'veille', 'previsible', v_exercice)
      returning id into v_incident;
    end if;

    v_declenchement := null;
    select d.id into v_declenchement
    from declenchements_seuils_action d
    where d.incident_id = v_incident and d.seuil_action_id = m.seuil_id and d.statut = 'en_attente'
    order by d.horodatage_declenchement desc
    limit 1;
    if v_declenchement is null then
      insert into declenchements_seuils_action (incident_id, seuil_action_id, statut, alerte_externe_id)
      values (v_incident, m.seuil_id, 'en_attente', a.id)
      returning id into v_declenchement;
    end if;

    insert into reveils (contexte_id, incident_id, declenchement_id, alerte_externe_id, source, fil, seuil_action_id, niveau, est_exercice)
    values (m.contexte_id, v_incident, v_declenchement, a.id, a.source, a.fil, m.seuil_id, a.niveau, v_exercice)
    returning id into v_reveil;

    insert into journal_decisions (incident_id, decision, base_decision, decide_par, decide_le, declenchement_seuil_id)
    values (v_incident,
            'Seuil « ' || m.seuil_libelle || ' » armé automatiquement',
            'Avertissement ' || a.niveau || ' ' || v_type || ' reçu à ' || v_heure || ' (' || v_source
              || ', émis à ' || to_char(a.emis_le at time zone 'Europe/Brussels', 'HH24:MI') || ')',
            'Réveil automatique', now(), v_declenchement);

    select c.nom into v_commune from contextes c where c.id = m.contexte_id;
    v_titre := case when v_exercice then 'EXERCICE — ' else '' end || 'Réveil : avertissement ' || a.niveau || ' ' || v_type;
    insert into notifications (contexte_id, reveil_id, destinataire_user_id, canal, motif, titre, message, lien, est_exercice)
    select m.contexte_id, v_reveil, d.user_id, c.canal, 'reveil', left(v_titre, 200),
           left('Reçu à ' || v_heure || ' (' || v_source || '). Seuil « ' || m.seuil_libelle || ' » armé pour ' || v_commune
                || '. Ouvrez la checklist et répondez « Vu, je prends ».', 2000),
           '/incidents/' || v_incident, v_exercice
    from reveil_destinataires(m.contexte_id) d
    cross join (values ('push'), ('email')) as c(canal);

    v_nb := v_nb + 1;
  end loop;
  return v_nb;
end;
$function$;

revoke all on function public.reveil_traiter_alerte(uuid) from public, anon, authenticated;
grant execute on function public.reveil_traiter_alerte(uuid) to service_role;

-- Lancé après l'insertion d'un avertissement (flux, saisie, fixture) ; une erreur est tracée, jamais bloquante.
create or replace function public.alertes_externes_apres_insertion()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_nb integer;
begin
  begin
    v_nb := reveil_traiter_alerte(new.id);
    insert into alertes_externes_traitements (alerte_externe_id, nb_reveils) values (new.id, v_nb);
  exception when others then
    insert into alertes_externes_traitements (alerte_externe_id, nb_reveils, erreur) values (new.id, 0, left(sqlerrm, 2000));
    raise warning 'Réveil automatique, avertissement % : %', new.id, sqlerrm;
  end;
  return null;
end;
$function$;

revoke all on function public.alertes_externes_apres_insertion() from public, anon, authenticated;

create or replace trigger alertes_externes_apres_insertion_trg
  after insert on public.alertes_externes
  for each row execute function public.alertes_externes_apres_insertion();

-- « Vu, je prends » : un destinataire du réveil ou un membre « écriture » de la commune ; le premier acquittement compte.
create or replace function public.acquitter_reveil(p_reveil_id uuid)
 returns table(acquitte_le timestamptz, acquitte_par uuid, deja_acquitte boolean)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v reveils%rowtype;
  v_role text;
begin
  select * into v from reveils r where r.id = p_reveil_id;
  if not found or auth.uid() is null
     or not (a_acces(v.contexte_id, 'ecriture')
             or exists (select 1 from reveil_destinataires(v.contexte_id) d where d.user_id = auth.uid())) then
    raise exception 'Réveil introuvable ou accès refusé' using errcode = '42501';
  end if;

  update reveils r set acquitte_le = now(), acquitte_par = auth.uid()
  where r.id = p_reveil_id and r.acquitte_le is null;
  if not found then
    select * into v from reveils r where r.id = p_reveil_id;
    return query select v.acquitte_le, v.acquitte_par, true;
    return;
  end if;

  select ro.libelle into v_role
  from acces_utilisateurs au join roles ro on ro.id = au.role_id
  where au.user_id = auth.uid() and au.contexte_id = v.contexte_id
  limit 1;
  insert into journal_decisions (incident_id, decision, base_decision, decide_par, decide_le, declenchement_seuil_id)
  values (v.incident_id, 'Réveil acquitté : « Vu, je prends »',
          'Seuil armé à ' || to_char(v.arme_le at time zone 'Europe/Brussels', 'HH24:MI')
            || ', acquitté à ' || to_char(now() at time zone 'Europe/Brussels', 'HH24:MI'),
          coalesce(v_role, 'Membre de la cellule'), now(), v.declenchement_id);
  return query select now(), auth.uid(), false;
end;
$function$;

revoke all on function public.acquitter_reveil(uuid) from public, anon;
grant execute on function public.acquitter_reveil(uuid) to authenticated;

-- Tâche de chaque minute : réveils non acquittés après le délai → suppléants prévenus par e-mail, entrée au journal.
create or replace function public.reveil_escalader()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v record;
  v_nb integer := 0;
begin
  for v in
    select r.id, r.contexte_id, r.incident_id, r.declenchement_id, r.arme_le, r.est_exercice, s.libelle as seuil_libelle,
           coalesce(p.delai_escalade, interval '15 minutes') as delai,
           coalesce(p.roles_a_reveiller, array['PLANU', 'AUTORITE_COMMUNALE']) as roles
    from reveils r
    join seuils_action s on s.id = r.seuil_action_id
    left join parametres_reveil p on p.contexte_id = r.contexte_id
    where r.acquitte_le is null and r.escalade_le is null
      and r.arme_le + coalesce(p.delai_escalade, interval '15 minutes') <= now()
    for update of r skip locked
  loop
    update reveils set escalade_le = now() where id = v.id;

    insert into notifications (contexte_id, reveil_id, destinataire_contact_id, canal, motif, titre, message, lien, est_exercice)
    select v.contexte_id, v.id, sup.id, 'email', 'escalade',
           left(case when v.est_exercice then 'EXERCICE — ' else '' end || 'Réveil non acquitté : ' || v.seuil_libelle, 200),
           left('Seuil « ' || v.seuil_libelle || ' » armé à ' || to_char(v.arme_le at time zone 'Europe/Brussels', 'HH24:MI')
                || ', sans réponse des titulaires après ' || (extract(epoch from v.delai) / 60)::integer
                || ' min. Vous êtes leur suppléant : prenez le relais.', 2000),
           '/incidents/' || v.incident_id, v.est_exercice
    from contacts sup
    join contacts titulaire on titulaire.id = sup.est_suppleant_de
    join roles ro on ro.id = titulaire.role_id
    where sup.contexte_id = v.contexte_id and titulaire.contexte_id = v.contexte_id
      and sup.actif and ro.code = any(v.roles);

    insert into journal_decisions (incident_id, decision, base_decision, decide_par, decide_le, declenchement_seuil_id)
    values (v.incident_id, 'Escalade : réveil non acquitté, suppléants prévenus',
            'Seuil « ' || v.seuil_libelle || ' » armé à ' || to_char(v.arme_le at time zone 'Europe/Brussels', 'HH24:MI')
              || ', sans acquittement après ' || (extract(epoch from v.delai) / 60)::integer || ' min',
            'Réveil automatique', now(), v.declenchement_id);
    v_nb := v_nb + 1;
  end loop;

  perform jobs_signaler('reveil_escalade', true);
  return v_nb;
exception when others then
  perform jobs_signaler('reveil_escalade', false, sqlerrm);
  return -1;
end;
$function$;

revoke all on function public.reveil_escalader() from public, anon, authenticated;

-- 7. Tâche planifiée -----------------------------------------------------------------------------

insert into public.jobs_etat (nom, description, silence_max)
values ('reveil_escalade', 'Réveil automatique (C1) : escalade des réveils non acquittés, chaque minute', interval '10 minutes')
on conflict (nom) do nothing;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'reveil_escalade') then
    perform cron.schedule('reveil_escalade', '* * * * *', 'select public.reveil_escalader()');
  end if;
end $$;

notify pgrst, 'reload schema';
