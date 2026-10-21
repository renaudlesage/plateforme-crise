# C2 — Signal citoyen de bout en bout

> Extrait du briefing « feuille de route plus-value 2026 » du 20 octobre 2026, découpé en Session 0. État d'avancement : [ETAT.md](ETAT.md). Existant et écarts : [CORRESPONDANCE.md](CORRESPONDANCE.md).

**Plus-value (REX)** : un avertissement « toute la Wallonie » ne dit pas où ça frappe. Le 30 mai, le premier signal utile venait des riverains ; les pompiers de la zone Wapi étaient saturés. Les offres d'aide spontanées ont fait la différence. Et après la crise, documenter les dégâts (photos, heures) conditionne les dossiers calamités.

Vérifier d'abord ce qui existe déjà de cette couche dans les quatre apps et compléter sans dupliquer.

**Tranche 2a — formulaire public et ingestion**
- Route publique `/s/:slugCommune`, sans compte. QR code généré par commune (pour affiches, site, courrier). Formulaire : type (liste de la fiche active, sinon liste générique), localisation (GPS si autorisé, sinon rue + carte), photo (max 2, compressée côté client, max 2 Mo après compression), gravité (information / dégâts / danger de mort), description courte, contact facultatif (téléphone ou e-mail), case de consentement avec mention vie privée (texte paramétrable par commune, contact DPO), honeypot.
- Hors ligne : file d'attente locale (IndexedDB) avec renvoi automatique ; message clair « envoyé » / « en attente de réseau ».
- Ingestion : Edge Function `signal-citoyen` (F8) → table `signalements` (statut `nouveau`), photos dans un bucket privé `signalements` (URL signées), horodatage serveur + heure déclarée.
- Retour : numéro de signalement + lien de suivi avec jeton (pas de compte).
- Entre deux crises : la route affiche « Pas de situation d'urgence en cours » et renvoie vers l'app de signalement quotidien de la commune (lien paramétrable, type BetterStreet), sauf si la commune active la « veille permanente ».

**Tranche 2b — carte et tri pour le CC**
- Vue CC : carte (réutiliser la lib existante) avec clusters par gravité, liste triable et filtrable (type, statut, secteur, heure), fiche de détail avec photos.
- Dédoublonnage : même type à moins de 150 m et moins de 30 minutes → même grappe (`grappe_id`), compteur visible.
- Tri : « danger de mort » → notification immédiate au CC de garde (F2) et mise en avant permanente jusqu'à prise en charge.
- Statuts : nouveau → pris en charge (par qui : discipline / ressource / agent) → clos, ou spam. Chaque changement : entrée légère au journal (F5).
- Temps réel : apparition en moins de 5 secondes sur la carte du CC (Supabase Realtime).

**Tranche 2c — boucle de retour et offres d'aide**
- Page de suivi par jeton : statut, heure de prise en charge, message court de la commune (optionnel). Notification e-mail/SMS si contact fourni et si le canal existe déjà dans `diffuser-alerte`.
- Type « offre d'aide » (pompe, tracteur, hébergement, bras) → crée une ressource temporaire (`ressources_temporaires`, rattachée plus tard à la mutuelle C7) visible dans la liste des ressources du CC, avec contact et disponibilité.

**Tranche 2d — déclaration de dégâts post-crise**
- Mode activé par la commune pour N jours après la levée de phase : même route, champs adaptés (adresse, nature des dégâts, assuré oui/non, photos, date). Aucune gestion juridique : c'est un inventaire.
- Export CSV et liste imprimable (F4) pour le dossier Fonds des calamités et pour la commission communale de constat des dégâts aux cultures ; compteur et carte des déclarations.
- Rappel automatique du délai de dépôt (paramétré par la commune, voir fiche A : 21 jours ouvrables à vérifier).

**RGPD** : minimisation ; rétention paramétrable (défaut : champs de contact 90 jours, photos 12 mois, statistiques anonymisées conservées) avec job de purge (F3) ; IP hachée, rétention 7 jours ; mentions d'information sur le formulaire ; pas de compte citoyen.

**Mode dégradé** : la file locale côté citoyen ; côté CC, liste imprimable des signalements ouverts (route print) et tableau vierge du pack papier (C4).

**Critères d'acceptation**
- [ ] Parcours mobile de bout en bout : envoi depuis un téléphone (viewport mobile) → visible sur la carte du CC en < 5 s → statut modifié → visible sur la page de suivi.
- [ ] Limitation de débit et honeypot vérifiés par test ; photo > limite refusée proprement ; MIME non image refusé.
- [ ] Dédoublonnage vérifié sur fixture (5 signalements → 2 grappes).
- [ ] « Danger de mort » notifie le CC de garde et reste en tête.
- [ ] Offre d'aide → ressource temporaire visible.
- [ ] Mode dégâts : export CSV conforme et liste imprimable.
- [ ] Job de purge testé ; aucune donnée personnelle dans les logs d'Edge Function.
- [ ] Tous les libellés et listes de types éditables via CRUD.

**Estimation** : 5 à 6 sessions (2a : 2, 2b : 2, 2c : 1, 2d : 1).
