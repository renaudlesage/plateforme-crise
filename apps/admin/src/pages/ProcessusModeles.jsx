import { useState } from 'react'
import { texteErreur } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

/**
 * Modèles de processus d'intervention (C6, idée reprise de Kalisio Crisis ; aucun code repris).
 * Un processus est une suite de questions posées aux équipes, chacune avec ses réponses possibles ;
 * une réponse marquée « fin » arrête l'équipe à cette étape. Lancé depuis le QG, rempli depuis Terrain.
 */
export default function ProcessusModeles() {
  const { contexteId } = useAuth()
  const { lignes, chargement, erreur, creer, modifier, supprimer } = useTableContexte('processus_modeles', contexteId, { tri: 'nom' })
  const [edition, setEdition] = useState(null) // 'nouveau' | id | null

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Processus d’intervention</h1>
        {edition === null && <BoutonPrincipal onClick={() => setEdition('nouveau')}>Nouveau modèle</BoutonPrincipal>}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Une suite de questions posées aux équipes sur le terrain (« Arrivés sur place ? », « Rue évacuée ? »). Le QG lance un modèle
        sur un incident pour une ou plusieurs équipes ; chacune répond depuis Terrain et le CC suit l’avancement. Chaque réponse est
        tracée au livre de bord. Modifier un modèle ne change pas les processus déjà lancés.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{/processus_modeles|schema cache/.test(erreur) ? 'La migration C6 n’est pas encore appliquée.' : erreur}</p>}

      {edition === 'nouveau' && (
        <FormulaireModele
          onAnnuler={() => setEdition(null)}
          onValider={async (v) => {
            const r = await creer(v)
            if (!r.error) setEdition(null)
            return r
          }}
        />
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : lignes.length === 0 && edition !== 'nouveau' ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">Aucun modèle de processus.</p>
      ) : (
        <ul className="space-y-2">
          {lignes.map((m) =>
            edition === m.id ? (
              <li key={m.id}>
                <FormulaireModele
                  modele={m}
                  onAnnuler={() => setEdition(null)}
                  onValider={async (v) => {
                    const r = await modifier(m.id, v)
                    if (!r.error) setEdition(null)
                    return r
                  }}
                />
              </li>
            ) : (
              <li key={m.id} className="border border-trait rounded p-3 bg-surface">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-encre">
                      {m.nom}
                      {!m.actif && <span className="jeton ml-2">inactif</span>}
                    </p>
                    {m.description && <p className="text-sm text-sourdine">{m.description}</p>}
                    <ol className="text-sm list-decimal pl-5 mt-1">
                      {m.etapes.map((e, i) => (
                        <li key={i}>
                          {e.question}{' '}
                          <span className="text-xs text-sourdine">
                            ({e.reponses.map((r) => r.libelle + (r.fin ? ' — fin' : '')).join(' · ')})
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <BoutonDiscret onClick={() => setEdition(m.id)}>Modifier</BoutonDiscret>
                    <BoutonDiscret
                      onClick={() => {
                        if (window.confirm(`Supprimer le modèle « ${m.nom} » ? Les processus déjà lancés restent intacts.`)) supprimer(m.id)
                      }}
                    >
                      Supprimer
                    </BoutonDiscret>
                  </div>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

const etapeVide = () => ({ question: '', reponses: [{ libelle: 'Oui' }, { libelle: 'Non' }] })

function FormulaireModele({ modele, onValider, onAnnuler }) {
  const [nom, setNom] = useState(modele?.nom ?? '')
  const [description, setDescription] = useState(modele?.description ?? '')
  const [actif, setActif] = useState(modele?.actif ?? true)
  const [etapes, setEtapes] = useState(modele?.etapes?.length ? modele.etapes : [etapeVide()])
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  const majEtape = (i, f) => setEtapes((l) => l.map((e, j) => (j === i ? f(e) : e)))
  const majReponse = (i, k, champ, v) => majEtape(i, (e) => ({ ...e, reponses: e.reponses.map((r, m) => (m === k ? { ...r, [champ]: v } : r)) }))

  async function soumettre(ev) {
    ev.preventDefault()
    setEnCours(true)
    const propres = etapes.map((e) => ({
      question: e.question.trim(),
      reponses: e.reponses.filter((r) => r.libelle.trim()).map((r) => ({ libelle: r.libelle.trim(), ...(r.fin ? { fin: true } : {}) })),
    }))
    const { error } = await onValider({ nom: nom.trim(), description: description.trim() || null, actif, etapes: propres })
    setEnCours(false)
    if (error) setErreur(texteErreur(error))
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input required maxLength={120} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom (ex. Évacuation de rue)" aria-label="Nom" className="sm:col-span-2" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} /> Actif (proposé au QG)
        </label>
      </div>
      <textarea maxLength={1000} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (facultatif)" aria-label="Description" className="w-full" />

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-sourdine mb-1">Étapes (dans l’ordre ; 20 au plus)</legend>
        {etapes.map((e, i) => (
          <div key={i} className="border border-trait rounded p-2 bg-surface space-y-2">
            <div className="flex gap-2">
              <span className="text-sm text-sourdine pt-1">{i + 1}.</span>
              <input required maxLength={300} value={e.question} onChange={(ev) => majEtape(i, (x) => ({ ...x, question: ev.target.value }))} placeholder="Question posée à l’équipe" aria-label={`Question ${i + 1}`} className="flex-1" />
              {etapes.length > 1 && <BoutonDiscret type="button" aria-label="Retirer l’étape" onClick={() => setEtapes((l) => l.filter((_, j) => j !== i))}>✕</BoutonDiscret>}
            </div>
            <div className="flex flex-wrap gap-2 pl-5">
              {e.reponses.map((r, k) => (
                <span key={k} className="flex items-center gap-1 border border-trait rounded px-1">
                  <input maxLength={80} value={r.libelle} onChange={(ev) => majReponse(i, k, 'libelle', ev.target.value)} placeholder="Réponse" aria-label={`Réponse ${k + 1}`} className="w-32" />
                  <label className="text-xs text-sourdine flex items-center gap-1" title="Cette réponse arrête l’équipe à cette étape">
                    <input type="checkbox" checked={!!r.fin} onChange={(ev) => majReponse(i, k, 'fin', ev.target.checked)} /> fin
                  </label>
                  {e.reponses.length > 1 && (
                    <button type="button" className="lien text-xs" aria-label="Retirer la réponse" onClick={() => majEtape(i, (x) => ({ ...x, reponses: x.reponses.filter((_, m) => m !== k) }))}>✕</button>
                  )}
                </span>
              ))}
              {e.reponses.length < 8 && (
                <BoutonDiscret type="button" className="text-xs" onClick={() => majEtape(i, (x) => ({ ...x, reponses: [...x.reponses, { libelle: '' }] }))}>+ réponse</BoutonDiscret>
              )}
            </div>
          </div>
        ))}
        {etapes.length < 20 && <BoutonDiscret type="button" onClick={() => setEtapes((l) => [...l, etapeVide()])}>+ Étape</BoutonDiscret>}
      </fieldset>

      {erreur && <p className="text-sm text-chaud">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours || !nom.trim()}>Enregistrer</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
