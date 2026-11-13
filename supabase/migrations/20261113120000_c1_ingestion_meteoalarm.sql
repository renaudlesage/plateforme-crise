-- C1, fin de la session 1 et règles par défaut (question 15, partie orages) — ingestion du flux MeteoAlarm Belgique.
--
-- Flux vérifié le 13/11/2026 depuis la base (extensions.http_get) : flux Atom « legacy », une entrée par message et par
-- zone, lien vers le message CAP 1.2 de l'IRM (quatre langues, awareness_level et awareness_type). Lecture par l'Edge
-- Function ingest-meteoalarm (supabase/functions/ingest-meteoalarm), appelée toutes les 10 minutes par pg_cron et pg_net.
--
-- 1. jobs_etat : tâche ingest_meteoalarm (muette après 40 minutes sans succès), lisible par tout membre connecté : l'onglet
--    Avertissements dit si le flux est à jour (dette relevée le 21/10). Aucune autre tâche de la plateforme n'est exposée.
-- 2. meteoalarm_reserver() : un passage au plus toutes les 4 minutes. L'Edge Function s'appelle sans jeton ; un appel en
--    trop est refusé avant toute lecture du flux.
-- 3. meteoalarm_ingerer(lignes) : insère le lot (doublons ignorés), puis ne lance le moteur de réveil que sur le dernier
--    message de chaque fil, et seulement s'il n'est pas expiré : au premier passage, le flux contient des messages anciens
--    ou déjà remplacés par une mise à jour, qui ne doivent réveiller personne.
-- 4. alertes_externes_apres_insertion : inchangée, sauf pendant un lot d'ingestion (le lot traite lui-même ses messages).
-- 5. Tâche pg_cron ingest_meteoalarm, toutes les 10 minutes.
-- 6. regles_reveil_modeles : règles par défaut des fiches (données, pas de code), et regles_reveil_proposees() /
--    appliquer_regles_reveil_modeles() pour qu'une commune les reprenne depuis Admin › Réveil automatique. Deux modèles,
--    tirés du texte des seuils de la fiche orages (STARTER-REX-2026-ORAGES) ; rien pour la canicule, qui n'a pas de seuil
--    (question 15 toujours ouverte).

-- 1. État du flux -------------------------------------------------------------------------------------------------

insert into public.jobs_etat (nom, description, silence_max)
values ('ingest_meteoalarm', 'Flux MeteoAlarm Belgique (avertissements de l''IRM), lu toutes les 10 minutes', interval '40 minutes')
on conflict (nom) do nothing;

create policy "lecture de l'état du flux météo par les membres" on public.jobs_etat
  for select to authenticated
  using (contexte_id is null and nom = 'ingest_meteoalarm');

-- 2. Un passage au plus toutes les 4 minutes ------------------------------------------------------------------------

create or replace function public.meteoalarm_reserver()
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  update jobs_etat set dernier_lancement_le = now()
   where nom = 'ingest_meteoalarm' and actif
     and (dernier_lancement_le is null or dernier_lancement_le < now() - interval '4 minutes');
  return found;
end;
$function$;

revoke all on function public.meteoalarm_reserver() from public, anon, authenticated;
grant execute on function public.meteoalarm_reserver() to service_role;

-- 3 et 4. Lot d'ingestion ----------------------------------------------------------------------------------------------

create or replace function public.alertes_externes_apres_insertion()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_nb integer;
begin
  -- Lot d'ingestion du flux : meteoalarm_ingerer traite lui-même le dernier message de chaque fil, après le lot.
  if current_setting('crisiware.lot_ingestion', true) = 'on' then
    return null;
  end if;
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

create or replace function public.meteoalarm_ingerer(p_lignes jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v jsonb;
  v_id uuid;
  v_ids uuid[] := '{}';
  v_nb integer;
  v_traites integer := 0;
  v_reveils integer := 0;
  v_ignores integer := 0;
  a record;
begin
  if jsonb_typeof(p_lignes) is distinct from 'array' or jsonb_array_length(p_lignes) > 1000 then
    raise exception 'Lot invalide (liste de 1000 lignes au plus attendue)';
  end if;

  perform set_config('crisiware.lot_ingestion', 'on', true);
  for v in
    select value from jsonb_array_elements(p_lignes)
    order by (value ->> 'emis_le')::timestamptz, (value ->> 'segment')::integer
  loop
    v_id := null;
    insert into alertes_externes (source, identifiant, segment, expediteur, emis_le, statut_cap, type_message, portee,
                                  references_cap, langue, evenement, type_alerte, niveau, severite, urgence, certitude,
                                  debut_le, fin_le, titre, description, consignes, zones, provinces, lien, cap_brut)
    values ('meteoalarm', v ->> 'identifiant', (v ->> 'segment')::smallint, v ->> 'expediteur', (v ->> 'emis_le')::timestamptz,
            v ->> 'statut_cap', v ->> 'type_message', v ->> 'portee',
            coalesce((select array_agg(x) from jsonb_array_elements_text(v -> 'references_cap') x), '{}'),
            coalesce(v ->> 'langue', 'fr'), v ->> 'evenement', v ->> 'type_alerte', v ->> 'niveau',
            v ->> 'severite', v ->> 'urgence', v ->> 'certitude',
            coalesce((v ->> 'debut_le')::timestamptz, (v ->> 'emis_le')::timestamptz), (v ->> 'fin_le')::timestamptz,
            v ->> 'titre', v ->> 'description', v ->> 'consignes', coalesce(v -> 'zones', '[]'::jsonb),
            coalesce((select array_agg(x) from jsonb_array_elements_text(v -> 'provinces') x), '{}'),
            v ->> 'lien', v ->> 'cap_brut')
    on conflict (source, identifiant, segment) do nothing
    returning id into v_id;
    if v_id is not null then
      v_ids := v_ids || v_id;
    end if;
  end loop;
  perform set_config('crisiware.lot_ingestion', 'off', true);

  -- Moteur de réveil : dernier message de chaque fil, non expiré. Les autres sont gardés pour l'historique du fil.
  for a in
    select x.id, x.source, x.fil, x.emis_le, x.fin_le from alertes_externes x
    where x.id = any (v_ids) order by x.emis_le, x.segment
  loop
    if (a.fin_le is null or a.fin_le > now())
       and not exists (select 1 from alertes_externes b where b.source = a.source and b.fil = a.fil and b.emis_le > a.emis_le) then
      begin
        v_nb := reveil_traiter_alerte(a.id);
        insert into alertes_externes_traitements (alerte_externe_id, nb_reveils) values (a.id, v_nb);
        v_reveils := v_reveils + v_nb;
      exception when others then
        insert into alertes_externes_traitements (alerte_externe_id, nb_reveils, erreur) values (a.id, 0, left(sqlerrm, 2000));
      end;
      v_traites := v_traites + 1;
    else
      v_ignores := v_ignores + 1;
    end if;
  end loop;

  return jsonb_build_object('inseres', cardinality(v_ids), 'traites', v_traites, 'reveils', v_reveils, 'expires_ou_remplaces', v_ignores);
end;
$function$;

revoke all on function public.meteoalarm_ingerer(jsonb) from public, anon, authenticated;
grant execute on function public.meteoalarm_ingerer(jsonb) to service_role;

-- 5. Tâche planifiée -----------------------------------------------------------------------------------------------------

-- Adresse de l'Edge Function de ce projet. Sur une autre instance (branche, copie), la remplacer avant d'appliquer.
create or replace function public.meteoalarm_declencher()
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  perform net.http_post(
    url := 'https://apjswshvzbejpvlxfnek.supabase.co/functions/v1/ingest-meteoalarm',
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
exception when others then
  perform jobs_signaler('ingest_meteoalarm', false, 'Appel de l''Edge Function impossible : ' || sqlerrm);
end;
$function$;

revoke all on function public.meteoalarm_declencher() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'ingest_meteoalarm') then
    perform cron.schedule('ingest_meteoalarm', '*/10 * * * *', 'select public.meteoalarm_declencher()');
  end if;
end $$;

-- 6. Règles par défaut des fiches --------------------------------------------------------------------------------------

create table if not exists public.regles_reveil_modeles (
  id uuid primary key default gen_random_uuid(),
  code_risque text not null check (char_length(code_risque) between 1 and 100),
  rang_seuil text not null check (rang_seuil ~ '^S[0-9]$'),
  type_alerte text not null check (type_alerte in ('orage', 'pluie', 'vent', 'chaleur', 'froid', 'neige_verglas', 'brouillard', 'autre')),
  niveau_min text not null check (niveau_min in ('jaune', 'orange', 'rouge')),
  source text not null default 'toutes' check (source in ('toutes', 'irm', 'meteoalarm', 'saisie')),
  note text check (note is null or char_length(note) <= 500),
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  unique (code_risque, rang_seuil, type_alerte, niveau_min, source)
);

comment on table public.regles_reveil_modeles is
  'Règles de réveil livrées avec une fiche : une commune les reprend (Admin › Réveil automatique) sur les seuils de sa fiche dont le libellé porte le rang (S0, S1…)';

alter table public.regles_reveil_modeles enable row level security;
revoke all on public.regles_reveil_modeles from public, anon, authenticated;
grant select, insert, update, delete on public.regles_reveil_modeles to authenticated;

create policy "lecture" on public.regles_reveil_modeles for select to authenticated using (true);
create policy "écriture par le super-admin" on public.regles_reveil_modeles for all to authenticated
  using (est_super_admin()) with check (est_super_admin());

insert into public.regles_reveil_modeles (code_risque, rang_seuil, type_alerte, niveau_min, note) values
  ('STARTER-REX-2026-ORAGES', 'S0', 'orage', 'jaune', 'Seuil S0 de la fiche : « Avertissement jaune IRM « orages » ».'),
  ('STARTER-REX-2026-ORAGES', 'S1', 'orage', 'orange', 'Seuil S1 de la fiche : « Avertissement orange ou rouge IRM « orages » ». Ne pas attendre l''appel du CORTEX ou du gouverneur.')
on conflict do nothing;

-- Règles proposées à une commune : seuils actifs de ses fiches, reconnus par le code de la fiche et le rang dans le libellé.
-- Droits de l'appelant : seuls les seuils qu'il peut lire apparaissent.
create or replace function public.regles_reveil_proposees(p_contexte uuid)
 returns table (modele_id uuid, seuil_action_id uuid, seuil_libelle text, fiche text, type_alerte text, niveau_min text,
                source text, note text, deja_presente boolean)
 language sql
 stable
 security invoker
 set search_path to 'public', 'pg_temp'
as $function$
  select m.id, s.id, s.libelle, r.titre, m.type_alerte, m.niveau_min, m.source, m.note,
         exists (select 1 from regles_reveil g
                 where g.seuil_action_id = s.id and g.source = m.source and g.type_alerte = m.type_alerte and g.niveau_min = m.niveau_min)
  from regles_reveil_modeles m
  join risques_territoire r on r.code = m.code_risque and r.contexte_id = p_contexte
  join seuils_action s on s.risque_id = r.id and s.contexte_id = p_contexte and s.actif
                       and s.libelle ~ ('(^|[^A-Za-z0-9])' || m.rang_seuil || '([^0-9]|$)')
  where m.actif
  order by r.titre, s.ordre, m.niveau_min;
$function$;

-- Crée les règles proposées qui manquent (toutes, ou celles des modèles choisis). Droits de l'appelant : la politique
-- d'écriture de regles_reveil et son déclencheur s'appliquent comme pour une saisie dans l'Admin.
create or replace function public.appliquer_regles_reveil_modeles(p_contexte uuid, p_modeles uuid[] default null)
 returns integer
 language plpgsql
 security invoker
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_nb integer;
begin
  insert into regles_reveil (contexte_id, seuil_action_id, source, type_alerte, niveau_min, origine, note)
  select p_contexte, p.seuil_action_id, p.source, p.type_alerte, p.niveau_min, 'import_fiche', p.note
  from regles_reveil_proposees(p_contexte) p
  where not p.deja_presente and (p_modeles is null or p.modele_id = any (p_modeles))
  on conflict on constraint regles_reveil_unique do nothing;
  get diagnostics v_nb = row_count;
  return v_nb;
end;
$function$;

revoke all on function public.regles_reveil_proposees(uuid) from public, anon;
revoke all on function public.appliquer_regles_reveil_modeles(uuid, uuid[]) from public, anon;
grant execute on function public.regles_reveil_proposees(uuid) to authenticated;
grant execute on function public.appliquer_regles_reveil_modeles(uuid, uuid[]) to authenticated;
