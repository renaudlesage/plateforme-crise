import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LIBELLE_TYPE_STIMULUS, TYPES_STIMULUS, exporterChronogramme, lireChronogramme, modeleChronogramme, texteErreur } from '@plateforme-crise/shared'
import { supabase } from '../../lib/supabase'
import { BoutonDiscret, BoutonPrincipal } from '../Boutons'
import {
  CANAUX,
  DISCIPLINES_EXERCICE,
  LIBELLE_CANAL,
  LIBELLE_DISCIPLINE,
  MODES_JEU,
  TYPES_EXERCICE,
  libelleTScenario,
} from '../../lib/exercices'
import ExerciceConjoint from './ExerciceConjoint'
import { nomDeFichier, telecharger } from '../../lib/telechargement'

// Les colonnes de C5 (type, destinataires, décompte, livrable) n'existent qu'une fois sa migration appliquée.
const avecImmersion = (ex) => ex.diffusion_auto !== undefined

/**
 * Préparer un exercice : réglages, objectifs, stimuli (ce que l'animateur injecte), actions attendues,
 * animateurs, et — en mode « dans l'outil » — l'incident d'exercice. Modifiable tant que l'exercice est en préparation.
 */
export default function ExercicePreparer({ ex, onChange, onDemarre }) {
  const editable = ex.statut === 'preparation'
  const [d, setD] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [occupe, setOccupe] = useState(false)

  const charger = useCallback(async () => {
    const [ob, st, ac, so, an] = await Promise.all([
      supabase.from('exercice_objectifs').select('*').eq('exercice_id', ex.id).order('ordre'),
      supabase.from('exercice_stimuli').select('*').eq('exercice_id', ex.id).order('heure_scenario_min').order('ordre'),
      supabase.from('exercice_actions_attendues').select('*').eq('exercice_id', ex.id).order('ordre'),
      supabase.from('exercice_sources').select('*').eq('exercice_id', ex.id),
      supabase.rpc('lister_animateurs_exercice', { p_exercice: ex.id }),
    ])
    const echec = [ob, st, ac, so, an].find((r) => r.error)
    if (echec) {
      setErreur(texteErreur(echec.error))
      return
    }
    setErreur(null)
    setD({ objectifs: ob.data ?? [], stimuli: st.data ?? [], actions: ac.data ?? [], sources: so.data ?? [], animateurs: an.data ?? [] })
  }, [ex.id])

  useEffect(() => {
    charger()
  }, [charger])

  /** Exécute une écriture, affiche l'erreur telle quelle (traduite) et recharge. */
  async function agir(fn) {
    setOccupe(true)
    setErreur(null)
    try {
      const { error } = (await fn()) ?? {}
      if (error) {
        setErreur(texteErreur(error))
        return false
      }
      await charger()
      return true
    } finally {
      setOccupe(false)
    }
  }

  if (!d) {
    return erreur ? (
      <div>
        <p role="alert" className="text-sm text-chaud mb-2">{erreur}</p>
        <BoutonDiscret onClick={charger}>Réessayer</BoutonDiscret>
      </div>
    ) : (
      <p className="text-sm text-sourdine">Chargement…</p>
    )
  }

  const pret = d.stimuli.length > 0 && (ex.mode_jeu !== 'dans_outil' || !!ex.incident_id)

  return (
    <div className="space-y-6">
      {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}
      {!editable && (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-3">
          L’exercice a démarré : le scénario est en lecture seule ici. Tout se passe dans l’onglet « Jouer ».
        </p>
      )}

      {editable && <Reglages ex={ex} onEnregistre={onChange} />}

      <Section titre="Objectifs" aide="Ce que l’exercice cherche à vérifier. Un objectif sans action attendue ne pourra pas être mesuré.">
        <ListeObjectifs d={d} ex={ex} editable={editable} agir={agir} occupe={occupe} />
      </Section>

      <Section titre="Stimuli" aide="Les messages que l’animateur injecte, à l’heure du scénario. Les notes d’animateur ne sont jamais montrées aux joueurs.">
        <ListeStimuli d={d} ex={ex} editable={editable} agir={agir} />
        <Chronogramme d={d} ex={ex} editable={editable} agir={agir} />
      </Section>

      <Section titre="Actions attendues" aide="Ce qu’un dispositif solide devrait faire face à chaque stimulus : c’est la grille d’observation du jour J.">
        <ListeActions d={d} ex={ex} editable={editable} agir={agir} />
      </Section>

      <Section titre="Animateurs" aide="Les seuls à voir le scénario. Le créateur et les administrateurs du contexte le sont d’office.">
        <Animateurs d={d} ex={ex} agir={agir} editable={editable} />
      </Section>

      {ex.mode_jeu === 'dans_outil' && <PanneauIncident ex={ex} onChange={onChange} editable={editable} />}

      <ExerciceConjoint ex={ex} editable={editable} onChange={onChange} />

      {editable && (
        <Section titre="Démarrer" aide="Le chronomètre part au démarrage ; le mode, la durée et le facteur de temps sont alors fixés.">
          <ul className="text-sm mb-3 space-y-0.5">
            <li className={d.stimuli.length > 0 ? 'text-ok' : 'text-sourdine'}>
              {d.stimuli.length > 0 ? '✓' : '○'} au moins un stimulus ({d.stimuli.length})
            </li>
            {ex.mode_jeu === 'dans_outil' && (
              <li className={ex.incident_id ? 'text-ok' : 'text-sourdine'}>
                {ex.incident_id ? '✓' : '○'} incident d’exercice ouvert
              </li>
            )}
            <li className={d.actions.length > 0 ? 'text-ok' : 'text-sourdine'}>
              {d.actions.length > 0 ? '✓' : '○'} actions attendues ({d.actions.length}) — sans elles, aucune mesure à la clôture
            </li>
          </ul>
          <BoutonPrincipal
            disabled={!pret || occupe}
            onClick={async () => {
              if (!window.confirm('Démarrer l’exercice ? Le chronomètre part maintenant ; le mode, la durée et le facteur de temps ne pourront plus changer.')) return
              const ok = await agir(() => supabase.rpc('demarrer_exercice', { p_exercice: ex.id }))
              if (ok) onDemarre()
            }}
          >
            Démarrer l’exercice
          </BoutonPrincipal>
        </Section>
      )}
    </div>
  )
}

function Section({ titre, aide, children }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-encre">{titre}</h2>
      {aide && <p className="text-xs text-sourdine mb-2">{aide}</p>}
      {children}
    </section>
  )
}

/* ───────────── Réglages ───────────── */

function Reglages({ ex, onEnregistre }) {
  const [titre, setTitre] = useState(ex.titre ?? '')
  const [type, setType] = useState(ex.type_exercice)
  const [mode, setMode] = useState(ex.mode_jeu)
  const [duree, setDuree] = useState(ex.duree_minutes ?? '')
  const [facteur, setFacteur] = useState(ex.facteur_temps ?? 1)
  const [date, setDate] = useState(ex.date_planifiee ?? '')
  const [erreur, setErreur] = useState(null)
  const [ok, setOk] = useState(false)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    setErreur(null)
    setOk(false)
    const { error } = await supabase
      .from('exercices')
      .update({
        titre: titre.trim(),
        type_exercice: type,
        mode_jeu: mode,
        duree_minutes: duree === '' ? null : Number(duree),
        facteur_temps: Number(facteur) || 1,
        date_planifiee: date || null,
      })
      .eq('id', ex.id)
    setEnCours(false)
    if (error) setErreur(texteErreur(error))
    else {
      setOk(true)
      onEnregistre()
    }
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-3 bg-fond space-y-3">
      <h2 className="text-sm font-semibold text-encre">Réglages</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-sourdine mb-1">Titre</label>
          <input required value={titre} onChange={(e) => setTitre(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Nature</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full">
            {TYPES_EXERCICE.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Mode de jeu</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full">
            {MODES_JEU.map((m) => <option key={m.valeur} value={m.valeur}>{m.libelle}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Date prévue</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Durée (min)</label>
            <input type="number" min="1" value={duree} onChange={(e) => setDuree(e.target.value)} className="w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Facteur de temps</label>
            <input type="number" min="0.1" step="0.1" value={facteur} onChange={(e) => setFacteur(e.target.value)} className="w-full" />
          </div>
        </div>
      </div>
      {mode !== ex.mode_jeu && ex.incident_id && (
        <p className="text-xs text-chaud">Un incident d’exercice est déjà ouvert : revenir à « sur table » ne le supprime pas.</p>
      )}
      {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}
      <div className="flex items-center gap-3">
        <BoutonDiscret type="submit" disabled={enCours || !titre.trim()}>{enCours ? 'Enregistrement…' : 'Enregistrer les réglages'}</BoutonDiscret>
        {ok && <span role="status" className="text-xs text-ok">Enregistré</span>}
      </div>
    </form>
  )
}

/* ───────────── Objectifs ───────────── */

function ListeObjectifs({ d, ex, editable, agir, occupe }) {
  const [code, setCode] = useState('')
  const [intitule, setIntitule] = useState('')
  const [discipline, setDiscipline] = useState('')
  const repris = Array.isArray(ex.objectifs_jsonb) ? ex.objectifs_jsonb.filter((x) => typeof x === 'string' && x.trim()) : []

  async function ajouter(e) {
    e.preventDefault()
    const ok = await agir(() =>
      supabase.from('exercice_objectifs').insert({
        exercice_id: ex.id,
        ordre: d.objectifs.length + 1,
        code: code.trim() || `O${d.objectifs.length + 1}`,
        intitule: intitule.trim(),
        discipline: discipline || null,
      })
    )
    if (ok) {
      setCode('')
      setIntitule('')
      setDiscipline('')
    }
  }

  return (
    <div>
      {d.objectifs.length === 0 ? (
        <p className="text-xs text-sourdine mb-2">Aucun objectif pour l’instant.</p>
      ) : (
        <ul className="space-y-1 mb-2">
          {d.objectifs.map((o) => (
            <li key={o.id} className="flex items-start justify-between gap-2 bg-surface border border-trait rounded px-2.5 py-1.5 text-sm">
              <span>
                <span className="jeton mr-2">{o.code}</span>
                {o.intitule}
                {o.discipline && <span className="text-xs text-sourdine"> · {LIBELLE_DISCIPLINE[o.discipline] ?? o.discipline}</span>}
              </span>
              {editable && (
                <BoutonDiscret
                  aria-label={`Retirer l’objectif ${o.code}`}
                  onClick={() => agir(() => supabase.from('exercice_objectifs').delete().eq('id', o.id))}
                >
                  ✕
                </BoutonDiscret>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && d.objectifs.length === 0 && repris.length > 0 && (
        <div className="mb-2">
          <BoutonDiscret
            disabled={occupe}
            onClick={() =>
              agir(() =>
                supabase.from('exercice_objectifs').insert(
                  repris.map((t, i) => ({ exercice_id: ex.id, ordre: i + 1, code: `O${i + 1}`, intitule: t.trim() }))
                )
              )
            }
          >
            Reprendre les {repris.length} objectifs saisis dans l’Admin
          </BoutonDiscret>
        </div>
      )}

      {editable && (
        <form onSubmit={ajouter} className="flex flex-wrap gap-2 items-start">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={`O${d.objectifs.length + 1}`} aria-label="Code" className="w-20" />
          <input required value={intitule} onChange={(e) => setIntitule(e.target.value)} placeholder="ex. Activer la cellule de crise dans les 30 min" aria-label="Intitulé" className="flex-1 min-w-[14rem]" />
          <select value={discipline} onChange={(e) => setDiscipline(e.target.value)} aria-label="Discipline">
            <option value="">Discipline —</option>
            {DISCIPLINES_EXERCICE.map((x) => <option key={x.valeur} value={x.valeur}>{x.libelle}</option>)}
          </select>
          <BoutonDiscret type="submit" disabled={!intitule.trim()}>Ajouter</BoutonDiscret>
        </form>
      )}
    </div>
  )
}

/* ───────────── Stimuli ───────────── */

function ListeStimuli({ d, ex, editable, agir }) {
  const [enEdition, setEnEdition] = useState(null) // id | 'nouveau' | null
  const ordreSuivant = d.stimuli.reduce((m, s) => Math.max(m, s.ordre ?? 0), 0) + 1

  return (
    <div>
      {d.stimuli.length === 0 && enEdition !== 'nouveau' && <p className="text-xs text-sourdine mb-2">Aucun stimulus pour l’instant.</p>}
      <ul className="space-y-1.5 mb-2">
        {d.stimuli.map((s) =>
          enEdition === s.id ? (
            <li key={s.id}>
              <FormulaireStimulus
                ex={ex}
                objectifs={d.objectifs}
                stimulus={s}
                source={d.sources.find((x) => x.stimulus_id === s.id)}
                agir={agir}
                onFini={() => setEnEdition(null)}
              />
            </li>
          ) : (
            <li key={s.id} className="bg-surface border border-trait rounded px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-sourdine">
                    <span className="jeton mr-1">{libelleTScenario(s.heure_scenario_min)}</span>
                    {s.type_stimulus && s.type_stimulus !== 'message' && <span className="jeton mr-1">{LIBELLE_TYPE_STIMULUS[s.type_stimulus]}</span>}
                    {LIBELLE_CANAL[s.canal] ?? s.canal}
                    {s.emetteur && <> · de {s.emetteur}</>}
                    {(s.destinataires ?? (s.discipline_cible ? [s.discipline_cible] : null))?.length > 0 && s.type_stimulus !== 'publication' && (
                      <> → {(s.destinataires ?? [s.discipline_cible]).map(libelleRole).join(', ')}</>
                    )}
                    {s.decompte_minutes && <> · décompte {s.decompte_minutes} min</>}
                  </p>
                  <p className="text-encre">{s.texte}</p>
                  {s.livrable && <p className="text-xs text-sourdine mt-0.5">🔒 livrable attendu : {s.livrable}</p>}
                  {s.note_animateur && <p className="text-xs text-sourdine mt-0.5">🔒 note d’animateur : {s.note_animateur}</p>}
                  {(() => {
                    const o = d.objectifs.find((x) => x.id === s.objectif_id)
                    return o ? <p className="text-xs text-sourdine">objectif {o.code}</p> : null
                  })()}
                  {(() => {
                    const so = d.sources.find((x) => x.stimulus_id === s.id)
                    return so ? <p className="text-xs text-sourdine">inspiré de : {so.description}</p> : null
                  })()}
                </div>
                {editable && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button type="button" className="lien text-xs" onClick={() => setEnEdition(s.id)}>Modifier</button>
                    <BoutonDiscret
                      aria-label="Retirer le stimulus"
                      onClick={() => {
                        if (window.confirm('Retirer ce stimulus ? Les actions attendues qui y sont liées sont conservées, mais sans stimulus précis.')) {
                          agir(() => supabase.from('exercice_stimuli').delete().eq('id', s.id))
                        }
                      }}
                    >
                      ✕
                    </BoutonDiscret>
                  </div>
                )}
              </div>
            </li>
          )
        )}
      </ul>
      {editable &&
        (enEdition === 'nouveau' ? (
          <FormulaireStimulus ex={ex} objectifs={d.objectifs} ordreSuivant={ordreSuivant} agir={agir} onFini={() => setEnEdition(null)} />
        ) : (
          <BoutonDiscret onClick={() => setEnEdition('nouveau')}>+ Ajouter un stimulus</BoutonDiscret>
        ))}
    </div>
  )
}

function FormulaireStimulus({ ex, objectifs, stimulus, source, ordreSuivant, agir, onFini }) {
  const [heure, setHeure] = useState(stimulus?.heure_scenario_min ?? 0)
  const [canal, setCanal] = useState(stimulus?.canal ?? 'telephone')
  const [emetteur, setEmetteur] = useState(stimulus?.emetteur ?? '')
  const immersion = avecImmersion(ex)
  const [type, setType] = useState(stimulus?.type_stimulus ?? 'message')
  const [roles, setRoles] = useState(stimulus?.destinataires ?? (stimulus?.discipline_cible ? [stimulus.discipline_cible] : []))
  const [decompte, setDecompte] = useState(stimulus?.decompte_minutes ?? 30)
  const [livrable, setLivrable] = useState(stimulus?.livrable ?? '')
  const [texte, setTexte] = useState(stimulus?.texte ?? '')
  const [note, setNote] = useState(stimulus?.note_animateur ?? '')
  const [objectifId, setObjectifId] = useState(stimulus?.objectif_id ?? '')
  const [inspire, setInspire] = useState(source?.description ?? '')

  async function soumettre(e) {
    e.preventDefault()
    const champs = {
      heure_scenario_min: Math.max(0, Number(heure) || 0),
      canal,
      emetteur: emetteur.trim() || null,
      // Une seule discipline : elle reste aussi la cible historique (vue animateur, trames) ; plusieurs : liste seule.
      discipline_cible: type === 'message' && roles.length === 1 && roles[0] !== 'tous' ? roles[0] : null,
      texte: texte.trim(),
      note_animateur: note.trim() || null,
      objectif_id: objectifId || null,
      ...(immersion && {
        type_stimulus: type,
        destinataires: type === 'message' && roles.length ? roles : null,
        decompte_minutes: type === 'decompte' ? Math.min(1440, Math.max(1, Math.round(Number(decompte) || 1))) : null,
        livrable: livrable.trim() || null,
      }),
    }
    const ok = await agir(async () => {
      let stimId = stimulus?.id
      if (stimulus) {
        const { error } = await supabase.from('exercice_stimuli').update(champs).eq('id', stimulus.id)
        if (error) return { error }
      } else {
        const { data, error } = await supabase
          .from('exercice_stimuli')
          .insert({ ...champs, exercice_id: ex.id, ordre: ordreSuivant })
          .select('id')
          .single()
        if (error) return { error }
        stimId = data.id
      }
      const desc = inspire.trim()
      if (desc && source) return supabase.from('exercice_sources').update({ description: desc }).eq('id', source.id)
      if (desc) return supabase.from('exercice_sources').insert({ exercice_id: ex.id, stimulus_id: stimId, description: desc })
      if (source) return supabase.from('exercice_sources').delete().eq('id', source.id)
      return { error: null }
    })
    if (ok) onFini()
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-3 bg-fond space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Heure scénario (min)</label>
          <input type="number" min="0" value={heure} onChange={(e) => setHeure(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Canal</label>
          <select value={canal} onChange={(e) => setCanal(e.target.value)} className="w-full">
            {CANAUX.map((c) => <option key={c.valeur} value={c.valeur}>{c.libelle}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Émetteur</label>
          <input value={emetteur} onChange={(e) => setEmetteur(e.target.value)} placeholder="ex. Police locale" className="w-full" />
        </div>
        {immersion ? (
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full">
              {TYPES_STIMULUS.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Destinataire</label>
            <select value={roles[0] ?? ''} onChange={(e) => setRoles(e.target.value ? [e.target.value] : [])} className="w-full">
              <option value="">—</option>
              {DISCIPLINES_EXERCICE.map((x) => <option key={x.valeur} value={x.valeur}>{x.libelle}</option>)}
            </select>
          </div>
        )}
      </div>
      {immersion && <p className="text-xs text-sourdine">{TYPES_STIMULUS.find((t) => t.valeur === type)?.aide}</p>}
      {immersion && type === 'message' && (
        <fieldset>
          <legend className="block text-xs font-medium text-sourdine mb-1">Destinataires (boîtes de réception des joueurs ; aucun = tous)</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {[{ valeur: 'tous', libelle: 'Tous' }, ...DISCIPLINES_EXERCICE].map((x) => (
              <label key={x.valeur} className="text-sm flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={roles.includes(x.valeur)}
                  onChange={(e) => setRoles((r) => (e.target.checked ? [...r, x.valeur] : r.filter((v) => v !== x.valeur)))}
                />
                {x.libelle}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {immersion && type === 'decompte' && (
        <div className="w-40">
          <label className="block text-xs font-medium text-sourdine mb-1">Durée du décompte (min)</label>
          <input type="number" min="1" max="1440" required value={decompte} onChange={(e) => setDecompte(e.target.value)} className="w-full" />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">
          {type === 'publication' ? 'Publication telle qu’elle paraîtra sur le fil social simulé (#hashtags permis)' : type === 'decompte' ? 'Intitulé du décompte (ex. « Premier rapport au gouverneur »)' : 'Message tel qu’il sera lu aux joueurs'}
        </label>
        <textarea required value={texte} onChange={(e) => setTexte(e.target.value)} rows={2} className="w-full" />
      </div>
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Note d’animateur (jamais montrée aux joueurs)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full" />
      </div>
      {immersion && (
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Livrable attendu (facultatif, jamais montré aux joueurs)</label>
          <input value={livrable} maxLength={500} onChange={(e) => setLivrable(e.target.value)} placeholder="ex. communiqué de presse validé par le bourgmestre" className="w-full" />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Objectif visé</label>
          <select value={objectifId} onChange={(e) => setObjectifId(e.target.value)} className="w-full">
            <option value="">—</option>
            {objectifs.map((o) => <option key={o.id} value={o.id}>{o.code} — {o.intitule}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Inspiré de (facultatif)</label>
          <input value={inspire} onChange={(e) => setInspire(e.target.value)} placeholder="ex. écart relevé lors de l’exercice 2025" className="w-full" />
        </div>
      </div>
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={!texte.trim()}>{stimulus ? 'Enregistrer' : 'Ajouter'}</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onFini}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function libelleRole(r) {
  return r === 'tous' ? 'Tous' : LIBELLE_DISCIPLINE[r] ?? r
}

/* ───────────── Chronogramme : import et export (CSV pour Excel) ───────────── */

function Chronogramme({ d, ex, editable, agir }) {
  const [apercu, setApercu] = useState(null) // { nom, stimuli, erreurs, colonnesIgnorees }
  const immersion = avecImmersion(ex)

  async function lireFichier(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!/\.(csv|txt)$/i.test(f.name)) {
      setApercu({ nom: f.name, stimuli: [], erreurs: [{ ligne: 0, message: 'Enregistrez le classeur au format « CSV UTF-8 » depuis Excel, puis importez ce fichier.' }], colonnesIgnorees: [] })
      return
    }
    setApercu({ nom: f.name, ...lireChronogramme(await f.text()) })
  }

  // Sans la migration C5, seuls les messages s'importent (pas de colonne pour les publications ni les décomptes).
  const aImporter = apercu ? apercu.stimuli.filter((s) => immersion || s.type_stimulus === 'message') : []
  const ignores = apercu ? apercu.stimuli.length - aImporter.length : 0

  async function importer() {
    const premierOrdre = d.stimuli.reduce((m, s) => Math.max(m, s.ordre ?? 0), 0) + 1
    const ok = await agir(async () => {
      const lignes = aImporter.map((s, i) => ({
        exercice_id: ex.id,
        ordre: premierOrdre + i,
        heure_scenario_min: s.heure_scenario_min,
        canal: s.canal,
        emetteur: s.emetteur,
        discipline_cible: s.destinataires?.length === 1 && s.destinataires[0] !== 'tous' ? s.destinataires[0] : null,
        texte: s.texte,
        note_animateur: s.note_animateur,
        ...(immersion && {
          type_stimulus: s.type_stimulus,
          destinataires: s.destinataires,
          decompte_minutes: s.decompte_minutes,
          livrable: s.livrable,
        }),
      }))
      const { data, error } = await supabase.from('exercice_stimuli').insert(lignes).select('id, ordre')
      if (error) return { error }
      // Réaction attendue → action attendue liée au stimulus : la grille d'observation du jour J.
      const premiereAction = d.actions.length + 1
      const actions = aImporter
        .map((s, i) => ({ s, id: data.find((x) => x.ordre === premierOrdre + i)?.id }))
        .filter(({ s, id }) => s.reaction_attendue && id)
        .map(({ s, id }, k) => ({ exercice_id: ex.id, stimulus_id: id, ordre: premiereAction + k, action: s.reaction_attendue }))
      if (actions.length) return supabase.from('exercice_actions_attendues').insert(actions)
      return { error: null }
    })
    if (ok) setApercu(null)
  }

  return (
    <div className="mt-3 border-t border-trait pt-3">
      <p className="text-xs font-medium text-sourdine mb-1">Chronogramme (tableur)</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <BoutonDiscret
          disabled={d.stimuli.length === 0}
          onClick={() => telecharger(`chronogramme-${nomDeFichier(ex.titre)}.csv`, exporterChronogramme(d.stimuli, d.actions))}
        >
          Exporter le chronogramme
        </BoutonDiscret>
        {editable && (
          <>
            <BoutonDiscret onClick={() => telecharger('modele-chronogramme.csv', modeleChronogramme())}>Modèle vierge</BoutonDiscret>
            <label className="lien cursor-pointer">
              Importer un chronogramme…
              <input type="file" accept=".csv,.txt,text/csv" onChange={lireFichier} className="sr-only" />
            </label>
          </>
        )}
      </div>
      <p className="text-xs text-sourdine mt-1">
        Format CSV (point-virgule), qu’Excel ouvre et enregistre (« CSV UTF-8 »). Colonnes : Horaire (« 0:45 », « T+45 », « J+2 »),
        Type, Canal, Émetteur, Destinataires, Stimulus, Réaction attendue, Note animateur, Livrable, Durée décompte (min).
        La réaction attendue devient une action attendue liée au stimulus.
      </p>

      {apercu && (
        <div className="border border-trait rounded p-3 bg-fond mt-2 text-sm space-y-2">
          <p>
            <strong>{apercu.nom}</strong> : {apercu.stimuli.length} stimulus lisible{apercu.stimuli.length > 1 ? 's' : ''}
            {apercu.erreurs.length > 0 && <>, {apercu.erreurs.length} ligne{apercu.erreurs.length > 1 ? 's' : ''} refusée{apercu.erreurs.length > 1 ? 's' : ''}</>}.
            {' '}Les stimuli importés s’ajoutent à ceux qui existent.
          </p>
          {apercu.colonnesIgnorees.length > 0 && <p className="text-xs text-sourdine">Colonnes ignorées : {apercu.colonnesIgnorees.join(', ')}.</p>}
          {ignores > 0 && <p className="text-xs text-chaud">{ignores} publication(s) ou décompte(s) ignoré(s) : la migration C5 n’est pas encore appliquée.</p>}
          {apercu.erreurs.length > 0 && (
            <ul className="text-xs text-chaud list-disc pl-5">
              {apercu.erreurs.slice(0, 20).map((e) => <li key={e.ligne}>{e.ligne ? `Ligne ${e.ligne} : ` : ''}{e.message}</li>)}
              {apercu.erreurs.length > 20 && <li>… et {apercu.erreurs.length - 20} autre(s).</li>}
            </ul>
          )}
          {aImporter.length > 0 && (
            <ul className="text-xs max-h-48 overflow-auto">
              {aImporter.map((s) => (
                <li key={s.ligne}>
                  {libelleTScenario(s.heure_scenario_min)} · {LIBELLE_TYPE_STIMULUS[s.type_stimulus]}
                  {s.emetteur && ` · ${s.emetteur}`} : {s.texte.slice(0, 90)}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <BoutonPrincipal disabled={aImporter.length === 0} onClick={importer}>
              Importer {aImporter.length} stimulus
            </BoutonPrincipal>
            <BoutonDiscret onClick={() => setApercu(null)}>Annuler</BoutonDiscret>
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────────── Actions attendues ───────────── */

function ListeActions({ d, ex, editable, agir }) {
  const [action, setAction] = useState('')
  const [objectifId, setObjectifId] = useState('')
  const [stimulusId, setStimulusId] = useState('')
  const [outil, setOutil] = useState('')

  async function ajouter(e) {
    e.preventDefault()
    const ok = await agir(() =>
      supabase.from('exercice_actions_attendues').insert({
        exercice_id: ex.id,
        ordre: d.actions.length + 1,
        action: action.trim(),
        objectif_id: objectifId || null,
        stimulus_id: stimulusId || null,
        outil_attendu: outil.trim() || null,
      })
    )
    if (ok) {
      setAction('')
      setOutil('')
    }
  }

  return (
    <div>
      {d.actions.length === 0 ? (
        <p className="text-xs text-sourdine mb-2">Aucune action attendue pour l’instant.</p>
      ) : (
        <ul className="space-y-1 mb-2">
          {d.actions.map((a) => {
            const o = d.objectifs.find((x) => x.id === a.objectif_id)
            const s = d.stimuli.find((x) => x.id === a.stimulus_id)
            return (
              <li key={a.id} className="flex items-start justify-between gap-2 bg-surface border border-trait rounded px-2.5 py-1.5 text-sm">
                <span>
                  {a.action}
                  <span className="block text-xs text-sourdine">
                    {s ? `suite à : ${libelleTScenario(s.heure_scenario_min)} ${s.emetteur ? `(${s.emetteur})` : ''}` : 'sans stimulus précis'}
                    {o && ` · objectif ${o.code}`}
                    {a.outil_attendu && ` · outil : ${a.outil_attendu}`}
                  </span>
                </span>
                {editable && (
                  <BoutonDiscret aria-label="Retirer l’action attendue" onClick={() => agir(() => supabase.from('exercice_actions_attendues').delete().eq('id', a.id))}>
                    ✕
                  </BoutonDiscret>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {editable && (
        <form onSubmit={ajouter} className="space-y-2">
          <input required value={action} onChange={(e) => setAction(e.target.value)} placeholder="ex. Informer le bourgmestre de la coupure de route" aria-label="Action attendue" className="w-full" />
          <div className="flex flex-wrap gap-2">
            <select value={stimulusId} onChange={(e) => setStimulusId(e.target.value)} aria-label="Stimulus lié">
              <option value="">Stimulus lié —</option>
              {d.stimuli.map((s) => <option key={s.id} value={s.id}>{libelleTScenario(s.heure_scenario_min)} · {s.texte.slice(0, 40)}{s.texte.length > 40 ? '…' : ''}</option>)}
            </select>
            <select value={objectifId} onChange={(e) => setObjectifId(e.target.value)} aria-label="Objectif lié">
              <option value="">Objectif lié —</option>
              {d.objectifs.map((o) => <option key={o.id} value={o.id}>{o.code} — {o.intitule.slice(0, 40)}</option>)}
            </select>
            <input value={outil} onChange={(e) => setOutil(e.target.value)} placeholder="outil attendu (facultatif)" aria-label="Outil attendu" className="flex-1 min-w-[10rem]" />
            <BoutonDiscret type="submit" disabled={!action.trim()}>Ajouter</BoutonDiscret>
          </div>
        </form>
      )}
    </div>
  )
}

/* ───────────── Animateurs ───────────── */

function Animateurs({ d, ex, agir, editable }) {
  const [email, setEmail] = useState('')
  return (
    <div>
      <ul className="space-y-1 mb-2">
        {d.animateurs.map((a) => (
          <li key={a.user_id} className="bg-surface border border-trait rounded px-2.5 py-1.5 text-sm">{a.email}</li>
        ))}
      </ul>
      {editable && (
        <form
          className="flex flex-wrap gap-2 items-center"
          onSubmit={async (e) => {
            e.preventDefault()
            const ok = await agir(() => supabase.rpc('ajouter_animateur_exercice', { p_exercice: ex.id, p_email: email }))
            if (ok) setEmail('')
          }}
        >
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="adresse d’un membre du contexte" aria-label="Adresse du co-animateur" className="flex-1 min-w-[14rem]" />
          <BoutonDiscret type="submit" disabled={!email.trim()}>Ajouter un co-animateur</BoutonDiscret>
        </form>
      )}
      <p className="text-xs text-sourdine mt-1">Le retrait d’un animateur n’est pas encore possible depuis cet écran.</p>
    </div>
  )
}

/* ───────────── Incident d'exercice (mode « dans l'outil ») ───────────── */

function PanneauIncident({ ex, onChange, editable }) {
  const [erreur, setErreur] = useState(null)
  const [besoinDerogation, setBesoinDerogation] = useState(false)
  const [enCours, setEnCours] = useState(false)

  async function ouvrir(derogation) {
    setEnCours(true)
    setErreur(null)
    const { error } = await supabase.rpc('ouvrir_incident_exercice', { p_exercice: ex.id, p_derogation: derogation })
    setEnCours(false)
    if (error) {
      if (/événement réel/i.test(error.message ?? '')) setBesoinDerogation(true)
      setErreur(texteErreur(error))
    } else {
      setBesoinDerogation(false)
      onChange()
    }
  }

  return (
    <Section
      titre="Incident d’exercice"
      aide="Un incident marqué « exercice » sert de support de jeu : il ne peut déclencher aucune alerte publique, n’accepte aucun signalement citoyen et reste visible comme exercice partout."
    >
      {ex.incident_id ? (
        <p className="text-sm text-encre">
          Ouvert. <Link to={`/incidents/${ex.incident_id}`} className="lien">Voir l’incident d’exercice</Link>
          {ex.statut === 'termine' && ' (clos avec l’exercice)'}
        </p>
      ) : editable ? (
        <div className="space-y-2">
          {besoinDerogation && (
            <p role="alert" className="text-sm text-chaud border border-trait rounded p-2">
              Un événement réel est en cours dans ce contexte. Jouer un exercice en même temps risque de brouiller la situation réelle.
              Ne poursuivez que si vous l’avez décidé explicitement.
            </p>
          )}
          {erreur && !besoinDerogation && <p role="alert" className="text-sm text-chaud">{erreur}</p>}
          {besoinDerogation ? (
            <div className="flex gap-2">
              <BoutonDiscret disabled={enCours} onClick={() => ouvrir(true)}>Ouvrir quand même (dérogation explicite)</BoutonDiscret>
              <BoutonDiscret onClick={() => { setBesoinDerogation(false); setErreur(null) }}>Renoncer</BoutonDiscret>
            </div>
          ) : (
            <BoutonDiscret disabled={enCours} onClick={() => ouvrir(false)}>{enCours ? 'Ouverture…' : 'Ouvrir l’incident d’exercice'}</BoutonDiscret>
          )}
        </div>
      ) : (
        <p className="text-sm text-sourdine">Aucun incident n’a été ouvert pour cet exercice.</p>
      )}
    </Section>
  )
}
