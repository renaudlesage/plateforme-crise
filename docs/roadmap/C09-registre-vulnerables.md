# C9 — Registre des personnes vulnérables (conception RGPD d'abord)

> Extrait du briefing « feuille de route plus-value 2026 » du 20 octobre 2026, découpé en Session 0. État d'avancement : [ETAT.md](ETAT.md). Existant et écarts : [CORRESPONDANCE.md](CORRESPONDANCE.md).

**Plus-value (REX)** : 1 222 décès excédentaires en Belgique pendant les canicules de 2026 ; la panne d'électricité et de chauffage d'une maison de repos à Nivelles a déclenché une phase communale ; en black-out, les personnes dépendantes d'un appareil électrique sont la priorité.

**Session de conception (obligatoire avant tout code)** : produire `docs/roadmap/C09-conception-rgpd.md` à faire valider par Ren (et le DPO d'une commune pilote / l'UVCW) : finalité précise, base légale (mission d'intérêt public et exception de l'article 9 à confirmer — ne pas trancher), consentement explicite (formulaire papier et numérique), durée de conservation, droits et procédure, journal des accès, chiffrement des champs sensibles en base, RLS stricte (rôle D2/CPAS uniquement), export minimal, analyse d'impact (AIPD) si requise. Aucun code tant que ce document n'est pas approuvé dans `ETAT.md`.

**Portée après approbation**
- Inscription par la personne, un proche ou le CPAS ; critères par catégories (isolement, mobilité réduite, dépendance à un appareil électrique, langue, besoin d'aide pour évacuer) — jamais de diagnostic.
- Plan de contact par seuil (canicule orange → appel J0 ; black-out → visite ; inondation → évacuation prioritaire), éditable par fiche.
- Génération de listes d'appel par secteur, affectation aux agents ou bénévoles (C7), pointage du résultat (joint / pas de réponse / besoin), escalade.
- Export chiffré pour la liste papier scellée (S0 de la fiche B), avec procédure.
- Journal des accès consultable par le DPO.

**Critères d'acceptation**
- [ ] Document de conception approuvé.
- [ ] Tests RLS : un utilisateur hors rôle D2/CPAS ne lit rien ; chaque lecture journalisée.
- [ ] Champs sensibles chiffrés en base (vérification directe en SQL).
- [ ] Liste d'appel générée, pointage, escalade.
- [ ] Purge et droit d'effacement testés.

**Estimation** : 1 session de conception + 3 sessions de réalisation.
