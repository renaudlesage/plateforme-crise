import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const TYPES = [
  { valeur: 'webhook', libelle: 'Webhook (site communal, CMS...)' },
  { valeur: 'rss', libelle: 'Flux RSS' },
  { valeur: 'facebook', libelle: 'Facebook' },
  { valeur: 'sms', libelle: 'SMS' },
  { valeur: 'email', libelle: 'E-mail' },
  { valeur: 'radio_partenaire', libelle: 'Radio partenaire' },
  { valeur: 'media_tv', libelle: 'Média TV' },
  { valeur: 'croix_rouge', libelle: 'Croix-Rouge' },
  { valeur: 'scouts', libelle: 'Scouts' },
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
        <h1 className="text-xl font-semibold text-encre">Canaux de diffusion</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un canal</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Où relayer automatiquement une alerte publique en plus de l'app Citoyen. Seul le
        type <strong>webhook</strong> est fonctionnel pour l'instant.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

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
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : canaux.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun canal configuré.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow-sm">
          {canaux.map((c) =>
            ligneEnEdition === c.id ? (
              <li key={c.id} className="bg-fond p-3">
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
              <li key={c.id} className="flex items-start justify-between px-4 py-3 bg-surface">
                <div>
                  <p className="text-sm font-medium text-encre">
                    {c.nom}
                    <span className="jeton ml-2 bg-surface-2 text-sourdine">{c.type}</span>
                    {!c.actif && <span className="ml-2 text-xs text-sourdine">(inactif)</span>}
                  </p>
                  {c.config?.url && <p className="text-xs text-sourdine mt-0.5 font-mono">{c.config.url}</p>}
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
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Nom</label>
          <input
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="ex. Site communal Nassogne"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full">
            {TYPES.map((t) => (
              <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">URL du webhook</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://commune.example.be/webhooks/alertes"
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">
            Nom de l'en-tête secret <span className="text-sourdine">(optionnel)</span>
          </label>
          <input value={secretHeader} onChange={(e) => setSecretHeader(e.target.value)} placeholder="ex. X-Signature" className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Valeur du secret</label>
          <input value={secretValue} onChange={(e) => setSecretValue(e.target.value)} type="password" className="w-full" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-sourdine">
        <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
        Actif
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
