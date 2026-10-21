# Edge Functions Supabase

Projet `apjswshvzbejpvlxfnek`. La base et les fonctions déployées font foi ; ce dossier versionne celles qui ont
été récupérées ou écrites dans le dépôt.

| Fonction | Déployée | Dans le dépôt | Rôle |
|---|---|---|---|
| `inviter-membre` | v3, JWT exigé | oui | Invitation d'un membre sur un contexte (clé de service, droits de l'appelant vérifiés) |
| `irm-vigilance` | v1, sans JWT | oui (copie du déploiement v1, récupérée le 21 octobre 2026) | Relais de l'avertissement IRM d'une province via le flux ATOM MeteoAlarm, cache 5 min, rien n'est stocké ; appelée par `VeilleMeteo.jsx` (QG et Terrain) |
| `diffuser-alerte` | v2, JWT exigé | non (question ouverte 10) | Diffusion multicanal par webhooks |
| `ingestion-alerte-externe` | v1, sans JWT | non (question ouverte 10) | Pont Eventware → Crisiware : écrit dans `alertes_publiques` (sans rapport avec les avertissements météo de C1) |
| `bootstrap-super-admin` | v8 | non | Neutralisée, suppression à décider (question ouverte 10) |
| `reset-password-ferrieres-test` | v2 | non | Neutralisée, suppression à décider (question ouverte 10) |

`_shared/` contient le code commun aux futures fonctions, sans dépendance au runtime Deno pour être testé par
Vitest (`npm test` à la racine) : lecteur XML minimal (`xml.ts`, refuse DOCTYPE et entités externes) et lecture
des messages CAP 1.1 et 1.2 (`cap.ts`) au vocabulaire de Crisiware, préparés pour l'ingestion de C1 quelle que
soit la source retenue (IRM ou MeteoAlarm, question ouverte 7). Les fixtures de `_shared/fixtures/cap/` sont
fabriquées d'après la norme CAP 1.2 et les conventions MeteoAlarm (`awareness_level`, `awareness_type`) : ce ne
sont pas des messages réels. Les géocodes qu'elles portent sont des codes NUTS 2, choisis parce qu'ils sont
connus ; les codes de zone réels du flux belge restent à relever. À compléter par de vrais fichiers dès que
l'environnement de travail peut lire les flux (question ouverte 13).

`irm-vigilance` est versionnée telle quelle, sans correction. Limite relevée à la lecture : la province est
retrouvée par le nom de zone du flux ; si MeteoAlarm publie une seule zone « Brabant » (voir
`docs/roadmap/references.md`), un avertissement sur cette zone n'apparaît pas pour une commune du Brabant wallon,
du Brabant flamand ou de Bruxelles. L'ingestion de C1 la remplacera.
