import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const STATUTS = [
  { valeur: 'ok', libelle: 'OK', classe: 'text-ok' },
  { valeur: 'sous_tension', libelle: 'Sous tension', classe: 'text-veille' },
  { valeur: 'defaillante', libelle: 'Défaillante', classe: 'text-chaud' },
]

export default function FonctionsCritiques() {
  const { contexteId } = useAuth()
  const {
    lignes: fonctions,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('fonctions_critiques', contexteId, {
    colonnes: '*, contacts(id, nom, prenom)',
    tri: 'nom',
  })
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Fonctions critiques</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter une fonction</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Ce qui peut basculer en cas de crise (eau, électricité, télécoms, voirie...) — leur
        statut alimente l'analyse cascade des objets à risque.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireFonction
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
      ) : fonctions.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucune fonction critique définie.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow-sm">
          {fonctions.map((f) =>
            ligneEnEdition === f.id ? (
              <li key={f.id} className="bg-fond p-3">
                <FormulaireFonction
                  contacts={contacts}
                  valeursInitiales={f}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(f.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={f.id} className="flex items-start justify-between px-4 py-3 bg-surface">
                <div>
                  <p className="text-sm font-medium text-encre">
                    {f.nom}
                    <span className={`jeton ml-2 ${STATUTS.find((s) => s.valeur === f.statut_actuel)?.classe}`}>
                      {STATUTS.find((s) => s.valeur === f.statut_actuel)?.libelle}
                    </span>
                  </p>
                  {f.delai_max_interruption && (
                    <p className="text-xs text-sourdine mt-0.5">
                      délai max d'interruption : {f.delai_max_interruption}
                    </p>
                  )}
                  {f.solution_secours && (
                    <p className="text-xs text-sourdine mt-0.5">solution de secours : {f.solution_secours}</p>
                  )}
                  {f.contacts && (
                    <p className="text-xs text-sourdine mt-0.5">
                      responsable : {f.contacts.prenom} {f.contacts.nom}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(f.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer "${f.nom}" ?`)) supprimer(f.id)
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

function FormulaireFonction({ contacts, valeursInitiales = {}, onValider, onAnnuler }) {
  const [nom, setNom] = useState(valeursInitiales.nom ?? '')
  const [statutActuel, setStatutActuel] = useState(valeursInitiales.statut_actuel ?? 'ok')
  const [delaiMax, setDelaiMax] = useState(valeursInitiales.delai_max_interruption ?? '')
  const [solutionSecours, setSolutionSecours] = useState(valeursInitiales.solution_secours ?? '')
  const [contactId, setContactId] = useState(valeursInitiales.acteur_responsable_contact_id ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      nom: nom.trim(),
      statut_actuel: statutActuel,
      delai_max_interruption: delaiMax.trim() || null,
      solution_secours: solutionSecours.trim() || null,
      acteur_responsable_contact_id: contactId || null,
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
            placeholder="ex. Alimentation en eau potable"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Statut actuel</label>
          <select value={statutActuel} onChange={(e) => setStatutActuel(e.target.value)} className="w-full">
            {STATUTS.map((s) => (
              <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">
            Délai max d'interruption <span className="text-sourdine">(ex. 24 heures, 3 jours)</span>
          </label>
          <input value={delaiMax} onChange={(e) => setDelaiMax(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Responsable</label>
          <select value={contactId} onChange={(e) => setContactId(e.target.value)} className="w-full">
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Solution de secours</label>
        <textarea
          value={solutionSecours}
          onChange={(e) => setSolutionSecours(e.target.value)}
          rows={2}
          placeholder="ex. Citernes mobiles, groupe électrogène de secours…"
          className="w-full"
        />
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
