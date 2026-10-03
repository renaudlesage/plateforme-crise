import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { supabase } from '../lib/supabase'

const NIVEAUX = [
  { valeur: 'info', libelle: 'Information', classe: 'bg-surface-2 text-sourdine' },
  { valeur: 'vigilance', libelle: 'Vigilance', classe: 'text-veille' },
  { valeur: 'urgence', libelle: 'Urgence', classe: 'text-chaud' },
]

export default function AlertesPubliques() {
  const { contexteId } = useAuth()
  const {
    lignes: alertes,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('alertes_publiques', contexteId, { tri: 'date_publication' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  const alertesTriees = [...alertes].sort((a, b) => new Date(b.date_publication) - new Date(a.date_publication))

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Alertes publiques</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Publier une alerte</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Ce qui est communiqué au grand public via l'app Citoyen — distinct des SitRep et du
        livre de bord internes.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireAlerte
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
      ) : alertesTriees.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucune alerte publiée.
        </p>
      ) : (
        <ul className="space-y-2">
          {alertesTriees.map((a) =>
            ligneEnEdition === a.id ? (
              <li key={a.id} className="bg-fond rounded p-3 border border-trait">
                <FormulaireAlerte
                  valeursInitiales={a}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(a.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={a.id} className="bg-surface border border-trait rounded p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-encre">
                      {a.titre}
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${NIVEAUX.find((n) => n.valeur === a.niveau_alerte)?.classe}`}>
                        {NIVEAUX.find((n) => n.valeur === a.niveau_alerte)?.libelle}
                      </span>
                      {!a.actif && <span className="ml-2 text-xs text-sourdine">(inactive)</span>}
                    </p>
                    <p className="text-sm text-sourdine mt-1">{a.message}</p>
                    {a.consignes && <p className="text-xs text-sourdine mt-1">consignes : {a.consignes}</p>}
                    {a.zone_concernee && <p className="text-xs text-sourdine mt-1">zone : {a.zone_concernee}</p>}
                    <p className="text-xs text-sourdine mt-1">
                      publiée le {new Date(a.date_publication).toLocaleString('fr-BE')}
                      {a.date_expiration && <> · expire le {new Date(a.date_expiration).toLocaleString('fr-BE')}</>}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 ml-3">
                    <BoutonDiscret onClick={() => setLigneEnEdition(a.id)}>Modifier</BoutonDiscret>
                    <BoutonDiscret
                      onClick={() => {
                        if (confirm('Supprimer cette alerte ?')) supprimer(a.id)
                      }}
                    >
                      Supprimer
                    </BoutonDiscret>
                  </div>
                </div>
                <BoutonDiffusion alerteId={a.id} />
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function BoutonDiffusion({ alerteId }) {
  const [enCours, setEnCours] = useState(false)
  const [resultats, setResultats] = useState(null)
  const [erreur, setErreur] = useState(null)

  async function diffuser() {
    setEnCours(true)
    setErreur(null)
    setResultats(null)
    const { data, error } = await supabase.functions.invoke('diffuser-alerte', {
      body: { alerte_id: alerteId },
    })
    setEnCours(false)
    if (error) {
      setErreur(error.message)
    } else if (data?.error) {
      setErreur(data.error)
    } else {
      setResultats(data)
    }
  }

  return (
    <div className="mt-2 pt-2 border-t border-trait">
      <BoutonDiscret onClick={diffuser} disabled={enCours}>
        {enCours ? 'Diffusion en cours…' : 'Diffuser vers les canaux'}
      </BoutonDiscret>
      {erreur && <p className="text-xs text-chaud mt-1">{erreur}</p>}
      {resultats?.message && <p className="text-xs text-sourdine mt-1">{resultats.message}</p>}
      {resultats?.resultats?.length > 0 && (
        <ul className="text-xs mt-1 space-y-0.5">
          {resultats.resultats.map((r, i) => (
            <li key={i} className={r.statut === 'envoye' ? 'text-ok' : 'text-chaud'}>
              {r.canal} — {r.statut === 'envoye' ? 'envoyé' : `échec (${r.erreur})`}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireAlerte({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [titre, setTitre] = useState(valeursInitiales.titre ?? '')
  const [message, setMessage] = useState(valeursInitiales.message ?? '')
  const [consignes, setConsignes] = useState(valeursInitiales.consignes ?? '')
  const [zoneConcernee, setZoneConcernee] = useState(valeursInitiales.zone_concernee ?? '')
  const [niveauAlerte, setNiveauAlerte] = useState(valeursInitiales.niveau_alerte ?? 'info')
  const [actif, setActif] = useState(valeursInitiales.actif ?? true)
  const [dateExpiration, setDateExpiration] = useState(
    valeursInitiales.date_expiration ? valeursInitiales.date_expiration.slice(0, 16) : ''
  )
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      titre: titre.trim(),
      message: message.trim(),
      consignes: consignes.trim() || null,
      zone_concernee: zoneConcernee.trim() || null,
      niveau_alerte: niveauAlerte,
      actif,
      date_expiration: dateExpiration ? new Date(dateExpiration).toISOString() : null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Titre</label>
        <input
          required
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="ex. Inondation Rue du Centre"
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Message au public</label>
        <textarea
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Ce que le citoyen doit savoir…"
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Consignes</label>
        <textarea
          value={consignes}
          onChange={(e) => setConsignes(e.target.value)}
          rows={2}
          placeholder="ex. Évitez le secteur, privilégiez un itinéraire alternatif"
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Niveau</label>
          <select value={niveauAlerte} onChange={(e) => setNiveauAlerte(e.target.value)} className="w-full">
            {NIVEAUX.map((n) => (
              <option key={n.valeur} value={n.valeur}>{n.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Zone concernée</label>
          <input value={zoneConcernee} onChange={(e) => setZoneConcernee(e.target.value)} className="w-full" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Expiration (optionnel)</label>
        <input type="datetime-local" value={dateExpiration} onChange={(e) => setDateExpiration(e.target.value)} className="w-full" />
      </div>

      <label className="flex items-center gap-2 text-sm text-sourdine">
        <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
        Active (visible par le public immédiatement)
      </label>

      {erreur && <p className="text-sm text-chaud">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Publication…' : 'Publier'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
