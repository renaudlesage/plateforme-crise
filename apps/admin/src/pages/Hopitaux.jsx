import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { supabase } from '../lib/supabase'

const TYPES_POINT_CONTACT = [
  { valeur: 'cch', libelle: 'CCH — Cellule de coordination hospitalière' },
  { valeur: 'poc_hosp', libelle: 'POC-HOSP — échange victimes (SPF Santé publique)' },
  { valeur: 'cap_hosp', libelle: "CAP-HOSP — accueil des familles" },
]

const PRODUITS_CBRN = [
  { cle: 'atropine_sulfate_iv', libelle: 'Atropine sulfate (IV)' },
  { cle: 'ciprofloxacine', libelle: 'Ciprofloxacine' },
  { cle: 'ofloxacine', libelle: 'Ofloxacine' },
  { cle: 'levofloxacine', libelle: 'Lévofloxacine (oral/IV)' },
  { cle: 'doxycycline', libelle: 'Doxycycline' },
  { cle: 'gentamicine', libelle: 'Gentamicine' },
  { cle: 'rifampicine', libelle: 'Rifampicine' },
  { cle: 'clindamycine', libelle: 'Clindamycine' },
]

export default function Hopitaux() {
  const { contexteId } = useAuth()
  const {
    lignes: hopitaux,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('hopitaux', contexteId, {
    colonnes: '*, coordinateur:contacts!hopitaux_coordinateur_puh_contact_id_fkey(id, nom, prenom), inspecteur:contacts!hopitaux_inspecteur_hygiene_federal_contact_id_fkey(id, nom, prenom)',
    tri: 'nom',
  })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)
  const [ligneDepliee, setLigneDepliee] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Hôpitaux (PUH)</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un hôpital</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-sourdine mb-4">
        L'hôpital comme structure de coordination de crise — capacité réflexe, dossiers
        pré-préparés, stock pharmaceutique CBRN et points de contact de crise (Plan d'Urgence
        Hospitalier, SPF Santé publique).
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireHopital
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
      ) : hopitaux.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun hôpital enregistré pour ce contexte.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {hopitaux.map((h) =>
            ligneEnEdition === h.id ? (
              <li key={h.id} className="bg-fond p-3">
                <FormulaireHopital
                  valeursInitiales={h}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(h.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={h.id} className="bg-surface">
                <div className="flex items-start justify-between px-4 py-3">
                  <button type="button" className="flex-1 text-left" onClick={() => setLigneDepliee(ligneDepliee === h.id ? null : h.id)}>
                    <p className="text-sm font-medium text-encre">
                      {h.nom}
                      {h.capacite_lits_agrees != null && (
                        <span className="jeton ml-2 text-info">{h.capacite_lits_agrees} lits agréés</span>
                      )}
                      {h.capacite_reflexe_estimee != null && (
                        <span className="jeton ml-2">+{h.capacite_reflexe_estimee} capacité réflexe</span>
                      )}
                    </p>
                    <p className="text-xs text-sourdine mt-0.5">
                      {h.coordinateur && <>coordinateur PUH : {h.coordinateur.prenom} {h.coordinateur.nom}</>}
                      {h.derniere_mise_a_jour_plan && <> · plan à jour au {h.derniere_mise_a_jour_plan}</>}
                    </p>
                  </button>
                  <div className="flex gap-2 flex-shrink-0 ml-3">
                    <BoutonDiscret onClick={() => setLigneEnEdition(h.id)}>Modifier</BoutonDiscret>
                    <BoutonDiscret
                      onClick={() => {
                        if (confirm(`Supprimer l'hôpital "${h.nom}" ?`)) supprimer(h.id)
                      }}
                    >
                      Supprimer
                    </BoutonDiscret>
                  </div>
                </div>
                {ligneDepliee === h.id && (
                  <div className="px-4 pb-4 space-y-4 border-t border-trait bg-fond">
                    <DetailHopital hopital={h} />
                    <GestionPointsContactCrise hopitalId={h.id} />
                  </div>
                )}
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function DetailHopital({ hopital }) {
  const produitsPresents = PRODUITS_CBRN.filter((p) => hopital.stock_cbrn?.[p.cle])
  return (
    <div className="pt-3 text-xs text-sourdine space-y-1">
      {hopital.dossiers_pre_prepares != null && (
        <p>
          Dossiers patients pré-préparés : {hopital.dossiers_pre_prepares}
          {hopital.capacite_lits_agrees ? (
            <> ({Math.round((hopital.dossiers_pre_prepares / hopital.capacite_lits_agrees) * 100)}% de la capacité agréée — repère 10%)</>
          ) : null}
        </p>
      )}
      {hopital.generateur_puissance_kva != null && (
        <p>
          Groupe électrogène : {hopital.generateur_puissance_kva} kVA
          {hopital.generateur_frequence_test_mois != null && <> · testé tous les {hopital.generateur_frequence_test_mois} mois</>}
        </p>
      )}
      {hopital.comite_permanent_frequence_reunion_mois != null && (
        <p>Comité permanent : réunion tous les {hopital.comite_permanent_frequence_reunion_mois} mois</p>
      )}
      {hopital.inspecteur && (
        <p>Reporting inspecteur fédéral d'hygiène : {hopital.inspecteur.prenom} {hopital.inspecteur.nom}</p>
      )}
      <p>
        Stock pharmaceutique CBRN : {produitsPresents.length} / {PRODUITS_CBRN.length}
        {produitsPresents.length > 0 && <> ({produitsPresents.map((p) => p.libelle).join(', ')})</>}
      </p>
    </div>
  )
}

function GestionPointsContactCrise({ hopitalId }) {
  const [points, setPoints] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase.from('points_contact_crise').select('*').eq('hopital_id', hopitalId)
    if (error) setErreur(error.message)
    else setPoints(data ?? [])
    setChargement(false)
  }, [hopitalId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function creer(valeurs) {
    const { error } = await supabase.from('points_contact_crise').insert({ ...valeurs, hopital_id: hopitalId })
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function modifier(idPoint, valeurs) {
    const { error } = await supabase.from('points_contact_crise').update(valeurs).eq('id', idPoint)
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function supprimer(idPoint) {
    const { error } = await supabase.from('points_contact_crise').delete().eq('id', idPoint)
    if (!error) await rafraichir()
  }

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-1.5">
        <p className="etiquette">Points de contact de crise</p>
        {!enAjout && <BoutonDiscret onClick={() => setEnAjout(true)}>Ajouter</BoutonDiscret>}
      </div>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <div className="border border-trait rounded p-3 mb-2 bg-surface">
          <FormulairePointContact
            onAnnuler={() => setEnAjout(false)}
            onValider={async (valeurs) => {
              const { error } = await creer(valeurs)
              if (!error) setEnAjout(false)
              return { error }
            }}
          />
        </div>
      )}

      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : points.length === 0 && !enAjout ? (
        <p className="text-xs text-sourdine">Aucun point de contact défini.</p>
      ) : (
        <ul className="space-y-1.5">
          {points.map((pt) =>
            ligneEnEdition === pt.id ? (
              <li key={pt.id} className="border border-trait rounded p-3 bg-surface">
                <FormulairePointContact
                  valeursInitiales={pt}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(pt.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={pt.id} className="flex items-start justify-between border border-trait rounded px-3 py-2 bg-surface">
                <div className="text-xs text-encre">
                  <span className="jeton mr-2">
                    {TYPES_POINT_CONTACT.find((t) => t.valeur === pt.type_contact)?.libelle ?? pt.type_contact}
                  </span>
                  {pt.actif_pendant_crise && <span className="jeton text-chaud mr-2">actif pendant la crise</span>}
                  {pt.localisation && <span className="text-sourdine">{pt.localisation}</span>}
                  {pt.personnel_affecte && <span className="text-sourdine"> · {pt.personnel_affecte}</span>}
                  {pt.telephone && <span className="text-sourdine"> · {pt.telephone}</span>}
                </div>
                <div className="flex gap-1.5 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(pt.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret onClick={() => supprimer(pt.id)}>Supprimer</BoutonDiscret>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function FormulairePointContact({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [typeContact, setTypeContact] = useState(valeursInitiales.type_contact ?? 'cch')
  const [localisation, setLocalisation] = useState(valeursInitiales.localisation ?? '')
  const [personnelAffecte, setPersonnelAffecte] = useState(valeursInitiales.personnel_affecte ?? '')
  const [telephone, setTelephone] = useState(valeursInitiales.telephone ?? '')
  const [actifPendantCrise, setActifPendantCrise] = useState(valeursInitiales.actif_pendant_crise ?? false)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      type_contact: typeContact,
      localisation: localisation.trim() || null,
      personnel_affecte: personnelAffecte.trim() || null,
      telephone: telephone.trim() || null,
      actif_pendant_crise: actifPendantCrise,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <select value={typeContact} onChange={(e) => setTypeContact(e.target.value)} className="w-full text-xs">
          {TYPES_POINT_CONTACT.map((t) => (
            <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
          ))}
        </select>
        <input value={localisation} onChange={(e) => setLocalisation(e.target.value)} placeholder="Localisation" className="w-full text-xs" />
        <input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Téléphone" className="w-full text-xs" />
      </div>
      <input value={personnelAffecte} onChange={(e) => setPersonnelAffecte(e.target.value)} placeholder="Personnel affecté" className="w-full text-xs" />
      <label className="flex items-center gap-1.5 text-xs text-sourdine">
        <input type="checkbox" checked={actifPendantCrise} onChange={(e) => setActifPendantCrise(e.target.checked)} />
        Actif pendant la crise
      </label>
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <div className="flex gap-1.5">
        <BoutonPrincipal type="submit" disabled={enCours}>{enCours ? '…' : 'Enregistrer'}</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function FormulaireHopital({ valeursInitiales = {}, onValider, onAnnuler }) {
  const { contexteId } = useAuth()
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [nom, setNom] = useState(valeursInitiales.nom ?? '')
  const [capaciteLitsAgrees, setCapaciteLitsAgrees] = useState(valeursInitiales.capacite_lits_agrees ?? '')
  const [capaciteReflexeEstimee, setCapaciteReflexeEstimee] = useState(valeursInitiales.capacite_reflexe_estimee ?? '')
  const [dossiersPrePrepares, setDossiersPrePrepares] = useState(valeursInitiales.dossiers_pre_prepares ?? '')
  const [generateurPuissanceKva, setGenerateurPuissanceKva] = useState(valeursInitiales.generateur_puissance_kva ?? '')
  const [generateurFrequenceTestMois, setGenerateurFrequenceTestMois] = useState(valeursInitiales.generateur_frequence_test_mois ?? '')
  const [coordinateurPuhContactId, setCoordinateurPuhContactId] = useState(valeursInitiales.coordinateur_puh_contact_id ?? '')
  const [comitePermanentFrequenceReunionMois, setComitePermanentFrequenceReunionMois] = useState(valeursInitiales.comite_permanent_frequence_reunion_mois ?? '')
  const [derniereMiseAJourPlan, setDerniereMiseAJourPlan] = useState(valeursInitiales.derniere_mise_a_jour_plan ?? '')
  const [inspecteurHygieneFederalContactId, setInspecteurHygieneFederalContactId] = useState(valeursInitiales.inspecteur_hygiene_federal_contact_id ?? '')
  const [stockCbrn, setStockCbrn] = useState(valeursInitiales.stock_cbrn ?? {})
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  function basculerProduit(cle) {
    setStockCbrn((s) => ({ ...s, [cle]: !s[cle] }))
  }

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      nom: nom.trim(),
      capacite_lits_agrees: capaciteLitsAgrees === '' ? null : Number(capaciteLitsAgrees),
      capacite_reflexe_estimee: capaciteReflexeEstimee === '' ? null : Number(capaciteReflexeEstimee),
      dossiers_pre_prepares: dossiersPrePrepares === '' ? null : Number(dossiersPrePrepares),
      generateur_puissance_kva: generateurPuissanceKva === '' ? null : Number(generateurPuissanceKva),
      generateur_frequence_test_mois: generateurFrequenceTestMois === '' ? null : Number(generateurFrequenceTestMois),
      coordinateur_puh_contact_id: coordinateurPuhContactId || null,
      comite_permanent_frequence_reunion_mois: comitePermanentFrequenceReunionMois === '' ? null : Number(comitePermanentFrequenceReunionMois),
      derniere_mise_a_jour_plan: derniereMiseAJourPlan || null,
      inspecteur_hygiene_federal_contact_id: inspecteurHygieneFederalContactId || null,
      stock_cbrn: stockCbrn,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Nom de l'hôpital</label>
        <input required value={nom} onChange={(e) => setNom(e.target.value)} className="w-full" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Capacité en lits agréés</label>
          <input type="number" min="0" value={capaciteLitsAgrees} onChange={(e) => setCapaciteLitsAgrees(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Capacité réflexe estimée</label>
          <input type="number" min="0" value={capaciteReflexeEstimee} onChange={(e) => setCapaciteReflexeEstimee(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Dossiers pré-préparés</label>
          <p className="text-xs text-sourdine mb-1">repère : ~10% de la capacité agréée</p>
          <input type="number" min="0" value={dossiersPrePrepares} onChange={(e) => setDossiersPrePrepares(e.target.value)} className="w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Groupe électrogène (kVA)</label>
          <input type="number" min="0" step="0.1" value={generateurPuissanceKva} onChange={(e) => setGenerateurPuissanceKva(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Fréquence de test (mois)</label>
          <input type="number" min="1" value={generateurFrequenceTestMois} onChange={(e) => setGenerateurFrequenceTestMois(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Comité permanent (réunion / mois)</label>
          <input type="number" min="1" value={comitePermanentFrequenceReunionMois} onChange={(e) => setComitePermanentFrequenceReunionMois(e.target.value)} className="w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Coordinateur PUH</label>
          <select value={coordinateurPuhContactId} onChange={(e) => setCoordinateurPuhContactId(e.target.value)} className="w-full">
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Inspecteur fédéral d'hygiène (reporting)</label>
          <select value={inspecteurHygieneFederalContactId} onChange={(e) => setInspecteurHygieneFederalContactId(e.target.value)} className="w-full">
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Plan PUH à jour au</label>
          <input type="date" value={derniereMiseAJourPlan} onChange={(e) => setDerniereMiseAJourPlan(e.target.value)} className="w-full" />
        </div>
      </div>

      <div className="border border-trait rounded p-3">
        <p className="text-xs font-medium text-sourdine mb-2">Stock pharmaceutique CBRN (nominatif)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {PRODUITS_CBRN.map((p) => (
            <label key={p.cle} className="flex items-center gap-1.5 text-xs text-encre">
              <input type="checkbox" checked={!!stockCbrn[p.cle]} onChange={() => basculerProduit(p.cle)} />
              {p.libelle}
            </label>
          ))}
        </div>
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
