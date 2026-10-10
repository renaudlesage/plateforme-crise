import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import TableCrud from '../components/TableCrud'
import Onglets from '../components/Onglets'
import { BoutonDiscret } from '../components/Boutons'

const TYPES = [
  { valeur: 'doctrine', libelle: 'Doctrine' },
  { valeur: 'retour_experience', libelle: "Retour d'expérience" },
  { valeur: 'procedure', libelle: 'Procédure' },
  { valeur: 'terminologie', libelle: 'Terminologie' },
  { valeur: 'contact_expert', libelle: 'Contact expert' },
]
const STATUTS = [
  { valeur: 'a_valider', libelle: 'À valider' },
  { valeur: 'valide', libelle: 'Validé' },
  { valeur: 'rejete', libelle: 'Rejeté' },
]
const BESOINS = [
  { valeur: 'secours', libelle: 'Secours' },
  { valeur: 'abri', libelle: 'Abri' },
  { valeur: 'eau', libelle: 'Eau' },
  { valeur: 'nourriture', libelle: 'Nourriture' },
  { valeur: 'sante', libelle: 'Santé' },
  { valeur: 'energie', libelle: 'Énergie' },
  { valeur: 'communication', libelle: 'Communication' },
  { valeur: 'evacuation', libelle: 'Évacuation' },
]
const LANGUES = [
  { valeur: 'fr', libelle: 'Français' },
  { valeur: 'nl', libelle: 'Néerlandais' },
  { valeur: 'en', libelle: 'Anglais' },
]

/**
 * Savoir opérationnel de la zone (doctrine, retours d'expérience, procédures,
 * terminologie, contacts experts), avec validation humaine, et lexique de
 * détection des appels à l'aide pour la veille.
 */
export default function ConnaissancesVeille() {
  const { estSuperAdmin } = useAuth()
  return (
    <div>
      <h1 className="text-xl font-semibold text-encre mb-1">Connaissances & veille</h1>
      <p className="text-sm text-sourdine mb-4">
        Base documentaire de la zone : un élément n'est exploitable qu'une fois validé par une personne. La veille de la cellule
        de crise (sources ouvertes et signalements citoyens) se tient dans la fiche incident du CC.
      </p>
      <Onglets
        onglets={[
          { cle: 'base', libelle: 'Base de connaissances', contenu: <Base /> },
          {
            cle: 'lexique',
            libelle: 'Lexique d\'appels à l\'aide',
            contenu: (
              <TableCrud
                table="lexique_detection_appels"
                portee="national"
                peutEcrire={estSuperAdmin}
                tri="langue"
                aide="Termes qui signalent un besoin dans un message public (« piégé », « plus d'électricité »…), par langue. Référentiel national : modification réservée au super-admin."
                etiquetteAjout="Ajouter un terme"
                titreLigne={(l) => (
                  <>
                    <strong>{l.terme}</strong> <span className="text-xs text-sourdine">{l.langue.toUpperCase()}</span>
                  </>
                )}
                champs={[
                  { cle: 'terme', libelle: 'Terme', type: 'text', requis: true },
                  { cle: 'langue', libelle: 'Langue', type: 'select', options: LANGUES, requis: true },
                  { cle: 'categorie_besoin', libelle: 'Besoin signalé', type: 'select', options: BESOINS },
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

function Base() {
  const [filtre, setFiltre] = useState('')
  return (
    <>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button type="button" onClick={() => setFiltre('')} className={`pastille-filtre${filtre === '' ? ' actif' : ''}`}>Tous</button>
        {STATUTS.map((s) => (
          <button key={s.valeur} type="button" onClick={() => setFiltre(s.valeur)} className={`pastille-filtre${filtre === s.valeur ? ' actif' : ''}`}>
            {s.libelle}
          </button>
        ))}
      </div>
      <TableCrud
        key={filtre}
        table="base_connaissances_operationnelles"
        tri="created_at"
        filtre={filtre ? { statut_validation: filtre } : null}
        vide="Aucun élément."
        etiquetteAjout="Ajouter un élément"
        titreLigne={(l) => (
          <>
            <strong>{l.titre}</strong>{' '}
            <span className="text-xs text-sourdine">{TYPES.find((t) => t.valeur === l.type_element)?.libelle}</span>
            <span className={`jeton ml-2 ${l.statut_validation === 'valide' ? 'text-ok' : l.statut_validation === 'rejete' ? 'text-chaud' : 'text-sourdine'}`}>
              {STATUTS.find((s) => s.valeur === l.statut_validation)?.libelle}
            </span>
            {l.extrait_par_ia && <span className="jeton ml-1">issu d'une IA</span>}
          </>
        )}
        champs={[
          { cle: 'titre', libelle: 'Titre', type: 'text', requis: true },
          { cle: 'type_element', libelle: 'Type', type: 'select', options: TYPES, requis: true },
          { cle: 'contenu', libelle: 'Contenu', type: 'textarea' },
          { cle: 'langue', libelle: 'Langue', type: 'select', options: LANGUES, defaut: 'fr' },
          { cle: 'alea_concerne', libelle: 'Aléas concernés', type: 'tags' },
          { cle: 'phase_cycle', libelle: 'Phase du cycle', type: 'text' },
          { cle: 'source_reference', libelle: 'Source', type: 'text' },
          { cle: 'extrait_par_ia', libelle: 'Extrait par une IA (à relire)', type: 'checkbox' },
        ]}
        actionsLigne={(l, recharger) => <BoutonsValidation ligne={l} recharger={recharger} />}
      />
    </>
  )
}

function BoutonsValidation({ ligne, recharger }) {
  async function statuer(statut) {
    const { data: u } = await supabase.auth.getUser()
    const valide = statut === 'valide'
    await supabase
      .from('base_connaissances_operationnelles')
      .update({ statut_validation: statut, valide_par: valide ? u?.user?.id ?? null : null, valide_le: valide ? new Date().toISOString() : null })
      .eq('id', ligne.id)
    recharger()
  }
  return (
    <span className="flex gap-1.5">
      {STATUTS.filter((s) => s.valeur !== ligne.statut_validation).map((s) => (
        <BoutonDiscret key={s.valeur} onClick={() => statuer(s.valeur)}>{s.libelle}</BoutonDiscret>
      ))}
    </span>
  )
}
