# Références à vérifier

> Extrait du briefing « feuille de route plus-value 2026 » du 20 octobre 2026, découpé en Session 0. État d'avancement : [ETAT.md](ETAT.md). Existant et écarts : [CORRESPONDANCE.md](CORRESPONDANCE.md).

- MeteoAlarm : flux ATOM/CAP par pays (feeds.meteoalarm.org) et conditions d'utilisation ; format CAP 1.2 (OASIS).
- IRM : open data (opendata.meteo.be) — vérifier si les avertissements y sont exposés.
- Statbel : liste officielle des codes NIS des communes.
- Géoportail wallon (WalOnMap) : services WMS d'aléa d'inondation et d'axes de ruissellement, licences.
- Supabase : Cron (`pg_cron`, `pg_net`), Realtime, Storage (URL signées), Edge Functions (secrets, limites).
- Web Push : VAPID (RFC 8292), service worker, bibliothèque utilisable dans les Edge Functions Deno.
- `vite-plugin-pwa` / Workbox pour T1.
- Fiches scénario A (orages éclair) et B (cyberattaque) du briefing précédent : sources REX réutilisables pour les textes d'aide de C1, C2, C4, C8.

## Résultats de vérification (Session 0, 20 octobre 2026)

Niveaux de certitude : **[V]** source ouverte et lue ; **[E]** extrait de recherche citant la source officielle,
page non ouverte (l'environnement de la session bloque la plupart des sites officiels) ; **[D]** déduit ;
**[NT]** non trouvé ou non vérifié. Tout ce qui est [E], [D] ou [NT] est à confirmer avant de s'y fier.

### MeteoAlarm
- **Flux ATOM Belgique** : `https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-belgium` [D, solide : motif utilisé par les bibliothèques meteoalert-api et meteoalarm, et par l'Edge Function `irm-vigilance` déjà déployée]. Index : `https://feeds.meteoalarm.org/` [E].
- **Format** : ATOM avec l'espace de noms CAP 1.2 (`cap:areaDesc`, `cap:geocode` EMMA_ID ou NUTS3, `cap:event`, `severity`, `onset`, `expires`) ; chaque entrée renvoie au document CAP complet (`…/api/v1/warnings/feeds-belgium/<uuid>`), avec `awareness_level` (ex. « 2; yellow; Moderate ») et `awareness_type` [V sur un exemple réel d'un autre pays]. Seules les zones en alerte figurent dans le flux [E].
- **Granularité belge** : 9 zones EMMA (BE001 Luxembourg … BE009 Flandre-Occidentale) avec **un seul « Brabant » (BE004)**, alors que l'IRM distingue Bruxelles, Brabant flamand et Brabant wallon [V sur un fichier tiers, actualité à vérifier sur un vrai flux]. Le rattachement aux communes (F1) doit en tenir compte.
- **Codes des paramètres MeteoAlarm** retenus par la lecture CAP de C1 (`supabase/functions/_shared/cap.ts`) [D, convention MeteoAlarm connue, à vérifier sur un vrai message] : `awareness_level` 1 vert, 2 jaune, 3 orange, 4 rouge ; `awareness_type` 1 vent, 2 neige-verglas, 3 orage, 4 brouillard, 5 chaleur, 6 froid, 7 côtes, 8 feux de forêt, 9 avalanches, 10 pluie, 11 inconnu, 12 inondation, 13 pluie-inondation. Sans ces paramètres, le niveau vient de la sévérité CAP (Minor, Moderate, Severe, Extreme) et le type du libellé de l'événement. Les fixtures de test sont fabriquées d'après ces conventions, faute d'accès au flux.
- **Nouvelle API OGC EDR** (`https://api.meteoalarm.org/edr/v1/faq`) : jeton après inscription, GeoJSON, MQTT pour le temps réel [E].
- **Conditions** (`https://www.meteoalarm.org/en/live/page/terms-and-conditions`) [E] : réutilisation « à des conditions équivalentes à CC BY 4.0 », plus : attribution au **service national** (l'IRM) pour un contenu d'un seul pays ; **heure d'émission** obligatoire ; **lien vers www.meteoalarm.org** dans les applications web ; pour une redistribution opérationnelle, **délai moyen < 5 min, maximum 10 min**, et avertissement sur les délais ; en cas de transformation, fournir aussi l'information non modifiée. Formule proposée : « Source : IRM/KMI via MeteoAlarm (www.meteoalarm.org), émis le … » [D]. Les conditions générales d'EUMETNET (`https://www.eumetnet.eu/legal-information-2/`) exigent en revanche une autorisation écrite pour un usage commercial [E] → **confirmation écrite à demander** (meteoalarm@geosphere.at).

### IRM / KMI
- **Jeu de données « Weather warnings for Belgium »** : `https://www.geo.be/catalog/details/RMI_DATASET_WARNINGS`, fichiers CAP 1.2 sur `https://opendata.meteo.be/ftp/warnings/` (miroir FTP), **mis à jour toutes les heures**, horizon 36 h, découpage « grosso modo provincial » [E]. Phénomènes décrits : vent, pluie, neige ou verglas, brouillard, onde de tempête, orage ; chaleur et froid non confirmés dans les CAP [NT]. Structure des fichiers non documentée [NT].
- **Licence** : CC BY 4.0 selon les métadonnées [E] ; l'avertissement juridique de meteo.be exige un accord écrit pour tout usage commercial, sans doute pour le site seulement [E] → à confirmer auprès de l'IRM.
- Conséquence pour C1 : le briefing demande de préférer l'open data IRM s'il expose les avertissements — c'est le cas, mais avec une **mise à jour horaire**, contre une redistribution à 10 min maximum par MeteoAlarm. Choix à faire (ou les deux : IRM en source primaire, MeteoAlarm en contrôle).

### Statbel et géométries communales
- **REFNIS 2025 (565 communes)** : `https://statbel.fgov.be/sites/default/files/files/opendata/REFNIS%20code/TU_COM_REFNIS-20250101.xlsx` (version texte au même chemin en `.zip`) ; page `https://statbel.fgov.be/nl/open-data/refnis-code-0` [E]. Codes modifiés par les fusions flamandes du 1/1/2025 et par Bastogne (82039) ; rien trouvé pour 2026 [NT].
- **Licence Statbel** : CC BY 4.0 (`https://statbel.fgov.be/en/cc-40`), attribution « Source : Statbel » [E].
- **Géométries** : secteurs statistiques 2025 (`https://statbel.fgov.be/en/open-data/statistical-sectors-2025`, GeoPackage/GML), à fusionner par `CD_MUNTY_REFNIS` pour obtenir les communes [E]. NGI AdminVector : CC BY 4.0 selon la FAQ du NGI, contredit par une fiche ancienne (« usage commercial interdit ») [E] → s'en tenir aux secteurs Statbel ou confirmer auprès du NGI.
- Variante prête à l'emploi (codes INS et postaux, CSV/JSON/GeoJSON) : `https://opendata.brussels.be/explore/dataset/codes-postaux-et-codes-ins-communes-belges-20250101/` [E].
- **Source retenue pour le seed F1 (20 octobre 2026)** : export GPX `communes-et-localites.gpx` du jeu « communes et localités » d'Open Data Wallonie-Bruxelles (`https://www.odwb.be`, plateforme Huwise), fourni par Ren, `statbel.fgov.be` étant refusé par le réseau de l'environnement. Contenu vérifié [V] : 7 402 lignes commune × code postal × localité ; 565 codes INS, conformes aux fusions du 1/1/2025 (Hasselt 71072, Bastogne 82039) ; 285 communes flamandes, 261 wallonnes, 19 bruxelloises ; noms FR / NL / DE, province (vide pour Bruxelles), arrondissement, région et un point par commune, sans valeur divergente ; province cohérente avec le préfixe du code NIS pour les 565 communes ; 24 « & » non échappés (XML invalide, corrigé à la lecture). Empreinte SHA-256 du fichier : `5fbfc6ed0898bd972ee393bd39dafff5eca1d08d861311052943a1987a98bc5a`. **Licence du jeu à confirmer** sur sa fiche ODWB [NT].
- **Eventware 2.0** (projet Supabase `kunvnnfejhnuhflycyfz`), table `communes` [V, lue le 20 octobre 2026] : 261 communes wallonnes, clé = nom (pas de code NIS), province, zone de police (nom ; numéro officiel dans les notes, « découpage officiel (arrêté royal), export du 18/06/2026 »), zone de secours, vérifiées le 16/09/2026. Rapprochement avec l'export ODWB : 261 sur 261, un à un ; 257 noms identiques, 4 à l'apostrophe ou à la casse près (Braine-l'Alleud, Fontaine-l'Evêque, Mont-de-l'Enclus, Villers-le-Bouillet : orthographe d'Eventware retenue) ; provinces concordantes ; 14 zones de secours, 71 zones de police, numéro ↔ nom sans exception. Copie datée : `scripts/seed/sources/zones_wallonie_eventware.txt` (empreinte MD5 des lignes `f22a5c2afcb8584ce85af4356010a92b`, identique à celle calculée dans Eventware). Eventware a aussi des référentiels de sécurité des événements (`referentiels`, `referentiel_items`, `referentiel_locaux` : RezonWal et règlements de zones), une veille météo à seuils et des contacts, non repris.

### Géoportail de Wallonie
- **Aléa d'inondation (AGW du 4/3/2021)** : REST `https://geoservices.wallonie.be/arcgis/rest/services/EAU/ALEA_INOND/MapServer` [E] ; WMS `…/arcgis/services/EAU/ALEA_INOND/MapServer/WMSServer?request=GetCapabilities&service=WMS` [D] ; données sous **CC BY 4.0** [E].
- **ERRUISSOL est obsolète, remplacé par LIDAXES v2** [E]. LIDAXES : REST `https://geoservices.wallonie.be/arcgis/rest/services/EAU/LIDAXES/MapServer` [E], WMS sur le même motif [D] ; la couche vecteur des axes est sous **CC BY 4.0**, mais la **série complète est sous CGU SPW** : pas de redistribution à des tiers ni de publication par service web, publication statique permise [E].
- Services de visualisation : accès libre et gratuit, sous réserve des conditions de chaque donnée [E] ; mention « Sources : SPW » ; aucune garantie de disponibilité en crise [D].
- Conséquence pour C4 : une carte statique pré-générée (image) est compatible avec les couches CC BY 4.0 et avec la « publication statique » de LIDAXES [D] — à confirmer.

### Supabase [V, lu dans le dépôt source de la documentation]
- **Planifier une Edge Function** : `https://supabase.com/docs/guides/functions/schedule-functions` (pg_cron + pg_net, URL et clé dans Vault, `cron.schedule(…, net.http_post(…))`). **Cron** : `https://supabase.com/docs/guides/cron` — au plus 8 tâches simultanées de 10 min chacune ; intervalles en secondes possibles.
- **pg_net** : `https://supabase.com/docs/guides/database/extensions/pg_net` — délai par défaut **2000 ms** ; réponses gardées 6 h ; au-delà, `EdgeRuntime.waitUntil`.
- **Realtime** : `https://supabase.com/docs/guides/realtime/postgres-changes` — table à ajouter à la publication `supabase_realtime`, RLS vérifiée pour chaque abonné ; limites `https://supabase.com/docs/guides/realtime/limits`.
- **URL signées** : `https://supabase.com/docs/guides/storage/serving/downloads` (`createSignedUrl` sur bucket privé).
- **Limites des Edge Functions** : `https://supabase.com/docs/guides/functions/limits` — 256 Mo, 150 s (gratuit) ou 400 s (payant) de durée réelle, 2 s de CPU par requête ; imports `npm:` acceptés.

### Web Push depuis Deno
- `npm:web-push` 3.6.7 [V npm] : un bogue de signature EC de l'edge-runtime Supabase a été contourné à partir de la v1.54.0 (juin 2024) [E] → devrait fonctionner, **à tester**.
- Alternative native Web Crypto : `jsr:@negrel/webpush` 0.5.0 (RFC 8291 et 8292), non relue par des experts en cryptographie [V].
- RFC 8292 (VAPID) : `https://www.rfc-editor.org/rfc/rfc8292` — JWT ES256 sur P-256, expiration ≤ 24 h [E].

### vite-plugin-pwa [V npm et GitHub]
- Version stable **2.0.0** (3/10/2026), compatible Vite ^3.1 à ^8 (le dépôt est en Vite 5.4), Workbox ^7.4.1, **Node ≥ 20.19**. Doc : `https://vite-pwa-org.netlify.app/guide/`. La gestion des notifications push impose la stratégie `injectManifest`.

### Fond de carte
- Politique des tuiles OSM (`https://operations.osmfoundation.org/policies/tiles/`) : pas d'usage intensif, **pas de pré-téléchargement**, attribution « © OpenStreetMap contributors », User-Agent valide ; un service commercial peut être coupé sans préavis [E]. Le code prévoit déjà de passer à un fournisseur sous contrat (`packages/shared/src/CarteCrise.jsx`). Licence de CartoWeb.be (NGI) non confirmée [NT].

### Décisions de licence réservées à Ren
1. **MeteoAlarm** : usage commercial (confirmation écrite), statut de redistributeur opérationnel (délais), attribution, choix ATOM sans compte / API EDR / CAP de l'IRM.
2. **IRM** : la CC BY 4.0 de l'open data couvre-t-elle un SaaS commercial ?
3. **Géoportail wallon** : WMS en direct ou données réhébergées (impossible pour la série LIDAXES complète) ; mise en cache assimilable ou non à une redistribution.
4. **Statbel / NGI / ODWB** : attribution ; lever le doute sur AdminVector ou s'en tenir aux secteurs Statbel ; confirmer la licence du jeu ODWB « communes et localités » utilisé pour le seed F1.
5. **Fond de carte** : choisir un fournisseur (commercial ou tuiles auto-hébergées), conditions et localisation des données.
