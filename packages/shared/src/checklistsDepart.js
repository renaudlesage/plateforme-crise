/**
 * Checklists de départ par profil de terrain — MODÈLES À VALIDER.
 *
 * Elles ne décrivent QUE ce qu'on fait dans l'application (ouvrir un outil, déclarer un chiffre, traiter une
 * demande). Aucune doctrine d'intervention n'y est inventée : ce qu'un directeur de discipline doit faire sur le
 * terrain relève de son plan, de sa zone de secours et de ses experts. L'administrateur les relit, les corrige
 * ou les remplace dans Checklists types.
 */
export const DECLENCHEUR_MODELE_DEPART = 'Modèle de départ — à valider'

const RAPPORT = 'Transmettre mon rapport C.A.N. au CC (onglet Rapport)'
const DEMANDES = 'Traiter les demandes qui me sont adressées (haut de mon onglet)'
const MOYENS = 'Contrôler l’état de mes moyens engagés, signaler ceux à relever'

export const CHECKLISTS_DEPART = {
  pc_ops: [
    'Traiter les demandes adressées au Dir PC-Ops (onglet Commandement)',
    'Passer en revue les zones d’intervention et les réquisitions demandées',
    'Vérifier que les comptages de personnes sont à jour',
    'Contrôler la fraîcheur des données affichées (bandeau en haut de l’écran)',
    'Préparer la fiche de passation avant toute relève (onglet Passation)',
  ],
  si: [DEMANDES, 'Établir ou ajuster les zones d’intervention (le périmètre relève du Dir-Si)', MOYENS, RAPPORT],
  med: [
    DEMANDES,
    'Déclarer le triage au PMA (U0 à U3) à chaque changement notable',
    'Déclarer les personnes dirigées vers chaque hôpital, après avoir confirmé sa capacité par téléphone',
    MOYENS,
    RAPPORT,
  ],
  pol: [
    DEMANDES,
    'Signaler les routes coupées et les accès sur la carte',
    'Déclarer les personnes évacuées et celles qui sont introuvables',
    MOYENS,
    RAPPORT,
  ],
  log: [
    DEMANDES,
    'Consulter les centres d’accueil et ressources ; confirmer leur disponibilité auprès du gestionnaire avant de les engager',
    'Déclarer les personnes accueillies',
    MOYENS,
    RAPPORT,
  ],
  info: [
    DEMANDES,
    'Relire les messages déjà publiés avant d’en proposer un nouveau',
    'Consulter le volume de signalements citoyens',
    'Proposer au CC le message à diffuser (rien n’est publié depuis le terrain)',
    RAPPORT,
  ],
}
