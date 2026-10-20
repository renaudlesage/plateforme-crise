# C1 — Réveil automatique (dernier kilomètre)

> Extrait du briefing « feuille de route plus-value 2026 » du 20 octobre 2026, découpé en Session 0. État d'avancement : [ETAT.md](ETAT.md). Existant et écarts : [CORRESPONDANCE.md](CORRESPONDANCE.md).

**Plus-value (REX)** : le 30 mai 2026, Huy a été sinistrée alors que le CORTEX s'était réuni deux jours plus tôt et que l'avertissement orange IRM était tombé en fin d'après-midi. La commune ne doit plus dépendre d'un appel descendant : l'avertissement arme le seuil, le seuil réveille le CPU et le bourgmestre.

**Portée**
- Ingestion : Edge Function `ingest-meteoalarm` appelée toutes les 10 minutes (F3). Source : flux ATOM/CAP de MeteoAlarm pour la Belgique (avertissements IRM par province). Vérifier l'URL exacte sur feeds.meteoalarm.org et les conditions d'utilisation (attribution « Source : IRM via MeteoAlarm » affichée). Si l'open data IRM (opendata.meteo.be) expose directement les avertissements, le préférer ; sinon MeteoAlarm.
- Normalisation dans `alertes_externes` : identifiant CAP, type (orages, pluie, vent, chaleur, froid, neige/verglas, brouillard, autre), niveau (jaune/orange/rouge), zone (province via F1), début, fin, texte, reçu à (horodatage serveur), mis à jour à. Dédoublonnage par identifiant CAP + version ; une alerte mise à jour ne renotifie que si le niveau monte.
- Moteur de seuils : règle = (source, type, niveau minimal, fenêtre horaire éventuelle) → seuil S0/S1 d'une fiche active de la commune. Les règles sont des données éditables (CRUD, écran « Réveil automatique » par commune) ; les fiches A (orages) et canicule livrent des règles par défaut à l'import.
- Déclenchement : crée un « événement en veille » (ou rattache à l'événement en cours), ouvre la checklist du seuil, journalise « Alerte [type/niveau] reçue à HH:MM, seuil Sx armé » (F5), notifie CPU + bourgmestre + suppléants (F2) avec lien direct vers la checklist ; escalade si non acquitté en 15 minutes (paramétrable).
- Acquittement : bouton « Vu, je prends » → journalisé avec heure et auteur. C'est la pièce qui répond à « à quelle heure avez-vous reçu l'alerte ? ».
- Écran « Veille » : alertes en cours sur la (les) province(s) de la commune, état des règles (armée / déclenchée / acquittée), état du flux (dernier succès).
- Silence dangereux : si le flux n'a rien renvoyé depuis plus d'une heure ou renvoie une erreur, bandeau dans l'app et notification au CPU (F3 `jobs_etat`).

**Hors portée** : prévision, hydrométrie (prévoir une tranche C1b ultérieure sur les stations hydrométriques du SPW pour les crues lentes), envoi Be-Alert.

**Mode dégradé** : l'alerte est aussi envoyée par e-mail (texte brut) ; l'écran Veille est imprimable (F4) ; rien ne dépend d'un service tiers autre que le flux lui-même, dont l'indisponibilité est signalée.

**Données / code** : tables `alertes_externes`, `regles_reveil`, `acquittements` (ou extension de `seuils_action` si le schéma s'y prête — inspecter d'abord) ; Edge Function `ingest-meteoalarm` ; cron ; aucune clé secrète (flux public) ; fixtures CAP pour les tests.

**Critères d'acceptation**
- [ ] Une fixture CAP « orange orages, province de Liège » injectée → règle de la fiche A déclenchée → notifications envoyées à la liste attendue → entrée de journal créée → acquittement journalisé.
- [ ] Une mise à jour de la même alerte sans hausse de niveau ne renotifie pas ; une hausse jaune → orange renotifie.
- [ ] Coupure simulée du flux > 1 h → bandeau + notification CPU.
- [ ] Les règles sont créées, modifiées et supprimées via les formulaires CRUD ; l'import des fiches A et canicule crée leurs règles par défaut.
- [ ] Tests unitaires du parseur CAP sur au moins trois fixtures (jaune, orange, rouge ; une alerte multi-provinces).
- [ ] Attribution de la source affichée.

**Estimation** : 2 à 3 sessions.
