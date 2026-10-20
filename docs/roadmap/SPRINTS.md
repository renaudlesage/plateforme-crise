# Plan de sprint — Crisiware, feuille de route « plus-value 2026 »

Date : 20 octobre 2026. À placer dans `docs/roadmap/SPRINTS.md`, à côté du briefing de feuille de route et de `ETAT.md`.
Ce plan détaille la section 2 du briefing (ordre, dépendances, calendrier). En cas de contradiction, le briefing fixe le *quoi* et les critères d'acceptation ; ce plan fixe le *quand* et le *combien*.

---

## 0. Cadre

- **Sprint** = 2 semaines, du lundi au dimanche. **Session** = un bloc de travail de 4 à 6 h avec Claude Code, environ un par semaine. Capacité nominale : 2 sessions, soit ~10 h par sprint.
- **Capacité réduite** (1 session, ~5 h) : semaines de fêtes, congés scolaires probables (à confirmer sur le calendrier FWB), août (festival). Elles sont marquées « R » dans le calendrier.
- **Une session livre toujours quelque chose** : une migration prête, une route qui s'affiche, un test qui passe. Si le critère de démo de la session n'est pas atteint, la session suivante le termine avant d'ouvrir quoi que ce soit d'autre.
- **Un seul chantier en cours à la fois.** Les fondations (F1–F8) sont ouvertes uniquement par le chantier qui en a besoin.
- **Coupes prévues** : chaque sprint de vague 1 indique ce qu'on abandonne si on est en retard. On coupe du périmètre, jamais la vérification ni le mode dégradé.
- **Rituels solo** (coûts inclus dans la session) : début de session = lire `ETAT.md` (5 min) ; fin de session = mettre à jour `ETAT.md` + résumé à Ren (10 min) ; fin de sprint = auto-démo sur fixture, 3 lignes de rétro dans `ETAT.md` (ce qui a aidé, ce qui a freiné, ce qu'on change).
- **Migrations** : préparées en session, approuvées par Ren de façon asynchrone dans `ETAT.md`, appliquées à la session suivante. Toujours non destructives (le garde-fou de confirmation Supabase a déjà rejeté silencieusement des migrations à base de DROP) ; vérifier l'effet réel après application.
- **Suivi** : dans `ETAT.md`, une ligne « Sessions : X réalisées / 16 planifiées (vague 1) » mise à jour à chaque fin de session. Un retard de 2 sessions déclenche la revue des coupes.

---

## 1. Vue d'ensemble

### Vague 1 — 2 novembre 2026 → 28 février 2027

| Sprint | Dates | Chantier | Objectif | Jalon de démo | Capacité |
|---|---|---|---|---|---|
| 1 | 2 → 15 nov | Session 0 + F1 F3 F5 | Repo cartographié, journal immuable, référentiel communes | — | 2 |
| 2 | 16 → 29 nov | C1 Réveil automatique | Une alerte orange IRM réveille le CPU | **D1** push reçu sur le téléphone | 2 |
| 3 | 30 nov → 13 déc | C4 Pack papier (+ F4) | Le pack s'imprime en 6 pages | **D2** wifi coupé, pack imprimé | 2 |
| 4 | 14 → 27 déc | C3 Rapport d'événement | Le rapport se génère en un clic | **D3** synthèse 2 pages + SITREP | 1–2 (R) |
| 5 | 28 déc → 10 jan | C2a Formulaire public | Un citoyen signale depuis son téléphone | signalement hors ligne puis synchro | 1–2 (R) |
| 6 | 11 → 24 jan | C2b Carte et tri | Le CC voit la situation en temps réel | **D4** 5 signalements → 2 grappes | 2 |
| 7 | 25 jan → 7 fév | C2c + C2d | Boucle de retour, offres d'aide, dégâts | export dégâts CSV | 2 |
| 8 | 8 → 21 fév | Consolidation | Démo de bout en bout « 30 mai 2026 » | **D5** démo à une commune pilote | 2 (R possible) |
| — | 22 → 28 fév | Réévaluation | Décision go / no-go vague 2 | — | — |

### Vague 2 — 1 mars 2027 → novembre 2027

| Sprint | Dates | Chantier | Jalon | Capacité |
|---|---|---|---|---|
| 9 | 1 → 14 mars | C5 Mode exercice (1/2) : horloge, injects, rôles, garde-fous | — | 2 |
| 10 | 15 → 28 mars | C5 (2/2) : attendus, débrief, rapport d'exercice, purge | **D6** exercice jouable | 2 |
| 11 | 29 mars → 11 avr | C6 Tableau de bord : indicateurs, score, 3 actions, snapshots | — | 2 |
| 12 | 12 → 25 avr | C6 campagne contacts + C7 revalidation annuelle | — | 2 |
| 13 | 26 avr → 9 mai | C7 bénévoles par QR, pointage, relèves | — | 1–2 (R) |
| 14 | 10 → 23 mai | C7 demandes inter-communes, opt-in RLS | **D7** mutuelle opérationnelle | 2 |
| 15 | 24 mai → 6 juin | C8 page publique + flux de validation | — | 2 |
| 16 | 7 → 20 juin | C8 multilingue FR/DE/NL + T2 Be-Alert/SITREP | **D8** page publique en DE | 2 |
| 17 | 21 juin → 4 juil | T1 PWA (1/2) : précache, données, file de synchro | — | 2 |
| 18 | 5 → 18 juil | T1 (2/2) : tuiles, indicateurs, mode black-out | **D9** démo black-out | 1 (R) |
| 19 | 19 juil → 1 août | C9 conception RGPD (document à faire valider) | — | 1 (R) |
| 20–21 | 2 → 29 août | Tampon, correctifs, retours pilotes | — | 0–1 (R, festival) |
| 22 | 30 août → 12 sept | C9 réalisation (1/3) : modèle, chiffrement, RLS, journal des accès | — | 2 |
| 23 | 13 → 26 sept | C9 (2/3 et 3/3) : plans de contact, listes d'appel, export scellé | — | 2 |
| 24 | 27 sept → 10 oct | C10 Vue provinciale (1/2) : tenant, opt-in, vue agrégée | — | 2 |
| 25 | 11 → 24 oct | C10 (2/2) : SITREP transmis, messages aux CPU, export | **D10** démo province | 2 |
| 26 | 25 oct → 7 nov | T3 IA optionnel, REX vague 2, bilan un an | — | 2 |

---

## 2. Vague 1 — détail par sprint

### Sprint 1 — 2 → 15 novembre — « Fondations »

**Objectif** : savoir exactement sur quoi on construit, et poser les trois fondations dont C1 a besoin.

- **Session 1 (sem. du 2 nov) — Session 0 du briefing.** Cartographier les quatre apps, le modèle de tenancy, l'auth, les tables et RLS, la lib de carte, les notifications existantes, l'impression, les Edge Functions et cron existants. Retrouver le plan de sprint 15 modules et produire `CORRESPONDANCE.md`. Créer `docs/roadmap/` (briefing découpé, `ETAT.md`, ce plan). Relever ce qui existe déjà parmi F1–F8. Lister les migrations prévisibles.
  Livrable : `docs/roadmap/*`, résumé des écarts et questions.
- **Session 2 (sem. du 9 nov) — F1, F5, F3.** Table `communes_be` chargée depuis la liste NIS (script de seed, pas de données en dur). Journal append-only : trigger interdisant UPDATE/DELETE, horodatages serveur et client, auteur, référence, hash chaîné si peu coûteux. `pg_cron` + `pg_net` + table `jobs_etat`. Tests : une mise à jour du journal échoue ; une commune est retrouvée par son NIS.
  Livrable : migrations préparées et soumises, tests.

**Démo de fin de sprint** : en SQL, une entrée de journal ne peut pas être modifiée ; la table des communes répond.
**Risque** : le schéma existant diverge (journal déjà modifiable, tenancy différente de l'hypothèse). Parade : approbation asynchrone des migrations dans `ETAT.md` avant la session 3.
**Coupe** : le hash chaîné.

### Sprint 2 — 16 → 29 novembre — « Réveil automatique » (C1)

**Objectif** : une alerte orange IRM arme un seuil et réveille le CPU et le bourgmestre, avec trace horaire.

- **Session 3 (sem. du 16 nov) — Ingestion.** Edge Function `ingest-meteoalarm`, parseur CAP avec trois fixtures (jaune, orange, rouge, une multi-provinces), table `alertes_externes` avec dédoublonnage par identifiant et version, cron 10 min, attribution de la source, détection de flux muet (> 1 h) via `jobs_etat`.
  Livrable : fonction déployée, tests du parseur verts, écran Veille minimal (liste des alertes).
- **Session 4 (sem. du 23 nov) — Seuils et notifications.** Table `regles_reveil` et formulaire CRUD ; règles par défaut livrées à l'import des fiches A et canicule ; moteur : alerte → règle → seuil S0/S1 → événement en veille ou rattachement → entrée de journal « alerte reçue à HH:MM » ; F2 `notifier` (web push VAPID + e-mail via le webhook existant) ; acquittement « Vu, je prends » journalisé ; escalade vers le suppléant après 15 min ; bandeau et notification en cas de flux muet.
  Livrable : parcours complet sur fixture.

**Démo D1** : fixture « orange orages, province de Liège » → notification push sur le téléphone de Ren → acquittement → journal avec les deux heures.
**Risque** : web push plus long que prévu (service worker, clés). Parade et coupe : e-mail seul en vague 1, push reporté au sprint 8.
**Variables d'environnement** : clés VAPID → `.env.example` + rappel « fichiers cachés » avant upload.

### Sprint 3 — 30 novembre → 13 décembre — « Pack papier » (C4 + F4)

**Objectif** : le mode dégradé minimal existe et se démontre.

- **Session 5 (sem. du 30 nov) — F4 et pack fiche.** Design system print (`@media print`, aucune police externe, pagination), route `/print/pack/fiche/:id` : fiche condensée avec cases à cocher par seuil, rôles, messages-types, annuaire CC / disciplines / mutuelle / prestataires, tableau de signalements vierge, journal vierge, feuille de relève, feuille de présence. Contrainte : 6 pages.
- **Session 6 (sem. du 7 déc) — Carte et pack événement.** Image statique des points noirs de la commune pré-générée et stockée (couches WMS du géoportail wallon seulement si la licence est claire, sinon points communaux seuls) ; route `/print/pack/evenement/:id` ; bouton « Générer le pack papier » dans la checklist S1 et dans les paramètres ; date de dernière génération enregistrée.

**Démo D2** : wifi coupé sur le PC, pack imprimé depuis le cache du navigateur ; 6 pages, lisible, cases cochables.
**Coupe** : les couches WMS.

### Sprint 4 — 14 → 27 décembre — « Rapport d'événement » (C3) — capacité réduite

**Objectif** : la traçabilité devient un document qu'on montre.

- **Session 7 (sem. du 14 déc) — Chronologie et synthèse.** Fusion alertes reçues et acquittées + journal + messages D5 envoyés + signalements agrégés (à ce stade, fixtures) + ressources et centres ; statistiques de délais (alerte → acquittement → CC → phase) ; variante « Synthèse pour le conseil » (2 pages) ; variante « SITREP » 1 page avec heure T figée et mention « transmis à HH:MM » journalisée ; exports JSON et CSV.
- **Session 8 (sem. du 21 déc, optionnelle) — Dossier complet.** Annexes (carte statique, messages intégraux, participants), section REX éditable via CRUD, mention d'intégrité (hash de chaîne si F5 l'a).

**Démo D3** : rapport d'une fixture en un clic, synthèse ≤ 2 pages, SITREP 1 page.
**Prérequis à demander à Ren avant le 14 déc** : un exemplaire réel de SITREP provincial (Liège de préférence). À défaut, format provisoire : en-tête / situation / mesures prises / besoins / prochain point.
**Coupe** : le dossier complet et la section REX → sprint 8 ou vague 2.

### Sprint 5 — 28 décembre → 10 janvier — « Signal citoyen, formulaire » (C2a) — capacité réduite

**Objectif** : un citoyen signale depuis son téléphone, même sans réseau au moment de l'envoi.

- **Session 9 (sem. du 28 déc, légère) — F8 et ingestion.** Edge Function `signal-citoyen` : limitation de débit par IP hachée et par commune, honeypot, taille et MIME, journal des rejets ; bucket privé `signalements` avec URL signées ; table `signalements` ; aucune donnée personnelle dans les logs.
- **Session 10 (sem. du 4 jan) — Formulaire public.** Route `/s/:slugCommune`, QR par commune, formulaire mobile (type, localisation GPS ou rue + carte, 2 photos compressées côté client, gravité, description, contact facultatif, consentement et mention vie privée paramétrable), file hors ligne IndexedDB avec renvoi automatique, numéro de signalement et lien de suivi par jeton, page « pas de situation d'urgence en cours » avec lien paramétrable vers l'app de signalement quotidien.

**Démo** : signalement envoyé en mode avion depuis un téléphone, synchronisé à la reconnexion, visible en base avec ses deux horodatages.
**Coupe** : la carte dans le formulaire (rue + GPS suffisent en v1).

### Sprint 6 — 11 → 24 janvier — « Signal citoyen, carte et tri » (C2b)

**Objectif** : le CC voit la situation avant la saturation des pompiers.

- **Session 11 (sem. du 11 jan) — Vue CC.** Carte avec clusters par gravité (lib existante), liste triable et filtrable (type, statut, secteur, heure), fiche de détail avec photos, statuts (nouveau → pris en charge par discipline/ressource/agent → clos, ou spam) avec entrée légère au journal, Supabase Realtime < 5 s.
- **Session 12 (sem. du 18 jan) — Tri et dégradé.** Grappes (même type, < 150 m, < 30 min) avec compteur ; « danger de mort » → notification immédiate au CC de garde (F2) et mise en avant jusqu'à prise en charge ; marquage spam ; liste imprimable des signalements ouverts (F4) et rattachement au tableau vierge du pack papier.

**Démo D4** : 5 signalements de fixture → 2 grappes ; un « danger de mort » notifie le CC de garde et reste en tête ; apparition en < 5 s.

### Sprint 7 — 25 janvier → 7 février — « Boucle de retour, offres d'aide, dégâts » (C2c + C2d)

**Objectif** : le citoyen sait qu'il a été vu ; la solidarité devient une ressource ; l'après-crise est documenté.

- **Session 13 (sem. du 25 jan) — C2c.** Page de suivi par jeton (statut, heure de prise en charge, message court de la commune), notification au déclarant si un canal existe déjà dans `diffuser-alerte` ; type « offre d'aide » → `ressources_temporaires` visibles dans la liste des ressources du CC avec contact et disponibilité.
- **Session 14 (sem. du 1 fév) — C2d.** Mode « déclaration de dégâts » activable N jours après la levée de phase (adresse, nature, assuré oui/non, photos, date), export CSV et liste imprimable pour le dossier Fonds des calamités et la commission de constat des dégâts aux cultures, rappel du délai paramétré (21 jours ouvrables à confirmer).

**Démo** : boucle de retour complète sur un signalement ; export dégâts CSV ouvert dans un tableur.
**Coupe** : C2d entier → vague 2 (sprint 20–21).

### Sprint 8 — 8 → 21 février — « Consolidation et démo »

**Objectif** : tout ce qui a été coupé et remis, une démo de bout en bout, un REX écrit.

- **Session 15 (sem. du 8 fév) — Dette et RGPD.** Job de purge (contacts 90 jours, photos 12 mois, IP 7 jours) testé ; web push si coupé au sprint 2 ; dossier complet C3 si coupé ; tests manquants ; T2 Be-Alert et SITREP en copier-coller structuré avec journalisation (½ session) ; `.env.example` à jour.
- **Session 16 (sem. du 15 fév, possiblement R) — Démo et REX.** Scénario de démo rejouant le 30 mai 2026 sur fixture : alerte orange → réveil → acquittement → signalements → grappes → décisions → rapport → pack papier → déclaration de dégâts. Script de démo écrit (15 min). `docs/roadmap/REX-vague1.md` : ce qui a été livré, coupé, appris, mesuré. Préparation de la réévaluation.

**Jalon D5** : démo de 15 minutes jouable devant une commune pilote.

### Semaine du 22 février — Réévaluation

Critères proposés (à trancher par Ren) :
1. **Produit** : D1 à D5 atteints ? Quels chantiers coupés ?
2. **Terrain** : au moins une commune pilote a vu la démo ; au moins un CPU a testé le réveil et le signal citoyen en exercice ; retours écrits.
3. **Rythme** : la cadence de 4 à 6 h/semaine a-t-elle tenu ? Sessions réalisées / 16.
4. **Cadre** : statut de l'activité complémentaire clarifié avant toute démo commerciale ; licences des flux externes réglées.
5. **Décision** : vague 2 telle quelle, vague 2 réduite (C5, C6, C7, C8 seulement), ou pause.

---

## 3. Vague 2 — détail par sprint

Les critères d'acceptation sont ceux du briefing ; ici seulement le découpage par session.

- **Sprint 9 (1 → 14 mars) — C5 (1/2).** S17 : modèle exercice, horloge simulée (x1/x2/x6, pause), injects éditables depuis les fiches, diffusion interne à l'heure simulée ; S18 : rôles (joueurs, observateurs, directeur), notes horodatées, bandeau EXERCICE, refus de tout canal externe en mode exercice (test), route publique fermée aux exercices sauf jeton figurants.
- **Sprint 10 (15 → 28 mars) — C5 (2/2).** S19 : attendus par seuil, débrief automatique (écarts, actions non faites) ; S20 : rapport d'exercice via C3, archivage, purge totale. **D6**.
- **Sprint 11 (29 mars → 11 avr) — C6.** S21 : indicateurs calculés (fiches adaptées, contacts, ressources, exercice, pack, réveil, points noirs, page publique, registre), score pondéré éditable, trois actions max ; S22 : snapshots nocturnes, tendance, export conseil communal.
- **Sprint 12 (12 → 25 avr) — C6 + C7 (1/3).** S23 : campagne « confirmez vos coordonnées » (lien signé, expiration, date) ; S24 : revalidation annuelle des ressources (lien oui/non/modifier, suivi, relances).
- **Sprint 13 (26 avr → 9 mai, R) — C7 (2/3).** S25 : inscription bénévole par QR (réutilise C2), compétences, affectation, pointage, export des heures, briefing sécurité journalisé ; S26 si capacité : planning de quarts et note de passation générée depuis le journal.
- **Sprint 14 (10 → 23 mai) — C7 (3/3).** S27 : modèle d'opt-in et politiques RLS de visibilité au réseau (tests de non-fuite) ; S28 : demandes de ressources inter-communes avec traces des deux côtés et mention « renforts officiels via l'autorité de phase ». **D7**.
- **Sprint 15 (24 mai → 6 juin) — C8 (1/2).** S29 : page publique `/c/:slug` (état, consignes, services, routes fermées, centres, lien de signalement, numéros, dernière mise à jour), cache court, < 200 ko ; S30 : flux rédaction → validation journalisée → publication page + `diffuser-alerte`, préréglages M1–M5 et « cyber ».
- **Sprint 16 (7 → 20 juin) — C8 (2/2) + T2.** S31 : dictionnaire FR/DE/NL (F7), champs par langue, langues par commune depuis F1 ; S32 : T2 finalisé (longueurs Be-Alert paramétrables, copie, journalisation), domaine personnalisé documenté. **D8**.
- **Sprint 17 (21 juin → 4 juil) — T1 (1/2).** S33 : `vite-plugin-pwa`, précache, cache des données de l'événement actif ; S34 : file de synchronisation (journal et statuts), ordre par horodatage client, horodatage serveur à réception, indicateur hors ligne.
- **Sprint 18 (5 → 18 juil, R) — T1 (2/2).** S35 : tuiles de carte sur la bbox (zooms 12–16, plafond, licence), interrupteur « mode black-out », test mode avion scripté. **D9**.
- **Sprint 19 (19 juil → 1 août, R) — C9 conception.** S36 : `C09-conception-rgpd.md` (finalité, base légale à confirmer, consentement, conservation, droits, journal des accès, chiffrement, RLS, AIPD). Validation par Ren et un DPO communal avant tout code.
- **Sprints 20–21 (2 → 29 août, festival) — Tampon.** Correctifs des pilotes, C2d si coupé en vague 1, dette d'`ETAT.md`. Aucun nouveau chantier.
- **Sprint 22 (30 août → 12 sept) — C9 (1/3).** S37 : modèle de données, chiffrement des champs sensibles, RLS D2/CPAS, journal des accès ; S38 : tests RLS et vérification SQL du chiffrement.
- **Sprint 23 (13 → 26 sept) — C9 (2/3 et 3/3).** S39 : inscription (personne, proche, CPAS), catégories, plans de contact par seuil ; S40 : listes d'appel par secteur, affectation (C7), pointage, escalade, export chiffré pour liste papier scellée, purge et effacement.
- **Sprint 24 (27 sept → 10 oct) — C10 (1/2).** S41 : tenant provincial, rôle lecture seule, opt-in (modèle C7) ; S42 : vue agrégée (carte, phases, signalements agrégés, demandes ouvertes, scores C6), tests de non-fuite.
- **Sprint 25 (11 → 24 oct) — C10 (2/2).** S43 : transmission des SITREP (C3) journalisée des deux côtés ; S44 : messages internes province → CPU, export du tableau. **D10**.
- **Sprint 26 (25 oct → 7 nov) — Clôture.** S45 : T3 IA optionnel derrière feature flag (si le temps le permet) ; S46 : `REX-vague2.md`, bilan un an, feuille de route 2028.

---

## 4. Jalons

| Jalon | Date cible | Preuve |
|---|---|---|
| D1 Réveil | 29 nov 2026 | Push reçu, acquittement journalisé avec les deux heures |
| D2 Pack papier | 13 déc 2026 | 6 pages imprimées wifi coupé |
| D3 Rapport | 27 déc 2026 | Synthèse 2 pages + SITREP 1 page en un clic |
| D4 Signal citoyen | 24 jan 2027 | 5 signalements → 2 grappes, danger de mort notifié |
| D5 Démo vague 1 | 21 fév 2027 | Scénario « 30 mai 2026 » joué en 15 min devant une commune |
| D6 Exercice | 28 mars 2027 | Exercice de 30 min simulées, débrief, zéro appel externe |
| D7 Mutuelle | 23 mai 2027 | Demande inter-communes tracée, RLS prouvée |
| D8 Page publique | 20 juin 2027 | Page en DE, publication validée et journalisée |
| D9 Black-out | 18 juil 2027 | Journal saisi hors ligne, synchronisé dans l'ordre |
| D10 Province | 24 oct 2027 | Vue agrégée sur 5 communes, SITREP transmis |

---

## 5. Capacité et calendrier

- Vague 1 : 16 semaines, 2 à 3 semaines réduites (Noël, Nouvel An, éventuel congé de détente mi-février) → 13 à 14 sessions réelles pour 16 planifiées. Le plan tient si **au plus deux coupes** sont activées. Au-delà, C2d et le dossier complet C3 passent en vague 2 sans discussion.
- Vague 2 : 36 semaines, réduites fin avril–début mai, juillet, août (festival) → ~28 sessions réelles pour 30 planifiées ; les sprints 20–21 sont un tampon volontaire.
- Jours fériés dans la fenêtre : 11 nov, 25 déc, 1 jan, 29 mars (lundi de Pâques), 6 mai (Ascension), 17 mai (lundi de Pentecôte), 21 juil, 15 août.
- Capacité déclarée par Ren au début de chaque sprint dans `ETAT.md` (« Sprint n : 1 ou 2 sessions »).

---

## 6. Risques et parades

| Risque | Effet | Parade |
|---|---|---|
| Schéma existant incompatible avec F5/F6 | Migrations lourdes en sprint 1–2 | Session 0 lève le point ; approbation asynchrone ; migrations non destructives |
| Migration rejetée silencieusement par Supabase | Fonctionnalité crue livrée, en réalité absente | Vérifier l'effet réel en SQL après chaque application |
| Licence MeteoAlarm / IRM | C1 bloqué | Vérifier en session 3 ; alternative open data IRM ; en dernier recours, saisie manuelle de l'alerte avec les mêmes seuils |
| Web push plus long que prévu | Sprint 2 déborde | E-mail seul, push en sprint 8 |
| Pic au travail (exercices, incidents) ou famille | Sessions perdues | Tampons des sprints 8, 20–21 ; règle des deux coupes |
| Démos qui ajoutent du périmètre | Dispersion | Toute demande de pilote va dans `ETAT.md` « à revoir », jamais dans le sprint en cours |
| Perte de contexte entre sessions Claude Code | Travail refait ou incohérent | `ETAT.md` obligatoire ; une branche par chantier ; résumé systématique |
| Limites du plan Supabase (Realtime, Storage, Edge) | C2 ralenti | Mesurer en sprint 6 ; quotas et compression photo |
| RGPD du registre C9 | Blocage juridique | Conception validée avant le code, sprint 19 isolé |

---

## 7. Première action

Lundi 2 novembre : ouvrir Claude Code sur le repo avec le briefing de feuille de route et ce plan, et lancer la Session 0. Fin de session attendue : `docs/roadmap/` créé, `ETAT.md` initialisé avec « Sessions : 1 / 16 », liste des migrations prévisibles et des questions à trancher avant la session 2.
