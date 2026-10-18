# Migrations Supabase

Ce dossier est versionné depuis le 18 octobre 2026. Les migrations antérieures (schéma initial, modules, exercices,
journal des décisions…) ont été appliquées directement sur le projet `apjswshvzbejpvlxfnek` et ne sont pas toutes
reproduites ici : la base de production fait foi. Chaque fichier ci-dessous a été appliqué tel quel.

| Fichier | Objet |
|---|---|
| `20261018120000_journal_decisions_auteurs.sql` | Fonction `journal_decisions_auteurs` (auteur des saisies du journal) |
| `20261018140000_pont_commune_evenements.sql` | Pont commune → événements : tables, droits, propositions automatiques, envoi après validation |

Attention : le fichier du pont est l'état final (deux correctifs appliqués après coup en base, sous les noms
`pont_commune_evenements_correctif_rehausse` et `pont_commune_evenements_revoke_triggers`, y figurent déjà).
