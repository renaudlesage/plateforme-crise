import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import TableCrud from '../components/TableCrud'
import Onglets from '../components/Onglets'

const SOURCES = [
  { valeur: 'BULLSEYE', libelle: 'BULLSEYE (projet UE)' },
  { valeur: 'CWA17974', libelle: 'CEN CWA 17974:2023' },
  { valeur: 'autre', libelle: 'Autre' },
]
const LIGNES = [
  { valeur: '1', libelle: '1re ligne' },
  { valeur: '2', libelle: '2e ligne' },
  { valeur: '3', libelle: '3e ligne' },
  { valeur: 'transversal', libelle: 'Transversal' },
]

/**
 * Formation CBRN : référentiel (BULLSEYE, CEN CWA 17974) et formations
 * réalisées par la commune/zone. Le public visé est large (agents communaux,
 * organisateurs d'événements), pas les pompiers déjà formés.
 */
export default function FormationsCbrn() {
  const { estSuperAdmin } = useAuth()
  return (
    <div>
      <h1 className="text-xl font-semibold text-encre mb-1">Formations CBRN</h1>
      <p className="text-sm text-sourdine mb-4">
        Référentiel minimal inspiré de BULLSEYE (trois lignes de réponse, dont les 20 premières minutes sans formation CBRN) et
        de l'accord CEN CWA 17974:2023 (accord d'atelier, pas une norme formelle). Les modules détaillés du CWA 17974 sont à
        encoder depuis le document.
        {!estSuperAdmin && ' Référentiel national : modification réservée au super-admin.'}
      </p>
      <Onglets
        onglets={[
          {
            cle: 'realisees',
            libelle: 'Formations réalisées',
            contenu: <Realisees />,
          },
          {
            cle: 'referentiel',
            libelle: 'Référentiel',
            contenu: (
              <TableCrud
                table="referentiel_formations_cbrn"
                portee="national"
                peutEcrire={estSuperAdmin}
                tri="created_at"
                vide="Référentiel vide."
                etiquetteAjout="Ajouter un module"
                titreLigne={(l) => (
                  <>
                    <strong>{l.module}</strong>{' '}
                    <span className="text-xs text-sourdine">
                      {SOURCES.find((s) => s.valeur === l.source)?.libelle}
                      {l.ligne_reponse && ` · ${LIGNES.find((x) => x.valeur === l.ligne_reponse)?.libelle}`}
                    </span>
                  </>
                )}
                champs={[
                  { cle: 'module', libelle: 'Module', type: 'text', requis: true },
                  { cle: 'source', libelle: 'Source', type: 'select', options: SOURCES, requis: true },
                  { cle: 'ligne_reponse', libelle: 'Ligne de réponse', type: 'select', options: LIGNES },
                  { cle: 'public_cible', libelle: 'Public cible', type: 'tags' },
                  { cle: 'duree_min', libelle: 'Durée (min)', type: 'number' },
                  { cle: 'objectifs', libelle: 'Objectifs', type: 'textarea' },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  )
}

function Realisees() {
  const [modules, setModules] = useState([])
  const [pret, setPret] = useState(false)
  useEffect(() => {
    supabase
      .from('referentiel_formations_cbrn')
      .select('id, module')
      .order('created_at')
      .then(({ data }) => {
        setModules(data ?? [])
        setPret(true)
      })
  }, [])
  if (!pret) return <p className="text-sm text-sourdine">Chargement…</p>
  return (
    <TableCrud
      table="formations_realisees_cbrn"
      tri="date_formation"
      vide="Aucune formation enregistrée."
      etiquetteAjout="Enregistrer une formation"
      titreLigne={(l) => (
        <>
          <strong>{modules.find((m) => m.id === l.referentiel_id)?.module ?? 'Formation'}</strong>
          {l.date_formation && <span className="text-xs text-sourdine"> · {new Date(l.date_formation).toLocaleDateString('fr-BE')}</span>}
        </>
      )}
      champs={[
        { cle: 'referentiel_id', libelle: 'Module', type: 'select', options: modules.map((m) => ({ valeur: m.id, libelle: m.module })) },
        { cle: 'date_formation', libelle: 'Date', type: 'date' },
        { cle: 'participants_nb', libelle: 'Participants', type: 'number' },
        { cle: 'formateur', libelle: 'Formateur', type: 'text' },
        { cle: 'remarques', libelle: 'Remarques', type: 'textarea' },
      ]}
    />
  )
}
