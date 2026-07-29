import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import BenevolesEntraide from './BenevolesEntraide'

const CATEGORIES = [
  'vehicule',
  'transport_personnes',
  'genie_civil',
  'signalisation',
  'materiel_divers',
  'alimentation',
  'hebergement',
  'interprete',
  'personnel',
]

export default function Ressources() {
  const [onglet, setOnglet] = useState('ressources')

  return (
    <div>
      <div className="flex gap-1 border-b border-slate-200 mb-5">
        <button
          onClick={() => setOnglet('ressources')}
          className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
            onglet === 'ressources'
              ? 'border-institution-600 text-institution-700 font-medium'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Ressources
        </button>
        <button
          onClick={() => setOnglet('benevoles')}
          className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
            onglet === 'benevoles'
              ? 'border-institution-600 text-institution-700 font-medium'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Bénévoles (réseau citoyen)
        </button>
      </div>

      {onglet === 'ressources' ? <ListeRessources /> : <BenevolesEntraide />}
    </div>
  )
}

function ListeRessources() {
  const { contexteId } = useAuth()
  const {
    lignes: ressources,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('ressources', contexteId, {
    colonnes: '*, contacts(id, nom, prenom)',
    tri: 'nom',
  })
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)
  const [filtreCategorie, setFiltreCategorie] = useState('')
  const [filtreType, setFiltreType] = useState('')

  const ressourcesFiltrees = ressources.filter((r) => {
    if (filtreCategorie && r.categorie !== filtreCategorie) return false
    if (filtreType && r.type_public_prive !== filtreType) return false
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-xl font-semibold text-slate-900">Ressources</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter une ressource</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Moyens matériels et humains mobilisables — publics ou privés sous convention.
      </p>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireRessource
          contacts={contacts}
          onAnnuler={() => setEnAjout(false)}
          onValider={async (valeurs) => {
            const { error } = await creer(valeurs)
            if (!error) setEnAjout(false)
            return { error }
          }}
        />
      )}

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <select
          value={filtreCategorie}
          onChange={(e) => setFiltreCategorie(e.target.value)}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
        >
          <option value="">Toutes catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={filtreType}
          onChange={(e) => setFiltreType(e.target.value)}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
        >
          <option value="">Public + privé</option>
          <option value="public">Public</option>
          <option value="prive">Privé</option>
        </select>
      </div>

      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : ressourcesFiltrees.length === 0 ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          Aucune ressource ne correspond.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          {ressourcesFiltrees.map((r) =>
            ligneEnEdition === r.id ? (
              <li key={r.id} className="bg-slate-50 p-3">
                <FormulaireRessource
                  contacts={contacts}
                  valeursInitiales={r}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(r.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={r.id} className="flex items-start justify-between px-4 py-3 bg-white">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {r.nom}
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${r.type_public_prive === 'public' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                      {r.type_public_prive}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">{r.categorie.replace(/_/g, ' ')}</p>
                  {r.attributs && Object.keys(r.attributs).length > 0 && (
                    <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-x-3">
                      {Object.entries(r.attributs).map(([cle, valeur]) => (
                        <span key={cle}>{cle} : {String(valeur)}</span>
                      ))}
                    </p>
                  )}
                  {r.contacts && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      contact : {r.contacts.prenom} {r.contacts.nom}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(r.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer "${r.nom}" ?`)) supprimer(r.id)
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

function FormulaireRessource({ contacts, valeursInitiales = {}, onValider, onAnnuler }) {
  const [categorie, setCategorie] = useState(valeursInitiales.categorie ?? CATEGORIES[0])
  const [typePublicPrive, setTypePublicPrive] = useState(valeursInitiales.type_public_prive ?? 'public')
  const [nom, setNom] = useState(valeursInitiales.nom ?? '')
  const [contactId, setContactId] = useState(valeursInitiales.contact_id ?? '')
  const [attributs, setAttributs] = useState(() => {
    const initial = valeursInitiales.attributs ?? {}
    const entries = Object.entries(initial)
    return entries.length > 0 ? entries.map(([cle, valeur]) => ({ cle, valeur: String(valeur) })) : [{ cle: '', valeur: '' }]
  })
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  function majAttribut(index, champ, valeur) {
    setAttributs((prev) => prev.map((a, i) => (i === index ? { ...a, [champ]: valeur } : a)))
  }

  function ajouterAttribut() {
    setAttributs((prev) => [...prev, { cle: '', valeur: '' }])
  }

  function retirerAttribut(index) {
    setAttributs((prev) => prev.filter((_, i) => i !== index))
  }

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const attributsObjet = Object.fromEntries(
      attributs.filter((a) => a.cle.trim()).map((a) => [a.cle.trim(), a.valeur])
    )
    const { error } = await onValider({
      categorie,
      type_public_prive: typePublicPrive,
      nom: nom.trim(),
      contact_id: contactId || null,
      attributs: attributsObjet,
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
            placeholder="ex. Camion-citerne 5000L"
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Catégorie</label>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
          <div className="flex gap-4 pt-1.5">
            <label className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="radio" checked={typePublicPrive === 'public'} onChange={() => setTypePublicPrive('public')} />
              Public
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="radio" checked={typePublicPrive === 'prive'} onChange={() => setTypePublicPrive('prive')} />
              Privé
            </label>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Contact associé</label>
          <select value={contactId} onChange={(e) => setContactId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Attributs <span className="text-slate-400">(libres selon la catégorie : capacité, immatriculation, permis…)</span>
        </label>
        <div className="space-y-2">
          {attributs.map((a, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={a.cle}
                onChange={(e) => majAttribut(i, 'cle', e.target.value)}
                placeholder="clé (ex. capacité)"
                className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              />
              <input
                value={a.valeur}
                onChange={(e) => majAttribut(i, 'valeur', e.target.value)}
                placeholder="valeur (ex. 9 places)"
                className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              />
              <BoutonDiscret type="button" onClick={() => retirerAttribut(i)}>✕</BoutonDiscret>
            </div>
          ))}
        </div>
        <button type="button" onClick={ajouterAttribut} className="mt-2 text-xs text-slate-500 hover:text-slate-800 underline">
          + ajouter un attribut
        </button>
      </div>

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
