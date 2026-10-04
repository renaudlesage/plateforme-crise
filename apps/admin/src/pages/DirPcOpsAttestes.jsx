import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

export default function DirPcOpsAttestes() {
  const { contexteId } = useAuth()
  const {
    lignes: dirs,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('dir_pc_ops_attestes', contexteId, { tri: 'nom' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Dir PC-Ops attestés</h1>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter</BoutonPrincipal>}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Registre des directeurs PC-Ops disposant d'une attestation valide — vérifiable
        indépendamment de tout incident précis.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireDir
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
      ) : dirs.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun Dir PC-Ops attesté enregistré.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {dirs.map((d) =>
            ligneEnEdition === d.id ? (
              <li key={d.id} className="bg-fond p-3">
                <FormulaireDir
                  valeursInitiales={d}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(d.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={d.id} className="flex items-start justify-between px-4 py-3 bg-surface">
                <div>
                  <p className="text-sm font-medium text-encre">
                    {d.nom}
                    {!d.actif && <span className="jeton ml-2 text-sourdine">inactif</span>}
                  </p>
                  <p className="text-xs text-sourdine mt-0.5">
                    {d.zone_secours && <>zone de secours : {d.zone_secours} · </>}
                    {d.numero_attestation && <>n° attestation : {d.numero_attestation}</>}
                  </p>
                  <p className="text-xs text-sourdine mt-0.5">
                    {d.date_obtention && <>obtenue le {d.date_obtention} </>}
                    {d.date_validite && <>· valide jusqu'au {d.date_validite}</>}
                  </p>
                  {d.contact && <p className="text-xs text-sourdine mt-0.5">{d.contact}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(d.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer "${d.nom}" ?`)) supprimer(d.id)
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

function FormulaireDir({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [nom, setNom] = useState(valeursInitiales.nom ?? '')
  const [zoneSecours, setZoneSecours] = useState(valeursInitiales.zone_secours ?? '')
  const [numeroAttestation, setNumeroAttestation] = useState(valeursInitiales.numero_attestation ?? '')
  const [dateObtention, setDateObtention] = useState(valeursInitiales.date_obtention ?? '')
  const [dateValidite, setDateValidite] = useState(valeursInitiales.date_validite ?? '')
  const [contact, setContact] = useState(valeursInitiales.contact ?? '')
  const [actif, setActif] = useState(valeursInitiales.actif ?? true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      nom: nom.trim(),
      zone_secours: zoneSecours.trim() || null,
      numero_attestation: numeroAttestation.trim() || null,
      date_obtention: dateObtention || null,
      date_validite: dateValidite || null,
      contact: contact.trim() || null,
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
          <input required value={nom} onChange={(e) => setNom(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Zone de secours</label>
          <input value={zoneSecours} onChange={(e) => setZoneSecours(e.target.value)} className="w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">N° attestation</label>
          <input value={numeroAttestation} onChange={(e) => setNumeroAttestation(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Date d'obtention</label>
          <input type="date" value={dateObtention} onChange={(e) => setDateObtention(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Valide jusqu'au</label>
          <input type="date" value={dateValidite} onChange={(e) => setDateValidite(e.target.value)} className="w-full" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Contact</label>
        <input value={contact} onChange={(e) => setContact(e.target.value)} className="w-full" />
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
