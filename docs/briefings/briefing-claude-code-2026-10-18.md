# Briefing pour Claude Code — backlog « brainstormé, non développé » (Crisiware)
*2026-10-18 · dépôt `renaudlesage/plateforme-crise` · Supabase `apjswshvzbejpvlxfnek` · dernier état connu : commit `2bcc548` (exercices), précédé de `54f5bcc` (CBRNE/incendie/preparedness)*

> Copie, déposée dans le dépôt le 2026-11-21, du document de projet `claude/briefing-claude-code-2026-10-18.md`. Depuis sa rédaction, le dépôt a gagné un dossier `supabase/migrations` (voir son README) et plusieurs points du backlog ont été livrés (journal des décisions, entraide, situation, réveil C1, géo-barrière) : se fier à `docs/roadmap/ETAT.md` pour l'état courant. Les règles de la section 1 restent valables sans exception. **Écarts connus au 21/11** sur la règle « Réseau » : les apps sont des projets Vite/React avec dépendances npm (registre joignable) ; `apjswshvzbejpvlxfnek.supabase.co` est joignable depuis l'environnement « plateforme-crise » des sessions Claude Code ; sur « Livraison » : les sessions travaillant dans le dépôt passent par une branche et une PR (#10 à #12), sauf instruction contraire de Ren.

> **But** : te donner le reste à faire issu des briefings thématiques et de l'analyse croisée Eventware ↔ Crisiware, avec les règles du projet. Ce document ne remplace pas `statut-briefings-2026-10-10.md` (état réel des briefings) ni `exercices-sur-mesure-fondations.md`.
> **Vérifié le 2026-10-18** : liste des tables et fonctions Supabase (schéma). **Non vérifié** : le code du dépôt (écrans, Edge Functions). Avant de coder un point, cherche d'abord s'il existe déjà dans le dépôt.

## 1. Règles du projet (à respecter systématiquement)
- **Terminologie** : PC-Ops = poste de commandement opérationnel du terrain (Dir-PC-Ops). Comité de Coordination (CC) = coordination stratégique communale/provinciale. Ne jamais appeler un CC « PC-Ops ». Outil national actuel = **Paragon** (NCCN) ; ne jamais citer ICMS comme outil actuel.
- **Toute donnée doit être encodable via un CRUD dans l'application.** Jamais par édition de `referentiels.js` ou d'un autre fichier source.
- **Accès** : données nationales de référence = lecture pour tout utilisateur connecté, écriture super-admin ; données d'un contexte = RLS via `a_acces(contexte_id, …)` et `a_capacite(contexte_id, ressource, action)`.
- **Insert anonyme/citoyen** : toujours via une RPC `security definer`, jamais `.insert().select()` direct (le `.select()` exige une policy SELECT que l'anonyme n'a pas).
- **Supabase (garde-fous d'outil)** : `apply_migration`/`execute_sql` annulent silencieusement tout SQL contenant littéralement `DELETE FROM` ou `DROP …`. Utiliser RLS `for delete`, triggers `BEFORE DELETE/UPDATE` avec `raise exception`, une nouvelle fonction versionnée (`_v2`) plutôt qu'un `DROP FUNCTION`. Guillemets simples doublés pour les apostrophes françaises (`'Accéder à l''éducation'`). *(Mise à jour 11/2026 : le dépôt a désormais `supabase/migrations/` ; chaque migration y est versionnée et son application notée dans le README du dossier.)*
- **Réseau** : `registry.npmjs.org` et `*.supabase.co` bloqués depuis le shell ; appel sortant via `extensions.http_post` depuis Postgres. Les apps sont des PWA faites à la main, zéro dépendance npm.
- **Confidentialité** : indicateurs agrégés uniquement pour les données sensibles (psychosocial, propriétaires, communication CBRNE) ; aucun nom de propriétaire, aucune liste de personnes. Les contrôles de sécurité du personnel = statut par poste, jamais de données pénales nominatives.
- **IA** : « l'IA propose, l'humain valide ». Tout contenu issu de l'IA naît « à valider ». Aucune IA n'est branchée à ce jour.
- **Aucune donnée de référence inventée** (zonage nucléaire, contenu D5, modules CWA) : elle vient de l'utilisateur ou d'une source officielle.
- **Livraison** : l'utilisateur veut le code sous forme d'archive `.zip` complète à déposer sur GitHub, pas des correctifs à appliquer à la main. Pour tout nouveau module ou app avec un fichier `.env`, rappeler d'activer l'affichage des fichiers cachés avant l'upload. *(Quand une session travaille directement dans le dépôt, elle pousse sur `main` avec les lignes d'attribution en vigueur.)*
- **Design** : design system d'Eventware 2.0 ; modèle de droits par capacités (ressource × action × phase).
- **Langue** : français.

## 2. Backlog priorisé

### P1 — peu d'effort, fort impact
1. **Audit « jamais exposé » des pages citoyen par jeton** (plan d'urgence ménage `plans_urgence_menages`, signalements `signalements_citoyens`, suivi). Vérifier qu'aucun nom, adresse ou numéro ne sort vers une page sans compte, par un test réel avec le rôle `anon`. Population plus sensible que dans Eventware (personnes vulnérables, évacués). Documenter le résultat.
2. **`journal_decisions`** : qui a décidé, sur quelle base, échéance. Pièce la plus défendable pour un bourgmestre en cas d'enquête post-crise. Traces actuelles : `livre_de_bord.decision`, `declenchements_seuils_action`. À faire : table (RLS `a_acces`), saisie dans CC › incident, lien avec les seuils d'action et les activations nucléaires ; append-only (trigger).
3. **Nettoyage SQL en attente** : tables `_test_gen`, `_test_gen2`, `_test_gen3` (le `drop table` littéral est bloqué par l'outil : voir la règle ci-dessus ; trouver un contournement par migration contrôlée ou le demander à l'utilisateur).
4. **Créer les contextes avec le rôle `ANALYSTE_INFO`** (aujourd'hui installé dans 1 seul contexte, pas à la création de nouveaux contextes).

### P2 — différenciateurs
5. **Pont descendant commune → événements** (Eventware ↔ Crisiware). Quand une commune passe en phase d'alerte (inondation, Seveso, nucléaire), prévenir automatiquement les organisateurs d'événements actifs sur son territoire. Réutiliser le contrat HTTP existant (`diffuser-alerte` côté Eventware ; récepteur côté Crisiware : `ingestion-alerte-externe`, `sources_externes_alertes`, `journal_ingestions_externes`). Il manque : l'émission, l'authentification, le rattachement événement ↔ commune. Utiliser `evenement_public` / `contenu_public` d'Eventware pour la lecture « qu'est-ce qui se passe sur ce territoire ».
6. **Fusion incident ↔ événement** : un événement Eventware détecté dans le périmètre d'un incident communal devient un objet lié ; les Mayday remontent comme missions dans le CC sans ressaisie. Dépend du point 5.
7. **Boucle REX vivante** : alimenter `diagnostic_resilience_territoire` depuis `evaluations_crise`, `rex_recommandations`, `debriefings_post_crise` (aujourd'hui deux modules qui ne se parlent pas).
8. **Réserve citoyenne → « réseau d'entraide communal »** : `benevoles_entraide` existe (0 ligne). Prototype sous ce nom (le blocage est juridique, pas technique), en s'inspirant des bénévoles/invitations/créneaux d'Eventware.

### P3 — complétions liées aux briefings
9. **Mode exercice de veille** (preparedness) : flux simulé de messages à analyser, à bâtir sur le module exercices (`exercice_stimuli`, mode « dans l'outil »).
10. **Scénarios d'escalade** (CBRNE, Bundestag) : `scenarios_planification` non créée ; à reprendre avec le mode exercice, en fusion avec l'analyse de risques existante.
11. **Veille** : étoffer `lexique_detection_appels` (9 termes fr/nl/en seulement) ; câbler l'extraction de pertes (`donnees_pertes_extraites`) seulement avec validation humaine ; `journal_generations_ia` reste vide tant qu'aucune IA n'est branchée.
12. **Incendie** : extension de `leviers_action_resilience` (type d'aléa, phase du cycle) ; `exercices_simulation` n'est plus nécessaire (couvert par le module exercices) ; `indicateurs_gouvernance_incendie` écarté (faible valeur communale).
13. **Exercices — suite** (hors fondations) : bibliothèque de trames, générateur de scénario avec contrôle pré-vol, mesure automatique (`critere_auto`), retrait d'un animateur depuis l'écran, bandeau « EXERCICE » dans l'app Terrain, couche IA ; le moteur est prévu côté Eventware d'abord.
14. **Modèle d'accès** : aligner définitivement sur le modèle à capacités d'Eventware (ressource × action × phase) pour composer D1–D5, CC, cellule psychosociale, CER sans toucher au code ; évaluer de remonter le multi-tenant (`clients`, `est_plateforme`) en brique partagée avec Eventware.

### Qualité et recette (avant le MVP)
15. **Rendu réel** (clair/sombre, mobile) des 4 apps ; **test PWA** sur de vrais appareils (jamais fait). Seuls les tests SQL annulés et 38 vérifications Chromium sur base simulée existent pour les exercices.
16. **Tests des suppressions** du module exercices (non exercées en SQL).
17. **Auditer Eventware** pour les deux classes de bugs trouvées en test mobile : insert anonyme RLS et CSS global `input,select,textarea{width:100%}` qui cassait les cases à cocher.
18. **Sécurité Supabase** : `spatial_ref_sys` sans RLS (table PostGIS ; la correction proposée `ENABLE ROW LEVEL SECURITY` bloquerait l'accès sans politique : **ne pas l'appliquer sans décision de l'utilisateur**) ; fonctions SECURITY DEFINER exposées par conception (RPC citoyens) ; PostGIS dans `public` ; protection des mots de passe compromis désactivée.

## 3. Bloqué par des données que seul l'utilisateur peut fournir
| Donnée | Débloque |
|---|---|
| Carte officielle NCCN du zonage (blocs, communes) pour Tihange, Doel, Chooz, Borssele, Fleurus, Mol, Geel | `blocs_planification_nucleaire`, `blocs_communes` (0 ligne) |
| Liste ou document des 7 modules du CWA 17974 | `referentiel_formations_cbrn` (3 lignes) |
| PDF IBZ 2007 (fiches D5) | contenu `fiches_action_d5`, lien `message_catalogue_id` |
| `mkffis-en.pdf` complet (arrivé tronqué) | fin de l'analyse du thème incendie |
| Validation par un expert belge (zone de secours / centre de crise) | passage des 92 messages d'alerte de « à valider » à « validé » |
| Plan national CBRNe du 11/06/2018 et plan prise d'otage terroriste | compléter le thème CBRNE |
| Positions exactes des 9 sites nucléaires | aujourd'hui approximatives : ne pas les utiliser opérationnellement |

## 4. Incohérences de documentation à corriger
- `briefing-inondation-europe-2026-10-09.md` : un ancien tableau « Proposé, non appliqué » reste en bas de page et contredit le statut mis à jour juste au-dessus.
- `briefing-crisiware-2026-10-04.md`, section 9 : dit encore « rien n'est appliqué » et ne couvre pas CBRNE ; se référer à `statut-briefings-2026-10-10.md`.
- Les trois briefings d'origine (preparedness, incendie, CBRNE) gardent un bandeau « rien n'a été appliqué à Supabase » : périmé.

## 5. Ce qu'il ne faut pas faire
- Ne pas inventer de zonage, de contenu D5 ou de modules de formation.
- Ne pas brancher un modèle d'IA sans journal d'audit et validation humaine.
- Ne pas créer de table qui chevauche `ressources`, `zones_intervention`, `objets_a_risque`, `fiches_action_d5` sans avoir inspecté le schéma.
- Ne pas appliquer d'autre correction de sécurité sans l'accord de l'utilisateur.
- Ne pas confondre zones de préparation nucléaires et zones d'intervention (AR du 22 mai 2019) : deux notions séparées.
- Ne pas déclarer « terminé » sans test réel : dire explicitement ce qui n'a pas été testé.
