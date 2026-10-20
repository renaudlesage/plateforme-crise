# Fiches de risque REX 2026 — note d'accompagnement

Données : [`packDemarrageRex2026.js`](./packDemarrageRex2026.js), ajoutées au pack de démarrage
(`packDemarrageRisques.js`) et importées en un clic depuis **Admin → Risques du territoire**.

| Code | Fiche | Catégorie NCCN | Seuils | Étapes du plan d'action |
|---|---|---|---|---|
| `STARTER-REX-2026-ORAGES` | Orages éclair, inondations par ruissellement et coulées de boue | naturel | 6 (S0 à S5) | 9 |
| `STARTER-REX-2026-CYBER` | Cyberattaque ou indisponibilité du système d'information communal | man_made | 5 (S0 à S4) | 10 |

Les versions courtes de ces deux scénarios (ruissellement urbain, cyberattaque communale, ex-STARTER-04
et STARTER-07) ont été retirées du pack. Une commune qui les avait déjà importées les garde : à supprimer
à la main dans Risques du territoire si on ne veut pas de doublon.

## Risque du territoire et objet à risque

Un **risque du territoire** est une menace potentielle (inondation, cyberattaque, canicule…) : c'est lui qui
porte la fiche de risque. Un **objet à risque** est une particularité localisée du territoire (site Seveso,
école, barrage, maison de repos) : il génère un risque ou y est exposé, et se rattache aux risques
concernés avec ce rôle (source / enjeu). Les fiches du pack sont donc des risques, jamais des objets.

## Import

- Le bouton « Importer le pack de démarrage » n'insère que les fiches dont le code manque dans le contexte.
  Un contexte qui avait déjà le pack voit « Importer les nouvelles fiches du pack (n) ».
- Chaque fiche est insérée dans `risques_territoire`, puis ses seuils dans `seuils_action` (rattachés par
  `risque_id`) et ses étapes dans `plans_action_risque` (statut « à faire »). Si l'insertion des seuils
  ou des étapes échoue, les fiches créées sont retirées : pas de fiche importée à moitié.
- Export imprimable : lien **Imprimer** sur chaque risque (`/risques-territoire/:id/impression`). Fiche +
  seuils + objets concernés + plan d'action, A4, environ 4 pages pour chacune des deux fiches REX.

## Correspondance contenu → champs

| Contenu du briefing | Champ |
|---|---|
| Titre, famille | `titre`, `categorie` (NCCN : naturel / technologique / man_made / sanitaire), `type_risque` |
| Déclencheur résumé | `declencheur` (une ligne) |
| Impacts + résumé REX | `effets_directs` |
| Cascades, qualification, phases, durées, post-crise | `effets_cascade` |
| Signaux précurseurs, données de référence | `signaux_faibles` |
| Préparation, ressources critiques et fournisseurs, centres d'accueil (profil), configuration du signal citoyen | `mesures_preventives` |
| Rôles D1 à D5, mode dégradé, points de service dégradé (cyber) | `mesures_compensatoires` |
| Décisions-types du journal, pièges observés, injects d'exercice | `decisions_a_preparer` |
| Messages D5 M1 à M5 et principes | `messages_publics_predefinis` |
| Sources REX | `sources` |
| Seuils (déclencheur, checklist, qui, délai) | `seuils_action` : `libelle`, `seuil_description`, `action` (checklist + « Qui » + « Délai cible »), `action_degradee`, `ordre` |
| Actions de préparation et de suivi | `plans_action_risque` |

Les paramètres propres à une commune sont écrits entre crochets (`[N]`, `[30] min`, `[lieu]`, `[lien]`…) :
à remplacer dans les formulaires après import. La probabilité et l'impact (1 à 5) ne sont pas préremplis :
ils dépendent de la commune.

## Ce qui n'a pas de champ dédié

- **Résumé REX, rôles par discipline, injects, pièges** : pas de champ « REX », « notes » ni « exercice » →
  rangés dans les champs libres ci-dessus (le module Exercices porte des exercices datés par commune, pas
  des scénarios types).
- **Responsable d'un seuil** : `responsable_role_id` pointe vers les rôles du contexte, qui n'existent pas
  encore au moment de l'import → « Qui » est écrit dans le texte de l'action ; à rattacher au rôle voulu
  dans le formulaire du seuil.
- **Centres d'accueil, ressources, contacts, objets à risque** : ce sont des lieux, des moyens et des
  particularités propres à chaque commune → seul le profil attendu est décrit ; le cadastre se fait dans
  les pages Centres d'accueil, Ressources, Entraide et Objets à risque (étapes du plan d'action), puis
  les objets concernés se rattachent au risque.
- **Types de signalement citoyen** : décrits dans `mesures_preventives` ; aucune configuration de
  l'application citoyenne n'est modifiée.

## Points à valider

1. Point de départ du délai de 21 jours ouvrables du Fonds des calamités (fiche orages, post-crise).
2. Applicabilité à la commune cible d'IMIO, de CyberFundamentals, et question NIS2 pour les communes.
