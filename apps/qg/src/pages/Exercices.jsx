import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GRAVITES_PIEGE, PIEGES_COMMUNE, libelleHeureScenario, texteErreur } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import {
  LIBELLE_MODE,
  LIBELLE_STATUT_EXERCICE,
  LIBELLE_TYPE,
  MODES_JEU,
  TYPES_EXERCICE,
} from '../lib/exercices'

const ORDRE_STATUT = { en_cours: 0, preparation: 1, termine: 2 }

export default function Exercices() {
  const { contexteId } = useAuth()
  const navigate = useNavigate()
  const [exercices, setExercices] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enAjout, setEnAjout] = useState(false)
  const [depuisTrame, setDepuisTrame] = useState(false)

  const charger = useCallback(async () => {
    if (!contexteId) return
    const { data, error } = await supabase
      .from('exercices')
      .select('id, titre, type_exercice, mode_jeu, statut, date_planifiee, date_realisee, debut_reel, duree_minutes')
      .eq('contexte_id', contexteId)
    if (error) {
      setErreur(texteErreur(error))
      setExercices([])
    } else {
      setErreur(null)
      setExercices(data ?? [])
    }
    setChargement(false)
  }, [contexteId])

  useEffect(() => {
    charger()
  }, [charger])

  const tries = [...exercices].sort((a, b) => {
    const s = (ORDRE_STATUT[a.statut] ?? 9) - (ORDRE_STATUT[b.statut] ?? 9)
    if (s !== 0) return s
    const da = a.date_realisee ?? a.date_planifiee ?? ''
    const db = b.date_realisee ?? b.date_planifiee ?? ''
    return db.localeCompare(da)
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold text-encre">Exercices</h1>
        {!enAjout && !depuisTrame && (
          <div className="flex gap-2">
            <BoutonDiscret onClick={() => setDepuisTrame(true)}>Depuis une trame</BoutonDiscret>
            <BoutonPrincipal onClick={() => setEnAjout(true)}>Préparer un exercice</BoutonPrincipal>
          </div>
        )}
      </div>
      <p className="text-sm text-sourdine mb-1">
        Préparer, animer et clore un exercice sur mesure, avec la plateforme comme livre de bord.
      </p>
      <p className="text-xs text-sourdine mb-4">
        Un exercice sert à s’entraîner et à repérer des écarts : un exercice réussi ne certifie pas que la réponse réelle tiendra.
        Le bilan porte sur le dispositif et les actions, jamais sur des personnes.
      </p>

      {erreur && <p role="alert" className="text-sm text-chaud mb-2">{erreur}</p>}

      {depuisTrame && (
        <FormulaireDepuisTrame
          contexteId={contexteId}
          onAnnuler={() => setDepuisTrame(false)}
          onCree={(id) => navigate(`/exercices/${id}`)}
        />
      )}

      {enAjout && (
        <FormulaireNouvelExercice
          contexteId={contexteId}
          onAnnuler={() => setEnAjout(false)}
          onCree={(id) => navigate(`/exercices/${id}`)}
        />
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : tries.length === 0 && !enAjout && !erreur ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun exercice pour ce contexte.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden">
          {tries.map((ex) => (
            <li key={ex.id}>
              <Link
                to={`/exercices/${ex.id}`}
                className="flex items-center justify-between px-4 py-3 bg-surface hover:bg-fond transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-encre">
                    {ex.titre?.trim() || LIBELLE_TYPE[ex.type_exercice] || ex.type_exercice}
                    <span className={`jeton ml-2 ${ex.statut === 'en_cours' ? 'text-chaud' : ex.statut === 'preparation' ? 'text-veille' : 'text-sourdine'}`}>
                      {LIBELLE_STATUT_EXERCICE[ex.statut] ?? ex.statut}
                    </span>
                    <span className="jeton ml-2">{LIBELLE_MODE[ex.mode_jeu] ?? ex.mode_jeu}</span>
                  </p>
                  <p className="text-xs text-sourdine">
                    {LIBELLE_TYPE[ex.type_exercice] ?? ex.type_exercice}
                    {ex.duree_minutes ? ` · ${ex.duree_minutes} min prévues` : ''}
                    {ex.statut === 'termine' && ex.date_realisee ? ` · réalisé le ${new Date(ex.date_realisee).toLocaleDateString('fr-BE')}` : ''}
                    {ex.statut !== 'termine' && ex.date_planifiee ? ` · prévu le ${new Date(ex.date_planifiee).toLocaleDateString('fr-BE')}` : ''}
                  </p>
                </div>
                <span className="text-sourdine text-sm">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireNouvelExercice({ contexteId, onAnnuler, onCree }) {
  const [titre, setTitre] = useState('')
  const [type, setType] = useState('ttx')
  const [mode, setMode] = useState('sur_table')
  const [duree, setDuree] = useState('')
  const [facteur, setFacteur] = useState('1')
  const [date, setDate] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    setErreur(null)
    const { data, error } = await supabase
      .from('exercices')
      .insert({
        contexte_id: contexteId,
        titre: titre.trim(),
        type_exercice: type,
        mode_jeu: mode,
        duree_minutes: duree === '' ? null : Number(duree),
        facteur_temps: Number(facteur) || 1,
        date_planifiee: date || null,
      })
      .select('id')
      .single()
    setEnCours(false)
    if (error) setErreur(texteErreur(error))
    else onCree(data.id)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Titre</label>
        <input required value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="ex. Inondation Haute-Meuse — table de crise" className="w-full" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Nature de l’exercice</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full">
            {TYPES_EXERCICE.map((t) => (
              <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Date prévue</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full" />
        </div>
      </div>

      <fieldset>
        <legend className="block text-xs font-medium text-sourdine mb-1">Comment il se joue</legend>
        <div className="space-y-1.5">
          {MODES_JEU.map((m) => (
            <label key={m.valeur} className="flex items-start gap-2 text-sm text-encre">
              <input type="radio" name="mode_jeu" className="mt-1" checked={mode === m.valeur} onChange={() => setMode(m.valeur)} />
              <span>
                {m.libelle}
                <span className="block text-xs text-sourdine">{m.aide}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-sourdine mt-1">Fixé au démarrage : on ne change plus de mode en cours d’exercice.</p>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Durée prévue (minutes, facultatif)</label>
          <input type="number" min="1" value={duree} onChange={(e) => setDuree(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Facteur de temps</label>
          <input type="number" min="0.1" step="0.1" value={facteur} onChange={(e) => setFacteur(e.target.value)} className="w-full" />
          <p className="text-xs text-sourdine mt-0.5">1 = temps réel ; 2 = le scénario avance deux fois plus vite que la montre.</p>
        </div>
      </div>

      {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours || !titre.trim()}>
          {enCours ? 'Création…' : 'Créer et préparer'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

/**
 * Génère un exercice en préparation depuis une trame (generer_exercice_commune) : objectifs et stimuli de la
 * trame, plus les pièges de la commune (défauts de préparation détectés en base), chacun avec un stimulus,
 * un objectif et une action attendue. L'exercice se prépare et se joue ensuite comme les autres.
 */
function FormulaireDepuisTrame({ contexteId, onAnnuler, onCree }) {
  const [trames, setTrames] = useState([])
  const [pieges, setPieges] = useState([])
  const [trameId, setTrameId] = useState('')
  const [titre, setTitre] = useState('')
  const [mode, setMode] = useState('sur_table')
  const [duree, setDuree] = useState('120')
  const [maxPieges, setMaxPieges] = useState('3')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    if (!contexteId) return
    supabase
      .from('exercice_trames')
      .select('id, code, titre, contexte_id, stimuli, pieges_couverts')
      .eq('actif', true)
      .or(`contexte_id.is.null,contexte_id.eq.${contexteId}`)
      .order('ordre')
      .then(({ data, error }) => {
        if (error) setErreur(texteErreur(error))
        else setTrames(data ?? [])
      })
    supabase.rpc('pieges_commune', { p_contexte: contexteId }).then(({ data }) => setPieges(data ?? []))
  }, [contexteId])

  const trame = trames.find((t) => t.id === trameId)
  const maxHeure = trame ? Math.max(...trame.stimuli.map((s) => s.heure_scenario_min)) : 0
  // Même choix que la base : un piège par type, ceux que la trame couvre d'abord, puis les plus graves.
  const ordreGravite = { haute: 0, moyenne: 1, basse: 2 }
  const retenus = Object.values(Object.fromEntries(pieges.map((p) => [p.code, p])))
    .sort((a, b) => {
      const c = Number(trame?.pieges_couverts.includes(b.code)) - Number(trame?.pieges_couverts.includes(a.code))
      return c || ordreGravite[a.gravite] - ordreGravite[b.gravite] || a.titre.localeCompare(b.titre)
    })
    .slice(0, Number(maxPieges) || 0)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    setErreur(null)
    const { data, error } = await supabase.rpc('generer_exercice_commune', {
      p_contexte: contexteId,
      p_trame: trameId,
      p_titre: titre.trim() || null,
      p_mode_jeu: mode,
      p_duree_min: duree === '' ? null : Number(duree),
      p_max_pieges: Number(maxPieges) || 0,
    })
    setEnCours(false)
    if (error) setErreur(texteErreur(error))
    else onCree(data)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Trame</label>
        <select required value={trameId} onChange={(e) => setTrameId(e.target.value)} className="w-full">
          <option value="">Choisir une trame…</option>
          {trames.map((t) => (
            <option key={t.id} value={t.id}>{t.titre}{t.contexte_id ? ' (commune)' : ''}</option>
          ))}
        </select>
        {trame && (
          <p className="text-xs text-sourdine mt-1">
            {trame.stimuli.length} stimuli sur {libelleHeureScenario(maxHeure)} de scénario.
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Titre (facultatif)</label>
        <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder={trame?.titre ?? ''} className="w-full" />
      </div>

      <fieldset>
        <legend className="block text-xs font-medium text-sourdine mb-1">Comment il se joue</legend>
        <div className="space-y-1.5">
          {MODES_JEU.map((m) => (
            <label key={m.valeur} className="flex items-start gap-2 text-sm text-encre">
              <input type="radio" name="mode_jeu_trame" className="mt-1" checked={mode === m.valeur} onChange={() => setMode(m.valeur)} />
              <span>
                {m.libelle}
                <span className="block text-xs text-sourdine">{m.aide}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Durée réelle (minutes)</label>
          <input type="number" min="1" value={duree} onChange={(e) => setDuree(e.target.value)} className="w-full" />
          <p className="text-xs text-sourdine mt-0.5">Le temps du scénario y est ramené par le facteur de temps.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Pièges à intégrer (au plus)</label>
          <input type="number" min="0" max="7" value={maxPieges} onChange={(e) => setMaxPieges(e.target.value)} className="w-full" />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-sourdine mb-1">Pièges retenus</p>
        {retenus.length === 0 ? (
          <p className="text-sm text-sourdine">Aucun défaut de préparation détecté dans la commune.</p>
        ) : (
          <ul className="text-sm space-y-0.5">
            {retenus.map((p) => (
              <li key={p.code}>
                <span className={`jeton mr-2 ${GRAVITES_PIEGE[p.gravite]?.classe ?? ''}`}>{p.gravite}</span>
                {p.titre}
                <span className="text-xs text-sourdine"> — {PIEGES_COMMUNE.find((x) => x.code === p.code)?.libelle}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours || !trameId}>
          {enCours ? 'Génération…' : 'Générer et préparer'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
