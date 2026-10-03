import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

export default function PlansContinuiteActivite() {
  const { contexteId } = useAuth()
  const {
    lignes: plans,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('plans_continuite_activite', contexteId, {
    colonnes: '*, contacts(id, nom, prenom)',
    tri: 'service',
  })
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Plans de continuité d'activité (BCM)</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un plan</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Business Continuity Management (livre blanc commission Schmitz) : la continuité d'un
        processus critique d'un service public, activable même hors crise communale globale (ex.
        panne informatique isolée d'un service) — distinct des fonctions critiques de la commune
        en temps de crise générale.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulairePlanContinuite
          contacts={contacts}
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
      ) : plans.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun plan de continuité enregistré.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {plans.map((p) =>
            ligneEnEdition === p.id ? (
              <li key={p.id} className="bg-fond p-3">
                <FormulairePlanContinuite
                  contacts={contacts}
                  valeursInitiales={p}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(p.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={p.id} className="flex items-start justify-between px-4 py-3 bg-surface">
                <div>
                  <p className="text-sm font-medium text-encre">
                    {p.service}
                    <span className="jeton ml-2 text-info">{p.processus_critique}</span>
                  </p>
                  {p.duree_interruption_max_acceptable && (
                    <p className="text-xs text-sourdine mt-0.5">RTO : {p.duree_interruption_max_acceptable}</p>
                  )}
                  {p.plan_contournement && (
                    <p className="text-xs text-sourdine mt-0.5"><strong>Contournement :</strong> {p.plan_contournement}</p>
                  )}
                  <p className="text-xs text-sourdine mt-0.5">
                    {p.contacts && <>cellule de crise interne : {p.contacts.prenom} {p.contacts.nom}</>}
                    {p.derniere_revision && <> · révisé le {p.derniere_revision}</>}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(p.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer le plan de continuité de "${p.service}" ?`)) supprimer(p.id)
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

function FormulairePlanContinuite({ contacts, valeursInitiales = {}, onValider, onAnnuler }) {
  const [service, setService] = useState(valeursInitiales.service ?? '')
  const [processusCritique, setProcessusCritique] = useState(valeursInitiales.processus_critique ?? '')
  const [dureeHeures, setDureeHeures] = useState(() => {
    const iso = valeursInitiales.duree_interruption_max_acceptable
    if (!iso) return ''
    const match = /(\d+):/.exec(iso)
    return match ? String(Number(match[1])) : ''
  })
  const [planContournement, setPlanContournement] = useState(valeursInitiales.plan_contournement ?? '')
  const [celluleContactId, setCelluleContactId] = useState(valeursInitiales.cellule_crise_interne_contact_id ?? '')
  const [derniereRevision, setDerniereRevision] = useState(valeursInitiales.derniere_revision ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      service: service.trim(),
      processus_critique: processusCritique.trim(),
      duree_interruption_max_acceptable: dureeHeures === '' ? null : `${Number(dureeHeures)} hours`,
      plan_contournement: planContournement.trim() || null,
      cellule_crise_interne_contact_id: celluleContactId || null,
      derniere_revision: derniereRevision || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Service</label>
          <input required value={service} onChange={(e) => setService(e.target.value)} placeholder="ex. État civil" className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Processus critique</label>
          <input required value={processusCritique} onChange={(e) => setProcessusCritique(e.target.value)} placeholder="ex. délivrance d'actes" className="w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">
            Durée d'interruption maximale acceptable (heures) — RTO
          </label>
          <input type="number" min="0" value={dureeHeures} onChange={(e) => setDureeHeures(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Cellule de crise interne</label>
          <select value={celluleContactId} onChange={(e) => setCelluleContactId(e.target.value)} className="w-full">
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Plan de contournement</label>
        <textarea value={planContournement} onChange={(e) => setPlanContournement(e.target.value)} rows={2} className="w-full" />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Dernière révision</label>
        <input type="date" value={derniereRevision} onChange={(e) => setDerniereRevision(e.target.value)} className="w-full sm:w-48" />
      </div>

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
