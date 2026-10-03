import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const PARAMETRES = [
  { valeur: 'temperature', libelle: 'Température' },
  { valeur: 'humidite_relative', libelle: 'Humidité relative' },
  { valeur: 'vent', libelle: 'Vent' },
  { valeur: 'precipitation', libelle: 'Précipitation' },
  { valeur: 'niveau_cours_eau', libelle: "Niveau d'un cours d'eau" },
  { valeur: 'secheresse_sol', libelle: 'Sécheresse du sol' },
  { valeur: 'autre', libelle: 'Autre' },
]

const OPERATEURS = ['>', '>=', '<', '<=', '=']

export default function SeuilsMeteoDeclencheurs() {
  const { contexteId } = useAuth()
  const {
    lignes: seuils,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('seuils_meteo_declencheurs', contexteId, {
    colonnes: '*, objets_a_risque(id, identification)',
    tri: 'libelle',
  })
  const { lignes: objetsRisque } = useTableContexte('objets_a_risque', contexteId, { tri: 'identification' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-xl font-semibold text-slate-900">Seuils météo déclencheurs</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un seuil</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Seuils numériques génériques (température, vent, niveau d'un cours d'eau...) qui
        déclenchent une action — rattachables à un objet à risque précis, ou génériques.
      </p>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireSeuilMeteo
          objetsRisque={objetsRisque}
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
      ) : seuils.length === 0 && !enAjout ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          Aucun seuil météo défini.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          {seuils.map((s) =>
            ligneEnEdition === s.id ? (
              <li key={s.id} className="bg-slate-50 p-3">
                <FormulaireSeuilMeteo
                  objetsRisque={objetsRisque}
                  valeursInitiales={s}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(s.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={s.id} className="flex items-start justify-between px-4 py-3 bg-white">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {s.libelle}
                    {!s.actif && <span className="ml-2 text-xs text-slate-400">(inactif)</span>}
                  </p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {PARAMETRES.find((p) => p.valeur === s.parametre)?.libelle ?? s.parametre} {s.operateur} {s.valeur_seuil} {s.unite}
                  </p>
                  {s.action_associee && <p className="text-xs text-slate-500 mt-0.5">action : {s.action_associee}</p>}
                  {s.objets_a_risque?.identification && (
                    <p className="text-xs text-slate-400 mt-0.5">objet : {s.objets_a_risque.identification}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(s.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer "${s.libelle}" ?`)) supprimer(s.id)
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

function FormulaireSeuilMeteo({ objetsRisque, valeursInitiales = {}, onValider, onAnnuler }) {
  const [libelle, setLibelle] = useState(valeursInitiales.libelle ?? '')
  const [parametre, setParametre] = useState(valeursInitiales.parametre ?? PARAMETRES[0].valeur)
  const [operateur, setOperateur] = useState(valeursInitiales.operateur ?? '>')
  const [valeurSeuil, setValeurSeuil] = useState(valeursInitiales.valeur_seuil ?? '')
  const [unite, setUnite] = useState(valeursInitiales.unite ?? '')
  const [actionAssociee, setActionAssociee] = useState(valeursInitiales.action_associee ?? '')
  const [objetRisqueId, setObjetRisqueId] = useState(valeursInitiales.objet_risque_id ?? '')
  const [actif, setActif] = useState(valeursInitiales.actif ?? true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      libelle: libelle.trim(),
      parametre,
      operateur,
      valeur_seuil: Number(valeurSeuil),
      unite: unite.trim() || null,
      action_associee: actionAssociee.trim() || null,
      objet_risque_id: objetRisqueId || null,
      actif,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50 space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Libellé</label>
        <input
          required
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          placeholder="ex. Risque de feu de forêt — conditions réunies"
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Paramètre</label>
          <select value={parametre} onChange={(e) => setParametre(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            {PARAMETRES.map((p) => (
              <option key={p.valeur} value={p.valeur}>{p.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Opérateur</label>
          <select value={operateur} onChange={(e) => setOperateur(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            {OPERATEURS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Valeur seuil</label>
          <input required type="number" step="any" value={valeurSeuil} onChange={(e) => setValeurSeuil(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Unité</label>
          <input value={unite} onChange={(e) => setUnite(e.target.value)} placeholder="ex. °C, km/h, m" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Objet à risque lié</label>
          <select value={objetRisqueId} onChange={(e) => setObjetRisqueId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            <option value="">— générique —</option>
            {objetsRisque.map((o) => (
              <option key={o.id} value={o.id}>{o.identification}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Action associée</label>
        <textarea value={actionAssociee} onChange={(e) => setActionAssociee(e.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
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
