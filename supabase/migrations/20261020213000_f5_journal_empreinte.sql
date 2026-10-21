-- F5 Journal immuable : références et empreinte chaînée sur journal_decisions.
--
-- Existant conservé : ajout seul (journal_decisions_ajout_seul refuse UPDATE et
-- TRUNCATE ; DELETE toléré pour les seules entrées d'exercice), horodatage client
-- (decide_le) et serveur (enregistre_le), auteur forcé (enregistre_par),
-- numérotation sous verrou, corrections chaînées (precedente_id).
--
-- Ajouts :
--   1. Références vers un signalement citoyen et une alerte publique de la même
--      commune (et du même incident quand ils y sont rattachés). La référence
--      « message » attend le choix de la source unique des messages (question
--      ouverte 8 de docs/roadmap/ETAT.md).
--   2. Empreinte SHA-256 de chaque entrée, calculée par le serveur à l'insertion,
--      qui inclut l'empreinte de l'entrée précédente du même incident.
--   3. verifier_journal_decisions(incident) : recalcule la chaîne et renvoie la
--      première anomalie (null si la chaîne est intègre).
-- Les entrées antérieures restent sans empreinte : la chaîne commence à la
-- première entrée enregistrée après cette migration.

-- 1. Références ------------------------------------------------------------------

alter table public.journal_decisions
  add column if not exists signalement_id uuid references public.signalements_citoyens(id),
  add column if not exists alerte_publique_id uuid references public.alertes_publiques(id),
  add column if not exists empreinte_precedente text,
  add column if not exists empreinte text;

create index if not exists journal_decisions_signalement_idx
  on public.journal_decisions (signalement_id) where signalement_id is not null;
create index if not exists journal_decisions_alerte_idx
  on public.journal_decisions (alerte_publique_id) where alerte_publique_id is not null;

-- 2. Empreinte --------------------------------------------------------------------

create or replace function public.journal_decisions_empreinte(j public.journal_decisions)
 returns text
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  -- Forme canonique : tableau JSON des champs dans un ordre fixe, dates en UTC.
  select encode(extensions.digest(convert_to(jsonb_build_array(
    j.id, j.contexte_id, j.incident_id, j.numero_ordre, j.nature, j.precedente_id,
    j.decision, j.base_decision, j.decide_par,
    to_char(j.decide_le at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    to_char(j.echeance at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    j.motif, j.declenchement_seuil_id, j.activation_nucleaire_id, j.livre_de_bord_id,
    j.signalement_id, j.alerte_publique_id, j.est_exercice, j.enregistre_par,
    to_char(j.enregistre_le at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    j.empreinte_precedente
  )::text, 'UTF8'), 'sha256'), 'hex');
$function$;

revoke all on function public.journal_decisions_empreinte(public.journal_decisions) from public, anon;
grant execute on function public.journal_decisions_empreinte(public.journal_decisions) to authenticated, service_role;

create or replace function public.journal_decisions_avant_insertion()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_contexte uuid;
  v_exercice boolean;
begin
  select i.contexte_id, i.est_exercice into v_contexte, v_exercice
    from public.incidents i where i.id = new.incident_id;
  if v_contexte is null then
    raise exception 'Incident introuvable';
  end if;

  new.contexte_id := v_contexte;
  new.est_exercice := v_exercice;
  new.enregistre_par := auth.uid();
  new.enregistre_le := clock_timestamp();

  if new.decide_le > new.enregistre_le + interval '1 minute' then
    raise exception 'La date de la décision ne peut pas être dans le futur';
  end if;

  if new.precedente_id is not null and not exists (
    select 1 from public.journal_decisions d where d.id = new.precedente_id and d.incident_id = new.incident_id
  ) then
    raise exception 'La décision corrigée ou réexaminée doit appartenir au même incident';
  end if;

  if new.declenchement_seuil_id is not null and not exists (
    select 1 from public.declenchements_seuils_action s where s.id = new.declenchement_seuil_id and s.incident_id = new.incident_id
  ) then
    raise exception 'Le déclenchement de seuil lié doit appartenir au même incident';
  end if;

  if new.activation_nucleaire_id is not null and not exists (
    select 1 from public.activations_plan_nucleaire a where a.id = new.activation_nucleaire_id and a.incident_id = new.incident_id
  ) then
    raise exception 'L''activation du plan nucléaire liée doit appartenir au même incident';
  end if;

  if new.livre_de_bord_id is not null and not exists (
    select 1 from public.livre_de_bord l where l.id = new.livre_de_bord_id and l.incident_id = new.incident_id
  ) then
    raise exception 'L''entrée du livre de bord liée doit appartenir au même incident';
  end if;

  if new.signalement_id is not null and not exists (
    select 1 from public.signalements_citoyens s
    where s.id = new.signalement_id and s.contexte_id = v_contexte
      and (s.incident_id is null or s.incident_id = new.incident_id)
  ) then
    raise exception 'Le signalement lié doit appartenir à la même commune et au même incident';
  end if;

  if new.alerte_publique_id is not null and not exists (
    select 1 from public.alertes_publiques a
    where a.id = new.alerte_publique_id and a.contexte_id = v_contexte
      and (a.incident_id is null or a.incident_id = new.incident_id)
  ) then
    raise exception 'L''alerte publique liée doit appartenir à la même commune et au même incident';
  end if;

  perform pg_advisory_xact_lock(hashtext('journal_decisions:' || new.incident_id::text));
  select coalesce(max(d.numero_ordre), 0) + 1 into new.numero_ordre
    from public.journal_decisions d where d.incident_id = new.incident_id;

  -- Empreinte chaînée : celle de l'entrée précédente du même incident (sous le
  -- même verrou que la numérotation), puis celle de la nouvelle entrée. Une
  -- valeur fournie par le client est toujours remplacée.
  select d.empreinte into new.empreinte_precedente
    from public.journal_decisions d
    where d.incident_id = new.incident_id and d.numero_ordre = new.numero_ordre - 1;
  new.empreinte := public.journal_decisions_empreinte(new);

  return new;
end
$function$;

-- 3. Vérification -----------------------------------------------------------------

-- Droits de l'appelant : ne voit que les journaux qu'il peut lire.
create or replace function public.verifier_journal_decisions(p_incident_id uuid)
 returns table(nb_entrees integer, nb_scellees integer, premiere_anomalie integer, derniere_empreinte text)
 language plpgsql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v public.journal_decisions;
  v_precedente text;
begin
  nb_entrees := 0;
  nb_scellees := 0;
  for v in
    select * from public.journal_decisions j where j.incident_id = p_incident_id order by j.numero_ordre
  loop
    nb_entrees := nb_entrees + 1;
    if v.empreinte is not null then
      nb_scellees := nb_scellees + 1;
      if premiere_anomalie is null and (
           v.empreinte_precedente is distinct from v_precedente
        or v.empreinte <> public.journal_decisions_empreinte(v)
      ) then
        premiere_anomalie := v.numero_ordre;
      end if;
      derniere_empreinte := v.empreinte;
    end if;
    v_precedente := v.empreinte;
  end loop;
  return next;
end;
$function$;

revoke all on function public.verifier_journal_decisions(uuid) from public, anon;
grant execute on function public.verifier_journal_decisions(uuid) to authenticated, service_role;
