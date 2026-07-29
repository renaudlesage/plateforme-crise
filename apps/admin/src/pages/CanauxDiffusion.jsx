import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const TYPES = [
  { valeur: 'webhook', libelle: 'Webhook (site communal, CMS...)' },
  { valeur: 'rss', libelle: 'Flux RSS' },
  { valeur: 'facebook', libelle: 'Facebook' },
  { valeur: 'autre', libelle: 'Autre' },
]

export default function CanauxDiffusion() {
  const { contexteId } = useAuth()
  const {
    lignes: canaux,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('canaux_diffusion', contexteId, { tri: 'nom' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-xl font-semibold text-slate-900">Canaux de diffusion</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un canal</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Où relayer automatiquement une alerte publique en plus de l'app Citoyen. Seul le
        type <strong>webhook</strong> est fonctionnel pour l'instant.
      </p>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireCanal
          onAnnuler={() => setEnAjout(false)}
          onValider={async (valeurs) => {
            const { error } = await creer(valeurs)
            if (!error) setEnAjout(false)
            return { error }
          }}
        />
      )}

      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : canaux.length === 0 && !enAjout ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          Aucun canal configuré.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          {canaux.map((c) =>
            ligneEnEdition === c.id ? (
              <li key={c.id} className="bg-slate-50 p-3">
                <FormulaireCanal
                  valeursInitiales={c}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(c.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={c.id} className="flex items-start justify-between px-4 py-3 bg-white">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {c.nom}
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{c.type}</span>
                    {!c.actif && <span className="ml-2 text-xs text-slate-400">(inactif)</span>}
                  </p>
                  {c.config?.url && <p className="text-xs text-slate-500 mt-0.5 font-mono">{c.config.url}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(c.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer le canal "${c.nom}" ?`)) supprimer(c.id)
                    }}
                  >
                    Supprimer
                  </BoutonDiscret>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function FormulaireCanal({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [type, setType] = useState(valeursInitiales.type ?? 'webhook')
  const [nom, setNom] = useState(valeursInitiales.nom ?? '')
  const [url, setUrl] = useState(valeursInitiales.config?.url ?? '')
  const [secretHeader, setSecretHeader] = useState(valeursInitiales.config?.secret_header ?? '')
  const [secretValue, setSecretValue] = useState(valeursInitiales.config?.secret_value ?? '')
  const [actif, setActif] = useState(valeursInitiales.actif ?? true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const config = { url: url.trim() }
    if (secretHeader.trim()) config.secret_header = secretHeader.trim()
    if (secretValue.trim()) config.secret_value = secretValue.trim()

    const { error } = await onValider({
      type,
      nom: nom.trim(),
      config,
      actif,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Nom</label>
          <input
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="ex. Site communal Nassogne"
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            {TYPES.map((t) => (
              <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">URL du webhook</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://commune.example.be/webhooks/alertes"
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Nom de l'en-tête secret <span className="text-slate-400">(optionnel)</span>
          </label>
          <input value={secretHeader} onChange={(e) => setSecretHeader(e.target.value)} placeholder="ex. X-Signature" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Valeur du secret</label>
          <input value={secretValue} onChange={(e) => setSecretValue(e.target.value)} type="password" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
        Actif
      </label>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
