import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { texteErreur } from '@plateforme-crise/shared'
import { supabase } from '../lib/supabase'
import { LIBELLE_MODE, LIBELLE_STATUT_EXERCICE, LIBELLE_TYPE } from '../lib/exercices'
import ExercicePreparer from '../components/exercice/ExercicePreparer'
import ExerciceJouer from '../components/exercice/ExerciceJouer'
import ExerciceBilan from '../components/exercice/ExerciceBilan'

/**
 * Fiche d'un exercice. Trois temps : Préparer → Jouer → Bilan.
 * Seuls les animateurs voient et manipulent le scénario (stimuli, notes, observations) ;
 * les autres membres ne voient que le bilan, une fois l'exercice terminé.
 */
export default function ExerciceDetail() {
  const { id } = useParams()
  const [ex, setEx] = useState(null)
  const [peutAnimer, setPeutAnimer] = useState(false)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [onglet, setOnglet] = useState(null)

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from('exercices').select('*').eq('id', id).maybeSingle()
    if (error) {
      setErreur(texteErreur(error))
    } else if (!data) {
      setErreur('Exercice introuvable, ou vous n’y avez pas accès.')
    } else {
      setErreur(null)
      setEx(data)
    }
    const { data: ok } = await supabase.rpc('peut_animer_exercice', { p_exercice: id, p_action: 'modifier' })
    setPeutAnimer(ok === true)
    setChargement(false)
  }, [id])

  useEffect(() => {
    charger()
  }, [charger])

  // Onglet par défaut selon l'avancement, choisi une seule fois (ensuite c'est l'utilisateur qui décide).
  useEffect(() => {
    if (ex && onglet === null) {
      setOnglet(ex.statut === 'termine' || !peutAnimer ? 'bilan' : ex.statut === 'en_cours' ? 'jouer' : 'preparer')
    }
  }, [ex, peutAnimer, onglet])

  if (chargement) return <p className="text-sm text-sourdine">Chargement…</p>
  if (erreur || !ex) {
    return (
      <div>
        <p role="alert" className="text-sm text-chaud mb-2">{erreur ?? 'Exercice introuvable.'}</p>
        <Link to="/exercices" className="lien text-sm">← Retour aux exercices</Link>
      </div>
    )
  }

  const onglets = peutAnimer
    ? [
        { cle: 'preparer', libelle: 'Préparer' },
        { cle: 'jouer', libelle: 'Jouer', desactive: ex.statut !== 'en_cours' },
        { cle: 'bilan', libelle: 'Bilan', desactive: ex.statut !== 'termine' },
      ]
    : [{ cle: 'bilan', libelle: 'Bilan' }]

  return (
    <div>
      <Link to="/exercices" className="lien text-sm">← Exercices</Link>

      <div
        role="note"
        style={{ background: '#7c2d12', color: '#fff', padding: '8px 14px', borderRadius: 6, margin: '8px 0 12px', fontSize: 13, fontWeight: 600, letterSpacing: 0.3 }}
      >
        EXERCICE — rien de ce qui se joue ici n’est réel
        {ex.mode_jeu === 'dans_outil' && ' · aucune diffusion publique possible'}
      </div>

      <h1 className="text-lg font-semibold text-encre">
        {ex.titre?.trim() || LIBELLE_TYPE[ex.type_exercice] || 'Exercice'}
        <span className={`jeton ml-2 ${ex.statut === 'en_cours' ? 'text-chaud' : ex.statut === 'preparation' ? 'text-veille' : 'text-sourdine'}`}>
          {LIBELLE_STATUT_EXERCICE[ex.statut] ?? ex.statut}
        </span>
      </h1>
      <p className="text-xs text-sourdine mb-3">
        {LIBELLE_TYPE[ex.type_exercice] ?? ex.type_exercice} · {LIBELLE_MODE[ex.mode_jeu] ?? ex.mode_jeu}
        {ex.incident_id && ex.mode_jeu === 'dans_outil' && (
          <> · <Link to={`/incidents/${ex.incident_id}`} className="lien">incident d’exercice</Link></>
        )}
      </p>

      {!peutAnimer && ex.statut !== 'termine' && (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4 mb-4">
          Cet exercice est {ex.statut === 'en_cours' ? 'en cours' : 'en préparation'}. Le scénario reste réservé aux animateurs pour ne pas
          fausser le jeu ; le bilan sera consultable ici une fois l’exercice terminé.
        </p>
      )}

      <div role="tablist" className="flex gap-1 mb-4 border-b border-trait">
        {onglets.map((o) => (
          <button
            key={o.cle}
            type="button"
            role="tab"
            aria-selected={onglet === o.cle}
            disabled={o.desactive}
            onClick={() => setOnglet(o.cle)}
            className={`discret ${onglet === o.cle ? 'font-semibold' : ''}`}
            style={{ borderBottom: onglet === o.cle ? '2px solid currentColor' : '2px solid transparent', borderRadius: 0, opacity: o.desactive ? 0.4 : 1 }}
          >
            {o.libelle}
          </button>
        ))}
      </div>

      {onglet === 'preparer' && peutAnimer && (
        <ExercicePreparer ex={ex} onChange={charger} onDemarre={async () => { await charger(); setOnglet('jouer') }} />
      )}
      {onglet === 'jouer' && peutAnimer && ex.statut === 'en_cours' && (
        <ExerciceJouer ex={ex} onChange={charger} onClos={async () => { await charger(); setOnglet('bilan') }} />
      )}
      {onglet === 'bilan' && <ExerciceBilan ex={ex} peutAnimer={peutAnimer} onChange={charger} />}
    </div>
  )
}
