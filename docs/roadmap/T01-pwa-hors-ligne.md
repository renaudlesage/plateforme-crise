# T1 — PWA hors ligne complète

> Extrait du briefing « feuille de route plus-value 2026 » du 20 octobre 2026, découpé en Session 0. État d'avancement : [ETAT.md](ETAT.md). Existant et écarts : [CORRESPONDANCE.md](CORRESPONDANCE.md).

**Portée** : `vite-plugin-pwa` (Workbox) ; précache de l'app ; cache des données de l'événement actif (fiches, contacts, points noirs, N dernières entrées de journal, signalements ouverts) ; file de synchronisation en arrière-plan pour les entrées de journal et changements de statut (append-only → pas de conflit ; ordre par horodatage client, horodatage serveur à réception) ; cache des tuiles de carte sur la bbox de la commune (zooms 12 à 16, plafond de taille, licence des tuiles à vérifier) ; indicateur hors ligne / synchro en attente ; interrupteur « mode black-out » pour la démo.

**Critères d'acceptation**
- [ ] Script de test « mode avion » : ouvrir l'événement hors ligne, ajouter trois entrées de journal, reconnecter → synchronisées dans l'ordre avec les deux horodatages.
- [ ] Carte de la commune lisible hors ligne au zoom 14.
- [ ] Aucune régression de performance en ligne (temps de premier rendu).

**Estimation** : 3 à 4 sessions. Dépendance ajoutée autorisée : `vite-plugin-pwa`.
