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

Attention : les fichiers de l'entraide sont l'état final (correctifs appliqués en base sous les noms `entraide_missions_affectation_close`, `entraide_missions_historique_after`, `entraide_equipes_chef_controle`, `entraide_fermeture_horodatee_serveur`, `entraide_code_erreur_pab_ferme`, `entraide_missions_zone_rouge_derogation`, `entraide_missions_reouverture`, y figurent déjà). Le fichier du pont est l'état final (deux correctifs appliqués après coup en base, sous les noms
`pont_commune_evenements_correctif_rehausse` et `pont_commune_evenements_revoke_triggers`, y figurent déjà).

Console Plateforme : le fichier est l'état final. Il a été appliqué en base en plusieurs morceaux
(`console_plateforme_1_suspension`, `_2_journal`, `_3_droits_internes`, `_4_clients`,
`_5_utilisateurs`, `_7_supervision`) ; `plateforme_retirer_acces` et `plateforme_desactiver_utilisateur`
ont été créées à la main dans le SQL Editor le 19 octobre 2026.

Risques du territoire : le fichier a été exécuté tel quel dans le SQL Editor le 20 octobre 2026 (l'outil de
migration n'a pas pu faire afficher sa demande de confirmation des instructions destructrices). Il n'apparaît
donc pas dans l'historique `supabase_migrations.schema_migrations`.
