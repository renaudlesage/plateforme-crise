# État de la feuille de route
Dernière session : 2026-10-20 — chantier : Session 0 — résultat : briefing découpé dans `docs/roadmap/`, existant relevé chantier par chantier ([CORRESPONDANCE.md](CORRESPONDANCE.md)), fondations F1–F8 évaluées, références externes vérifiées ([references.md](references.md)), plan de sprint 15 modules introuvable, une faille critique et plusieurs failles de sécurité relevées.

## Terminé
- Session 0 (2026-10-20, branche feat/s00-feuille-de-route, mergé : non)
- Avant la feuille de route, utiles aux chantiers :
  - Renommage « Crisiware 2 » (2026-10-20, PR #2, mergé : oui)
  - Fiches REX 2026 orages éclair (A) et cyberattaque (B), import avec seuils et plan d'action, impression de fiche (2026-10-20, PR #3, mergé : oui)
  - Risques du territoire distincts des objets à risque (2026-10-20, PR #4, mergé : oui)

## En cours
- Aucun chantier commencé.
- Prochain proposé : correctifs de sécurité (section 6 de [CORRESPONDANCE.md](CORRESPONDANCE.md)), puis C1 Réveil automatique — tranche 1 : fondations F3 (pg_cron, pg_net, `jobs_etat`) et F1 (communes ↔ provinces), ingestion serveur des avertissements IRM dans `alertes_externes`, Vitest et fixtures CAP.

## Décisions de Ren
- 2026-10-20 : migration `risques_territoire` approuvée ; exécutée par Ren dans le SQL Editor (hors historique `schema_migrations`).
- 2026-10-20 : STARTER-04 (ruissellement urbain) et STARTER-07 (cyberattaque communale) retirés du pack et supprimés de la Commune Test.
- 2026-10-20 : pas de régénération des `database.types.ts` (périmés, importés nulle part) dans le cadre des chantiers récents.
- 2026-10-19 : nom affiché « Crisiware 2 » ; noms des projets Vercel et adresses `*.vercel.app` inchangés.

## Questions ouvertes
1. **Plan de sprint 15 modules en quatre paliers** : introuvable (dépôt, historique GitHub, base, Google Drive). Seules traces : « Tier 1.1 » (fiche de risque) et « Tier 1.2 » (seuils d'action) dans une migration du 30/07/2026. À coller ou à retrouver dans le projet claude.ai pour la réconciliation.
2. **Correctifs de sécurité** : approuver la migration de correction de `contextes` (critique) et des écritures anonymes (`benevoles_entraide`, `plans_urgence_menages`, `contextes_publics()`…).
3. **Purge des exercices (C5)** : la base applique « exercice terminé = preuve non supprimable » ; le briefing demande une purge. Lequel prime ?
4. **Licences (décisions réservées)** : MeteoAlarm, géoportail wallon (aléa d'inondation, axes de ruissellement), tuiles de carte (le pré-téléchargement est interdit sur `tile.openstreetmap.org` ; imagerie Esri sous licence) — voir [references.md](references.md).
5. **Modèle de SITREP provincial** (C3, T2) : exemplaire réel à fournir.
6. **Source unique du « message D5 validé »** (C8, T2) : catalogue national, modèles de messages ou messages réflexes de l'incident ?
7. **« N défini » (C6)** : à quoi correspond ce paramètre de fiche ?
8. **Edge Functions** : versionner dans le dépôt `diffuser-alerte`, `irm-vigilance`, `ingestion-alerte-externe` ? Supprimer `bootstrap-super-admin` et `reset-password-ferrieres-test` (neutralisées) ?
9. **Marque** : « FERRU » doit-il apparaître dans l'interface à côté de « Crisiware 2 » ?
10. Reprises du briefing REX : point de départ du délai de 21 jours ouvrables du Fonds des calamités ; IMIO, CyberFundamentals et NIS2 pour la commune cible.

## Dette / à revoir
- 3 Edge Functions déployées absentes du dépôt ; 2 fonctions neutralisées encore déployées.
- 118 migrations en prod pour 10 fichiers versionnés ; `risques_territoire` hors historique.
- `database.types.ts` périmés (52 tables) en 5 copies.
- `role_capacites` vide : la grille des capacités de l'Admin n'a aucun effet (repli sur le niveau d'accès).
- `livre_de_bord` modifiable et supprimable (à rendre ajout seul pour C3 et T1) ; changement de phase en deux écritures client.
- Libellé des étapes de plan d'action non modifiable dans l'Admin.
- Secrets de webhooks en clair (`canaux_diffusion`, `sources_externes_alertes`).
- Aucun test automatisé (Vitest à installer au C1).
- Interrogation périodique partout, Realtime inutilisé.
- File d'écritures Terrain non liée à l'utilisateur.
- README racine : `.env.example` absent, référence à « pcops-generique-test ».
- Tables résiduelles `_test_gen`, `_test_gen2`, `_test_gen3`.
