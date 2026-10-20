# Fiches scénario REX 2026 — note d'accompagnement

Données : [`packDemarrageRex2026.js`](./packDemarrageRex2026.js), ajoutées au pack de démarrage
(`packDemarrageRisques.js`) et importées en un clic depuis **Admin → Objets à risque**.

| Code | Fiche | Seuils | Étapes du plan d'action |
|---|---|---|---|
| `STARTER-REX-2026-ORAGES` | Orages éclair, inondations par ruissellement et coulées de boue | 6 (S0 à S5) | 9 |
| `STARTER-REX-2026-CYBER` | Cyberattaque ou indisponibilité du système d'information communal | 5 (S0 à S4) | 10 |

## Import

- Le bouton « Importer le pack de démarrage » n'insère que les fiches dont le code manque dans le contexte.
  Un contexte qui avait déjà importé les 18 fiches voit « Importer les nouvelles fiches du pack (2) ».
- Chaque fiche est insérée dans `objets_a_risque`, puis ses seuils dans `seuils_action` (rattachés par
  `objet_risque_id`) et ses étapes dans `plans_action_risque` (statut « à faire »). Si l'insertion des seuils
  ou des étapes échoue, les fiches créées sont retirées : pas de fiche importée à moitié.
- Export imprimable : lien **Imprimer** sur chaque fiche (`/risques/:id/impression`). Fiche + seuils +
  plan d'action, A4, environ 4 pages pour chacune des deux fiches.

## Correspondance contenu → champs

| Contenu du briefing | Champ |
|---|---|
| Titre, famille | `identification`, `categorie` (naturel / technologique), `type_risque` |
| Déclencheur résumé | `declencheur` (une ligne) |
| Impacts + résumé REX | `effets_directs` |
| Cascades, qualification, phases, durées, post-crise | `effets_cascade` |
| Signaux précurseurs, données de référence | `signaux_faibles` |
| Préparation, ressources critiques et fournisseurs, centres d'accueil (profil), configuration du signal citoyen | `mesures_preventives` |
| Rôles D1 à D5, mode dégradé, points de service dégradé (cyber) | `mesures_compensatoires` |
| Décisions-types du journal, pièges observés, injects d'exercice | `decisions_a_preparer` |
| Messages D5 M1 à M5 et principes | `messages_publics_predefinis` |
| Seuils (déclencheur, checklist, qui, délai) | `seuils_action` : `libelle`, `seuil_description`, `action` (checklist + « Qui » + « Délai cible »), `action_degradee`, `ordre` |
| Actions de préparation et de suivi | `plans_action_risque` |

Les paramètres propres à une commune sont écrits entre crochets (`[N]`, `[30] min`, `[lieu]`, `[lien]`…) :
à remplacer dans les formulaires après import.

## Ce qui n'a pas de champ dédié

- **Sources REX** : pas de champ « sources » sur `objets_a_risque` → listées ci-dessous.
- **Résumé REX, rôles par discipline, injects, pièges** : pas de champ « REX », « notes » ni « exercice » →
  rangés dans les champs libres ci-dessus (le module Exercices porte des exercices datés par commune, pas
  des scénarios types).
- **Responsable d'un seuil** : `responsable_role_id` pointe vers les rôles du contexte, qui n'existent pas
  encore au moment de l'import → « Qui » est écrit dans le texte de l'action ; à rattacher au rôle voulu
  dans le formulaire du seuil.
- **Centres d'accueil, ressources, contacts** : ce sont des lieux et des moyens réels propres à chaque
  commune → seul le profil attendu est décrit ; le cadastre se fait dans les pages Centres d'accueil,
  Ressources et Entraide (étapes du plan d'action).
- **Types de signalement citoyen** : décrits dans `mesures_preventives` ; aucune configuration de
  l'application citoyenne n'est modifiée.

Aucune migration n'a été appliquée. Si l'on veut un champ `sources` (et éventuellement `notes_rex`) sur
`objets_a_risque`, c'est une migration à valider avant de l'écrire.

## Points à valider

1. Point de départ du délai de 21 jours ouvrables du Fonds des calamités (fiche orages, post-crise).
2. Applicabilité à la commune cible d'IMIO, de CyberFundamentals, et question NIS2 pour les communes.
3. Toute migration de schéma (champ sources / notes REX).

## Sources

Fiche orages :

- La Libre, 31/05/2026 — séquence orageuse la plus dévastatrice depuis 2021 : https://www.lalibre.be/belgique/societe/2026/05/31/la-belgique-frappee-par-de-fortes-inondations-un-cocktail-ideal-pour-une-forte-instabilite-atmospherique-6EQFLP6J4NHU7NA3NGS3BRSNSE/
- L'Avenir, 03/06/2026 — bilan au Parlement wallon, Huy et CORTEX, Fonds des calamités : https://www.lavenir.net/actu/belgique/politique/2026/06/03/un-premier-bilan-des-inondations-a-la-region-dabord-les-assurances-et-puis-peut-etre-le-fonds-des-calamites-73TXAZAZWNERBO5KVHSWZDDNWE/
- Wallonie.be — point sur les orages du 30 mai : https://www.wallonie.be/fr/actualites/alerte-orages-du-samedi-30-mai-fin-dapres-midi-jusquau-milieu-de-la-nuit
- Belgorage — analyse de l'épisode du 29 au 31 mai : https://belgorage.be/breves-et-articles/inondations/bases-de-donnees-breves-et-articles-2026-06-30-orages/
- L'Avenir, 31/05/2026 — dégâts en Wallonie, Basse-Sambre, La Hulpe : https://www.lavenir.net/actu/belgique/2026/05/31/fin-de-lalerte-orange-aux-orages-de-nombreux-degats-en-wallonie-ce-dimanche-sannonce-plus-sec-VZPLVCMDJBEQBEEZFSR5HNXKUA/
- Paris Match Belgique, 31/05/2026 — zone Wapi, routes inondées : https://www.parismatch.be/actualites/environnement/2026/05/31/intemperies-de-nombreux-degats-en-wallonie-et-a-bruxelles-lirm-maintient-un-avertissement-jaune-pour-des-orages-violents-ce-dimanche-videos-EIDB6XKKJBE73AGQVR2EUE55BM/
- BW Response — communiqués du gouverneur du Brabant wallon : https://bwresponse.be/actualites/

Fiche cyber :

- Belga, 23/06/2026 — 270 organisations belges touchées : https://belganewsagency-eu.prezly.com/hundreds-of-belgian-organisations-hit-by-cyber-attack
- Le Soir, 19/04/2026 — Temse désactive ses systèmes informatiques : https://www.lesoir.be/741730/article/2026-04-19/une-commune-desactive-ses-systemes-informatiques-apres-une-cyberattaque
- L'Avenir, 16/06/2026 — Mont-Saint-Guibert et la cybersécurité : https://www.lavenir.net/regions/brabantwallon/mont-saint-guibert/2026/06/16/la-commune-de-mont-saint-guibert-veut-etre-prete-en-cas-dattaque-informatique-Z7Q6TAP4RRBUTJMSRN3YYLXV7M/
- EUISS — Global Risks to the EU in 2026 : https://www.iss.europa.eu/publications/commentary/global-risks-eu-2026-what-are-main-conflict-threats-europe
- Connaissance des énergies / AFP, 28/09/2026 — exercice black-out français de novembre 2026 : https://www.connaissancedesenergies.org/afp/le-reseau-electrique-infrastructure-cruciale-a-proteger-notamment-des-cyberattaques-260928
