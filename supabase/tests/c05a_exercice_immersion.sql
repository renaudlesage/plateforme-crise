-- Tests de C5 (migration 20261113100000_c05a_exercice_immersion.sql), à exécuter dans le SQL Editor après la
-- migration (ou, en répétition, à la suite de son texte dans la même transaction). Transaction annulée par
-- l'exception finale, qui affiche les résultats.

begin;
create temp table t_rep (n serial, etape text, resultat text);
create function pg_temp.essai(p_role text, p_uid uuid, p_sql text, p_controle text default null, p_annuler boolean default true)
returns text language plpgsql as $f$
declare
  v_n bigint;
  v_ctl text;
  v_res text;
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then json_build_object('role', p_role)::text
         else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  perform set_config('role', p_role, true);
  begin
    execute p_sql;
    get diagnostics v_n = row_count;
    v_res := 'OK ' || v_n || ' ligne(s)';
    if p_controle is not null then
      execute p_controle into v_ctl;
      v_res := v_res || ' ; contrôle = ' || coalesce(v_ctl, 'null');
    end if;
    if p_annuler then
      raise exception 'ANNULE';
    end if;
  exception when others then
    if sqlerrm <> 'ANNULE' then
      v_res := 'REFUS ' || sqlstate || ' : ' || sqlerrm;
    end if;
  end;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  return v_res;
end $f$;

create function pg_temp.valeur(p_role text, p_uid uuid, p_sql text)
returns text language plpgsql as $f$
declare
  v text;
  v_res text;
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then json_build_object('role', p_role)::text
         else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  perform set_config('role', p_role, true);
  begin
    execute p_sql into v;
    v_res := 'OK ' || coalesce(v, 'null');
  exception when others then
    v_res := 'REFUS ' || sqlstate || ' : ' || sqlerrm;
  end;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  return v_res;
end $f$;

create temp table t_ids as
select c.id as commune,
  (select au.user_id from acces_utilisateurs au
   where au.contexte_id = c.id and au.niveau_acces = 'ecriture'
     and not exists (select 1 from acces_utilisateurs a2 join contextes p on p.id = a2.contexte_id
                     where a2.user_id = au.user_id and p.est_plateforme and a2.niveau_acces = 'admin')
   order by au.user_id limit 1) as membre,
  null::uuid as ex, null::uuid as s1, null::uuid as s2, null::uuid as s4, null::uuid as gen
from contextes c where c.nom = 'Commune Test';
grant select on t_ids, t_rep to anon, authenticated, service_role;
grant usage on sequence t_rep_n_seq to anon, authenticated, service_role;

-- Exercice de test, démarré il y a 10 minutes, facteur 1, diffusion automatique.
insert into exercices (contexte_id, titre, mode_jeu) select commune, 'Test C5 immersion', 'sur_table' from t_ids;
update t_ids set ex = (select id from exercices where titre = 'Test C5 immersion' order by id desc limit 1);
update exercices set statut = 'en_cours', debut_reel = now() - interval '10 minutes', diffusion_auto = true, facteur_temps = 1
 where id = (select ex from t_ids);

insert into exercice_stimuli (exercice_id, ordre, heure_scenario_min, canal, emetteur, texte, note_animateur, type_stimulus, destinataires, decompte_minutes, livrable)
select ex, o, h, c, e, t, n, ty, d, dm, l from t_ids, (values
  (1, 0,   'telephone', 'Gouverneur', 'MSG-ECHU pour d1 et bourgmestre', 'NOTE-SECRETE', 'message', array['d1','bourgmestre'], null::int, 'LIVRABLE-SECRET'),
  (2, 2,   'media', '@journal_local', 'PUB-ECHUE #inondation', null, 'publication', null, null, null),
  (3, 5,   'autre', 'Animation', 'DECOMPTE rapport au gouverneur', null, 'decompte', null, 30, null),
  (4, 600, 'telephone', 'Exploitant', 'MSG-FUTUR', null, 'message', array['d4'], null, null)
) v(o, h, c, e, t, n, ty, d, dm, l);
update t_ids set s1 = (select id from exercice_stimuli where exercice_id = ex and ordre = 1),
                 s2 = (select id from exercice_stimuli where exercice_id = ex and ordre = 2),
                 s4 = (select id from exercice_stimuli where exercice_id = ex and ordre = 4);

insert into t_rep (etape, resultat) select 'C5-1 décompte sans durée : refusé',
  pg_temp.essai('postgres', null, format($q$insert into exercice_stimuli (exercice_id, ordre, heure_scenario_min, canal, texte, type_stimulus) values (%L, 9, 1, 'autre', 'x', 'decompte')$q$, ex)) from t_ids;
insert into t_rep (etape, resultat) select 'C5-2 destinataire inconnu : refusé',
  pg_temp.essai('postgres', null, format($q$insert into exercice_stimuli (exercice_id, ordre, heure_scenario_min, canal, texte, destinataires) values (%L, 9, 1, 'autre', 'x', array['pirate'])$q$, ex)) from t_ids;

insert into t_rep (etape, resultat) select 'C5-3 salle avant diffusion : aucun message',
  pg_temp.valeur('authenticated', membre, format($q$select jsonb_array_length(exercice_salle(%L) -> 'messages')$q$, ex)) from t_ids;
insert into t_rep (etape, resultat) select 'C5-4 diffusion : un joueur ne peut pas l''appeler',
  pg_temp.valeur('authenticated', membre, 'select exercices_diffuser_echus()') from t_ids;
insert into t_rep (etape, resultat) select 'C5-5 diffusion automatique (3 échus attendus)', exercices_diffuser_echus()::text;
insert into t_rep (etape, resultat) select 'C5-6 statuts après diffusion (futur reste prévu)',
  (select string_agg(ordre || ':' || statut, ' ' order by ordre) from exercice_stimuli where exercice_id = (select ex from t_ids));
insert into t_rep (etape, resultat) select 'C5-7 seconde passe : rien de plus', exercices_diffuser_echus()::text;
insert into t_rep (etape, resultat) select 'C5-8 tâche signalée saine',
  (select (dernier_succes_le is not null and echecs_consecutifs = 0)::text from jobs_etat where nom = 'exercices_diffusion');

insert into t_rep (etape, resultat) select 'C5-9 salle : messages, publications, décompte',
  pg_temp.valeur('authenticated', membre, format($q$select jsonb_array_length(s -> 'messages') || ' / ' || jsonb_array_length(s -> 'publications') || ' / ' || (s -> 'decompte' ->> 'minutes') || ' / rôles ' || (s -> 'roles')::text from exercice_salle(%L) s$q$, ex)) from t_ids;
insert into t_rep (etape, resultat) select 'C5-10 salle : ni note, ni livrable, ni futur (attendu false)',
  pg_temp.valeur('authenticated', membre, format($q$select (s::text like '%%NOTE-SECRETE%%' or s::text like '%%LIVRABLE-SECRET%%' or s::text like '%%MSG-FUTUR%%')::text from exercice_salle(%L) s$q$, ex)) from t_ids;
insert into t_rep (etape, resultat) select 'C5-11 salle : anonyme refusé',
  pg_temp.valeur('anon', null, format($q$select exercice_salle(%L)::text$q$, ex)) from t_ids;
insert into t_rep (etape, resultat) select 'C5-12 salle : utilisateur sans accès refusé',
  pg_temp.valeur('authenticated', gen_random_uuid(), format($q$select exercice_salle(%L)::text$q$, ex)) from t_ids;

insert into t_rep (etape, resultat) select 'C5-13 marquer traité un message lancé',
  pg_temp.essai('authenticated', membre, format($q$select marquer_stimulus_traite(%L, 'd1')$q$, s1),
    format($q$select count(*)::text from exercice_stimuli_traitements where exercice_id = %L$q$, ex), false) from t_ids;
insert into t_rep (etape, resultat) select 'C5-13b deuxième fois : idempotent (toujours 1)',
  pg_temp.essai('authenticated', membre, format($q$select marquer_stimulus_traite(%L, 'd1')$q$, s1),
    format($q$select count(*)::text from exercice_stimuli_traitements where exercice_id = %L$q$, ex)) from t_ids;
insert into t_rep (etape, resultat) select 'C5-14 marquer traité un message futur : refusé',
  pg_temp.essai('authenticated', membre, format($q$select marquer_stimulus_traite(%L, 'd4')$q$, s4)) from t_ids;
insert into t_rep (etape, resultat) select 'C5-15 marquer une publication : refusé',
  pg_temp.essai('authenticated', membre, format($q$select marquer_stimulus_traite(%L)$q$, s2)) from t_ids;
insert into t_rep (etape, resultat) select 'C5-16 écriture directe des traitements : refusée',
  pg_temp.essai('authenticated', membre, format($q$insert into exercice_stimuli_traitements (exercice_id, stimulus_id, user_id) values (%L, %L, auth.uid())$q$, ex, s1)) from t_ids;
insert into t_rep (etape, resultat) select 'C5-17 salle : mes traités',
  pg_temp.valeur('authenticated', membre, format($q$select jsonb_array_length(exercice_salle(%L) -> 'traites')$q$, ex)) from t_ids;
insert into t_rep (etape, resultat) select 'C5-17b mes traitements lus par moi',
  pg_temp.valeur('authenticated', membre, format($q$select count(*) from exercice_stimuli_traitements where exercice_id = %L$q$, ex)) from t_ids;
insert into t_rep (etape, resultat) select 'C5-18 traitements lus par un autre utilisateur : 0 ligne',
  pg_temp.valeur('authenticated', gen_random_uuid(), format($q$select count(*) from exercice_stimuli_traitements where exercice_id = %L$q$, ex)) from t_ids;
insert into t_rep (etape, resultat) select 'C5-19 joueur non animateur : stimuli bruts invisibles',
  pg_temp.valeur('authenticated', membre, format($q$select count(*) from exercice_stimuli where exercice_id = %L$q$, ex)) from t_ids;

insert into t_rep (etape, resultat) select 'C5-20 trame : type inconnu refusé',
  pg_temp.essai('postgres', null, format($q$insert into exercice_trames (contexte_id, code, titre, objectifs, stimuli) values (%L, 'T-C5-1', 'x', '[]', '[{"heure_scenario_min": 0, "texte": "x", "type": "fax"}]')$q$, commune)) from t_ids;
insert into t_rep (etape, resultat) select 'C5-21 trame : décompte sans durée refusé',
  pg_temp.essai('postgres', null, format($q$insert into exercice_trames (contexte_id, code, titre, objectifs, stimuli) values (%L, 'T-C5-2', 'x', '[]', '[{"heure_scenario_min": 0, "texte": "x", "type": "decompte"}]')$q$, commune)) from t_ids;
insert into t_rep (etape, resultat) select 'C5-22 trame : destinataire inconnu refusé',
  pg_temp.essai('postgres', null, format($q$insert into exercice_trames (contexte_id, code, titre, objectifs, stimuli) values (%L, 'T-C5-3', 'x', '[]', '[{"heure_scenario_min": 0, "texte": "x", "destinataires": ["pirate"]}]')$q$, commune)) from t_ids;
insert into t_rep (etape, resultat) select 'C5-23 trame complète',
  pg_temp.essai('postgres', null, format($q$insert into exercice_trames (contexte_id, code, titre, objectifs, stimuli) values (%L, 'T-C5-OK', 'Trame C5', '[]', '[{"heure_scenario_min": 0, "texte": "msg", "destinataires": ["d1", "d2"]}, {"heure_scenario_min": 5, "texte": "#buzz", "type": "publication", "emetteur": "@citoyen"}, {"heure_scenario_min": 10, "texte": "Rapport", "type": "decompte", "decompte_minutes": 20}]')$q$, commune),
    null, false) from t_ids;
insert into t_rep (etape, resultat) select 'C5-24 génération par le membre',
  pg_temp.valeur('authenticated', membre, format($q$select generer_exercice_commune(%L, (select id from exercice_trames where code = 'T-C5-OK'), 'Gen C5', 'sur_table', null, 0)$q$, commune)) from t_ids;
update t_ids set gen = (select id from exercices where titre = 'Gen C5' and contexte_id = commune order by id desc limit 1);
insert into t_rep (etape, resultat) select 'C5-24b stimuli générés : types, destinataires, décompte',
  (select string_agg(type_stimulus || coalesce('[' || array_to_string(destinataires, ',') || ']', '') || coalesce(':' || decompte_minutes, ''), ' ' order by ordre)
   from exercice_stimuli where exercice_id = (select gen from t_ids));
insert into t_rep (etape, resultat) select 'C5-25 tâche planifiée enregistrée',
  (select count(*)::text from cron.job where jobname = 'exercices_diffusion');

do $$ begin raise exception 'RESULTATS %', (select string_agg(n || ' ' || etape || ' => ' || resultat, E'\n' order by n) from t_rep); end $$;
rollback;
