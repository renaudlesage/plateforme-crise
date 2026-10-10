// Source unique du menu Admin : utilisée par la barre latérale (MisEnPage)
// et par le tableau de bord, pour qu'ils ne divergent jamais.

export const SECTIONS = [
  {
    titre: null,
    liens: [
      { to: '/', libelle: 'Tableau de bord' },
      { to: '/carte', libelle: 'Carte' },
    ],
  },
  {
    titre: 'Configuration',
    resume: "Rôles, niveaux d'escalade, comptes et disciplines actives.",
    liens: [
      { to: '/configuration', libelle: 'Rôles, niveaux, disciplines' },
      { to: '/comptes', libelle: 'Comptes' },
    ],
  },
  {
    titre: 'Plan légal',
    resume: "Plans d'urgence (PGUI/PPUI) et plans hospitaliers.",
    liens: [
      { to: '/plans-urgence', libelle: "Plans d'urgence (PGUI/PPUI)" },
      { to: '/hopitaux', libelle: 'Hôpitaux (PUH)' },
    ],
  },
  {
    titre: 'Référentiels',
    resume: "Annuaire, risques, ressources, sites, centres et canaux.",
    liens: [
      { to: '/annuaire', libelle: 'Annuaire' },
      { to: '/risques', libelle: 'Objets à risque' },
      { to: '/ressources', libelle: 'Ressources' },
      { to: '/conventions', libelle: 'Conventions' },
      { to: '/sites-qg', libelle: 'Sites du Comité de Coordination' },
      { to: '/centres-accueil', libelle: "Centres d'accueil" },
      { to: '/canaux-radio', libelle: 'Canaux radio' },
      { to: '/plans-reference', libelle: 'Plans de référence' },
      { to: '/centres-crise', libelle: 'Centres de crise' },
      { to: '/dir-pc-ops-attestes', libelle: 'Dir PC-Ops attestés' },
    ],
  },
  {
    titre: 'Gouvernance',
    resume: "Instances, checklists, exercices et conformité légale.",
    liens: [
      { to: '/instances-coordination', libelle: 'Instances' },
      { to: '/checklists', libelle: 'Checklists' },
      { to: '/exercices', libelle: 'Exercices' },
      { to: '/conformite-legale', libelle: 'Conformité légale (AR 2019)' },
      { to: '/formation-stress-aigu', libelle: 'Facteur humain — stress aigu' },
      { to: '/formations-cbrn', libelle: 'Formations CBRN' },
      { to: '/connaissances', libelle: 'Connaissances & veille' },
    ],
  },
  {
    titre: 'Anticipation',
    resume: "Seuils, fonctions et infrastructures critiques, continuité, résilience.",
    liens: [
      { to: '/fonctions-critiques', libelle: 'Fonctions critiques' },
      { to: '/infrastructures-critiques', libelle: 'Infrastructures critiques' },
      { to: '/population-non-residente', libelle: 'Population non résidente' },
      { to: '/seuils-action', libelle: "Seuils d'action" },
      { to: '/seuils-meteo', libelle: 'Seuils météo' },
      { to: '/registre-expertises', libelle: "Registre d'expertises" },
      { to: '/continuite-activite', libelle: "Continuité d'activité (BCM)" },
      { to: '/resilience-territoriale', libelle: 'Résilience territoriale' },
      { to: '/plan-nucleaire', libelle: "Plan d'urgence nucléaire" },
      { to: '/lisiere-incendie', libelle: 'Lisière & incendie' },
    ],
  },
  {
    titre: 'Communication',
    resume: "Alertes publiques, canaux, D5, BE-Alert et soutien psychologique.",
    liens: [
      { to: '/modeles-messages', libelle: 'Messages à la population (modèles)' },
      { to: '/catalogue-messages-alerte', libelle: "Catalogue de messages d'alerte" },
      { to: '/publics-communication', libelle: 'Publics & tests de messages' },
      { to: '/alertes-publiques', libelle: 'Alertes publiques' },
      { to: '/canaux-diffusion', libelle: 'Canaux de diffusion' },
      { to: '/soutien-psychologique', libelle: 'Soutien psychologique' },
      { to: '/checklist-d5', libelle: 'Checklist D5' },
      { to: '/be-alert-tests', libelle: 'Tests BE-Alert' },
      { to: '/fiches-action-d5', libelle: 'Fiches d\'action D5' },
      { to: '/accords-medias', libelle: 'Accords-cadres médias' },
      { to: '/sources-externes-alertes', libelle: "Sources externes d'alertes" },
    ],
  },
]

// Sections visibles selon le contexte : Conformité CER pour les entités
// critiques, Plateforme pour le super-admin.
export function sectionsDuMenu({ typeContexte, estSuperAdmin }) {
  let sections =
    typeContexte === 'entite_critique'
      ? [
          ...SECTIONS,
          {
            titre: 'Conformité',
            resume: 'Conformité CER des entités critiques.',
            liens: [{ to: '/conformite-cer', libelle: 'Conformité CER' }],
          },
        ]
      : SECTIONS
  if (estSuperAdmin) {
    sections = [
      { titre: 'Plateforme', resume: 'Gestion des clients.', liens: [{ to: '/clients', libelle: 'Clients' }] },
      ...sections,
    ]
  }
  return sections
}
