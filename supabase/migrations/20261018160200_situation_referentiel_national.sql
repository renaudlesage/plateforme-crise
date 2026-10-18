-- Référentiel national de départ de la page CC › Situation : 42 sources (contexte_id NULL), reprises de la maquette publiée
-- (artefact « Situation sociétale », 18/10/2026) : catégories, noms, types, portées, adresses et notes « à regarder ».
--
-- À savoir :
--   * Les adresses sont des points d'entrée connus. Six ont été contrôlées le 18/10/2026 (controle_le renseigné, avec le
--     résultat) ; les 36 autres ne l'ont pas été (controle_le NULL) et restent à contrôler dans Admin › Situation.
--   * Avertissement posé sur telerad : panne technique des données signalée par l'AFCN au contrôle du 18/10/2026.
--   * aleas_lies : hydro, irm, windy → inondation ; bealert, crisis → inondation + « tous » ; effis → feu de forêt ;
--     telerad, afcn, rn → nucléaire (briefing). Ajouts de cette migration, modifiables dans Admin : infrabel, sncb →
--     ferroviaire ; emsc, gdacs → séisme ; « tous » pour bealert et crisis (repli quand l'aléa n'a pas de source dédiée).
--   * suggeree = sources épinglées par défaut dans la maquette (bel20, euronews, rtbf, trafiroutes, hydro, bealert, crisis, telerad).
--   * Idempotent : une source nationale dont le code existe déjà n'est pas réinsérée.

insert into public.sources_situation (contexte_id, code, categorie, nom, url, type_source, portee, note, avertissement, aleas_lies, suggeree, ordre_affichage, controle_le, controle_note)
select null, v.* from (values
  ('bel20', 'marches', 'BEL 20', 'https://finance.yahoo.com/quote/%5EBFX', 'donnees', 'BE', 'Indice des 20 grandes valeurs de Bruxelles. Regarder l''écart du jour et le volume.', null, '{}'::text[], true, 10, null, null),
  ('cac40', 'marches', 'CAC 40', 'https://finance.yahoo.com/quote/%5EFCHI', 'donnees', 'FR', 'Référence voisine ; les chocs y sont souvent plus vite lisibles.', null, '{}'::text[], false, 20, null, null),
  ('dax', 'marches', 'DAX', 'https://finance.yahoo.com/quote/%5EGDAXI', 'donnees', 'DE', 'Indice allemand, très sensible aux prix de l''énergie.', null, '{}'::text[], false, 30, null, null),
  ('brent', 'marches', 'Pétrole Brent', 'https://finance.yahoo.com/quote/BZ%3DF', 'donnees', 'Monde', 'Prix du baril : hausse brutale = tension sur carburants et transports.', null, '{}'::text[], false, 40, null, null),
  ('ttf', 'marches', 'Gaz TTF', 'https://finance.yahoo.com/quote/TTF%3DF', 'donnees', 'Europe', 'Référence européenne du gaz, directement liée aux factures et au chauffage.', null, '{}'::text[], false, 50, null, null),
  ('eurusd', 'marches', 'EUR / USD', 'https://finance.yahoo.com/quote/EURUSD%3DX', 'donnees', 'Monde', 'Taux de change, indicateur de stress financier global.', null, '{}'::text[], false, 60, null, null),
  ('euronext', 'marches', 'Euronext Live', 'https://live.euronext.com', 'officiel', 'BE', 'Portail officiel de la Bourse : cours, suspensions de cotation, communiqués.', null, '{}'::text[], false, 70, null, null),
  ('elia', 'marches', 'Elia — réseau électrique', 'https://www.elia.be', 'donnees', 'BE', 'Gestionnaire du réseau à haute tension : charge, production et alertes d''approvisionnement.', null, '{}'::text[], false, 80, null, null),
  ('euronews', 'medias', 'Euronews en direct', 'https://www.euronews.com/live', 'video', 'Europe', 'Chaîne d''information européenne, plusieurs langues.', null, '{}'::text[], true, 10, date '2026-10-18', 'Adresse contrôlée le 18/10/2026.'),
  ('france24', 'medias', 'France 24 en direct', 'https://www.france24.com/fr/direct', 'video', 'Monde', 'Info continue en français.', null, '{}'::text[], false, 20, date '2026-10-18', 'Adresse contrôlée le 18/10/2026 : accès refusé aux robots lors du test automatique (à revérifier dans un navigateur).'),
  ('aljazeera', 'medias', 'Al Jazeera English', 'https://www.aljazeera.com/live', 'video', 'Monde', 'Regard extérieur à l''Europe sur les mêmes événements.', null, '{}'::text[], false, 30, null, null),
  ('dw', 'medias', 'DW News', 'https://www.dw.com/en/live-tv/channel-english', 'video', 'Europe', 'Chaîne allemande d''information internationale.', null, '{}'::text[], false, 40, null, null),
  ('sky', 'medias', 'Sky News', 'https://news.sky.com/watch-live', 'video', 'UK', 'Direct britannique, réactif sur les urgences.', null, '{}'::text[], false, 50, null, null),
  ('bfm', 'medias', 'BFM TV en direct', 'https://www.bfmtv.com/en-direct/', 'video', 'FR', 'Info continue française : bon indicateur de ce que voit le public francophone.', null, '{}'::text[], false, 60, null, null),
  ('rtbf', 'medias', 'RTBF Info et Auvio', 'https://auvio.rtbf.be', 'video', 'BE', 'Média public francophone belge : directs et journaux.', null, '{}'::text[], true, 70, null, null),
  ('vrt', 'medias', 'VRT NWS', 'https://www.vrt.be/vrtnws', 'presse', 'BE', 'Média public flamand, utile pour les événements en Flandre et à Bruxelles.', null, '{}'::text[], false, 80, null, null),
  ('lesoir', 'medias', 'Le Soir', 'https://www.lesoir.be', 'presse', 'BE', 'Presse quotidienne belge francophone.', null, '{}'::text[], false, 90, null, null),
  ('lalibre', 'medias', 'La Libre', 'https://www.lalibre.be', 'presse', 'BE', 'Presse quotidienne belge francophone.', null, '{}'::text[], false, 100, null, null),
  ('belga', 'medias', 'Belga News Agency', 'https://www.belganewsagency.eu', 'presse', 'BE', 'Agence de presse nationale : dépêches à la source.', null, '{}'::text[], false, 110, null, null),
  ('trafiroutes', 'routes', 'Trafiroutes — Wallonie', 'https://trafiroutes.wallonie.be', 'cameras', 'Wallonie', 'Trafic et caméras du réseau routier wallon (SPW).', null, '{}'::text[], true, 10, date '2026-10-18', 'Adresse contrôlée le 18/10/2026 : réponse vide au test automatique (à revérifier dans un navigateur).'),
  ('vlaams', 'routes', 'Vlaams Verkeerscentrum', 'https://www.verkeerscentrum.be', 'cameras', 'Flandre', 'Situation du trafic et dizaines de caméras publiques en Flandre.', null, '{}'::text[], false, 20, date '2026-10-18', 'Adresse contrôlée le 18/10/2026.'),
  ('infrabel', 'routes', 'Infrabel', 'https://www.infrabel.be', 'officiel', 'BE', 'Gestionnaire du réseau ferré : incidents et travaux.', null, array['ferroviaire']::text[], false, 30, null, null),
  ('sncb', 'routes', 'SNCB — état du trafic', 'https://www.belgiantrain.be', 'officiel', 'BE', 'Perturbations des trains voyageurs.', null, array['ferroviaire']::text[], false, 40, null, null),
  ('stib', 'routes', 'STIB', 'https://www.stib-mivb.be', 'officiel', 'Bruxelles', 'Métro, tram et bus à Bruxelles.', null, '{}'::text[], false, 50, null, null),
  ('bru', 'routes', 'Brussels Airport', 'https://www.brusselsairport.be', 'officiel', 'BE', 'Départs et arrivées : annulations en cascade = signal précoce.', null, '{}'::text[], false, 60, null, null),
  ('windycams', 'webcams', 'Windy Webcams', 'https://www.windy.com/webcams', 'cameras', 'Monde', 'Carte mondiale de webcams publiques, filtrables par zone.', null, '{}'::text[], false, 10, null, null),
  ('skyline', 'webcams', 'SkylineWebcams', 'https://www.skylinewebcams.com', 'cameras', 'Monde', 'Webcams de villes et de sites touristiques.', null, '{}'::text[], false, 20, null, null),
  ('hydro', 'eau', 'Hydrométrie en Wallonie', 'https://hydrometrie.wallonie.be', 'donnees', 'Wallonie', 'Niveaux, débits et pluviométrie des cours d''eau wallons, avec situation de crue. À ouvrir en premier dès qu''il pleut fort.', null, array['inondation']::text[], true, 10, date '2026-10-18', 'Adresse contrôlée le 18/10/2026.'),
  ('irm', 'eau', 'IRM — météo', 'https://www.meteo.be', 'donnees', 'BE', 'Prévisions, alertes et radar de précipitations.', null, array['inondation']::text[], false, 20, null, null),
  ('bealert', 'eau', 'Be-Alert', 'https://www.be-alert.be', 'officiel', 'BE', 'Système d''alerte à la population : voir les alertes en cours.', null, array['inondation','tous']::text[], true, 30, null, null),
  ('crisis', 'eau', 'Centre de crise national', 'https://crisiscentrum.be', 'officiel', 'BE', 'Informations du NCCN sur les situations d''urgence.', null, array['inondation','tous']::text[], true, 40, null, null),
  ('windy', 'eau', 'Windy — vent et pluie', 'https://www.windy.com', 'carte', 'Monde', 'Carte animée vent, pluie, orages.', null, array['inondation']::text[], false, 50, null, null),
  ('gdacs', 'eau', 'GDACS', 'https://www.gdacs.org', 'carte', 'Monde', 'Alertes mondiales ONU/UE sur séismes, cyclones, inondations.', null, array['seisme']::text[], false, 60, null, null),
  ('effis', 'eau', 'EFFIS — feux de forêt', 'https://effis.jrc.ec.europa.eu', 'carte', 'Europe', 'Danger d''incendie et feux actifs en Europe.', null, array['feu_de_foret']::text[], false, 70, null, null),
  ('emsc', 'eau', 'EMSC — séismes', 'https://www.emsc-csem.org', 'carte', 'Monde', 'Séismes en temps quasi réel.', null, array['seisme']::text[], false, 80, null, null),
  ('telerad', 'nucleaire', 'Telerad — radioactivité (AFCN)', 'https://telerad.fgov.be', 'donnees', 'BE', 'Réseau belge de mesure de la radioactivité dans l''environnement.', 'Contrôle du 18/10/2026 : l''AFCN y signalait une panne technique des données. Vérifier avant de s''y fier.', array['nucleaire']::text[], true, 10, date '2026-10-18', 'Adresse contrôlée le 18/10/2026 : l''AFCN y signalait une panne technique des données.'),
  ('afcn', 'nucleaire', 'AFCN / FANC', 'https://fanc.fgov.be', 'officiel', 'BE', 'Agence fédérale de contrôle nucléaire : incidents et communiqués.', null, array['nucleaire']::text[], false, 20, null, null),
  ('rn', 'nucleaire', 'Risque nucléaire — zones de planification', 'https://risquenucleaire.be/fr/que-font-les-autorites/zones-de-planification-durgence', 'officiel', 'BE', 'Rayons d''abri, d''iode et d''évacuation autour des sites.', null, array['nucleaire']::text[], false, 30, null, null),
  ('ocam', 'societe', 'OCAM — niveau de la menace', 'https://ocam.belgium.be', 'officiel', 'BE', 'Niveau de menace terroriste en vigueur.', null, '{}'::text[], false, 10, null, null),
  ('ccb', 'societe', 'Centre pour la Cybersécurité (CCB)', 'https://ccb.belgium.be', 'officiel', 'BE', 'Alertes cyber et incidents touchant les services numériques.', null, '{}'::text[], false, 20, null, null),
  ('sciensano', 'societe', 'Sciensano', 'https://www.sciensano.be', 'officiel', 'BE', 'Surveillance sanitaire : épidémies, qualité de l''air.', null, '{}'::text[], false, 30, null, null),
  ('ecdc', 'societe', 'ECDC', 'https://www.ecdc.europa.eu', 'officiel', 'Europe', 'Centre européen de contrôle des maladies.', null, '{}'::text[], false, 40, null, null)
) as v(code, categorie, nom, url, type_source, portee, note, avertissement, aleas_lies, suggeree, ordre_affichage, controle_le, controle_note)
where not exists (select 1 from public.sources_situation s where s.contexte_id is null and s.code = v.code);
