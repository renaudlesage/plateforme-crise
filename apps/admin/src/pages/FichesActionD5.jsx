import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = [
  { valeur: 'organisation', libelle: 'Organisation' },
  { valeur: 'activation', libelle: 'Activation' },
  { valeur: 'sirenes', libelle: 'Sirènes' },
  { valeur: 'medias', libelle: 'Médias' },
  { valeur: 'population', libelle: 'Population' },
  { valeur: 'evaluation', libelle: 'Évaluation' },
]

export default function FichesActionD5() {
  const [fiches, setFiches] = useState([])
  const [chargement, setChargement] = useState(true)
  const [filtre, setFiltre] = useState('')

  useEffect(() => {
    supabase
      .from('fiches_action_d5')
      .select('*')
      .order('numero')
      .then(({ data }) => {
        setFiches(data ?? [])
        setChargement(false)
      })
  }, [])

  const fichesFiltrees = filtre ? fiches.filter((f) => f.categorie === filtre) : fiches

  return (
    <div>
      <h1 className="text-xl font-semibold text-encre mb-1">Bibliothèque de fiches d'action D5</h1>
      <p className="text-sm text-sourdine mb-4">
        25 fiches standardisées (D5/1 à D5/25) du guide de communication de crise (IBZ, juin
        2007) — préparées avant la crise pour être prêtes pendant.
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <button type="button" onClick={() => setFiltre('')} className={`pastille-filtre${filtre === '' ? ' actif' : ''}`}>
          Toutes
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.valeur}
            type="button"
            onClick={() => setFiltre(c.valeur)}
            className={`pastille-filtre${filtre === c.valeur ? ' actif' : ''}`}
          >
            {c.libelle}
          </button>
        ))}
      </div>

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {fichesFiltrees.map((f) => (
            <li key={f.id} className="flex items-center justify-between px-4 py-2.5 bg-surface">
              <span className="text-sm text-encre">
                <span className="jeton mr-2">{f.code}</span>
                {f.titre}
              </span>
              <span className="text-xs text-sourdine">{CATEGORIES.find((c) => c.valeur === f.categorie)?.libelle}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
