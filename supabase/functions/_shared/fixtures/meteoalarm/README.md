Messages **réels** du flux MeteoAlarm Belgique, relevés le 13 novembre 2026 depuis la base Supabase
(`extensions.http_get`), pour les tests :

- `flux_extrait.xml` : extrait du flux Atom « legacy » `https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-belgium`.
  Les deux premières entrées (Namur et Luxembourg, jaune brouillard) sont recopiées telles quelles ; la troisième (Liège,
  mise à jour verte) est abrégée (champs inutiles aux tests retirés) ; la quatrième est un doublon **ajouté** pour tester
  le dédoublonnage.
- `jaune_brouillard_liege.xml` : message CAP 1.2 de l'IRM (4 langues) d'une entrée du flux, recopié tel quel.

Source : IRM via MeteoAlarm (EUMETNET). Le flux Atom est publié sous licence CC BY 4.0 ; l'usage commercial reste à confirmer
(question 6 de `docs/roadmap/ETAT.md`).
