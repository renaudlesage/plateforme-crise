import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const TYPES_CENTRE = [
  { valeur: 'principal', libelle: 'Principal' },
  { valeur: 'alternatif', libelle: 'Alternatif' },
]

export default function CentresCrise() {
  const { contexteId } = useAuth()
  const {
    lignes: centres,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('centres_crise', contexteId, { tri: 'type_centre' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Centres de crise</h1>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un centre</BoutonPrincipal>}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Lieux d'implantation du PC-Ops / de la cellule de sécurité (principal et alternatif), avec
        leurs moyens de communication (ASTRID, REGETEL, wifi, visioconférence).
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireCentreCrise
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
      ) : centres.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun centre de crise enregistré.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {centres.map((c) =>
            ligneEnEdition === c.id ? (
              <li key={c.id} className="bg-fond p-3">
                <FormulaireCentreCrise
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
              <li key={c.id} className="flex items-start justify-between px-4 py-3 bg-surface">
                <div>
                  <p className="text-sm font-medium text-encre">
                    <span className="jeton mr-2 text-info">
                      {TYPES_CENTRE.find((t) => t.valeur === c.type_centre)?.libelle ?? c.type_centre}
                    </span>
                    {c.adresse}
                  </p>
                  <p className="text-xs text-sourdine mt-0.5 flex flex-wrap gap-x-3">
                    {c.reseau_astrid && <span>ASTRID</span>}
                    {c.reseau_regetel && <span>REGETEL</span>}
                    {c.videoconference_disponible && <span>visioconférence</span>}
                    {c.wifi_code && <span>wifi : {c.wifi_code}</span>}
                  </p>
                  {c.numeros_telephone?.length > 0 && (
                    <p className="text-xs text-sourdine mt-0.5">tél. : {c.numeros_telephone.join(', ')}</p>
                  )}
                  {c.procedure_acces && <p className="text-xs text-sourdine mt-0.5 italic">{c.procedure_acces}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(c.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm('Supprimer ce centre de crise ?')) supprimer(c.id)
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

function FormulaireCentreCrise({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [typeCentre, setTypeCentre] = useState(valeursInitiales.type_centre ?? 'principal')
  const [adresse, setAdresse] = useState(valeursInitiales.adresse ?? '')
  const [planAccesUrl, setPlanAccesUrl] = useState(valeursInitiales.plan_acces_url ?? '')
  const [planImplantationUrl, setPlanImplantationUrl] = useState(valeursInitiales.plan_implantation_url ?? '')
  const [wifiCode, setWifiCode] = useState(valeursInitiales.wifi_code ?? '')
  const [numerosTelephone, setNumerosTelephone] = useState((valeursInitiales.numeros_telephone ?? []).join(', '))
  const [reseauAstrid, setReseauAstrid] = useState(valeursInitiales.reseau_astrid ?? true)
  const [reseauRegetel, setReseauRegetel] = useState(valeursInitiales.reseau_regetel ?? false)
  const [videoconference, setVideoconference] = useState(valeursInitiales.videoconference_disponible ?? false)
  const [procedureAcces, setProcedureAcces] = useState(valeursInitiales.procedure_acces ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      type_centre: typeCentre,
      adresse: adresse.trim(),
      plan_acces_url: planAccesUrl.trim() || null,
      plan_implantation_url: planImplantationUrl.trim() || null,
      wifi_code: wifiCode.trim() || null,
      numeros_telephone: numerosTelephone
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean),
      reseau_astrid: reseauAstrid,
      reseau_regetel: reseauRegetel,
      videoconference_disponible: videoconference,
      procedure_acces: procedureAcces.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Type</label>
          <select value={typeCentre} onChange={(e) => setTypeCentre(e.target.value)} className="w-full">
            {TYPES_CENTRE.map((t) => (
              <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Adresse</label>
          <input required value={adresse} onChange={(e) => setAdresse(e.target.value)} className="w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Plan d'accès (URL)</label>
          <input value={planAccesUrl} onChange={(e) => setPlanAccesUrl(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Plan d'implantation (URL)</label>
          <input value={planImplantationUrl} onChange={(e) => setPlanImplantationUrl(e.target.value)} className="w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Code wifi</label>
          <input value={wifiCode} onChange={(e) => setWifiCode(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Numéros de téléphone</label>
          <input
            value={numerosTelephone}
            onChange={(e) => setNumerosTelephone(e.target.value)}
            placeholder="séparés par des virgules"
            className="w-full"
          />
        </div>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-sourdine">
          <input type="checkbox" checked={reseauAstrid} onChange={(e) => setReseauAstrid(e.target.checked)} />
          Réseau ASTRID
        </label>
        <label className="flex items-center gap-2 text-sm text-sourdine">
          <input type="checkbox" checked={reseauRegetel} onChange={(e) => setReseauRegetel(e.target.checked)} />
          Réseau REGETEL
        </label>
        <label className="flex items-center gap-2 text-sm text-sourdine">
          <input type="checkbox" checked={videoconference} onChange={(e) => setVideoconference(e.target.checked)} />
          Visioconférence disponible
        </label>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Procédure d'accès</label>
        <textarea value={procedureAcces} onChange={(e) => setProcedureAcces(e.target.value)} rows={2} className="w-full" />
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
