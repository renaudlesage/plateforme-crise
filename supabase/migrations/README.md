# Migrations Supabase

Ce dossier est versionné depuis le 18 octobre 2026. Les migrations antérieures (schéma initial, modules, exercices,
journal des décisions…) ont été appliquées directement sur le projet `apjswshvzbejpvlxfnek` et ne sont pas toutes
reproduites ici : la base de production fait foi. Chaque fichier ci-dessous a été appliqué tel quel.

| Fichier | Objet |
|---|---|
| `20261018120000_journal_decisions_auteurs.sql` | Fonction `journal_decisions_auteurs` (auteur des saisies du journal) |
| `20261018140000_pont_commune_evenements.sql` | Pont commune → événements : tables, droits, propositions automatiques, envoi après validation |
| `20261018160000_situation_capacite.sql` | Capacité `situation` ajoutée aux rôles |
| `20261018160100_situation_societale.sql` | Page CC › Situation : sources, épingles personnelles, vérifications partagées (ajout seul) |
| `20261018160200_situation_referentiel_national.sql` | Chargement des 42 sources nationales de départ |
| `20261019090000_entraide_fondations.sql` | Entraide (bénévoles et moyens privés) : capacité `entraide`, coordinateur par incident, enrichissement de `benevoles_entraide`, `ressources`, `moyens_engages`, `requisitions`, fonctions de commandement |
| `20261019090100_entraide_tables.sql` | Points d'accueil, présences, équipes, missions (historique en ajout seul), paramètres communaux, incidents bénévoles, points de collecte, besoins, consignes publiques |
| `20261019090200_entraide_rpc_publiques.sql` | Accès sans compte par QR (enregistrement, suivi, sortie), déclaration d'un moyen privé, page publique de l'entraide |
| `20261019120000_console_plateforme.sql` | Console Plateforme : suspension d'un client (`contextes.suspendu`, prise en compte par `mon_niveau_acces`), journal `journal_plateforme`, fonctions `plateforme_*` réservées au super-admin |
| `20261020130000_risques_territoire.sql` | Risques du territoire : table `risques_territoire` (menace, distincte de l'objet à risque), liens objet ↔ risque (rôle source / enjeu) et risque ↔ fonctions critiques, `risque_id` sur les seuils, plans de référence, plans d'action, évaluations et mesures, repointage de `exercices.fiche_risque_id` et du triage PGUI, fusion de `matrice_risques`, déplacement des fiches STARTER, retrait des huit champs scénario d'`objets_a_risque` |
| `20261020160000_correctifs_securite.sql` | Correctifs de sécurité : droits par colonne et trigger de garde sur `contextes`, inscriptions publiques de bénévoles forcées « en_attente », plus d'insertion directe dans `plans_urgence_menages`, `contextes_publics()` sans plateforme ni clients suspendus, journal des ingestions externes borné, droits inutiles retirés à `anon` et `authenticated` |
| `20261020213000_f5_journal_empreinte.sql` | F5 : références signalement / alerte sur `journal_decisions`, empreinte SHA-256 chaînée calculée à l'insertion, `verifier_journal_decisions()` |
| `20261020213100_f3_planification.sql` | F3 : extensions `pg_cron` et `pg_net`, table `jobs_etat`, `jobs_signaler()`, `jobs_muets()` |
| `20261020213200_f1_communes_be.sql` | F1 : table `communes_be` ; données dans `supabase/seed/communes_be.sql` (565 communes ; zones de secours et de police des communes wallonnes d'après Eventware), généré par `scripts/seed/communes_be.py` |
| `20261021090000_c1_alertes_externes_regles_reveil.sql` | **Préparé, non appliqué (à approuver)** — C1 : `alertes_externes` (avertissements météo en ajout seul : flux, saisie manuelle, fixture), vue `alertes_externes_en_cours`, `regles_reveil`, `regles_reveil_correspondantes()` |

Attention : les fichiers de l'entraide sont l'état final (correctifs appliqués en base sous les noms `entraide_missions_affectation_close`, `entraide_missions_historique_after`, `entraide_equipes_chef_controle`, `entraide_fermeture_horodatee_serveur`, `entraide_code_erreur_pab_ferme`, `entraide_missions_zone_rouge_derogation`, `entraide_missions_reouverture`, y figurent déjà). Le fichier du pont est l'état final (deux correctifs appliqués après coup en base, sous les noms
`pont_commune_evenements_correctif_rehausse` et `pont_commune_evenements_revoke_triggers`, y figurent déjà).

Console Plateforme : le fichier est l'état final. Il a été appliqué en base en plusieurs morceaux
(`console_plateforme_1_suspension`, `_2_journal`, `_3_droits_internes`, `_4_clients`,
`_5_utilisateurs`, `_7_supervision`) ; `plateforme_retirer_acces` et `plateforme_desactiver_utilisateur`
ont été créées à la main dans le SQL Editor le 19 octobre 2026.

Risques du territoire : le fichier a été exécuté tel quel dans le SQL Editor le 20 octobre 2026 (l'outil de
migration n'a pas pu faire afficher sa demande de confirmation des instructions destructrices). Il n'apparaît
donc pas dans l'historique `supabase_migrations.schema_migrations`.

Correctifs de sécurité : répété le 20 octobre 2026 dans des transactions annulées (attaques avant / après,
parcours des apps), approuvé par Ren, puis appliqué tel quel le même jour par l'outil de migration : il figure
dans l'historique sous la version `20261020211056` (nom `correctifs_securite`) et non sous la date du fichier.
Effet vérifié en SQL après application, voir `docs/roadmap/CORRESPONDANCE.md`, section 6.

Fondations F1, F3, F5 : répétées le 20 octobre 2026 dans des transactions annulées (seed réduit à 13 communes
représentatives), approuvées par Ren, puis appliquées telles quelles le même jour par l'outil de migration, dans
l'ordre F5, F3, F1 : versions `20261020214032` (`f5_journal_empreinte`), `20261020214055` (`f3_planification`) et
`20261020214114` (`f1_communes_be`) dans l'historique. Le seed `supabase/seed/communes_be.sql` est une donnée, pas
une migration : chargé ensuite en cinq lots par l'outil SQL (mêmes valeurs, même upsert, donc rejouable), contenu
de la table comparé au fichier par empreinte md5 : identique. Tests : `supabase/tests/fondations_f1_f3_f5.sql`
(transaction annulée, résultats affichés par l'exception finale), rejoués sur la base réelle après application.

C1, avertissements et règles de réveil : répété le 21 octobre 2026 dans une transaction annulée (migration et
tests ensemble, 31 contrôles conformes). Tests rejouables après application :
`supabase/tests/c1_alertes_regles_reveil.sql`. Le message CAP reçu est découpé en lignes par
`supabase/functions/_shared/cap.ts` (tests Vitest : `npm test`).
