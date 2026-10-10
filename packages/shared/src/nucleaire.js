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

// Zones de planification autour d'un site (cercles centrés sur le site) : rayons du plan
// de juin 2024. Les blocs réels suivent les frontières communales : ce ne sont que des repères.
export const TYPES_ZONE_PLANIFICATION_NUCLEAIRE = [
  { valeur: 'reflexe', libelle: 'Zone réflexe', couleur: '#c0392b' },
  { valeur: 'evacuation', libelle: 'Évacuation préparée', couleur: '#e67e22' },
  { valeur: 'abri_iode', libelle: 'Mise à l\'abri et iode prédistribué', couleur: '#d4ac0d' },
  { valeur: 'extension_iode', libelle: 'Extension (iode)', couleur: '#7f8c8d' },
]

/** Transforme des lignes `zones_planification_nucleaire` (avec le site joint) en cercles pour CarteCrise. */
export function cerclesZonesNucleaires(zones, sites, { avecExtension = false } = {}) {
  const parId = new Map(sites.map((s) => [s.id, s]))
  return zones
    .filter((z) => (avecExtension || z.type_zone !== 'extension_iode') && parId.get(z.site_id)?.latitude != null)
    .map((z) => {
      const site = parId.get(z.site_id)
      const type = TYPES_ZONE_PLANIFICATION_NUCLEAIRE.find((t) => t.valeur === z.type_zone)
      return {
        id: `zpn-${z.id}`,
        lat: Number(site.latitude),
        lon: Number(site.longitude),
        rayonM: Number(z.rayon_km) * 1000,
        couleur: type?.couleur,
        libelle: `${site.nom} — ${type?.libelle ?? z.type_zone}, ${z.rayon_km} km${z.a_confirmer ? ' (à confirmer)' : ''}`,
      }
    })
}
