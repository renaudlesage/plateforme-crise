# C10 — Vue supra-communale (province)

> Extrait du briefing « feuille de route plus-value 2026 » du 20 octobre 2026, découpé en Session 0. État d'avancement : [ETAT.md](ETAT.md). Existant et écarts : [CORRESPONDANCE.md](CORRESPONDANCE.md).

**Plus-value (REX)** : le 30 mai, plus de trente communes touchées en quelques heures ; les Fagnes, cinq communes et un voisin allemand. Le gouverneur travaille dans Paragon ; cette vue est un complément lu, pas un doublon.

**Portée**
- Tenant provincial avec rôle lecture seule sur les communes ayant opté (modèle C7) : carte des événements et phases, signalements agrégés (comptes, « danger de mort » détaillés), demandes de ressources ouvertes, scores de préparation (C6), SITREPs transmis (C3) horodatés.
- Aucune écriture dans les données communales ; la province peut diffuser des messages internes aux CPU (F2).
- Export du tableau provincial (F4).

**Critères d'acceptation**
- [ ] Tests RLS : aucune fuite hors opt-in ; une commune non opt-in est invisible.
- [ ] Transmission d'un SITREP journalisée des deux côtés.
- [ ] Vue agrégée cohérente sur fixture de 5 communes.

**Estimation** : 3 sessions.
