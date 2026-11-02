-- Tests du briefing 03, partie A (migration 20261102090000_b03a_alertes_garde_fous.sql),
-- à exécuter dans le SQL Editor après la migration (ou, en répétition, à la suite de son texte
-- dans la même transaction). Tout se passe dans une transaction annulée par l'exception finale,
-- qui affiche les résultats : rien n'est conservé.
-- Comptes : un membre « écriture » de la Commune Test (capacité communication par repli sur le
-- niveau d'accès), un compte étranger à la commune, l'anonyme et la clé de service (rôle de
-- l'Edge Function ingestion-alerte-externe).

begin;
create temp table t_rep (n serial, etape text, resultat text);

-- Exécute p_sql sous un rôle et un utilisateur donnés ; garde l'effet si p_annuler est faux.
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

-- Première valeur de p_sql exécuté sous un rôle et un utilisateur donnés.
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
  '00000000-0000-0000-0000-0000000000a1'::uuid as etranger,
  (select i.id from incidents i where i.contexte_id = c.id and not i.est_exercice and i.statut <> 'cloture'
   order by i.date_debut desc limit 1) as incident_reel
from contextes c where c.nom = 'Commune Test';
grant select on t_ids, t_rep to anon, authenticated, service_role;

-- A1 : alerte reçue d'un organisateur ----------------------------------------------------------

insert into t_rep (etape, resultat) select
  'A1-1 réception par la clé de service avec actif = true : enregistrée inactive, « à valider », notification de la permanence',
  pg_temp.essai('service_role', null,
    format($q$insert into alertes_publiques (contexte_id, titre, message, niveau_alerte, actif, provenance)
              values (%L, 'Test A1 évacuation scène B', 'Message interne d''organisateur', 'urgence', true, 'externe')$q$, commune),
    $q$select a.actif || ', ' || a.statut_reception || ', ' || (a.recue_le is not null) || ', '
              || (select count(*) from notifications n where n.motif = 'alerte_recue' and n.contexte_id = a.contexte_id) || ' notification(s)'
       from alertes_publiques a where a.titre = 'Test A1 évacuation scène B'$q$, false)
from t_ids;
insert into t_rep (etape, resultat) values
  ('A1-2 l''anonyme ne la lit pas (attendu 0)',
   pg_temp.valeur('anon', null, $q$select count(*)::text from alertes_publiques where titre = 'Test A1 évacuation scène B'$q$));
insert into t_rep (etape, resultat) select
  'A1-3 le membre la publie directement (actif = true) : refusé',
  pg_temp.essai('authenticated', membre,
    $q$update alertes_publiques set actif = true where titre = 'Test A1 évacuation scène B'$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'A1-4 le membre force le statut « validee » sans passer par la validation : refusé',
  pg_temp.essai('authenticated', membre,
    $q$update alertes_publiques set statut_reception = 'validee' where titre = 'Test A1 évacuation scène B'$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'A1-5 un compte étranger à la commune valide : refusé',
  pg_temp.essai('authenticated', etranger,
    $q$select valider_alerte_recue((select id from alertes_publiques where titre = 'Test A1 évacuation scène B'), true)$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'A1-6 le membre rejette sans motif : refusé',
  pg_temp.essai('authenticated', membre,
    $q$select valider_alerte_recue((select id from alertes_publiques where titre = 'Test A1 évacuation scène B'), false, '  ')$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'A1-7 le membre publie (contrôle : actif, statut, auteur de la décision) ; l''anonyme la lit alors (attendu 1)',
  pg_temp.essai('authenticated', membre,
    $q$select valider_alerte_recue((select id from alertes_publiques where titre = 'Test A1 évacuation scène B'), true)$q$,
    $q$select actif || ', ' || statut_reception || ', ' || (decision_par = auth.uid()) from alertes_publiques where titre = 'Test A1 évacuation scène B'$q$, false)
  || ' / anonyme : ' ||
  pg_temp.valeur('anon', null, $q$select count(*)::text from alertes_publiques where titre = 'Test A1 évacuation scène B'$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'A1-8 seconde décision sur la même alerte : refusée',
  pg_temp.essai('authenticated', membre,
    $q$select valider_alerte_recue((select id from alertes_publiques where titre = 'Test A1 évacuation scène B'), false, 'trop tard')$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'A1-9 une deuxième alerte reçue est rejetée avec motif : inactive, invisible de l''anonyme (attendu 0)',
  pg_temp.essai('service_role', null,
    format($q$insert into alertes_publiques (contexte_id, titre, message, niveau_alerte, provenance)
              values (%L, 'Test A1 fermeture parking', 'Interne', 'info', 'externe')$q$, commune), null, false)
  || ' / ' ||
  pg_temp.essai('authenticated', membre,
    $q$select valider_alerte_recue((select id from alertes_publiques where titre = 'Test A1 fermeture parking'), false, 'Consigne interne à l''organisateur')$q$,
    $q$select actif || ', ' || statut_reception || ', ' || motif_decision from alertes_publiques where titre = 'Test A1 fermeture parking'$q$, false)
  || ' / anonyme : ' ||
  pg_temp.valeur('anon', null, $q$select count(*)::text from alertes_publiques where titre = 'Test A1 fermeture parking'$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'A1-10 la provenance d''une alerte reçue ne se change pas en « interne »',
  pg_temp.essai('authenticated', membre,
    $q$update alertes_publiques set provenance = 'interne' where titre = 'Test A1 fermeture parking'$q$)
from t_ids;

-- A2 : alerte interne sans incident -------------------------------------------------------------

insert into t_rep (etape, resultat) select
  'A2-1 alerte interne active sans incident ni « hors incident » : refusée',
  pg_temp.essai('authenticated', membre,
    format($q$insert into alertes_publiques (contexte_id, titre, message, niveau_alerte, actif)
              values (%L, 'Test A2 sans incident', 'x', 'info', true)$q$, commune))
from t_ids;
insert into t_rep (etape, resultat) select
  'A2-2 même alerte marquée « hors incident », aucun exercice en cours : publiée',
  pg_temp.essai('authenticated', membre,
    format($q$insert into alertes_publiques (contexte_id, titre, message, niveau_alerte, actif, hors_incident)
              values (%L, 'Test A2 prévention canicule', 'x', 'vigilance', true, true)$q$, commune))
from t_ids;
insert into t_rep (etape, resultat) select
  'A2-3 brouillon inactif sans incident : accepté ; son activation sans « hors incident » : refusée',
  pg_temp.essai('authenticated', membre,
    format($q$insert into alertes_publiques (contexte_id, titre, message, niveau_alerte, actif)
              values (%L, 'Test A2 brouillon', 'x', 'info', false)$q$, commune), null, false)
  || ' / ' ||
  pg_temp.essai('authenticated', membre, $q$update alertes_publiques set actif = true where titre = 'Test A2 brouillon'$q$)
from t_ids;

-- Exercice « dans l'outil » en cours dans la commune, avec son incident d'exercice.
insert into incidents (contexte_id, nom, type_evenement, statut, est_exercice)
select commune, '[EXERCICE] Test A2', 'exercice', 'en_cours', true from t_ids;
insert into exercices (contexte_id, titre, mode_jeu, incident_id)
select commune, 'Test A2', 'dans_outil', (select id from incidents where nom = '[EXERCICE] Test A2') from t_ids;
update exercices set statut = 'en_cours', debut_reel = now() where titre = 'Test A2';

insert into t_rep (etape, resultat) select
  'A2-4 exercice en cours : alerte « hors incident » sans confirmation renforcée : refusée',
  pg_temp.essai('authenticated', membre,
    format($q$insert into alertes_publiques (contexte_id, titre, message, niveau_alerte, actif, hors_incident)
              values (%L, 'Test A2 pendant exercice', 'x', 'urgence', true, true)$q$, commune))
from t_ids;
insert into t_rep (etape, resultat) select
  'A2-5 exercice en cours : alerte « hors incident » confirmée réelle : publiée (contrôle : auteur de la confirmation)',
  pg_temp.essai('authenticated', membre,
    format($q$insert into alertes_publiques (contexte_id, titre, message, niveau_alerte, actif, hors_incident, alerte_reelle_confirmee)
              values (%L, 'Test A2 réelle pendant exercice', 'x', 'urgence', true, true, true)$q$, commune),
    $q$select (confirmee_par = auth.uid())::text from alertes_publiques where titre = 'Test A2 réelle pendant exercice'$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'A2-6 exercice en cours : alerte rattachée à l''incident d''exercice : refusée (garde-fou existant)',
  pg_temp.essai('authenticated', membre,
    format($q$insert into alertes_publiques (contexte_id, incident_id, titre, message, niveau_alerte, actif)
              values (%L, (select id from incidents where nom = '[EXERCICE] Test A2'), 'Test A2 exercice', 'x', 'urgence', true)$q$, commune))
from t_ids;
insert into t_rep (etape, resultat) select
  'A2-7 exercice en cours : alerte rattachée à l''incident réel en cours : publiée sans confirmation (invariant 1)'
  || case when incident_reel is null then ' [aucun incident réel en cours]' else '' end,
  pg_temp.essai('authenticated', membre,
    format($q$insert into alertes_publiques (contexte_id, incident_id, titre, message, niveau_alerte, actif)
              values (%L, %L, 'Test A2 incident réel', 'x', 'urgence', true)$q$, commune, incident_reel))
from t_ids;
insert into t_rep (etape, resultat) select
  'A2-8 une alerte reçue d''un organisateur n''est pas soumise à A2 : la validation la publie pendant l''exercice',
  pg_temp.essai('service_role', null,
    format($q$insert into alertes_publiques (contexte_id, titre, message, niveau_alerte, provenance)
              values (%L, 'Test A2 reçue', 'x', 'info', 'externe')$q$, commune), null, false)
  || ' / ' ||
  pg_temp.essai('authenticated', membre,
    $q$select valider_alerte_recue((select id from alertes_publiques where titre = 'Test A2 reçue'), true)$q$,
    $q$select actif::text from alertes_publiques where titre = 'Test A2 reçue'$q$)
from t_ids;

-- Droits ------------------------------------------------------------------------------------------

insert into t_rep (etape, resultat) values
  ('A-9 fonctions internes non exécutables par anon / authenticated (attendu : false partout)',
   (select string_agg(p.proname || ' ' || has_function_privilege('anon', p.oid, 'execute') || '/'
                      || has_function_privilege('authenticated', p.oid, 'execute'), ', ' order by p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('alertes_publiques_garde_fous', 'alertes_publiques_notifier_reception',
                                                  'exercice_dans_outil_en_cours', 'pas_de_lien_public_avec_exercice'))),
  ('A-10 valider_alerte_recue : anon / authenticated (attendu false/true)',
   (select has_function_privilege('anon', 'public.valider_alerte_recue(uuid, boolean, text)', 'execute') || '/'
           || has_function_privilege('authenticated', 'public.valider_alerte_recue(uuid, boolean, text)', 'execute')));

do $$
begin
  raise exception 'RESULTATS %', (select json_agg(json_build_object('etape', etape, 'resultat', resultat) order by n) from t_rep);
end $$;
