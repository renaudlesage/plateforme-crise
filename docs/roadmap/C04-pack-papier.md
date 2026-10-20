# C4 — Pack papier (mode dégradé minimal)

> Extrait du briefing « feuille de route plus-value 2026 » du 20 octobre 2026, découpé en Session 0. État d'avancement : [ETAT.md](ETAT.md). Existant et écarts : [CORRESPONDANCE.md](CORRESPONDANCE.md).

**Plus-value (REX)** : cyberattaques (Temse avril 2026, 270 organisations belges compromises en février), sabotage électrique de Berlin en janvier, exercice national de black-out en France en novembre 2026. L'argument « ça marche encore sans réseau » doit être démontrable en réunion.

**Portée**
- Routes `/print/pack/fiche/:ficheId` (avant événement) et `/print/pack/evenement/:id` (pendant) : fiche condensée (seuils avec cases à cocher, rôles, messages-types), annuaire CC / disciplines / mutuelle / prestataires de la commune, carte des points noirs (image statique : points de la commune + couches d'aléa d'inondation et d'axes de ruissellement du géoportail wallon via WMS si les licences le permettent — vérifier, sinon points communaux seuls), tableau de signalements vierge (20 lignes), journal vierge, feuille de relève, feuille de présence au CC.
- Bouton « Générer le pack papier » dans la checklist S1 des fiches et dans les paramètres de la commune ; date de dernière génération enregistrée (lue par C6).
- Contraintes : `@media print` uniquement, aucune police externe, 6 pages maximum pour le pack fiche.

**Critères d'acceptation**
- [ ] Impression correcte dans Chrome et Firefox, 6 pages max pour le pack fiche.
- [ ] Carte statique rendue sans dépendre d'un service tiers au moment de l'impression (image pré-générée et stockée).
- [ ] Date de génération enregistrée et visible.
- [ ] Génération possible pour chaque fiche importée, y compris les fiches A et B.

**Estimation** : 1 à 2 sessions.
