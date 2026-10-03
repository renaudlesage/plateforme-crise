import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { supabase } from '../lib/supabase'
import { PACK_DEMARRAGE_RISQUES } from '../data/packDemarrageRisques'

const CATEGORIES = [
  { valeur: 'naturel', libelle: 'Naturel' },
  { valeur: 'technologique', libelle: 'Technologique' },
  { valeur: 'industriel', libelle: 'Industriel' },
  { valeur: 'non_localisable', libelle: 'Non localisable' },
  { valeur: 'batiment_particulier', libelle: 'Bâtiment particulier' },
  { valeur: 'evenement', libelle: 'Événement' },
]

const LIBELLE_CATEGORIE = Object.fromEntries(CATEGORIES.map((c) => [c.valeur, c.libelle]))

const NIVEAUX_CONFIDENTIALITE = [
  { valeur: 'public', libelle: 'Public' },
  { valeur: 'restreint', libelle: 'Restreint' },
  { valeur: 'confidentiel', libelle: 'Confidentiel' },
]

export default function ObjetsARisque() {
  const { contexteId } = useAuth()
  const {
    lignes: objets,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
    rafraichir,
  } = useTableContexte('objets_a_risque', contexteId, { tri: 'identification' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)
  const [filtreCategorie, setFiltreCategorie] = useState('')
  const [importEnCours, setImportEnCours] = useState(false)
  const [erreurImport, setErreurImport] = useState(null)

  const packDejaImporte = objets.some((o) => o.code?.startsWith('STARTER-'))

  async function importerPackDemarrage() {
    if (!confirm(`Importer les ${PACK_DEMARRAGE_RISQUES.length} fiches du pack de démarrage (12 génériques + 6 nucléaire) ?`)) return
    setImportEnCours(true)
    setErreurImport(null)
    const lignes = PACK_DEMARRAGE_RISQUES.map((r) => ({ ...r, contexte_id: contexteId }))
    const { error } = await supabase.from('objets_a_risque').insert(lignes)
    setImportEnCours(false)
    if (error) setErreurImport(error.message)
    else await rafraichir()
  }

  const objetsFiltres = filtreCategorie
    ? objets.filter((o) => o.categorie === filtreCategorie)
    : objets

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-xl font-semibold text-slate-900">Objets à risque</h1>
        <div className="flex gap-2">
          {!packDejaImporte && (
            <BoutonDiscret onClick={importerPackDemarrage} disabled={importEnCours}>
              {importEnCours ? 'Import…' : 'Importer le pack de démarrage (18 fiches)'}
            </BoutonDiscret>
          )}
          {!enAjout && (
            <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un objet</BoutonPrincipal>
          )}
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Inventaire des risques identifiés — l'évaluation détaillée et le plan d'action se
        feront depuis la fiche de chaque objet (à venir).
      </p>
      {erreurImport && <p className="text-sm text-red-600 mb-2">{erreurImport}</p>}

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireObjet
          onAnnuler={() => setEnAjout(false)}
          onValider={async (valeurs) => {
            const { error } = await creer(valeurs)
            if (!error) setEnAjout(false)
            return { error }
          }}
        />
      )}

      <div className="mb-3">
        <select
          value={filtreCategorie}
          onChange={(e) => setFiltreCategorie(e.target.value)}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
        >
          <option value="">Toutes catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c.valeur} value={c.valeur}>
              {c.libelle}
            </option>
          ))}
        </select>
      </div>

      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : objetsFiltres.length === 0 ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          Aucun objet à risque enregistré.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          {objetsFiltres.map((o) =>
            ligneEnEdition === o.id ? (
              <li key={o.id} className="bg-slate-50 p-3">
                <FormulaireObjet
                  valeursInitiales={o}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(o.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={o.id} className="flex items-start justify-between px-4 py-3 bg-white">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {o.identification}
                    {o.code && <span className="ml-2 text-xs font-mono text-slate-400">{o.code}</span>}
                    {o.declencheur && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-institution-50 text-institution-700">
                        cascade renseignée
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {LIBELLE_CATEGORIE[o.categorie] ?? o.categorie}
                    {o.type_risque && <> · {o.type_risque}</>}
                    {o.adresse && <> · {o.adresse}</>}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-x-3">
                    {o.capacite_occupants != null && <span>capacité : {o.capacite_occupants}</span>}
                    {o.conformite_prevention != null && (
                      <span>
                        conformité prévention :{' '}
                        {o.conformite_prevention ? 'oui' : 'non'}
                        {o.conformite_date ? ` (${o.conformite_date})` : ''}
                      </span>
                    )}
                    {o.piu_recu != null && <span>PIU reçu : {o.piu_recu ? 'oui' : 'non'}</span>}
                    {o.priorite_declarant != null && <span>priorité déclarant : {o.priorite_declarant}</span>}
                    {o.priorite_cellule_securite != null && (
                      <span>priorité cellule sécurité : {o.priorite_cellule_securite}</span>
                    )}
                    {o.ppd_requis && <span className="text-amber-600">PPD requis</span>}
                    {o.niveau_confidentialite && o.niveau_confidentialite !== 'restreint' && (
                      <span>confidentialité : {o.niveau_confidentialite}</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(o.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer "${o.identification}" ?`)) supprimer(o.id)
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

function FormulaireObjet({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [code, setCode] = useState(valeursInitiales.code ?? '')
  const [categorie, setCategorie] = useState(valeursInitiales.categorie ?? 'naturel')
  const [typeRisque, setTypeRisque] = useState(valeursInitiales.type_risque ?? '')
  const [identification, setIdentification] = useState(valeursInitiales.identification ?? '')
  const [adresse, setAdresse] = useState(valeursInitiales.adresse ?? '')
  const [latitude, setLatitude] = useState(valeursInitiales.latitude ?? '')
  const [longitude, setLongitude] = useState(valeursInitiales.longitude ?? '')
  const [capacite, setCapacite] = useState(valeursInitiales.capacite_occupants ?? '')
  const [hauteur, setHauteur] = useState(valeursInitiales.hauteur_infrastructure ?? '')
  const [conformite, setConformite] = useState(valeursInitiales.conformite_prevention ?? false)
  const [conformiteDate, setConformiteDate] = useState(valeursInitiales.conformite_date ?? '')
  const [piuRecu, setPiuRecu] = useState(valeursInitiales.piu_recu ?? false)
  const [prioriteDeclarant, setPrioriteDeclarant] = useState(valeursInitiales.priorite_declarant ?? '')
  const [prioriteCellule, setPrioriteCellule] = useState(valeursInitiales.priorite_cellule_securite ?? '')
  const [niveauConfidentialite, setNiveauConfidentialite] = useState(valeursInitiales.niveau_confidentialite ?? 'restreint')
  const [ppdRequis, setPpdRequis] = useState(valeursInitiales.ppd_requis ?? false)
  const [ppdConditions, setPpdConditions] = useState(valeursInitiales.ppd_conditions ?? '')
  const [ppdDistanceSecurite, setPpdDistanceSecurite] = useState(valeursInitiales.ppd_distance_securite_m ?? '')
  const [afficherCascade, setAfficherCascade] = useState(false)
  const [declencheur, setDeclencheur] = useState(valeursInitiales.declencheur ?? '')
  const [effetsDirects, setEffetsDirects] = useState(valeursInitiales.effets_directs ?? '')
  const [effetsCascade, setEffetsCascade] = useState(valeursInitiales.effets_cascade ?? '')
  const [signauxFaibles, setSignauxFaibles] = useState(valeursInitiales.signaux_faibles ?? '')
  const [mesuresPreventives, setMesuresPreventives] = useState(valeursInitiales.mesures_preventives ?? '')
  const [mesuresCompensatoires, setMesuresCompensatoires] = useState(valeursInitiales.mesures_compensatoires ?? '')
  const [decisionsAPreparer, setDecisionsAPreparer] = useState(valeursInitiales.decisions_a_preparer ?? '')
  const [messagesPublics, setMessagesPublics] = useState(valeursInitiales.messages_publics_predefinis ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      code: code.trim() || null,
      categorie,
      type_risque: typeRisque.trim(),
      identification: identification.trim(),
      adresse: adresse.trim() || null,
      latitude: latitude === '' ? null : Number(latitude),
      longitude: longitude === '' ? null : Number(longitude),
      capacite_occupants: capacite === '' ? null : Number(capacite),
      hauteur_infrastructure: hauteur.trim() || null,
      conformite_prevention: conformite,
      conformite_date: conformiteDate || null,
      piu_recu: piuRecu,
      priorite_declarant: prioriteDeclarant === '' ? null : Number(prioriteDeclarant),
      priorite_cellule_securite: prioriteCellule === '' ? null : Number(prioriteCellule),
      niveau_confidentialite: niveauConfidentialite,
      ppd_requis: ppdRequis,
      ppd_conditions: ppdConditions.trim() || null,
      ppd_distance_securite_m: ppdDistanceSecurite === '' ? null : Number(ppdDistanceSecurite),
      declencheur: declencheur.trim() || null,
      effets_directs: effetsDirects.trim() || null,
      effets_cascade: effetsCascade.trim() || null,
      signaux_faibles: signauxFaibles.trim() || null,
      mesures_preventives: mesuresPreventives.trim() || null,
      mesures_compensatoires: mesuresCompensatoires.trim() || null,
      decisions_a_preparer: decisionsAPreparer.trim() || null,
      messages_publics_predefinis: messagesPublics.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Identification</label>
          <input
            required
            value={identification}
            onChange={(e) => setIdentification(e.target.value)}
            placeholder="ex. Zoning industriel Nord"
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Code interne</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Catégorie</label>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            {CATEGORIES.map((c) => (
              <option key={c.valeur} value={c.valeur}>{c.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Type de risque</label>
          <input value={typeRisque} onChange={(e) => setTypeRisque(e.target.value)} placeholder="ex. seveso_seuil_haut" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Adresse</label>
        <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Latitude</label>
          <input value={latitude} onChange={(e) => setLatitude(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Longitude</label>
          <input value={longitude} onChange={(e) => setLongitude(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Capacité (occupants)</label>
          <input type="number" value={capacite} onChange={(e) => setCapacite(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Hauteur infrastructure</label>
          <input value={hauteur} onChange={(e) => setHauteur(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={conformite} onChange={(e) => setConformite(e.target.checked)} />
          Conforme (rapport prévention)
        </label>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date du rapport</label>
          <input type="date" value={conformiteDate} onChange={(e) => setConformiteDate(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={piuRecu} onChange={(e) => setPiuRecu(e.target.checked)} />
        Plan interne d'urgence (PIU) reçu de l'exploitant
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Priorité déclarant (1-20)</label>
          <input type="number" min="1" max="20" value={prioriteDeclarant} onChange={(e) => setPrioriteDeclarant(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Priorité cellule sécurité (1-20)</label>
          <input type="number" min="1" max="20" value={prioriteCellule} onChange={(e) => setPrioriteCellule(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Niveau de confidentialité</label>
          <select value={niveauConfidentialite} onChange={(e) => setNiveauConfidentialite(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            {NIVEAUX_CONFIDENTIALITE.map((n) => (
              <option key={n.valeur} value={n.valeur}>{n.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2 bg-amber-50/40 border border-amber-100 rounded-lg p-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={ppdRequis} onChange={(e) => setPpdRequis(e.target.checked)} />
          Plan particulier d'urgence et d'intervention (PPUI) requis
        </label>
        {ppdRequis && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Conditions de déclenchement du PPUI</label>
              <textarea value={ppdConditions} onChange={(e) => setPpdConditions(e.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Distance de sécurité (m)</label>
              <input type="number" value={ppdDistanceSecurite} onChange={(e) => setPpdDistanceSecurite(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
            </div>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-slate-200">
        <button
          type="button"
          onClick={() => setAfficherCascade((v) => !v)}
          className="text-sm text-institution-700 font-medium hover:underline"
        >
          {afficherCascade ? '▾' : '▸'} Analyse cascade {afficherCascade ? '(masquer)' : '(déplier)'}
        </button>
      </div>

      {afficherCascade && (
        <div className="space-y-3 bg-institution-50/40 border border-institution-100 rounded-lg p-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Déclencheur</label>
            <input value={declencheur} onChange={(e) => setDeclencheur(e.target.value)} placeholder="ex. Crue > seuil X à la station Y" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Effets directs</label>
            <textarea value={effetsDirects} onChange={(e) => setEffetsDirects(e.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Effets de cascade potentiels</label>
            <textarea value={effetsCascade} onChange={(e) => setEffetsCascade(e.target.value)} rows={2} placeholder="ex. coupure électrique -> pompes hors service -> aggravation inondation" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Signaux faibles à surveiller</label>
            <textarea value={signauxFaibles} onChange={(e) => setSignauxFaibles(e.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mesures préventives</label>
              <textarea value={mesuresPreventives} onChange={(e) => setMesuresPreventives(e.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mesures compensatoires</label>
              <textarea value={mesuresCompensatoires} onChange={(e) => setMesuresCompensatoires(e.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Décisions à préparer</label>
            <textarea value={decisionsAPreparer} onChange={(e) => setDecisionsAPreparer(e.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Messages publics pré-rédigés</label>
            <textarea value={messagesPublics} onChange={(e) => setMessagesPublics(e.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
          </div>

          {valeursInitiales.id && <GestionFonctionsCritiques objetId={valeursInitiales.id} />}
          {valeursInitiales.id && <GestionMesuresCompensatoires objetId={valeursInitiales.id} />}
        </div>
      )}

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

const STATUTS_MESURE = [
  { valeur: 'planifiee', libelle: 'Planifiée' },
  { valeur: 'en_cours', libelle: 'En cours' },
  { valeur: 'realisee', libelle: 'Réalisée' },
  { valeur: 'abandonnee', libelle: 'Abandonnée' },
]

function GestionMesuresCompensatoires({ objetId }) {
  const [mesures, setMesures] = useState([])
  const [chargement, setChargement] = useState(true)
  const [enAjout, setEnAjout] = useState(false)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('mesures_compensatoires_suivi')
      .select('*')
      .eq('objet_id', objetId)
      .order('created_at', { ascending: false })
    if (error) setErreur(error.message)
    else setMesures(data ?? [])
    setChargement(false)
  }, [objetId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function changerStatut(id, statut) {
    const { error } = await supabase.from('mesures_compensatoires_suivi').update({ statut }).eq('id', id)
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  async function retirer(id) {
    if (!confirm('Supprimer ce suivi de mesure compensatoire ?')) return
    await supabase.from('mesures_compensatoires_suivi').delete().eq('id', id)
    await rafraichir()
  }

  return (
    <div className="pt-2 border-t border-institution-100">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-600">Suivi quantifié des mesures compensatoires</p>
        {!enAjout && (
          <button type="button" onClick={() => setEnAjout(true)} className="text-xs text-institution-700 hover:underline">
            + ajouter
          </button>
        )}
      </div>

      {erreur && <p className="text-xs text-red-600 mb-1">{erreur}</p>}

      {enAjout && (
        <FormulaireMesureCompensatoire
          objetId={objetId}
          onAnnuler={() => setEnAjout(false)}
          onValider={async () => {
            setEnAjout(false)
            await rafraichir()
          }}
        />
      )}

      {chargement ? (
        <p className="text-xs text-slate-400">Chargement…</p>
      ) : mesures.length === 0 ? (
        <p className="text-xs text-slate-400">Aucune mesure suivie pour l'instant.</p>
      ) : (
        <ul className="space-y-1">
          {mesures.map((m) => (
            <li key={m.id} className="bg-white rounded px-2.5 py-1.5 border border-slate-200 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-slate-800">{m.mesure}</p>
                  {m.quantification && <p className="text-slate-400">{m.quantification}</p>}
                  {(m.date_cible || m.date_realisation) && (
                    <p className="text-slate-400">
                      {m.date_cible && <>cible : {m.date_cible}</>}
                      {m.date_realisation && <> · réalisée : {m.date_realisation}</>}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <select
                    value={m.statut}
                    onChange={(e) => changerStatut(m.id, e.target.value)}
                    className="rounded border border-slate-300 px-1.5 py-1 text-xs bg-white"
                  >
                    {STATUTS_MESURE.map((s) => (
                      <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => retirer(m.id)} className="text-slate-400 hover:text-red-600">✕</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireMesureCompensatoire({ objetId, onValider, onAnnuler }) {
  const [mesure, setMesure] = useState('')
  const [quantification, setQuantification] = useState('')
  const [dateCible, setDateCible] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await supabase.from('mesures_compensatoires_suivi').insert({
      objet_id: objetId,
      mesure: mesure.trim(),
      quantification: quantification.trim() || null,
      date_cible: dateCible || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
    else onValider()
  }

  return (
    <form onSubmit={soumettre} className="bg-white border border-slate-200 rounded-lg p-2.5 mb-2 space-y-2">
      <input
        required
        value={mesure}
        onChange={(e) => setMesure(e.target.value)}
        placeholder="ex. Installation de 2 pompes de secours supplémentaires"
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={quantification}
          onChange={(e) => setQuantification(e.target.value)}
          placeholder="Quantification (ex. 2/4 réalisées)"
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
        />
        <input type="date" value={dateCible} onChange={(e) => setDateCible(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs" />
      </div>
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonDiscret type="submit" disabled={enCours}>{enCours ? 'Ajout…' : 'Ajouter'}</BoutonDiscret>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function GestionFonctionsCritiques({ objetId }) {
  const { contexteId } = useAuth()
  const { lignes: toutesFonctions } = useTableContexte('fonctions_critiques', contexteId, { tri: 'nom' })
  const [liees, setLiees] = useState([])
  const [chargement, setChargement] = useState(true)
  const [selection, setSelection] = useState('')
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('objets_a_risque_fonctions_critiques')
      .select('fonction_critique_id, fonctions_critiques(id, nom, statut_actuel)')
      .eq('objet_id', objetId)
    if (error) setErreur(error.message)
    else setLiees(data ?? [])
    setChargement(false)
  }, [objetId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function ajouter() {
    if (!selection) return
    const { error } = await supabase
      .from('objets_a_risque_fonctions_critiques')
      .insert({ objet_id: objetId, fonction_critique_id: selection })
    if (error) setErreur(error.message)
    else {
      setSelection('')
      await rafraichir()
    }
  }

  async function retirer(fonctionId) {
    await supabase
      .from('objets_a_risque_fonctions_critiques')
      .delete()
      .eq('objet_id', objetId)
      .eq('fonction_critique_id', fonctionId)
    await rafraichir()
  }

  const disponibles = toutesFonctions.filter((f) => !liees.some((l) => l.fonction_critique_id === f.id))

  return (
    <div className="pt-2 border-t border-institution-100">
      <p className="text-xs font-medium text-slate-600 mb-2">Fonctions critiques impactées</p>
      {erreur && <p className="text-xs text-red-600 mb-1">{erreur}</p>}
      {chargement ? (
        <p className="text-xs text-slate-400">Chargement…</p>
      ) : (
        <>
          {liees.length > 0 && (
            <ul className="space-y-1 mb-2">
              {liees.map((l) => (
                <li key={l.fonction_critique_id} className="flex items-center justify-between text-xs bg-white rounded px-2.5 py-1.5 border border-slate-200">
                  <span>{l.fonctions_critiques?.nom} <span className="text-slate-400">({l.fonctions_critiques?.statut_actuel})</span></span>
                  <button type="button" onClick={() => retirer(l.fonction_critique_id)} className="text-slate-400 hover:text-red-600">✕</button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <select value={selection} onChange={(e) => setSelection(e.target.value)} className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs bg-white">
              <option value="">Ajouter une fonction critique…</option>
              {disponibles.map((f) => (
                <option key={f.id} value={f.id}>{f.nom}</option>
              ))}
            </select>
            <BoutonDiscret type="button" onClick={ajouter} disabled={!selection}>Ajouter</BoutonDiscret>
          </div>
        </>
      )}
    </div>
  )
}
