import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { supabase } from '../lib/supabase'

const TYPES_EXERCICE = [
  { valeur: 'visite_guidee', libelle: 'Visite guidée' },
  { valeur: 'etude_cas', libelle: 'Étude de cas' },
  { valeur: 'alerte', libelle: 'Exercice d’alerte' },
  { valeur: 'farex', libelle: 'FarEx (fonctionnel partiel)' },
  { valeur: 'ttx', libelle: 'TTX (table-top)' },
  { valeur: 'cpx', libelle: 'CPX (poste de commandement)' },
  { valeur: 'ftx', libelle: 'FTX (grandeur réelle)' },
]

const LIBELLE_TYPE_EXERCICE = Object.fromEntries(TYPES_EXERCICE.map((t) => [t.valeur, t.libelle]))

function lignesVersJson(texte) {
  const lignes = texte.split('\n').map((l) => l.trim()).filter(Boolean)
  return lignes.length ? lignes : []
}

function jsonVersLignes(valeur) {
  if (!valeur) return ''
  if (Array.isArray(valeur)) return valeur.join('\n')
  return ''
}

export default function Exercices() {
  const { contexteId } = useAuth()
  const {
    lignes: exercices,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('exercices', contexteId, { tri: 'date_planifiee' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Exercices</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un exercice</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Exercices planifiés, réalisés et leur évaluation.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireExercice
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
      ) : exercices.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun exercice enregistré.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {exercices.map((ex) =>
            ligneEnEdition === ex.id ? (
              <li key={ex.id} className="bg-fond p-3">
                <FormulaireExercice
                  valeursInitiales={ex}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(ex.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={ex.id} className="flex items-start justify-between px-4 py-3 bg-surface">
                <div>
                  <p className="text-sm font-medium text-encre">
                    {LIBELLE_TYPE_EXERCICE[ex.type_exercice] ?? ex.type_exercice}
                    {ex.valide_par_niveau_superieur && (
                      <span className="jeton ml-2 text-ok">
                        validé niveau supérieur
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-sourdine">
                    {ex.date_planifiee && <>planifié : {ex.date_planifiee}</>}
                    {ex.date_realisee && <> · réalisé : {ex.date_realisee}</>}
                  </p>
                  {ex.objectifs && <p className="text-xs text-sourdine mt-1">objectifs : {ex.objectifs}</p>}
                  {ex.evaluation && <p className="text-xs text-sourdine mt-0.5">évaluation : {ex.evaluation}</p>}
                  {ex.rapport_final && <p className="text-xs text-sourdine mt-0.5">rapport final renseigné</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(ex.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm('Supprimer cet exercice ?')) supprimer(ex.id)
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

function FormulaireExercice({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [typeExercice, setTypeExercice] = useState(valeursInitiales.type_exercice ?? TYPES_EXERCICE[0].valeur)
  const [datePlanifiee, setDatePlanifiee] = useState(valeursInitiales.date_planifiee ?? '')
  const [dateRealisee, setDateRealisee] = useState(valeursInitiales.date_realisee ?? '')
  const [objectifs, setObjectifs] = useState(valeursInitiales.objectifs ?? '')
  const [objectifsStructures, setObjectifsStructures] = useState(jsonVersLignes(valeursInitiales.objectifs_jsonb))
  const [mel, setMel] = useState(jsonVersLignes(valeursInitiales.mel))
  const [consignesSecurite, setConsignesSecurite] = useState(valeursInitiales.consignes_securite ?? '')
  const [evaluation, setEvaluation] = useState(valeursInitiales.evaluation ?? '')
  const [rapportFinal, setRapportFinal] = useState(valeursInitiales.rapport_final ?? '')
  const [valide, setValide] = useState(valeursInitiales.valide_par_niveau_superieur ?? false)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      type_exercice: typeExercice,
      date_planifiee: datePlanifiee || null,
      date_realisee: dateRealisee || null,
      objectifs: objectifs.trim() || null,
      objectifs_jsonb: lignesVersJson(objectifsStructures),
      mel: lignesVersJson(mel),
      consignes_securite: consignesSecurite.trim() || null,
      evaluation: evaluation.trim() || null,
      rapport_final: rapportFinal.trim() || null,
      valide_par_niveau_superieur: valide,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Type d'exercice</label>
        <select
          value={typeExercice}
          onChange={(e) => setTypeExercice(e.target.value)}
          className="w-full"
        >
          {TYPES_EXERCICE.map((t) => (
            <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Date planifiée</label>
          <input type="date" value={datePlanifiee} onChange={(e) => setDatePlanifiee(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Date réalisée</label>
          <input type="date" value={dateRealisee} onChange={(e) => setDateRealisee(e.target.value)} className="w-full" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Objectifs (résumé libre)</label>
        <textarea value={objectifs} onChange={(e) => setObjectifs(e.target.value)} rows={2} className="w-full" />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Objectifs structurés (un par ligne)</label>
        <textarea value={objectifsStructures} onChange={(e) => setObjectifsStructures(e.target.value)} rows={3} placeholder={'ex.\nTester l’activation du Comité de Coordination\nValider le délai de notification des disciplines'} className="w-full" />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">MEL — Main Events List (un événement par ligne)</label>
        <textarea value={mel} onChange={(e) => setMel(e.target.value)} rows={3} className="w-full" />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Consignes de sécurité</label>
        <textarea value={consignesSecurite} onChange={(e) => setConsignesSecurite(e.target.value)} rows={2} className="w-full" />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Évaluation (synthèse)</label>
        <textarea value={evaluation} onChange={(e) => setEvaluation(e.target.value)} rows={2} className="w-full" />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Rapport final</label>
        <p className="text-xs text-sourdine mb-1">Jugement sur le dispositif uniquement — jamais nominatif sur une personne.</p>
        <textarea value={rapportFinal} onChange={(e) => setRapportFinal(e.target.value)} rows={3} className="w-full" />
      </div>

      <label className="flex items-center gap-2 text-sm text-sourdine">
        <input type="checkbox" checked={valide} onChange={(e) => setValide(e.target.checked)} />
        Validé par le niveau supérieur
      </label>

      {valeursInitiales.id && <GestionRolesExercice exerciceId={valeursInitiales.id} />}
      {valeursInitiales.id && <GestionEvaluationsExercice exerciceId={valeursInitiales.id} />}

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

function GestionRolesExercice({ exerciceId }) {
  const { contexteId } = useAuth()
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const { lignes: rolesDisponibles } = useTableContexte('roles', contexteId, { tri: 'libelle' })
  const [roles, setRoles] = useState([])
  const [chargement, setChargement] = useState(true)
  const [contactId, setContactId] = useState('')
  const [roleId, setRoleId] = useState('')
  const [fonctionJouee, setFonctionJouee] = useState('')
  const [estEvaluateur, setEstEvaluateur] = useState(false)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('exercice_roles')
      .select('*, contacts(id, nom, prenom), roles(id, libelle)')
      .eq('exercice_id', exerciceId)
    if (error) setErreur(error.message)
    else setRoles(data ?? [])
    setChargement(false)
  }, [exerciceId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function ajouter() {
    if (!contactId || !fonctionJouee.trim()) return
    const { error } = await supabase.from('exercice_roles').insert({
      exercice_id: exerciceId,
      contact_id: contactId,
      role_id: roleId || null,
      fonction_jouee: fonctionJouee.trim(),
      est_evaluateur: estEvaluateur,
    })
    if (error) setErreur(error.message)
    else {
      setContactId('')
      setRoleId('')
      setFonctionJouee('')
      setEstEvaluateur(false)
      await rafraichir()
    }
  }

  async function retirer(id) {
    await supabase.from('exercice_roles').delete().eq('id', id)
    await rafraichir()
  }

  return (
    <div className="pt-2 border-t border-trait">
      <p className="text-xs font-medium text-sourdine mb-2">Rôles tenus durant l'exercice</p>
      {erreur && <p className="text-xs text-chaud mb-1">{erreur}</p>}
      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : (
        <>
          {roles.length > 0 && (
            <ul className="space-y-1 mb-2">
              {roles.map((r) => (
                <li key={r.id} className="jeton flex items-center justify-between bg-surface border border-trait">
                  <span>
                    {r.contacts?.prenom} {r.contacts?.nom} — {r.fonction_jouee}
                    {r.roles?.libelle && <span className="ml-1 text-sourdine">({r.roles.libelle})</span>}
                    {r.est_evaluateur && <span className="ml-1 text-sourdine">(évaluateur)</span>}
                  </span>
                  <button type="button" onClick={() => retirer(r.id)} className="text-sourdine hover:text-chaud">✕</button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 items-center">
            <select value={contactId} onChange={(e) => setContactId(e.target.value)} className="">
              <option value="">Participant…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
              ))}
            </select>
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="">
              <option value="">Rôle formel —</option>
              {rolesDisponibles.map((r) => (
                <option key={r.id} value={r.id}>{r.libelle}</option>
              ))}
            </select>
            <input
              value={fonctionJouee}
              onChange={(e) => setFonctionJouee(e.target.value)}
              placeholder="fonction jouée"
              className="flex-1 min-w-[140px]"
            />
            <label className="flex items-center gap-1 text-xs text-sourdine">
              <input type="checkbox" checked={estEvaluateur} onChange={(e) => setEstEvaluateur(e.target.checked)} />
              évaluateur
            </label>
            <BoutonDiscret type="button" onClick={ajouter} disabled={!contactId || !fonctionJouee.trim()}>Ajouter</BoutonDiscret>
          </div>
        </>
      )}
    </div>
  )
}

const NIVEAUX_ATTEINTE = [
  { valeur: 'non_atteint', libelle: 'Non atteint' },
  { valeur: 'partiellement_atteint', libelle: 'Partiellement atteint' },
  { valeur: 'atteint', libelle: 'Atteint' },
  { valeur: 'depasse', libelle: 'Dépassé' },
]

function GestionEvaluationsExercice({ exerciceId }) {
  const { contexteId } = useAuth()
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [evaluations, setEvaluations] = useState([])
  const [chargement, setChargement] = useState(true)
  const [enAjout, setEnAjout] = useState(false)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('exercice_evaluations')
      .select('*, contacts(id, nom, prenom)')
      .eq('exercice_id', exerciceId)
    if (error) setErreur(error.message)
    else setEvaluations(data ?? [])
    setChargement(false)
  }, [exerciceId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function retirer(id) {
    await supabase.from('exercice_evaluations').delete().eq('id', id)
    await rafraichir()
  }

  return (
    <div className="pt-2 border-t border-trait">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-sourdine">Évaluation par objectif (sur le dispositif, jamais nominatif)</p>
        {!enAjout && (
          <button type="button" onClick={() => setEnAjout(true)} className="text-xs text-info hover:underline">
            + ajouter
          </button>
        )}
      </div>

      {erreur && <p className="text-xs text-chaud mb-1">{erreur}</p>}

      {enAjout && (
        <FormulaireEvaluationExercice
          exerciceId={exerciceId}
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
      ) : evaluations.length === 0 ? (
        <p className="text-xs text-sourdine">Aucune évaluation pour l'instant.</p>
      ) : (
        <ul className="space-y-1">
          {evaluations.map((ev) => (
            <li key={ev.id} className="bg-surface rounded px-2.5 py-1.5 border border-trait text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-encre">
                    {ev.objectif_evalue}
                    <span className="ml-2 text-sourdine">
                      ({NIVEAUX_ATTEINTE.find((n) => n.valeur === ev.niveau_atteinte)?.libelle ?? ev.niveau_atteinte})
                    </span>
                  </p>
                  {ev.constat && <p className="text-sourdine">constat : {ev.constat}</p>}
                  {ev.recommandation && <p className="text-sourdine">recommandation : {ev.recommandation}</p>}
                  {ev.contacts && (
                    <p className="text-sourdine">évaluateur : {ev.contacts.prenom} {ev.contacts.nom}</p>
                  )}
                </div>
                <button type="button" onClick={() => retirer(ev.id)} className="text-sourdine hover:text-chaud flex-shrink-0">✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireEvaluationExercice({ exerciceId, contacts = [], onValider, onAnnuler }) {
  const [objectifEvalue, setObjectifEvalue] = useState('')
  const [niveauAtteinte, setNiveauAtteinte] = useState(NIVEAUX_ATTEINTE[2].valeur)
  const [constat, setConstat] = useState('')
  const [recommandation, setRecommandation] = useState('')
  const [evaluateurContactId, setEvaluateurContactId] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await supabase.from('exercice_evaluations').insert({
      exercice_id: exerciceId,
      objectif_evalue: objectifEvalue.trim(),
      niveau_atteinte: niveauAtteinte,
      constat: constat.trim() || null,
      recommandation: recommandation.trim() || null,
      evaluateur_contact_id: evaluateurContactId || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
    else onValider()
  }

  return (
    <form onSubmit={soumettre} className="bg-surface border border-trait rounded p-2.5 mb-2 space-y-2">
      <input
        required
        value={objectifEvalue}
        onChange={(e) => setObjectifEvalue(e.target.value)}
        placeholder="Objectif évalué"
        className="w-full"
      />
      <select value={niveauAtteinte} onChange={(e) => setNiveauAtteinte(e.target.value)} className="w-full">
        {NIVEAUX_ATTEINTE.map((n) => (
          <option key={n.valeur} value={n.valeur}>{n.libelle}</option>
        ))}
      </select>
      <textarea value={constat} onChange={(e) => setConstat(e.target.value)} placeholder="Constat" rows={2} className="w-full" />
      <textarea value={recommandation} onChange={(e) => setRecommandation(e.target.value)} placeholder="Recommandation" rows={2} className="w-full" />
      <select
        value={evaluateurContactId}
        onChange={(e) => setEvaluateurContactId(e.target.value)}
        className="w-full"
      >
        <option value="">Évaluateur — aucun</option>
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
