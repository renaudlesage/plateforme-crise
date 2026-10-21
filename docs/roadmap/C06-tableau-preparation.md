# C6 — Tableau de bord de préparation

> Extrait du briefing « feuille de route plus-value 2026 » du 20 octobre 2026, découpé en Session 0. État d'avancement : [ETAT.md](ETAT.md). Existant et écarts : [CORRESPONDANCE.md](CORRESPONDANCE.md).

**Plus-value** : donner au bourgmestre (et plus tard au gouverneur) une jauge honnête de l'état de préparation, et trois actions à faire. C'est aussi l'indicateur d'usage de l'outil entre deux crises.

**Portée**
- Indicateurs par commune : fiches importées et adaptées (au moins un seuil paramétré et N défini), contacts CC / disciplines vérifiés il y a moins de 6 mois (campagne « confirmez vos coordonnées » par lien e-mail, avec date de confirmation), ressources revalidées il y a moins de 12 mois (C7), dernier exercice il y a moins de 12 mois (C5), pack papier généré il y a moins de 6 mois (C4), réveil automatique armé (C1), points noirs cartographiés (≥ 1), page publique configurée (C8), registre des personnes vulnérables à jour (C9).
- Score pondéré (pondérations éditables) et tendance ; **au maximum trois actions proposées** (anti-surcharge), classées par impact.
- Instantané nocturne (F3) dans `preparation_snapshots` pour l'historique ; vue bourgmestre ; export pour le conseil communal (F4).
- En vague 2 suite : lecture agrégée par la province (C10) avec opt-in.

**Critères d'acceptation**
- [ ] Indicateurs calculés correctement sur fixtures (chaque indicateur testé vrai/faux).
- [ ] Trois actions maximum affichées ; ordre stable.
- [ ] Historique de snapshots et tendance sur 3 mois simulés.
- [ ] Campagne de confirmation des contacts : lien signé, expiration, date enregistrée.

**Estimation** : 2 sessions.
