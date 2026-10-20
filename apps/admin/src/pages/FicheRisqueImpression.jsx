import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { texteErreur } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const LIBELLE_STATUT_ETAPE = { a_faire: 'à faire', en_cours: 'en cours', fait: 'fait', abandonne: 'abandonné' }

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
]

/**
 * Fiche risque mise en page pour être imprimée ou enregistrée en PDF (mode dégradé : la fiche doit rester
 * utilisable sans réseau). Reprend la fiche, ses seuils d'action et son plan d'action tels qu'encodés dans le
 * contexte ; l'extrait porte la date à laquelle il a été établi.
 */
export default function FicheRisqueImpression() {
  const { id } = useParams()
  const { contexteActuel } = useAuth()
  const [fiche, setFiche] = useState(null)
  const [seuils, setSeuils] = useState([])
  const [etapes, setEtapes] = useState([])
  const [erreur, setErreur] = useState(null)
  const [etabliLe] = useState(() => new Date())

  useEffect(() => {
    let annule = false
    async function charger() {
      const [f, s, e] = await Promise.all([
        supabase.from('objets_a_risque').select('*').eq('id', id).single(),
        supabase.from('seuils_action').select('*').eq('objet_risque_id', id).order('ordre'),
        supabase.from('plans_action_risque').select('*').eq('objet_risque_id', id).order('ordre'),
      ])
      if (annule) return
      const premiere = f.error || s.error || e.error
      if (premiere) {
        setErreur(texteErreur(premiere))
        return
      }
      setFiche(f.data)
      setSeuils(s.data ?? [])
      setEtapes(e.data ?? [])
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
        <Link to="/risques" className="lien">← Retour aux objets à risque</Link>
        <button type="button" className="principal" onClick={() => window.print()}>Imprimer / enregistrer en PDF</button>
      </div>

      <header className="mb-3" style={{ borderBottom: '2px solid currentColor', paddingBottom: 6 }}>
        <p className="text-xs text-sourdine">{contexteActuel?.contextes?.nom ?? ''}</p>
        <h1 className="text-lg font-semibold text-encre">{fiche.identification}</h1>
        <p className="text-xs text-sourdine">
          {fiche.code && <>{fiche.code} · </>}
          {fiche.type_risque}
          {fiche.adresse && <> · {fiche.adresse}</>}
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
          <p className="text-xs text-encre" style={{ whiteSpace: 'pre-line' }}>{fiche[cle]}</p>
        </section>
      ))}

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
