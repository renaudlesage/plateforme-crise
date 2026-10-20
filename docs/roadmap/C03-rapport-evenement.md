# C3 — Rapport d'événement en un clic

> Extrait du briefing « feuille de route plus-value 2026 » du 20 octobre 2026, découpé en Session 0. État d'avancement : [ETAT.md](ETAT.md). Existant et écarts : [CORRESPONDANCE.md](CORRESPONDANCE.md).

**Plus-value (REX)** : questions parlementaires de juin 2026 (« les alertes ont-elles fonctionné ? »), critiques de « manque de leadership » après les Fagnes, partie civile de Baelen, dossiers calamités. La traçabilité doit devenir un objet que le bourgmestre montre.

**Portée**
- Chronologie fusionnée : alertes externes reçues et acquittées (C1), entrées du journal (F5), messages D5 envoyés (journal de `diffuser-alerte`), signalements par tranche horaire (agrégés, « danger de mort » en détail), ressources engagées, centres d'accueil ouverts/fermés, phases avec heures et autorité.
- Statistiques : délais alerte → acquittement → convocation du CC → phase ; nombre de signalements par type et par heure ; pic d'activité.
- Variantes : « Synthèse pour le conseil communal » (2 pages max), « Dossier complet » (annexes : carte statique des signalements, liste intégrale des messages, participants au CC), « SITREP » (instantané 1 page à l'heure T, pour le gouverneur — format à aligner sur un modèle provincial réel que Ren fournira ; en attendant, en-tête / situation / mesures prises / besoins / prochain point).
- Section REX à compléter (champs libres : ce qui a marché, ce qui n'a pas marché, actions ; éditables via CRUD et conservés).
- Intégrité : mention « généré le … à partir d'un journal non modifiable », empreinte de la chaîne (F5) si implémentée.
- Formats : route d'impression (F4) → PDF via le navigateur ; export JSON (machine) ; CSV des signalements.

**Mode dégradé** : le rapport se génère depuis les données locales si T1 est en place ; sinon, il se génère après reconnexion. La chronologie manuscrite du pack papier (C4) est la source de ressaisie.

**Critères d'acceptation**
- [ ] Généré depuis un événement de fixture : aucune entrée de journal manquante (comptage égal), heures en Europe/Brussels.
- [ ] Synthèse ≤ 2 pages à l'impression, dossier complet paginé proprement.
- [ ] SITREP 1 page avec heure T figée et enregistrée (« transmis au gouverneur à HH:MM » journalisé quand l'utilisateur le marque).
- [ ] Exports JSON et CSV valides.

**Estimation** : 2 sessions.
