# Références à vérifier

> Extrait du briefing « feuille de route plus-value 2026 » du 20 octobre 2026, découpé en Session 0. État d'avancement : [ETAT.md](ETAT.md). Existant et écarts : [CORRESPONDANCE.md](CORRESPONDANCE.md).

- MeteoAlarm : flux ATOM/CAP par pays (feeds.meteoalarm.org) et conditions d'utilisation ; format CAP 1.2 (OASIS).
- IRM : open data (opendata.meteo.be) — vérifier si les avertissements y sont exposés.
- Statbel : liste officielle des codes NIS des communes.
- Géoportail wallon (WalOnMap) : services WMS d'aléa d'inondation et d'axes de ruissellement, licences.
- Supabase : Cron (`pg_cron`, `pg_net`), Realtime, Storage (URL signées), Edge Functions (secrets, limites).
- Web Push : VAPID (RFC 8292), service worker, bibliothèque utilisable dans les Edge Functions Deno.
- `vite-plugin-pwa` / Workbox pour T1.
- Fiches scénario A (orages éclair) et B (cyberattaque) du briefing précédent : sources REX réutilisables pour les textes d'aide de C1, C2, C4, C8.
