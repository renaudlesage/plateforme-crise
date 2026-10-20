# Fondations transversales (F1–F8)

> Extrait du briefing « feuille de route plus-value 2026 » du 20 octobre 2026, découpé en Session 0. État d'avancement : [ETAT.md](ETAT.md). Existant et écarts : [CORRESPONDANCE.md](CORRESPONDANCE.md).

À implémenter au premier chantier qui en a besoin, en vérifiant d'abord ce qui existe déjà.

- **F1 Référentiel des communes belges** : table `communes_be` (code NIS, nom FR/NL/DE, province, région, langue(s) administrative(s), géométrie simplifiée ou centroïde + bbox). Source : liste officielle des codes NIS (Statbel) ; géométries depuis l'open data régional si disponible. Chargée par script de seed ou migration. Sert à C1 (province ↔ communes), C2 (bbox), C8 (langues), C10.
- **F2 Notifications internes** : une fonction unique `notifier(destinataires, message, niveau, lien)` → web push (VAPID, service worker) + e-mail via le webhook existant de `diffuser-alerte` ; préférences par utilisateur ; chaque envoi journalisé ; escalade configurable (si non acquitté en X minutes → suppléant). Refus absolu d'envoyer vers un canal externe quand `mode = exercice` (F6).
- **F3 Planification** : `pg_cron` + `pg_net` pour appeler les Edge Functions à intervalle (Supabase Cron) ; table `jobs_etat` (dernier succès, dernière erreur) pour détecter un flux muet.
- **F4 Impression** : design system print (`@media print`), une route `/print/...` par objet imprimable, pas de police externe au moment de l'impression, pagination contrôlée. Pas de bibliothèque PDF tant que l'impression navigateur suffit.
- **F5 Journal immuable** : `journal_decisions` en append-only (trigger qui interdit UPDATE/DELETE), horodatage serveur + horodatage client (pour la synchro hors ligne), auteur, type d'entrée, référence (signalement n°, alerte, message), hash chaîné optionnel (SHA-256 de l'entrée précédente) pour prouver l'intégrité dans C3.
- **F6 Marqueur réel/exercice** : colonne `mode` (`reel` | `exercice`) sur `evenements` et propagée (ou jointe) sur toutes les entités rattachées ; filtres par défaut sur `reel` ; purge des exercices (C5).
- **F7 i18n** : toutes les chaînes UI dans un dictionnaire FR dès maintenant (clé → texte) ; DE et NL au chantier C8. Les contenus saisis par les opérateurs ont des champs par langue, pas de traduction automatique dans le chemin critique.
- **F8 Sécurité des endpoints publics** : toute écriture anonyme passe par une Edge Function (jamais d'insert anonyme direct en base) : limitation de débit par IP (hachée, rétention courte) et par commune, champ honeypot, taille maximale, types MIME autorisés, journal des rejets, aucune donnée sensible renvoyée.
