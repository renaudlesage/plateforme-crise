import TableCrud from '../components/TableCrud'
import Onglets from '../components/Onglets'

const STATUTS_PLAN = [
  { valeur: 'a_faire', libelle: 'À faire' },
  { valeur: 'en_cours', libelle: 'En cours' },
  { valeur: 'valide', libelle: 'Validé' },
  { valeur: 'a_revoir', libelle: 'À revoir' },
]
const NIVEAUX_RISQUE = [
  { valeur: 'faible', libelle: 'Faible' },
  { valeur: 'moyen', libelle: 'Moyen' },
  { valeur: 'eleve', libelle: 'Élevé' },
  { valeur: 'tres_eleve', libelle: 'Très élevé' },
]
const PROPRIETAIRES = [
  { valeur: 'public', libelle: 'Public' },
  { valeur: 'prive', libelle: 'Privé' },
  { valeur: 'mixte', libelle: 'Mixte' },
]
const TYPES_EAU = [
  { valeur: 'borne', libelle: 'Borne' },
  { valeur: 'citerne', libelle: 'Citerne' },
  { valeur: 'etang', libelle: 'Étang' },
  { valeur: 'cours_eau', libelle: "Cours d'eau" },
  { valeur: 'autre', libelle: 'Autre' },
]
const CATEGORIES_PREVENTION = [
  { valeur: 'construction', libelle: 'Construction' },
  { valeur: 'vegetation', libelle: 'Végétation' },
  { valeur: 'acces', libelle: 'Accès' },
  { valeur: 'eau', libelle: 'Eau' },
  { valeur: 'information', libelle: 'Information' },
]

/**
 * Lisière forêt-habitat et incendie de végétation. Risque secondaire en
 * Wallonie (épicéas scolytés, landes, Hautes Fagnes en période sèche) : module
 * complémentaire pour les communes à couvert forestier. Aucun nom de
 * propriétaire n'est enregistré, seulement le type (public / privé / mixte).
 */
export default function LisiereIncendie() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-encre mb-1">Lisière & incendie de végétation</h1>
      <p className="text-sm text-sourdine mb-4">
        Plans d'autoprotection des quartiers exposés, parcelles à risque, points d'eau et accès forestiers. Les points
        localisés apparaissent sur la carte.
      </p>
      <Onglets
        onglets={[
          {
            cle: 'plans',
            libelle: "Plans d'autoprotection",
            contenu: (
              <TableCrud
                table="plans_autoprotection_wui"
                tri="zone_nom"
                aide="Un plan par quartier ou lotissement exposé en lisière de forêt."
                vide="Aucun plan d'autoprotection suivi."
                titreLigne={(l) => (
                  <>
                    <strong>{l.zone_nom}</strong>
                    <span className={`jeton ml-2 ${l.statut === 'valide' ? 'text-ok' : l.statut === 'a_revoir' ? 'text-chaud' : 'text-sourdine'}`}>
                      {STATUTS_PLAN.find((s) => s.valeur === l.statut)?.libelle}
                    </span>
                  </>
                )}
                champs={[
                  { cle: 'zone_nom', libelle: 'Quartier / zone', type: 'text', requis: true },
                  { cle: 'responsable', libelle: 'Responsable', type: 'text' },
                  { cle: 'statut', libelle: 'Statut', type: 'select', options: STATUTS_PLAN, defaut: 'a_faire' },
                  { cle: 'date_validation', libelle: 'Date de validation', type: 'date' },
                  { cle: 'prochaine_revision', libelle: 'Prochaine révision', type: 'date' },
                  { cle: 'position', libelle: 'Position', type: 'position' },
                ]}
              />
            ),
          },
          {
            cle: 'parcelles',
            libelle: 'Parcelles à risque',
            contenu: (
              <TableCrud
                table="parcelles_risque_incendie"
                tri="libelle"
                aide="Aucun nom de propriétaire : seul le type est enregistré (RGPD)."
                vide="Aucune parcelle à risque encodée."
                titreLigne={(l) => (
                  <>
                    <strong>{l.libelle}</strong>
                    {l.niveau_risque && (
                      <span className={`jeton ml-2 ${l.niveau_risque === 'eleve' || l.niveau_risque === 'tres_eleve' ? 'text-chaud' : 'text-sourdine'}`}>
                        {NIVEAUX_RISQUE.find((n) => n.valeur === l.niveau_risque)?.libelle}
                      </span>
                    )}
                  </>
                )}
                champs={[
                  { cle: 'libelle', libelle: 'Parcelle / secteur', type: 'text', requis: true },
                  { cle: 'type_couvert', libelle: 'Type de couvert', type: 'text', aide: 'ex. épicéas, lande, feuillus' },
                  { cle: 'proprietaire_type', libelle: 'Propriété', type: 'select', options: PROPRIETAIRES },
                  { cle: 'niveau_risque', libelle: 'Niveau de risque', type: 'select', options: NIVEAUX_RISQUE },
                  { cle: 'surface_ha', libelle: 'Surface (ha)', type: 'number' },
                  { cle: 'mesure_nbs', libelle: 'Mesure de prévention', type: 'text' },
                  { cle: 'statut_mesure', libelle: 'Statut de la mesure', type: 'text', defaut: 'a_planifier' },
                  { cle: 'position', libelle: 'Position', type: 'position' },
                ]}
                valeursParDefaut={{ statut_mesure: 'a_planifier' }}
              />
            ),
          },
          {
            cle: 'eau',
            libelle: "Points d'eau",
            contenu: (
              <TableCrud
                table="points_eau_incendie"
                tri="libelle"
                vide="Aucun point d'eau encodé."
                titreLigne={(l) => (
                  <>
                    <strong>{l.libelle}</strong>{' '}
                    <span className="text-xs text-sourdine">{TYPES_EAU.find((t) => t.valeur === l.type_point)?.libelle}</span>
                  </>
                )}
                champs={[
                  { cle: 'libelle', libelle: 'Point d\'eau', type: 'text', requis: true },
                  { cle: 'type_point', libelle: 'Type', type: 'select', options: TYPES_EAU },
                  { cle: 'debit_estime_lmin', libelle: 'Débit estimé (L/min)', type: 'number' },
                  { cle: 'accessible_vehicules', libelle: 'Accessible aux véhicules', type: 'checkbox' },
                  { cle: 'verifie_le', libelle: 'Vérifié le', type: 'date' },
                  { cle: 'position', libelle: 'Position', type: 'position' },
                ]}
              />
            ),
          },
          {
            cle: 'acces',
            libelle: 'Accès forestiers',
            contenu: (
              <TableCrud
                table="accessibilite_forestiere"
                tri="libelle"
                aide="Un point de repère par voie (début du chemin)."
                vide="Aucune voie encodée."
                titreLigne={(l) => (
                  <>
                    <strong>{l.libelle}</strong>
                    {l.praticable_engins_lourds != null && (
                      <span className={`jeton ml-2 ${l.praticable_engins_lourds ? 'text-ok' : 'text-chaud'}`}>
                        {l.praticable_engins_lourds ? 'engins lourds OK' : 'engins lourds impossibles'}
                      </span>
                    )}
                  </>
                )}
                champs={[
                  { cle: 'libelle', libelle: 'Voie / chemin', type: 'text', requis: true },
                  { cle: 'type_voie', libelle: 'Type de voie', type: 'text' },
                  { cle: 'largeur_m', libelle: 'Largeur (m)', type: 'number' },
                  { cle: 'charge_max_t', libelle: 'Charge max (t)', type: 'number' },
                  { cle: 'praticable_engins_lourds', libelle: 'Praticable par engins lourds', type: 'checkbox' },
                  { cle: 'verifie_le', libelle: 'Vérifié le', type: 'date' },
                  { cle: 'position', libelle: 'Position', type: 'position' },
                ]}
              />
            ),
          },
          {
            cle: 'prevention',
            libelle: 'Mesures de prévention',
            contenu: (
              <TableCrud
                table="fiches_prevention_wui"
                tri="mesure"
                aide="Mesures de prévention en lisière, par catégorie (construction, végétation, accès, eau, information)."
                vide="Aucune mesure encodée."
                titreLigne={(l) => (
                  <>
                    <strong>{l.mesure}</strong>{' '}
                    <span className="text-xs text-sourdine">{CATEGORIES_PREVENTION.find((c) => c.valeur === l.categorie)?.libelle}</span>
                  </>
                )}
                champs={[
                  { cle: 'mesure', libelle: 'Mesure', type: 'text', requis: true },
                  { cle: 'categorie', libelle: 'Catégorie', type: 'select', options: CATEGORIES_PREVENTION },
                  { cle: 'public_cible', libelle: 'Public cible', type: 'text' },
                  { cle: 'cout_estime', libelle: 'Coût estimé (€)', type: 'number' },
                  { cle: 'source_reference', libelle: 'Source', type: 'text' },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  )
}
