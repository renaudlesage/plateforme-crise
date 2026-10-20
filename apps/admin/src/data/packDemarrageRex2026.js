// Pack de démarrage — fiches scénario dérivées des REX belges de 2026.
//
// Même format que PACK_DEMARRAGE_RISQUES (colonnes de objets_a_risque), avec
// deux listes rattachées, insérées à l'import et éditables ensuite :
//   - `seuils`      → seuils_action (page « Seuils d'action »)
//   - `plan_action` → plans_action_risque (plan d'action de la fiche)
// Les paramètres propres à une commune (N habitations, délais, lieux, liens)
// restent entre crochets dans le texte : à remplacer dans les formulaires.
// Sources, injects détaillés et correspondance contenu → champs :
// packDemarrageRex2026.md.

const lignes = (...l) => l.join('\n')

export const FICHES_REX_2026 = [
  // ============================================================
  // FICHE A — Orages éclair, ruissellement et coulées de boue
  // REX orages des 30–31 mai 2026 (Wallonie)
  // ============================================================
  {
    code: 'STARTER-REX-2026-ORAGES',
    categorie: 'naturel',
    type_risque: 'orages_ruissellement_coulees_boue',
    identification: 'Orages éclair, inondations par ruissellement et coulées de boue (REX 30 mai 2026)',
    declencheur: "Avertissement orange ou rouge IRM « orages » (S1), ou ≥ 3 signalements citoyens concordants de ruissellement ou de coulée de boue (S2).",
    effets_directs: lignes(
      "Pluies stationnaires très localisées (40 l/m² ou plus en une heure ; 50 à 100 mm en peu de temps), grêle, rafales jusqu'à 90 km/h. Petits cours d'eau qui débordent, coulées de boue en aval des champs, caves et rez-de-chaussée inondés par centaines, routes coupées (passages sous voie, gués), personnes bloquées en voiture ou réfugiées sur les toits, arbres sur les voies et les véhicules.",
      "",
      "REX 30–31 mai 2026 : avertissement orange IRM pour toute la Wallonie en fin d'après-midi. Dyle hors de son lit à Court-Saint-Etienne, Thyle en crue à Villers-la-Ville ; habitants sur les toits en Basse-Sambre (Sambreville, Jemeppe-sur-Sambre) ; un décès à La Hulpe (arbre sur une voiture) ; ring extérieur coupé à Ophain, N98 à Keumiée ; les sept casernes de la zone de secours Wapi mobilisées (Tournai) ; Huy et son bassin parmi les premières communes sinistrées. Phase provinciale en Brabant wallon, levée le 31 mai à 02h15 alors que les communes intervenaient encore. Séquence orageuse la plus destructrice depuis 2021.",
    ),
    effets_cascade: lignes(
      "Saturation de la zone de secours par des dizaines d'appels simultanés ; eau potable coupée ou impropre (réseau touché) ; coupures d'électricité ; pollution par hydrocarbures et mazout de caves ; boues et encombrants à évacuer ; réactivation du traumatisme de 2021 chez les sinistrés (dimension D2 dès J+1) ; nouvelle vague orageuse possible dans les jours suivants (REX : nouvelle alerte le mardi).",
      "",
      "Qualification : situation d'urgence collective, dominante D1 + D4, forte composante D5 et D2 (post-crise). Phases : phase 1 → phase communale ; phase provinciale si plusieurs communes sont touchées ou la zone de secours saturée.",
      "Durées de référence : aléa 2 à 8 h ; gestion aiguë 24 à 48 h ; post-crise 3 à 8 semaines.",
      "",
      "Post-crise :",
      "• J0 à J+2 : pompage résiduel, déblaiement des boues, consignes eau potable de l'intercommunale, sécurité électrique des caves, encombrants.",
      "• J+1 : message « sinistres » (photos avant nettoyage, déclaration à l'assureur d'abord) ; recenser les non-assurés.",
      "• Fonds des calamités : dossiers dans les 21 jours ouvrables (point de départ du délai à vérifier dans la réglementation en vigueur) ; dossier communal (voiries, ouvrages) ; commission communale de constat des dégâts aux cultures.",
      "• D2 : visites aux personnes âgées et isolées, accompagnement psychosocial.",
      "• Travaux : curage, réparation des voiries, revue des points noirs ; aménagements anti-ruissellement (fascines, bandes enherbées) avec les agriculteurs.",
      "• REX communal à J+30 : heure de réception de l'alerte, premier signal citoyen, délais de décision (journal) ; mise à jour de la fiche et des seuils.",
    ),
    signaux_faibles: lignes(
      "• Avertissements IRM « orages » jaune / orange / rouge. Un avertissement orages n'est pas un avertissement inondation : écouter les deux.",
      "• Un avertissement « toute la Wallonie » annonce des dégâts, pas où. Le premier signal localisé vient du terrain (riverains, pompiers) : REX Huy, alors que le CORTEX s'était réuni le 28 mai.",
      "• Cartographies SPW : axes de ruissellement concentré et zones à risque (ERRUISSOL / LIDAXES), aléa d'inondation.",
      "• Points noirs connus de la commune : passages sous voie, avaloirs, ponceaux, talus, gués.",
      "• État des sols : saturés par les pluies des jours précédents, ou nus après les semis (mai–juin).",
      "• Historique communal des zones inondées (2016, 2018, 2021, 30 mai 2026).",
      "• Fenêtre typique : fin d'après-midi, soirée, nuit, souvent le week-end → obscurité et équipes réduites.",
    ),
    mesures_preventives: lignes(
      "Avant la saison (mai à septembre) :",
      "• Cadastrer les ressources (page Ressources) : pompes (immersion, vide-cave, grande capacité), sacs de sable, sable, big bags, barrières Nadar et signalisation « route inondée », tracteurs avec chargeur frontal, mini-pelles, camions pour les boues, hydrocureuse, tronçonneuses, éclairage mobile, groupes électrogènes, tonne à eau potable, bâches, conteneurs à encombrants, locaux de stockage secs.",
      "• Pré-identifier dans la mutuelle de résilience (Entraide) : agriculteurs, entrepreneurs de travaux, services travaux communal et voisins, intercommunale d'eau (SWDE, CILE…), intercommunale déchets, gestionnaire de réseau électrique (ORES, RESA), Croix-Rouge ; Protection civile via D4.",
      "• Curer les avaloirs et grilles des points noirs ; reporter les axes de ruissellement sur la carte communale.",
      "• Préparer un centre d'accueil de petit effectif (dizaines de personnes, quelques heures à deux nuits) : local chauffé, boissons chaudes, vêtements secs, couvertures, recharge de téléphones, animaux acceptés, registre des présents, information assurances. Variante : point de distribution d'eau potable (bouteilles, tonne à eau).",
      "• Signal citoyen ascendant — types à proposer : route inondée ou coupée ; coulée de boue ; cave ou rez-de-chaussée inondé ; personne bloquée ou en danger ; arbre ou ligne tombé ; pollution (hydrocarbures, mazout) ; coupure d'eau ou eau trouble ; coupure d'électricité ; besoin matériel (pompe, sacs) ; offre d'aide (pompe, tracteur, hébergement). Champs : localisation, photo, heure, gravité (information / dégâts / danger de mort), contact facultatif, statut (nouveau / pris en charge / clos). Règles : dédoublonner par rue ; « danger de mort » remonte immédiatement au CC et à la zone de secours ; les offres d'aide alimentent la mutuelle comme ressources temporaires.",
    ),
    mesures_compensatoires: lignes(
      "Rôles par discipline :",
      "• D1 : pompage, sauvetages (personnes sur les toits), sécurisation des arbres et des lignes ; priorité aux vies humaines sur les biens dès la saturation.",
      "• D2 : blessés, personnes isolées ou vulnérables (registre communal), psychosocial dès J+1, hygiène (eau non potable, boues).",
      "• D3 : fermeture et balisage des routes, régulation, protection des biens évacués, recherche de personnes.",
      "• D4 : pompes de grande capacité, hydrocureuses, engins de déblaiement, sacs de sable, éclairage, tonnes à eau potable, groupes électrogènes (Protection civile, travaux).",
      "• D5 : le bourgmestre est porte-parole ; Be-Alert, site communal, réseaux sociaux, affichage, porte-à-porte dans les rues coupées, presse locale.",
      "",
      "Mode dégradé :",
      "• À imprimer dès S1 : cette fiche, la carte des points noirs, les contacts CC / disciplines / mutuelle, un tableau de signalements vierge.",
      "• Sans réseau : radio de la zone de secours ou de la police, estafettes, affichage papier au centre d'accueil et à la maison communale.",
      "• Journal papier horodaté, ressaisi dans Crisiware après coup.",
    ),
    decisions_a_preparer: lignes(
      "Décisions-types à horodater au journal (heure, auteur, décision, motivation, source : signal citoyen n°, intervention, avertissement IRM) : pré-activation ; convocation du CC ; déclenchement et levée de phase ; fermeture et réouverture de routes ; évacuation ; ouverture et fermeture d'un centre d'accueil ; demande de renforts (zone de secours, D4, communes voisines) ; engagement de ressources de la mutuelle ; chaque message public (contenu, canal, heure) ; information au gouverneur ; passation de quart.",
      "",
      "Pièges observés (REX 2026) :",
      "1. Attendre l'appel du CORTEX ou du gouverneur : l'alerte descendante n'arrive pas toujours à temps (Huy). Le seuil S1, c'est l'avertissement orange IRM.",
      "2. Sans signaux ascendants, le CC est aveugle jusqu'à la saturation des pompiers.",
      "3. Démobiliser trop tôt (levée provinciale à 02h15, nouvelle vague le mardi).",
      "4. Oublier le psychosocial et l'eau potable au profit du pompage.",
      "5. Ne pas documenter : sans photos ni journal, les dossiers calamités deviennent des épreuves.",
      "6. Nuit et week-end : prévoir relèves et éclairage.",
      "",
      "Injects d'exercice table-top : 16h00 avertissement orange IRM, que faites-vous dans les 30 minutes ? · 18h40 trois « cave inondée » rue [X], une « coulée de boue » route [Y], une « personne bloquée en voiture » au passage sous voie [Z] · 19h15 la zone de secours annonce 40 interventions en attente et demande vos pompes · 20h30 l'intercommunale signale un risque sur l'eau potable · 21h00 le gouverneur déclenche la phase provinciale · 02h15 levée provinciale, 30 caves encore sous eau chez vous · J+2 un journaliste demande à quelle heure vous avez reçu l'alerte.",
    ),
    messages_publics_predefinis: lignes(
      "M1 Préventif (S1) : « Orages violents attendus dès [heure]. Déplacez les véhicules garés dans [rues connues], montez les objets de valeur des caves, n'empruntez pas les passages sous voie en cas de forte pluie. Infos : [canal]. »",
      "M2 En cours (S2/S3) : « Inondations en cours à [secteurs]. Restez chez vous, ne descendez pas dans une cave inondée (risque électrique), ne traversez jamais une route inondée. Urgence vitale : 112. Dégâts sans danger : signalez-les via [lien]. »",
      "M3 Eau : « L'eau du réseau peut être impropre à la consommation à [secteurs] jusqu'à nouvel ordre. [Consignes de l'intercommunale]. Distribution à [lieu]. »",
      "M4 Centre d'accueil : « Centre d'accueil ouvert à [lieu]. Emportez médicaments, papiers, chargeur. Animaux acceptés. »",
      "M5 Post-crise : « Photographiez les dégâts avant de nettoyer et déclarez-les à votre assureur. Encombrants : [modalités]. Fonds des calamités : [lien, délai]. »",
      "Principes : qui gère la phase communique ; un seul porte-parole ; pas d'attribution de causes à chaud.",
    ),
    seuils: [
      {
        ordre: 1,
        libelle: 'Orages S0 — Veille',
        seuil_description: "Avertissement jaune IRM « orages », ou prévision de cumuls > [20] l/m²/h en saison à risque.",
        action: lignes(
          "• Vérifier la disponibilité du CPU et de son suppléant.",
          "• Contrôler le cadastre des ressources (pompes, sacs, tracteurs).",
          "• Vérifier que les listes Be-Alert sont à jour.",
          "• Tournée des points noirs (avaloirs, grilles, passages sous voie) par le service travaux.",
          "• Pré-alerter les agriculteurs et entrepreneurs de la mutuelle.",
          "Qui : CPU, service travaux. Délai cible : [J-1 à H-6].",
        ),
        action_degradee: "Tournée et pré-alerte par téléphone avec la liste imprimée des contacts.",
      },
      {
        ordre: 2,
        libelle: 'Orages S1 — Pré-activation',
        seuil_description: "Avertissement orange ou rouge IRM « orages ». Ne pas attendre l'appel du CORTEX ou du gouverneur.",
        action: lignes(
          "• Ouvrir l'événement dans Crisiware.",
          "• Imprimer la fiche et la carte des points noirs (mode dégradé).",
          "• Bourgmestre, CPU, officier de la zone de secours et police joignables en astreinte (CC non convoqué).",
          "• Pré-positionner sacs de sable et barrières aux points noirs.",
          "• Diffuser le message préventif M1 (D5).",
          "• Prévenir les établissements sensibles : maisons de repos, crèches, écoles, campings.",
          "• Vérifier les groupes électrogènes.",
          "Qui : bourgmestre, CPU. Délai cible : [H-3 à H0].",
        ),
        action_degradee: "Kit papier (fiche, carte, contacts) ; message M1 par affichage et relais locaux si les canaux numériques tombent.",
      },
      {
        ordre: 3,
        libelle: 'Orages S2 — Premiers signaux',
        seuil_description: "≥ [3] signalements citoyens concordants et géolocalisés (route coupée, coulée de boue, cave inondée), OU première intervention de la zone de secours sur le territoire.",
        action: lignes(
          "• Convoquer le CC communal (physique ou à distance).",
          "• Activer la carte de situation (signaux citoyens + interventions) ; trier par gravité.",
          "• Décider phase communale oui / non et le tracer au journal.",
          "• Fermer les routes dangereuses (passages sous voie, gués) avec D3.",
          "• Engager les ressources de la mutuelle (pompes, tracteurs).",
          "• Diffuser le message M2 (D5).",
          "Qui : bourgmestre. Délai cible : ≤ [30] min après le premier signal.",
        ),
        action_degradee: "Tableau de signalements papier tenu au CC ; liaison radio avec la zone de secours et la police.",
      },
      {
        ordre: 4,
        libelle: 'Orages S3 — Phase communale',
        seuil_description: "Personnes bloquées ou en danger, hameau isolé, plus de [N] habitations inondées, eau potable impactée, ou zone de secours saturée.",
        action: lignes(
          "• Déclencher la phase communale (tracer).",
          "• Informer le gouverneur (Paragon) et les communes voisines.",
          "• Demander D4 (Protection civile).",
          "• Ouvrir un centre d'accueil ; activer la distribution d'eau si nécessaire.",
          "• Diffuser les messages M2, M3, M4 (D5).",
          "• Organiser les relèves de nuit.",
          "Qui : bourgmestre, CC. Délai cible : immédiat.",
        ),
        action_degradee: "Information du gouverneur par téléphone ou radio si Paragon est inaccessible ; affichage papier au centre d'accueil.",
      },
      {
        ordre: 5,
        libelle: 'Orages S4 — Multi-communes',
        seuil_description: "Phase provinciale déclenchée par le gouverneur.",
        action: lignes(
          "• Le CC communal continue sous coordination provinciale.",
          "• Maintenir l'image de situation locale ; remontées régulières vers la province.",
          "• Ne pas démobiliser à la levée provinciale si les interventions communales continuent (REX : levée en Brabant wallon à 02h15, communes encore au travail).",
          "Qui : CC. Délai cible : continu.",
        ),
        action_degradee: "Remontées par estafette ou radio à heures fixes convenues avec la province.",
      },
      {
        ordre: 6,
        libelle: 'Orages S5 — Décrue',
        seuil_description: "Fin de l'aléa, plus de personnes en danger, routes principales rouvertes.",
        action: lignes(
          "• Vérifier la prévision des jours suivants avant de démobiliser (REX : nouvelle vague le mardi).",
          "• Lever la phase (tracer).",
          "• Basculer en post-crise ; diffuser le message M5 (D5).",
          "• Planifier le REX à J+30.",
          "Qui : bourgmestre.",
        ),
        action_degradee: "Ressaisir le journal papier dans Crisiware avant de clôturer.",
      },
    ],
    plan_action: [
      "Cadastrer avant mai les ressources anti-ruissellement (pompes, sacs, barrières, tracteurs, hydrocureuse, éclairage, groupes, tonne à eau).",
      "Pré-identifier dans la mutuelle les agriculteurs, entrepreneurs, services travaux voisins, intercommunales (eau, déchets) et ORES / RESA.",
      "Reporter sur la carte les axes de ruissellement (ERRUISSOL / LIDAXES) et les points noirs communaux.",
      "Fixer pour la commune le N habitations inondées et les délais des seuils S0 à S3.",
      "Désigner un centre d'accueil de petit effectif (chauffé, animaux acceptés) et un point de distribution d'eau.",
      "Vérifier les listes Be-Alert et les contacts CC / disciplines / mutuelle.",
      "Imprimer le kit mode dégradé : fiche, carte des points noirs, contacts, tableau de signalements vierge.",
      "Exercice table-top annuel avec les injects de la fiche.",
      "Après chaque épisode : REX communal à J+30 et mise à jour de la fiche et des seuils.",
    ],
  },
]
