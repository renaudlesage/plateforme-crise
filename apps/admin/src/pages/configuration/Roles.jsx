import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTableContexte } from '../../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../../components/Boutons'

export default function Roles() {
  const { contexteId } = useAuth()
  const { lignes: roles, chargement, erreur, creer, modifier, supprimer } = useTableContexte(
    'roles',
    contexteId,
    { tri: 'libelle' }
  )

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-medium text-encre">Rôles</h2>
          <p className="text-sm text-sourdine">
            Les fonctions qui portent une responsabilité dans la gestion de crise
            (ex. autorité compétente, PlanU, responsable logistique).
          </p>
        </div>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un rôle</BoutonPrincipal>
        )}
      </div>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireRole
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
      ) : roles.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun rôle défini pour ce contexte.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {roles.map((r) =>
            ligneEnEdition === r.id ? (
              <li key={r.id} className="bg-fond p-3">
                <FormulaireRole
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
              <li key={r.id} className="flex items-center justify-between px-4 py-2.5 bg-surface">
                <div>
                  <p className="text-sm font-medium text-encre">{r.libelle}</p>
                  <p className="text-xs text-sourdine">
                    code : {r.code}
                    {r.peut_declencher_escalade && (
                      <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-veille">
                        peut déclencher une escalade
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <BoutonDiscret onClick={() => setLigneEnEdition(r.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer le rôle "${r.libelle}" ?`)) supprimer(r.id)
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
    </section>
  )
}

function FormulaireRole({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [code, setCode] = useState(valeursInitiales.code ?? '')
  const [libelle, setLibelle] = useState(valeursInitiales.libelle ?? '')
  const [peutDeclencher, setPeutDeclencher] = useState(
    valeursInitiales.peut_declencher_escalade ?? false
  )
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const codeFinal = (code.trim() || libelle.trim())
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // retire les accents
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

    const { error } = await onValider({
      code: codeFinal,
      libelle: libelle.trim(),
      peut_declencher_escalade: peutDeclencher,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-3 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Libellé</label>
          <input
            required
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="ex. Bourgmestre"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">
            Code interne <span className="text-sourdine">(généré si vide)</span>
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ex. AUTORITE_COMPETENTE"
            className="w-full font-mono"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-sourdine">
        <input
          type="checkbox"
          checked={peutDeclencher}
          onChange={(e) => setPeutDeclencher(e.target.checked)}
        />
        Peut déclencher une escalade de niveau
      </label>

      {erreur && <p className="text-sm text-chaud">{erreur}</p>}

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
