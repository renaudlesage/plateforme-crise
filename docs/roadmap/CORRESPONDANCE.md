# Correspondance feuille de route ↔ existant

Relevé de la Session 0, 20 octobre 2026 : dépôt `main` au commit `b46df0f` et base de production
`apjswshvzbejpvlxfnek`, en lecture seule. À mettre à jour à chaque chantier : quand un module existant est
étendu, garder son nom dans le code et citer ici le chantier.

Légende de couverture : **aucune**, **faible**, **partielle**, **forte**.

## 1. Vocabulaire : briefing → code

| Briefing | Dans le code et en base | Remarque |
|---|---|---|
| événement (de crise) | table `incidents` (`type_evenement`, `statut` pre_alerte / en_cours / cloture, `phase_cycle_vie` veille → post_crise, escalade via `niveaux_escalade` et `phases_incident`) | `evenements_territoire` et le menu QG « Événements » désignent les manifestations publiques du pont Eventware, pas les crises |
| `mode` reel / exercice (F6) | booléen `incidents.est_exercice`, figé après création | recopié par trigger sur `journal_decisions`, `missions_entraide`, `presences_benevoles` |
| fiche (scénario) | `risques_territoire` (menace) | depuis le 20/10 ; `objets_a_risque` = particularités localisées du territoire |
| seuil S0, S1… | `seuils_action` (lien `risque_id` et/ou `objet_risque_id`) | le rang S0/S1 n'existe que dans le libellé |
| injects | `exercice_stimuli` côté exercice ; dans les fiches REX, rangés en texte dans `decisions_a_preparer` | pas de champ `injects` sur les fiches |
| directeur d'exercice | animateur (`exercice_animateurs`, `peut_animer_exercice`) | |
| mutuelle de résilience | module Entraide (bénévoles, points d'accueil, équipes, missions, moyens privés) + `ressources` (`disponible_hors_contexte`, `rayon_partage_km`) | |
| signalements | `signalements_citoyens`, bucket `photos-citoyens` | |
| `ressources_critiques` | n'existe pas : `ressources`, `infrastructures_critiques`, `fonctions_critiques`, `moyens_engages` | |
| `referentiels.js` | n'existe pas : référentiels en dur dans `packages/shared/src/*.js`, `apps/admin/src/data/packDemarrage*.js`, `apps/plateforme/src/lib/libelles.js` | |
| CPU | rôle « Fonctionnaire planification urgence » (code `PLANU`) ; un contact n'est pas un compte (`contacts` ≠ `acces_utilisateurs`) | `contacts.est_suppleant_de` existe |
| CC | Comité de Coordination : app `apps/qg` ; organes `instances_coordination` (CC_COM, CC_PROV, NCCN) | |
| `diffuser-alerte` | Edge Function déployée, **absente du dépôt** : POST JSON vers les `canaux_diffusion` de type webhook pour une `alertes_publiques`, trace dans `diffusions`, sans nouvel essai | seul le type webhook est codé |
| page « Veille » (C1) | « veille » désigne déjà 5 choses : phase `veille`, `VeilleMeteo`, `SectionVeille` (OSINT), « Sources de situation (veille) », « Connaissances & veille » | choisir un autre nom d'écran |

## 2. Écarts entre le briefing et le dépôt

- **Cinq apps**, pas quatre : `apps/plateforme` (console super-admin) s'ajoute à admin, qg, terrain, citoyen.
- **199 tables** dans `public` (198 sous RLS, 668 politiques, 110 fonctions, 79 triggers), pas 24. Le chiffre de 24 correspond à l'état du 27 juillet 2026.
- **Cartes REX « Hautes Fagnes » et « confinement Moselle »** : introuvables (code et base). Le pack compte 10 fiches génériques, 6 nucléaires et 2 REX 2026.
- **Marque FERRU** : absente du code ; l'interface affiche « Crisiware 2 ».
- **Edge Functions** : 6 déployées, 1 seule dans le dépôt (`inviter-membre`). Absentes : `diffuser-alerte`, `irm-vigilance` (proxy MeteoAlarm), `ingestion-alerte-externe` (pont Eventware) ; `bootstrap-super-admin` et `reset-password-ferrieres-test` sont neutralisées (410) mais toujours déployées.
- **Migrations** : 118 dans l'historique de prod, 10 fichiers dans le dépôt ; `risques_territoire` exécutée au SQL Editor, hors historique.
- **Tests** : aucun framework, aucun fichier de test (Vitest prévu au C1, conforme au briefing).
- **Temps réel** : la publication `supabase_realtime` ne contient aucune table, le code n'utilise aucun canal ; tout est rafraîchi par interrogation périodique (15 à 60 s).
- **Capacités** : `role_capacites` est vide ; `a_capacite()` retombe donc toujours sur le niveau d'accès (lecture / écriture / admin). La grille des rôles de l'Admin n'a aucun effet.
- **Contextes** : 2 en base (« Commune Test », commune de Liège ; « Crisiland », contexte plateforme) ; aucune province, aucune hiérarchie entre contextes.
- **Types générés** : les 5 copies de `database.types.ts` datent du 7 octobre (52 tables) et ne sont importées nulle part.
- Le README racine renvoie à un `.env.example` absent et à un projet « pcops-generique-test » ; des commentaires citent `briefing-eventware-pour-crisiware.md`, absent du dépôt.

## 3. Plan de sprint « 15 modules en quatre paliers »

**Introuvable** : ni dans le dépôt et son historique GitHub complet (depuis le 27/07/2026), ni en base, ni sur le
Google Drive du projet (dossier « FERRU » : un seul zip ; corpus PGUI/PPUI). Seules traces : la migration
`fiche_risque_cascade_et_seuils_action` (30/07/2026) cite « TIER 1.1 — fiche risque unifiée avec cascade »
(aujourd'hui `risques_territoire` et les fonctions critiques) et « TIER 1.2 — seuils d'action communaux formalisés »
(`seuils_action`, `declenchements_seuils_action`). Le plan vit probablement dans un chat du projet claude.ai.
**À fournir par Ren** pour la réconciliation (voir [ETAT.md](ETAT.md), questions ouvertes).

## 4. Fondations F1–F8

| | Verdict | Existant | Manque | Premier chantier |
|---|---|---|---|---|
| F1 Communes belges | **absent** | `PROVINCES` en double (`packages/shared/src/meteo.js`, `apps/plateforme/src/lib/libelles.js`) ; `contextes.province` (CHECK 11 provinces), `latitude`/`longitude` ; tables vides `secteurs_statistiques`, `blocs_communes` (nucléaire) ; PostGIS installé | `communes_be` (NIS, noms FR/NL/DE, région, langues, centroïde, bbox), lien `contextes` → NIS, chargement | C1 (province ↔ commune), C2 |
| F2 Notifications internes | **absent** | `sw.js` sans gestion `push` ; seul acquittement : appels d'aide `alertes_aide` vus par interrogation (QG, 15 à 30 s) ; seul e-mail : invitations | `notifier()`, VAPID et abonnements, préférences, journal d'envoi, escalade, canal e-mail | C1 |
| F3 Planification | **absent** | extension `http` (synchrone) ; tâches côté navigateur (`VeilleMeteo` toutes les 10 min, uniquement écran ouvert) | `pg_cron`, `pg_net`, clé dans Vault (vide), `jobs_etat` | C1 |
| F4 Impression | **partiel** | `/risques-territoire/:id/impression` (admin), `/incidents/:id/journal-decisions` et « Point de situation » de `/autorite` (qg) ; `@media print` dans `eventware.css` des 5 apps + `index.css` admin/qg ; aucune police externe | convention `/print/…` hors mise en page, gabarit commun, pagination (page X/Y, en-tête courant), SITREP imprimable (styles `.sitrep` inutilisés) | C4 |
| F5 Journal immuable | **partiel** | `journal_decisions` : ajout seul par trigger (DELETE toléré pour l'exercice), `decide_le` client + `enregistre_le` serveur, auteur forcé, `numero_ordre` sous verrou, corrections chaînées | empreinte chaînée, références signalement / alerte / message, journal hors incident (`incident_id` NOT NULL) ; `livre_de_bord` reste modifiable et supprimable | C3 (et C7 pour le journal hors incident) |
| F6 Réel / exercice | **partiel** | `est_exercice` figé ; garde-fous : `pas_de_lien_public_avec_exercice` (alertes publiques, signalements), fermeture des signalements, pont Eventware, météo, vérifications de situation, entraide publique | colonne `mode` (ou garder le booléen), propagation aux 57 autres tables liées à un incident, garde dans `diffuser-alerte`, purge (8 FK en NO ACTION, 11 en SET NULL) | C5 |
| F7 i18n | **absent** | chaînes FR en dur, `lang="fr"`, dates `fr-BE` ; colonnes `langue` éparses | bibliothèque, dictionnaire FR, champs par langue | C8 (dictionnaire FR dès le premier écran neuf) |
| F8 Endpoints publics | **partiel** | RPC SECURITY DEFINER avec jetons, idempotence (`cle_client`), quelques troncatures ; bucket photos 2 Mo, JPEG ; journal des rejets de l'ingestion externe | passerelle Edge Function, limite de débit par IP hachée, honeypot, tailles max, journal des rejets ; failles à corriger (section 6) | C2 |

## 5. Chantiers

### C1 — Réveil automatique · couverture **faible à partielle**
- **Existant** : Edge `irm-vigilance` (flux ATOM MeteoAlarm Belgique « legacy », niveau déduit de la couleur, filtre province FR/NL/EN, cache 5 min, rien n'est stocké, attribution « Via Meteoalarm » affichée) ; `VeilleMeteo.jsx` (qg et terrain) qui l'appelle toutes les 10 min et Open-Meteo toutes les 15 min, depuis le navigateur ; RPC `consigner_meteo` → `meteo_etat_criteres`, `meteo_transitions`, ligne « [Météo] » au livre de bord (ignore le jaune) ; Admin « Météo de la commune » (`meteo_seuils`), « Seuils météo (déclencheurs) » (`seuils_meteo_declencheurs`, 0 ligne, lu nulle part), « Seuils d'action » ; QG onglet Pilotage : `declenchements_seuils_action` (en attente / confirmé / refusé / reporté de 15 min), « Activation en 30 minutes » (`activation_incident`), checklists (`checklist_templates`, `checklist_executions`). Fiches A (orages) et B (cyber) : 11 seuils ; la canicule (STARTER-11) n'en a aucun.
- **Manque** : ingestion serveur planifiée, stockage normalisé et dédoublonné, règles éditables, création ou rattachement automatique d'incident, checklist par seuil, journalisation, notifications et escalade, acquittement « Vu, je prends », écran de veille, alerte de silence du flux, e-mail texte, fixtures CAP et tests, règles par défaut à l'import.
- **Migrations prévisibles** : `alertes_externes` (par province, unique CAP + version), `regles_reveil`, rang structuré du seuil, acquittement (colonnes sur `declenchements_seuils_action` ou table dédiée), points de checklist par seuil, `jobs_etat`, tables F2, `livre_de_bord.source_type` élargi, extensions `pg_cron` et `pg_net`.
- **Pièges** : ne pas écrire les avertissements dans `alertes_publiques` (lisible par le public) ; `declenchements_seuils_action.incident_id` est NOT NULL ; deux tables de seuils météo distinctes ; ne rien notifier en exercice ; MeteoAlarm ne connaît qu'un seul « Brabant » (Bruxelles, Brabant flamand et Brabant wallon confondus) et l'open data IRM n'est mis à jour qu'une fois par heure (voir [references.md](references.md)).

### C2 — Signal citoyen · couverture **partielle** (2a ≈ 60 %, 2b ≈ 25 %, 2c ≈ 20 %, 2d 0 %)
- **Existant** : app citoyen `/signaler` (`apps/citoyen/src/pages/Signaler.jsx`, commune choisie via `contextes_publics()` et gardée en localStorage, 6 types fixes, GPS ou lieu libre, contact facultatif) ; file hors ligne `apps/citoyen/src/lib/fileSignalements.js` (localStorage, idempotente) ; photos réduites sans EXIF (`packages/shared/src/photo.js`), 3 max ; RPC `creer_signalement_citoyen` (réception ouverte seulement pendant un incident réel), `joindre_photo_signalement`, `suivre_signalement_citoyen` (suivi sur le téléphone émetteur) ; QG `/signalements-citoyens` et couche carte (30 s, sans regroupement) ; offres d'aide via `/ressource` → `declarer_moyen_prive` → `ressources` inactives ; générateur QR `packages/shared/src/qr.js`.
- **Manque** : `/s/:slug` et QR par commune, gravité, consentement paramétrable, honeypot, Edge Function `signal-citoyen` (débit, IP hachée, MIME, rejets), file IndexedDB avec photos, 2 photos max, lien de suivi par jeton, regroupement 150 m / 30 min, temps réel, « danger de mort » notifié et épinglé, « pris en charge par », journal à chaque statut, statut spam, ressource temporaire au CC, mode dégâts (export CSV, liste imprimable, rappel de délai), rétention et purge, types éditables, lien vers l'outil quotidien et « veille permanente ».
- **Migrations prévisibles** : `contextes.slug` et paramètres de signalement ; colonnes gravité, consentement, grappe, jeton, prise en charge, message, IP hachée, mode et champs de dégâts sur `signalements_citoyens` ; table `types_signalement` à la place du CHECK ; limitation de débit et rejets ; publication Realtime ; offres d'aide comme extension de `ressources` (pas de `ressources_temporaires` en doublon) ; job de purge.
- **Pièges** : types codés en dur à 4 endroits ; la réception dépend d'un incident ouvert (à revoir pour la veille permanente et le mode dégâts) ; plusieurs incidents ouverts → `incident_id` vide ; `RemonteesTerrain.jsx` concerne les intervenants, pas les citoyens.

### C3 — Rapport d'événement · couverture **faible**
- **Existant** : `JournalDecisionsImpression.jsx`, « Point de situation » de `VueAutorite.jsx` (qui est informé : `informations_parties_prenantes`), `SyntheseIncident.jsx`, SITREP CANAL (`sitreps`, `sitrep_disciplines`, brouillon depuis la carte, non imprimable), REX (`evaluations_crise`, `rex_recommandations`) et débriefings (`debriefings_post_crise` : points forts, à améliorer, actions) ; sources de chronologie : `historique_phases_cycle_vie`, `activation_incident`, `organes_crise_log`, `declenchements_seuils_action`, `alertes_publiques` + `diffusions`, `signalements_citoyens`, `moyens_engages`, `requisitions`, entraide ; modèle `apps/qg/src/components/exercice/Chronologie.jsx`.
- **Manque** : chronologie fusionnée, statistiques de délais, trois variantes (conseil 2 p., dossier complet, SITREP 1 p. à heure T figée et « transmis » journalisé), mention d'intégrité, exports JSON/CSV (aucun export dans le dépôt), historique d'ouverture des centres d'accueil, participants au CC, heures en Europe/Brussels.
- **Migrations prévisibles** : fonction `chronologie_incident()`, `rapports_evenement` (variante, heure T, instantané, empreinte), `centres_accueil_activations`, `presences_cc` (partagée avec C4), empreinte chaînée sur `journal_decisions` (F5).
- **Pièges** : `livre_de_bord` n'est pas immuable ; le changement de phase se fait en deux écritures client ; deux REX parallèles à fusionner ; le SITREP CAN(AL) existant est celui du PC-Ops, pas le SITREP provincial.

### C4 — Pack papier · couverture **faible**
- **Existant** : `FicheRisqueImpression.jsx` (seuils avec mode dégradé, 9 champs, objets liés, plan d'action ; date affichée non enregistrée ; pas de cases à cocher) ; impressions QG ; planches QR des points d'accueil ; annuaire `contacts` (catégorie en texte libre), `instances_coordination_membres`, `conventions`.
- **Manque** : routes de pack fiche et événement, fiche condensée à cocher, annuaire CC / disciplines / mutuelle / prestataires, carte statique pré-générée et stockée, formulaires vierges (signalements 20 lignes, journal, relève, présence CC), bouton « Générer le pack papier », date de génération enregistrée, plafond de 6 pages.
- **Migrations prévisibles** : `packs_papier` (ou dates sur `risques_territoire` et `contextes`), bucket des cartes statiques, catégorie normalisée des prestataires dans `contacts`.
- **Pièges** : fiche dans l'app Admin, événement dans l'app QG → composants du pack dans `packages/shared` ; convention actuelle `…/:id/impression` dans la mise en page connectée ; tuiles Leaflet en ligne.

### C5 — Mode exercice · couverture **partielle** (forte sur la sécurité, faible sur l'horloge et le débrief)
- **Existant** : QG `Exercices.jsx`, `ExerciceDetail.jsx` (bandeau EXERCICE), `exercice/ExercicePreparer|Jouer|Bilan|Chronologie.jsx`, `lib/exercices.js` (temps scénario = réel × `facteur_temps`) ; Admin `Exercices.jsx` (registre : MEL `exercices.mel`, évaluations, rapport) ; tables `exercices` (mode de jeu, statut, facteur, `fiche_risque_id` → `risques_territoire`), `exercice_stimuli` (injects), `exercice_objectifs`, `exercice_actions_attendues`, `exercice_observations`, `exercice_ecarts`, `exercice_animateurs` ; fonctions `ouvrir_incident_exercice`, `demarrer_exercice`, `lancer_stimulus` (manuel), `clore_exercice`, `synthese_exercice` ; garde-fous de la section F6.
- **Manque** : création depuis une fiche (injects importés vers `exercice_stimuli`), préréglages x1/x2/x6 et pause, diffusion automatique à l'heure simulée (notification interne), rôles observateur et directeur distincts, injects ad hoc, attendus par seuil avec délai cible, débrief par seuil (écarts de temps, actions non faites), agrégation des notes, rapport via C3, bandeau EXERCICE dans Terrain, la carte et la vue autorité, canal figurants, archivage et purge.
- **Migrations prévisibles** : champ ou table d'injects sur les fiches, délai cible sur `seuils_action` et lien seuil sur `exercice_actions_attendues`, colonnes de pause, statut archivé, participants avec rôle et RLS observateur, `purger_exercice()` (FK NO ACTION / SET NULL, Storage), jeton figurants.
- **Pièges** : deux écrans « Exercices » et doublons de modèle (objectifs, MEL, évaluations) ; **la doctrine en base « exercice terminé = preuve non supprimable » contredit la purge du briefing** (décision de Ren).

### C6 — Tableau de bord de préparation · couverture **faible**
- **Existant** : Admin `TableauDeBord.jsx` (tuiles et « Par où commencer ? », sans indicateur), `ConformiteLegale.jsx` (obligations AR 2019 saisies à la main, matrice de risques), `ResilienceTerritoriale.jsx` (auto-diagnostic), dates utilisables : `ressources.verifie_le`, `exercices.date_realisee`, `seuils_action` par risque.
- **Manque** : tout le calcul (indicateurs, score pondéré éditable, tendance, 3 actions max, `preparation_snapshots`, job nocturne, export) ; date de vérification des contacts et campagne par lien signé ; sources des indicateurs C1, C4, C8, C9 ; « points noirs » (pas de table dédiée).
- **Migrations prévisibles** : `contacts.verifie_le`, table générique de liens signés (partagée avec C7 et C2), `preparation_ponderations`, `preparation_snapshots`, fonction `indicateurs_preparation()`, cron.
- **Pièges** : « N défini » sans équivalent identifié ; « dernier exercice » a deux sources ; `ressources.verifie_le` = vérification d'une déclaration, pas revalidation annuelle.

### C7 — Mutuelle opérationnelle · couverture **partielle** (forte pour les bénévoles en événement, nulle ailleurs)
- **Existant** : module Entraide (migrations `entraide_*` du 19/10) : `benevoles_entraide`, `points_accueil_benevoles` (jeton QR, briefing), `presences_benevoles` (consignes acceptées, arrivée, sortie), équipes, missions (historique en ajout seul), `parametres_entraide`, vue `v_equipes_a_relever` ; RPC publiques `enregistrer_benevole_spontane`, `point_accueil_par_jeton`, `suivre_presence_benevole`, `demander_sortie_benevole`, `declarer_moyen_prive`, `etat_public_entraide` ; écrans QG `components/Entraide.jsx`, Terrain `MissionsEntraide.jsx`, citoyen `/entraide…`, Admin `Entraide.jsx`, `BenevolesEntraide.jsx` ; partage de `ressources` (booléen + rayon) et RPC `ressources_partageables` (appelée nulle part).
- **Manque** : revalidation annuelle par lien signé et relances, compétences éditables (codées dans `packages/shared/src/entraide.js`), disponibilités, heures prestées et export, pointage par scan, rétention RGPD, version du briefing accepté, planning de quarts et note de passation, demandes inter-communes, opt-in par commune.
- **Migrations prévisibles** : liens signés (partagés C6), `revalidations_ressources`, `competences_entraide`, pointages et vue des heures, `quarts`, `notes_passation`, `demandes_ressources_mutuelle`, journal au niveau du contexte, `politiques_partage_contexte` + RLS, job de rétention.
- **Pièges** : `requisitions` = réquisition légale, pas une demande entre communes ; la trace côté commune B est impossible sans incident ouvert (`journal_decisions.incident_id` NOT NULL) ; `ressources_partageables` ignore province et rayon.

### C8 — Page publique et multilingue · couverture **faible**
- **Existant** : app citoyen (alertes publiques actives lisibles par anon, entraide publique, fiches risques nationales, mise à l'abri, soutien psychologique) ; publication Admin `AlertesPubliques.jsx` et QG `MessagesPopulation.jsx` → `diffuser-alerte` ; `catalogue_messages_alerte` (validation nationale par le super-admin, 92 messages, aucun validé), `modeles_messages_population` (1), `pocc_messages_reflexes` (brouillon / validé / publié) ; `numeros_information_crise`, `fonctions_critiques.statut_actuel`, `centres_accueil`.
- **Manque** : slug et route `/c/:slug`, agrégat public unique, statut d'ouverture des centres, routes fermées structurées, préréglage « cyber », validation par le bourgmestre journalisée, multilingue, page légère dédiée (< 200 ko ; le build citoyen actuel ≈ 176 ko gzip de JS), cache HTTP court.
- **Migrations prévisibles** : `contextes.slug`, langues et configuration de page, champs par langue sur messages et alertes, workflow de validation sur `alertes_publiques`, RPC `page_publique(slug, langue)`, statut d'ouverture des centres, routes fermées, `communes_be` (F1).
- **Pièges** : trois sources possibles de « message D5 validé » (catalogue national, modèles, `pocc_messages_reflexes`) — en choisir une ; `contextes_publics()` liste aussi le contexte plateforme ; intégrer la page publique de l'entraide plutôt que la dupliquer. Critère « hors infrastructure communale » déjà acquis (Supabase + Vercel).

### C9 — Registre des personnes vulnérables · couverture **aucune**
- **Existant (autour)** : statistiques agrégées vides (`indicateurs_vulnerabilite`, `v_vulnerabilite_sociale_commune`, `secteurs_statistiques`), plans d'urgence des ménages (`plans_urgence_menages` : champs libres sur les personnes à aider), comptages anonymes « personnes à risque », type de signalement `personne_isolee`, rôles `AS_CPAS` et `DIR_D2_CC`.
- **Manque** : tout le registre (inscription avec consentement, catégories, plan de contact par seuil, listes d'appel, pointage, escalade, export chiffré, journal d'accès DPO, chiffrement, purge, droit d'effacement).
- **Migrations prévisibles (après approbation de la conception)** : `personnes_vulnerables` chiffrées (`pgcrypto` + Vault ; `pgsodium` absent), plans de contact, listes d'appel, pointages, `journal_acces_registre` en ajout seul, lecture uniquement par RPC qui journalisent, capacité et rôle DPO, `a_capacite` sans repli ni passe-droit super-admin pour cette ressource.
- **Pièges** : la RLS ne journalise pas les lectures ; les catégories elles-mêmes relèvent de l'article 9 ; ne pas réutiliser `plans_urgence_menages` ; exclure le registre du cache hors ligne (T1) et de l'IA (T3). Prérequis : corriger l'escalade sur `contextes` (section 6).

### C10 — Vue supra-communale · couverture **faible**
- **Existant** : `contextes.type` accepte `province` et `federal` (aucun en base), `contextes.province` ; console plateforme (création de clients) ; organes CC_PROV et NCCN installés d'office ; rôle `AUTORITE_PROVINCIALE` défini dans la commune ; `VueAutorite.jsx` (un incident d'une commune, parties informées) ; seule lecture inter-contextes : `ressources_partageables`.
- **Manque** : contexte provincial, opt-in de la commune et son périmètre, RPC agrégées en lecture seule (carte, signalements, demandes, scores, SITREPs transmis), messages internes aux CPU (F2), export, `communes_be`.
- **Migrations prévisibles** : `adhesions_supra_communales` journalisées, `a_acces_supra()`, RPC agrégées sans données personnelles et hors exercices, `transmissions_sitrep` en ajout seul.
- **Pièges** : tenancy plate — un gouverneur ne lit une commune qu'en y étant membre, et lit alors tout (données personnelles comprises) ; préférer des RPC dédiées à des politiques table par table ; `type` et `province` modifiables par l'admin communal ; `installer_organes_crise_standard` créerait CC_COM et PC-Ops dans un contexte provincial ; Bruxelles-Capitale n'est pas une province.

### T1 — PWA hors ligne · couverture **partielle**
- **Existant** : `sw.js` écrits à la main (admin, qg, terrain, citoyen : réseau d'abord pour la navigation, cache des fichiers statiques, jamais d'appel Supabase en cache) ; manifests ; file d'écritures `packages/shared/src/fileEcritures.js` (localStorage, upsert idempotent, rejeu ordonné) utilisée par Terrain sur 7 tables, indicateur `IndicateurFile.jsx` ; dernier état connu (`cacheLocal.js`) ; file des signalements citoyens avec deux horodatages.
- **Manque** : `vite-plugin-pwa` / Workbox, cache IndexedDB des données de l'événement actif, file côté QG, horodatage client sur `livre_de_bord`, tuiles de la commune hors ligne, interrupteur « mode black-out », script « mode avion ».
- **Migrations prévisibles** : horodatage client (`emis_le`) sur les tables écrites via la file ; ajout seul sur `livre_de_bord`.
- **Pièges** : la file n'est ni liée à l'utilisateur ni vidée à la déconnexion (appareil partagé) ; numérotation à la réception ; coexistence avec les `sw.js` manuels (préférer `injectManifest`) ; **le pré-téléchargement des tuiles est interdit sur `tile.openstreetmap.org`**, l'imagerie Esri est sous licence (décision de Ren).

### T2 — Be-Alert et SITREP structurés · couverture **faible** (les données existent)
- **Existant** : `incidents.be_alert_mode` ; bloc « Décision BE-Alert » de `activation_incident` (décidé, envoyé, heure, motif) ; `be_alert_tests` (Admin `BeAlertTests.jsx`) ; prérequis `checklist_d5_prerequis` ; 24 fiches d'action D5 ; SITREP CAN(AL) ; copie presse-papiers déjà utilisée dans Terrain (`OutilsPosition.jsx`).
- **Manque** : bloc Be-Alert formaté avec longueurs paramétrables, bouton copier depuis un message validé, « envoyé manuellement à HH:MM » en ajout seul, même mécanique pour le SITREP provincial (modèle à fournir par Ren).
- **Migrations prévisibles** : `envois_manuels` en ajout seul (source, canal, texte, longueur, heure déclarée, serveur, auteur, garde exercice), paramètres de longueur par contexte.
- **Pièges** : `activation_incident` est un upsert écrasable, pas un journal ; `incidents.be_alert_message_groupe` jamais utilisé.

### T3 — IA hors chemin critique · couverture **faible** (journal d'audit seulement)
- **Existant** : `journal_generations_ia` (0 ligne, « aucune IA branchée à ce jour », seule la validation est modifiable) ; modèles de validation humaine (`donnees_pertes_extraites`, `veille_items.genere_par_ia`, `base_connaissances_operationnelles.extrait_par_ia`). Aucun appel à une API d'IA, aucun feature flag.
- **Manque** : Edge Function, flag par commune contrôlé par la plateforme, plafonds de coût, garde technique « aucune donnée C9 », dégradation silencieuse.
- **Migrations prévisibles** : `fonctionnalites_contexte` modifiable seulement via `plateforme_*`, colonnes de coût et compteur mensuel, INSERT du journal IA réservé au service.
- **Pièges** : aujourd'hui tout membre en écriture peut insérer une fausse ligne dans le journal IA ; un flag dans `contextes.config` serait activable par l'admin communal ; sous-traitant et transferts hors UE (DPA).

## 6. Sécurité : constats hors feuille de route (à traiter avant d'ouvrir à une vraie commune)

Vérifiés en lecture seule ; aucun n'a été exploité ni testé en écriture. Correctifs = migrations à approuver.

| Gravité | Constat | Correctif proposé |
|---|---|---|
| **Critique** | `contextes` : la politique UPDATE « modification contexte si admin » (`a_acces(id,'admin')`, sans clause de vérification) et le droit UPDATE de `authenticated` sur toutes les colonnes permettent à un admin communal de passer `est_plateforme = true` sur sa commune, donc de devenir super-admin de tous les clients, ou de lever sa propre suspension (`suspendu`). Aucun trigger ne l'empêche. | Retirer le droit UPDATE sur `est_plateforme`, `suspendu*`, `motif_suspension`, `notes_plateforme`, `type` (privilèges par colonne) ou trigger BEFORE UPDATE réservé au super-admin. |
| Élevée | `benevoles_entraide` : INSERT anonyme direct sur toutes les colonnes (politique « inscription publique ») : un anonyme peut s'inscrire `statut = 'valide'` dans n'importe quel contexte ; `enregistrer_benevole_spontane` rattache ensuite une présence à un bénévole « validé » par son e-mail. | Passer par une RPC (ou trigger qui force `statut`, vide `note_interne`), restreindre les colonnes. |
| Élevée | `plans_urgence_menages` : INSERT anonyme direct sur toutes les colonnes (dont `jeton_acces`) ; `creer_plan_urgence_menage` sans contrôle de contexte ni bornes ; données sensibles (personnes à aider, médecin). | RPC seule, bornes de taille, contexte vérifié. |
| Moyenne | `ingestion-alerte-externe` (sans JWT) écrit le corps reçu, même rejeté, dans `journal_ingestions_externes`, sans limite de taille ni de débit. | Tronquer, plafonner, limiter le débit. |
| Moyenne | `contextes_publics()` expose à tous les contextes, y compris la plateforme et les clients suspendus. | Filtrer `est_plateforme` et `suspendu`. |
| Moyenne | Secrets en clair et lisibles par les comptes « écriture » : `canaux_diffusion.config.secret_value`, `sources_externes_alertes.secret`. | Vault ou colonne non lisible par l'API. |
| Faible | `spatial_ref_sys` (PostGIS) sans RLS, avec INSERT/UPDATE/DELETE pour anon ; `anon` peut exécuter 47 fonctions SECURITY DEFINER (refus interne pour la plupart) ; droits TRUNCATE de `anon`/`authenticated` sur plusieurs journaux ; tables `_test_gen*` résiduelles. | Révoquer les droits inutiles, supprimer les tables de test. |
| Faible | File d'écritures Terrain non liée à l'utilisateur ni vidée à la déconnexion (appareil partagé). | Préfixer par utilisateur, vider à la déconnexion. |

## 7. Migrations prévisibles par chantier (récapitulatif)

| Chantier | Tables / colonnes / extensions |
|---|---|
| Sécurité (préalable) | droits par colonne ou trigger sur `contextes` ; `benevoles_entraide` ; `plans_urgence_menages` ; `contextes_publics()` ; révocations |
| C1 | `pg_cron`, `pg_net` ; `alertes_externes`, `regles_reveil`, rang de seuil, acquittements, points de checklist par seuil, `jobs_etat`, tables F2 (notifications, abonnements, préférences, journal), `communes_be` (F1) |
| C4 | `packs_papier` (ou dates), bucket des cartes statiques |
| C3 | `chronologie_incident()`, `rapports_evenement`, `centres_accueil_activations`, `presences_cc`, empreinte chaînée (F5) |
| C2 | `contextes.slug`, colonnes de `signalements_citoyens`, `types_signalement`, débit et rejets, publication Realtime, extension de `ressources`, purge |
| C5 | injects des fiches, délais cibles, pause, archivage, participants, `purger_exercice()` |
| C6 | `contacts.verifie_le`, liens signés, `preparation_ponderations`, `preparation_snapshots` |
| C7 | revalidations, compétences, pointages, quarts, passations, demandes inter-communes, opt-in |
| C8 | slug, langues, champs par langue, validation des alertes, `page_publique()`, centres ouverts, routes fermées |
| C9 | registre chiffré, journal d'accès, RPC journalisées (après conception approuvée) |
| C10 | adhésions supra-communales, `a_acces_supra()`, RPC agrégées, transmissions SITREP |
| T1 | horodatage client, ajout seul sur `livre_de_bord` |
| T2 | `envois_manuels`, longueurs par contexte |
| T3 | `fonctionnalites_contexte`, coûts |
