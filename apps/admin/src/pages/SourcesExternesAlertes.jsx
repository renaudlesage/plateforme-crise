import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { supabase } from '../lib/supabase'

const URL_FONCTION = 'https://apjswshvzbejpvlxfnek.supabase.co/functions/v1/ingestion-alerte-externe'

function genererSecret() {
  return crypto.randomUUID().replace(/-/g, '')
}

export default function SourcesExternesAlertes() {
  const { contexteId } = useAuth()
  const {
    lignes: sources,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('sources_externes_alertes', contexteId, { tri: 'libelle' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)
  const [journalOuvert, setJournalOuvert] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Sources externes d'alertes</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter une source</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-sourdine mb-2">
        Permet à un système partenaire (ex. Eventware, pour un événement situé sur ce territoire)
        de pousser directement une alerte dans l'app Citoyen de ce contexte, via un secret partagé.
      </p>
      <p className="text-xs text-sourdine mb-4">
        URL à configurer côté système externe :{' '}
        <span className="font-mono bg-surface-2 px-1 rounded">{URL_FONCTION}</span>
        {' '}— en-tête <span className="font-mono bg-surface-2 px-1 rounded">X-Diffusion-Secret</span>.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireSource
          onAnnuler={() => setEnAjout(false)}
          onValider={async (valeurs) => {
            const { error } = await creer(valeurs)
            if (!error) setEnAjout(false)
            return { error }
          }}
        />
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : sources.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucune source externe configurée.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {sources.map((s) =>
            ligneEnEdition === s.id ? (
              <li key={s.id} className="bg-fond p-3">
                <FormulaireSource
                  valeursInitiales={s}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(s.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={s.id}>
                <div className="flex items-start justify-between px-4 py-3 bg-surface">
                  <div>
                    <p className="text-sm font-medium text-encre">
                      {s.libelle}
                      {!s.actif && <span className="ml-2 text-xs text-sourdine">(inactive)</span>}
                    </p>
                    <p className="text-xs text-sourdine mt-0.5 font-mono">{s.secret}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 ml-3">
                    <BoutonDiscret onClick={() => setJournalOuvert(journalOuvert === s.id ? null : s.id)}>
                      {journalOuvert === s.id ? 'Masquer le journal' : 'Journal'}
                    </BoutonDiscret>
                    <BoutonDiscret onClick={() => setLigneEnEdition(s.id)}>Modifier</BoutonDiscret>
                    <BoutonDiscret
                      onClick={() => {
                        if (confirm(`Supprimer la source "${s.libelle}" ?`)) supprimer(s.id)
                      }}
                    >
                      Supprimer
                    </BoutonDiscret>
                  </div>
                </div>
                {journalOuvert === s.id && <JournalSource sourceId={s.id} />}
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function JournalSource({ sourceId }) {
  const [lignes, setLignes] = useState(null)
  const [erreur, setErreur] = useState(null)

  useState(() => {
    supabase
      .from('journal_ingestions_externes')
      .select('id, statut, motif_rejet, created_at, alerte_publique_id')
      .eq('source_externe_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) setErreur(error.message)
        else setLignes(data ?? [])
      })
  })

  if (erreur) return <p className="text-sm text-chaud px-4 py-2">{erreur}</p>
  if (lignes === null) return <p className="text-sm text-sourdine px-4 py-2">Chargement…</p>
  if (lignes.length === 0) return <p className="text-sm text-sourdine px-4 py-2">Aucun appel reçu pour l'instant.</p>

  return (
    <ul className="px-4 py-2 bg-fond text-xs space-y-1">
      {lignes.map((l) => (
        <li key={l.id} className="flex items-center gap-2">
          <span className={l.statut === 'ok' ? 'text-veille' : 'text-chaud'}>{l.statut}</span>
          <span className="text-sourdine">{new Date(l.created_at).toLocaleString('fr-BE')}</span>
          {l.motif_rejet && <span className="text-sourdine">— {l.motif_rejet}</span>}
        </li>
      ))}
    </ul>
  )
}

function FormulaireSource({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [libelle, setLibelle] = useState(valeursInitiales.libelle ?? '')
  const [secret, setSecret] = useState(valeursInitiales.secret ?? genererSecret())
  const [actif, setActif] = useState(valeursInitiales.actif ?? true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      libelle: libelle.trim(),
      secret: secret.trim(),
      actif,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Libellé</label>
        <input
          required
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          placeholder="ex. Eventware — Bucolique Ferrières 2026"
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">
          Secret partagé <span className="text-sourdine">(à coller côté système externe)</span>
        </label>
        <div className="flex gap-2">
          <input value={secret} onChange={(e) => setSecret(e.target.value)} className="w-full font-mono" />
          <BoutonDiscret type="button" onClick={() => setSecret(genererSecret())}>
            Régénérer
          </BoutonDiscret>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-sourdine">
        <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
        Active
      </label>

      {erreur && <p className="text-sm text-chaud">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
