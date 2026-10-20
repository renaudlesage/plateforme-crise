# État de la feuille de route
Dernière session : 2026-10-20 — chantier : fondations F1, F5, F3 (sprint 1, session 2) — résultat : trois migrations préparées et répétées dans des transactions annulées (tests conformes), **non appliquées**, à approuver ci-dessous ; seed des 565 communes généré depuis l'export ODWB fourni par Ren ; correspondance province ↔ zones MeteoAlarm reportée à C1.

Session précédente (même jour) : correctifs de sécurité, migration `20261020160000_correctifs_securite.sql` appliquée (version `20261020211056`) et vérifiée ; constat « critique » de la Session 0 requalifié « moyenne ».

Sessions : 3 réalisées / 16 planifiées (vague 1) — Session 0, correctifs de sécurité et F1 F5 F3 faits le 20 octobre, avant le début prévu du 2 novembre. Depuis le 20 octobre, on avance sans attendre les dates du plan (décision de Ren).

## Terminé
- Session 0 (2026-10-20, branche feat/s00-feuille-de-route, mergé : non)
- Correctifs de sécurité (2026-10-20, branche feat/securite-correctifs empilée sur feat/s00-feuille-de-route, mergé : non ; migration appliquée et vérifiée)
- Fondations F1, F5, F3 (2026-10-20, branche feat/f01-f03-f05-fondations empilée sur feat/securite-correctifs, mergé : non ; migrations non appliquées)
- Avant la feuille de route, utiles aux chantiers :
  - Renommage « Crisiware 2 » (2026-10-20, PR #2, mergé : oui)
  - Fiches REX 2026 orages éclair (A) et cyberattaque (B), import avec seuils et plan d'action, impression de fiche (2026-10-20, PR #3, mergé : oui)
  - Risques du territoire distincts des objets à risque (2026-10-20, PR #4, mergé : oui)

## En cours
- Vague 1 : du 2 novembre 2026 au 21 février 2027, réévaluation la semaine du 22 février ([SPRINTS.md](SPRINTS.md)) ; dates indicatives depuis le 20 octobre, l'ordre des chantiers reste celui du plan.
- Sprint 1 « Fondations » : sessions faites ; il reste à appliquer les trois migrations F5, F3, F1 et le seed après approbation, puis à rejouer `supabase/tests/fondations_f1_f3_f5.sql` sur la base réelle.
- Résultat de la session F1, F5, F3 :
  - **F5** : références signalement et alerte, empreinte SHA-256 chaînée calculée par le serveur (une valeur envoyée par le client est remplacée), `verifier_journal_decisions()` qui détecte une falsification (prouvé en répétition). Restent : référence « message » (question 8), journal hors incident (C7), `livre_de_bord` modifiable (T1).
  - **F3** : `pg_cron`, `pg_net`, `jobs_etat`, `jobs_signaler()` (clé de service seulement), `jobs_muets()`. Aucune tâche planifiée ni secret dans le Vault avant C1.
  - **F1** : `communes_be` et seed des 565 communes (noms FR/NL/DE, arrondissement, province, région, langues, point de la commune). Source : export ODWB « communes et localités » envoyé par Ren, car `statbel.fgov.be` est refusé par le réseau de l'environnement ; licence du jeu à confirmer. Zones de secours et de police des 261 communes wallonnes reprises de la table `communes` d'Eventware (copie datée dans `scripts/seed/sources/`, pas de base partagée) : rapprochement un à un (257 noms identiques, 4 à l'apostrophe ou à la casse près, orthographe d'Eventware retenue), 14 zones de secours, 71 zones de police. La correspondance province ↔ zones MeteoAlarm passe à C1 : `feeds.meteoalarm.org` est aussi refusé et les codes de zone ne sont pas vérifiables d'ici.
- Prochain chantier : sprint 2, C1 Réveil automatique (**D1**). Préalables : questions 3 (e-mail), 4 (téléphone), 6 (licences MeteoAlarm et IRM), 7 (source météo) et accès réseau aux flux météo (question 13).

## Capacité
Capacité prévue par le plan ; capacité déclarée par Ren au début de chaque sprint (« Sprint n : 1 ou 2 sessions »). Depuis le 20 octobre, les dates sont indicatives : une session suit la précédente dès qu'elle est livrée.

| Sprint | Dates | Chantier | Prévue | Déclarée par Ren |
|---|---|---|---|---|
| 1 | 2 → 15 nov 2026 | Session 0 + F1 F3 F5 | 2 (Session 0 déjà faite) | |
| 2 | 16 → 29 nov | C1 Réveil automatique — **D1** | 2 | |
| 3 | 30 nov → 13 déc | C4 Pack papier — **D2** | 2 | |
| 4 | 14 → 27 déc | C3 Rapport d'événement — **D3** | 1–2 (R, Noël) | |
| 5 | 28 déc → 10 jan 2027 | C2a Formulaire public | 1–2 (R, Nouvel An) | |
| 6 | 11 → 24 jan | C2b Carte et tri — **D4** | 2 | |
| 7 | 25 jan → 7 fév | C2c + C2d | 2 | |
| 8 | 8 → 21 fév | Consolidation — **D5** | 2 (R possible, congé de détente) | |

Congés de Ren : **à confirmer avant le 14 décembre** (semaines de congé, et congés scolaires de la Fédération Wallonie-Bruxelles si elles comptent), pour que la capacité déclarée corresponde au calendrier.

## À faire par Ren
1. Fournir un **exemplaire réel de SITREP provincial** (Liège de préférence) avant le chantier C3 (sprint 4) : au plus tard le 14 décembre, plus tôt si l'on continue d'avancer sans attendre les dates. À défaut : format provisoire en-tête / situation / mesures prises / besoins / prochain point.
2. **Confirmer les semaines de congé** dans la section Capacité ci-dessus (avant le 14 décembre).
3. Activer dans le tableau de bord Supabase, réglages d'authentification, la **protection contre les mots de passe divulgués** (signalée par le conseiller de sécurité ; disponibilité selon l'offre Supabase).

## Migrations à approuver
Approbation asynchrone : écrire « approuvée le AAAA-MM-JJ » à côté de la ligne ; application à la session suivante, puis vérification de l'effet réel en SQL.
- [x] **Correctifs de sécurité** — approuvée le 2026-10-20 (« Applique »), appliquée le 2026-10-20 (version `20261020211056`), effet vérifié. `supabase/migrations/20261020160000_correctifs_securite.sql` (branche feat/securite-correctifs). Non destructif, aucune app à modifier. `contextes` : un membre ne modifie plus que `config`, coordonnées et province, notes de la plateforme réservées à la console, trigger de garde ; bénévoles inscrits par le public toujours « en_attente » ; plus d'insertion directe de plans de ménage, RPC bornée ; liste publique sans plateforme ni clients suspendus ; journal des ingestions externes borné ; 19 fonctions retirées d'`anon` ; TRUNCATE, REFERENCES, TRIGGER retirés d'`anon` et `authenticated`. Répétée le 2026-10-20 : détail et preuves dans [CORRESPONDANCE.md](CORRESPONDANCE.md), section 6.
- [ ] **F5 — journal** — `supabase/migrations/20261020213000_f5_journal_empreinte.sql` : colonnes `signalement_id`, `alerte_publique_id`, `empreinte_precedente`, `empreinte` sur `journal_decisions` ; trigger d'insertion complété ; `journal_decisions_empreinte()`, `verifier_journal_decisions()`. Non destructif, aucune app à modifier.
- [ ] **F3 — planification** — `supabase/migrations/20261020213100_f3_planification.sql` : extensions `pg_cron` et `pg_net`, table `jobs_etat`, `jobs_signaler()`, `jobs_muets()`. Aucune tâche planifiée.
- [ ] **F1 — communes** — `supabase/migrations/20261020213200_f1_communes_be.sql` puis le seed `supabase/seed/communes_be.sql` (565 lignes, source ODWB, licence à confirmer ; zones de secours et de police des communes wallonnes d'après Eventware).
Répétées le 2026-10-20 (seed réduit à 13 communes) ; tests rejouables après application : `supabase/tests/fondations_f1_f3_f5.sql`. Ordre d'application : F5, F3, F1, seed.

## Décisions de Ren
- 2026-10-20 : migration `correctifs_securite` approuvée (« Applique ») ; appliquée par l'outil de migration (version `20261020211056`, dans l'historique `schema_migrations`), effet vérifié en SQL.
- 2026-10-20 : « On avance et on ne se soucie pas des délais » : les sessions s'enchaînent dans l'ordre de [SPRINTS.md](SPRINTS.md) sans attendre les dates ; les correctifs de sécurité sont préparés tout de suite.
- 2026-10-20 : le plan de sprint de référence est [SPRINTS.md](SPRINTS.md) (vague 1 : 8 sprints de deux semaines du 2 novembre au 21 février, jalons D1–D5 ; vague 2 : mars à novembre 2027, jalons D6–D10, tampon en août pour le festival ; au plus deux coupes en vague 1).
- 2026-10-20 : migration `risques_territoire` approuvée ; exécutée par Ren dans le SQL Editor (hors historique `schema_migrations`).
- 2026-10-20 : STARTER-04 (ruissellement urbain) et STARTER-07 (cyberattaque communale) retirés du pack et supprimés de la Commune Test.
- 2026-10-20 : pas de régénération des `database.types.ts` (périmés, importés nulle part) dans le cadre des chantiers récents.
- 2026-10-19 : nom affiché « Crisiware 2 » ; noms des projets Vercel et adresses `*.vercel.app` inchangés.

## Questions ouvertes
1. **Plan « 15 modules en quatre paliers »** : toujours introuvable ; [SPRINTS.md](SPRINTS.md) le cite encore (session 1). Proposition : le considérer remplacé par SPRINTS.md et clore la recherche, sauf avis contraire.
2. **Secrets en clair** (`canaux_diffusion.config.secret_value`, `sources_externes_alertes.secret`) : non couverts par la migration de sécurité. Les sortir de l'API suppose de modifier `diffuser-alerte` (qui lit le secret avec le jeton de l'utilisateur) et `ingestion-alerte-externe`, absentes du dépôt : à trancher avec la question 10.
3. **E-mail de F2 (sprint 2)** : aucun canal e-mail n'existe (`diffuser-alerte` ne gère que des webhooks). « E-mail via le webhook existant » suppose un relais externe (automate type n8n ou Make) ou un fournisseur d'envoi (SMTP, Resend…), donc une dépendance et un secret à choisir avant la deuxième session de C1 (prévue la semaine du 23 novembre, plus tôt si l'on avance).
4. **Push sur le téléphone (D1)** : sur iPhone, le web push ne fonctionne que si l'app est installée sur l'écran d'accueil (iOS 16.4 ou plus) ; sur Android, depuis le navigateur. Quel téléphone pour la démo ?
5. **Purge des exercices (C5)** : la base applique « exercice terminé = preuve non supprimable » ; le briefing demande une purge totale. Lequel prime ?
6. **Licences (décisions réservées)** : MeteoAlarm (confirmation écrite pour un usage commercial), IRM, géoportail wallon (série LIDAXES complète non republiable en ligne), tuiles de carte (le pré-téléchargement est interdit sur `tile.openstreetmap.org`) — voir [references.md](references.md). À régler avant la première session de C1 (ingestion, prévue le 16 novembre, en fait juste après F1, F5, F3) pour MeteoAlarm et l'IRM.
7. **Source météo de C1** : open data IRM (CAP mis à jour toutes les heures), MeteoAlarm (redistribution à 10 min maximum), ou les deux ?
8. **Source unique du « message D5 validé »** (C8, T2) : catalogue national, modèles de messages ou messages réflexes de l'incident ?
9. **« N défini » (C6)** : à quoi correspond ce paramètre de fiche ?
10. **Edge Functions** : versionner dans le dépôt `diffuser-alerte`, `irm-vigilance`, `ingestion-alerte-externe` ? Supprimer `bootstrap-super-admin` et `reset-password-ferrieres-test` (neutralisées) ?
11. **Marque** : « FERRU » doit-il apparaître dans l'interface à côté de « Crisiware 2 » ?
12. Reprises du briefing REX : point de départ du délai de 21 jours ouvrables du Fonds des calamités ; IMIO, CyberFundamentals et NIS2 pour la commune cible.
13. **Accès réseau de l'environnement de travail** : `statbel.fgov.be`, `feeds.meteoalarm.org` et `opendata.brussels.be` sont refusés (403). Pour C1, autoriser au moins `feeds.meteoalarm.org` (et l'hôte de l'open data IRM si retenu) dans les réglages réseau de l'environnement, ou fournir des exemples de flux en fichier. Les Edge Functions de Supabase, elles, ne sont pas concernées.
14. **Source du référentiel des communes** : le seed F1 vient de l'export ODWB « communes et localités » plutôt que de la liste REFNIS de Statbel prévue par le briefing (même nomenclature, 565 communes, fusions 2025). La table `communes` d'Eventware ne pouvait pas servir seule : 261 communes wallonnes, sans code NIS ; elle fournit les zones de secours et de police. Confirmer ce choix et la licence du jeu ODWB. Les zones de Bruxelles et de Flandre restent vides tant qu'aucune source n'est choisie.

## Dette / à revoir
- 3 Edge Functions déployées absentes du dépôt ; 2 fonctions neutralisées encore déployées.
- 119 migrations en prod pour 14 fichiers versionnés (dont F5, F3, F1 non appliqués) ; `risques_territoire` hors historique.
- `database.types.ts` périmés (52 tables) en 5 copies.
- `role_capacites` vide : la grille des capacités de l'Admin n'a aucun effet (repli sur le niveau d'accès).
- `livre_de_bord` modifiable et supprimable (à rendre ajout seul pour C3 et T1) ; changement de phase en deux écritures client.
- Libellé des étapes de plan d'action non modifiable dans l'Admin.
- Secrets de webhooks en clair (`canaux_diffusion`, `sources_externes_alertes`).
- Aucun test automatisé (Vitest à installer au C1).
- Interrogation périodique partout, Realtime inutilisé.
- File d'écritures Terrain non liée à l'utilisateur ni vidée à la déconnexion.
- README racine : `.env.example` absent, référence à « pcops-generique-test ».
- Tables résiduelles `_test_gen`, `_test_gen2`, `_test_gen3` (suppression destructive, à décider).
- `spatial_ref_sys` et `st_estimatedextent` (PostGIS, propriétaire `supabase_admin`) : droits d'`anon` non révocables par une migration.
