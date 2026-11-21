# Briefing pour Claude Code — Géo-barrière et itinéraire sûr (Terrain)
*2026-11-21 · dépôt `renaudlesage/plateforme-crise`, branche `main` · Supabase `apjswshvzbejpvlxfnek` · docs de référence dans ce dossier : `geo-barriere-2026-11-19.md`, `briefing-claude-code-2026-10-18.md` (règles du projet)*

> **Demande de Ren** : un guidage GPS qui permette aux intervenants terrain d'éviter la zone d'exclusion.
> **Statut** : paliers 1 et 2 codés, poussés sur `main` et déployés (base migrée, Edge Function **v3**). Le commit `85aad6f` (21/11, revue, PR #11) a corrigé six points (voir 1.3) ; la fonction a été **redéployée en v3 le 21/11** avec ces corrections, et Vercel a redéployé les apps depuis `main` (merge `16a7c51`). **Aucun test réel sur téléphone ni aucun appel réel au moteur de routage** : le code n'a été vérifié que par tests unitaires, tests SQL en transaction annulée et bundles esbuild. Le palier 2 attend un secret (`ORS_API_KEY`) que Ren n'a pas encore pu créer (serveur de comptes HeiGIT indisponible le 20/11 au matin).
> Conventions à ne pas casser : « CC » = Comité de Coordination (jamais « PC-Ops » pour le CC, jamais « QG » dans l'interface), identifiants techniques `apps/qg` inchangés.

## 1. Ce qui existe aujourd'hui

### 1.1 Palier 1 — géo-barrière (commit `58caa4b`)
| Pièce | Fichier | Rôle |
|---|---|---|
| Logique pure | `packages/shared/src/geo.js` | `etatGeoBarriere(position, zones, seuil=150)` → `{ etat: hors/approche/dedans, zone, distanceBord }` ; `transitionGeoBarriere(avant, après)` → `approche/entree/sortie/null` ; `lisserSortieZone(...)` (depuis `85aad6f`) ; `SEUIL_APPROCHE_ZONE_M` |
| Tests | `packages/shared/src/geo.test.js` | 16 cas Vitest |
| Suivi | `apps/terrain/src/context/PositionContext.jsx` | zones rouges de l'incident suivi rechargées chaque minute (`PERIODE_ZONES_MS`), cache local `zones_rouges.<incidentId>` via `lib/cacheLocal.js`, confirmation de sortie `DELAI_CONFIRMATION_MS = 8 s` (minuteur, même sans nouvelle position), vibration + bip (Web Audio débloqué au geste d'activation), journalisation des entrées/sorties, remise à zéro au changement d'incident |
| Bandeau | `apps/terrain/src/components/BandeauZone.jsx` | orange à l'approche (distance au bord), rouge dedans ; dit si les zones viennent du cache et si l'entrée a été transmise au CC ; utilisé dans `pages/Terrain.jsx` et `components/OutilsPosition.jsx` |
| Journal | table `franchissements_zone` (migration `20261119100000_geo_barriere_franchissements.sql`, appliquée) | ajout seul pour `authenticated` (grants colonne par colonne, pas d'update/delete), RLS `a_capacite(contexte_id,'incidents','creer'/'lire')`, déclencheur `franchissements_zone_controle()` (incident ∈ contexte → P0011, zone ∈ incident → P0012, `type_zone` copié, `auteur_id` forcé, heure appareil plafonnée à now+5 min) |
| Tests SQL | `supabase/tests/geo_barriere_franchissements.sql` | 19 vérifications, conformes sur la base réelle |
| CC | `apps/qg/src/components/SyntheseIncident.jsx` | carte Terrain : entrées en zone rouge sur 2 h + 3 derniers mouvements |

**Règle de consentement en vigueur** : les franchissements ne sont envoyés au CC que si `partage` (position partagée) est actif ; sinon alerte locale seulement et le bandeau dit « Le CC n'en est pas informé ». Décision de Ren en attente pour l'inverse (une ligne à changer dans `PositionContext.jsx`, condition `partage &&`).

### 1.2 Palier 2 — itinéraire sûr (commits `0d40393`, `90cac2d`)
| Pièce | Fichier | Rôle |
|---|---|---|
| Logique pure serveur | `supabase/functions/_shared/itineraire.ts` | cercles à éviter (`cerclesDesZones` : rouges + `MARGE_ZONE_M` 25 m, oranges sur demande ; `cerclesDesPoints` : observations `route_coupee`/`inondation` ouvertes, rayon 40 m), `preparerCercles` (retire tous les cercles contenant le départ), `multiPolygoneAEviter`, `cerclesTraverses` (contrôle indépendant, pas 20 m), `pointsDePassage` (≤ 8, espacement régulier), `interpreterReponseOrs` |
| Tests | `supabase/functions/_shared/itineraire.test.ts` | 20 cas Vitest |
| Edge Function | `supabase/functions/itineraire-sur/index.ts` | **v3 déployée (21/11, avec les corrections de `85aad6f`)**, `verify_jwt = true`. POST `{ incident_id, depart{lat,lon}, arrivee{lat,lon}, profil 'driving-car'\|'foot-walking', inclure_orange }`. Lit incident, zones et observations **avec le JWT de l'appelant** (RLS ; pas d'accès → 403). Appelle `https://api.heigit.org/openrouteservice/v2/directions/{profil}/geojson` (l'ancien `api.openrouteservice.org` est **arrêté depuis début novembre 2026**, ne pas y revenir). Réponses : 503 `non_configure` sans secret, 422 `destination_en_zone`, 502 `aucun_itineraire`/`moteur`, 504 `delai` (15 s), 429 relayé. Rien n'est stocké |
| Client partagé | `packages/shared/src/itineraire.js` (+ test) | `lienGoogleMapsVia`, `libelleDuree`, `libelleEvites`, `messageErreurFonction` (lit le corps JSON de l'erreur `functions.invoke`) |
| Terrain | `apps/terrain/src/components/ItineraireSur.jsx` | `useItineraireSur()` (départ = position de l'appareil), `ResumeItineraire`, `BoutonItineraire` (lieux d'Autour de moi, missions d'entraide géolocalisées), `PanneauItineraire` (page Carte : mode `itineraire`, destination touchée sur la carte, tracé via prop `traces` de `CarteCrise`, bleu ou rouge si traversée, recalcul proposé quand `cleZones` change) |
| Carte partagée | `packages/shared/src/CarteCrise.jsx` | prop `traces = [{ id, points:[[lat,lon]…], couleur, libelle }]` (Polyline) |

**Déploiement de la fonction** : l'outil de déploiement ne connaît pas `../_shared/`, donc la version déployée importe `./_shared/itineraire.ts` (copie du fichier partagé dans le dossier de la fonction). Dans le dépôt, l'import reste `../_shared/itineraire.ts` comme les autres fonctions. Toute modification de `_shared/itineraire.ts` ou de `index.ts` impose un redéploiement avec la copie à jour, et une ligne dans `supabase/functions/README.md`.

### 1.3 Corrections de revue du 21/11 (commit `85aad6f`, PR #11, déployées : fonction v3 + apps)
Contrôle de non-traversée sur les cercles du calcul (plus de faux « ne le suivez pas sans ordre » quand on part de l'intérieur d'une zone) ; retrait de tous les cercles contenant le départ (zones superposées) ; avertissement si les points terrain sont illisibles ; délai de 15 s sur le moteur (504 `delai`) ; confirmation de sortie à l'échéance même sans nouvelle position ; remise à zéro propre au changement d'incident (plus d'écriture refusée « Zone inconnue pour cet incident »).

## 2. Ce qui bloque et ce qui n'a pas été testé
1. ~~Secret `ORS_API_KEY` absent~~ : **posé par Ren le 21/11** ; premiers appels réels depuis Terrain le 21/11 (2 réussis, 2 en 502 de cause non relevée, voir `docs/roadmap/ETAT.md`). Pour mémoire : Ren doit créer un compte sur `https://openrouteservice.org/dev/#/signup` (comptes gérés par HeiGIT, `account.heigit.org` ; « no available server » le 20/11 à 06:49), copier la **Basic Key** (commence par `eyJ…`, c'est normal) et la poser dans Supabase › Edge Functions › Secrets. Pas de redéploiement nécessaire pour le secret. Quota gratuit : 2 000 directions/jour, 40/min (chiffres non revérifiés le 21/11 : `heigit.org` injoignable), partagé entre toutes les communes clientes.
2. ~~Edge Function à redéployer~~ : fait le 21/11 (v3). Vérifié le 21/11 avec la clé publique du projet : la fonction démarre et répond **503 `non_configure`** (secret toujours absent).
3. **Aucun appel réel** à la fonction déployée ni à api.heigit.org depuis l'environnement de développement (le 21/11 : `supabase.co` joignable, `heigit.org` et les domaines Vercel bloqués). Premier aller-retour réel à faire, **avec un JWT d'utilisateur** (la clé publique ne passe pas la RLS → 403) : Terrain › Carte › 🛡 Itinéraire sûr vers un point de l'autre côté de la zone rouge de « Inondation Logne » (Commune Test, incident `24393732-cf3a-48d7-ad23-661d44c46d07`, zone rouge r = 100 m à 50.3934 / 5.5382).
4. **Aucun passage Chromium** sur les écrans des deux paliers (dépendances npm injoignables ce jour-là) : bundles esbuild + contrôle d'identifiants `tsc` seulement. Les 4 apps n'ont jamais été testées en PWA sur téléphone.
5. **Valeurs de départ** à ajuster au REX : 150 m d'approche, 8 s de confirmation de sortie, 25 m de marge zone, 40 m autour d'une route coupée, `radiuses: [-1, -1]` (accrochage au réseau sans limite).
6. **Points à vérifier au premier essai réel** : code d'erreur ORS quand la destination est hors réseau ; rendu des points de passage dans Google Maps (ce sont des arrêts, Google peut recalculer entre deux) ; taille du corps `avoid_polygons` avec une zone orange de 1 200 m (ORS limite la surface évitée, de l'ordre de 200 km² : largement au-dessus).

### 1.4 Zones à contour libre (21/11, en production : migration `20261121191221`, `itineraire-sur` version 5)
Une zone peut être un contour tracé en touchant les coins (Terrain › Commandement, CC › incident) : colonne `contour` (Polygon GeoJSON), centre et rayon englobant calculés en base, contour non modifiable (lever et remplacer). Géo-barrière, itinéraire sûr, cartes, vue Autorité et entraide en tiennent compte. Voir `docs/roadmap/ETAT.md`.

## 3. Si Claude Code reprend la main — étapes proposées
1. ~~Redéployer `itineraire-sur` (v3)~~ : fait le 21/11, version notée dans `supabase/functions/README.md`.
2. **Vérifier le secret et faire le premier appel réel** (avec un JWT utilisateur de la Commune Test). Si 503 `non_configure` : secret manquant. Si 502 `moteur` avec HTTP 403 : clé mal collée. Consigner le résultat dans `docs/roadmap/ETAT.md`.
3. **Test Chromium des écrans** : bandeau (approche/dedans, cache hors ligne, « non transmis »), panneau Itinéraire (sans position, destination en zone, résultat avec/sans traversée), `BoutonItineraire` sur une mission. Mocker `supabase.functions.invoke` pour les cas d'erreur.
4. **Décision 1 en suspens** : journaliser sans partage de position ? Ne pas changer sans accord de Ren.
5. Ensuite seulement, si Ren le demande : afficher au CC les itinéraires calculés (demande de les stocker : nouvelle table, ajout seul, RLS comme `franchissements_zone`) ; étendre la géo-barrière aux bénévoles (zone orange) ; clé ORS par commune ou Valhalla auto-hébergé si le quota devient un problème.

## 4. Ce qu'il ne faut pas faire
- Ne pas remettre `api.openrouteservice.org` : le domaine est arrêté.
- Ne pas mettre la clé ORS dans le code client, dans le dépôt ni dans une variable `VITE_*` : secret d'Edge Function uniquement.
- Ne pas appeler ORS depuis le navigateur : tout passe par la fonction, qui applique la RLS.
- Ne pas présenter l'itinéraire comme une navigation : le texte « le conducteur reste responsable » et l'invitation à recalculer quand les zones changent doivent rester.
- Ne pas transformer la géo-barrière en contrôle d'accès : c'est un rappel et une trace, le droit d'entrer en zone rouge se décide sur place (Dir PC-Ops).
- Ne pas ajouter d'update/delete sur `franchissements_zone` : c'est une trace, ajout seul.
- Pas de `delete from` / `drop table` / `drop function` littéral dans le SQL passé par l'outil Supabase ; `create or replace trigger` plutôt que `drop trigger`.
- Ne pas déclarer terminé sans test réel ; dire ce qui n'a pas été testé.
- Commits sur `main` avec les lignes d'attribution en vigueur ; si le code doit être livré hors dépôt, archive `.zip` complète (rappeler les fichiers cachés si un `.env` est concerné).

## 5. Repères de données (Commune Test)
Contexte `149654e6-8339-4771-8201-0eab24fc07d2` · incident en cours « Inondation Logne » `24393732-…` (zones rouge r = 100 m et orange r = 1 200 m autour de 50.3934 / 5.5382) · utilisateur `baa89e27-…` (`user_id`, rôle DIR_PC_OPS, accès `ecriture` ; rôle sans capacité détaillée, droits par le niveau d'accès) · 3 observations bloquantes ouvertes (1 `route_coupee`, 2 `inondation`) · zones jaunes (dissuasion) ignorées par la géo-barrière et l'itinéraire · `zones_intervention.perimetre` ∈ {exclusion, isolation, dissuasion} (contrainte) · `observations_terrain.type` `route_coupee` / `inondation`, `statut = 'ouvert'` = bloquant.
