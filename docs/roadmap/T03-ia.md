# T3 — IA hors chemin critique (optionnel, vague 2 tardive)

> Extrait du briefing « feuille de route plus-value 2026 » du 20 octobre 2026, découpé en Session 0. État d'avancement : [ETAT.md](ETAT.md). Existant et écarts : [CORRESPONDANCE.md](CORRESPONDANCE.md).

**Portée** : Edge Function optionnelle, activable par commune (feature flag), pour : brouillon de SITREP à partir du journal (validation humaine obligatoire), suggestion de regroupement de signalements (photo + texte), suggestion de traduction FR → DE/NL des messages (validation humaine). Dégradation silencieuse si indisponible ; jamais requise pour une action ; coûts plafonnés par commune ; aucune donnée du registre C9 n'y transite.

**Critères d'acceptation** : flag désactivé → aucune différence fonctionnelle ; flag activé et service en panne → aucune erreur visible.
