// Classes d'urgence du Plan d'urgence nucléaire et radiologique pour le
// territoire belge (NCCN / AFCN, version de juin 2024). Les textes d'aide
// résument ce que le plan prévoit à chaque classe ; ils ne remplacent pas le plan.
export const CLASSES_URGENCE_NUCLEAIRE = [
  {
    valeur: 'alert',
    libelle: 'Alert',
    aide: "Déclaration seulement, pas d'activation du plan.",
  },
  {
    valeur: 'facility_emergency',
    libelle: 'Facility emergency',
    aide: "Événement limité à l'installation.",
  },
  {
    valeur: 'site_area_emergency',
    libelle: 'Site area emergency',
    aide: "Dès cette classe, le gouverneur fait avertir, mettre à l'abri et mettre à l'écoute le bloc S.",
  },
  {
    valeur: 'general_emergency',
    libelle: 'General emergency',
    aide: "Rejet possible ou en cours : actions de protection fixées pendant la crise (zones d'actions de protection).",
  },
  {
    valeur: 'general_emergency_reflex',
    libelle: 'General emergency – Reflex mode',
    aide: "Mode réflexe : la zone réflexe (bloc S + couronne X) est avertie et mise à l'abri avant même la mise en place des cellules de crise.",
  },
]

export const ACTIONS_PROTECTION = [
  { valeur: 'mise_a_l_abri', libelle: "Mise à l'abri" },
  { valeur: 'iode_predistribue', libelle: 'Iode' },
  { valeur: 'evacuation', libelle: 'Évacuation' },
]

export function libelleClasseUrgence(valeur) {
  return CLASSES_URGENCE_NUCLEAIRE.find((c) => c.valeur === valeur)?.libelle ?? valeur
}
