import { useMemo, useState } from 'react'
import { LIBELLE_CANAL, LIBELLE_GRAVITE, heureLocale } from '../../lib/exercices'

/**
 * Main courante de l'exercice : stimuli lancés, observations et écarts, du plus récent au plus ancien.
 * C'est le livre de bord de l'animateur ; il décrit ce qui s'est passé, pas qui a mal fait.
 */
export default function Chronologie({ d, limite = 12 }) {
  const [tout, setTout] = useState(false)

  const evenements = useMemo(() => {
    const parAction = Object.fromEntries(d.actions.map((a) => [a.id, a]))
    const liste = []
    for (const s of d.stimuli) {
      if (s.statut === 'lance' && s.lance_a) {
        liste.push({
          cle: `s${s.id}`,
          t: s.lance_a,
          type: 'Stimulus',
          texte: `${LIBELLE_CANAL[s.canal] ?? s.canal}${s.emetteur ? ` · ${s.emetteur}` : ''} : ${s.texte}`,
        })
      }
    }
    for (const o of d.observations) {
      const action = o.action_id ? parAction[o.action_id] : null
      const verdict = o.atteint === true ? 'atteinte' : o.atteint === false ? 'non atteinte' : null
      const morceaux = [action ? `« ${action.action} »` : null, verdict, o.note].filter(Boolean)
      liste.push({
        cle: `o${o.id}`,
        t: o.horodatage,
        type: action ? 'Observation' : 'Note',
        texte: action && verdict ? `${morceaux[0]} — ${verdict}${o.note ? ` : ${o.note}` : ''}` : morceaux.join(' — '),
      })
    }
    for (const e of d.ecarts) {
      liste.push({ cle: `e${e.id}`, t: e.created_at, type: 'Écart', texte: `${LIBELLE_GRAVITE[e.gravite] ?? e.gravite} : ${e.ecart}` })
    }
    return liste.sort((a, b) => Date.parse(b.t) - Date.parse(a.t))
  }, [d])

  if (evenements.length === 0) {
    return <p className="text-xs text-sourdine">Rien de consigné pour l’instant.</p>
  }
  const visibles = tout ? evenements : evenements.slice(0, limite)
  return (
    <div>
      <ul className="divide-y divide-trait border border-trait rounded overflow-hidden">
        {visibles.map((e) => (
          <li key={e.cle} className="flex gap-3 px-3 py-1.5 bg-surface text-sm">
            <span className="text-xs text-sourdine w-12 flex-shrink-0 pt-0.5">{heureLocale(e.t)}</span>
            <span className="text-xs text-sourdine w-20 flex-shrink-0 pt-0.5">{e.type}</span>
            <span className="text-encre">{e.texte}</span>
          </li>
        ))}
      </ul>
      {evenements.length > limite && (
        <button type="button" className="lien text-xs mt-1" onClick={() => setTout((v) => !v)}>
          {tout ? 'Réduire' : `Voir les ${evenements.length - limite} plus anciennes`}
        </button>
      )}
    </div>
  )
}
