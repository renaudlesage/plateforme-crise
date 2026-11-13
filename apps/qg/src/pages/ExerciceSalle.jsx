import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { texteErreur } from '@plateforme-crise/shared'
import { supabase } from '../lib/supabase'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { LIBELLE_CANAL, LIBELLE_DISCIPLINE, heureLocale, libelleTScenario, minutesScenario } from '../lib/exercices'

const RAFRAICHISSEMENT_MS = 15000

/**
 * Salle de jeu d'un exercice, côté joueurs (idée reprise de Mur@il ; aucun code repris).
 * Ce que la base renvoie (exercice_salle) : les seuls stimuli déjà lancés, sans note d'animateur ni livrable.
 *   - Messagerie : chaque joueur choisit son rôle et voit les messages qui lui sont adressés ; il les marque « traité ».
 *   - Fil social : publications simulées (médias, citoyens, rumeurs). Rien n'en sort : c'est un décor d'exercice.
 *   - Décompte : le dernier compte à rebours lancé par l'animation.
 * Rafraîchi toutes les 15 secondes ; en cas de coupure, la dernière version reste affichée.
 */
export default function ExerciceSalle() {
  const { id } = useParams()
  const [salle, setSalle] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [maj, setMaj] = useState(null)
  const [role, setRole] = useState(() => lireRole(id))
  const [onglet, setOnglet] = useState('messages')
  const [hashtag, setHashtag] = useState(null)
  const [occupe, setOccupe] = useState(null)
  const [maintenant, setMaintenant] = useState(Date.now())

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc('exercice_salle', { p_exercice: id })
    if (error) {
      setErreur(error.code === 'PGRST202' ? 'La salle de jeu n’est pas encore installée sur cette plateforme (migration C5 à appliquer).' : texteErreur(error))
      return
    }
    setErreur(null)
    setSalle(data)
    setMaj(Date.now())
  }, [id])

  useEffect(() => {
    charger()
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') charger()
    }, RAFRAICHISSEMENT_MS)
    const auRetour = () => document.visibilityState === 'visible' && charger()
    document.addEventListener('visibilitychange', auRetour)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', auRetour)
    }
  }, [charger])

  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  function choisirRole(r) {
    setRole(r)
    try {
      localStorage.setItem(`salle-role-${id}`, r)
    } catch {
      /* stockage indisponible : le choix vaut pour cette visite */
    }
  }

  const ex = salle?.exercice
  const enCours = ex?.statut === 'en_cours'
  const traites = useMemo(() => new Set(salle?.traites ?? []), [salle])
  const messages = useMemo(
    () => (salle?.messages ?? []).filter((m) => !role || m.destinataires.includes('tous') || m.destinataires.includes(role)),
    [salle, role]
  )
  const aTraiter = messages.filter((m) => !traites.has(m.id)).length
  const publications = useMemo(
    () => (salle?.publications ?? []).filter((p) => !hashtag || hashtagsDe(p.texte).includes(hashtag)),
    [salle, hashtag]
  )

  async function marquer(m) {
    setOccupe(m.id)
    const { error } = await supabase.rpc('marquer_stimulus_traite', { p_stimulus: m.id, p_role: role || null })
    setOccupe(null)
    if (error) setErreur(texteErreur(error))
    else await charger()
  }

  return (
    <div>
      <Link to={`/exercices/${id}`} className="lien text-sm">← Fiche de l’exercice</Link>

      <div
        role="note"
        style={{ background: '#7c2d12', color: '#fff', padding: '8px 14px', borderRadius: 6, margin: '8px 0 12px', fontSize: 13, fontWeight: 600, letterSpacing: 0.3 }}
      >
        EXERCICE — salle de jeu. Messages et publications sont fictifs ; rien n’est diffusé hors de l’exercice.
      </div>

      {erreur && <p role="alert" className="text-sm text-chaud mb-2">{erreur}</p>}
      {!salle && !erreur && <p className="text-sm text-sourdine">Chargement…</p>}

      {salle && (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h1 className="text-lg font-semibold text-encre">{ex.titre?.trim() || 'Exercice'}</h1>
            <p className="text-sm text-sourdine">
              {enCours ? <>Heure du scénario : <strong className="text-encre">{libelleTScenario(minutesScenario(ex, maintenant))}</strong></> : 'Exercice terminé'}
              {maj && <span className="ml-2 text-xs">· à jour à {new Date(maj).toLocaleTimeString('fr-BE')}</span>}
            </p>
          </div>

          {salle.decompte && <Decompte decompte={salle.decompte} maintenant={maintenant} actif={enCours} />}

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <label htmlFor="role" className="text-sm text-encre">Je joue le rôle :</label>
            <select id="role" value={role} onChange={(e) => choisirRole(e.target.value)}>
              <option value="">— tous les messages —</option>
              {(salle.roles ?? []).filter((r) => r !== 'tous').map((r) => (
                <option key={r} value={r}>{libelleRole(r)}</option>
              ))}
            </select>
            <BoutonDiscret onClick={charger}>Actualiser</BoutonDiscret>
          </div>

          <div role="tablist" className="flex gap-1 mb-3 border-b border-trait">
            {[
              { cle: 'messages', libelle: `Messagerie${aTraiter ? ` (${aTraiter} à traiter)` : ''}` },
              { cle: 'fil', libelle: `Fil social (${salle.publications?.length ?? 0})` },
            ].map((o) => (
              <button
                key={o.cle}
                type="button"
                role="tab"
                aria-selected={onglet === o.cle}
                onClick={() => setOnglet(o.cle)}
                className={`discret ${onglet === o.cle ? 'font-semibold' : ''}`}
                style={{ borderBottom: onglet === o.cle ? '2px solid currentColor' : '2px solid transparent', borderRadius: 0 }}
              >
                {o.libelle}
              </button>
            ))}
          </div>

          {onglet === 'messages' && (
            messages.length === 0 ? (
              <p className="text-sm text-sourdine">Aucun message pour {role ? libelleRole(role) : 'l’instant'}.</p>
            ) : (
              <ul className="space-y-2">
                {messages.map((m) => {
                  const fait = traites.has(m.id)
                  return (
                    <li
                      key={m.id}
                      className="bg-surface border border-trait rounded px-3 py-2 text-sm"
                      style={{ borderLeft: fait ? undefined : '4px solid #c2410c', opacity: fait ? 0.7 : 1 }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-sourdine">
                            {heureLocale(m.lance_a)} · {LIBELLE_CANAL[m.canal] ?? m.canal}
                            {m.emetteur && <> · de <strong>{m.emetteur}</strong></>}
                            {' '}→ {m.destinataires.map(libelleRole).join(', ')}
                          </p>
                          <p className="text-encre whitespace-pre-line">{m.texte}</p>
                        </div>
                        {fait ? (
                          <span className="jeton text-xs flex-shrink-0">traité</span>
                        ) : enCours ? (
                          <BoutonPrincipal className="flex-shrink-0" disabled={occupe === m.id} onClick={() => marquer(m)}>
                            Marquer traité
                          </BoutonPrincipal>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )
          )}

          {onglet === 'fil' && (
            <div>
              {hashtag && (
                <p className="text-sm mb-2">
                  Filtré sur <strong>{hashtag}</strong> · <button type="button" className="lien" onClick={() => setHashtag(null)}>tout afficher</button>
                </p>
              )}
              {publications.length === 0 ? (
                <p className="text-sm text-sourdine">Aucune publication pour l’instant.</p>
              ) : (
                <ul className="space-y-2">
                  {publications.map((p) => (
                    <li key={p.id} className="bg-surface border border-trait rounded px-3 py-2 text-sm">
                      <p className="text-xs text-sourdine">
                        <strong className="text-encre">{p.emetteur || 'Anonyme'}</strong> · {heureLocale(p.lance_a)}
                        <span className="jeton ml-2">simulé</span>
                      </p>
                      <p className="text-encre whitespace-pre-line">
                        <TexteAvecHashtags texte={p.texte} onHashtag={setHashtag} />
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Decompte({ decompte, maintenant, actif }) {
  const reste = Math.round((Date.parse(decompte.fin_le) - maintenant) / 1000)
  const depasse = reste < 0
  const s = Math.abs(reste)
  const p = (n) => String(n).padStart(2, '0')
  const affiche = `${s >= 3600 ? `${Math.floor(s / 3600)}:` : ''}${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
  return (
    <div
      role="timer"
      aria-live="off"
      className="border rounded p-3 mb-3 text-center"
      style={{ borderColor: depasse ? '#b91c1c' : '#c2410c' }}
    >
      <p className="text-sm text-encre">{decompte.texte}</p>
      <p className="font-mono font-semibold" style={{ fontSize: 32, color: depasse ? '#b91c1c' : undefined }}>
        {depasse ? `+${affiche}` : affiche}
      </p>
      <p className="text-xs text-sourdine">
        {depasse ? 'Échéance dépassée' : `Échéance à ${heureLocale(decompte.fin_le)}`}
        {!actif && ' · exercice terminé'}
      </p>
    </div>
  )
}

function TexteAvecHashtags({ texte, onHashtag }) {
  const morceaux = String(texte).split(/(#[\p{L}\p{N}_]+)/u)
  return morceaux.map((m, i) =>
    m.startsWith('#') ? (
      <button key={i} type="button" className="lien" onClick={() => onHashtag(m.toLowerCase())}>{m}</button>
    ) : (
      <span key={i}>{m}</span>
    )
  )
}

function hashtagsDe(texte) {
  return (String(texte).match(/#[\p{L}\p{N}_]+/gu) ?? []).map((h) => h.toLowerCase())
}

function libelleRole(r) {
  return r === 'tous' ? 'Tous' : LIBELLE_DISCIPLINE[r] ?? r
}

function lireRole(id) {
  try {
    return localStorage.getItem(`salle-role-${id}`) ?? ''
  } catch {
    return ''
  }
}
