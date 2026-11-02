-- Tests du briefing 03, partie B (migration 20261102110000_b03b_dossiers_evenements.sql), à exécuter dans le
-- SQL Editor après la migration (ou, en répétition, à la suite de son texte dans la même transaction).
-- Transaction annulée par l'exception finale, qui affiche les résultats. L'Edge Function
-- ingestion-dossier-evenement délègue tout le travail en base à recevoir_dossier_evenement(), testée ici
-- sous la clé de service ; l'authentification par secret et la journalisation se vérifient après déploiement.

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
  '00000000-0000-0000-0000-0000000000b1'::uuid as etranger,
  '11111111-1111-4111-8111-111111111111'::uuid as jeton_connu,
  '22222222-2222-4222-8222-222222222222'::uuid as jeton_inconnu,
  '33333333-3333-4333-8333-333333333333'::uuid as reference
from contextes c where c.nom = 'Commune Test';

insert into sources_externes_alertes (contexte_id, libelle, secret, objets)
select commune, 'Eventware (test B, alertes seules)', 'secret-test-b-alerte', '{alerte}'::text[] from t_ids
union all
select commune, 'Eventware (test B)', 'secret-test-b-dossier', '{alerte,dossier}'::text[] from t_ids;
insert into evenements_territoire (contexte_id, nom, jeton_public, date_debut, date_fin)
select commune, 'Festival test B', jeton_connu, current_date + 10, current_date + 12 from t_ids;
grant select on t_ids, t_rep to anon, authenticated, service_role;

create function pg_temp.charge(p_jeton uuid, p_ref uuid, p_version integer, p_statut text) returns text language sql as $f$
  select jsonb_build_object(
    'source', 'eventware', 'type', 'dossier_securite',
    'evenement', jsonb_build_object('jeton_public', p_jeton, 'nom', 'Festival test B', 'commune', 'Commune Test',
                                    'date_debut', (current_date + 10)::text, 'date_fin', (current_date + 12)::text, 'frequentation_max', 1200),
    'dossier', jsonb_build_object('reference', p_ref, 'version', p_version, 'statut', p_statut, 'niveau_dmp', 3,
                                  'lien_consultation', 'https://eventware.example/autorite/jeton-secret-de-consultation',
                                  'maj_le', now()))::text;
$f$;

insert into t_rep (etape, resultat) select
  'B-1 source sans l''objet « dossier » : refusée',
  pg_temp.essai('service_role', null,
    format($q$select recevoir_dossier_evenement((select id from sources_externes_alertes where secret = 'secret-test-b-alerte'), %L::jsonb)$q$,
           pg_temp.charge(jeton_connu, reference, 1, 'depose')))
from t_ids;
insert into t_rep (etape, resultat) select
  'B-2 dépôt v1 pour un événement suivi : dossier créé et rattaché',
  pg_temp.valeur('service_role', null,
    format($q$select recevoir_dossier_evenement((select id from sources_externes_alertes where secret = 'secret-test-b-dossier'), %L::jsonb)::text$q$,
           pg_temp.charge(jeton_connu, reference, 1, 'depose')))
from t_ids;
-- Les contrôles sont des instructions à part : une instruction ne voit pas les écritures des fonctions qu'elle appelle.
insert into t_rep (etape, resultat) select
  'B-2 contrôle',
  (select d.statut || ' v' || d.version || ', DMP ' || d.niveau_dmp || ', ' || d.frequentation_max || ' pers., événement ' || e.nom
   from evenements_territoire_dossiers d join evenements_territoire e on e.id = d.evenement_territoire_id where d.reference = t_ids.reference)
from t_ids;
insert into t_rep (etape, resultat) select
  'B-3 second envoi de la même version : sans effet (attendu deja_recu, 1 dossier, statut inchangé)',
  pg_temp.valeur('service_role', null,
    format($q$select recevoir_dossier_evenement((select id from sources_externes_alertes where secret = 'secret-test-b-dossier'), %L::jsonb) ->> 'resultat'$q$,
           pg_temp.charge(jeton_connu, reference, 1, 'refuse')))
  || ' ; ' || (select count(*) || ' dossier(s), ' || string_agg(statut, ',') from evenements_territoire_dossiers where reference = t_ids.reference)
from t_ids;
insert into t_rep (etape, resultat) select
  'B-4 version 2 « autorise » : mise à jour ; puis version 1 tardive : sans effet',
  pg_temp.valeur('service_role', null,
    format($q$select recevoir_dossier_evenement((select id from sources_externes_alertes where secret = 'secret-test-b-dossier'), %L::jsonb) ->> 'resultat'$q$,
           pg_temp.charge(jeton_connu, reference, 2, 'autorise')))
  || ' / ' ||
  pg_temp.valeur('service_role', null,
    format($q$select recevoir_dossier_evenement((select id from sources_externes_alertes where secret = 'secret-test-b-dossier'), %L::jsonb) ->> 'resultat'$q$,
           pg_temp.charge(jeton_connu, reference, 1, 'depose')))
from t_ids;
insert into t_rep (etape, resultat) select
  'B-4 contrôle (attendu autorise v2)',
  (select statut || ' v' || version from evenements_territoire_dossiers where reference = t_ids.reference)
from t_ids;
insert into t_rep (etape, resultat) select
  'B-5 dossier d''un événement inconnu : événement proposé, inactif, à examiner',
  pg_temp.valeur('service_role', null,
    format($q$select recevoir_dossier_evenement((select id from sources_externes_alertes where secret = 'secret-test-b-dossier'), %L::jsonb) ->> 'evenement_propose'$q$,
           pg_temp.charge(jeton_inconnu, gen_random_uuid(), 1, 'depose')))
from t_ids;
insert into t_rep (etape, resultat) select
  'B-5 contrôle',
  (select nom || ', actif ' || actif || ', ' || statut_proposition || ', proposé ' || propose_par_organisateur
   from evenements_territoire where jeton_public = t_ids.jeton_inconnu)
from t_ids;
insert into t_rep (etape, resultat) select
  'B-6 le membre active l''événement proposé sans décision : refusé ; « Accepter » : suivi',
  pg_temp.essai('authenticated', membre,
    $q$update evenements_territoire set actif = true where jeton_public = '22222222-2222-4222-8222-222222222222'$q$)
  || ' / ' ||
  pg_temp.essai('authenticated', membre,
    $q$select decider_evenement_propose((select id from evenements_territoire where jeton_public = '22222222-2222-4222-8222-222222222222'), true)$q$,
    $q$select actif || ', ' || statut_proposition || ', ' || (decision_proposition_par = auth.uid()) from evenements_territoire where jeton_public = '22222222-2222-4222-8222-222222222222'$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'B-7 lien de consultation : membre (lu) / compte étranger (0) / anonyme (refus)',
  pg_temp.valeur('authenticated', membre, format($q$select left(lien_consultation, 30) from evenements_territoire_dossiers where reference = %L$q$, reference))
  || ' / ' || pg_temp.valeur('authenticated', etranger, $q$select count(*)::text from evenements_territoire_dossiers$q$)
  || ' / ' || pg_temp.valeur('anon', null, $q$select count(*)::text from evenements_territoire_dossiers$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'B-8 le membre écrit un dossier ou appelle la réception : refusés',
  pg_temp.essai('authenticated', membre,
    format($q$insert into evenements_territoire_dossiers (contexte_id, evenement_territoire_id, reference, version, statut)
              values (%L, (select id from evenements_territoire where jeton_public = %L), gen_random_uuid(), 1, 'autorise')$q$, commune, jeton_connu))
  || ' / ' ||
  pg_temp.essai('authenticated', membre,
    format($q$select recevoir_dossier_evenement((select id from sources_externes_alertes where secret = 'secret-test-b-dossier'), %L::jsonb)$q$,
           pg_temp.charge(jeton_connu, gen_random_uuid(), 1, 'depose')))
from t_ids;
insert into t_rep (etape, resultat) select
  'B-9 charges invalides : statut inconnu ; lien non https',
  pg_temp.essai('service_role', null,
    format($q$select recevoir_dossier_evenement((select id from sources_externes_alertes where secret = 'secret-test-b-dossier'), %L::jsonb)$q$,
           pg_temp.charge(jeton_connu, gen_random_uuid(), 1, 'perdu')))
  || ' / ' ||
  pg_temp.essai('service_role', null,
    format($q$select recevoir_dossier_evenement((select id from sources_externes_alertes where secret = 'secret-test-b-dossier'), %L::jsonb)$q$,
           replace(pg_temp.charge(jeton_connu, gen_random_uuid(), 1, 'depose'), 'https://', 'http://')))
from t_ids;
insert into t_rep (etape, resultat) values
  ('B-10 droits : recevoir_dossier_evenement (anon/auth/service) ; decider_evenement_propose (anon/auth)',
   has_function_privilege('anon', 'public.recevoir_dossier_evenement(uuid, jsonb)', 'execute') || '/'
   || has_function_privilege('authenticated', 'public.recevoir_dossier_evenement(uuid, jsonb)', 'execute') || '/'
   || has_function_privilege('service_role', 'public.recevoir_dossier_evenement(uuid, jsonb)', 'execute') || ' ; '
   || has_function_privilege('anon', 'public.decider_evenement_propose(uuid, boolean)', 'execute') || '/'
   || has_function_privilege('authenticated', 'public.decider_evenement_propose(uuid, boolean)', 'execute'));

do $$
begin
  raise exception 'RESULTATS %', (select json_agg(json_build_object('etape', etape, 'resultat', resultat) order by n) from t_rep);
end $$;
