-- Tests du moteur de réveil (migration C1 20261021120000), à exécuter dans le SQL Editor
-- après les migrations 20261021090000 et 20261021120000.
-- Tout se passe dans une transaction annulée par l'exception finale, qui affiche les
-- résultats : rien n'est conservé. Comptes : un membre « écriture » de la Commune Test
-- (province de Liège) qui n'est pas destinataire du réveil, le compte qui porte le rôle
-- AUTORITE_COMMUNALE (bourgmestre), le super-admin, l'anonyme et la clé de service.
-- Règles posées pour le test : orage jaune → S0 et orage orange → S1 (fiche
-- STARTER-REX-2026-ORAGES) ; un suppléant fictif du bourgmestre est ajouté à l'annuaire.

begin;
create temp table t_rep (n serial, etape text, resultat text);

-- Exécute p_sql sous un rôle et un utilisateur donnés ; annule l'effet par défaut.
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

-- Renvoie la première valeur de p_sql exécuté sous un rôle et un utilisateur donnés.
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

-- Bilan d'un avertissement : traitement, réveil, événement, déclenchement, journal, notifications.
create function pg_temp.bilan(p_identifiant text) returns text language sql as $f$
  select coalesce(string_agg(
           t.nb_reveils || ' réveil(s), erreur ' || coalesce(t.erreur, 'aucune')
           || coalesce(' | seuil ' || s.libelle || ' | ' || i.nom || ' (' || i.statut || ', ' || i.phase_cycle_vie
                       || ', exercice ' || i.est_exercice || ') | déclenchement ' || d.statut || ', lié à l''avertissement '
                       || (d.alerte_externe_id is not null) || ' | journal : ' || j.decision || ' — ' || j.base_decision
                       || ' | notifications : ' || (select coalesce(string_agg(n.canal || ' ' || n.statut || ' « ' || n.titre || ' »', ', ' order by n.canal), 'aucune')
                                                    from notifications n where n.reveil_id = r.id), ''), ' // '),
         'pas de traitement')
  from alertes_externes a
  join alertes_externes_traitements t on t.alerte_externe_id = a.id
  left join reveils r on r.alerte_externe_id = a.id
  left join seuils_action s on s.id = r.seuil_action_id
  left join incidents i on i.id = r.incident_id
  left join declenchements_seuils_action d on d.id = r.declenchement_id
  left join lateral (select x.decision, x.base_decision from journal_decisions x
                     where x.declenchement_seuil_id = d.id and x.decide_par = 'Réveil automatique' and x.decision like 'Seuil%'
                     order by x.numero_ordre desc limit 1) j on true
  where a.identifiant = p_identifiant or a.titre = p_identifiant;
$f$;

create temp table t_ids as
select c.id as commune,
  (select au.user_id from acces_utilisateurs au left join roles r on r.id = au.role_id
   where au.contexte_id = c.id and au.niveau_acces = 'ecriture'
     and coalesce(r.code, '') not in ('PLANU', 'AUTORITE_COMMUNALE')
     and not exists (select 1 from acces_utilisateurs a2 join contextes p on p.id = a2.contexte_id
                     where a2.user_id = au.user_id and p.est_plateforme and a2.niveau_acces = 'admin')
   order by au.user_id limit 1) as membre,
  (select au.user_id from acces_utilisateurs au join roles r on r.id = au.role_id
   where au.contexte_id = c.id and r.code = 'AUTORITE_COMMUNALE' order by au.user_id limit 1) as bourgmestre,
  (select a2.user_id from acces_utilisateurs a2 join contextes p on p.id = a2.contexte_id
   where p.est_plateforme and a2.niveau_acces = 'admin' limit 1) as super_admin,
  (select ct.id from contacts ct join roles r on r.id = ct.role_id
   where ct.contexte_id = c.id and r.code = 'AUTORITE_COMMUNALE' and ct.actif limit 1) as contact_bourgmestre,
  (select s.id from seuils_action s join risques_territoire r on r.id = s.risque_id
   where r.contexte_id = c.id and r.code = 'STARTER-REX-2026-ORAGES' and s.ordre = 1) as seuil_s0,
  (select s.id from seuils_action s join risques_territoire r on r.id = s.risque_id
   where r.contexte_id = c.id and r.code = 'STARTER-REX-2026-ORAGES' and s.ordre = 2) as seuil_s1
from contextes c where c.nom = 'Commune Test';

insert into regles_reveil (contexte_id, seuil_action_id, type_alerte, niveau_min)
select commune, seuil_s0, 'orage', 'jaune' from t_ids
union all
select commune, seuil_s1, 'orage', 'orange' from t_ids;
insert into contacts (contexte_id, categorie, nom, email, est_suppleant_de, actif)
select commune, 'Autorités', 'Suppléant (test C1)', 'suppleant@exemple.invalid', contact_bourgmestre, true
from t_ids where contact_bourgmestre is not null;

-- Moteur ------------------------------------------------------------------------------------------

insert into t_rep (etape, resultat) values
  ('M-1 orange orages Liège reçu par l''ingestion : seul S1 est armé, événement en veille, journal, file de notifications',
   pg_temp.essai('service_role', null,
     $q$insert into alertes_externes (source, identifiant, expediteur, emis_le, evenement, type_alerte, niveau, debut_le, fin_le, titre, provinces)
        values ('meteoalarm', 'test.c1.orange-orages-liege', 'fixtures@crisiware.invalid', now() - interval '2 minutes',
                'Avertissement orages', 'orage', 'orange', now(), now() + interval '6 hours', 'Orange orages Liège', '{Liège}')$q$,
     $q$select pg_temp.bilan('test.c1.orange-orages-liege')$q$, false));
insert into t_rep (etape, resultat) values
  ('M-2 mise à jour du même avertissement, toujours orange : aucun nouveau réveil',
   pg_temp.essai('service_role', null,
     $q$insert into alertes_externes (source, identifiant, expediteur, emis_le, type_message, references_cap, evenement, type_alerte, niveau, provinces)
        values ('meteoalarm', 'test.c1.orange-maj', 'fixtures@crisiware.invalid', now() - interval '1 minute', 'Update',
                '{test.c1.orange-orages-liege}', 'Avertissement orages', 'orage', 'orange', '{Liège}')$q$,
     $q$select pg_temp.bilan('test.c1.orange-maj')$q$, false));
insert into t_rep (etape, resultat) values
  ('M-3 mise à jour rouge : nouveau réveil sur le même événement et le même déclenchement (contrôle : déclenchements / réveils de l''événement)',
   pg_temp.essai('service_role', null,
     $q$insert into alertes_externes (source, identifiant, expediteur, emis_le, type_message, references_cap, evenement, type_alerte, niveau, provinces)
        values ('meteoalarm', 'test.c1.rouge-maj', 'fixtures@crisiware.invalid', now(), 'Update',
                '{test.c1.orange-maj}', 'Avertissement orages', 'orage', 'rouge', '{Liège}')$q$,
     $q$select (select count(*) from declenchements_seuils_action d where d.incident_id = r.incident_id) || ' / '
               || (select count(*) from reveils x where x.incident_id = r.incident_id)
               || ' | ' || pg_temp.bilan('test.c1.rouge-maj')
        from reveils r join alertes_externes a on a.id = r.alerte_externe_id where a.identifiant = 'test.c1.rouge-maj'$q$, false));
insert into t_rep (etape, resultat) values
  ('M-4 nouvel avertissement jaune sur Liège pendant l''événement rouge : aucun réveil',
   pg_temp.essai('service_role', null,
     $q$insert into alertes_externes (source, identifiant, expediteur, emis_le, evenement, type_alerte, niveau, provinces)
        values ('meteoalarm', 'test.c1.jaune-autre', 'fixtures@crisiware.invalid', now(), 'Avertissement orages', 'orage', 'jaune', '{Liège}')$q$,
     $q$select pg_temp.bilan('test.c1.jaune-autre')$q$, false));
-- Les vérifications qui lisent ce qu'une instruction précédente a écrit sont des instructions à part.
insert into t_rep (etape, resultat) select
  'M-5 fixture orange du super-admin',
  pg_temp.essai('authenticated', super_admin,
    format($q$insert into alertes_externes (source, contexte_id, evenement, type_alerte, niveau, titre)
              values ('fixture', %L, 'Démonstration D1', 'orage', 'orange', 'Fixture M-5')$q$, commune),
    null, false)
from t_ids;
insert into t_rep (etape, resultat) values
  ('M-5b bilan : événement d''exercice distinct, notifications marquées EXERCICE', pg_temp.bilan('Fixture M-5'));
insert into t_rep (etape, resultat) select
  'M-6 saisie manuelle orange par le membre pendant l''événement rouge réel',
  pg_temp.essai('authenticated', membre,
    format($q$insert into alertes_externes (source, contexte_id, evenement, type_alerte, niveau, titre)
              values ('saisie', %L, 'Avertissement reçu par téléphone', 'orage', 'orange', 'Saisie M-6')$q$, commune),
    null, false)
from t_ids;
insert into t_rep (etape, resultat) values
  ('M-6b bilan : aucun réveil', pg_temp.bilan('Saisie M-6'));

-- Lecture et droits -----------------------------------------------------------------------------

insert into t_rep (etape, resultat) select
  'M-7 le membre voit les réveils et les notifications de sa commune (réveils / notifications)',
  pg_temp.valeur('authenticated', membre, format($q$select (select count(*) from reveils where contexte_id = %L) || ' / '
                                                          || (select count(*) from notifications where contexte_id = %L)$q$, commune, commune))
from t_ids;
insert into t_rep (etape, resultat) select
  'M-8 le membre écrit directement un réveil / une notification',
  pg_temp.essai('authenticated', membre, $q$insert into reveils (contexte_id) values (gen_random_uuid())$q$)
  || ' / ' ||
  pg_temp.essai('authenticated', membre, $q$insert into notifications (contexte_id, canal, motif, titre, message) values (gen_random_uuid(), 'push', 'reveil', 'x', 'x')$q$)
from t_ids;

-- Acquittement ---------------------------------------------------------------------------------

insert into t_rep (etape, resultat) select
  'M-9 le membre acquitte le réveil rouge (« Vu, je prends ») : déjà acquitté ?, par lui ?',
  pg_temp.valeur('authenticated', membre,
    $q$select deja_acquitte::text || ', par moi : ' || (acquitte_par = auth.uid())::text
       from acquitter_reveil((select r.id from reveils r join alertes_externes a on a.id = r.alerte_externe_id where a.identifiant = 'test.c1.rouge-maj'))$q$)
from t_ids;
insert into t_rep (etape, resultat) select
  'M-9b le bourgmestre acquitte ensuite le même réveil : déjà acquitté ?',
  pg_temp.valeur('authenticated', bourgmestre,
    $q$select deja_acquitte::text from acquitter_reveil((select r.id from reveils r join alertes_externes a on a.id = r.alerte_externe_id where a.identifiant = 'test.c1.rouge-maj'))$q$)
from t_ids;
insert into t_rep (etape, resultat) values
  ('M-9c journal : une seule entrée d''acquittement',
   (select count(*) || ' : ' || string_agg(j.decision || ' — ' || j.decide_par || ' — ' || j.base_decision, ' ; ')
    from journal_decisions j join reveils r on r.declenchement_id = j.declenchement_seuil_id join alertes_externes a on a.id = r.alerte_externe_id
    where a.identifiant = 'test.c1.rouge-maj' and j.decision like 'Réveil acquitté%'));
insert into t_rep (etape, resultat) values
  ('M-10 l''anonyme acquitte un réveil',
   pg_temp.valeur('anon', null, $q$select deja_acquitte::text from acquitter_reveil(gen_random_uuid())$q$));
insert into t_rep (etape, resultat) select
  'M-11 le membre acquitte un réveil inconnu',
  pg_temp.valeur('authenticated', membre, $q$select deja_acquitte::text from acquitter_reveil(gen_random_uuid())$q$)
from t_ids;

-- Escalade --------------------------------------------------------------------------------------

update reveils set arme_le = now() - interval '20 minutes'
where alerte_externe_id = (select id from alertes_externes where identifiant = 'test.c1.orange-orages-liege');
insert into t_rep (etape, resultat) values
  ('M-12 escalade : réveils escaladés (seul l''orange non acquitté depuis 20 min)',
   pg_temp.valeur('postgres', null, $q$select public.reveil_escalader()::text$q$));
insert into t_rep (etape, resultat) values
  ('M-12b notification au suppléant, journal, état de la tâche',
   (select coalesce(string_agg(n.canal || ' ' || n.motif || ' « ' || n.titre || ' »', ', '), 'aucune notification')
    from notifications n join reveils r on r.id = n.reveil_id join alertes_externes a on a.id = r.alerte_externe_id
    where a.identifiant = 'test.c1.orange-orages-liege' and n.motif = 'escalade')
   || ' | ' ||
   coalesce((select string_agg(j.decision || ' — ' || j.base_decision, ' ; ')
             from journal_decisions j join reveils r on r.declenchement_id = j.declenchement_seuil_id join alertes_externes a on a.id = r.alerte_externe_id
             where a.identifiant = 'test.c1.orange-orages-liege' and j.decision like 'Escalade%'), 'pas d''entrée au journal')
   || ' | tâche : ' ||
   (select (dernier_succes_le = now())::text || ', échecs ' || echecs_consecutifs from jobs_etat where nom = 'reveil_escalade'));
insert into t_rep (etape, resultat) values
  ('M-13 deuxième passage de l''escalade : rien de plus',
   pg_temp.valeur('postgres', null, $q$select public.reveil_escalader()::text$q$));

-- Déclenchements, paramètres, tâche planifiée ------------------------------------------------------

insert into t_rep (etape, resultat) select
  'M-14 le membre attache un avertissement à un déclenchement / crée un déclenchement manuel (comportement actuel du QG)',
  pg_temp.essai('authenticated', membre,
    $q$update declenchements_seuils_action set alerte_externe_id = (select id from alertes_externes where identifiant = 'test.c1.jaune-autre')
       where id = (select r.declenchement_id from reveils r join alertes_externes a on a.id = r.alerte_externe_id where a.identifiant = 'test.c1.rouge-maj')$q$)
  || ' / ' ||
  pg_temp.essai('authenticated', membre,
    format($q$insert into declenchements_seuils_action (incident_id, seuil_action_id, statut)
              values ((select r.incident_id from reveils r join alertes_externes a on a.id = r.alerte_externe_id where a.identifiant = 'test.c1.rouge-maj'), %L, 'en_attente')$q$, seuil_s0))
from t_ids;
insert into t_rep (etape, resultat) select
  'M-15 paramètres du réveil : le membre choisit PLANU seul et 5 min (contrôle : auteur) / l''anonyme lit',
  pg_temp.essai('authenticated', membre,
    format($q$insert into parametres_reveil (contexte_id, roles_a_reveiller, delai_escalade) values (%L, '{PLANU}', interval '5 minutes')$q$, commune),
    $q$select (maj_par = auth.uid())::text || ', ' || array_to_string(roles_a_reveiller, ',') || ', ' || delai_escalade from parametres_reveil$q$)
  || ' / ' ||
  pg_temp.valeur('anon', null, $q$select count(*)::text from parametres_reveil$q$)
from t_ids;
insert into t_rep (etape, resultat) values
  ('M-16 tâche planifiée',
   (select string_agg(jobname || ' « ' || schedule || ' » ' || command, ' ; ') from cron.job where jobname = 'reveil_escalade'));

-- En dernier : une panne du moteur n'empêche pas d'enregistrer l'avertissement.
create or replace function public.reveil_traiter_alerte(p_alerte_id uuid) returns integer language plpgsql as $f$
begin
  raise exception 'panne simulée du moteur';
end $f$;
insert into t_rep (etape, resultat) values
  ('M-17 panne simulée du moteur : l''avertissement est enregistré, l''erreur est tracée',
   pg_temp.essai('service_role', null,
     $q$insert into alertes_externes (source, identifiant, expediteur, emis_le, evenement, type_alerte, niveau, provinces)
        values ('meteoalarm', 'test.c1.panne', 'fixtures@crisiware.invalid', now(), 'Avertissement orages', 'orage', 'rouge', '{Namur}')$q$,
     $q$select count(*) || ' avertissement, ' || pg_temp.bilan('test.c1.panne') from alertes_externes where identifiant = 'test.c1.panne'$q$));

do $$
begin
  raise exception 'RESULTATS %', (select json_agg(json_build_object('etape', etape, 'resultat', resultat) order by n) from t_rep);
end $$;
