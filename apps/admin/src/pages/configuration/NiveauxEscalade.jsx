import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTableContexte } from '../../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../../components/Boutons'

export default function NiveauxEscalade() {
  const { contexteId } = useAuth()
  const {
    lignes: niveaux,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('niveaux_escalade', contexteId, {
    colonnes: '*, roles(id, libelle)',
    tri: 'ordre',
  })
  const { lignes: roles } = useTableContexte('roles', contexteId, { tri: 'libelle' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-medium text-slate-900">Niveaux d'escalade</h2>
          <p className="text-sm text-slate-500">
            Les paliers de gestion de crise (ex. communal → provincial → fédéral), dans
            l'ordre de montée en puissance.
          </p>
        </div>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un niveau</BoutonPrincipal>
        )}
      </div>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {roles.length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          Aucun rôle n'existe encore — crée d'abord au moins un rôle (onglet Rôles) pour pouvoir
          désigner qui déclenche chaque niveau.
        </p>
      )}

      {enAjout && (
        <FormulaireNiveau
          roles={roles}
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
      ) : niveaux.length === 0 && !enAjout ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          Aucun niveau d'escalade défini pour ce contexte.
        </p>
      ) : (
        <ol className="space-y-2">
          {niveaux.map((n) =>
            ligneEnEdition === n.id ? (
              <li key={n.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <FormulaireNiveau
                  roles={roles}
                  valeursInitiales={n}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(n.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li
                key={n.id}
                className="flex items-start justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg"
              >
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center mt-0.5">
                    {n.ordre}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{n.libelle}</p>
                    <p className="text-xs text-slate-500">
                      code : {n.code}
                      {n.roles?.libelle && (
                        <> · déclenché par <strong>{n.roles.libelle}</strong></>
                      )}
                    </p>
                    {n.criteres_declenchement && (
                      <p className="text-xs text-slate-500 mt-1 italic">
                        {n.criteres_declenchement}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <BoutonDiscret onClick={() => setLigneEnEdition(n.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer le niveau "${n.libelle}" ?`)) supprimer(n.id)
                    }}
                  >
                    Supprimer
                  </BoutonDiscret>
                </div>
              </li>
            )
          )}
        </ol>
      )}
    </section>
  )
}

function FormulaireNiveau({ roles, valeursInitiales = {}, onValider, onAnnuler }) {
  const [code, setCode] = useState(valeursInitiales.code ?? '')
  const [libelle, setLibelle] = useState(valeursInitiales.libelle ?? '')
  const [ordre, setOrdre] = useState(valeursInitiales.ordre ?? 1)
  const [roleDeclencheurId, setRoleDeclencheurId] = useState(
    valeursInitiales.role_declencheur_id ?? ''
  )
  const [criteres, setCriteres] = useState(valeursInitiales.criteres_declenchement ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const codeFinal = (code.trim() || libelle.trim())
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

    const { error } = await onValider({
      code: codeFinal,
      libelle: libelle.trim(),
      ordre: Number(ordre),
      role_declencheur_id: roleDeclencheurId || null,
      criteres_declenchement: criteres.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Libellé</label>
          <input
            required
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="ex. Phase communale"
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Ordre</label>
          <input
            required
            type="number"
            min="1"
            value={ordre}
            onChange={(e) => setOrdre(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Rôle déclencheur <span className="text-slate-400">(non délégable)</span>
        </label>
        <select
          value={roleDeclencheurId}
          onChange={(e) => setRoleDeclencheurId(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
        >
          <option value="">— Aucun / à définir —</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.libelle}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Critères de déclenchement
        </label>
        <textarea
          value={criteres}
          onChange={(e) => setCriteres(e.target.value)}
          rows={2}
          placeholder="ex. Conséquences limitées au territoire de la commune..."
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>
          Annuler
        </BoutonDiscret>
      </div>
    </form>
  )
}
