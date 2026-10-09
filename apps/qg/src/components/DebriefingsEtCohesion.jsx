import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BoutonDiscret, BoutonPrincipal } from './Boutons'

const NIVEAUX = [
  { valeur: 'local', libelle: 'Local (terrain / équipe)' },
  { valeur: 'communal', libelle: 'Communal' },
  { valeur: 'provincial', libelle: 'Provincial' },
  { valeur: 'federal', libelle: 'Fédéral' },
]

/**
 * Retour d'expérience multi-niveaux : un debriefing par niveau (local,
 * communal, provincial, fédéral), pour que les enseignements remontent et
 * redescendent la chaîne de coordination. Complète le REX formel.
 */
export function SectionDebriefings({ incidentId, contexteId }) {
  const [lignes, setLignes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enAjout, setEnAjout] = useState(false)

  const rafraichir = useCallback(async () => {
    const { data, error } = await supabase
      .from('debriefings_post_crise')
      .select('*')
      .eq('incident_id', incidentId)
      .order('date_debriefing', { ascending: false, nullsFirst: false })
    if (error) setErreur(error.message)
    else setLignes(data ?? [])
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function creer(valeurs) {
    const { error } = await supabase
      .from('debriefings_post_crise')
      .insert({ ...valeurs, contexte_id: contexteId, incident_id: incidentId })
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function retirer(id) {
    if (!confirm('Supprimer ce debriefing ?')) return
    const { error } = await supabase.from('debriefings_post_crise').delete().eq('id', id)
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium text-encre">Debriefings multi-niveaux</h2>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un debriefing</BoutonPrincipal>}
      </div>
      <p className="text-xs text-sourdine mb-3">
        Un retour d'expérience par niveau de la chaîne de coordination (local, communal, provincial, fédéral).
      </p>
      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <div className="border border-trait rounded p-3 mb-3 bg-fond">
          <FormulaireDebriefing
            onAnnuler={() => setEnAjout(false)}
            onValider={async (valeurs) => {
              const r = await creer(valeurs)
              if (!r.error) setEnAjout(false)
              return r
            }}
          />
        </div>
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : lignes.length === 0 && !enAjout ? (
        <p className="vide border border-dashed border-trait text-center p-4">Aucun debriefing enregistré pour cet incident.</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {lignes.map((d) => (
            <li key={d.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-encre">
                    <span className="jeton mr-2">{NIVEAUX.find((n) => n.valeur === d.niveau)?.libelle ?? d.niveau}</span>
                    {d.date_debriefing && <span className="text-xs text-sourdine">{new Date(d.date_debriefing).toLocaleDateString('fr-BE')}</span>}
                  </p>
                  {d.synthese && <p className="text-sm text-encre whitespace-pre-line">{d.synthese}</p>}
                  {d.points_forts && <p className="text-xs text-sourdine"><strong>Points forts :</strong> {d.points_forts}</p>}
                  {d.points_a_ameliorer && <p className="text-xs text-sourdine"><strong>À améliorer :</strong> {d.points_a_ameliorer}</p>}
                  {d.actions_retenues && <p className="text-xs text-sourdine"><strong>Actions retenues :</strong> {d.actions_retenues}</p>}
                </div>
                <BoutonDiscret onClick={() => retirer(d.id)}>✕</BoutonDiscret>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireDebriefing({ onValider, onAnnuler }) {
  const [niveau, setNiveau] = useState('communal')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [synthese, setSynthese] = useState('')
  const [forts, setForts] = useState('')
  const [ameliorer, setAmeliorer] = useState('')
  const [actions, setActions] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      niveau,
      date_debriefing: date || null,
      synthese: synthese.trim() || null,
      points_forts: forts.trim() || null,
      points_a_ameliorer: ameliorer.trim() || null,
      actions_retenues: actions.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Niveau</label>
          <select value={niveau} onChange={(e) => setNiveau(e.target.value)} className="w-full">
            {NIVEAUX.map((n) => (
              <option key={n.valeur} value={n.valeur}>{n.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Synthèse</label>
        <textarea value={synthese} onChange={(e) => setSynthese(e.target.value)} rows={3} className="w-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Points forts</label>
          <textarea value={forts} onChange={(e) => setForts(e.target.value)} rows={3} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">À améliorer</label>
          <textarea value={ameliorer} onChange={(e) => setAmeliorer(e.target.value)} rows={3} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Actions retenues</label>
          <textarea value={actions} onChange={(e) => setActions(e.target.value)} rows={3} className="w-full" />
        </div>
      </div>
      {erreur && <p className="text-sm text-chaud">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

/**
 * Cohésion sociale en crise : indicateurs AGRÉGÉS uniquement (ex. « nombre de
 * bénévoles spontanés mobilisés », « % de foyers contactés par le voisinage »).
 * Aucune donnée individuelle ni identifiante ne doit être saisie ici.
 */
export function SectionCohesionSociale({ incidentId, contexteId }) {
  const [lignes, setLignes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [indicateur, setIndicateur] = useState('')
  const [valeur, setValeur] = useState('')
  const [periode, setPeriode] = useState('')

  const rafraichir = useCallback(async () => {
    const { data, error } = await supabase
      .from('indicateurs_cohesion_sociale_crise')
      .select('*')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false })
    if (error) setErreur(error.message)
    else setLignes(data ?? [])
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function ajouter(e) {
    e.preventDefault()
    if (!indicateur.trim()) return
    const { error } = await supabase.from('indicateurs_cohesion_sociale_crise').insert({
      contexte_id: contexteId,
      incident_id: incidentId,
      indicateur: indicateur.trim(),
      valeur_agregee: valeur === '' ? null : Number(valeur),
      periode: periode.trim() || null,
    })
    if (error) {
      setErreur(error.message)
      return
    }
    setIndicateur('')
    setValeur('')
    setPeriode('')
    setErreur(null)
    await rafraichir()
  }

  async function retirer(id) {
    const { error } = await supabase.from('indicateurs_cohesion_sociale_crise').delete().eq('id', id)
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  return (
    <div>
      <h2 className="font-medium text-encre mb-1">Cohésion sociale (indicateurs agrégés)</h2>
      <p className="text-xs text-sourdine mb-3">
        Indicateurs collectifs uniquement (totaux, pourcentages). Ne saisir aucune donnée individuelle ni identifiante.
      </p>
      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}
      <form onSubmit={ajouter} className="flex flex-wrap gap-2 mb-3">
        <input value={indicateur} onChange={(e) => setIndicateur(e.target.value)} placeholder="indicateur" className="flex-1 min-w-[12rem]" />
        <input type="number" step="any" value={valeur} onChange={(e) => setValeur(e.target.value)} placeholder="valeur" className="w-28" />
        <input value={periode} onChange={(e) => setPeriode(e.target.value)} placeholder="période (ex. J+3)" className="w-36" />
        <BoutonDiscret type="submit">Ajouter</BoutonDiscret>
      </form>
      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : lignes.length === 0 ? (
        <p className="vide border border-dashed border-trait text-center p-4">Aucun indicateur enregistré.</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {lignes.map((l) => (
            <li key={l.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="text-encre">
                {l.indicateur}
                {l.valeur_agregee != null && <> : <strong>{Number(l.valeur_agregee)}</strong></>}
                {l.periode && <span className="text-xs text-sourdine"> · {l.periode}</span>}
              </span>
              <BoutonDiscret onClick={() => retirer(l.id)}>✕</BoutonDiscret>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
