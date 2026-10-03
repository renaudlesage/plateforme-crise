import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

export default function RegistreExpertises() {
  const { contexteId } = useAuth()
  const {
    lignes: expertises,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('registre_expertises', contexteId, {
    colonnes: '*, contacts(id, nom, prenom)',
    tri: 'domaine_expertise',
  })
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-xl font-semibold text-slate-900">Registre d'expertises</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter une expertise</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">
        3e pilier CoMoWAL : expertises mobilisables, en complément de l'annuaire (contacts) et
        des plans de référence (procédures).
      </p>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireExpertise
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
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : expertises.length === 0 && !enAjout ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          Aucune expertise enregistrée.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          {expertises.map((e) =>
            ligneEnEdition === e.id ? (
              <li key={e.id} className="bg-slate-50 p-3">
                <FormulaireExpertise
                  contacts={contacts}
                  valeursInitiales={e}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(e.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={e.id} className="flex items-start justify-between px-4 py-3 bg-white">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {e.domaine_expertise}
                    {!e.actif && <span className="ml-2 text-xs text-slate-400">(inactif)</span>}
                  </p>
                  {e.description && <p className="text-xs text-slate-500 mt-0.5">{e.description}</p>}
                  <p className="text-xs text-slate-400 mt-0.5">
                    {e.contacts && <>{e.contacts.prenom} {e.contacts.nom}</>}
                    {e.disponibilite && <> · disponibilité : {e.disponibilite}</>}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(e.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer "${e.domaine_expertise}" ?`)) supprimer(e.id)
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

function FormulaireExpertise({ contacts, valeursInitiales = {}, onValider, onAnnuler }) {
  const [domaineExpertise, setDomaineExpertise] = useState(valeursInitiales.domaine_expertise ?? '')
  const [description, setDescription] = useState(valeursInitiales.description ?? '')
  const [contactId, setContactId] = useState(valeursInitiales.contact_id ?? '')
  const [disponibilite, setDisponibilite] = useState(valeursInitiales.disponibilite ?? '')
  const [actif, setActif] = useState(valeursInitiales.actif ?? true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      domaine_expertise: domaineExpertise.trim(),
      description: description.trim() || null,
      contact_id: contactId || null,
      disponibilite: disponibilite.trim() || null,
      actif,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50 space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Domaine d'expertise</label>
        <input
          required
          value={domaineExpertise}
          onChange={(e) => setDomaineExpertise(e.target.value)}
          placeholder="ex. Hydrologie, géotechnique, toxicologie…"
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Contact</label>
          <select value={contactId} onChange={(e) => setContactId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Disponibilité</label>
          <input value={disponibilite} onChange={(e) => setDisponibilite(e.target.value)} placeholder="ex. sur demande, 24/7…" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
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
