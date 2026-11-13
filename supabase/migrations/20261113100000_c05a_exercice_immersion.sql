-- C5 — immersion des joueurs pendant un exercice (idées reprises de Mur@il, plateforme de simulation inspirée de
-- REMPAR25 ; aucun code repris : Mur@il est sous GPL v3).
--
-- 1. exercice_stimuli : type (message dans la boîte d'un rôle, publication sur un faux réseau social, décompte
--    affiché), destinataires multiples, durée du décompte, livrable attendu (réservé aux animateurs).
-- 2. exercices.diffusion_auto : les stimuli partent d'eux-mêmes à leur heure de scénario (horloge × facteur de
--    temps), par la tâche planifiée exercices_diffusion (chaque minute). Sinon, l'animateur lance à la main.
-- 3. Salle de jeu : exercice_salle() donne aux membres de la commune les seuls stimuli déjà lancés (messages,
--    publications, décompte en cours), sans note d'animateur, sans livrable ni action attendue. Rien n'est public.
-- 4. exercice_stimuli_traitements : « traité » par joueur et par rôle (marquer_stimulus_traite), lu par les
--    animateurs pour le bilan (délai de prise en charge).
-- 5. Trames (b03c) : les stimuli d'une trame peuvent porter type, destinataires et durée de décompte ;
--    generer_exercice_commune les recopie.

-- 1. Stimuli -----------------------------------------------------------------------------------------

alter table public.exercice_stimuli
  add column if not exists type_stimulus text not null default 'message',
  add column if not exists destinataires text[],
  add column if not exists decompte_minutes integer,
  add column if not exists livrable text;

alter table public.exercice_stimuli
  add constraint exercice_stimuli_type_check check (type_stimulus in ('message', 'publication', 'decompte')),
  add constraint exercice_stimuli_destinataires_check
    check (destinataires is null or (cardinality(destinataires) between 1 and 8
           and destinataires <@ array['tous', 'd1', 'd2', 'd3', 'd4', 'd5', 'pcops', 'bourgmestre'])),
  add constraint exercice_stimuli_decompte_check
    check ((type_stimulus = 'decompte') = (decompte_minutes is not null)
           and (decompte_minutes is null or decompte_minutes between 1 and 1440)),
  add constraint exercice_stimuli_livrable_check check (livrable is null or char_length(livrable) <= 500);

comment on column public.exercice_stimuli.type_stimulus is
  'message : boîte de réception des rôles destinataires ; publication : faux fil de réseau social (pression médiatique) ; decompte : compte à rebours affiché aux joueurs.';
comment on column public.exercice_stimuli.destinataires is
  'Rôles qui reçoivent le message (tous, d1 à d5, pcops, bourgmestre). Vide : discipline_cible, sinon tous.';

-- Rôles destinataires effectifs d'un stimulus.
create or replace function public.stimulus_destinataires(p_destinataires text[], p_discipline text)
 returns text[]
 language sql
 immutable
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(p_destinataires, case when p_discipline is not null then array[p_discipline] else array['tous'] end);
$function$;

-- 2. Diffusion automatique ------------------------------------------------------------------------------

alter table public.exercices
  add column if not exists diffusion_auto boolean not null default false;

comment on column public.exercices.diffusion_auto is
  'Les stimuli prévus partent d''eux-mêmes à leur heure de scénario (tâche exercices_diffusion, chaque minute).';

create or replace function public.exercices_diffuser_echus()
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
    select s.id, s.emetteur, s.texte, s.type_stimulus, e.incident_id
    from exercice_stimuli s
    join exercices e on e.id = s.exercice_id
    where e.statut = 'en_cours' and e.diffusion_auto and e.debut_reel is not null
      and s.statut = 'prevu'
      and e.debut_reel + make_interval(secs => s.heure_scenario_min * 60 / greatest(e.facteur_temps, 0.01)) <= now()
    order by s.heure_scenario_min, s.ordre
    for update of s skip locked
  loop
    update exercice_stimuli set statut = 'lance', lance_a = now() where id = v.id;
    -- Même trace que lancer_stimulus : une ligne au livre de bord de l'incident d'exercice.
    if v.incident_id is not null
       and exists (select 1 from incidents i where i.id = v.incident_id and i.est_exercice) then
      insert into livre_de_bord (incident_id, message)
      values (v.incident_id, '[EXERCICE] ' || coalesce(nullif(btrim(v.emetteur), '') || ' — ', '') || v.texte);
    end if;
    v_nb := v_nb + 1;
  end loop;
  perform jobs_signaler('exercices_diffusion', true);
  return v_nb;
exception when others then
  perform jobs_signaler('exercices_diffusion', false, sqlerrm);
  return -1;
end;
$function$;

revoke all on function public.exercices_diffuser_echus() from public, anon, authenticated;

-- 3. Traité par les joueurs ---------------------------------------------------------------------------

create table if not exists public.exercice_stimuli_traitements (
  id uuid primary key default gen_random_uuid(),
  exercice_id uuid not null references public.exercices(id) on delete cascade,
  stimulus_id uuid not null references public.exercice_stimuli(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text check (role is null or role in ('tous', 'd1', 'd2', 'd3', 'd4', 'd5', 'pcops', 'bourgmestre')),
  traite_le timestamptz not null default now(),
  unique (stimulus_id, user_id)
);

create index if not exists exercice_stimuli_traitements_exercice on public.exercice_stimuli_traitements (exercice_id);

alter table public.exercice_stimuli_traitements enable row level security;
revoke all on public.exercice_stimuli_traitements from public, anon, authenticated;
grant select on public.exercice_stimuli_traitements to authenticated;

create policy "lecture animateur ou soi" on public.exercice_stimuli_traitements
  for select to authenticated
  using (user_id = auth.uid() or peut_animer_exercice(exercice_id, 'lire'));

create or replace function public.marquer_stimulus_traite(p_stimulus uuid, p_role text default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_s exercice_stimuli%rowtype;
  v_ex exercices%rowtype;
begin
  select * into v_s from exercice_stimuli where id = p_stimulus;
  if not found then raise exception 'Stimulus introuvable'; end if;
  select * into v_ex from exercices where id = v_s.exercice_id;
  if auth.uid() is null or not a_capacite(v_ex.contexte_id, 'exercices', 'lire') then
    raise exception 'Accès refusé';
  end if;
  if v_ex.statut <> 'en_cours' or v_s.statut <> 'lance' or v_s.type_stimulus <> 'message' then
    raise exception 'Ce message ne peut pas être marqué traité';
  end if;
  insert into exercice_stimuli_traitements (exercice_id, stimulus_id, user_id, role)
  values (v_s.exercice_id, p_stimulus, auth.uid(), nullif(p_role, ''))
  on conflict (stimulus_id, user_id) do nothing;
end;
$function$;

revoke all on function public.marquer_stimulus_traite(uuid, text) from public, anon;
grant execute on function public.marquer_stimulus_traite(uuid, text) to authenticated;

-- 4. Salle de jeu ---------------------------------------------------------------------------------------

create or replace function public.exercice_salle(p_exercice uuid)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_ex exercices%rowtype;
begin
  select * into v_ex from exercices where id = p_exercice;
  if not found or not a_capacite(v_ex.contexte_id, 'exercices', 'lire') then
    raise exception 'Accès refusé';
  end if;
  if v_ex.statut = 'preparation' then
    raise exception 'L''exercice n''a pas encore démarré';
  end if;

  -- Seuls les stimuli déjà lancés ; jamais la note d'animateur, le livrable ni les actions attendues.
  return jsonb_build_object(
    'exercice', jsonb_build_object('id', v_ex.id, 'titre', v_ex.titre, 'statut', v_ex.statut, 'mode_jeu', v_ex.mode_jeu,
                                   'debut_reel', v_ex.debut_reel, 'fin_reelle', v_ex.fin_reelle, 'facteur_temps', v_ex.facteur_temps),
    'roles', coalesce((
      select jsonb_agg(distinct r order by r)
      from exercice_stimuli s, unnest(stimulus_destinataires(s.destinataires, s.discipline_cible)) r
      where s.exercice_id = p_exercice and s.type_stimulus = 'message'), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'lance_a', s.lance_a, 'emetteur', s.emetteur, 'canal', s.canal,
                                          'destinataires', to_jsonb(stimulus_destinataires(s.destinataires, s.discipline_cible)),
                                          'texte', s.texte) order by s.lance_a desc)
      from exercice_stimuli s
      where s.exercice_id = p_exercice and s.statut = 'lance' and s.type_stimulus = 'message'), '[]'::jsonb),
    'publications', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'lance_a', s.lance_a, 'emetteur', s.emetteur, 'canal', s.canal,
                                          'texte', s.texte) order by s.lance_a desc)
      from exercice_stimuli s
      where s.exercice_id = p_exercice and s.statut = 'lance' and s.type_stimulus = 'publication'), '[]'::jsonb),
    'decompte', (
      select jsonb_build_object('id', s.id, 'texte', s.texte, 'minutes', s.decompte_minutes,
                                'fin_le', s.lance_a + make_interval(mins => s.decompte_minutes))
      from exercice_stimuli s
      where s.exercice_id = p_exercice and s.statut = 'lance' and s.type_stimulus = 'decompte'
      order by s.lance_a desc limit 1),
    'traites', coalesce((
      select jsonb_agg(t.stimulus_id) from exercice_stimuli_traitements t
      where t.exercice_id = p_exercice and t.user_id = auth.uid()), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.exercice_salle(uuid) from public, anon;
grant execute on function public.exercice_salle(uuid) to authenticated;

-- 5. Trames : type, destinataires et décompte dans les stimuli ---------------------------------------------

create or replace function public.exercice_trames_avant_ecriture()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v jsonb;
  v_disciplines constant text[] := array['d1', 'd2', 'd3', 'd4', 'd5', 'pcops', 'bourgmestre'];
  v_canaux constant text[] := array['telephone', 'radio', 'mail', 'be_alert', 'terrain', 'media', 'citoyen', 'autre'];
  v_type text;
begin
  if jsonb_typeof(new.objectifs) <> 'array' or jsonb_typeof(new.stimuli) <> 'array' then
    raise exception 'Objectifs et stimuli : listes attendues';
  end if;
  if jsonb_array_length(new.stimuli) > 100 or jsonb_array_length(new.objectifs) > 50 then
    raise exception 'Trame trop longue (100 stimuli et 50 objectifs au plus)';
  end if;
  for v in select * from jsonb_array_elements(new.objectifs) loop
    if coalesce(btrim(v ->> 'intitule'), '') = '' then
      raise exception 'Chaque objectif doit avoir un intitulé';
    end if;
    if (v ->> 'discipline') is not null and not (v ->> 'discipline') = any (v_disciplines) then
      raise exception 'Discipline d''objectif inconnue : %', v ->> 'discipline';
    end if;
  end loop;
  for v in select * from jsonb_array_elements(new.stimuli) loop
    if coalesce(btrim(v ->> 'texte'), '') = '' then
      raise exception 'Chaque stimulus doit avoir un texte';
    end if;
    if jsonb_typeof(v -> 'heure_scenario_min') is distinct from 'number' or (v ->> 'heure_scenario_min')::numeric < 0 then
      raise exception 'Heure de scénario invalide (minutes depuis le début, 0 ou plus)';
    end if;
    if not coalesce(v ->> 'canal', 'autre') = any (v_canaux) then
      raise exception 'Canal inconnu : %', v ->> 'canal';
    end if;
    if (v ->> 'discipline_cible') is not null and not (v ->> 'discipline_cible') = any (v_disciplines) then
      raise exception 'Discipline cible inconnue : %', v ->> 'discipline_cible';
    end if;
    v_type := coalesce(v ->> 'type', 'message');
    if v_type not in ('message', 'publication', 'decompte') then
      raise exception 'Type de stimulus inconnu : %', v_type;
    end if;
    if v_type = 'decompte' and (jsonb_typeof(v -> 'decompte_minutes') is distinct from 'number'
                                or (v ->> 'decompte_minutes')::numeric not between 1 and 1440) then
      raise exception 'Un décompte a une durée en minutes (1 à 1440)';
    end if;
    if v ? 'destinataires' and (jsonb_typeof(v -> 'destinataires') <> 'array'
       or exists (select 1 from jsonb_array_elements_text(v -> 'destinataires') d where not d = any (v_disciplines || 'tous'::text))) then
      raise exception 'Destinataires inconnus';
    end if;
  end loop;
  if new.risque_territoire_id is not null and not exists (
       select 1 from risques_territoire r where r.id = new.risque_territoire_id and r.contexte_id = new.contexte_id) then
    raise exception 'Le risque lié doit appartenir à la même commune';
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

create or replace function public.generer_exercice_commune(
  p_contexte uuid, p_trame uuid, p_titre text, p_mode_jeu text default 'sur_table',
  p_duree_min integer default null, p_max_pieges integer default 3
) returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_t exercice_trames%rowtype;
  v_ex uuid;
  v_risque uuid;
  v_max_heure integer;
  v_heure_piege integer;
  v_ordre integer := 0;
  v_obj jsonb;
  v_sti jsonb;
  v_obj_id uuid;
  v_sti_id uuid;
  p record;
begin
  if p_contexte is null or not a_capacite(p_contexte, 'exercices', 'creer') then
    raise exception 'Accès refusé';
  end if;
  select * into v_t from exercice_trames t
   where t.id = p_trame and t.actif and (t.contexte_id is null or t.contexte_id = p_contexte);
  if not found then
    raise exception 'Trame introuvable ou inactive';
  end if;
  if p_mode_jeu not in ('sur_table', 'dans_outil') then
    raise exception 'Mode de jeu inconnu';
  end if;
  if p_duree_min is not null and p_duree_min <= 0 then
    raise exception 'Durée invalide';
  end if;
  if jsonb_array_length(v_t.stimuli) = 0 then
    raise exception 'Cette trame n''a aucun stimulus';
  end if;

  v_risque := coalesce(v_t.risque_territoire_id,
                       (select r.id from risques_territoire r where r.contexte_id = p_contexte and r.code = v_t.risque limit 1));
  select max((s ->> 'heure_scenario_min')::integer) into v_max_heure from jsonb_array_elements(v_t.stimuli) s;

  insert into exercices (contexte_id, titre, type_exercice, mode_jeu, duree_minutes, facteur_temps, fiche_risque_id, objectifs)
  values (p_contexte, coalesce(nullif(btrim(p_titre), ''), v_t.titre),
          case when p_mode_jeu = 'dans_outil' then 'cpx' else 'ttx' end, p_mode_jeu, p_duree_min,
          case when p_duree_min is not null and v_max_heure > p_duree_min then round(v_max_heure::numeric / p_duree_min, 2) else 1 end,
          v_risque, 'Généré depuis la trame ' || v_t.code)
  returning id into v_ex;

  for v_obj in select * from jsonb_array_elements(v_t.objectifs) loop
    v_ordre := v_ordre + 1;
    insert into exercice_objectifs (exercice_id, ordre, code, intitule, discipline)
    values (v_ex, v_ordre, nullif(v_obj ->> 'code', ''), v_obj ->> 'intitule', nullif(v_obj ->> 'discipline', ''));
  end loop;

  v_ordre := 0;
  for v_sti in select * from jsonb_array_elements(v_t.stimuli) order by (value ->> 'heure_scenario_min')::integer loop
    v_ordre := v_ordre + 1;
    insert into exercice_stimuli (exercice_id, ordre, heure_scenario_min, canal, emetteur, discipline_cible, texte, note_animateur, objectif_id,
                                  type_stimulus, destinataires, decompte_minutes)
    values (v_ex, v_ordre, (v_sti ->> 'heure_scenario_min')::integer, coalesce(v_sti ->> 'canal', 'autre'),
            nullif(v_sti ->> 'emetteur', ''), nullif(v_sti ->> 'discipline_cible', ''), v_sti ->> 'texte',
            nullif(v_sti ->> 'note_animateur', ''),
            (select o.id from exercice_objectifs o where o.exercice_id = v_ex and o.code = v_sti ->> 'objectif' limit 1),
            coalesce(v_sti ->> 'type', 'message'),
            case when jsonb_typeof(v_sti -> 'destinataires') = 'array'
                 then (select array_agg(d) from jsonb_array_elements_text(v_sti -> 'destinataires') d) end,
            (v_sti ->> 'decompte_minutes')::integer);
  end loop;

  v_heure_piege := greatest(1, coalesce(v_max_heure, 0) / 2);
  for p in
    select x.* from (
      select distinct on (pc.code) pc.*, (pc.code = any (v_t.pieges_couverts)) as couvert
      from pieges_commune(p_contexte) pc
      order by pc.code, pc.titre
    ) x
    order by x.couvert desc, case x.gravite when 'haute' then 0 when 'moyenne' then 1 else 2 end, x.titre
    limit greatest(coalesce(p_max_pieges, 3), 0)
  loop
    v_ordre := v_ordre + 1;
    insert into exercice_objectifs (exercice_id, ordre, code, intitule)
    values (v_ex, v_ordre, 'P-' || left(p.code, 30), p.objectif)
    returning id into v_obj_id;

    select s.id into v_sti_id
    from exercice_stimuli s
    where s.exercice_id = v_ex
      and s.ordre = (select x.n from (select row_number() over (order by (e ->> 'heure_scenario_min')::integer) as n, e
                                      from jsonb_array_elements(v_t.stimuli) e) x
                     where x.e ->> 'piege' = p.code limit 1)
      and not exists (select 1 from exercice_sources so where so.stimulus_id = s.id);
    if v_sti_id is null then
      insert into exercice_stimuli (exercice_id, ordre, heure_scenario_min, canal, emetteur, texte, note_animateur, objectif_id)
      values (v_ex, v_ordre, v_heure_piege, 'autre', 'Animation', p.stimulus,
              'Piège : ' || p.titre || '. ' || p.detail, v_obj_id)
      returning id into v_sti_id;
    else
      update exercice_stimuli
         set objectif_id = coalesce(objectif_id, v_obj_id),
             note_animateur = left(coalesce(note_animateur || ' ', '') || 'Piège : ' || p.titre || '.', 2000)
       where id = v_sti_id;
    end if;

    insert into exercice_actions_attendues (exercice_id, objectif_id, stimulus_id, ordre, action)
    values (v_ex, v_obj_id, v_sti_id, v_ordre, p.objectif);
    insert into exercice_sources (exercice_id, stimulus_id, table_source, id_source, code_controle, description)
    values (v_ex, v_sti_id, p.table_source, p.source_id::text, p.code, p.titre || ' : ' || p.detail);
    v_sti_id := null;
  end loop;

  return v_ex;
end;
$function$;

-- 6. Tâche planifiée ------------------------------------------------------------------------------------------

insert into public.jobs_etat (nom, description, silence_max)
values ('exercices_diffusion', 'Exercices (C5) : diffusion automatique des stimuli à leur heure de scénario, chaque minute', interval '10 minutes')
on conflict (nom) do nothing;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'exercices_diffusion') then
    perform cron.schedule('exercices_diffusion', '* * * * *', 'select public.exercices_diffuser_echus()');
  end if;
end $$;
