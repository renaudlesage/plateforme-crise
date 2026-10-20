import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { texteErreur } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const LIBELLE_STATUT_ETAPE = { a_faire: 'à faire', en_cours: 'en cours', fait: 'fait', abandonne: 'abandonné' }
const LIBELLE_CATEGORIE = { naturel: 'Naturel', technologique: 'Technologique', man_made: 'Anthropique', sanitaire: 'Sanitaire' }
const LIBELLE_STATUT = { a_evaluer: 'à évaluer', retenu: 'retenu', ecarte: 'écarté' }
const LIBELLE_ROLE = { source: 'source du risque', enjeu: 'enjeu exposé' }

// Champs texte de la fiche, dans l'ordre de lecture en crise.
const SECTIONS = [
  ['declencheur', 'Déclencheur'],
  ['signaux_faibles', 'Signaux précurseurs'],
  ['effets_directs', 'Effets directs'],
  ['effets_cascade', 'Effets de cascade et post-crise'],
  ['messages_publics_predefinis', 'Messages publics pré-rédigés'],
  ['mesures_compensatoires', 'Mesures compensatoires et mode dégradé'],
  ['decisions_a_preparer', 'Décisions à préparer'],
  ['mesures_preventives', 'Mesures préventives'],
  ['sources', 'Sources'],
]

/**
 * Fiche de risque mise en page pour être imprimée ou enregistrée en PDF (mode dégradé : la fiche doit rester
 * utilisable sans réseau). Reprend le risque du territoire, ses seuils d'action, son plan d'action et les
 * objets à risque qui lui sont liés, tels qu'encodés dans le contexte ; l'extrait porte la date à laquelle
 * il a été établi.
 */
export default function FicheRisqueImpression() {
  const { id } = useParams()
  const { contexteActuel } = useAuth()
  const [fiche, setFiche] = useState(null)
  const [seuils, setSeuils] = useState([])
  const [etapes, setEtapes] = useState([])
  const [objets, setObjets] = useState([])
  const [erreur, setErreur] = useState(null)
  const [etabliLe] = useState(() => new Date())

  useEffect(() => {
    let annule = false
    async function charger() {
      const [f, s, e, o] = await Promise.all([
        supabase.from('risques_territoire').select('*').eq('id', id).single(),
        supabase.from('seuils_action').select('*').eq('risque_id', id).order('ordre'),
        supabase.from('plans_action_risque').select('*').eq('risque_id', id).order('ordre'),
        supabase.from('objets_a_risque_risques').select('role, objets_a_risque(id, identification, adresse)').eq('risque_id', id),
      ])
      if (annule) return
      const premiere = f.error || s.error || e.error || o.error
      if (premiere) {
        setErreur(texteErreur(premiere))
        return
      }
      setFiche(f.data)
      setSeuils(s.data ?? [])
      setEtapes(e.data ?? [])
      setObjets(o.data ?? [])
    }
    charger()
    return () => {
      annule = true
    }
  }, [id])

  if (erreur) return <p role="alert" className="text-sm text-chaud">{erreur}</p>
  if (!fiche) return <p className="text-sm text-sourdine">Chargement…</p>

  return (
    <div className="fiche-impression">
      <div className="no-print flex items-center justify-between gap-3 flex-wrap mb-4">
        <Link to="/risques-territoire" className="lien">← Retour aux risques du territoire</Link>
        <button type="button" className="principal" onClick={() => window.print()}>Imprimer / enregistrer en PDF</button>
      </div>

      <header className="mb-3" style={{ borderBottom: '2px solid currentColor', paddingBottom: 6 }}>
        <p className="text-xs text-sourdine">{contexteActuel?.contextes?.nom ?? ''}</p>
        <h1 className="text-lg font-semibold text-encre">{fiche.titre}</h1>
        <p className="text-xs text-sourdine">
          {fiche.code && <>{fiche.code} · </>}
          {LIBELLE_CATEGORIE[fiche.categorie] ?? fiche.categorie}
          {fiche.type_risque && <> · {fiche.type_risque}</>}
          {fiche.statut && fiche.statut !== 'retenu' && <> · {LIBELLE_STATUT[fiche.statut] ?? fiche.statut}</>}
          {fiche.niveau_calcule != null && (
            <> · niveau {fiche.niveau_calcule} (probabilité {fiche.probabilite} × impact {fiche.impact}){fiche.date_evaluation && <>, évalué le {fiche.date_evaluation}</>}</>
          )}
          {' · '}extrait du {etabliLe.toLocaleDateString('fr-BE', { dateStyle: 'long' })}
        </p>
      </header>

      {seuils.length > 0 && (
        <section className="mb-3">
          <h2 className="text-sm font-semibold text-encre mb-1">Seuils d'action</h2>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }} className="space-y-2">
            {seuils.map((s) => (
              <li key={s.id} className="border border-trait rounded p-2" style={{ breakInside: 'avoid' }}>
                <p className="text-sm font-semibold text-encre">
                  {s.libelle}
                  {s.actif === false && <span className="font-normal"> (inactif)</span>}
                </p>
                <p className="text-xs text-sourdine">{s.seuil_description}</p>
                <p className="text-xs text-encre mt-1" style={{ whiteSpace: 'pre-line' }}>{s.action}</p>
                {s.action_degradee && (
                  <p className="text-xs text-encre mt-1"><strong>Mode dégradé :</strong> {s.action_degradee}</p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {SECTIONS.filter(([cle]) => fiche[cle]).map(([cle, titre]) => (
        <section key={cle} className="mb-3">
          <h2 className="text-sm font-semibold text-encre mb-1">{titre}</h2>
          <p className="text-xs text-encre" style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{fiche[cle]}</p>
        </section>
      ))}

      {objets.length > 0 && (
        <section className="mb-3" style={{ breakInside: 'avoid' }}>
          <h2 className="text-sm font-semibold text-encre mb-1">Objets à risque concernés</h2>
          <ul className="text-xs text-encre" style={{ paddingLeft: 18, margin: 0 }}>
            {objets.map((l) => (
              <li key={l.objets_a_risque?.id}>
                {l.objets_a_risque?.identification}
                {l.objets_a_risque?.adresse && <span className="text-sourdine"> — {l.objets_a_risque.adresse}</span>}
                <span className="text-sourdine"> ({LIBELLE_ROLE[l.role] ?? l.role})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {etapes.length > 0 && (
        <section className="mb-3" style={{ breakInside: 'avoid' }}>
          <h2 className="text-sm font-semibold text-encre mb-1">Plan d'action</h2>
          <ol className="text-xs text-encre" style={{ paddingLeft: 18, margin: 0 }}>
            {etapes.map((e) => (
              <li key={e.id}>
                {e.libelle} <span className="text-sourdine">({LIBELLE_STATUT_ETAPE[e.statut] ?? e.statut})</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
