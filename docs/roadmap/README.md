# Feuille de route Crisiware — « plus-value 2026 »

Date : 20 octobre 2026
Repo : `github.com/renaudlesage/plateforme-crise`
Portée : 10 chantiers + 3 transversaux, en deux vagues (novembre 2026 → février 2027, puis mars 2027 →).
Rythme réel : 4 à 6 h par semaine. Une session Claude Code = un chantier ou une tranche de chantier. Chaque session doit livrer quelque chose d'utilisable.

Ce dossier est le briefing de feuille de route du 20 octobre 2026, découpé en Session 0 : un fichier par chantier,
plus l'état d'avancement et la correspondance avec l'existant du dépôt. Le texte des chantiers est repris tel quel ;
ce qui a été constaté dans le code est consigné à part, dans [CORRESPONDANCE.md](CORRESPONDANCE.md).

## À lire à chaque session

1. [ETAT.md](ETAT.md) — où on en est, décisions de Ren, questions ouvertes, dette.
2. [00-contexte-et-regles.md](00-contexte-et-regles.md) — produit, principes non négociables, terminologie, règles de travail, RGPD et sécurité, définition de terminé.
3. Le fichier du chantier en cours, et sa ligne dans [CORRESPONDANCE.md](CORRESPONDANCE.md).

## Fichiers

| Fichier | Contenu |
|---|---|
| [ETAT.md](ETAT.md) | État de la feuille de route (mis à jour à chaque session) |
| [CORRESPONDANCE.md](CORRESPONDANCE.md) | Chantiers et fondations ↔ modules existants du dépôt, écarts avec le briefing |
| [00-contexte-et-regles.md](00-contexte-et-regles.md) | Sections 0, 5 et 6 du briefing |
| [F00-fondations.md](F00-fondations.md) | Fondations transversales F1–F8 |
| [references.md](references.md) | Références externes à vérifier, et résultat des vérifications |
| [C01-reveil.md](C01-reveil.md) | C1 — Réveil automatique (dernier kilomètre) |
| [C02-signal-citoyen.md](C02-signal-citoyen.md) | C2 — Signal citoyen de bout en bout |
| [C03-rapport-evenement.md](C03-rapport-evenement.md) | C3 — Rapport d'événement en un clic |
| [C04-pack-papier.md](C04-pack-papier.md) | C4 — Pack papier (mode dégradé minimal) |
| [C05-mode-exercice.md](C05-mode-exercice.md) | C5 — Mode exercice |
| [C06-tableau-preparation.md](C06-tableau-preparation.md) | C6 — Tableau de bord de préparation |
| [C07-mutuelle.md](C07-mutuelle.md) | C7 — Mutuelle opérationnelle |
| [C08-page-publique.md](C08-page-publique.md) | C8 — Page publique de crise et multilingue |
| [C09-registre-vulnerables.md](C09-registre-vulnerables.md) | C9 — Registre des personnes vulnérables (conception RGPD d'abord) |
| [C10-vue-supra-communale.md](C10-vue-supra-communale.md) | C10 — Vue supra-communale (province) |
| [T01-pwa-hors-ligne.md](T01-pwa-hors-ligne.md) | T1 — PWA hors ligne complète |
| [T02-bealert-sitrep.md](T02-bealert-sitrep.md) | T2 — Be-Alert et SITREP structurés (copier-coller, pas d'API) |
| [T03-ia.md](T03-ia.md) | T3 — IA hors chemin critique (optionnel) |

## 1. Mode d'emploi du briefing
### Session 0 — une fois (semaine 1)
1. Lire le repo : structure des quatre apps, modèle de tenancy (une commune = un tenant ? rôles ?), auth, tables, RLS, lib de carte, lib de notifications, génération PDF éventuelle, i18n éventuelle, Edge Functions existantes, cron existants.
2. Trouver le plan de sprint 15 modules. Produire `docs/roadmap/CORRESPONDANCE.md` : pour chaque chantier C1–C10/T1–T3, le module existant qui le couvre (même partiellement), ou « nouveau ». Si un module existant porte un autre nom, garder le nom du module dans le code et référencer le chantier dans la doc.
3. Créer `docs/roadmap/` : `README.md` (ce briefing découpé : un fichier par chantier `C01-reveil.md` … `T03-ia.md`), `ETAT.md` (voir modèle ci-dessous), `CORRESPONDANCE.md`.
4. Relever les fondations manquantes parmi F1–F8 (section 3) et les planifier au premier chantier qui en a besoin.
5. Résumé à Ren : écarts constatés, questions, migrations prévisibles.

### Chaque session suivante
Lire `ETAT.md` → prendre le prochain chantier (ou tranche) non terminé dans l'ordre de la section 2 → inspecter → implémenter → vérifier contre les critères d'acceptation → mettre à jour `ETAT.md` → livrer (section 6).

### Modèle de `ETAT.md`
```
# État de la feuille de route
Dernière session : AAAA-MM-JJ — chantier : Cx — résultat : ...
## Terminé
- C4 Pack papier (AAAA-MM-JJ, branche feat/c4-pack-papier, mergé : oui/non)
## En cours
- C2 Signal citoyen — tranche 2b — reste : ...
## Décisions de Ren
- AAAA-MM-JJ : migration XYZ approuvée
## Questions ouvertes
- ...
## Dette / à revoir
- ...
```

## 2. Ordre, dépendances, calendrier
### Vague 1 — novembre 2026 → février 2027 (environ 16 semaines, 11 à 13 sessions utiles)
| Semaines | Chantier | Sessions | Dépend de |
|---|---|---|---|
| 1 | Session 0 | 1 | — |
| 2–4 | C1 Réveil automatique | 2–3 | F1, F2, F3, F5 |
| 5–6 | C4 Pack papier | 1–2 | F4 |
| 7–8 | C3 Rapport d'événement | 2 | C4 (impression), F5 |
| 9–15 | C2 Signal citoyen (tranches 2a → 2d) | 5–6 | F2, F8, carte |
| 16 | Tampon, REX de vague 1, démo | 1 | — |

Règle de priorité : si une démo à une commune est planifiée, les tranches 2a et 2b de C2 passent devant C3.

### Vague 2 — mars 2027 → (après la réévaluation de mars)
Ordre recommandé : C5 Mode exercice → C6 Tableau de bord de préparation → C7 Mutuelle opérationnelle → C8 Page publique de crise et multilingue → T1 PWA hors ligne complète → C9 Registre des personnes vulnérables (conception RGPD d'abord) → C10 Vue supra-communale → T2 Be-Alert / SITREP structurés (si non absorbé par C3 et C8) → T3 IA hors chemin critique (optionnel).

### Graphe de dépendances (résumé)
- C3 réutilise les routes d'impression de C4.
- C5 réutilise C3 (rapport d'exercice) et les injects des fiches.
- C6 lit des dates produites par C1 (règles armées), C4 (pack généré), C5 (dernier exercice), C7 (ressources revalidées), C8 (page configurée), C9 (registre à jour).
- C7 réutilise la route publique et le QR de C2 pour l'inscription des bénévoles.
- C8 réutilise les messages D5 et le flux de validation ; T2 s'y greffe.
- C10 lit C3 (SITREP transmis) et C6 (scores) ; nécessite le modèle d'opt-in de C7.
- T1 s'appuie sur C4 (contenu minimal hors ligne) et sur le journal append-only (F5) pour éviter les conflits de synchro.
