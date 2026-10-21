# C5 — Mode exercice

> Extrait du briefing « feuille de route plus-value 2026 » du 20 octobre 2026, découpé en Session 0. État d'avancement : [ETAT.md](ETAT.md). Existant et écarts : [CORRESPONDANCE.md](CORRESPONDANCE.md).

**Plus-value** : un outil ouvert une fois tous les cinq ans meurt (PLANU.be). Les exercices sont ce qui fait vivre l'outil entre deux crises, et c'est le métier de Ren : personne d'autre ne le propose aux communes.

**Portée**
- Création d'un exercice depuis une fiche : choix des injects (champ `injects` des fiches, éditable CRUD), horloge simulée (démarrage, vitesse x1 / x2 / x6, pause), diffusion des injects aux joueurs à l'heure simulée par notification interne uniquement.
- Rôles : joueurs (CC), observateurs (notes horodatées, grille d'observation), directeur d'exercice (contrôle de l'horloge, injects ad hoc).
- Attendus par seuil : pour chaque seuil de la fiche, les actions attendues et un délai cible (données de la fiche, éditables).
- Débrief automatique : par seuil, heure du déclencheur, heure de la première action attendue réellement faite, écart, actions non faites ; synthèse des notes d'observateurs ; rapport d'exercice via C3 (variante « exercice »).
- Sécurité : `mode = exercice` (F6) sur tout ce qui est créé ; `notifier` et `diffuser-alerte` refusent tout canal externe en mode exercice ; bandeau « EXERCICE » permanent dans l'UI ; la route publique de C2 n'accepte pas de signalement vers un événement d'exercice (sauf « canal exercice » explicitement configuré pour des figurants, avec jeton).
- Archivage et purge : un exercice archivé reste lisible ; la purge supprime toutes ses données rattachées.

**Critères d'acceptation**
- [ ] Exercice de 30 minutes simulées lancé depuis les injects de la fiche A ; les injects arrivent à l'heure simulée.
- [ ] Un test prouve qu'aucun appel vers un webhook externe n'est émis en mode exercice.
- [ ] Débrief montrant au moins un écart et une action non faite sur fixture.
- [ ] Purge : zéro ligne résiduelle rattachée à l'exercice.

**Estimation** : 3 à 4 sessions.
