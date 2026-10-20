# C8 — Page publique de crise et multilingue

> Extrait du briefing « feuille de route plus-value 2026 » du 20 octobre 2026, découpé en Session 0. État d'avancement : [ETAT.md](ETAT.md). Existant et écarts : [CORRESPONDANCE.md](CORRESPONDANCE.md).

**Plus-value (REX)** : en cas de cyberattaque, le site communal est le premier à tomber (fiche B) ; en cas d'orages, les consignes doivent être lisibles en 3G ; les communes de l'Est travaillent en allemand (Baelen, Waimes, Butgenbach, Eupen étaient dans les Fagnes).

**Portée**
- Page publique par commune `/c/:slug` servie par Vercel, donc hors infrastructure communale par construction : état (situation en cours ou non), consignes (messages D5 validés), services disponibles / indisponibles / dégradés (préréglage « cyber »), routes fermées (depuis décisions et signalements), centres d'accueil, lien de signalement (C2), numéros, dernière mise à jour. Légère, lisible en 3G, imprimable (F4), cache HTTP court.
- Flux de publication : message rédigé depuis un modèle de la fiche → validation par le bourgmestre ou son délégué (journalisé) → publication sur la page + canaux de `diffuser-alerte`. Préréglages par fiche (M1–M5).
- Multilingue : dictionnaire UI FR/DE/NL (F7) ; messages avec champs par langue, saisis par l'opérateur (une suggestion automatique de traduction est possible via T3, jamais obligatoire) ; la commune choisit ses langues (défaut selon F1).
- Domaine : sous-domaine par défaut ; domaine personnalisé optionnel (documenter la configuration Vercel).

**Critères d'acceptation**
- [ ] Publication de bout en bout avec validation journalisée.
- [ ] Rendu FR et DE sur fixture ; bascule de langue sans rechargement complet.
- [ ] Page fonctionnelle quand le backend communal n'existe pas (elle ne dépend que de Supabase/Vercel) ; test de charge léger.
- [ ] Taille de page initiale < 200 ko hors images.

**Estimation** : 2 à 3 sessions.
