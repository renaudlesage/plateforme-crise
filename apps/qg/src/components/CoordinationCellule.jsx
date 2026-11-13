import { useCallback, useEffect, useMemo, useState } from 'react'
import { texteErreur } from '@plateforme-crise/shared'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { BoutonDiscret, BoutonPrincipal } from './Boutons'

/**
 * C6 — coordination de la cellule (idées reprises de SCRIBE, AGPL-3.0, et de Kalisio Crisis, MIT ; aucun code repris).
 * Consignes avec accusé de lecture, présences en cellule, capacités des centres d'accueil, processus d'intervention.
 * Chaque écriture passe par la base, qui trace l'essentiel au livre de bord de l'incident.
 */

const heure = (iso) => (iso ? new Date(iso).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' }) : '')
const dateHeure = (iso) => (iso ? new Date(iso).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' }) : '')
const MIGRATION_ABSENTE = 'Fonction indisponible : la migration C6 n’est pas encore appliquée sur cette plateforme.'

function messageErreur(error) {
  return ['PGRST202', 'PGRST205', '42P01'].includes(error?.code) ? MIGRATION_ABSENTE : texteErreur(error)
}

/** Relit toutes les `delai` ms tant que l'onglet est visible. */
function useRafraichi(charger, delai) {
  useEffect(() => {
    charger()
    const t = setInterval(() => document.visibilityState === 'visible' && charger(), delai)
    return () => clearInterval(t)
  }, [charger, delai])
}

function useMembres(contexteId) {
  const [membres, setMembres] = useState([])
  useEffect(() => {
    if (!contexteId) return
    supabase.rpc('membres_cellule', { p_contexte: contexteId }).then(({ data }) => setMembres(data ?? []))
  }, [contexteId])
  return membres
}

function EnTete({ titre, aide, children }) {
  return (
    <div className="mb-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium text-encre">{titre}</h2>
        {children}
      </div>
      {aide && <p className="text-xs text-sourdine">{aide}</p>}
    </div>
  )
}

/* ───────────── Consignes avec accusé de lecture ───────────── */

export function SectionConsignes({ incidentId, contexteId }) {
  const membres = useMembres(contexteId)
  const [roles, setRoles] = useState([])
  const [consignes, setConsignes] = useState([])
  const [lectures, setLectures] = useState([])
  const [erreur, setErreur] = useState(null)
  const [enAjout, setEnAjout] = useState(false)

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from('consignes').select('*').eq('incident_id', incidentId).order('emise_le', { ascending: false })
    if (error) {
      setErreur(messageErreur(error))
      return
    }
    setConsignes(data ?? [])
    const ids = (data ?? []).map((c) => c.id)
    if (ids.length) {
      const l = await supabase.from('consignes_destinataires').select('consigne_id, user_id, lu_le').in('consigne_id', ids)
      if (l.error) setErreur(messageErreur(l.error))
      else {
        setErreur(null)
        setLectures(l.data ?? [])
      }
    } else setErreur(null)
  }, [incidentId])
  useRafraichi(charger, 30000)

  useEffect(() => {
    supabase.from('roles').select('id, libelle').eq('contexte_id', contexteId).order('libelle').then(({ data }) => setRoles(data ?? []))
  }, [contexteId])

  const nomDe = (uid) => membres.find((m) => m.user_id === uid)?.email ?? 'membre'

  return (
    <div>
      <EnTete titre="Consignes" aide="Chaque destinataire confirme « lu » ; la cellule voit qui ne l’a pas encore lue. Émission et annulation sont tracées au livre de bord.">
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Émettre une consigne</BoutonPrincipal>}
      </EnTete>
      {erreur && <p role="alert" className="text-sm text-chaud mb-2">{erreur}</p>}
      {enAjout && (
        <FormulaireConsigne
          incidentId={incidentId}
          contexteId={contexteId}
          roles={roles}
          onFini={async (ok) => {
            setEnAjout(false)
            if (ok) await charger()
          }}
        />
      )}
      {consignes.length === 0 ? (
        !enAjout && <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4 text-center">Aucune consigne émise pour cet incident.</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {consignes.map((c) => {
            const dest = lectures.filter((l) => l.consigne_id === c.id)
            const lus = dest.filter((l) => l.lu_le)
            const nonLus = dest.filter((l) => !l.lu_le)
            return (
              <li key={c.id} className="px-4 py-2.5" style={{ opacity: c.annulee_le ? 0.55 : 1 }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-encre">
                      {c.priorite === 'urgente' && <span className="jeton text-chaud mr-1">urgente</span>}
                      {c.annulee_le && <span className="jeton mr-1">annulée</span>}
                      <strong>{c.titre}</strong>
                    </p>
                    <p className="text-sm text-encre whitespace-pre-line">{c.texte}</p>
                    <p className="text-xs text-sourdine">
                      émise le {dateHeure(c.emise_le)}
                      {c.roles_cibles?.length > 0 && <> · pour {c.roles_cibles.map((r) => roles.find((x) => x.id === r)?.libelle ?? 'rôle').join(', ')}</>}
                      {' · '}
                      <span className={nonLus.length ? 'text-chaud' : 'text-ok'}>lue par {lus.length}/{dest.length}</span>
                    </p>
                    {nonLus.length > 0 && !c.annulee_le && (
                      <details className="text-xs text-sourdine">
                        <summary className="cursor-pointer">Pas encore lue par {nonLus.length}</summary>
                        <ul className="mt-1">{nonLus.map((l) => <li key={l.user_id}>{nomDe(l.user_id)}</li>)}</ul>
                      </details>
                    )}
                  </div>
                  {!c.annulee_le && (
                    <BoutonDiscret
                      className="text-xs flex-shrink-0"
                      onClick={async () => {
                        if (!window.confirm('Annuler cette consigne ? Elle disparaît des bandeaux ; l’annulation est tracée au livre de bord.')) return
                        const { error } = await supabase.rpc('annuler_consigne', { p_consigne: c.id })
                        if (error) setErreur(messageErreur(error))
                        else charger()
                      }}
                    >
                      Annuler
                    </BoutonDiscret>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function FormulaireConsigne({ incidentId, contexteId, roles, onFini }) {
  const [titre, setTitre] = useState('')
  const [texte, setTexte] = useState('')
  const [priorite, setPriorite] = useState('normale')
  const [cibles, setCibles] = useState([])
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await supabase.rpc('emettre_consigne', {
      p_contexte: contexteId,
      p_titre: titre.trim(),
      p_texte: texte.trim(),
      p_incident: incidentId,
      p_priorite: priorite,
      p_roles: cibles.length ? cibles : null,
    })
    setEnCours(false)
    if (error) setErreur(messageErreur(error))
    else onFini(true)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-3 bg-fond space-y-2 mb-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input required maxLength={200} value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Titre (ex. Fermer la rue Haute)" aria-label="Titre" className="sm:col-span-3" />
        <select value={priorite} onChange={(e) => setPriorite(e.target.value)} aria-label="Priorité">
          <option value="normale">Normale</option>
          <option value="urgente">Urgente</option>
        </select>
      </div>
      <textarea required maxLength={4000} rows={3} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Consigne à appliquer" aria-label="Consigne" className="w-full" />
      {roles.length > 0 && (
        <fieldset>
          <legend className="text-xs font-medium text-sourdine mb-1">Destinataires : tous les membres, ou seulement ces rôles</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {roles.map((r) => (
              <label key={r.id} className="text-sm flex items-center gap-1">
                <input type="checkbox" checked={cibles.includes(r.id)} onChange={(e) => setCibles((c) => (e.target.checked ? [...c, r.id] : c.filter((x) => x !== r.id)))} />
                {r.libelle}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours || !titre.trim() || !texte.trim()}>Émettre</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={() => onFini(false)}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

/* ───────────── Présences en cellule ───────────── */

const ORGANES = [
  { valeur: 'cc', libelle: 'CC' },
  { valeur: 'pcops', libelle: 'PC-Ops' },
  { valeur: 'autre', libelle: 'Autre' },
]

export function SectionPresences({ incidentId, contexteId }) {
  const { utilisateur } = useAuth()
  const [presences, setPresences] = useState([])
  const [erreur, setErreur] = useState(null)
  const [fonction, setFonction] = useState('')
  const [organe, setOrgane] = useState('cc')
  const [autre, setAutre] = useState({ nom: '', fonction: '', organe: 'cc' })
  const [enCours, setEnCours] = useState(false)

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from('presences_cellule').select('*').eq('incident_id', incidentId).order('arrivee_le', { ascending: false })
    if (error) setErreur(messageErreur(error))
    else {
      setErreur(null)
      setPresences(data ?? [])
    }
  }, [incidentId])
  useRafraichi(charger, 60000)

  async function ecrire(fn) {
    setEnCours(true)
    const { error } = await fn()
    setEnCours(false)
    if (error) {
      setErreur(error.code === '23505' ? 'Vous êtes déjà enregistré comme présent.' : messageErreur(error))
      return false
    }
    await charger()
    return true
  }

  const presents = presences.filter((p) => !p.depart_le)
  const partis = presences.filter((p) => p.depart_le)
  const moiPresent = presents.some((p) => p.user_id === utilisateur?.id)

  return (
    <div>
      <EnTete titre={`Présences en cellule (${presents.length})`} aide="Qui est au CC ou au PC-Ops, depuis quand. Arrivées et départs sont tracés au livre de bord : utile pour les relèves et pour la reconstitution." />
      {erreur && <p role="alert" className="text-sm text-chaud mb-2">{erreur}</p>}

      {!moiPresent && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <input value={fonction} maxLength={120} onChange={(e) => setFonction(e.target.value)} placeholder="Ma fonction (ex. D5, secrétariat)" aria-label="Ma fonction" />
          <select value={organe} onChange={(e) => setOrgane(e.target.value)} aria-label="Lieu">
            {ORGANES.map((o) => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
          </select>
          <BoutonPrincipal
            disabled={enCours || !utilisateur}
            onClick={() =>
              ecrire(() =>
                supabase.from('presences_cellule').insert({
                  contexte_id: contexteId,
                  incident_id: incidentId,
                  user_id: utilisateur.id,
                  nom: utilisateur.email ?? 'Membre',
                  fonction: fonction.trim() || null,
                  organe,
                })
              )
            }
          >
            J’arrive
          </BoutonPrincipal>
        </div>
      )}

      {presents.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-3 text-center">Personne n’est enregistré comme présent.</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface mb-2">
          {presents.map((p) => (
            <li key={p.id} className="px-4 py-2 flex items-center justify-between gap-2 text-sm">
              <span>
                <strong>{p.nom}</strong>
                {p.fonction && <> · {p.fonction}</>}
                <span className="jeton ml-2">{ORGANES.find((o) => o.valeur === p.organe)?.libelle}</span>
                <span className="text-xs text-sourdine ml-2">depuis {heure(p.arrivee_le)}</span>
              </span>
              <BoutonDiscret
                className="text-xs"
                disabled={enCours}
                onClick={() => ecrire(() => supabase.from('presences_cellule').update({ depart_le: new Date().toISOString() }).eq('id', p.id))}
              >
                {p.user_id === utilisateur?.id ? 'Je pars' : 'Départ'}
              </BoutonDiscret>
            </li>
          ))}
        </ul>
      )}

      <details className="text-sm">
        <summary className="text-xs text-sourdine cursor-pointer">Enregistrer une autre personne (sans compte, renfort extérieur)</summary>
        <form
          className="flex flex-wrap gap-2 mt-2"
          onSubmit={async (e) => {
            e.preventDefault()
            const ok = await ecrire(() =>
              supabase.from('presences_cellule').insert({
                contexte_id: contexteId,
                incident_id: incidentId,
                nom: autre.nom.trim(),
                fonction: autre.fonction.trim() || null,
                organe: autre.organe,
              })
            )
            if (ok) setAutre({ nom: '', fonction: '', organe: 'cc' })
          }}
        >
          <input required maxLength={120} value={autre.nom} onChange={(e) => setAutre({ ...autre, nom: e.target.value })} placeholder="Nom" aria-label="Nom" />
          <input maxLength={120} value={autre.fonction} onChange={(e) => setAutre({ ...autre, fonction: e.target.value })} placeholder="Fonction, organisme" aria-label="Fonction" />
          <select value={autre.organe} onChange={(e) => setAutre({ ...autre, organe: e.target.value })} aria-label="Lieu">
            {ORGANES.map((o) => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
          </select>
          <BoutonPrincipal type="submit" disabled={enCours || !autre.nom.trim()}>Ajouter</BoutonPrincipal>
        </form>
      </details>

      {partis.length > 0 && (
        <details className="text-sm mt-2">
          <summary className="text-xs text-sourdine cursor-pointer">Historique des présences ({partis.length})</summary>
          <ul className="mt-1 text-xs text-sourdine">
            {partis.map((p) => (
              <li key={p.id}>
                {p.nom}{p.fonction ? ` (${p.fonction})` : ''} · {ORGANES.find((o) => o.valeur === p.organe)?.libelle} · {dateHeure(p.arrivee_le)} → {dateHeure(p.depart_le)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

/* ───────────── Capacités des centres d'accueil ───────────── */

const STYLE_NIVEAU = {
  normal: { libelle: 'normal', classe: 'text-ok' },
  tension: { libelle: 'tension', classe: 'text-veille' },
  critique: { libelle: 'critique', classe: 'text-chaud' },
}

export function SectionCapacites({ incidentId, contexteId }) {
  const [centres, setCentres] = useState([])
  const [erreur, setErreur] = useState(null)
  const [saisie, setSaisie] = useState(null) // centre_id en cours de relevé

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from('centres_accueil_occupation').select('*').eq('contexte_id', contexteId).order('nom')
    if (error) setErreur(messageErreur(error))
    else {
      setErreur(null)
      setCentres(data ?? [])
    }
  }, [contexteId])
  useRafraichi(charger, 60000)

  const ordre = { critique: 0, tension: 1, normal: 2 }
  const tries = [...centres].sort((a, b) => (ordre[a.niveau] ?? 3) - (ordre[b.niveau] ?? 3) || a.nom.localeCompare(b.nom))

  return (
    <div>
      <EnTete
        titre="Capacités des centres d’accueil"
        aide="Relevé horodaté des places ouvertes et occupées. Niveau tension ou critique selon les seuils du centre (Admin › Centres d’accueil) ; un passage à la hausse est tracé au livre de bord."
      />
      {erreur && <p role="alert" className="text-sm text-chaud mb-2">{erreur}</p>}
      {centres.length === 0 && !erreur ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-3 text-center">Aucun centre d’accueil encodé (Admin › Centres d’accueil).</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {tries.map((c) => {
            const n = STYLE_NIVEAU[c.niveau]
            const pct = c.places_ouvertes ? Math.round((c.places_occupees / c.places_ouvertes) * 100) : null
            return (
              <li key={c.centre_id} className="px-4 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>{c.nom}</strong>
                    {n ? (
                      <span className={`jeton ml-2 ${n.classe}`}>{n.libelle}</span>
                    ) : (
                      <span className="jeton ml-2 text-sourdine">pas de relevé</span>
                    )}
                    {c.releve_le && (
                      <span className="text-xs text-sourdine ml-2">
                        {c.places_occupees} / {c.places_ouvertes} places{pct !== null && ` (${pct} %)`} · relevé {dateHeure(c.releve_le)}
                      </span>
                    )}
                    {!c.releve_le && c.capacite_hebergement && <span className="text-xs text-sourdine ml-2">capacité prévue : {c.capacite_hebergement} couchages</span>}
                  </span>
                  {saisie !== c.centre_id && <BoutonDiscret className="text-xs" onClick={() => setSaisie(c.centre_id)}>Nouveau relevé</BoutonDiscret>}
                </div>
                {c.note && <p className="text-xs text-sourdine">{c.note}</p>}
                {saisie === c.centre_id && (
                  <FormulaireReleve
                    centre={c}
                    incidentId={incidentId}
                    onFini={async (ok) => {
                      setSaisie(null)
                      if (ok) await charger()
                    }}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function FormulaireReleve({ centre, incidentId, onFini }) {
  const [ouvertes, setOuvertes] = useState(centre.places_ouvertes ?? centre.capacite_hebergement ?? '')
  const [occupees, setOccupees] = useState(centre.places_occupees ?? 0)
  const [note, setNote] = useState('')
  const [erreur, setErreur] = useState(null)

  async function soumettre(e) {
    e.preventDefault()
    const { error } = await supabase.from('occupations_centres').insert({
      contexte_id: centre.contexte_id,
      centre_id: centre.centre_id,
      incident_id: incidentId,
      places_ouvertes: Number(ouvertes),
      places_occupees: Number(occupees),
      note: note.trim() || null,
    })
    if (error) setErreur(messageErreur(error))
    else onFini(true)
  }

  return (
    <form onSubmit={soumettre} className="flex flex-wrap items-end gap-2 mt-2">
      <label className="text-xs text-sourdine">
        Places ouvertes
        <input type="number" min="0" required value={ouvertes} onChange={(e) => setOuvertes(e.target.value)} className="block w-28" />
      </label>
      <label className="text-xs text-sourdine">
        Occupées
        <input type="number" min="0" required value={occupees} onChange={(e) => setOccupees(e.target.value)} className="block w-28" />
      </label>
      <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Note (facultatif)" aria-label="Note" className="flex-1 min-w-[10rem]" />
      <BoutonPrincipal type="submit" disabled={ouvertes === ''}>Enregistrer</BoutonPrincipal>
      <BoutonDiscret type="button" onClick={() => onFini(false)}>Annuler</BoutonDiscret>
      {erreur && <p role="alert" className="text-sm text-chaud w-full">{erreur}</p>}
    </form>
  )
}

/* ───────────── Processus d'intervention ───────────── */

export function SectionProcessus({ incidentId, contexteId }) {
  const membres = useMembres(contexteId)
  const [modeles, setModeles] = useState([])
  const [lances, setLances] = useState([])
  const [erreur, setErreur] = useState(null)
  const [enLancement, setEnLancement] = useState(false)

  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from('processus_lances')
      .select('*, processus_participants(*, processus_reponses(*))')
      .eq('incident_id', incidentId)
      .order('lance_le', { ascending: false })
    if (error) setErreur(messageErreur(error))
    else {
      setErreur(null)
      setLances(data ?? [])
    }
  }, [incidentId])
  useRafraichi(charger, 20000)

  useEffect(() => {
    supabase.from('processus_modeles').select('id, nom, description, etapes').eq('contexte_id', contexteId).eq('actif', true).order('nom')
      .then(({ data }) => setModeles(data ?? []))
  }, [contexteId])

  return (
    <div>
      <EnTete
        titre="Processus d’intervention"
        aide="Une suite de questions posées aux équipes (« Arrivés sur place ? », « Zone évacuée ? »). Chaque équipe répond depuis Terrain, ou le CC répond pour elle ; chaque réponse est tracée au livre de bord."
      >
        {!enLancement && modeles.length > 0 && <BoutonPrincipal onClick={() => setEnLancement(true)}>Lancer un processus</BoutonPrincipal>}
      </EnTete>
      {erreur && <p role="alert" className="text-sm text-chaud mb-2">{erreur}</p>}
      {modeles.length === 0 && !erreur && (
        <p className="text-xs text-sourdine mb-2">Aucun modèle de processus : à préparer dans Admin › Processus d’intervention.</p>
      )}
      {enLancement && (
        <FormulaireLancement
          incidentId={incidentId}
          modeles={modeles}
          membres={membres}
          onFini={async (ok) => {
            setEnLancement(false)
            if (ok) await charger()
          }}
        />
      )}
      {lances.length === 0 ? (
        !enLancement && <p className="text-sm text-sourdine border border-dashed border-trait rounded p-3 text-center">Aucun processus lancé sur cet incident.</p>
      ) : (
        <div className="space-y-3">
          {lances.map((p) => (
            <ProcessusLance key={p.id} p={p} membres={membres} onChange={charger} onErreur={setErreur} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProcessusLance({ p, membres, onChange, onErreur }) {
  const [occupe, setOccupe] = useState(false)
  const participants = [...(p.processus_participants ?? [])].sort((a, b) => a.libelle.localeCompare(b.libelle))
  const finis = participants.filter((x) => x.termine_le).length

  async function agir(fn) {
    setOccupe(true)
    const { error } = await fn()
    setOccupe(false)
    if (error) onErreur(messageErreur(error))
    else {
      onErreur(null)
      onChange()
    }
  }

  return (
    <div className="border border-trait rounded bg-surface" style={{ opacity: p.clos_le ? 0.7 : 1 }}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-trait">
        <p className="text-sm text-encre">
          <strong>{p.titre}</strong>
          <span className="text-xs text-sourdine ml-2">lancé {dateHeure(p.lance_le)} · {finis}/{participants.length} équipe(s) au bout</span>
          {p.clos_le && <span className="jeton ml-2">clos</span>}
        </p>
        {!p.clos_le && (
          <BoutonDiscret
            className="text-xs"
            disabled={occupe}
            onClick={() => window.confirm('Clore ce processus ? Les équipes ne pourront plus y répondre.') && agir(() => supabase.rpc('clore_processus', { p_processus: p.id }))}
          >
            Clore
          </BoutonDiscret>
        )}
      </div>
      <ul className="divide-y divide-trait">
        {participants.map((pa) => {
          const reponses = [...(pa.processus_reponses ?? [])].sort((a, b) => Date.parse(a.repondu_le) - Date.parse(b.repondu_le))
          const etape = p.etapes[pa.etape_courante]
          const derniere = reponses[reponses.length - 1]
          return (
            <li key={pa.id} className="px-4 py-2 text-sm">
              <p>
                <strong>{pa.libelle}</strong>
                {pa.user_id && <span className="text-xs text-sourdine ml-1">({membres.find((m) => m.user_id === pa.user_id)?.email ?? 'membre'})</span>}
                {pa.termine_le ? (
                  <span className="jeton text-ok ml-2">terminé {heure(pa.termine_le)}</span>
                ) : (
                  <span className="jeton ml-2">étape {pa.etape_courante + 1}/{p.etapes.length}</span>
                )}
                {derniere && <span className="text-xs text-sourdine ml-2">dernière réponse : {derniere.reponse} à {heure(derniere.repondu_le)}</span>}
              </p>
              {reponses.length > 0 && (
                <details className="text-xs text-sourdine">
                  <summary className="cursor-pointer">Réponses ({reponses.length})</summary>
                  <ol className="list-decimal pl-5">
                    {reponses.map((r) => (
                      <li key={r.id}>
                        {p.etapes[r.etape]?.question} → <strong>{r.reponse}</strong> ({heure(r.repondu_le)}){r.commentaire ? ` — ${r.commentaire}` : ''}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              {!pa.termine_le && !p.clos_le && etape && (
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-xs text-sourdine">{etape.question}</span>
                  {etape.reponses.map((r) => (
                    <button
                      key={r.libelle}
                      type="button"
                      className="discret text-xs"
                      disabled={occupe}
                      title="Répondre pour l’équipe (par exemple après un appel radio)"
                      onClick={() => agir(() => supabase.rpc('repondre_processus', { p_participant: pa.id, p_reponse: r.libelle }))}
                    >
                      {r.libelle}
                    </button>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function FormulaireLancement({ incidentId, modeles, membres, onFini }) {
  const [modeleId, setModeleId] = useState(modeles[0]?.id ?? '')
  const [titre, setTitre] = useState('')
  const [equipes, setEquipes] = useState([{ libelle: '', user_id: '' }])
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)
  const modele = useMemo(() => modeles.find((m) => m.id === modeleId), [modeles, modeleId])
  const valides = equipes.filter((e) => e.libelle.trim())

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await supabase.rpc('lancer_processus', {
      p_incident: incidentId,
      p_modele: modeleId,
      p_equipes: valides.map((x) => ({ libelle: x.libelle.trim(), ...(x.user_id ? { user_id: x.user_id } : {}) })),
      p_titre: titre.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(messageErreur(error))
    else onFini(true)
  }

  const maj = (i, cle, v) => setEquipes((l) => l.map((x, j) => (j === i ? { ...x, [cle]: v } : x)))

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-3 bg-fond space-y-2 mb-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select value={modeleId} onChange={(e) => setModeleId(e.target.value)} aria-label="Modèle">
          {modeles.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </select>
        <input value={titre} maxLength={160} onChange={(e) => setTitre(e.target.value)} placeholder={`Titre (par défaut : ${modele?.nom ?? 'nom du modèle'})`} aria-label="Titre" />
      </div>
      {modele && (
        <ol className="text-xs text-sourdine list-decimal pl-5">
          {modele.etapes.map((et, i) => <li key={i}>{et.question} ({et.reponses.map((r) => r.libelle + (r.fin ? ' ⏹' : '')).join(' · ')})</li>)}
        </ol>
      )}
      <p className="text-xs font-medium text-sourdine">Équipes (une équipe liée à un compte répond depuis Terrain ; sinon, le CC répond pour elle)</p>
      {equipes.map((x, i) => (
        <div key={i} className="flex flex-wrap gap-2">
          <input value={x.libelle} maxLength={120} onChange={(e) => maj(i, 'libelle', e.target.value)} placeholder="ex. Équipe D4 secteur nord" aria-label="Équipe" className="flex-1 min-w-[10rem]" />
          <select value={x.user_id} onChange={(e) => maj(i, 'user_id', e.target.value)} aria-label="Compte qui répond">
            <option value="">sans compte (le CC répond)</option>
            {membres.map((m) => <option key={m.user_id} value={m.user_id}>{m.email}{m.role_libelle ? ` — ${m.role_libelle}` : ''}</option>)}
          </select>
          {equipes.length > 1 && <BoutonDiscret type="button" aria-label="Retirer l’équipe" onClick={() => setEquipes((l) => l.filter((_, j) => j !== i))}>✕</BoutonDiscret>}
        </div>
      ))}
      <BoutonDiscret type="button" onClick={() => setEquipes((l) => [...l, { libelle: '', user_id: '' }])}>+ Équipe</BoutonDiscret>
      {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours || !modeleId || valides.length === 0}>Lancer</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={() => onFini(false)}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
