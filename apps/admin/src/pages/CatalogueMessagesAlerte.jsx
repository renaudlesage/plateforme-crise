import { useEffect, useMemo, useState } from 'react'
import { texteErreur } from '@plateforme-crise/shared'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export const PHASES = [
  { valeur: 'prevision', libelle: 'Prévision' },
  { valeur: 'preparation', libelle: 'Préparation' },
  { valeur: 'actuation', libelle: 'Pendant la crise' },
  { valeur: 'recuperation', libelle: 'Récupération' },
]

export const STATUTS_VALIDATION = [
  { valeur: 'a_valider', libelle: 'À valider' },
  { valeur: 'en_revue', libelle: 'En revue' },
  { valeur: 'valide', libelle: 'Validé' },
  { valeur: 'rejete', libelle: 'Rejeté' },
]

const sansAccent = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Catalogue national de messages d'alerte inondation (adaptation belge du
 * catalogue Vega Baja, méthode Covello). Référentiel de la plateforme :
 * lisible par tous, modifiable par le super-admin uniquement. Tant qu'un
 * message n'est pas « Validé » par un expert belge, il ne doit pas servir
 * à un usage opérationnel. Modifier le texte d'un message déjà validé le
 * remet « À valider » (garde en base).
 */
export default function CatalogueMessagesAlerte() {
  const { estSuperAdmin, superAdminVerifie, utilisateur } = useAuth()
  const [messages, setMessages] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [phase, setPhase] = useState('')
  const [statut, setStatut] = useState('')
  const [aCompleter, setACompleter] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [ouvert, setOuvert] = useState(null)

  async function charger() {
    const { data, error } = await supabase
      .from('catalogue_messages_alerte')
      .select('*')
      .order('numero_message_source')
    if (error) setErreur(error.message)
    setMessages(data ?? [])
    setChargement(false)
  }
  useEffect(() => {
    charger()
  }, [])

  const filtres = useMemo(() => {
    const q = sansAccent(recherche).trim()
    return messages.filter((m) => {
      if (phase && m.phase_cycle !== phase) return false
      if (statut && m.statut_validation !== statut) return false
      if (aCompleter && !m.necessite_completion) return false
      if (!q) return true
      const texte = sansAccent([m.message_cle, ...(m.sous_messages ?? []), ...(m.mots_cles ?? []), m.zone_thematique, m.section].join(' '))
      return texte.includes(q)
    })
  }, [messages, phase, statut, aCompleter, recherche])

  const groupes = useMemo(() => {
    const g = []
    for (const m of filtres) {
      const cle = `${m.phase_cycle}|${m.section}`
      let groupe = g.find((x) => x.cle === cle)
      if (!groupe) {
        groupe = { cle, phase: m.phase_cycle, section: m.section, messages: [] }
        g.push(groupe)
      }
      groupe.messages.push(m)
    }
    return g
  }, [filtres])

  const compte = useMemo(() => {
    const c = { a_valider: 0, en_revue: 0, valide: 0, rejete: 0 }
    for (const m of messages) c[m.statut_validation] = (c[m.statut_validation] ?? 0) + 1
    return c
  }, [messages])

  // La base ne signale pas un refus de droits sur une modification : elle ne modifie simplement aucune ligne.
  // On demande donc les lignes modifiées et on dit clairement quand il n'y en a aucune.
  async function modifier(m, champs) {
    setErreur(null)
    const { data, error } = await supabase
      .from('catalogue_messages_alerte')
      .update({ ...champs, updated_at: new Date().toISOString() })
      .eq('id', m.id)
      .select('id')
    if (error) {
      setErreur(texteErreur(error))
      return false
    }
    if (!data || data.length === 0) {
      setErreur("Modification refusée : seul le super-admin (administrateur de la plateforme) peut modifier ou valider le catalogue. Reconnectez-vous avec ce compte.")
      return false
    }
    await charger()
    return true
  }

  async function changerStatut(m, nouveau, notes) {
    const valide = nouveau === 'valide'
    if (valide && m.necessite_completion && !confirm('Ce message est marqué « à relire » (texte reconstitué). Le valider confirme que vous l\'avez relu. Continuer ?')) return
    const { data: u } = await supabase.auth.getUser()
    await modifier(m, {
      statut_validation: nouveau,
      notes_validation: notes ?? m.notes_validation,
      valide_par: valide ? u?.user?.id ?? null : null,
      valide_le: valide ? new Date().toISOString() : null,
      ...(valide && m.necessite_completion ? { necessite_completion: false } : {}),
    })
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-encre mb-1">Catalogue de messages d'alerte — inondation</h1>
      <p className="text-sm text-sourdine mb-2">
        Messages à la population par phase de crise (titre + consignes), traduits et adaptés au contexte belge à partir
        du catalogue Vega Baja (CCE-GVA / Université d'Alicante). Les éléments entre crochets […] sont à compléter par
        l'opérateur au moment de l'envoi. Ces messages sont utilisables depuis le Comité de Coordination (Messages à la population).
      </p>
      <p className="text-sm text-chaud mb-4">
        Adaptation non encore validée par des experts belges (zone de secours, centre de crise) : {compte.valide} message(s) validé(s) sur {messages.length}.
        À ne pas utiliser en situation réelle avant validation.
      </p>
      {superAdminVerifie && !estSuperAdmin && (
        <p role="note" className="text-sm text-encre border border-trait rounded px-3 py-2 mb-4 bg-surface">
          Lecture seule. Modifier ou valider un message est réservé au super-admin (compte administrateur de la plateforme).
          Vous êtes connecté en tant que <strong>{utilisateur?.email}</strong>.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-3">
        <button type="button" onClick={() => setPhase('')} className={`pastille-filtre${phase === '' ? ' actif' : ''}`}>Toutes les phases</button>
        {PHASES.map((p) => (
          <button key={p.valeur} type="button" onClick={() => setPhase(p.valeur)} className={`pastille-filtre${phase === p.valeur ? ' actif' : ''}`}>
            {p.libelle}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher (titre, consigne, mot-clé…)"
          className="border border-trait rounded px-2 py-1 text-sm bg-surface min-w-[16rem]"
        />
        <select value={statut} onChange={(e) => setStatut(e.target.value)} className="border border-trait rounded px-2 py-1 text-sm bg-surface">
          <option value="">Tous les statuts</option>
          {STATUTS_VALIDATION.map((s) => (
            <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-sourdine">
          <input type="checkbox" checked={aCompleter} onChange={(e) => setACompleter(e.target.checked)} />
          Reconstitués à relire
        </label>
        <span className="text-xs text-sourdine">{filtres.length} message(s)</span>
      </div>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}
      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : groupes.length === 0 ? (
        <p className="vide">Aucun message ne correspond.</p>
      ) : (
        groupes.map((g) => (
          <section key={g.cle} className="mb-5">
            <h2 className="text-sm font-semibold text-encre mb-1.5">
              {PHASES.find((p) => p.valeur === g.phase)?.libelle} · {g.section}
            </h2>
            <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
              {g.messages.map((m) => (
                <LigneMessage
                  key={m.id}
                  m={m}
                  ouvert={ouvert === m.id}
                  onBascule={() => setOuvert(ouvert === m.id ? null : m.id)}
                  peutValider={estSuperAdmin}
                  onStatut={changerStatut}
                  onModifier={modifier}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

export function JetonValidation({ statut }) {
  const s = STATUTS_VALIDATION.find((x) => x.valeur === statut)
  const classe = statut === 'valide' ? 'text-ok' : statut === 'rejete' ? 'text-chaud' : 'text-sourdine'
  return <span className={`jeton ${classe}`}>{s?.libelle ?? statut}</span>
}

const CHAMPS_TEXTE = ['message_cle', 'titre', 'sous_messages', 'zone_thematique', 'mots_cles', 'info_complementaire', 'necessite_completion']

const lignes = (t) => t.split('\n').map((x) => x.trim()).filter(Boolean)
const virgules = (t) => t.split(',').map((x) => x.trim()).filter(Boolean)
const memeListe = (a, b) => JSON.stringify(a ?? []) === JSON.stringify(b ?? [])

/** Différences entre le formulaire et le message en base : on n'envoie que ce qui a réellement changé. */
export function champsModifies(m, f) {
  const message = f.message.trim()
  const cible = {
    message_cle: message,
    titre: message,
    zone_thematique: f.zone_thematique.trim(),
    sous_messages: lignes(f.consignes),
    mots_cles: virgules(f.mots_cles),
    info_complementaire: f.info_complementaire.trim() || null,
    necessite_completion: f.a_relire,
  }
  const diff = {}
  for (const k of CHAMPS_TEXTE) {
    if (!(k in cible)) continue
    const avant = m[k]
    const apres = cible[k]
    const egal = Array.isArray(apres) ? memeListe(avant, apres) : (avant ?? null) === (apres ?? null)
    if (!egal) diff[k] = apres
  }
  return diff
}

function FormulaireMessage({ m, onEnregistrer, onAnnuler }) {
  const [f, setF] = useState({
    message: m.message_cle ?? '',
    consignes: (m.sous_messages ?? []).join('\n'),
    zone_thematique: m.zone_thematique ?? '',
    mots_cles: (m.mots_cles ?? []).join(', '),
    info_complementaire: m.info_complementaire ?? '',
    a_relire: !!m.necessite_completion,
  })
  const [enCours, setEnCours] = useState(false)
  const [erreurLocale, setErreurLocale] = useState(null)
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const diff = champsModifies(m, f)
  const texteChange = Object.keys(diff).some((k) => k !== 'necessite_completion')
  const rev = texteChange && m.statut_validation === 'valide'

  async function enregistrer(e) {
    e.preventDefault()
    if (!f.message.trim()) return setErreurLocale('Le message ne peut pas être vide.')
    if (!f.zone_thematique.trim()) return setErreurLocale('La zone thématique est obligatoire.')
    if (Object.keys(diff).length === 0) return onAnnuler()
    setErreurLocale(null)
    setEnCours(true)
    const ok = await onEnregistrer(m, diff)
    setEnCours(false)
    if (ok) onAnnuler()
  }

  const champ = 'w-full border border-trait rounded px-2 py-1 text-sm bg-surface'
  return (
    <form onSubmit={enregistrer} className="border-t border-trait pt-2 space-y-2" aria-label={`Modifier le message ${m.numero_message_source}`}>
      <label className="block text-xs text-sourdine">
        Message (titre)
        <textarea value={f.message} onChange={maj('message')} rows={2} className={champ} />
      </label>
      <label className="block text-xs text-sourdine">
        Consignes (une par ligne)
        <textarea value={f.consignes} onChange={maj('consignes')} rows={Math.max(4, f.consignes.split('\n').length + 1)} className={champ} />
      </label>
      <label className="block text-xs text-sourdine">
        Zone thématique
        <input value={f.zone_thematique} onChange={maj('zone_thematique')} className={champ} />
      </label>
      <label className="block text-xs text-sourdine">
        Mots-clés (séparés par des virgules)
        <input value={f.mots_cles} onChange={maj('mots_cles')} className={champ} />
      </label>
      <label className="block text-xs text-sourdine">
        Information complémentaire
        <textarea value={f.info_complementaire} onChange={maj('info_complementaire')} rows={2} className={champ} />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-sourdine">
        <input type="checkbox" checked={f.a_relire} onChange={maj('a_relire')} />
        À relire (texte reconstitué ou incertain)
      </label>
      {rev && (
        <p className="text-xs text-chaud">Ce message est validé : le modifier le remettra « À valider » pour qu'un expert le relise.</p>
      )}
      {erreurLocale && <p className="text-xs text-chaud">{erreurLocale}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="principal" disabled={enCours || Object.keys(diff).length === 0}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" className="discret" onClick={onAnnuler} disabled={enCours}>Annuler</button>
      </div>
    </form>
  )
}

function dateHeure(iso) {
  return new Date(iso).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' })
}

function LigneMessage({ m, ouvert, onBascule, peutValider, onStatut, onModifier }) {
  const [notes, setNotes] = useState(m.notes_validation ?? '')
  const [edition, setEdition] = useState(false)
  // Les notes suivent la base (rechargement après enregistrement, révision automatique après modification du texte).
  useEffect(() => {
    setNotes(m.notes_validation ?? '')
  }, [m.notes_validation])
  return (
    <li className="bg-surface px-4 py-2.5">
      <button type="button" onClick={onBascule} className="ligne-depliable" aria-expanded={ouvert}>
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm text-encre">
            <span className="text-xs text-sourdine mr-2">#{m.numero_message_source}</span>
            {m.message_cle}
          </span>
          <span className="flex gap-1.5 shrink-0">
            {m.necessite_completion && <span className="jeton text-chaud">À relire</span>}
            <JetonValidation statut={m.statut_validation} />
          </span>
        </div>
        <div className="text-xs text-sourdine mt-0.5">{m.zone_thematique}</div>
      </button>
      {ouvert && (
        <div className="mt-2 text-sm text-encre space-y-2">
          {!edition && (
            <>
              <ul className="list-disc pl-5 space-y-0.5">
                {(m.sous_messages ?? []).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
              {m.mots_cles?.length > 0 && <p className="text-xs text-sourdine">Mots-clés : {m.mots_cles.join(', ')}</p>}
              {m.info_complementaire && <p className="text-xs text-sourdine">{m.info_complementaire}</p>}
              <p className="text-xs text-sourdine">Source : {m.source_reference}</p>
              {m.statut_validation === 'valide' && m.valide_le && (
                <p className="text-xs text-sourdine">Validé le {dateHeure(m.valide_le)}</p>
              )}
            </>
          )}
          {peutValider ? (
            edition ? (
              <FormulaireMessage m={m} onEnregistrer={onModifier} onAnnuler={() => setEdition(false)} />
            ) : (
              <div className="border-t border-trait pt-2 space-y-2">
                <div>
                  <button type="button" className="discret" onClick={() => setEdition(true)}>Modifier le texte</button>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  aria-label="Notes de validation"
                  placeholder="Notes de validation (expert, date, remarques)"
                  className="w-full border border-trait rounded px-2 py-1 text-sm bg-surface"
                />
                <div className="flex flex-wrap gap-2">
                  {STATUTS_VALIDATION.map((s) => (
                    <button
                      key={s.valeur}
                      type="button"
                      className={s.valeur === m.statut_validation ? 'principal' : 'discret'}
                      aria-pressed={s.valeur === m.statut_validation}
                      onClick={() => onStatut(m, s.valeur, notes)}
                    >
                      {s.libelle}
                    </button>
                  ))}
                </div>
              </div>
            )
          ) : (
            m.notes_validation && <p className="text-xs text-sourdine">Validation : {m.notes_validation}</p>
          )}
        </div>
      )}
    </li>
  )
}
