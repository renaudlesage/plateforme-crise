-- Tests de C6 (migration 20261113110000_c06a_coordination_cellule.sql), à exécuter dans le SQL Editor après la
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
  gen_random_uuid() as etranger,
  null::uuid as incident, null::uuid as centre, null::uuid as consigne, null::uuid as modele, null::uuid as processus,
  null::uuid as equipe_membre, null::uuid as equipe_sans_compte
from contextes c where c.nom = 'Commune Test';
grant select, update on t_ids to anon, authenticated, service_role;
grant select, insert on t_rep to anon, authenticated, service_role;
grant usage on sequence t_rep_n_seq to anon, authenticated, service_role;

-- Incident réel dédié au test, et un centre d'accueil.
insert into incidents (contexte_id, nom, type_evenement, statut, date_debut)
select commune, 'Test C6', 'autre', 'en_cours', now() from t_ids;
update t_ids set incident = (select id from incidents where nom = 'Test C6' and contexte_id = commune order by date_debut desc limit 1);
insert into centres_accueil (contexte_id, nom, type_lieu) select commune, 'Centre test C6', 'salle' from t_ids;
update t_ids set centre = (select id from centres_accueil where nom = 'Centre test C6' and contexte_id = commune limit 1);

create function pg_temp.nb_ldb() returns bigint language sql as $f$ select count(*) from livre_de_bord where incident_id = (select incident from t_ids) $f$;

-- 1. Consignes
insert into t_rep (etape, resultat) select 'C6-1 consigne émise par un membre (destinataires figés, ligne au livre de bord)',
  pg_temp.valeur('authenticated', membre, format($q$select emettre_consigne(%L, 'Fermer la rue Haute', 'Barrières en place avant 18h', %L, 'urgente')$q$, commune, incident)) from t_ids;
update t_ids set consigne = (select id from consignes where titre = 'Fermer la rue Haute' and contexte_id = commune);
insert into t_rep (etape, resultat) select 'C6-1b destinataires = membres de la commune ; livre de bord',
  (select count(*) from consignes_destinataires where consigne_id = consigne)::text || ' / ' ||
  (select count(*) from acces_utilisateurs where contexte_id = commune)::text || ' / ldb ' || pg_temp.nb_ldb() from t_ids;
insert into t_rep (etape, resultat) select 'C6-2 anonyme : refusé',
  pg_temp.valeur('anon', null, format($q$select emettre_consigne(%L, 'x', 'y')$q$, commune)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-3 non-membre : refusé',
  pg_temp.valeur('authenticated', etranger, format($q$select emettre_consigne(%L, 'x', 'y')$q$, commune)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-4 rôle d''une autre commune : refusé',
  pg_temp.valeur('authenticated', membre, format($q$select emettre_consigne(%L, 'x', 'y', null, 'normale', array[%L]::uuid[])$q$, commune, gen_random_uuid())) from t_ids;
insert into t_rep (etape, resultat) select 'C6-5 mes consignes non lues',
  pg_temp.valeur('authenticated', membre, format($q$select count(*) from mes_consignes(%L)$q$, commune)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-6 accusé de lecture',
  pg_temp.essai('authenticated', membre, format($q$select accuser_lecture_consigne(%L)$q$, consigne),
    format($q$select (lu_le is not null)::text from consignes_destinataires where consigne_id = %L and user_id = %L$q$, consigne, membre), false) from t_ids;
insert into t_rep (etape, resultat) select 'C6-6b plus dans les non lues',
  pg_temp.valeur('authenticated', membre, format($q$select count(*) from mes_consignes(%L) where id = %L$q$, commune, consigne)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-7 accusé par un non-destinataire : refusé',
  pg_temp.valeur('authenticated', etranger, format($q$select accuser_lecture_consigne(%L)::text$q$, consigne)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-8 écriture directe : refusée',
  pg_temp.essai('authenticated', membre, format($q$insert into consignes (contexte_id, titre, texte) values (%L, 'x', 'y')$q$, commune)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-8b accusé truqué en direct : refusé',
  pg_temp.essai('authenticated', membre, format($q$update consignes_destinataires set lu_le = now() where consigne_id = %L$q$, consigne)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-9 annulation par un membre « écriture »',
  pg_temp.essai('authenticated', membre, format($q$select annuler_consigne(%L)$q$, consigne),
    format($q$select (annulee_le is not null)::text from consignes where id = %L$q$, consigne), false) from t_ids;

-- 2. Présences
insert into t_rep (etape, resultat) select 'C6-10 arrivée au CC (ligne au livre de bord)',
  pg_temp.essai('authenticated', membre, format($q$insert into presences_cellule (contexte_id, incident_id, user_id, nom, fonction) values (%L, %L, %L, 'Membre test', 'D5')$q$, commune, incident, membre),
    'select pg_temp.nb_ldb()::text', false) from t_ids;
insert into t_rep (etape, resultat) select 'C6-11 seconde présence ouverte du même compte : refusée',
  pg_temp.essai('authenticated', membre, format($q$insert into presences_cellule (contexte_id, incident_id, user_id, nom) values (%L, %L, %L, 'Membre test')$q$, commune, incident, membre)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-12 nom modifié après coup : refusé',
  pg_temp.essai('authenticated', membre, format($q$update presences_cellule set nom = 'Autre' where incident_id = %L$q$, incident)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-12b départ (ligne au livre de bord)',
  pg_temp.essai('authenticated', membre, format($q$update presences_cellule set depart_le = now() where incident_id = %L$q$, incident),
    'select pg_temp.nb_ldb()::text', false) from t_ids;
insert into t_rep (etape, resultat) select 'C6-13 non-membre : arrivée refusée',
  pg_temp.essai('authenticated', etranger, format($q$insert into presences_cellule (contexte_id, incident_id, nom) values (%L, %L, 'Intrus')$q$, commune, incident)) from t_ids;

-- 3. Capacités
insert into t_rep (etape, resultat) select 'C6-14 relevé 50/100 : normal, rien au livre de bord',
  pg_temp.essai('authenticated', membre, format($q$insert into occupations_centres (contexte_id, centre_id, incident_id, places_ouvertes, places_occupees) values (%L, %L, %L, 100, 50)$q$, commune, centre, incident),
    format($q$select niveau || ' / ldb ' || pg_temp.nb_ldb() from centres_accueil_occupation where centre_id = %L$q$, centre), false) from t_ids;
insert into t_rep (etape, resultat) select 'C6-15 relevé 85/100 : tension, tracée',
  pg_temp.essai('authenticated', membre, format($q$insert into occupations_centres (contexte_id, centre_id, incident_id, places_ouvertes, places_occupees) values (%L, %L, %L, 100, 85)$q$, commune, centre, incident),
    format($q$select niveau || ' / ldb ' || pg_temp.nb_ldb() from centres_accueil_occupation where centre_id = %L$q$, centre), false) from t_ids;
insert into t_rep (etape, resultat) select 'C6-16 relevé 96/100 : critique, tracée',
  pg_temp.essai('authenticated', membre, format($q$insert into occupations_centres (contexte_id, centre_id, incident_id, places_ouvertes, places_occupees) values (%L, %L, %L, 100, 96)$q$, commune, centre, incident),
    format($q$select niveau || ' / ldb ' || pg_temp.nb_ldb() from centres_accueil_occupation where centre_id = %L$q$, centre), false) from t_ids;
insert into t_rep (etape, resultat) select 'C6-17 seuils incohérents : refusés',
  pg_temp.essai('postgres', null, format($q$update centres_accueil set seuil_tension_pct = 90, seuil_critique_pct = 80 where id = %L$q$, centre)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-18 non-membre : relevé refusé',
  pg_temp.essai('authenticated', etranger, format($q$insert into occupations_centres (contexte_id, centre_id, places_ouvertes, places_occupees) values (%L, %L, 10, 1)$q$, commune, centre)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-18b vue lue par un non-membre : 0 ligne',
  pg_temp.valeur('authenticated', etranger, format($q$select count(*) from centres_accueil_occupation where centre_id = %L$q$, centre)) from t_ids;

-- 4. Processus
insert into t_rep (etape, resultat) select 'C6-19 modèle sans étape : refusé',
  pg_temp.essai('authenticated', membre, format($q$insert into processus_modeles (contexte_id, nom, etapes) values (%L, 'Vide', '[]')$q$, commune)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-19b réponses en double : refusé',
  pg_temp.essai('authenticated', membre, format($q$insert into processus_modeles (contexte_id, nom, etapes) values (%L, 'Double', '[{"question": "Q", "reponses": [{"libelle": "Oui"}, {"libelle": "oui"}]}]')$q$, commune)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-20 modèle valide',
  pg_temp.essai('authenticated', membre, format($q$insert into processus_modeles (contexte_id, nom, etapes) values (%L, 'Évacuation de rue', '[{"question": "Arrivés sur place ?", "reponses": [{"libelle": "Oui"}, {"libelle": "Accès impossible", "fin": true}]}, {"question": "Rue évacuée ?", "reponses": [{"libelle": "Oui"}, {"libelle": "Partiellement"}]}]')$q$, commune),
    null, false) from t_ids;
update t_ids set modele = (select id from processus_modeles where nom = 'Évacuation de rue' and contexte_id = commune);
insert into t_rep (etape, resultat) select 'C6-21 lancement pour deux équipes',
  pg_temp.valeur('authenticated', membre, format($q$select lancer_processus(%L, %L, jsonb_build_array(jsonb_build_object('libelle', 'Équipe membre', 'user_id', %L), jsonb_build_object('libelle', 'Équipe sans compte')))::text$q$, incident, modele, membre)) from t_ids;
update t_ids set processus = (select id from processus_lances where incident_id = incident),
                 equipe_membre = (select pa.id from processus_participants pa join processus_lances p on p.id = pa.processus_id where p.incident_id = incident and pa.libelle = 'Équipe membre'),
                 equipe_sans_compte = (select pa.id from processus_participants pa join processus_lances p on p.id = pa.processus_id where p.incident_id = incident and pa.libelle = 'Équipe sans compte');
insert into t_rep (etape, resultat) select 'C6-21b participant d''une autre commune : refusé',
  pg_temp.valeur('authenticated', membre, format($q$select lancer_processus(%L, %L, jsonb_build_array(jsonb_build_object('libelle', 'X', 'user_id', %L)))::text$q$, incident, modele, etranger)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-22 l''équipe répond « oui » : étape suivante',
  pg_temp.essai('authenticated', membre, format($q$select repondre_processus(%L, 'oui')$q$, equipe_membre),
    format($q$select etape_courante || ' / ' || coalesce(termine_le::text, 'en cours') from processus_participants where id = %L$q$, equipe_membre), false) from t_ids;
insert into t_rep (etape, resultat) select 'C6-23 réponse non prévue : refusée',
  pg_temp.essai('authenticated', membre, format($q$select repondre_processus(%L, 'Peut-être')$q$, equipe_membre)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-24 réponse « fin » pour l''autre équipe (par le CC) : terminé',
  pg_temp.essai('authenticated', membre, format($q$select repondre_processus(%L, 'Accès impossible', 'Arbre sur la route')$q$, equipe_sans_compte),
    format($q$select etape_courante || ' / ' || (termine_le is not null)::text from processus_participants where id = %L$q$, equipe_sans_compte), false) from t_ids;
insert into t_rep (etape, resultat) select 'C6-25 non-membre : réponse refusée',
  pg_temp.essai('authenticated', etranger, format($q$select repondre_processus(%L, 'Oui')$q$, equipe_membre)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-26 dernière étape : terminé ; puis réponse refusée',
  pg_temp.essai('authenticated', membre, format($q$select repondre_processus(%L, 'Partiellement')$q$, equipe_membre),
    format($q$select (termine_le is not null)::text || ' / réponses ' || (select count(*) from processus_reponses where participant_id = %L) from processus_participants where id = %L$q$, equipe_membre, equipe_membre), false) from t_ids;
insert into t_rep (etape, resultat) select 'C6-26b réponse après la fin : refusée',
  pg_temp.essai('authenticated', membre, format($q$select repondre_processus(%L, 'Oui')$q$, equipe_membre)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-27 écriture directe des réponses : refusée',
  pg_temp.essai('authenticated', membre, format($q$insert into processus_reponses (participant_id, etape, reponse) values (%L, 0, 'Oui')$q$, equipe_membre)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-28 livre de bord : lignes de C6 sur l''incident',
  (select string_agg(left(message, 40), ' | ' order by numero_ordre) from livre_de_bord where incident_id = (select incident from t_ids));

-- 5. Couches
insert into t_rep (etape, resultat) select 'C6-29 couche WMS de la commune',
  pg_temp.essai('authenticated', membre, format($q$insert into couches_carte (contexte_id, nom, type, url, couches) values (%L, 'Couche test', 'wms', 'https://exemple.invalid/wms', 'couche1')$q$, commune)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-30 adresse http : refusée',
  pg_temp.essai('authenticated', membre, format($q$insert into couches_carte (contexte_id, nom, type, url, couches) values (%L, 'x', 'wms', 'http://exemple.invalid/wms', 'c')$q$, commune)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-31 WMS sans nom de couche : refusé',
  pg_temp.essai('authenticated', membre, format($q$insert into couches_carte (contexte_id, nom, type, url) values (%L, 'x', 'wms', 'https://exemple.invalid/wms')$q$, commune)) from t_ids;
insert into t_rep (etape, resultat) select 'C6-32 couche de la plateforme par un membre : refusée',
  pg_temp.essai('authenticated', membre, $q$insert into couches_carte (nom, type, url) values ('x', 'xyz', 'https://exemple.invalid/{z}/{x}/{y}.png')$q$) from t_ids;
insert into t_rep (etape, resultat) select 'C6-33 couche XYZ de la plateforme par le super-admin',
  pg_temp.essai('authenticated', 'd8de073c-265e-4cb8-9df4-eff3c76e5d52'::uuid, $q$insert into couches_carte (nom, type, url) values ('x', 'xyz', 'https://exemple.invalid/{z}/{x}/{y}.png')$q$);

do $$ begin raise exception 'RESULTATS %', (select string_agg(n || ' ' || etape || ' => ' || resultat, E'\n' order by n) from t_rep); end $$;
rollback;
