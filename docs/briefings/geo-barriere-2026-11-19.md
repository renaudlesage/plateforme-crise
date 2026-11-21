# Géo-barrière et guidage GPS hors zone d'exclusion — 19 novembre 2026

> Copie, déposée dans le dépôt le 2026-11-21, du document de projet `claude/geo-barriere-2026-11-19.md`. Le briefing opérationnel pour Claude Code est `briefing-claude-code-geo-barriere-2026-11-21.md` (même dossier). Depuis, le commit `85aad6f` (21/11) a apporté des corrections de revue : contrôle de non-traversée sur les cercles du calcul, retrait de tous les cercles contenant le départ (`preparerCercles`), avertissement si les points terrain sont illisibles, délai de 15 s sur le moteur (504 `delai`), minuteur de confirmation de sortie (`lisserSortieZone`), remise à zéro propre au changement d'incident. **L'Edge Function n'a pas été redéployée avec ces corrections** : à faire (copier `_shared/itineraire.ts` dans le dossier de la fonction, import `./_shared/…`).

## La question
Ren : « Réfléchi à la faisabilité d'un guidage GPS permettant d'éviter une zone d'exclusion pour des intervenants terrain. »

## Verdict
Faisable, mais pas sous la forme « Waze qui contourne la zone ». Le calcul d'un itinéraire d'évitement est simple
(les zones sont déjà en PostGIS, mises à jour par le CC) ; le point dur est le guidage en continu dans une PWA
(géolocalisation suspendue écran éteint ou app en arrière-plan, surtout sur iOS). La vraie valeur de Crisiware :
il connaît les routes coupées, ponts fermés et barrages saisis sur la carte, que Google Maps ignore.

## Trois paliers
1. **Alerte de géo-barrière** — fait le 19/11.
2. **Itinéraire d'évitement** — fait le 19/11, en attente de la clé OpenRouteService.
3. **Navigation en continu dans l'app** : non recommandé (limites des navigateurs mobiles, gain faible par
   rapport au palier 2). Écartés : Waze (une seule destination), OSRM (pas d'évitement dynamique). Valhalla
   auto-hébergé (`exclude_polygons`) plus tard si l'indépendance devient nécessaire.

Réserves actées dans les écrans : le guidage reste une aide, le conducteur reste responsable ; quand la zone
bouge pendant le trajet, l'écran demande un recalcul plutôt que de faire confiance au tracé initial.

## Palier 1 livré (commit `58caa4b`, `main`)
- **Logique pure** (`packages/shared/src/geo.js`) : `etatGeoBarriere(position, zones, seuil = 150 m)` →
  `hors` / `approche` / `dedans` + zone la plus proche + distance au bord ; `transitionGeoBarriere(avant, après)`
  → `approche` / `entree` / `sortie`. Tests Vitest `geo.test.js` (12 cas).
- **Terrain** (`PositionContext.jsx`, `BandeauZone.jsx`) : à 150 m du bord d'une zone rouge, bandeau orange,
  vibration courte, un bip ; à l'entrée, bandeau rouge, vibration longue, trois bips ; une sortie n'est crue
  qu'après 8 s (bruit GPS au bord). Zones rouges rechargées chaque minute et gardées en cache local : l'alerte
  tient quand le réseau tombe, l'écran dit depuis quand datent les zones. Bandeau sur l'écran mission et dans
  les outils de position ; rien hors de toute zone.
- **Journal au CC** : table `franchissements_zone` (entrée / sortie, zone, position, précision, heure de
  l'appareil conservée si l'envoi est différé par la file hors ligne ; ajout seul ; déclencheur qui vérifie
  incident ∈ contexte et zone ∈ incident, copie le type de zone, force l'auteur). **Envoyé uniquement si
  l'intervenant partage sa position avec le CC** (même consentement que `positions_equipes`) ; sinon le bandeau
  dit « Le CC n'en est pas informé ». CC › Synthèse › carte Terrain : entrées en zone rouge sur 2 h et les trois
  derniers mouvements.
- **Base** : migration `20261119100000_geo_barriere_franchissements.sql`, répétée en transaction annulée avec ses
  tests (`supabase/tests/geo_barriere_franchissements.sql`, 19 vérifications), appliquée, tests rejoués sur la
  base réelle : conformes. Conseillers de sécurité : rien de nouveau.

## Palier 2 livré (commits `0d40393`, `90cac2d`, `main`) — attend la clé ORS
- **Edge Function `itineraire-sur`** (v2 déployée, JWT exigé) : entrée `{ incident_id, depart, arrivee, profil
  'driving-car' | 'foot-walking', inclure_orange }`. Lit l'incident, ses zones et ses points terrain ouverts
  **avec les droits de l'appelant** (RLS : pas d'accès → 403). Polygones à éviter : zones rouges + 25 m de
  marge, zones oranges sur demande, routes coupées et inondations ouvertes (rayon 40 m). Appel OpenRouteService
  `https://api.heigit.org/openrouteservice/v2/directions/{profil}/geojson` avec `options.avoid_polygons`
  (l'ancien `api.openrouteservice.org` est arrêté depuis début novembre 2026). Rend tracé, distance, durée,
  points de passage (≤ 8) pour Google Maps, et un **contrôle indépendant** que le tracé ne traverse aucun cercle
  (sinon premier avertissement en rouge : « ne le suivez pas sans ordre »). Destination dans une zone → 422
  explicite ; départ dans une zone → on en retire le cercle du calcul et on le dit. Rien n'est stocké. Logique
  pure dans `supabase/functions/_shared/itineraire.ts`, tests Vitest.
- **Terrain** : bouton « 🛡 Itinéraire sûr » sur la **Carte** (on touche la destination, le tracé se dessine en
  bleu — en rouge s'il traverse encore une zone — ; en voiture / à pied ; « éviter aussi la zone orange » ;
  recalcul proposé quand les zones de l'incident changent), sur chaque lieu d'**Autour de moi** et sur chaque
  **mission d'entraide** géolocalisée (ouverte, affectée, en cours). Résumé : distance, durée, ce qui est évité,
  avertissements, « Ouvrir dans Google Maps (points de passage) ↗ » et « Google Maps direct ↗ » en repli.
  Rappel affiché : Google traite les points de passage comme des arrêts et peut recalculer ; le conducteur
  reste responsable.
- **`CarteCrise`** (paquet partagé) accepte désormais des `traces` (polylignes), utilisables aussi au CC.

## À faire par Ren pour activer le palier 2
1. Créer un compte sur `https://openrouteservice.org/dev/#/signup` (comptes gérés par HeiGIT ; gratuit ;
   2 000 requêtes « directions » par jour, 40 par minute). Tableau de bord › API Key › **Basic Key** › Copy
   (la clé commence par `eyJ…`, c'est normal).
2. Copier la clé dans Supabase › Edge Functions › Secrets : nom `ORS_API_KEY`. Aucune autre configuration.
   Sans la clé, l'écran dit « Itinéraire sûr non configuré ».
3. Premier essai sur le terrain : Carte › Itinéraire sûr vers un point de l'autre côté de la zone rouge de
   l'incident « Inondation Logne » (Commune Test).

## Ce qui n'a pas été testé
- Aucun appel réel à OpenRouteService ni à la fonction déployée depuis l'environnement de développement (réseau
  fermé vers `supabase.co`, `openrouteservice.org`, `heigit.org`) : la fonction est déployée et son code bundlé
  sans erreur, mais le premier aller-retour réel reste à faire. Points à regarder : code d'erreur ORS quand la
  destination est sur une impasse, temps de réponse, qualité des points de passage dans Google Maps.
- Pas de passage Chromium sur les écrans (dépendances npm injoignables ce jour-là) : bundles esbuild et contrôle
  d'identifiants seulement. À regarder sur téléphone : bandeau au soleil, bips, panneau Itinéraire au-dessus de
  la carte en plein écran.
- Valeurs de départ à ajuster au REX : seuil d'approche 150 m, confirmation de sortie 8 s, marge 25 m autour des
  zones, 40 m autour d'une route coupée.

## Décisions à prendre
1. Journaliser les franchissements aussi sans partage de position ? Choix actuel : non (consentement explicite).
2. Étendre la géo-barrière aux bénévoles d'entraide (zone orange interdite aux bénévoles) : l'app Citoyen ne
   suit pas la position en continu ; à décider si le QR de présence doit s'accompagner d'une alerte.
3. Afficher les itinéraires calculés au CC (qui va où, par où) : possible maintenant que `CarteCrise` dessine
   des tracés, mais demande de les stocker ; non engagé.
4. Si le quota ORS gratuit gêne un jour (2 000/j pour toutes les communes clientes) : clé par commune, plan
   payant, ou Valhalla auto-hébergé.
