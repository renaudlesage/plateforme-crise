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
        <h1 className="text-xl font-semibold text-encre">Objets à risque</h1>
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
      <p className="text-sm text-sourdine mb-4">
        Inventaire des risques identifiés — l'évaluation détaillée et le plan d'action se
        feront depuis la fiche de chaque objet (à venir).
      </p>
      {erreurImport && <p className="text-sm text-chaud mb-2">{erreurImport}</p>}

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

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
          className=""
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
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : objetsFiltres.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun objet à risque enregistré.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {objetsFiltres.map((o) =>
            ligneEnEdition === o.id ? (
              <li key={o.id} className="bg-fond p-3">
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
              <li key={o.id} className="flex items-start justify-between px-4 py-3 bg-surface">
                <div>
                  <p className="text-sm font-medium text-encre">
                    {o.identification}
                    {o.code && <span className="ml-2 text-xs font-mono text-sourdine">{o.code}</span>}
                    {o.declencheur && (
                      <span className="jeton ml-2 text-info">
                        cascade renseignée
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-sourdine">
                    {LIBELLE_CATEGORIE[o.categorie] ?? o.categorie}
                    {o.type_risque && <> · {o.type_risque}</>}
                    {o.adresse && <> · {o.adresse}</>}
                  </p>
                  <p className="text-xs text-sourdine mt-0.5 flex flex-wrap gap-x-3">
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
                    {o.ppd_requis && <span className="text-veille">PPD requis</span>}
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
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-sourdine mb-1">Identification</label>
          <input
            required
            value={identification}
            onChange={(e) => setIdentification(e.target.value)}
            placeholder="ex. Zoning industriel Nord"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Code interne</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} className="w-full font-mono" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Catégorie</label>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="w-full">
            {CATEGORIES.map((c) => (
              <option key={c.valeur} value={c.valeur}>{c.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Type de risque</label>
          <input value={typeRisque} onChange={(e) => setTypeRisque(e.target.value)} placeholder="ex. seveso_seuil_haut" className="w-full" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Adresse</label>
        <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className="w-full" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Latitude</label>
          <input value={latitude} onChange={(e) => setLatitude(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Longitude</label>
          <input value={longitude} onChange={(e) => setLongitude(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Capacité (occupants)</label>
          <input type="number" value={capacite} onChange={(e) => setCapacite(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Hauteur infrastructure</label>
          <input value={hauteur} onChange={(e) => setHauteur(e.target.value)} className="w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <label className="flex items-center gap-2 text-sm text-sourdine">
          <input type="checkbox" checked={conformite} onChange={(e) => setConformite(e.target.checked)} />
          Conforme (rapport prévention)
        </label>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Date du rapport</label>
          <input type="date" value={conformiteDate} onChange={(e) => setConformiteDate(e.target.value)} className="w-full" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-sourdine">
        <input type="checkbox" checked={piuRecu} onChange={(e) => setPiuRecu(e.target.checked)} />
        Plan interne d'urgence (PIU) reçu de l'exploitant
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Priorité déclarant (1-20)</label>
          <input type="number" min="1" max="20" value={prioriteDeclarant} onChange={(e) => setPrioriteDeclarant(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Priorité cellule sécurité (1-20)</label>
          <input type="number" min="1" max="20" value={prioriteCellule} onChange={(e) => setPrioriteCellule(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Niveau de confidentialité</label>
          <select value={niveauConfidentialite} onChange={(e) => setNiveauConfidentialite(e.target.value)} className="w-full">
            {NIVEAUX_CONFIDENTIALITE.map((n) => (
              <option key={n.valeur} value={n.valeur}>{n.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2 border border-trait rounded p-3">
        <label className="flex items-center gap-2 text-sm text-sourdine">
          <input type="checkbox" checked={ppdRequis} onChange={(e) => setPpdRequis(e.target.checked)} />
          Plan particulier d'urgence et d'intervention (PPUI) requis
        </label>
        {ppdRequis && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-sourdine mb-1">Conditions de déclenchement du PPUI</label>
              <textarea value={ppdConditions} onChange={(e) => setPpdConditions(e.target.value)} rows={2} className="w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-sourdine mb-1">Distance de sécurité (m)</label>
              <input type="number" value={ppdDistanceSecurite} onChange={(e) => setPpdDistanceSecurite(e.target.value)} className="w-full" />
            </div>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-trait">
        <button
          type="button"
          onClick={() => setAfficherCascade((v) => !v)}
          className="text-sm text-info font-medium hover:underline"
        >
          {afficherCascade ? '▾' : '▸'} Analyse cascade {afficherCascade ? '(masquer)' : '(déplier)'}
        </button>
      </div>

      {afficherCascade && (
        <div className="space-y-3 border border-trait rounded p-3">
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Déclencheur</label>
            <input value={declencheur} onChange={(e) => setDeclencheur(e.target.value)} placeholder="ex. Crue > seuil X à la station Y" className="w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Effets directs</label>
            <textarea value={effetsDirects} onChange={(e) => setEffetsDirects(e.target.value)} rows={2} className="w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Effets de cascade potentiels</label>
            <textarea value={effetsCascade} onChange={(e) => setEffetsCascade(e.target.value)} rows={2} placeholder="ex. coupure électrique -> pompes hors service -> aggravation inondation" className="w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Signaux faibles à surveiller</label>
            <textarea value={signauxFaibles} onChange={(e) => setSignauxFaibles(e.target.value)} rows={2} className="w-full" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-sourdine mb-1">Mesures préventives</label>
              <textarea value={mesuresPreventives} onChange={(e) => setMesuresPreventives(e.target.value)} rows={2} className="w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-sourdine mb-1">Mesures compensatoires</label>
              <textarea value={mesuresCompensatoires} onChange={(e) => setMesuresCompensatoires(e.target.value)} rows={2} className="w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Décisions à préparer</label>
            <textarea value={decisionsAPreparer} onChange={(e) => setDecisionsAPreparer(e.target.value)} rows={2} className="w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Messages publics pré-rédigés</label>
            <textarea value={messagesPublics} onChange={(e) => setMessagesPublics(e.target.value)} rows={2} className="w-full" />
          </div>

          {valeursInitiales.id && <GestionEvaluationsRisque objetId={valeursInitiales.id} />}
          {valeursInitiales.id && <GestionPlansAction objetId={valeursInitiales.id} />}
          {valeursInitiales.id && <GestionFonctionsCritiques objetId={valeursInitiales.id} />}
          {valeursInitiales.id && <GestionMesuresCompensatoires objetId={valeursInitiales.id} />}
        </div>
      )}

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

const STATUTS_MESURE = [
  { valeur: 'planifiee', libelle: 'Planifiée' },
  { valeur: 'en_cours', libelle: 'En cours' },
  { valeur: 'realisee', libelle: 'Réalisée' },
  { valeur: 'abandonnee', libelle: 'Abandonnée' },
]

const STATUTS_PLAN_ACTION = [
  { valeur: 'a_faire', libelle: 'À faire' },
  { valeur: 'en_cours', libelle: 'En cours' },
  { valeur: 'fait', libelle: 'Fait' },
  { valeur: 'abandonne', libelle: 'Abandonné' },
]

function GestionPlansAction({ objetId }) {
  const { contexteId } = useAuth()
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [etapes, setEtapes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [enAjout, setEnAjout] = useState(false)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('plans_action_risque')
      .select('*, contacts(id, nom, prenom)')
      .eq('objet_risque_id', objetId)
      .order('ordre', { ascending: true })
    if (error) setErreur(error.message)
    else setEtapes(data ?? [])
    setChargement(false)
  }, [objetId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function changerStatut(id, statut) {
    const { error } = await supabase.from('plans_action_risque').update({ statut }).eq('id', id)
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  async function retirer(id) {
    if (!confirm("Supprimer cette étape du plan d'action ?")) return
    await supabase.from('plans_action_risque').delete().eq('id', id)
    await rafraichir()
  }

  return (
    <div className="pt-2 border-t">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-sourdine">Plan d'action (étapes ordonnées)</p>
        {!enAjout && (
          <button type="button" onClick={() => setEnAjout(true)} className="text-xs text-info hover:underline">
            + ajouter une étape
          </button>
        )}
      </div>

      {erreur && <p className="text-xs text-chaud mb-1">{erreur}</p>}

      {enAjout && (
        <FormulaireEtapePlanAction
          objetId={objetId}
          contacts={contacts}
          ordreSuivant={etapes.length > 0 ? Math.max(...etapes.map((e) => e.ordre)) + 1 : 1}
          onAnnuler={() => setEnAjout(false)}
          onValider={async () => {
            setEnAjout(false)
            await rafraichir()
          }}
        />
      )}

      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : etapes.length === 0 ? (
        <p className="text-xs text-sourdine">Aucune étape définie pour l'instant.</p>
      ) : (
        <ul className="space-y-1">
          {etapes.map((e) => (
            <li key={e.id} className="bg-surface rounded px-2.5 py-1.5 border border-trait text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-encre">
                    <span className="text-sourdine mr-1">{e.ordre}.</span>
                    {e.libelle}
                  </p>
                  {e.contacts && (
                    <p className="text-sourdine">responsable : {e.contacts.prenom} {e.contacts.nom}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <select
                    value={e.statut ?? 'a_faire'}
                    onChange={(ev) => changerStatut(e.id, ev.target.value)}
                    className=""
                  >
                    {STATUTS_PLAN_ACTION.map((s) => (
                      <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => retirer(e.id)} className="text-sourdine hover:text-chaud">✕</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireEtapePlanAction({ objetId, contacts = [], ordreSuivant, onValider, onAnnuler }) {
  const [ordre, setOrdre] = useState(ordreSuivant)
  const [libelle, setLibelle] = useState('')
  const [responsableContactId, setResponsableContactId] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await supabase.from('plans_action_risque').insert({
      objet_risque_id: objetId,
      ordre: Number(ordre),
      libelle: libelle.trim(),
      responsable_contact_id: responsableContactId || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
    else onValider()
  }

  return (
    <form onSubmit={soumettre} className="bg-surface border border-trait rounded p-2.5 mb-2 space-y-2">
      <div className="grid grid-cols-[4rem_1fr] gap-2">
        <input
          type="number"
          required
          value={ordre}
          onChange={(e) => setOrdre(e.target.value)}
          placeholder="Ordre"
          className="w-full"
        />
        <input
          required
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          placeholder="ex. Évacuer le périmètre immédiat"
          className="w-full"
        />
      </div>
      <select
        value={responsableContactId}
        onChange={(e) => setResponsableContactId(e.target.value)}
        className="w-full"
      >
        <option value="">Responsable — aucun</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
        ))}
      </select>
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonDiscret type="submit" disabled={enCours}>{enCours ? 'Ajout…' : 'Ajouter'}</BoutonDiscret>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

const DIMENSIONS_RISQUE = [
  { cle: 'victimes', libelle: 'Victimes / santé publique' },
  { cle: 'infrastructure', libelle: 'Infrastructure / continuité' },
  { cle: 'environnement', libelle: 'Environnement' },
  { cle: 'financier', libelle: 'Financier' },
]

const PROBABILITES = [
  { valeur: 'rare', libelle: 'Rare' },
  { valeur: 'possible', libelle: 'Possible' },
  { valeur: 'probable', libelle: 'Probable' },
  { valeur: 'quasi_certain', libelle: 'Quasi certain' },
]

function GestionEvaluationsRisque({ objetId }) {
  const [evaluations, setEvaluations] = useState([])
  const [chargement, setChargement] = useState(true)
  const [enAjout, setEnAjout] = useState(false)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('evaluations_risque')
      .select('*')
      .eq('objet_risque_id', objetId)
      .order('date_evaluation', { ascending: false })
    if (error) setErreur(error.message)
    else setEvaluations(data ?? [])
    setChargement(false)
  }, [objetId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function retirer(id) {
    if (!confirm("Supprimer cette évaluation de risque (BNRA/PRGC) ?")) return
    await supabase.from('evaluations_risque').delete().eq('id', id)
    await rafraichir()
  }

  return (
    <div className="pt-2 border-t">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-sourdine">Évaluation du risque (BNRA/PRGC — 4 dimensions × scénario normal/exceptionnel)</p>
        {!enAjout && (
          <button type="button" onClick={() => setEnAjout(true)} className="text-xs text-info hover:underline">
            + nouvelle évaluation
          </button>
        )}
      </div>

      {erreur && <p className="text-xs text-chaud mb-1">{erreur}</p>}

      {enAjout && (
        <FormulaireEvaluationRisque
          objetId={objetId}
          onAnnuler={() => setEnAjout(false)}
          onValider={async () => {
            setEnAjout(false)
            await rafraichir()
          }}
        />
      )}

      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : evaluations.length === 0 ? (
        <p className="text-xs text-sourdine">Aucune évaluation enregistrée.</p>
      ) : (
        <ul className="space-y-1.5">
          {evaluations.map((ev) => (
            <li key={ev.id} className="bg-surface rounded px-2.5 py-2 border border-trait text-xs">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-encre font-medium">
                  {ev.date_evaluation}
                  {ev.evaluation_globale && <span className="ml-2 text-sourdine font-normal">— {ev.evaluation_globale}</span>}
                </p>
                <button type="button" onClick={() => retirer(ev.id)} className="text-sourdine hover:text-chaud flex-shrink-0">✕</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-sourdine">
                {DIMENSIONS_RISQUE.map((d) => {
                  const score = ev[`${d.cle}_score`]
                  const proba = ev[`${d.cle}_probabilite`]
                  if (score == null && !proba) return null
                  return (
                    <div key={d.cle}>
                      <span className="text-sourdine">{d.libelle} :</span>{' '}
                      {score != null && <>score {score}</>}
                      {proba && <> ({PROBABILITES.find((p) => p.valeur === proba)?.libelle ?? proba})</>}
                    </div>
                  )
                })}
              </div>
              {(ev.duree_situation || ev.vitesse_developpement) && (
                <p className="text-sourdine mt-1">
                  {ev.duree_situation && <>durée : {ev.duree_situation}</>}
                  {ev.vitesse_developpement && <> · vitesse de développement : {ev.vitesse_developpement}</>}
                </p>
              )}
              {ev.elements_aggravants && <p className="text-sourdine mt-0.5">aggravants : {ev.elements_aggravants}</p>}
              {ev.elements_attenuants && <p className="text-sourdine mt-0.5">atténuants : {ev.elements_attenuants}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireEvaluationRisque({ objetId, onValider, onAnnuler }) {
  const [dateEvaluation, setDateEvaluation] = useState(new Date().toISOString().slice(0, 10))
  const [valeurs, setValeurs] = useState(
    Object.fromEntries(
      DIMENSIONS_RISQUE.flatMap((d) => [
        [`${d.cle}_score`, ''],
        [`${d.cle}_probabilite`, ''],
        [`${d.cle}_score_exceptionnel`, ''],
        [`${d.cle}_probabilite_exceptionnel`, ''],
      ])
    )
  )
  const [dureeSituation, setDureeSituation] = useState('')
  const [vitesseDeveloppement, setVitesseDeveloppement] = useState('')
  const [elementsAggravants, setElementsAggravants] = useState('')
  const [elementsAttenuants, setElementsAttenuants] = useState('')
  const [evaluationGlobale, setEvaluationGlobale] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  function majValeur(cle, v) {
    setValeurs((prev) => ({ ...prev, [cle]: v }))
  }

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const scoresEtProbas = Object.fromEntries(
      Object.entries(valeurs).map(([cle, v]) => {
        if (v === '') return [cle, null]
        if (cle.includes('_score')) return [cle, Number(v)]
        return [cle, v]
      })
    )
    const { error } = await supabase.from('evaluations_risque').insert({
      objet_risque_id: objetId,
      date_evaluation: dateEvaluation,
      ...scoresEtProbas,
      duree_situation: dureeSituation.trim() || null,
      vitesse_developpement: vitesseDeveloppement.trim() || null,
      elements_aggravants: elementsAggravants.trim() || null,
      elements_attenuants: elementsAttenuants.trim() || null,
      evaluation_globale: evaluationGlobale.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
    else onValider()
  }

  return (
    <form onSubmit={soumettre} className="bg-surface border border-trait rounded p-3 mb-2 space-y-2.5">
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Date de l'évaluation</label>
        <input type="date" required value={dateEvaluation} onChange={(e) => setDateEvaluation(e.target.value)} className="w-full sm:w-48" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-sourdine">
              <th className="text-left font-normal pb-1">Dimension</th>
              <th className="text-left font-normal pb-1" colSpan={2}>Scénario normal</th>
              <th className="text-left font-normal pb-1" colSpan={2}>Scénario exceptionnel</th>
            </tr>
          </thead>
          <tbody>
            {DIMENSIONS_RISQUE.map((d) => (
              <tr key={d.cle} className="border-t border-trait">
                <td className="py-1.5 pr-2 text-sourdine">{d.libelle}</td>
                <td className="py-1.5 pr-1">
                  <input
                    type="number"
                    min="1"
                    max="4"
                    placeholder="score 1-4"
                    value={valeurs[`${d.cle}_score`]}
                    onChange={(e) => majValeur(`${d.cle}_score`, e.target.value)}
                    className="w-16"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <select
                    value={valeurs[`${d.cle}_probabilite`]}
                    onChange={(e) => majValeur(`${d.cle}_probabilite`, e.target.value)}
                    className=""
                  >
                    <option value="">probabilité —</option>
                    {PROBABILITES.map((p) => (
                      <option key={p.valeur} value={p.valeur}>{p.libelle}</option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 pr-1">
                  <input
                    type="number"
                    min="1"
                    max="4"
                    placeholder="score 1-4"
                    value={valeurs[`${d.cle}_score_exceptionnel`]}
                    onChange={(e) => majValeur(`${d.cle}_score_exceptionnel`, e.target.value)}
                    className="w-16"
                  />
                </td>
                <td className="py-1.5">
                  <select
                    value={valeurs[`${d.cle}_probabilite_exceptionnel`]}
                    onChange={(e) => majValeur(`${d.cle}_probabilite_exceptionnel`, e.target.value)}
                    className=""
                  >
                    <option value="">probabilité —</option>
                    {PROBABILITES.map((p) => (
                      <option key={p.valeur} value={p.valeur}>{p.libelle}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <input value={dureeSituation} onChange={(e) => setDureeSituation(e.target.value)} placeholder="Durée de la situation" className="w-full" />
        <input value={vitesseDeveloppement} onChange={(e) => setVitesseDeveloppement(e.target.value)} placeholder="Vitesse de développement" className="w-full" />
      </div>
      <textarea value={elementsAggravants} onChange={(e) => setElementsAggravants(e.target.value)} placeholder="Éléments aggravants" rows={2} className="w-full" />
      <textarea value={elementsAttenuants} onChange={(e) => setElementsAttenuants(e.target.value)} placeholder="Éléments atténuants" rows={2} className="w-full" />
      <input value={evaluationGlobale} onChange={(e) => setEvaluationGlobale(e.target.value)} placeholder="Évaluation globale (synthèse)" className="w-full" />

      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonDiscret type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</BoutonDiscret>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function GestionMesuresCompensatoires({ objetId }) {
  const { contexteId } = useAuth()
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [mesures, setMesures] = useState([])
  const [chargement, setChargement] = useState(true)
  const [enAjout, setEnAjout] = useState(false)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('mesures_compensatoires_suivi')
      .select('*, contacts(id, nom, prenom)')
      .eq('objet_risque_id', objetId)
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
    <div className="pt-2 border-t">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-sourdine">Suivi quantifié des mesures compensatoires</p>
        {!enAjout && (
          <button type="button" onClick={() => setEnAjout(true)} className="text-xs text-info hover:underline">
            + ajouter
          </button>
        )}
      </div>

      {erreur && <p className="text-xs text-chaud mb-1">{erreur}</p>}

      {enAjout && (
        <FormulaireMesureCompensatoire
          objetId={objetId}
          contacts={contacts}
          onAnnuler={() => setEnAjout(false)}
          onValider={async () => {
            setEnAjout(false)
            await rafraichir()
          }}
        />
      )}

      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : mesures.length === 0 ? (
        <p className="text-xs text-sourdine">Aucune mesure suivie pour l'instant.</p>
      ) : (
        <ul className="space-y-1">
          {mesures.map((m) => (
            <li key={m.id} className="bg-surface rounded px-2.5 py-1.5 border border-trait text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-encre">{m.mesure}</p>
                  {m.quantification && <p className="text-sourdine">{m.quantification}</p>}
                  {(m.date_cible || m.date_realisation) && (
                    <p className="text-sourdine">
                      {m.date_cible && <>cible : {m.date_cible}</>}
                      {m.date_realisation && <> · réalisée : {m.date_realisation}</>}
                    </p>
                  )}
                  {m.contacts && (
                    <p className="text-sourdine">responsable : {m.contacts.prenom} {m.contacts.nom}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <select
                    value={m.statut}
                    onChange={(e) => changerStatut(m.id, e.target.value)}
                    className=""
                  >
                    {STATUTS_MESURE.map((s) => (
                      <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => retirer(m.id)} className="text-sourdine hover:text-chaud">✕</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireMesureCompensatoire({ objetId, contacts = [], onValider, onAnnuler }) {
  const [mesure, setMesure] = useState('')
  const [quantification, setQuantification] = useState('')
  const [dateCible, setDateCible] = useState('')
  const [responsableContactId, setResponsableContactId] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await supabase.from('mesures_compensatoires_suivi').insert({
      objet_risque_id: objetId,
      mesure: mesure.trim(),
      quantification: quantification.trim() || null,
      date_cible: dateCible || null,
      responsable_contact_id: responsableContactId || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
    else onValider()
  }

  return (
    <form onSubmit={soumettre} className="bg-surface border border-trait rounded p-2.5 mb-2 space-y-2">
      <input
        required
        value={mesure}
        onChange={(e) => setMesure(e.target.value)}
        placeholder="ex. Installation de 2 pompes de secours supplémentaires"
        className="w-full"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={quantification}
          onChange={(e) => setQuantification(e.target.value)}
          placeholder="Quantification (ex. 2/4 réalisées)"
          className="w-full"
        />
        <input type="date" value={dateCible} onChange={(e) => setDateCible(e.target.value)} className="w-full" />
      </div>
      <select
        value={responsableContactId}
        onChange={(e) => setResponsableContactId(e.target.value)}
        className="w-full"
      >
        <option value="">Responsable — aucun</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
        ))}
      </select>
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
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
    <div className="pt-2 border-t">
      <p className="text-xs font-medium text-sourdine mb-2">Fonctions critiques impactées</p>
      {erreur && <p className="text-xs text-chaud mb-1">{erreur}</p>}
      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : (
        <>
          {liees.length > 0 && (
            <ul className="space-y-1 mb-2">
              {liees.map((l) => (
                <li key={l.fonction_critique_id} className="jeton flex items-center justify-between bg-surface border border-trait">
                  <span>{l.fonctions_critiques?.nom} <span className="text-sourdine">({l.fonctions_critiques?.statut_actuel})</span></span>
                  <button type="button" onClick={() => retirer(l.fonction_critique_id)} className="text-sourdine hover:text-chaud">✕</button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <select value={selection} onChange={(e) => setSelection(e.target.value)} className="flex-1">
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
