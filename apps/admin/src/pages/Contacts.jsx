import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const CATEGORIES_SUGGEREES = [
  'AUTORITE',
  'CELLULE_SECURITE',
  'SERVICE_SECOURS',
  'ECHEVINAT',
  'COMMUNE_VOISINE',
  'PERSONNEL_ADMINISTRATIF',
]

export default function Contacts() {
  const { contexteId } = useAuth()
  const {
    lignes: contacts,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('contacts', contexteId, {
    colonnes: '*, disciplines(id, code, libelle), roles(id, libelle), suppleant:est_suppleant_de(id, nom, prenom)',
    tri: 'nom',
  })
  const { lignes: disciplines } = useTableContexte('disciplines', contexteId, { tri: 'code' })
  const { lignes: roles } = useTableContexte('roles', contexteId, { tri: 'libelle' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)
  const [filtreCategorie, setFiltreCategorie] = useState('')
  const [recherche, setRecherche] = useState('')

  const categoriesPresentes = useMemo(() => {
    const set = new Set(contacts.map((c) => c.categorie).filter(Boolean))
    return Array.from(set).sort()
  }, [contacts])

  const contactsFiltres = contacts.filter((c) => {
    if (filtreCategorie && c.categorie !== filtreCategorie) return false
    if (recherche) {
      const cible = `${c.nom ?? ''} ${c.prenom ?? ''} ${c.fonction ?? ''} ${c.organisation ?? ''}`.toLowerCase()
      if (!cible.includes(recherche.toLowerCase())) return false
    }
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold text-slate-900">Annuaire</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un contact</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Toutes les personnes et organisations mobilisables — pas seulement par discipline.
      </p>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireContact
          disciplines={disciplines}
          roles={roles}
          contactsExistants={contacts}
          onAnnuler={() => setEnAjout(false)}
          onValider={async (valeurs) => {
            const { error } = await creer(valeurs)
            if (!error) setEnAjout(false)
            return { error }
          }}
        />
      )}

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un nom, une fonction…"
          className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
        <select
          value={filtreCategorie}
          onChange={(e) => setFiltreCategorie(e.target.value)}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
        >
          <option value="">Toutes catégories</option>
          {categoriesPresentes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : contactsFiltres.length === 0 ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          Aucun contact ne correspond.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
          {contactsFiltres.map((c) =>
            ligneEnEdition === c.id ? (
              <li key={c.id} className="bg-slate-50 p-3">
                <FormulaireContact
                  disciplines={disciplines}
                  roles={roles}
                  contactsExistants={contacts.filter((x) => x.id !== c.id)}
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
                    {c.prenom} {c.nom}
                    {!c.actif && <span className="ml-2 text-xs text-slate-400">(inactif)</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {[c.fonction, c.organisation].filter(Boolean).join(' — ')}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-x-2">
                    {c.categorie && <span>{c.categorie}{c.sous_categorie ? ` / ${c.sous_categorie}` : ''}</span>}
                    {c.disciplines?.code && <span>· {c.disciplines.code}</span>}
                    {c.roles?.libelle && <span>· {c.roles.libelle}</span>}
                    {c.email && <span>· {c.email}</span>}
                    {c.telephone && <span>· {c.telephone}</span>}
                    {c.suppleant && <span>· suppléant : {c.suppleant.prenom} {c.suppleant.nom}</span>}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(c.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer ${c.prenom} ${c.nom} ?`)) supprimer(c.id)
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

function FormulaireContact({ disciplines, roles, contactsExistants, valeursInitiales = {}, onValider, onAnnuler }) {
  const [categorie, setCategorie] = useState(valeursInitiales.categorie ?? '')
  const [sousCategorie, setSousCategorie] = useState(valeursInitiales.sous_categorie ?? '')
  const [nom, setNom] = useState(valeursInitiales.nom ?? '')
  const [prenom, setPrenom] = useState(valeursInitiales.prenom ?? '')
  const [fonction, setFonction] = useState(valeursInitiales.fonction ?? '')
  const [organisation, setOrganisation] = useState(valeursInitiales.organisation ?? '')
  const [email, setEmail] = useState(valeursInitiales.email ?? '')
  const [telephone, setTelephone] = useState(valeursInitiales.telephone ?? '')
  const [disciplineId, setDisciplineId] = useState(valeursInitiales.discipline_id ?? '')
  const [roleId, setRoleId] = useState(valeursInitiales.role_id ?? '')
  const [suppleantDe, setSuppleantDe] = useState(valeursInitiales.est_suppleant_de ?? '')
  const [actif, setActif] = useState(valeursInitiales.actif ?? true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      categorie: categorie.trim().toUpperCase() || 'AUTRE',
      sous_categorie: sousCategorie.trim() || null,
      nom: nom.trim() || null,
      prenom: prenom.trim() || null,
      fonction: fonction.trim() || null,
      organisation: organisation.trim() || null,
      email: email.trim() || null,
      telephone: telephone.trim() || null,
      discipline_id: disciplineId || null,
      role_id: roleId || null,
      est_suppleant_de: suppleantDe || null,
      actif,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Prénom</label>
          <input value={prenom} onChange={(e) => setPrenom(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Nom</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Fonction</label>
          <input value={fonction} onChange={(e) => setFonction(e.target.value)} placeholder="ex. Commandant de zone" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Organisation</label>
          <input value={organisation} onChange={(e) => setOrganisation(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Téléphone</label>
          <input value={telephone} onChange={(e) => setTelephone(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Catégorie</label>
          <input
            list="categories-suggerees"
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
            placeholder="ex. CELLULE_SECURITE"
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
          <datalist id="categories-suggerees">
            {CATEGORIES_SUGGEREES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Sous-catégorie</label>
          <input value={sousCategorie} onChange={(e) => setSousCategorie(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Discipline</label>
          <select value={disciplineId} onChange={(e) => setDisciplineId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            <option value="">—</option>
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>{d.code} — {d.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Rôle</label>
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            <option value="">—</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Suppléant de</label>
        <select value={suppleantDe} onChange={(e) => setSuppleantDe(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
          <option value="">— Titulaire (pas un suppléant) —</option>
          {contactsExistants.map((c) => (
            <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
          ))}
        </select>
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
