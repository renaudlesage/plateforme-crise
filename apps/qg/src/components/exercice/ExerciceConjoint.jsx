import { useCallback, useEffect, useState } from 'react'
import { texteErreur } from '@plateforme-crise/shared'
import { supabase } from '../../lib/supabase'
import { BoutonDiscret, BoutonPrincipal } from '../Boutons'
import { genererSecret, hoteRecepteur } from '../../lib/evenementsTerritoire'

/**
 * Exercice conjoint avec un organisateur d'événement (briefing 03, partie D). Le serveur attribue un code
 * d'exercice, à transmettre à l'organisateur. L'événement suivi et la source d'exercice créés ici ne servent
 * qu'à cet exercice : la base refuse tout échange entre un exercice et le réel (dans les deux sens), et les
 * désactive à la clôture.
 */
export default function ExerciceConjoint({ ex, editable, onChange }) {
  const [evenements, setEvenements] = useState([])
  const [sources, setSources] = useState([])
  const [erreur, setErreur] = useState(null)
  const [occupe, setOccupe] = useState(false)
  const [secretAffiche, setSecretAffiche] = useState(null)

  const charger = useCallback(async () => {
    if (!ex.conjoint) return
    const [e, s] = await Promise.all([
      supabase.from('evenements_territoire').select('id, nom, url_recepteur, secret_defini, actif').eq('exercice_id', ex.id).order('nom'),
      supabase.from('sources_externes_alertes').select('id, libelle, secret, actif').eq('exercice_id', ex.id).is('deleted_at', null).order('libelle'),
    ])
    const echec = e.error || s.error
    if (echec) setErreur(texteErreur(echec))
    else {
      setErreur(null)
      setEvenements(e.data ?? [])
      setSources(s.data ?? [])
    }
  }, [ex.id, ex.conjoint])

  useEffect(() => {
    charger()
  }, [charger])

  async function agir(fn) {
    setOccupe(true)
    setErreur(null)
    const { error } = (await fn()) ?? {}
    setOccupe(false)
    if (error) {
      setErreur(texteErreur(error))
      return false
    }
    await charger()
    return true
  }

  // Colonne absente tant que la migration b03d n'est pas appliquée : rien à afficher.
  if (ex.conjoint === undefined) return null

  return (
    <section>
      <h2 className="text-sm font-semibold text-encre">Exercice conjoint avec un organisateur</h2>
      <p className="text-xs text-sourdine mb-2">
        Pour jouer avec un organisateur d'événement (Eventware). Les messages échangés portent le code de l'exercice ;
        la plateforme refuse tout message entre cet exercice et un événement ou une source réels.
      </p>
      {erreur && <p role="alert" className="text-sm text-chaud mb-2">{erreur}</p>}

      {editable && (
        <label className="flex items-center gap-2 text-sm text-encre mb-2">
          <input
            type="checkbox"
            checked={ex.conjoint}
            disabled={occupe}
            onChange={async (e) => {
              const ok = await agir(() => supabase.from('exercices').update({ conjoint: e.target.checked }).eq('id', ex.id))
              if (ok) onChange()
            }}
          />
          Exercice conjoint
        </label>
      )}

      {ex.conjoint && (
        <div className="space-y-3">
          <p className="text-sm text-encre">
            Code à transmettre à l'organisateur : <strong className="font-mono">{ex.code_conjoint}</strong>
          </p>

          <div>
            <p className="text-xs font-medium text-sourdine mb-1">Événement d'exercice (ce que le CC peut prévenir)</p>
            {evenements.length === 0 ? (
              <p className="text-sm text-sourdine">Aucun.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {evenements.map((e) => (
                  <li key={e.id}>
                    {e.nom} · réception : {hoteRecepteur(e.url_recepteur) ?? <em>aucune adresse</em>} · secret :{' '}
                    {e.secret_defini ? 'défini' : <em>non défini</em>}
                    {!e.actif && <span className="jeton ml-2">inactif</span>}
                    {editable && !e.secret_defini && e.url_recepteur && (
                      <BoutonDiscret
                        className="ml-2 text-xs"
                        disabled={occupe}
                        onClick={async () => {
                          const secret = genererSecret()
                          const ok = await agir(() => supabase.rpc('definir_secret_evenement', { p_evenement_id: e.id, p_secret: secret }))
                          if (ok) setSecretAffiche({ pour: e.nom, secret })
                        }}
                      >
                        Générer le secret
                      </BoutonDiscret>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {editable && <FormulaireEvenement ex={ex} occupe={occupe} agir={agir} />}
          </div>

          <div>
            <p className="text-xs font-medium text-sourdine mb-1">Source d'exercice (ce que l'organisateur peut envoyer)</p>
            {sources.length === 0 ? (
              <p className="text-sm text-sourdine">Aucune.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {sources.map((s) => (
                  <li key={s.id}>
                    {s.libelle} · secret <span className="font-mono text-xs">{s.secret}</span>
                    {!s.actif && <span className="jeton ml-2">inactive</span>}
                  </li>
                ))}
              </ul>
            )}
            {editable && sources.length === 0 && (
              <BoutonDiscret
                className="mt-1"
                disabled={occupe}
                onClick={() =>
                  agir(() =>
                    supabase.from('sources_externes_alertes').insert({
                      contexte_id: ex.contexte_id,
                      libelle: `Organisateur — ${ex.titre?.trim() || 'exercice'}`,
                      secret: genererSecret(),
                      objets: ['alerte'],
                      est_exercice: true,
                      exercice_id: ex.id,
                    })
                  )
                }
              >
                Créer la source d'exercice
              </BoutonDiscret>
            )}
          </div>

          {secretAffiche && (
            <p className="text-sm border border-trait rounded p-2 bg-fond">
              Secret de « {secretAffiche.pour} », à transmettre à l'organisateur (il ne sera plus affiché) :{' '}
              <span className="font-mono">{secretAffiche.secret}</span>{' '}
              <button type="button" className="lien" onClick={() => setSecretAffiche(null)}>Fermer</button>
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function FormulaireEvenement({ ex, occupe, agir }) {
  const [nom, setNom] = useState('')
  const [url, setUrl] = useState('')

  return (
    <form
      className="flex flex-wrap gap-2 mt-2"
      onSubmit={async (e) => {
        e.preventDefault()
        const ok = await agir(() =>
          supabase.from('evenements_territoire').insert({
            contexte_id: ex.contexte_id,
            nom: nom.trim(),
            url_recepteur: url.trim() || null,
            jeton_public: crypto.randomUUID(),
            est_exercice: true,
            exercice_id: ex.id,
          })
        )
        if (ok) {
          setNom('')
          setUrl('')
        }
      }}
    >
      <input required value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom de l'événement d'exercice" className="flex-1 min-w-[10rem]" />
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (réception d'exercice)" className="flex-1 min-w-[12rem]" />
      <BoutonPrincipal type="submit" disabled={occupe || !nom.trim()}>Ajouter</BoutonPrincipal>
    </form>
  )
}
