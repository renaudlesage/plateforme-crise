# Contexte, règles, RGPD et définition de terminé
> Extrait du briefing « feuille de route plus-value 2026 » du 20 octobre 2026, découpé en Session 0. État d'avancement : [ETAT.md](ETAT.md). Existant et écarts : [CORRESPONDANCE.md](CORRESPONDANCE.md).

## 0. Contexte et règles (à lire à chaque session)
### Le produit
- Crisiware (commercialisé sous la marque FERRU) = ce repo. SaaS de gestion de crise pour les communes et provinces belges. Cible commerciale : les communes d'abord, les provinces ensuite.
- Stack : React / Vite / Supabase (projet `apjswshvzbejpvlxfnek`, région eu-north-1), déploiement Vercel. Quatre apps. Schéma Supabase de 24 tables avec RLS. Un plan de sprint de 15 modules en quatre paliers existe déjà : il doit être réconcilié avec ce briefing (voir Session 0), pas ignoré.
- Existant à réutiliser : starter pack de 18+ fiches scénario (12 génériques + 6 nucléaires) et cartes REX (Hautes Fagnes août 2026, confinement Moselle, et les deux fiches du briefing précédent : orages éclair / cyberattaque) ; import en un clic ; Edge Function `diffuser-alerte` (diffusion multicanal par webhooks) ; constructs `journal_decisions`, `seuils_action`, `centres_accueil`, `ressources_critiques` ; couche « signal citoyen ascendant » ; « mutuelle de résilience » (réseau pré-organisé de ressources et de professionnels, modèle abonnement).

### Principes non négociables
- **Mode dégradé obligatoire** : chaque chantier répond explicitement à « et sans réseau ? ».
- **Anti-surcharge** : chaque écran réduit le nombre de décisions. Jamais plus de trois actions proposées à la fois.
- **Amplifier la solidarité citoyenne**, ne pas la remplacer par de la procédure.
- **Données** : tout est encodable via les formulaires CRUD in-app. Interdit d'injecter des données en éditant `referentiels.js` ou un autre fichier source. Les référentiels (communes, fiches) arrivent par seed ou migration, jamais en dur dans le code applicatif.
- **Exercice ≠ réel** : aucune donnée d'exercice ne doit jamais atteindre un citoyen ou un canal externe.
- **Pas de surpromesse d'intégration** : pas d'API Be-Alert ni Paragon tant qu'elle n'existe pas officiellement ; on prépare des contenus structurés à copier-coller et on les journalise.

### Terminologie stricte
- **CC** = Comité de Coordination (stratégique, communal présidé par le bourgmestre ou provincial présidé par le gouverneur). **PC-Ops** = poste de commandement opérationnel terrain. Ne jamais confondre.
- Phases : communale, provinciale, fédérale ; « phase 1 » = première intervention sans déclenchement formel.
- Disciplines D1 secours, D2 médical/psychosocial, D3 police, D4 logistique, D5 information (qui gère la phase communique).
- Outil national : **Paragon** (NCCN) — jamais ICMS. Alerte population : **Be-Alert**. Centre de crise wallon : **CORTEX**. Météo : **IRM**. CPU = coordinateur en planification d'urgence. DG = directeur général.

### Règles de travail
- Avant d'écrire : inspecter le code existant concerné et lire `docs/roadmap/ETAT.md`.
- Aucune migration appliquée sans l'avoir soumise à Ren dans le résumé de session (fichier de migration préparé, non appliqué, sauf accord explicite déjà donné dans ETAT.md).
- Aucune fiche existante modifiée. Pas de refactor opportuniste.
- Dépendances : seulement celles listées dans le chantier ; toute autre doit être justifiée dans le résumé.
- Français partout dans l'UI et les données ; i18n préparée (F7) mais le français reste la langue source.
- Tests : réutiliser le framework présent. S'il n'y en a aucun, en installer un seul (Vitest, déjà naturel avec Vite) au chantier C1, pas avant.

## 5. RGPD et sécurité (transversal)
- Minimisation partout ; rétentions paramétrables avec valeurs par défaut documentées ; jobs de purge testés.
- Toute nouvelle table : RLS écrite et testée (tests qui échouent quand la politique manque).
- Endpoints publics : uniquement via Edge Functions (F8) ; jamais de clé service côté client.
- Secrets : variables d'environnement et secrets Supabase ; `.env.example` à jour à chaque chantier qui ajoute une variable (C1 : aucune ; F2 : clés VAPID ; C8 : domaine ; T3 : clé API).
- Journal des accès pour C9 ; journal des envois pour F2 ; journal des rejets pour F8.
- Pas de données personnelles dans les logs d'Edge Functions.

## 6. Definition of Done et livraison
Pour chaque chantier :
- [ ] Critères d'acceptation cochés, avec la preuve (test, capture, script) listée dans le résumé.
- [ ] Mode dégradé décrit et vérifié.
- [ ] Données éditables via CRUD ; aucune donnée en dur.
- [ ] Terminologie conforme ; aucune occurrence d'« ICMS ».
- [ ] Migrations préparées dans le dossier de migrations, non appliquées sans accord, décrites dans le résumé.
- [ ] `.env.example` à jour si une variable a été ajoutée.
- [ ] Tests existants verts ; `vite build` OK ; vérification sur viewport mobile.
- [ ] `ETAT.md` et `CORRESPONDANCE.md` mis à jour.

Livraison : branche `feat/cXX-nom-court` (ou `feat/tXX-…`), commits atomiques, branche poussée, pas de merge. Résumé final à Ren : fichiers touchés, ce qui a été vérifié, migrations à approuver, questions ouvertes, prochain chantier proposé. Si Ren le demande, archive .zip complète du projet modifié : il préfère uploader un zip complet dans GitHub plutôt qu'appliquer des correctifs. Quand un chantier ajoute un fichier `.env` ou une variable, rappeler à Ren d'activer l'affichage des fichiers cachés dans son explorateur avant l'upload, sinon le `.env` est ignoré silencieusement.

Décisions réservées à Ren (ne pas trancher seul) :
1. Toute migration de schéma.
2. Le modèle de SITREP provincial à reproduire (demander un exemplaire réel).
3. L'approbation du document de conception RGPD de C9.
4. Les licences des flux et couches externes (MeteoAlarm, géoportail wallon, tuiles de carte).
