// Entraide : bénévoles spontanés, équipes, missions, moyens privés, dons.
// Vocabulaire partagé par les quatre apps ; la base reste la source des règles (triggers, RLS).

export const MODES_COORDINATION = [
  { valeur: 'aucun', libelle: 'Aucun (volet fermé)' },
  { valeur: 'd4', libelle: 'D4 · logistique' },
  { valeur: 'personne', libelle: 'Une personne désignée' },
]

export const STATUTS_PRESENCE = [
  { valeur: 'enregistre', libelle: 'Enregistré', aide: 'À valider au point d’accueil', classe: 'text-sourdine' },
  { valeur: 'valide', libelle: 'Disponible', aide: 'Validé, sans équipe', classe: 'text-ok' },
  { valeur: 'affecte', libelle: 'Affecté', aide: 'Dans une équipe', classe: 'text-encre' },
  { valeur: 'en_repos', libelle: 'En repos', aide: 'Validé, en pause', classe: 'text-veille' },
  { valeur: 'sorti', libelle: 'Sorti', aide: 'A quitté le dispositif', classe: 'text-sourdine' },
  { valeur: 'refuse', libelle: 'Refusé', aide: 'Non admis', classe: 'text-chaud' },
]

export const STATUTS_EQUIPE = [
  { valeur: 'constituee', libelle: 'Constituée' },
  { valeur: 'engagee', libelle: 'Engagée' },
  { valeur: 'repos', libelle: 'Au repos' },
  { valeur: 'dissoute', libelle: 'Dissoute' },
]

export const STATUTS_MISSION = [
  { valeur: 'ouverte', libelle: 'Ouverte', classe: 'text-veille' },
  { valeur: 'affectee', libelle: 'Affectée', classe: 'text-encre' },
  { valeur: 'en_cours', libelle: 'En cours', classe: 'text-ok' },
  { valeur: 'close', libelle: 'Close', classe: 'text-sourdine' },
  { valeur: 'annulee', libelle: 'Annulée', classe: 'text-sourdine' },
  { valeur: 'refusee', libelle: 'Refusée', classe: 'text-chaud' },
]

export const PRIORITES_MISSION = [
  { valeur: 'P1', libelle: 'P1 · vital / sécurité', classe: 'text-chaud' },
  { valeur: 'P2', libelle: 'P2 · urgent', classe: 'text-veille' },
  { valeur: 'P3', libelle: 'P3 · normal', classe: 'text-encre' },
  { valeur: 'P4', libelle: 'P4 · quand possible', classe: 'text-sourdine' },
]

export const COMPETENCES_ENTRAIDE = [
  { valeur: 'bras', libelle: 'Bras disponibles' },
  { valeur: 'permis_b', libelle: 'Permis B' },
  { valeur: 'permis_c', libelle: 'Permis C / poids lourd' },
  { valeur: 'tracteur', libelle: 'Tracteur / engin agricole' },
  { valeur: 'engin_chantier', libelle: 'Engin de chantier' },
  { valeur: 'tronconneuse', libelle: 'Tronçonneuse' },
  { valeur: 'pompe', libelle: 'Pompe / groupe électrogène' },
  { valeur: 'secourisme', libelle: 'Secourisme (brevet)' },
  { valeur: 'soins', libelle: 'Soins (infirmier, médecin)' },
  { valeur: 'cuisine', libelle: 'Cuisine collective' },
  { valeur: 'accueil', libelle: 'Accueil, écoute' },
  { valeur: 'langues', libelle: 'Langues (NL, DE, EN…)' },
  { valeur: 'bateau', libelle: 'Bateau / embarcation' },
  { valeur: 'drone', libelle: 'Drone (pilote)' },
  { valeur: 'radio', libelle: 'Radio / télécoms' },
  { valeur: 'informatique', libelle: 'Informatique' },
]

export const TYPES_INCIDENT_BENEVOLE = [
  { valeur: 'blessure', libelle: 'Blessure' },
  { valeur: 'malaise', libelle: 'Malaise' },
  { valeur: 'accident_materiel', libelle: 'Accident matériel' },
  { valeur: 'comportement', libelle: 'Comportement (refus de consigne, danger)' },
  { valeur: 'autre', libelle: 'Autre' },
]

export const CATEGORIES_BESOIN = [
  { valeur: 'eau_alimentation', libelle: 'Eau, alimentation' },
  { valeur: 'hygiene', libelle: 'Hygiène' },
  { valeur: 'vetements', libelle: 'Vêtements' },
  { valeur: 'materiel_nettoyage', libelle: 'Matériel de nettoyage' },
  { valeur: 'materiel_pompage', libelle: 'Pompage, séchage' },
  { valeur: 'hebergement', libelle: 'Hébergement' },
  { valeur: 'transport', libelle: 'Transport' },
  { valeur: 'outillage', libelle: 'Outillage' },
  { valeur: 'autre', libelle: 'Autre' },
]

export const STATUTS_BESOIN = [
  { valeur: 'ouvert', libelle: 'Nous en avons besoin', classe: 'text-chaud' },
  { valeur: 'couvert', libelle: 'Couvert, merci : n’en apportez plus', classe: 'text-ok' },
  { valeur: 'ferme', libelle: 'Fermé (plus affiché)', classe: 'text-sourdine' },
]

export const TYPES_PROPRIETAIRE = [
  { valeur: 'commune', libelle: 'Commune' },
  { valeur: 'entreprise', libelle: 'Entreprise' },
  { valeur: 'particulier', libelle: 'Particulier' },
  { valeur: 'association', libelle: 'Association' },
  { valeur: 'autre_autorite', libelle: 'Autre autorité publique' },
]

export const STATUTS_JURIDIQUES_MOYEN = [
  { valeur: 'convention_signee', libelle: 'Convention signée', classe: 'text-ok' },
  { valeur: 'accord_oral', libelle: 'Accord oral', classe: 'text-veille' },
  { valeur: 'declaration_proprietaire', libelle: 'Déclaré par le propriétaire (à vérifier)', classe: 'text-sourdine' },
  { valeur: 'requisitionnable', libelle: 'Réquisitionnable', classe: 'text-chaud' },
]

export const CATEGORIES_MOYEN_DECLARABLE = [
  { valeur: 'vehicule', libelle: 'Véhicule (4x4, camionnette, camion)' },
  { valeur: 'transport_personnes', libelle: 'Transport de personnes (car, minibus)' },
  { valeur: 'genie_civil', libelle: 'Engin de chantier, tracteur, pompe' },
  { valeur: 'materiel_divers', libelle: 'Matériel (groupe électrogène, bateau, drone, outillage)' },
  { valeur: 'alimentation', libelle: 'Alimentation, cuisine' },
  { valeur: 'hebergement', libelle: 'Hébergement, salle, hangar' },
  { valeur: 'personnel', libelle: 'Personnel qualifié' },
]

export const ZONES_LIBELLES = { rouge: 'Zone rouge', orange: 'Zone orange', jaune: 'Zone jaune' }

export const MENTION_CONSIGNES_BENEVOLE =
  'Je m’engage à suivre les consignes du chef d’équipe, à ne pas entrer dans une zone interdite, à signaler tout accident et à porter les protections demandées.'

export const MENTION_RGPD_BENEVOLE_DEFAUT =
  'Vos nom, prénom, téléphone et contact d’urgence sont enregistrés par la commune pour organiser l’entraide, assurer votre sécurité et couvrir votre engagement bénévole. Ils ne sont ni publiés ni transmis à des tiers et sont conservés le temps nécessaire à la gestion de la crise et aux obligations légales.'

export const MENTION_MOYEN_PRIVE =
  'Votre déclaration ne vaut pas engagement : la commune vous contactera avant toute mise à disposition. Rien n’est publié.'

const lib = (liste, valeur) => liste.find((e) => e.valeur === valeur)?.libelle ?? valeur ?? ''
export const libelleStatutPresence = (v) => lib(STATUTS_PRESENCE, v)
export const libelleStatutMission = (v) => lib(STATUTS_MISSION, v)
export const libellePriorite = (v) => lib(PRIORITES_MISSION, v)
export const libelleCompetence = (v) => lib(COMPETENCES_ENTRAIDE, v)
export const libelleBesoin = (v) => lib(CATEGORIES_BESOIN, v)
export const libelleStatutJuridique = (v) => lib(STATUTS_JURIDIQUES_MOYEN, v)
export const libelleTypeProprietaire = (v) => lib(TYPES_PROPRIETAIRE, v)
export const classeDe = (liste, valeur) => liste.find((e) => e.valeur === valeur)?.classe ?? ''

/** Compteurs d'accueil à partir des présences d'un incident. */
export function compterPresences(presences = []) {
  const n = (s) => presences.filter((p) => p.statut === s).length
  return {
    enregistres: n('enregistre'),
    disponibles: n('valide'),
    affectes: n('affecte'),
    enRepos: n('en_repos'),
    sortis: n('sorti'),
    refuses: n('refuse'),
    presents: presences.filter((p) => ['valide', 'affecte', 'en_repos'].includes(p.statut)).length,
    sortiesDemandees: presences.filter((p) => p.sortie_demandee_le && !['sorti', 'refuse'].includes(p.statut)).length,
  }
}

/** Tri des missions : ouvertes d'abord par priorité, puis affectées/en cours, puis le reste par date. */
const RANG_STATUT = { ouverte: 0, affectee: 1, en_cours: 1, refusee: 2, close: 3, annulee: 3 }
export function trierMissions(missions = []) {
  return [...missions].sort((a, b) => {
    const r = (RANG_STATUT[a.statut] ?? 9) - (RANG_STATUT[b.statut] ?? 9)
    if (r !== 0) return r
    if (a.priorite !== b.priorite) return a.priorite < b.priorite ? -1 : 1
    return String(a.created_at).localeCompare(String(b.created_at))
  })
}

/** Alertes d'un volet entraide : missions P1 ouvertes trop longtemps, équipes à relever, sorties demandées. */
export function alertesEntraide({ missions = [], equipesARelever = [], presences = [], maintenant = Date.now(), delaiP1Minutes = 30 }) {
  const alertes = []
  const p1 = missions.filter((m) => m.statut === 'ouverte' && m.priorite === 'P1' && maintenant - new Date(m.created_at).getTime() > delaiP1Minutes * 60000)
  if (p1.length) alertes.push({ cle: 'p1', niveau: 'chaud', texte: `${p1.length} mission${p1.length > 1 ? 's' : ''} P1 sans équipe depuis plus de ${delaiP1Minutes} min` })
  if (equipesARelever.length) alertes.push({ cle: 'releve', niveau: 'veille', texte: `${equipesARelever.length} équipe${equipesARelever.length > 1 ? 's' : ''} à relever (durée d’engagement dépassée)` })
  const sorties = presences.filter((p) => p.sortie_demandee_le && !['sorti', 'refuse'].includes(p.statut)).length
  if (sorties) alertes.push({ cle: 'sorties', niveau: 'info', texte: `${sorties} demande${sorties > 1 ? 's' : ''} de sortie à confirmer` })
  const rouges = missions.filter((m) => m.statut === 'refusee' && m.type_zone === 'rouge')
  if (rouges.length) alertes.push({ cle: 'rouge', niveau: 'info', texte: `${rouges.length} mission${rouges.length > 1 ? 's' : ''} en zone rouge refusée${rouges.length > 1 ? 's' : ''} (dérogation du Dir PC-Ops possible)` })
  return alertes
}

/** Distance approximative en km entre deux points (haversine). */
export function distanceKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => v == null || Number.isNaN(Number(v)))) return null
  const r = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(a))
}

/** Lien d'accueil par QR (app Citoyen). */
export const lienAccueilBenevole = (base, jeton) => `${String(base).replace(/\/$/, '')}/entraide/accueil?j=${jeton}`
export const lienSuiviBenevole = (base, jeton) => `${String(base).replace(/\/$/, '')}/entraide/suivi?j=${jeton}`

/** Message d'erreur lisible pour les codes renvoyés par les RPC de l'entraide. */
export function messageErreurEntraide(e) {
  const code = e?.code ?? ''
  const msg = e?.message ?? ''
  if (code === 'P0002' || /inconnu/i.test(msg)) return 'Ce QR code n’est pas reconnu. Demandez un nouveau lien au point d’accueil.'
  if (code === 'P0010' || /fermé/i.test(msg)) return 'Ce point d’accueil est fermé pour le moment. Adressez-vous à l’agent sur place.'
  if (code === 'P0005') return msg
  if (code === 'P0006') return 'Les consignes de sécurité doivent être acceptées.'
  if (code === 'P0007') return 'Nom et prénom sont obligatoires.'
  if (code === 'P0008') return 'Type de propriétaire inconnu.'
  if (code === '42501' || /row-level security|permission denied|droits/i.test(msg)) return 'Action refusée : vos droits ne le permettent pas.'
  return msg || 'Une erreur est survenue.'
}
