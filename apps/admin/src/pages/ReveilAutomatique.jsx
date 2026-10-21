import { useCallback, useEffect, useState } from 'react'
import {
  DELAI_ESCALADE_DEFAUT_MIN,
  LIBELLE_NIVEAU,
  NIVEAUX_AVERTISSEMENT,
  ROLES_A_REVEILLER_DEFAUT,
  SOURCES_REGLE,
  TYPES_AVERTISSEMENT,
  apercuDestinataires,
  erreurParametres,
  erreurRegle,
  groupesSeuils,
  minutesDepuisIntervalle,
  resumeRegle,
  texteErreur,
} from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

/**
 * Réveil automatique (chantier C1) : règles « avertissement officiel → seuil d'action à armer », rôles réveillés et
 * délai d'escalade. Tout se décide en base (reveil_traiter_alerte à chaque avertissement, reveil_escalader chaque
 * minute) ; cette page ne fait que régler. Les réveils se suivent dans le CC, onglet Avertissements.
 */
export default function ReveilAutomatique() {
  const { contexteId } = useAuth()
  const regles = useTableContexte('regles_reveil', contexteId, {
    colonnes: '*, seuils_action(libelle, ordre, actif, risques_territoire(statut))',
    tri: 'cree_le',
  })
  const { lignes: seuils, chargement: chargementSeuils } = useTableContexte('seuils_action', contexteId, {
    colonnes: 'id, libelle, ordre, actif, risques_territoire(titre), objets_a_risque(identification)',
    tri: 'ordre',
  })
  const [enAjout, setEnAjout] = useState(false)
  const [enEdition, setEnEdition] = useState(null)
  const [message, setMessage] = useState(null)

  const groupes = groupesSeuils(seuils)
  const triees = [...regles.lignes].sort(
    (a, b) => Number(b.actif) - Number(a.actif) || (a.seuils_action?.ordre ?? 0) - (b.seuils_action?.ordre ?? 0) || a.type_alerte.localeCompare(b.type_alerte),
  )

  async function supprimerRegle(r) {
    if (!confirm(`Supprimer la règle « ${resumeRegle(r, r.seuils_action?.libelle)} » ?`)) return
    setMessage(null)
    // Sans droit de suppression, la base ne supprime rien et ne dit rien : on le vérifie au retour.
    const { data, error } = await supabase.from('regles_reveil').delete().eq('id', r.id).select('id')
    if (error) setMessage(texteErreur(error))
    else if (!data?.length) setMessage("Suppression réservée à l'admin de la commune : désactivez la règle à la place.")
    await regles.rafraichir()
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="text-xl font-semibold text-encre">Réveil automatique</h1>
        {!enAjout && seuils.length > 0 && <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter une règle</BoutonPrincipal>}
      </div>
      <p className="text-sm text-sourdine mb-2" style={{ maxWidth: '80ch' }}>
        Quand un avertissement officiel remplit une règle (flux MeteoAlarm de l'IRM, ou avertissement encodé dans le CC), le seuil d'action est armé, un
        événement en veille s'ouvre ou se complète, et les rôles choisis plus bas sont prévenus. Sans « Vu, je prends » après le délai d'escalade, leurs
        suppléants de l'annuaire sont prévenus par e-mail. Les réveils se suivent dans le CC, onglet Avertissements.
      </p>
      <p className="text-sm text-encre border border-trait rounded px-3 py-2 mb-4 bg-surface" style={{ maxWidth: '80ch' }}>
        Pour l'instant, les notifications et e-mails sont mis en file sans partir : l'envoi n'est pas encore branché. Le bandeau rouge du CC et l'onglet
        Avertissements fonctionnent déjà, de même que l'ouverture de l'événement en veille et le journal.
      </p>

      <h2 className="text-base font-semibold text-encre mb-1">Règles</h2>
      <p className="text-xs text-sourdine mb-3" style={{ maxWidth: '80ch' }}>
        Une règle arme un seuil d'action à partir d'un phénomène et d'un niveau. Quand plusieurs règles d'une même fiche sont remplies, seul le seuil le plus
        élevé est armé ; un événement ouvert n'est réveillé à nouveau que si le niveau monte. Pour essayer une règle sans attendre la météo, le super-admin
        encode une démonstration dans le CC (marquée EXERCICE).
      </p>

      {regles.erreur && <p className="text-sm text-chaud mb-2">{regles.erreur}</p>}
      {message && <p role="alert" className="text-sm text-chaud mb-2">{message}</p>}

      {!chargementSeuils && seuils.length === 0 && (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4 mb-4">
          Aucun seuil d'action : une règle arme un seuil, créez-en d'abord dans Anticipation → Seuils d'action.
        </p>
      )}

      {enAjout && (
        <div className="bg-fond rounded p-3 border border-trait mb-3">
          <FormulaireRegle
            groupes={groupes}
            onAnnuler={() => setEnAjout(false)}
            onValider={async (valeurs) => {
              const { error } = await regles.creer(valeurs)
              if (!error) setEnAjout(false)
              return { error }
            }}
          />
        </div>
      )}

      {regles.chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : triees.length === 0 && !enAjout ? (
        seuils.length > 0 && (
          <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center mb-6">
            Aucune règle : aucun avertissement ne réveillera la cellule.
          </p>
        )
      ) : (
        <ul className="space-y-2 mb-8">
          {triees.map((r) =>
            enEdition === r.id ? (
              <li key={r.id} className="bg-fond rounded p-3 border border-trait">
                <FormulaireRegle
                  groupes={groupes}
                  valeursInitiales={r}
                  onAnnuler={() => setEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await regles.modifier(r.id, valeurs)
                    if (!error) setEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={r.id} className="bg-surface border border-trait rounded p-4 shadow">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-encre">
                      {resumeRegle(r, r.seuils_action?.libelle)}
                      {!r.actif && <span className="ml-2 text-xs text-sourdine">(inactive)</span>}
                    </p>
                    {r.actif && r.seuils_action?.actif === false && <p className="text-xs text-chaud mt-1">Seuil inactif : la règle est ignorée.</p>}
                    {r.actif && r.seuils_action?.risques_territoire?.statut === 'ecarte' && (
                      <p className="text-xs text-chaud mt-1">Fiche de risque écartée : la règle est ignorée.</p>
                    )}
                    {r.note && <p className="text-xs text-sourdine mt-1">{r.note}</p>}
                    {r.origine === 'import_fiche' && <p className="text-xs text-sourdine mt-0.5">Proposée à l'import de la fiche</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <BoutonDiscret onClick={() => setEnEdition(r.id)}>Modifier</BoutonDiscret>
                    <BoutonDiscret onClick={() => supprimerRegle(r)}>Supprimer</BoutonDiscret>
                  </div>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      <Parametres contexteId={contexteId} />
    </div>
  )
}

function Champ({ id, libelle, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-sourdine mb-1">
        {libelle}
      </label>
      {children}
    </div>
  )
}

function FormulaireRegle({ groupes, valeursInitiales = {}, onValider, onAnnuler }) {
  const [v, setV] = useState({
    seuil_action_id: valeursInitiales.seuil_action_id ?? '',
    type_alerte: valeursInitiales.type_alerte ?? '',
    niveau_min: valeursInitiales.niveau_min ?? 'orange',
    source: valeursInitiales.source ?? 'toutes',
    heure_debut: valeursInitiales.heure_debut?.slice(0, 5) ?? '',
    heure_fin: valeursInitiales.heure_fin?.slice(0, 5) ?? '',
    actif: valeursInitiales.actif ?? true,
    note: valeursInitiales.note ?? '',
  })
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)
  const maj = (champ) => (e) => setV((x) => ({ ...x, [champ]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function soumettre(e) {
    e.preventDefault()
    const probleme = erreurRegle(v)
    if (probleme) {
      setErreur(probleme)
      return
    }
    setEnCours(true)
    setErreur(null)
    const { error } = await onValider({
      seuil_action_id: v.seuil_action_id,
      type_alerte: v.type_alerte,
      niveau_min: v.niveau_min,
      source: v.source,
      heure_debut: v.heure_debut || null,
      heure_fin: v.heure_fin || null,
      actif: v.actif,
      note: v.note.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.code === '23505' ? 'Cette règle existe déjà pour ce seuil (même phénomène, niveau et source).' : texteErreur(error))
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <Champ id="regle-seuil" libelle="Seuil d'action à armer">
        <select id="regle-seuil" value={v.seuil_action_id} onChange={maj('seuil_action_id')} className="w-full" required>
          <option value="">—</option>
          {groupes.map((g) => (
            <optgroup key={g.fiche} label={g.fiche}>
              {g.seuils.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.libelle}
                  {s.actif ? '' : ' (inactif)'}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Champ>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Champ id="regle-type" libelle="Phénomène">
          <select id="regle-type" value={v.type_alerte} onChange={maj('type_alerte')} className="w-full" required>
            <option value="">—</option>
            {TYPES_AVERTISSEMENT.map((t) => (
              <option key={t.cle} value={t.cle}>{t.libelle}</option>
            ))}
          </select>
        </Champ>
        <Champ id="regle-niveau" libelle="À partir du niveau">
          <select id="regle-niveau" value={v.niveau_min} onChange={maj('niveau_min')} className="w-full">
            {NIVEAUX_AVERTISSEMENT.map((n) => (
              <option key={n} value={n}>{LIBELLE_NIVEAU[n]}</option>
            ))}
          </select>
        </Champ>
        <Champ id="regle-source" libelle="Source">
          <select id="regle-source" value={v.source} onChange={maj('source')} className="w-full">
            {SOURCES_REGLE.map((s) => (
              <option key={s.cle} value={s.cle}>{s.libelle}</option>
            ))}
          </select>
        </Champ>
      </div>

      <fieldset className="border border-trait rounded p-3">
        <legend className="text-xs font-medium text-sourdine px-1">Fenêtre horaire (facultatif)</legend>
        <div className="grid grid-cols-2 gap-3">
          <Champ id="regle-debut" libelle="De">
            <input id="regle-debut" type="time" value={v.heure_debut} onChange={maj('heure_debut')} className="w-full" />
          </Champ>
          <Champ id="regle-fin" libelle="À">
            <input id="regle-fin" type="time" value={v.heure_fin} onChange={maj('heure_fin')} className="w-full" />
          </Champ>
        </div>
        <p className="text-xs text-sourdine mt-2" style={{ marginBottom: 0 }}>
          Heure de Belgique à la réception de l'avertissement. Hors fenêtre, la règle ne réveille pas ; une fenêtre peut passer minuit (22:00 à 06:00).
        </p>
      </fieldset>

      <Champ id="regle-note" libelle="Note (facultatif)">
        <input id="regle-note" value={v.note} onChange={maj('note')} maxLength={500} className="w-full" placeholder="ex. Convenu avec le PLANU le 12/10" />
      </Champ>

      <label className="flex items-center gap-2 text-sm text-sourdine">
        <input type="checkbox" checked={v.actif} onChange={maj('actif')} />
        Active
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

/** Rôles réveillés et délai d'escalade (table parametres_reveil ; valeurs par défaut du serveur tant que rien n'est enregistré). */
function Parametres({ contexteId }) {
  const { lignes: roles } = useTableContexte('roles', contexteId, { colonnes: 'id, code, libelle', tri: 'libelle' })
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { colonnes: 'id, nom, prenom, email, actif, role_id, est_suppleant_de' })
  const [enregistres, setEnregistres] = useState(undefined) // undefined = chargement, null = valeurs par défaut
  const [codes, setCodes] = useState(ROLES_A_REVEILLER_DEFAUT)
  const [delai, setDelai] = useState(String(DELAI_ESCALADE_DEFAUT_MIN))
  const [membres, setMembres] = useState([])
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState(null) // { type, texte }

  const charger = useCallback(async () => {
    if (!contexteId) return
    const { data, error } = await supabase.from('parametres_reveil').select('roles_a_reveiller, delai_escalade, maj_le').eq('contexte_id', contexteId).maybeSingle()
    if (error) setMessage({ type: 'erreur', texte: texteErreur(error) })
    setEnregistres(data ?? null)
    setCodes(data?.roles_a_reveiller ?? ROLES_A_REVEILLER_DEFAUT)
    setDelai(String(minutesDepuisIntervalle(data?.delai_escalade) ?? DELAI_ESCALADE_DEFAUT_MIN))
  }, [contexteId])

  useEffect(() => {
    charger()
  }, [charger])

  // Comptes de la commune : la liste n'est servie qu'à l'admin de la commune (vide sinon).
  useEffect(() => {
    if (!contexteId) return
    supabase.rpc('membres_contexte', { p_contexte_id: contexteId }).then(({ data }) => setMembres(data ?? []))
  }, [contexteId])

  const apercu = apercuDestinataires({ codes, roles, membres, contacts })
  const basculer = (code) => setCodes((c) => (c.includes(code) ? c.filter((x) => x !== code) : [...c, code]))

  async function enregistrer(e) {
    e.preventDefault()
    const probleme = erreurParametres({ roles: codes, delaiMinutes: delai })
    if (probleme) {
      setMessage({ type: 'erreur', texte: probleme })
      return
    }
    setEnCours(true)
    setMessage(null)
    const { error } = await supabase
      .from('parametres_reveil')
      .upsert({ contexte_id: contexteId, roles_a_reveiller: codes, delai_escalade: `${Number(delai)} minutes` }, { onConflict: 'contexte_id' })
    setEnCours(false)
    if (error) {
      setMessage({ type: 'erreur', texte: texteErreur(error) })
      return
    }
    setMessage({ type: 'ok', texte: 'Paramètres enregistrés.' })
    await charger()
  }

  if (enregistres === undefined) return <p className="text-sm text-sourdine">Chargement…</p>

  return (
    <form onSubmit={enregistrer} className="space-y-3">
      <h2 className="text-base font-semibold text-encre mb-1">Qui réveiller</h2>
      <p className="text-xs text-sourdine" style={{ maxWidth: '80ch' }}>
        {enregistres
          ? 'Les comptes de la commune qui portent ces rôles sont prévenus à chaque réveil.'
          : 'Valeurs par défaut du serveur, pas encore enregistrées pour la commune : PLANU et autorité communale, escalade après 15 minutes.'}
      </p>

      <fieldset className="border border-trait rounded p-3">
        <legend className="text-xs font-medium text-sourdine px-1">Rôles réveillés</legend>
        {roles.length === 0 ? (
          <p className="text-sm text-sourdine" style={{ margin: 0 }}>Aucun rôle dans la commune : voir Configuration → Rôles.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {roles.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm text-encre">
                <input type="checkbox" checked={codes.includes(r.code)} onChange={() => basculer(r.code)} />
                {r.libelle} <span className="text-xs text-sourdine font-mono">{r.code}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div style={{ maxWidth: 260 }}>
        <Champ id="reveil-delai" libelle="Escalade aux suppléants après (minutes)">
          <input id="reveil-delai" type="number" min="1" max="1440" step="1" value={delai} onChange={(e) => setDelai(e.target.value)} className="w-full" />
        </Champ>
      </div>

      <div className="text-sm border border-trait rounded p-3 bg-surface space-y-1">
        {apercu.codesInconnus.length > 0 && (
          <p className="text-chaud" style={{ margin: 0 }}>
            Rôle{apercu.codesInconnus.length > 1 ? 's' : ''} absent{apercu.codesInconnus.length > 1 ? 's' : ''} de la commune : {apercu.codesInconnus.join(', ')}.
            Décochez-le{apercu.codesInconnus.length > 1 ? 's' : ''} ou créez-le{apercu.codesInconnus.length > 1 ? 's' : ''} dans Configuration.
          </p>
        )}
        {membres.length > 0 ? (
          <>
            <p className="text-encre" style={{ margin: 0 }}>
              Comptes réveillés : {apercu.comptes.length ? apercu.comptes.map((m) => m.email).join(', ') : 'aucun'}.
            </p>
            {apercu.rolesSansCompte.map((r) => (
              <p key={r.id} className="text-chaud" style={{ margin: 0 }}>
                Aucun compte n'a le rôle « {r.libelle} » : personne ne sera réveillé à ce titre.
              </p>
            ))}
          </>
        ) : (
          <p className="text-sourdine" style={{ margin: 0 }}>La liste des comptes réveillés n'est visible que de l'admin de la commune.</p>
        )}
        {apercu.suppleants.length > 0 ? (
          <p className="text-encre" style={{ margin: 0 }}>
            Escalade : {apercu.suppleants.length} suppléant{apercu.suppleants.length > 1 ? 's' : ''} de l'annuaire prévenu{apercu.suppleants.length > 1 ? 's' : ''} par
            e-mail ({apercu.suppleants.map((c) => [c.prenom, c.nom].filter(Boolean).join(' ') || 'sans nom').join(', ')}).
            {apercu.suppleantsSansEmail.length > 0 && <span className="text-chaud"> Sans adresse e-mail : {apercu.suppleantsSansEmail.map((c) => [c.prenom, c.nom].filter(Boolean).join(' ') || 'sans nom').join(', ')}.</span>}
          </p>
        ) : (
          <p className="text-chaud" style={{ margin: 0 }}>
            Aucun suppléant désigné pour ces rôles : l'escalade n'aura personne à prévenir. Désignez-les dans Référentiels → Annuaire (champ « Suppléant de »).
          </p>
        )}
      </div>

      {message && (
        <p role={message.type === 'erreur' ? 'alert' : 'status'} className={`text-sm ${message.type === 'erreur' ? 'text-chaud' : 'text-encre'}`}>
          {message.texte}
        </p>
      )}
      <BoutonPrincipal type="submit" disabled={enCours}>
        {enCours ? 'Enregistrement…' : 'Enregistrer les paramètres'}
      </BoutonPrincipal>
    </form>
  )
}
