# Briefing pour Claude Code — Géo-barrière et itinéraire sûr (Terrain)
*2026-11-21 (vérifié contre le dépôt et la base le 21/11, après la PR #11) · dépôt `renaudlesage/plateforme-crise`, branche `main` · Supabase `apjswshvzbejpvlxfnek`*

> **Demande de Ren** : un guidage GPS qui permette aux intervenants terrain d'éviter la zone d'exclusion.
> **Statut** : paliers 1 et 2 codés, sur `main` et déployés (base migrée, Edge Function **v3**). Corrections de revue fusionnées le 21/11 (PR #11). **Aucun test réel sur téléphone ni aucun appel réel au moteur de routage** : vérifié par tests unitaires, tests SQL en transaction annulée, build Vite et appels sans clé à la fonction déployée. Le palier 2 attend le secret `ORS_API_KEY` (vérifié absent le 21/11 : la fonction répond 503 `non_configure`).
> Règles générales du projet : `briefing-claude-code-2026-10-18.md` (hors dépôt). Conventions : « CC » = Comité de Coordination (jamais « PC-Ops » pour le CC, jamais « QG » dans l'interface), identifiants techniques `apps/qg` inchangés.

## 1. Ce qui existe aujourd'hui

### 1.1 Palier 1 — géo-barrière (commit `58caa4b`, corrigé par la PR #11)
| Pièce | Fichier | Rôle |
|---|---|---|
| Logique pure | `packages/shared/src/geo.js` | `etatGeoBarriere(position, zones, seuil=150)` → `{ etat: hors/approche/dedans, zone, distanceBord }` ; `transitionGeoBarriere(avant, après)` → `approche/entree/sortie/null` ; `lisserSortieZone(avant, brut, attente, maintenant, délai)` → `{ apres, attente, echeance }` ; `SEUIL_APPROCHE_ZONE_M` |
| Tests | `packages/shared/src/geo.test.js` | 16 cas Vitest |
| Suivi | `apps/terrain/src/context/PositionContext.jsx` | zones rouges de l'incident suivi rechargées chaque minute (`PERIODE_ZONES_MS`), rattachées à leur incident (`zonesIncidentId`), cache local `zones_rouges.<incidentId>` via `lib/cacheLocal.js` ; sortie confirmée après `DELAI_CONFIRMATION_MS = 8 s`, **réévaluée par minuteur à l'échéance même sans nouvelle position** ; changement d'incident → état neutre sans journaliser de sortie ; vibration + bip (Web Audio débloqué au geste d'activation) ; journalisation des entrées/sorties |
| Bandeau | `apps/terrain/src/components/BandeauZone.jsx` | orange à l'approche (distance au bord), rouge dedans ; dit si les zones viennent du cache et si l'entrée a été transmise au CC ; utilisé dans `pages/Terrain.jsx` et `components/OutilsPosition.jsx` |
| Journal | table `franchissements_zone` (migration `20261119100000_geo_barriere_franchissements.sql`, appliquée) | ajout seul pour `authenticated` (grants colonne par colonne, pas d'update/delete), RLS `a_capacite(contexte_id,'incidents','creer'/'lire')`, déclencheur `franchissements_zone_controle()` (incident ∈ contexte → P0011, zone ∈ incident → P0012, `type_zone` copié, `auteur_id` forcé, heure appareil plafonnée à now+5 min). Note : `search_path = public` sans `pg_temp` (tables qualifiées, risque faible) ; l'heure appareil peut être antidatée (`cree_le` reste l'heure serveur) |
| Tests SQL | `supabase/tests/geo_barriere_franchissements.sql` | 19 vérifications, conformes sur la base réelle |
| CC | `apps/qg/src/components/SyntheseIncident.jsx` | carte Terrain : entrées en zone rouge sur 2 h + 3 derniers mouvements |

**Consentement en vigueur** : les franchissements ne sont envoyés au CC que si `partage` (position partagée) est actif ; sinon alerte locale seulement et le bandeau dit « Le CC n'en est pas informé ». Décision de Ren en attente pour l'inverse (condition `partage &&` dans l'effet géo-barrière de `PositionContext.jsx`).

**Comportements assumés** : une zone levée pendant qu'on est dedans est journalisée comme une sortie ; une seconde zone rouge franchie alors qu'on est déjà dans une première ne produit pas d'événement ; le bruit GPS au bord peut encore produire des paires entrée/sortie au-delà de 8 s. Les zones jaunes (dissuasion) sont ignorées.

### 1.2 Palier 2 — itinéraire sûr (commits `0d40393`, `90cac2d`, corrigé par la PR #11)
| Pièce | Fichier | Rôle |
|---|---|---|
| Logique pure serveur | `supabase/functions/_shared/itineraire.ts` | cercles à éviter (`cerclesDesZones` : rouges + `MARGE_ZONE_M` 25 m, oranges sur demande ; `cerclesDesPoints` : observations `route_coupee`/`inondation` ouvertes, rayon 40 m), `preparerCercles` (zone rouge/orange de destination → refus ; **toutes** les zones contenant le départ retirées du calcul et du contrôle), `multiPolygoneAEviter`, `cerclesTraverses` (contrôle indépendant, pas 20 m), `pointsDePassage` (≤ 8), `interpreterReponseOrs` |
| Tests | `supabase/functions/_shared/itineraire.test.ts` | 20 cas Vitest |
| Edge Function | `supabase/functions/itineraire-sur/index.ts` | **v3 déployée** (21/11), `verify_jwt = true`. POST `{ incident_id, depart{lat,lon}, arrivee{lat,lon}, profil 'driving-car'\|'foot-walking', inclure_orange }`. Lit incident, zones et observations **avec le JWT de l'appelant** (RLS ; pas d'accès → 403). Appelle `https://api.heigit.org/openrouteservice/v2/directions/{profil}/geojson` avec un délai de 15 s. Réponses : 503 `non_configure` sans secret, 422 `destination_en_zone`, 502 `aucun_itineraire`/`moteur`, 504 `delai`, 429 relayé. Avertissement en tête si les points terrain sont illisibles. Rien n'est stocké |
| Client partagé | `packages/shared/src/itineraire.js` (+ test) | `lienGoogleMapsVia`, `libelleDuree`, `libelleEvites`, `messageErreurFonction` |
| Terrain | `apps/terrain/src/components/ItineraireSur.jsx` | `useItineraireSur()` (départ = position de l'appareil), `ResumeItineraire`, `BoutonItineraire` (lieux d'Autour de moi, missions d'entraide géolocalisées), `PanneauItineraire` (page Carte : mode `itineraire`, destination touchée, tracé via prop `traces` de `CarteCrise`, bleu ou rouge si traversée, recalcul proposé quand `cleZones` change) |
| Carte partagée | `packages/shared/src/CarteCrise.jsx` | prop `traces = [{ id, points:[[lat,lon]…], couleur, libelle }]` (Polyline) |

**Déploiement de la fonction** : l'outil de déploiement ne connaît pas `../_shared/`, donc la version déployée importe `./_shared/itineraire.ts` (copie du fichier partagé). Dans le dépôt, l'import reste `../_shared/itineraire.ts`. Toute modification de `_shared/itineraire.ts` impose un redéploiement avec la copie à jour.

## 2. Ce qui bloque et ce qui n'a pas été testé
1. **Secret `ORS_API_KEY` absent** (vérifié le 21/11). Ren crée un compte sur `https://openrouteservice.org/dev/#/signup` (comptes gérés par HeiGIT), copie la **Basic Key** et la pose dans Supabase › Edge Functions › Secrets. Pas de redéploiement nécessaire. Quota gratuit annoncé : 2 000 directions/jour, partagé entre toutes les communes clientes (limite par minute non vérifiée).
2. **Aucun appel réel à ORS.** Depuis l'environnement de travail, `supabase.co` est joignable, `heigit.org` et les domaines Vercel ne le sont pas. Premier aller-retour : Terrain › Carte › 🛡 Itinéraire sûr vers un point de l'autre côté de la zone rouge de « Inondation Logne » (Commune Test). Il faut un JWT d'utilisateur (la clé publique ne suffit pas : RLS → 403).
3. **Aucun passage Chromium ni PWA sur téléphone** sur les écrans des deux paliers.
4. **Valeurs de départ** à ajuster au REX : 150 m d'approche, 8 s de confirmation de sortie, 25 m de marge zone, 40 m autour d'une route coupée, 15 s de délai moteur, `radiuses: [-1, -1]`.
5. **À vérifier au premier essai réel** : code d'erreur ORS quand la destination est hors réseau ; rendu des points de passage dans Google Maps (arrêts, recalcul possible) ; taille de `avoid_polygons` avec la zone orange de 1 200 m (limite de surface ORS non vérifiée).
6. **À vérifier au prochain exercice (corrections du 21/11)** : bandeau rouge qui disparaît ~8 s après la sortie sans bouger ; itinéraire depuis l'intérieur d'une zone tracé en bleu avec le seul avertissement « Vous partez de l'intérieur d'une zone à éviter… ».

## 3. Si Claude Code reprend la main — étapes proposées
1. **Premier appel réel** une fois le secret posé (JWT d'un utilisateur de la Commune Test). 503 `non_configure` : secret manquant ; 502 `moteur` avec HTTP 403 : clé mal collée. Consigner dans `docs/roadmap/ETAT.md`.
2. **Test Chromium des écrans** : bandeau (approche/dedans, cache hors ligne, « non transmis »), panneau Itinéraire (sans position, destination en zone, résultat avec/sans traversée, délai), `BoutonItineraire` sur une mission. Mocker `supabase.functions.invoke` pour les erreurs.
3. **Décision en suspens** : journaliser sans partage de position ? Ne pas changer sans accord de Ren.
4. Ensuite seulement, si Ren le demande : afficher au CC les itinéraires calculés (nouvelle table, ajout seul, RLS comme `franchissements_zone`) ; étendre aux bénévoles (zone orange) ; clé ORS par commune ou Valhalla auto-hébergé si le quota devient un problème ; limite d'appels par utilisateur.

## 4. Ce qu'il ne faut pas faire
- Ne pas remettre `api.openrouteservice.org` : le domaine est arrêté.
- Ne pas mettre la clé ORS dans le code client, dans le dépôt ni dans une variable `VITE_*` : secret d'Edge Function uniquement.
- Ne pas appeler ORS depuis le navigateur : tout passe par la fonction, qui applique la RLS.
- Ne pas présenter l'itinéraire comme une navigation : « le conducteur reste responsable » et l'invitation à recalculer quand les zones changent doivent rester.
- Ne pas transformer la géo-barrière en contrôle d'accès : c'est un rappel et une trace, le droit d'entrer en zone rouge se décide sur place (Dir PC-Ops).
- Ne pas ajouter d'update/delete sur `franchissements_zone`.
- Pas de `delete from` / `drop table` / `drop function` littéral dans le SQL passé par l'outil Supabase ; `create or replace trigger` plutôt que `drop trigger`.
- Ne pas déclarer terminé sans test réel ; dire ce qui n'a pas été testé.
- Aucun déploiement ni migration en production sans accord explicite de Ren.
- **Branches** : les paliers 1 et 2 ont été poussés directement sur `main` ; les corrections du 21/11 sont passées par une branche et une PR (#11). Convention à trancher par Ren ; par défaut, branche + PR.

## 5. Repères de données (Commune Test, vérifiés le 21/11)
Contexte `149654e6-8339-4771-8201-0eab24fc07d2` « Commune Test » · incident en cours « Inondation Logne » `24393732-cf3a-48d7-ad23-661d44c46d07` · zone rouge r = 100 m (`exclusion`) et zone orange r = 1 200 m (`isolation`) en 50.3934 / 5.5382, non levées · 3 observations bloquantes ouvertes (1 `route_coupee`, 2 `inondation`) · utilisateur `baa89e27-…` : rôle DIR_PC_OPS, accès `ecriture` (aucune capacité détaillée : droits par le niveau d'accès) · `zones_intervention.perimetre` ∈ {exclusion, isolation, dissuasion}, cohérent avec `type_zone` (rouge/orange/jaune).
