import { useEffect, useState } from 'react'
import { texteErreur } from '@plateforme-crise/shared'
import { supabase } from '../../lib/supabase'
import { useDonneesExercice } from '../../hooks/useDonneesExercice'
import { BoutonDiscret, BoutonPrincipal } from '../Boutons'
import Chronologie from './Chronologie'
import {
  GRAVITES,
  LIBELLE_CANAL,
  LIBELLE_DISCIPLINE,
  chrono,
  heureLocale,
  libelleTScenario,
  minutesScenario,
  verdictAction,
} from '../../lib/exercices'

/**
 * Animer l'exercice : chronomètre, prochain stimulus, grille d'observation, main courante, écarts, clôture.
 * Tout est écrit au fil de l'eau : rien n'est à ressaisir après coup.
 */
export default function ExerciceJouer({ ex, onClos }) {
  const { d, erreur: erreurChargement, recharger } = useDonneesExercice(ex.id, true)
  const [maintenant, setMaintenant] = useState(Date.now())
  const [erreur, setErreur] = useState(null)
  const [occupe, setOccupe] = useState(false)
  const [roleObservateur, setRoleObservateur] = useState('')

  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  async function agir(fn) {
    setOccupe(true)
    setErreur(null)
    try {
      const { error } = (await fn()) ?? {}
      if (error) {
        setErreur(texteErreur(error))
        return false
      }
      await recharger()
      return true
    } finally {
      setOccupe(false)
    }
  }

  if (!d) {
    return erreurChargement ? (
      <div>
        <p role="alert" className="text-sm text-chaud mb-2">{erreurChargement}</p>
        <BoutonDiscret onClick={recharger}>Réessayer</BoutonDiscret>
      </div>
    ) : (
      <p className="text-sm text-sourdine">Chargement…</p>
    )
  }

  const tScenario = minutesScenario(ex, maintenant)
  const aVenir = d.stimuli.filter((s) => s.statut === 'prevu')
  const prochain = aVenir[0] ?? null
  const autres = aVenir.slice(1)
  const nonObservees = d.actions.filter((a) => !verdictAction(a.id, d.observations)).length

  return (
    <div className="space-y-6">
      {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}
      {erreurChargement && <p role="alert" className="text-sm text-chaud">Actualisation impossible : {erreurChargement}</p>}

      {/* Chronomètre */}
      <div className="border border-trait rounded p-3 bg-fond flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="text-2xl font-semibold text-encre tabular-nums" aria-label="Temps réel écoulé">{chrono(ex, maintenant)}</span>
        <span className="text-sm text-encre">
          Scénario : <strong>{libelleTScenario(tScenario)}</strong>
          {Number(ex.facteur_temps) !== 1 && <span className="text-sourdine"> (temps ×{Number(ex.facteur_temps)})</span>}
        </span>
        {ex.duree_minutes && <span className="text-xs text-sourdine">durée prévue : {ex.duree_minutes} min</span>}
        <span className="text-xs text-sourdine">démarré à {heureLocale(ex.debut_reel)}</span>
      </div>

      {/* Prochain stimulus */}
      <section>
        <h2 className="text-sm font-semibold text-encre mb-1">Prochain stimulus</h2>
        {!prochain ? (
          <p className="text-sm text-sourdine border border-dashed border-trait rounded p-3">
            Tous les stimuli ont été lancés ou sautés. Vous pouvez poursuivre l’observation, puis clore l’exercice.
          </p>
        ) : (
          <CarteStimulus
            s={prochain}
            ex={ex}
            echu={prochain.heure_scenario_min <= tScenario}
            enSuspens={Math.max(0, prochain.heure_scenario_min - tScenario)}
            occupe={occupe}
            agir={agir}
            principal
          />
        )}
        {autres.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-sourdine cursor-pointer">{autres.length} autre{autres.length > 1 ? 's' : ''} stimulus à venir</summary>
            <ul className="space-y-1.5 mt-2">
              {autres.map((s) => (
                <li key={s.id}>
                  <CarteStimulus s={s} ex={ex} echu={s.heure_scenario_min <= tScenario} enSuspens={Math.max(0, s.heure_scenario_min - tScenario)} occupe={occupe} agir={agir} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Grille d'observation */}
      <section>
        <h2 className="text-sm font-semibold text-encre">Grille d’observation</h2>
        <p className="text-xs text-sourdine mb-2">
          Une action « pas encore observée » n’est pas une réussite : elle sera comptée comme non observée à la clôture.
        </p>
        <div className="mb-2">
          <input
            value={roleObservateur}
            onChange={(e) => setRoleObservateur(e.target.value)}
            placeholder="Votre rôle d’observateur (ex. observateur D5) — facultatif"
            aria-label="Rôle d’observateur"
            className="w-full sm:w-96"
          />
        </div>
        {d.actions.length === 0 ? (
          <p className="text-sm text-sourdine border border-dashed border-trait rounded p-3">
            Aucune action attendue n’a été préparée : rien ne sera mesuré à la clôture. Vous pouvez tout de même tenir la main courante ci-dessous.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {d.actions.map((a) => (
              <LigneAction key={a.id} a={a} d={d} ex={ex} role={roleObservateur} occupe={occupe} agir={agir} />
            ))}
          </ul>
        )}
      </section>

      {/* Main courante */}
      <section>
        <h2 className="text-sm font-semibold text-encre mb-1">Main courante</h2>
        <NoteLibre ex={ex} role={roleObservateur} occupe={occupe} agir={agir} />
        <div className="mt-2">
          <Chronologie d={d} />
        </div>
      </section>

      {/* Écarts */}
      <section>
        <h2 className="text-sm font-semibold text-encre">Écarts constatés</h2>
        <p className="text-xs text-sourdine mb-2">Ce qui a manqué au dispositif — jamais le nom d’une personne. L’action corrective peut être précisée maintenant ou au bilan.</p>
        <ListeEcarts d={d} agir={agir} />
        <FormulaireEcart ex={ex} d={d} agir={agir} />
      </section>

      {/* Clôture */}
      <section className="border-t border-trait pt-4">
        <h2 className="text-sm font-semibold text-encre mb-1">Clore l’exercice</h2>
        <p className="text-xs text-sourdine mb-2">
          La clôture fige le scénario, les observations et les écarts : ils deviennent la trace de l’exercice. Seul le suivi des actions
          correctives et le rapport final resteront modifiables.
        </p>
        <BoutonPrincipal
          disabled={occupe}
          onClick={async () => {
            const lignes = [
              aVenir.length > 0 ? `${aVenir.length} stimulus non joué${aVenir.length > 1 ? 's' : ''}` : null,
              nonObservees > 0 ? `${nonObservees} action${nonObservees > 1 ? 's' : ''} non observée${nonObservees > 1 ? 's' : ''}` : null,
            ].filter(Boolean)
            const texte = lignes.length
              ? `Clore l’exercice ? Il restera : ${lignes.join(' et ')}. Ils seront comptés comme tels, pas comme des réussites. Cette action est définitive.`
              : 'Clore l’exercice ? Cette action est définitive.'
            if (!window.confirm(texte)) return
            const ok = await agir(() => supabase.rpc('clore_exercice', { p_exercice: ex.id }))
            if (ok) onClos()
          }}
        >
          Clore l’exercice
        </BoutonPrincipal>
      </section>
    </div>
  )
}

function CarteStimulus({ s, ex, echu, enSuspens, occupe, agir, principal = false }) {
  return (
    <div className={`rounded border p-3 ${principal && echu ? 'border-chaud bg-fond' : 'border-trait bg-surface'}`}>
      <p className="text-xs text-sourdine mb-1">
        <span className="jeton mr-1">{libelleTScenario(s.heure_scenario_min)}</span>
        {LIBELLE_CANAL[s.canal] ?? s.canal}
        {s.emetteur && <> · de {s.emetteur}</>}
        {s.discipline_cible && <> → {LIBELLE_DISCIPLINE[s.discipline_cible] ?? s.discipline_cible}</>}
        {echu ? (
          <span className="ml-2 text-chaud font-medium">à lancer maintenant</span>
        ) : (
          <span className="ml-2">dans ~{Math.ceil(enSuspens)} min de scénario</span>
        )}
      </p>
      <p className={`text-encre ${principal ? 'text-base' : 'text-sm'}`}>{s.texte}</p>
      {s.note_animateur && <p className="text-xs text-sourdine mt-1">🔒 {s.note_animateur}</p>}
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <BoutonPrincipal disabled={occupe} onClick={() => agir(() => supabase.rpc('lancer_stimulus', { p_stimulus: s.id }))}>
          Lancer
        </BoutonPrincipal>
        <BoutonDiscret
          disabled={occupe}
          onClick={() => {
            if (window.confirm('Sauter ce stimulus ? Il sera compté comme sauté, pas comme joué.')) {
              agir(() => supabase.from('exercice_stimuli').update({ statut: 'saute' }).eq('id', s.id))
            }
          }}
        >
          Sauter
        </BoutonDiscret>
        {ex.mode_jeu === 'dans_outil' && (
          <span className="text-xs text-sourdine">Au lancement, une ligne « [EXERCICE] » est ajoutée au livre de bord de l’incident d’exercice.</span>
        )}
      </div>
    </div>
  )
}

function LigneAction({ a, d, ex, role, occupe, agir }) {
  const [note, setNote] = useState('')
  const verdict = verdictAction(a.id, d.observations)
  const stimulus = d.stimuli.find((s) => s.id === a.stimulus_id)
  const pasEncore = stimulus && stimulus.statut === 'prevu'
  const nbObs = d.observations.filter((o) => o.action_id === a.id).length

  async function consigner(atteint) {
    const ok = await agir(() =>
      supabase.from('exercice_observations').insert({
        exercice_id: ex.id,
        action_id: a.id,
        atteint,
        note: note.trim() || null,
        role_observateur: role.trim() || null,
      })
    )
    if (ok) setNote('')
  }

  return (
    <li className={`border border-trait rounded px-3 py-2 bg-surface ${pasEncore ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm text-encre">{a.action}</p>
          <p className="text-xs text-sourdine">
            {stimulus ? `suite à ${libelleTScenario(stimulus.heure_scenario_min)}${pasEncore ? ' — stimulus pas encore lancé' : ''}` : 'sans stimulus précis'}
            {a.outil_attendu && ` · outil : ${a.outil_attendu}`}
            {nbObs > 0 && ` · ${nbObs} observation${nbObs > 1 ? 's' : ''}`}
          </p>
        </div>
        <span
          className={`jeton ${verdict ? (verdict.atteint ? 'text-ok' : 'text-chaud') : 'text-sourdine'}`}
          title="Dernier verdict saisi"
        >
          {verdict ? `${verdict.atteint ? 'Atteinte' : 'Non atteinte'} · ${heureLocale(verdict.a)}` : 'Pas encore observée'}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="note (facultatif)" aria-label={`Note sur : ${a.action}`} className="flex-1 min-w-[10rem] text-sm" />
        <BoutonDiscret disabled={occupe} onClick={() => consigner(true)}>Atteinte</BoutonDiscret>
        <BoutonDiscret disabled={occupe} onClick={() => consigner(false)}>Non atteinte</BoutonDiscret>
        <BoutonDiscret disabled={occupe || !note.trim()} onClick={() => consigner(null)} title="Consigner la note sans trancher">Noter seulement</BoutonDiscret>
      </div>
    </li>
  )
}

function NoteLibre({ ex, role, occupe, agir }) {
  const [note, setNote] = useState('')
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        const ok = await agir(() =>
          supabase.from('exercice_observations').insert({ exercice_id: ex.id, action_id: null, atteint: null, note: note.trim(), role_observateur: role.trim() || null })
        )
        if (ok) setNote('')
      }}
    >
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Noter un fait (ex. le PC-Ops appelle directement la zone de secours)" aria-label="Noter un fait" className="flex-1 min-w-[14rem]" />
      <BoutonDiscret type="submit" disabled={occupe || !note.trim()}>Consigner</BoutonDiscret>
    </form>
  )
}

function ListeEcarts({ d, agir }) {
  if (d.ecarts.length === 0) return <p className="text-xs text-sourdine mb-2">Aucun écart consigné pour l’instant.</p>
  return (
    <ul className="space-y-1 mb-2">
      {d.ecarts.map((e) => (
        <li key={e.id} className="flex items-start justify-between gap-2 bg-surface border border-trait rounded px-2.5 py-1.5 text-sm">
          <span>
            <span className={`jeton mr-2 ${e.gravite === 'critique' ? 'text-chaud' : e.gravite === 'majeure' ? 'text-veille' : ''}`}>
              {GRAVITES.find((g) => g.valeur === e.gravite)?.libelle ?? e.gravite}
            </span>
            {e.ecart}
          </span>
          <BoutonDiscret aria-label="Retirer l’écart" onClick={() => agir(() => supabase.from('exercice_ecarts').delete().eq('id', e.id))}>
            ✕
          </BoutonDiscret>
        </li>
      ))}
    </ul>
  )
}

function FormulaireEcart({ ex, d, agir }) {
  const [ouvert, setOuvert] = useState(false)
  const [ecart, setEcart] = useState('')
  const [gravite, setGravite] = useState('majeure')
  const [actionId, setActionId] = useState('')
  const [corrective, setCorrective] = useState('')
  const [responsable, setResponsable] = useState('')
  const [echeance, setEcheance] = useState('')

  if (!ouvert) return <BoutonDiscret onClick={() => setOuvert(true)}>+ Consigner un écart</BoutonDiscret>

  return (
    <form
      className="border border-trait rounded p-3 bg-fond space-y-2"
      onSubmit={async (e) => {
        e.preventDefault()
        const ok = await agir(() =>
          supabase.from('exercice_ecarts').insert({
            exercice_id: ex.id,
            ecart: ecart.trim(),
            gravite,
            action_id: actionId || null,
            action_corrective: corrective.trim() || null,
            responsable: responsable.trim() || null,
            echeance: echeance || null,
          })
        )
        if (ok) {
          setEcart('')
          setCorrective('')
          setResponsable('')
          setEcheance('')
          setActionId('')
          setOuvert(false)
        }
      }}
    >
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Écart (ce que le dispositif n’a pas permis)</label>
        <textarea required value={ecart} onChange={(e) => setEcart(e.target.value)} rows={2} className="w-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Gravité</label>
          <select value={gravite} onChange={(e) => setGravite(e.target.value)} className="w-full">
            {GRAVITES.map((g) => <option key={g.valeur} value={g.valeur}>{g.libelle}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-sourdine mb-1">Action attendue concernée</label>
          <select value={actionId} onChange={(e) => setActionId(e.target.value)} className="w-full">
            <option value="">—</option>
            {d.actions.map((a) => <option key={a.id} value={a.id}>{a.action.slice(0, 70)}{a.action.length > 70 ? '…' : ''}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-sourdine mb-1">Action corrective (facultatif)</label>
          <input value={corrective} onChange={(e) => setCorrective(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Échéance</label>
          <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} className="w-full" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Responsable (service ou fonction, pas un nom)</label>
        <input value={responsable} onChange={(e) => setResponsable(e.target.value)} className="w-full" />
      </div>
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={!ecart.trim()}>Consigner l’écart</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={() => setOuvert(false)}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
