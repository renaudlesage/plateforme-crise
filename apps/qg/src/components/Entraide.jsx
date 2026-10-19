import { useEffect, useMemo, useState } from 'react'
import {
  CATEGORIES_BESOIN,
  COMPETENCES_ENTRAIDE,
  MODES_COORDINATION,
  PRIORITES_MISSION,
  STATUTS_BESOIN,
  STATUTS_EQUIPE,
  STATUTS_MISSION,
  STATUTS_PRESENCE,
  TYPES_INCIDENT_BENEVOLE,
  ZONES_LIBELLES,
  alertesEntraide,
  classeDe,
  compterPresences,
  distanceKm,
  libelleBesoin,
  libelleCompetence,
  libellePriorite,
  libelleStatutJuridique,
  libelleStatutMission,
  libelleStatutPresence,
  libelleTypeProprietaire,
  lienAccueilBenevole,
  svgQr,
  trierMissions,
} from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useEntraide } from '../hooks/useEntraide'
import { BoutonDiscret, BoutonPrincipal } from './Boutons'

const URL_CITOYEN = import.meta.env.VITE_URL_CITOYEN || 'https://plateforme-crise-citoyen.vercel.app'
const FUSEAU = 'Europe/Brussels'
const heure = (t) => (t ? new Intl.DateTimeFormat('fr-BE', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' }).format(new Date(t)) : '—')
const dateHeure = (t) => (t ? new Intl.DateTimeFormat('fr-BE', { timeZone: FUSEAU, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(t)) : '—')
const ONGLETS = [
  { cle: 'accueil', libelle: 'Accueil' },
  { cle: 'equipes', libelle: 'Équipes' },
  { cle: 'missions', libelle: 'Missions' },
  { cle: 'moyens', libelle: 'Moyens privés' },
  { cle: 'dons', libelle: 'Dons et besoins' },
  { cle: 'securite', libelle: 'Sécurité' },
]

/**
 * Volet « Entraide » de la fiche incident : bénévoles spontanés (accueil par QR, validation, équipes),
 * missions (file priorisée, affectation, zones), moyens privés du cadastre, dons et page publique.
 * Trois commandements possibles, rendus explicites : le CC désigne, le coordinateur affecte,
 * le Dir PC-Ops reprend ce qui tombe dans un périmètre d'intervention (la base l'impose).
 */
export default function Entraide({ incidentId }) {
  const { contexteId, utilisateur, contexteActuel } = useAuth()
  const e = useEntraide(incidentId, contexteId, { niveauAdmin: contexteActuel?.niveau_acces === 'admin' })
  const [onglet, setOnglet] = useState('accueil')
  const [maintenant, setMaintenant] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  if (e.erreur) return <p role="alert" className="text-sm text-chaud">{e.erreur}</p>
  if (!e.donnees) return <p className="text-sm text-sourdine">Chargement…</p>
  const { incident, presences, equipes, missions, aRelever } = e.donnees
  const ferme = incident.coordinateur_benevoles === 'aucun'
  const compteurs = compterPresences(presences)
  const alertes = alertesEntraide({ missions, equipesARelever: aRelever, presences, maintenant })
  const lectureSeule = !e.droits.coordonner && !e.droits.commanderZone

  return (
    <section aria-label="Entraide" className="mb-6">
      <EnTete e={e} incident={incident} utilisateur={utilisateur} />

      {ferme ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4">
          Volet fermé : désignez un coordinateur des bénévoles pour ouvrir l'accueil, les équipes et les missions.
          Les bénévoles pré-inscrits se gèrent dans l'administration (Anticipation › Entraide).
        </p>
      ) : (
        <>
          <p className="flex flex-wrap gap-2 mb-3" style={{ margin: '0 0 12px' }}>
            <span className="jeton">Présents {compteurs.presents}</span>
            <span className="jeton">À valider {compteurs.enregistres}</span>
            <span className="jeton">Disponibles {compteurs.disponibles}</span>
            <span className="jeton">Affectés {compteurs.affectes}</span>
            <span className="jeton">Équipes engagées {equipes.filter((q) => q.statut === 'engagee').length}</span>
            <span className="jeton">Missions ouvertes {missions.filter((m) => m.statut === 'ouverte').length}</span>
            <span className="jeton">Sortis {compteurs.sortis}</span>
          </p>
          {alertes.length > 0 && (
            <ul className="mb-3 text-sm" style={{ margin: '0 0 12px', paddingLeft: 0, listStyle: 'none' }}>
              {alertes.map((a) => (
                <li key={a.cle} className={a.niveau === 'chaud' ? 'text-chaud' : a.niveau === 'veille' ? 'text-veille' : 'text-sourdine'}>
                  ⚠ {a.texte}
                </li>
              ))}
            </ul>
          )}
          {incident.est_exercice && <p className="text-xs text-sourdine mb-2">Incident d'exercice : les présences et missions sont marquées exercice, la page publique ne les affiche pas.</p>}
          {lectureSeule && <p className="text-xs text-sourdine mb-2">Lecture seule : vous n'êtes ni coordinateur des bénévoles ni commandement de zone.</p>}

          <div className="onglets" role="tablist" aria-label="Entraide" style={{ marginBottom: 12 }}>
            {ONGLETS.map((o) => (
              <button key={o.cle} type="button" role="tab" aria-selected={o.cle === onglet} className={`module ${o.cle === onglet ? 'actif' : ''}`.trim()} style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setOnglet(o.cle)}>
                {o.libelle}
              </button>
            ))}
          </div>

          {onglet === 'accueil' && <Accueil e={e} maintenant={maintenant} />}
          {onglet === 'equipes' && <Equipes e={e} maintenant={maintenant} />}
          {onglet === 'missions' && <Missions e={e} maintenant={maintenant} />}
          {onglet === 'moyens' && <MoyensPrives e={e} />}
          {onglet === 'dons' && <Dons e={e} />}
          {onglet === 'securite' && <Securite e={e} />}
        </>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ En-tête : coordinateur */
function EnTete({ e, incident, utilisateur }) {
  const { contexteId } = useAuth()
  const [edition, setEdition] = useState(false)
  const [mode, setMode] = useState(incident.coordinateur_benevoles)
  const [personne, setPersonne] = useState(incident.coordinateur_benevoles_user_id ?? '')
  const [libelle, setLibelle] = useState(incident.coordinateur_benevoles_libelle ?? '')
  const [membres, setMembres] = useState([])
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    if (!edition || !contexteId) return
    supabase.rpc('membres_contexte', { p_contexte_id: contexteId }).then(({ data }) => setMembres(data ?? []))
  }, [edition, contexteId])

  const texte =
    incident.coordinateur_benevoles === 'aucun'
      ? 'Aucun coordinateur désigné'
      : incident.coordinateur_benevoles === 'd4'
        ? 'Coordination : D4 · logistique'
        : `Coordination : ${incident.coordinateur_benevoles_libelle || 'personne désignée'}${incident.coordinateur_benevoles_user_id === utilisateur?.id ? ' (vous)' : ''}`

  async function enregistrer(ev) {
    ev.preventDefault()
    setErreur(null)
    const m = membres.find((x) => x.user_id === personne)
    const r = await e.designerCoordinateur(mode, mode === 'personne' ? personne || null : null, mode === 'personne' ? libelle || m?.email || null : null)
    if (r.error) return setErreur(r.error.message)
    setEdition(false)
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
      <div>
        <h2 className="text-base font-semibold text-encre" style={{ margin: 0 }}>Entraide : bénévoles et moyens privés</h2>
        <p className="text-sm text-sourdine" style={{ margin: '2px 0 0' }}>
          {texte}
          {incident.coordinateur_benevoles_depuis && <span> · depuis {dateHeure(incident.coordinateur_benevoles_depuis)}</span>}
          {' · '}
          <span>le Dir PC-Ops commande ce qui est en zone d'intervention</span>
        </p>
      </div>
      {e.droits.designer && !edition && (
        <BoutonDiscret type="button" onClick={() => setEdition(true)}>
          {incident.coordinateur_benevoles === 'aucun' ? 'Désigner un coordinateur' : 'Changer'}
        </BoutonDiscret>
      )}
      {edition && (
        <form onSubmit={enregistrer} className="border border-trait rounded p-3 bg-surface w-full" aria-label="Désigner le coordinateur des bénévoles">
          <p className="text-xs text-sourdine" style={{ margin: '0 0 8px' }}>Décision du Comité de Coordination, inscrite au journal des décisions.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-sm">
              Coordination
              <select value={mode} onChange={(ev) => setMode(ev.target.value)} className="w-full">
                {MODES_COORDINATION.map((m) => (
                  <option key={m.valeur} value={m.valeur}>{m.libelle}</option>
                ))}
              </select>
            </label>
            {mode === 'personne' && (
              <>
                <label className="text-sm">
                  Membre
                  <select value={personne} onChange={(ev) => setPersonne(ev.target.value)} className="w-full" required>
                    <option value="">— choisir —</option>
                    {membres.map((m) => (
                      <option key={m.user_id} value={m.user_id}>{m.email}{m.role_libelle ? ` · ${m.role_libelle}` : ''}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Nom affiché
                  <input value={libelle} onChange={(ev) => setLibelle(ev.target.value)} className="w-full" maxLength={120} placeholder="ex. Agent Dubois, service travaux" />
                </label>
              </>
            )}
          </div>
          {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}
          <div className="flex gap-2 mt-2">
            <BoutonPrincipal type="submit">Enregistrer la désignation</BoutonPrincipal>
            <BoutonDiscret type="button" onClick={() => setEdition(false)}>Annuler</BoutonDiscret>
          </div>
        </form>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ Accueil */
function Accueil({ e, maintenant }) {
  const { pabs, presences, parametres } = e.donnees
  const peut = e.droits.coordonner
  const [formPab, setFormPab] = useState(false)
  const [formManuel, setFormManuel] = useState(false)
  const [filtre, setFiltre] = useState('a_traiter')
  const [erreur, setErreur] = useState(null)
  const ouverts = pabs.filter((p) => !p.ferme_le)

  const visibles = presences.filter((p) => {
    if (filtre === 'tous') return true
    if (filtre === 'a_traiter') return p.statut === 'enregistre' || (p.sortie_demandee_le && !['sorti', 'refuse'].includes(p.statut))
    return p.statut === filtre
  })

  async function agir(fn) {
    setErreur(null)
    const r = await fn()
    if (r.error) setErreur(r.error.message)
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-encre" style={{ margin: '0 0 6px' }}>Points d'accueil ({ouverts.length} ouvert{ouverts.length > 1 ? 's' : ''})</h3>
      <p className="text-xs text-sourdine" style={{ margin: '0 0 8px' }}>
        Chaque point affiche un QR : le bénévole s'enregistre lui-même sur son téléphone, l'agent valide après le briefing. Aucune affectation sans validation.
      </p>
      {pabs.length === 0 && <p className="text-sm text-sourdine">Aucun point d'accueil. Ouvrez-en un pour commencer à recevoir des bénévoles.</p>}
      <div className="grid gap-3 md:grid-cols-2 mb-3">
        {pabs.map((p) => (
          <CartePab key={p.id} pab={p} e={e} peut={peut} presences={presences} onErreur={setErreur} />
        ))}
      </div>
      {peut && !formPab && <BoutonDiscret type="button" onClick={() => setFormPab(true)}>+ Ouvrir un point d'accueil</BoutonDiscret>}
      {formPab && <FormulairePab e={e} onFermer={() => setFormPab(false)} />}

      <h3 className="text-sm font-semibold text-encre mt-6" style={{ margin: '24px 0 6px' }}>Bénévoles ({presences.length})</h3>
      <div className="flex flex-wrap gap-2 mb-2">
        {[
          ['a_traiter', `À traiter (${presences.filter((p) => p.statut === 'enregistre' || (p.sortie_demandee_le && !['sorti', 'refuse'].includes(p.statut))).length})`],
          ['valide', 'Disponibles'],
          ['affecte', 'Affectés'],
          ['en_repos', 'En repos'],
          ['sorti', 'Sortis'],
          ['tous', 'Tous'],
        ].map(([v, l]) => (
          <BoutonDiscret key={v} type="button" aria-pressed={filtre === v} onClick={() => setFiltre(v)} style={filtre === v ? { background: 'var(--encre)', color: 'var(--fond)' } : undefined}>
            {l}
          </BoutonDiscret>
        ))}
        {peut && ouverts.length > 0 && !formManuel && (
          <BoutonDiscret type="button" onClick={() => setFormManuel(true)}>+ Enregistrer à la main</BoutonDiscret>
        )}
      </div>
      {formManuel && <FormulairePresence e={e} pabs={ouverts} parametres={parametres} onFermer={() => setFormManuel(false)} />}
      {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}
      {visibles.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-3">Rien dans ce filtre.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="grid gap-2">
          {visibles.map((p) => (
            <li key={p.id} data-presence={p.numero} className="border border-trait rounded bg-surface p-3 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-encre" style={{ margin: 0 }}>
                  <b>{p.numero}</b> · {p.prenom} {p.nom}
                  <span className={`jeton ml-2 ${classeDe(STATUTS_PRESENCE, p.statut)}`}>{libelleStatutPresence(p.statut)}</span>
                  {p.est_exercice && <span className="jeton ml-1">Exercice</span>}
                </p>
                <p className="text-xs text-sourdine" style={{ margin: '2px 0 0' }}>
                  Arrivé {heure(p.arrive_le)}
                  {p.valide_le && <> · validé {heure(p.valide_le)}</>}
                  {p.sorti_le && <> · sorti {heure(p.sorti_le)}</>}
                  {p.telephone && <> · {p.telephone}</>}
                  {p.competences?.length > 0 && <> · {p.competences.map(libelleCompetence).join(', ')}</>}
                  {p.materiel_apporte && <> · apporte : {p.materiel_apporte}</>}
                  {p.benevole_id && <> · pré-inscrit</>}
                </p>
                {p.contact_urgence_nom && <p className="text-xs text-sourdine" style={{ margin: '2px 0 0' }}>Urgence : {p.contact_urgence_nom} {p.contact_urgence_telephone}</p>}
                {p.sortie_demandee_le && !['sorti', 'refuse'].includes(p.statut) && (
                  <p className="text-xs text-veille" style={{ margin: '2px 0 0' }}>Demande de sortie à {heure(p.sortie_demandee_le)}{p.statut === 'affecte' ? ' — retirez-le de son équipe d’abord' : ''}</p>
                )}
                {p.note_interne && <p className="text-xs text-sourdine" style={{ margin: '2px 0 0' }}>Note : {p.note_interne}</p>}
              </div>
              {peut && (
                <div className="flex flex-wrap gap-2">
                  {p.statut === 'enregistre' && (
                    <>
                      <BoutonPrincipal type="button" onClick={() => agir(() => e.changerStatutPresence(p.id, 'valide'))}>Valider (briefing fait)</BoutonPrincipal>
                      <BoutonDiscret type="button" onClick={() => agir(() => e.changerStatutPresence(p.id, 'refuse'))}>Refuser</BoutonDiscret>
                    </>
                  )}
                  {p.statut === 'valide' && (
                    <>
                      <BoutonDiscret type="button" onClick={() => agir(() => e.changerStatutPresence(p.id, 'en_repos'))}>En repos</BoutonDiscret>
                      <BoutonDiscret type="button" onClick={() => agir(() => e.changerStatutPresence(p.id, 'sorti'))}>Marquer sorti</BoutonDiscret>
                    </>
                  )}
                  {p.statut === 'en_repos' && (
                    <>
                      <BoutonDiscret type="button" onClick={() => agir(() => e.changerStatutPresence(p.id, 'valide'))}>De retour</BoutonDiscret>
                      <BoutonDiscret type="button" onClick={() => agir(() => e.changerStatutPresence(p.id, 'sorti'))}>Marquer sorti</BoutonDiscret>
                    </>
                  )}
                  <NotePresence presence={p} e={e} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function NotePresence({ presence, e }) {
  const [ouvert, setOuvert] = useState(false)
  const [note, setNote] = useState(presence.note_interne ?? '')
  if (!ouvert) return <BoutonDiscret type="button" onClick={() => setOuvert(true)}>Note</BoutonDiscret>
  return (
    <form
      onSubmit={async (ev) => {
        ev.preventDefault()
        await e.noterPresence(presence.id, note.trim() || null)
        setOuvert(false)
      }}
      className="flex gap-2 w-full"
    >
      <input value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={1000} placeholder="Note interne (jamais visible du bénévole)" className="w-full" />
      <BoutonDiscret type="submit">OK</BoutonDiscret>
    </form>
  )
}

function CartePab({ pab, e, peut, presences, onErreur }) {
  const [qr, setQr] = useState(false)
  const lien = lienAccueilBenevole(URL_CITOYEN, pab.jeton_qr)
  const n = presences.filter((p) => p.pab_id === pab.id).length
  const ferme = !!pab.ferme_le
  async function agir(fn) {
    onErreur(null)
    const r = await fn()
    if (r.error) onErreur(r.error.message)
  }
  return (
    <article data-pab={pab.nom} className="border border-trait rounded bg-surface p-3">
      <p className="text-sm text-encre" style={{ margin: 0 }}>
        <b>{pab.nom}</b> {ferme ? <span className="jeton ml-2 text-sourdine">Fermé</span> : <span className="jeton ml-2 text-ok">Ouvert</span>}
      </p>
      <p className="text-xs text-sourdine" style={{ margin: '2px 0 0' }}>
        {pab.adresse && <>{pab.adresse} · </>}ouvert {heure(pab.ouvert_le)}{ferme && <> · fermé {heure(pab.ferme_le)}</>} · {n} passage{n > 1 ? 's' : ''}
      </p>
      {pab.consignes_briefing && <p className="text-xs text-sourdine" style={{ margin: '2px 0 0' }}>Briefing : {pab.consignes_briefing}</p>}
      {!ferme && (
        <div className="flex flex-wrap gap-2 mt-2">
          <BoutonDiscret type="button" aria-expanded={qr} onClick={() => setQr((v) => !v)}>{qr ? 'Masquer le QR' : 'Afficher le QR'}</BoutonDiscret>
          {peut && <BoutonDiscret type="button" onClick={() => agir(() => e.regenererQr(pab.id))}>Nouveau QR</BoutonDiscret>}
          {peut && <BoutonDiscret type="button" onClick={() => agir(() => e.fermerPab(pab.id))}>Fermer ce point</BoutonDiscret>}
        </div>
      )}
      {qr && !ferme && (
        <div className="mt-3 text-center" data-qr>
          <div dangerouslySetInnerHTML={{ __html: svgQr(lien, { taille: 220 }) }} />
          <p className="text-xs text-sourdine" style={{ margin: '6px 0 0', wordBreak: 'break-all' }}>{lien}</p>
          <p className="text-xs text-sourdine" style={{ margin: '4px 0 0' }}>Imprimez cette page ou affichez-la sur un écran à l'accueil. « Nouveau QR » invalide l'ancien.</p>
        </div>
      )}
    </article>
  )
}

function FormulairePab({ e, onFermer }) {
  const { centres } = e.donnees
  const [nom, setNom] = useState('')
  const [adresse, setAdresse] = useState('')
  const [centre, setCentre] = useState('')
  const [consignes, setConsignes] = useState('')
  const [erreur, setErreur] = useState(null)
  return (
    <form
      onSubmit={async (ev) => {
        ev.preventDefault()
        setErreur(null)
        const c = centres.find((x) => x.id === centre)
        const r = await e.creerPab({ nom: nom.trim(), adresse: adresse.trim() || c?.adresse || null, centre_accueil_id: centre || null, latitude: c?.latitude ?? null, longitude: c?.longitude ?? null, consignes_briefing: consignes.trim() || null })
        if (r.error) return setErreur(r.error.message)
        onFermer()
      }}
      className="border border-trait rounded p-3 bg-surface mt-2"
      aria-label="Ouvrir un point d'accueil"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          Nom du point
          <input value={nom} onChange={(ev) => setNom(ev.target.value)} className="w-full" required minLength={2} maxLength={120} placeholder="ex. Salle communale" />
        </label>
        <label className="text-sm">
          Centre d'accueil existant (facultatif)
          <select value={centre} onChange={(ev) => setCentre(ev.target.value)} className="w-full">
            <option value="">—</option>
            {centres.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          Adresse
          <input value={adresse} onChange={(ev) => setAdresse(ev.target.value)} className="w-full" maxLength={300} />
        </label>
        <label className="text-sm sm:col-span-2">
          Consignes de briefing (lues par le bénévole avant de s'enregistrer)
          <textarea value={consignes} onChange={(ev) => setConsignes(ev.target.value)} className="w-full" rows={2} maxLength={1000} placeholder="ex. Gilet et bottes obligatoires. On ne va nulle part sans son chef d'équipe." />
        </label>
      </div>
      {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}
      <div className="flex gap-2 mt-2">
        <BoutonPrincipal type="submit">Ouvrir</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onFermer}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function FormulairePresence({ e, pabs, parametres, onFermer }) {
  const [v, setV] = useState({ pab_id: pabs[0]?.id ?? '', nom: '', prenom: '', telephone: '', contact_urgence_nom: '', contact_urgence_telephone: '', materiel_apporte: '', competences: [] })
  const [majeur, setMajeur] = useState(false)
  const [erreur, setErreur] = useState(null)
  const set = (k) => (ev) => setV((x) => ({ ...x, [k]: ev.target.value }))
  const bascule = (c) => setV((x) => ({ ...x, competences: x.competences.includes(c) ? x.competences.filter((y) => y !== c) : [...x.competences, c] }))
  return (
    <form
      onSubmit={async (ev) => {
        ev.preventDefault()
        setErreur(null)
        if (!majeur) return setErreur(`Le bénévole doit avoir au moins ${parametres?.age_minimum ?? 18} ans.`)
        const r = await e.enregistrerPresence({ ...v, nom: v.nom.trim(), prenom: v.prenom.trim(), telephone: v.telephone.trim() || null, contact_urgence_nom: v.contact_urgence_nom.trim() || null, contact_urgence_telephone: v.contact_urgence_telephone.trim() || null, materiel_apporte: v.materiel_apporte.trim() || null })
        if (r.error) return setErreur(r.error.message)
        onFermer()
      }}
      className="border border-trait rounded p-3 bg-surface mb-3"
      aria-label="Enregistrer un bénévole à la main"
    >
      <p className="text-xs text-sourdine" style={{ margin: '0 0 8px' }}>Pour un bénévole sans téléphone. Le QR reste la voie normale.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-sm">Point d'accueil<select value={v.pab_id} onChange={set('pab_id')} className="w-full">{pabs.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}</select></label>
        <label className="text-sm">Prénom<input value={v.prenom} onChange={set('prenom')} className="w-full" required maxLength={80} /></label>
        <label className="text-sm">Nom<input value={v.nom} onChange={set('nom')} className="w-full" required maxLength={80} /></label>
        <label className="text-sm">Téléphone<input value={v.telephone} onChange={set('telephone')} className="w-full" maxLength={30} /></label>
        <label className="text-sm">Contact d'urgence<input value={v.contact_urgence_nom} onChange={set('contact_urgence_nom')} className="w-full" maxLength={120} /></label>
        <label className="text-sm">Téléphone du contact<input value={v.contact_urgence_telephone} onChange={set('contact_urgence_telephone')} className="w-full" maxLength={30} /></label>
        <label className="text-sm sm:col-span-3">Matériel apporté<input value={v.materiel_apporte} onChange={set('materiel_apporte')} className="w-full" maxLength={300} /></label>
      </div>
      <fieldset className="mt-2" style={{ border: 0, padding: 0, margin: '8px 0 0' }}>
        <legend className="text-sm">Compétences</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {COMPETENCES_ENTRAIDE.map((c) => (
            <label key={c.valeur} className="text-xs flex items-center gap-1"><input type="checkbox" checked={v.competences.includes(c.valeur)} onChange={() => bascule(c.valeur)} />{c.libelle}</label>
          ))}
        </div>
      </fieldset>
      <label className="text-sm flex items-center gap-2 mt-2"><input type="checkbox" checked={majeur} onChange={(ev) => setMajeur(ev.target.checked)} />Le bénévole a au moins {parametres?.age_minimum ?? 18} ans et a reçu les consignes de sécurité</label>
      {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}
      <div className="flex gap-2 mt-2">
        <BoutonPrincipal type="submit">Enregistrer</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onFermer}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ Équipes */
function Equipes({ e, maintenant }) {
  const { equipes, membres, presences, missions, aRelever, parametres } = e.donnees
  const peut = e.droits.coordonner
  const [erreur, setErreur] = useState(null)
  const [creation, setCreation] = useState(false)
  const [nom, setNom] = useState('')
  const disponibles = presences.filter((p) => ['valide', 'en_repos'].includes(p.statut))
  const actives = equipes.filter((q) => q.statut !== 'dissoute')
  const dissoutes = equipes.filter((q) => q.statut === 'dissoute')
  async function agir(fn) {
    setErreur(null)
    const r = await fn()
    if (r.error) setErreur(r.error.message)
  }
  return (
    <div>
      <p className="text-xs text-sourdine" style={{ margin: '0 0 8px' }}>
        {parametres?.taille_equipe_min ?? 3} à {parametres?.taille_equipe_max ?? 8} bénévoles par équipe, un chef par équipe{parametres?.chef_agent_recommande !== false ? ' (agent ou pompier recommandé)' : ''}.
        Entrer dans une équipe rend le bénévole « affecté » ; en sortir le rend disponible.
      </p>
      {peut && !creation && <BoutonDiscret type="button" onClick={() => setCreation(true)}>+ Constituer une équipe</BoutonDiscret>}
      {creation && (
        <form
          onSubmit={async (ev) => {
            ev.preventDefault()
            await agir(() => e.creerEquipe({ nom: nom.trim() || null }))
            setNom('')
            setCreation(false)
          }}
          className="flex gap-2 mt-2"
        >
          <input value={nom} onChange={(ev) => setNom(ev.target.value)} placeholder="Nom (sinon Équipe n)" maxLength={80} />
          <BoutonPrincipal type="submit">Créer</BoutonPrincipal>
          <BoutonDiscret type="button" onClick={() => setCreation(false)}>Annuler</BoutonDiscret>
        </form>
      )}
      {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}
      {actives.length === 0 && <p className="text-sm text-sourdine mt-2">Aucune équipe constituée.</p>}
      <div className="grid gap-3 md:grid-cols-2 mt-3">
        {actives.map((q) => (
          <CarteEquipe key={q.id} equipe={q} e={e} peut={peut} membres={membres.filter((m) => m.equipe_id === q.id)} presences={presences} disponibles={disponibles} missions={missions.filter((m) => m.equipe_id === q.id && ['affectee', 'en_cours'].includes(m.statut))} aRelever={aRelever.some((r) => r.equipe_id === q.id)} maintenant={maintenant} onErreur={setErreur} />
        ))}
      </div>
      {dissoutes.length > 0 && <p className="text-xs text-sourdine mt-3">{dissoutes.length} équipe{dissoutes.length > 1 ? 's' : ''} dissoute{dissoutes.length > 1 ? 's' : ''} : {dissoutes.map((q) => q.nom).join(', ')}.</p>}
    </div>
  )
}

function CarteEquipe({ equipe, e, peut, membres, presences, disponibles, missions, aRelever, maintenant, onErreur }) {
  const [ajout, setAjout] = useState('')
  const [chef, setChef] = useState(false)
  const [chefLibelle, setChefLibelle] = useState(equipe.chef_libelle ?? '')
  const [chefPresence, setChefPresence] = useState(equipe.chef_presence_id ?? '')
  const p = (id) => presences.find((x) => x.id === id)
  const chefTexte = equipe.chef_presence_id ? `${p(equipe.chef_presence_id)?.prenom ?? ''} ${p(equipe.chef_presence_id)?.nom ?? ''} (bénévole)` : equipe.chef_libelle || 'aucun chef'
  async function agir(fn) {
    onErreur(null)
    const r = await fn()
    if (r.error) onErreur(r.error.message)
  }
  const minutes = equipe.engagee_depuis ? Math.round((maintenant - new Date(equipe.engagee_depuis).getTime()) / 60000) : null
  return (
    <article data-equipe={equipe.nom} className="border border-trait rounded bg-surface p-3">
      <p className="text-sm text-encre" style={{ margin: 0 }}>
        <b>{equipe.nom}</b> <span className="jeton ml-2">{STATUTS_EQUIPE.find((s) => s.valeur === equipe.statut)?.libelle}</span>
        {aRelever && <span className="jeton ml-1 text-chaud">À relever</span>}
      </p>
      <p className="text-xs text-sourdine" style={{ margin: '2px 0 0' }}>
        Chef : {chefTexte} · {membres.length} membre{membres.length > 1 ? 's' : ''}
        {minutes != null && <> · engagée depuis {minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}` : `${minutes} min`}</>}
      </p>
      {missions.length > 0 && <p className="text-xs text-encre" style={{ margin: '2px 0 0' }}>Mission : {missions.map((m) => `${m.numero} ${m.titre}`).join(' · ')}</p>}
      <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }} className="text-sm">
        {membres.map((m) => {
          const b = p(m.presence_id)
          return (
            <li key={m.id} className="flex justify-between gap-2">
              <span>{b ? `${b.numero} ${b.prenom} ${b.nom}` : m.presence_id}{b?.competences?.length ? <span className="text-xs text-sourdine"> · {b.competences.map(libelleCompetence).join(', ')}</span> : null}</span>
              {peut && equipe.statut !== 'dissoute' && <button type="button" className="discret" style={{ padding: '0 8px' }} onClick={() => agir(() => e.retirerMembre(m.id))}>Retirer</button>}
            </li>
          )
        })}
      </ul>
      {peut && equipe.statut !== 'dissoute' && (
        <div className="mt-2 flex flex-wrap gap-2 items-end">
          <label className="text-xs">
            Ajouter un bénévole disponible
            <select value={ajout} onChange={(ev) => setAjout(ev.target.value)}>
              <option value="">—</option>
              {disponibles.map((b) => (
                <option key={b.id} value={b.id}>{b.numero} {b.prenom} {b.nom}{b.competences?.length ? ` · ${b.competences.map(libelleCompetence).join(', ')}` : ''}</option>
              ))}
            </select>
          </label>
          <BoutonDiscret type="button" disabled={!ajout} onClick={() => agir(() => e.ajouterMembre(equipe.id, ajout)).then(() => setAjout(''))}>Ajouter</BoutonDiscret>
          <BoutonDiscret type="button" onClick={() => setChef((v) => !v)}>Chef…</BoutonDiscret>
          {equipe.statut === 'engagee' && <BoutonDiscret type="button" onClick={() => agir(() => e.modifierEquipe(equipe.id, { statut: 'repos' }))}>Au repos</BoutonDiscret>}
          {equipe.statut === 'repos' && <BoutonDiscret type="button" onClick={() => agir(() => e.modifierEquipe(equipe.id, { statut: 'constituee' }))}>Disponible</BoutonDiscret>}
          <BoutonDiscret type="button" onClick={() => window.confirm(`Dissoudre ${equipe.nom} ? Ses membres redeviennent disponibles.`) && agir(() => e.modifierEquipe(equipe.id, { statut: 'dissoute' }))}>Dissoudre</BoutonDiscret>
        </div>
      )}
      {chef && (
        <form
          onSubmit={async (ev) => {
            ev.preventDefault()
            await agir(() => e.modifierEquipe(equipe.id, { chef_presence_id: chefPresence || null, chef_libelle: chefLibelle.trim() || null }))
            setChef(false)
          }}
          className="mt-2 grid gap-2 sm:grid-cols-3"
        >
          <label className="text-xs">
            Chef bénévole
            <select value={chefPresence} onChange={(ev) => setChefPresence(ev.target.value)}>
              <option value="">—</option>
              {[...membres.map((m) => p(m.presence_id)).filter(Boolean)].map((b) => (
                <option key={b.id} value={b.id}>{b.numero} {b.prenom} {b.nom}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            ou chef agent / pompier (nom)
            <input value={chefLibelle} onChange={(ev) => setChefLibelle(ev.target.value)} maxLength={120} />
          </label>
          <div className="flex items-end"><BoutonDiscret type="submit">Enregistrer</BoutonDiscret></div>
        </form>
      )}
    </article>
  )
}

/* ------------------------------------------------------------------ Missions */
function Missions({ e, maintenant }) {
  const { missions, equipes, incident } = e.donnees
  const [creation, setCreation] = useState(false)
  const [filtre, setFiltre] = useState('actives')
  const [erreur, setErreur] = useState(null)
  const triees = trierMissions(missions).filter((m) => (filtre === 'actives' ? !['close', 'annulee'].includes(m.statut) : filtre === 'tout' ? true : m.statut === filtre))
  const equipesDispo = equipes.filter((q) => q.statut !== 'dissoute')
  return (
    <div>
      <p className="text-xs text-sourdine" style={{ margin: '0 0 8px' }}>
        Une mission qui tombe dans un périmètre d'intervention passe « sous PC-Ops » : seul le commandement de zone l'affecte. En zone rouge, les bénévoles sont interdits sauf dérogation motivée du Dir PC-Ops.
      </p>
      <div className="flex flex-wrap gap-2 mb-2">
        {[['actives', 'Actives'], ['ouverte', 'Ouvertes'], ['refusee', 'Refusées'], ['close', 'Closes'], ['tout', 'Toutes']].map(([v, l]) => (
          <BoutonDiscret key={v} type="button" aria-pressed={filtre === v} onClick={() => setFiltre(v)} style={filtre === v ? { background: 'var(--encre)', color: 'var(--fond)' } : undefined}>{l}</BoutonDiscret>
        ))}
        {(e.droits.coordonner || e.droits.commanderZone) && !creation && <BoutonDiscret type="button" onClick={() => setCreation(true)}>+ Nouvelle mission</BoutonDiscret>}
      </div>
      {creation && <FormulaireMission e={e} incident={incident} onFermer={() => setCreation(false)} />}
      {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}
      {triees.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-3">Aucune mission dans ce filtre.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="grid gap-2">
          {triees.map((m) => (
            <CarteMission key={m.id} mission={m} e={e} equipes={equipesDispo} maintenant={maintenant} onErreur={setErreur} />
          ))}
        </ul>
      )}
    </div>
  )
}

function CarteMission({ mission: m, e, equipes, maintenant, onErreur }) {
  const [equipe, setEquipe] = useState(m.equipe_id ?? '')
  const [motif, setMotif] = useState('')
  const [raison, setRaison] = useState('')
  const [ouvrirRaison, setOuvrirRaison] = useState(null)
  const peutAffecter = m.sous_pc_ops ? e.droits.commanderZone : e.droits.coordonner || e.droits.commanderZone
  const peutDeroger = e.droits.commanderZone
  const age = Math.round((maintenant - new Date(m.created_at).getTime()) / 60000)
  async function agir(fn) {
    onErreur(null)
    const r = await fn()
    if (r.error) onErreur(r.error.message)
  }
  return (
    <li data-mission={m.numero} className="border border-trait rounded bg-surface p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-encre" style={{ margin: 0 }}>
            <span className={`jeton prio-${m.priorite}`}>{m.priorite}</span> <b>{m.numero}</b> · {m.titre}
            <span className={`jeton ml-2 ${classeDe(STATUTS_MISSION, m.statut)}`}>{libelleStatutMission(m.statut)}</span>
            {m.sous_pc_ops && <span className="jeton ml-1">Sous PC-Ops · {ZONES_LIBELLES[m.type_zone] ?? 'zone'}</span>}
            {m.type_zone === 'rouge' && m.derogation_zone_rouge_par && <span className="jeton ml-1 text-chaud">Dérogation</span>}
            {m.publie_besoin && <span className="jeton ml-1">Publié</span>}
          </p>
          <p className="text-xs text-sourdine" style={{ margin: '2px 0 0' }}>
            {libellePriorite(m.priorite)} · créée il y a {age >= 60 ? `${Math.floor(age / 60)} h` : `${age} min`}
            {m.adresse && <> · {m.adresse}</>}
            {m.point_rdv && <> · RDV : {m.point_rdv}</>}
            {m.nb_personnes && <> · {m.nb_personnes} pers.</>}
            {m.competence_requise?.length > 0 && <> · {m.competence_requise.map(libelleCompetence).join(', ')}</>}
            {m.materiel_requis && <> · matériel : {m.materiel_requis}</>}
            {m.origine_type && m.origine_type !== 'cc' && <> · origine : {m.origine_type.replace('_', ' ')}</>}
          </p>
          {m.description && <p className="text-sm text-encre" style={{ margin: '4px 0 0' }}>{m.description}</p>}
          {m.equipe_id && <p className="text-xs text-encre" style={{ margin: '2px 0 0' }}>Équipe : {equipes.find((q) => q.id === m.equipe_id)?.nom ?? e.donnees.equipes.find((q) => q.id === m.equipe_id)?.nom ?? '—'}{m.debut_le && <> · démarrée {heure(m.debut_le)}</>}{m.fin_le && ['close', 'annulee'].includes(m.statut) && <> · terminée {heure(m.fin_le)}</>}</p>}
          {m.raison_statut && <p className="text-xs text-chaud" style={{ margin: '2px 0 0' }}>{m.raison_statut}</p>}
          {m.derogation_motif && <p className="text-xs text-sourdine" style={{ margin: '2px 0 0' }}>Dérogation : {m.derogation_motif}</p>}
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          {peutAffecter && ['ouverte', 'affectee'].includes(m.statut) && (
            <>
              <select value={equipe} onChange={(ev) => setEquipe(ev.target.value)} aria-label="Équipe">
                <option value="">— équipe —</option>
                {equipes.map((q) => (
                  <option key={q.id} value={q.id}>{q.nom}{q.statut === 'engagee' ? ' (engagée)' : ''}</option>
                ))}
              </select>
              <BoutonPrincipal type="button" disabled={!equipe || equipe === m.equipe_id} onClick={() => agir(() => e.modifierMission(m.id, { equipe_id: equipe }))}>Affecter</BoutonPrincipal>
            </>
          )}
          {peutAffecter && m.statut === 'affectee' && <BoutonDiscret type="button" onClick={() => agir(() => e.modifierMission(m.id, { statut: 'en_cours' }))}>Démarrer</BoutonDiscret>}
          {peutAffecter && ['affectee', 'en_cours'].includes(m.statut) && <BoutonDiscret type="button" onClick={() => agir(() => e.modifierMission(m.id, { statut: 'close' }))}>Clore</BoutonDiscret>}
          {peutAffecter && ['affectee', 'en_cours'].includes(m.statut) && <BoutonDiscret type="button" onClick={() => agir(() => e.modifierMission(m.id, { equipe_id: null }))}>Libérer l'équipe</BoutonDiscret>}
          {peutAffecter && ['ouverte', 'affectee'].includes(m.statut) && <BoutonDiscret type="button" onClick={() => setOuvrirRaison('annulee')}>Annuler…</BoutonDiscret>}
          {peutAffecter && ['close', 'annulee'].includes(m.statut) && <BoutonDiscret type="button" onClick={() => agir(() => e.modifierMission(m.id, { statut: 'ouverte' }))}>Rouvrir</BoutonDiscret>}
          {e.droits.coordonner && m.statut === 'ouverte' && !m.sous_pc_ops && (
            <BoutonDiscret type="button" onClick={() => agir(() => e.modifierMission(m.id, { publie_besoin: !m.publie_besoin }))}>{m.publie_besoin ? 'Dépublier' : 'Publier comme besoin'}</BoutonDiscret>
          )}
        </div>
      </div>
      {ouvrirRaison && (
        <form
          onSubmit={async (ev) => {
            ev.preventDefault()
            await agir(() => e.modifierMission(m.id, { statut: ouvrirRaison, raison_statut: raison.trim() || null }))
            setOuvrirRaison(null)
          }}
          className="flex gap-2 mt-2"
        >
          <input value={raison} onChange={(ev) => setRaison(ev.target.value)} placeholder="Raison (facultative)" maxLength={500} className="w-full" />
          <BoutonPrincipal type="submit">Confirmer l'annulation</BoutonPrincipal>
          <BoutonDiscret type="button" onClick={() => setOuvrirRaison(null)}>Non</BoutonDiscret>
        </form>
      )}
      {m.type_zone === 'rouge' && m.statut === 'refusee' && peutDeroger && (
        <form
          onSubmit={async (ev) => {
            ev.preventDefault()
            await agir(() => e.modifierMission(m.id, { derogation_motif: motif.trim() }))
          }}
          className="flex gap-2 mt-2"
          aria-label="Dérogation zone rouge"
        >
          <input value={motif} onChange={(ev) => setMotif(ev.target.value)} placeholder="Motif de dérogation (Dir PC-Ops) : encadrement, danger écarté…" maxLength={500} required className="w-full" />
          <BoutonDiscret type="submit">Déroger et rouvrir</BoutonDiscret>
        </form>
      )}
    </li>
  )
}

function FormulaireMission({ e, incident, onFermer }) {
  const [v, setV] = useState({ titre: '', description: '', priorite: 'P3', nb_personnes: '', materiel_requis: '', adresse: '', point_rdv: '', latitude: '', longitude: '', competence_requise: [], publie_besoin: false })
  const [erreur, setErreur] = useState(null)
  const set = (k) => (ev) => setV((x) => ({ ...x, [k]: ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value }))
  const bascule = (c) => setV((x) => ({ ...x, competence_requise: x.competence_requise.includes(c) ? x.competence_requise.filter((y) => y !== c) : [...x.competence_requise, c] }))
  return (
    <form
      onSubmit={async (ev) => {
        ev.preventDefault()
        setErreur(null)
        const lat = v.latitude === '' ? null : Number(v.latitude)
        const lon = v.longitude === '' ? null : Number(v.longitude)
        if ((lat == null) !== (lon == null)) return setErreur('Latitude et longitude vont ensemble.')
        const r = await e.creerMission({
          titre: v.titre.trim(),
          description: v.description.trim() || null,
          priorite: v.priorite,
          nb_personnes: v.nb_personnes === '' ? null : Number(v.nb_personnes),
          materiel_requis: v.materiel_requis.trim() || null,
          adresse: v.adresse.trim() || null,
          point_rdv: v.point_rdv.trim() || null,
          latitude: lat,
          longitude: lon,
          competence_requise: v.competence_requise,
          origine_type: e.droits.coordonner ? 'cc' : 'pc_ops',
          publie_besoin: v.publie_besoin,
        })
        if (r.error) return setErreur(r.error.message)
        onFermer()
      }}
      className="border border-trait rounded p-3 bg-surface mb-3"
      aria-label="Nouvelle mission"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">Titre<input value={v.titre} onChange={set('titre')} className="w-full" required minLength={3} maxLength={160} placeholder="ex. Déblayer la rue Haute" /></label>
        <label className="text-sm sm:col-span-2">Description<textarea value={v.description} onChange={set('description')} className="w-full" rows={2} maxLength={2000} /></label>
        <label className="text-sm">Priorité<select value={v.priorite} onChange={set('priorite')} className="w-full">{PRIORITES_MISSION.map((p) => <option key={p.valeur} value={p.valeur}>{p.libelle}</option>)}</select></label>
        <label className="text-sm">Personnes nécessaires<input type="number" min={1} max={200} value={v.nb_personnes} onChange={set('nb_personnes')} className="w-full" /></label>
        <label className="text-sm">Adresse<input value={v.adresse} onChange={set('adresse')} className="w-full" maxLength={300} /></label>
        <label className="text-sm">Point de rendez-vous<input value={v.point_rdv} onChange={set('point_rdv')} className="w-full" maxLength={300} /></label>
        <label className="text-sm">Latitude<input value={v.latitude} onChange={set('latitude')} className="w-full" inputMode="decimal" placeholder={incident.latitude ?? ''} /></label>
        <label className="text-sm">Longitude<input value={v.longitude} onChange={set('longitude')} className="w-full" inputMode="decimal" placeholder={incident.longitude ?? ''} /></label>
        <label className="text-sm sm:col-span-2">Matériel requis<input value={v.materiel_requis} onChange={set('materiel_requis')} className="w-full" maxLength={300} /></label>
      </div>
      <p className="text-xs text-sourdine" style={{ margin: '6px 0 0' }}>La position sert à savoir si la mission tombe dans un périmètre d'intervention (zone rouge interdite aux bénévoles).</p>
      <fieldset style={{ border: 0, padding: 0, margin: '8px 0 0' }}>
        <legend className="text-sm">Compétences requises</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {COMPETENCES_ENTRAIDE.map((c) => (
            <label key={c.valeur} className="text-xs flex items-center gap-1"><input type="checkbox" checked={v.competence_requise.includes(c.valeur)} onChange={() => bascule(c.valeur)} />{c.libelle}</label>
          ))}
        </div>
      </fieldset>
      <label className="text-sm flex items-center gap-2 mt-2"><input type="checkbox" checked={v.publie_besoin} onChange={set('publie_besoin')} />Publier comme besoin sur la page publique de l'entraide (titre, compétences, nombre, adresse ; jamais en zone rouge)</label>
      {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}
      <div className="flex gap-2 mt-2">
        <BoutonPrincipal type="submit">Créer la mission</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onFermer}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ Moyens privés */
function MoyensPrives({ e }) {
  const { moyens, engages, incident, missions } = e.donnees
  const [recherche, setRecherche] = useState('')
  const [reference, setReference] = useState('incident')
  const [erreur, setErreur] = useState(null)
  const [requisition, setRequisition] = useState(null)
  const peut = e.droits.coordonner
  const point = useMemo(() => {
    if (reference === 'incident') return incident.latitude != null ? { lat: Number(incident.latitude), lon: Number(incident.longitude) } : null
    const m = missions.find((x) => x.id === reference)
    return m && m.latitude != null ? { lat: Number(m.latitude), lon: Number(m.longitude) } : null
  }, [reference, incident, missions])
  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return moyens
      .filter((m) => !q || `${m.nom} ${m.categorie} ${m.proprietaire_nom ?? ''} ${m.capacite ?? ''}`.toLowerCase().includes(q))
      .map((m) => ({ ...m, distance: point ? distanceKm(point.lat, point.lon, m.latitude, m.longitude) : null, engage: engages.find((x) => x.ressource_id === m.id && x.statut !== 'retire') }))
      .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9) || a.nom.localeCompare(b.nom))
  }, [moyens, engages, recherche, point])
  async function agir(fn) {
    setErreur(null)
    const r = await fn()
    if (r.error) setErreur(r.error.message)
  }
  return (
    <div>
      <p className="text-xs text-sourdine" style={{ margin: '0 0 8px' }}>
        Moyens privés du cadastre (Admin › Ressources) et déclarations des propriétaires. Activer un moyen l'inscrit dans les moyens engagés (D4) ; la réquisition formelle se génère depuis la même ligne si l'accord manque.
      </p>
      <div className="flex flex-wrap gap-2 mb-2">
        <input type="search" value={recherche} onChange={(ev) => setRecherche(ev.target.value)} placeholder="Rechercher (pelleteuse, bateau, groupe…)" aria-label="Rechercher un moyen" style={{ flex: '1 1 220px', marginBottom: 0 }} />
        <label className="text-xs">
          Distance depuis
          <select value={reference} onChange={(ev) => setReference(ev.target.value)}>
            <option value="incident">l'incident</option>
            {missions.filter((m) => m.latitude != null && !['close', 'annulee'].includes(m.statut)).map((m) => (
              <option key={m.id} value={m.id}>{m.numero} {m.titre}</option>
            ))}
          </select>
        </label>
      </div>
      {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}
      {liste.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-3">Aucun moyen privé dans le cadastre. Les propriétaires peuvent déclarer leurs moyens depuis l'app Citoyen (lien « Proposer un moyen »).</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="grid gap-2">
          {liste.map((m) => (
            <li key={m.id} data-moyen={m.nom} className="border border-trait rounded bg-surface p-3 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-encre" style={{ margin: 0 }}>
                  <b>{m.nom}</b> <span className="jeton ml-2">{m.categorie.replace(/_/g, ' ')}</span>
                  {m.statut_juridique && <span className={`jeton ml-1 ${classeDe([{ valeur: 'convention_signee', classe: 'text-ok' }, { valeur: 'requisitionnable', classe: 'text-chaud' }], m.statut_juridique)}`}>{libelleStatutJuridique(m.statut_juridique)}</span>}
                  {!m.actif && <span className="jeton ml-1 text-sourdine">Non vérifié</span>}
                  {m.engage && <span className="jeton ml-1 text-ok">Engagé · {m.engage.statut.replace('_', ' ')}</span>}
                </p>
                <p className="text-xs text-sourdine" style={{ margin: '2px 0 0' }}>
                  {m.proprietaire_nom && <>{libelleTypeProprietaire(m.proprietaire_type)} : {m.proprietaire_nom}{m.proprietaire_telephone && <> · {m.proprietaire_telephone}</>} · </>}
                  {m.capacite && <>{m.capacite} · </>}
                  {m.delai_mise_a_dispo && <>délai {m.delai_mise_a_dispo} · </>}
                  {m.distance != null ? `${m.distance.toFixed(1)} km` : 'position inconnue'}
                  {m.conditions_partage && <> · {m.conditions_partage}</>}
                </p>
              </div>
              {peut && (
                <div className="flex flex-wrap gap-2">
                  {!m.engage && <BoutonPrincipal type="button" onClick={() => agir(() => e.activerMoyen(m))}>Activer (accord obtenu)</BoutonPrincipal>}
                  <BoutonDiscret type="button" onClick={() => setRequisition(m)}>Réquisitionner…</BoutonDiscret>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {requisition && (
        <form
          onSubmit={async (ev) => {
            ev.preventDefault()
            const f = new FormData(ev.currentTarget)
            await agir(() => e.requisitionnerMoyen(requisition, { autorite_decretante: f.get('autorite'), beneficiaire: f.get('beneficiaire') || null }))
            setRequisition(null)
          }}
          className="border border-trait rounded p-3 bg-surface mt-3"
          aria-label="Réquisition"
        >
          <p className="text-sm text-encre" style={{ margin: '0 0 6px' }}>Réquisition civile : <b>{requisition.nom}</b>{requisition.proprietaire_nom && <> — {requisition.proprietaire_nom}</>}</p>
          <p className="text-xs text-sourdine" style={{ margin: '0 0 8px' }}>Crée l'acte dans Terrain · PC-Ops › Réquisitions (loi du 15 mai 2007, art. 181). L'arrêté signé reste à joindre.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">Autorité<select name="autorite" defaultValue="bourgmestre" className="w-full"><option value="bourgmestre">Bourgmestre</option><option value="gouverneur">Gouverneur</option></select></label>
            <label className="text-sm">Bénéficiaire<input name="beneficiaire" className="w-full" maxLength={200} placeholder="ex. D4, centre d'accueil" /></label>
          </div>
          <div className="flex gap-2 mt-2">
            <BoutonPrincipal type="submit">Créer la réquisition</BoutonPrincipal>
            <BoutonDiscret type="button" onClick={() => setRequisition(null)}>Annuler</BoutonDiscret>
          </div>
        </form>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ Dons et besoins, page publique */
function Dons({ e }) {
  const { besoins, collectes, consignes, incident } = e.donnees
  const peut = e.droits.coordonner
  const [erreur, setErreur] = useState(null)
  const [nouveau, setNouveau] = useState({ libelle: '', categorie: 'autre', quantite_souhaitee: '', point_collecte_id: '' })
  const [nouvelleCollecte, setNouvelleCollecte] = useState({ nom: '', adresse: '', horaires: '' })
  const [consignesForm, setConsignesForm] = useState({ message: consignes?.message ?? '', ne_pas_venir: consignes?.ne_pas_venir ?? '', publie: consignes?.publie ?? false })
  const publique = incident.est_exercice ? 'jamais (exercice)' : incident.coordinateur_benevoles !== 'aucun' && ['alerte', 'phase_active'].includes(incident.phase_cycle_vie) ? 'visible' : 'masquée (hors alerte ou phase active)'
  async function agir(fn) {
    setErreur(null)
    const r = await fn()
    if (r.error) setErreur(r.error.message)
  }
  return (
    <div>
      <p className="text-xs text-sourdine" style={{ margin: '0 0 8px' }}>
        Ce que vous publiez ici apparaît sur la page publique de l'entraide (app Citoyen, sans compte) : points d'accueil ouverts, besoins, points de collecte, consignes. Jamais de nom ni de téléphone. Page publique : <b>{publique}</b>.
      </p>
      {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}

      <h3 className="text-sm font-semibold text-encre" style={{ margin: '0 0 6px' }}>Consignes publiques</h3>
      <form
        onSubmit={async (ev) => {
          ev.preventDefault()
          await agir(() => e.enregistrerConsignes({ message: consignesForm.message.trim() || null, ne_pas_venir: consignesForm.ne_pas_venir.trim() || null, publie: consignesForm.publie }, !!consignes))
        }}
        className="border border-trait rounded p-3 bg-surface mb-4"
        aria-label="Consignes publiques"
      >
        <label className="text-sm">Message aux volontaires<textarea value={consignesForm.message} onChange={(ev) => setConsignesForm((x) => ({ ...x, message: ev.target.value }))} className="w-full" rows={2} maxLength={1500} disabled={!peut} placeholder="ex. Présentez-vous à la salle communale à partir de 8 h, bottes et gants." /></label>
        <label className="text-sm">Ne venez pas à<input value={consignesForm.ne_pas_venir} onChange={(ev) => setConsignesForm((x) => ({ ...x, ne_pas_venir: ev.target.value }))} className="w-full" maxLength={500} disabled={!peut} placeholder="ex. Rue Basse et quai de l'Ourthe (zone rouge)" /></label>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={consignesForm.publie} onChange={(ev) => setConsignesForm((x) => ({ ...x, publie: ev.target.checked }))} disabled={!peut} />Publier</label>
        {peut && <BoutonPrincipal type="submit" className="mt-2">Enregistrer les consignes</BoutonPrincipal>}
      </form>

      <h3 className="text-sm font-semibold text-encre" style={{ margin: '0 0 6px' }}>Besoins en nature ({besoins.filter((b) => b.statut === 'ouvert').length} ouverts)</h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="grid gap-2 mb-2">
        {besoins.map((b) => (
          <li key={b.id} data-besoin={b.libelle} className="border border-trait rounded bg-surface p-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-encre">
              <b>{b.libelle}</b> <span className="jeton ml-1">{libelleBesoin(b.categorie)}</span>{b.quantite_souhaitee && <> · {b.quantite_souhaitee}</>}
              {b.point_collecte_id && <> · {collectes.find((c) => c.id === b.point_collecte_id)?.nom}</>}
              <span className={`jeton ml-2 ${classeDe(STATUTS_BESOIN, b.statut)}`}>{STATUTS_BESOIN.find((s) => s.valeur === b.statut)?.libelle}</span>
              {!b.publie && <span className="jeton ml-1 text-sourdine">Non publié</span>}
            </span>
            {peut && (
              <span className="flex gap-2">
                {b.statut === 'ouvert' && <BoutonDiscret type="button" onClick={() => agir(() => e.modifierBesoin(b.id, { statut: 'couvert' }))}>Couvert</BoutonDiscret>}
                {b.statut === 'couvert' && <BoutonDiscret type="button" onClick={() => agir(() => e.modifierBesoin(b.id, { statut: 'ouvert' }))}>Rouvrir</BoutonDiscret>}
                {b.statut !== 'ferme' && <BoutonDiscret type="button" onClick={() => agir(() => e.modifierBesoin(b.id, { statut: 'ferme' }))}>Fermer</BoutonDiscret>}
                <BoutonDiscret type="button" onClick={() => agir(() => e.modifierBesoin(b.id, { publie: !b.publie }))}>{b.publie ? 'Dépublier' : 'Publier'}</BoutonDiscret>
              </span>
            )}
          </li>
        ))}
      </ul>
      {peut && (
        <form
          onSubmit={async (ev) => {
            ev.preventDefault()
            await agir(() => e.creerBesoin({ libelle: nouveau.libelle.trim(), categorie: nouveau.categorie, quantite_souhaitee: nouveau.quantite_souhaitee.trim() || null, point_collecte_id: nouveau.point_collecte_id || null, publie: true }))
            setNouveau({ libelle: '', categorie: 'autre', quantite_souhaitee: '', point_collecte_id: '' })
          }}
          className="flex flex-wrap gap-2 items-end mb-4"
          aria-label="Nouveau besoin"
        >
          <label className="text-xs">Besoin<input value={nouveau.libelle} onChange={(ev) => setNouveau((x) => ({ ...x, libelle: ev.target.value }))} required minLength={2} maxLength={160} placeholder="ex. Bottes" /></label>
          <label className="text-xs">Catégorie<select value={nouveau.categorie} onChange={(ev) => setNouveau((x) => ({ ...x, categorie: ev.target.value }))}>{CATEGORIES_BESOIN.map((c) => <option key={c.valeur} value={c.valeur}>{c.libelle}</option>)}</select></label>
          <label className="text-xs">Quantité<input value={nouveau.quantite_souhaitee} onChange={(ev) => setNouveau((x) => ({ ...x, quantite_souhaitee: ev.target.value }))} maxLength={80} placeholder="ex. 50 paires" /></label>
          <label className="text-xs">Point de collecte<select value={nouveau.point_collecte_id} onChange={(ev) => setNouveau((x) => ({ ...x, point_collecte_id: ev.target.value }))}><option value="">—</option>{collectes.filter((c) => !c.ferme_le).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></label>
          <BoutonPrincipal type="submit">Ajouter</BoutonPrincipal>
        </form>
      )}

      <h3 className="text-sm font-semibold text-encre" style={{ margin: '0 0 6px' }}>Points de collecte</h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="grid gap-2 mb-2">
        {collectes.map((c) => (
          <li key={c.id} className="border border-trait rounded bg-surface p-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-encre"><b>{c.nom}</b>{c.adresse && <> · {c.adresse}</>}{c.horaires && <> · {c.horaires}</>}{c.ferme_le ? <span className="jeton ml-2 text-sourdine">Fermé</span> : <span className="jeton ml-2 text-ok">Ouvert</span>}</span>
            {peut && !c.ferme_le && <BoutonDiscret type="button" onClick={() => agir(() => e.fermerCollecte(c.id))}>Fermer</BoutonDiscret>}
          </li>
        ))}
      </ul>
      {peut && (
        <form
          onSubmit={async (ev) => {
            ev.preventDefault()
            await agir(() => e.creerCollecte({ nom: nouvelleCollecte.nom.trim(), adresse: nouvelleCollecte.adresse.trim() || null, horaires: nouvelleCollecte.horaires.trim() || null }))
            setNouvelleCollecte({ nom: '', adresse: '', horaires: '' })
          }}
          className="flex flex-wrap gap-2 items-end"
          aria-label="Nouveau point de collecte"
        >
          <label className="text-xs">Nom<input value={nouvelleCollecte.nom} onChange={(ev) => setNouvelleCollecte((x) => ({ ...x, nom: ev.target.value }))} required minLength={2} maxLength={120} /></label>
          <label className="text-xs">Adresse<input value={nouvelleCollecte.adresse} onChange={(ev) => setNouvelleCollecte((x) => ({ ...x, adresse: ev.target.value }))} maxLength={300} /></label>
          <label className="text-xs">Horaires<input value={nouvelleCollecte.horaires} onChange={(ev) => setNouvelleCollecte((x) => ({ ...x, horaires: ev.target.value }))} maxLength={200} placeholder="ex. 8h-18h" /></label>
          <BoutonPrincipal type="submit">Ouvrir un point de collecte</BoutonPrincipal>
        </form>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ Sécurité : incidents bénévoles, paramètres */
function Securite({ e }) {
  const { presences, missions, parametres } = e.donnees
  const [liste, setListe] = useState(null)
  const [v, setV] = useState({ presence_id: '', mission_id: '', type: 'blessure', description: '' })
  const [erreur, setErreur] = useState(null)
  const peut = e.droits.coordonner || e.droits.commanderZone
  const incidentId = e.donnees.incident.id
  useEffect(() => {
    supabase.from('incidents_benevoles').select('*').eq('incident_id', incidentId).order('survenu_le', { ascending: false }).then(({ data }) => setListe(data ?? []))
  }, [incidentId, e.donnees])
  return (
    <div>
      <p className="text-xs text-sourdine" style={{ margin: '0 0 8px' }}>
        Registre des incidents survenus à des bénévoles (ajout seul : pièce pour l'assurance et la loi du 3 juillet 2005 sur les volontaires).
        {parametres?.assureur ? <> Assureur : {parametres.assureur}{parametres.police_numero && <> · police {parametres.police_numero}</>}.</> : <> Aucune assurance renseignée (Admin › Anticipation › Entraide).</>}
        {' '}Tâches interdites aux bénévoles : {(parametres?.taches_interdites ?? ['zone_rouge', 'electricite', 'eau_contaminee', 'toiture', 'tronconnage']).map((t) => t.replace(/_/g, ' ')).join(', ')}.
      </p>
      {peut && (
        <form
          onSubmit={async (ev) => {
            ev.preventDefault()
            setErreur(null)
            const r = await e.declarerIncidentBenevole({ presence_id: v.presence_id, mission_id: v.mission_id || null, type: v.type, description: v.description.trim() })
            if (r.error) return setErreur(r.error.message)
            setV({ presence_id: '', mission_id: '', type: 'blessure', description: '' })
          }}
          className="border border-trait rounded p-3 bg-surface mb-3"
          aria-label="Déclarer un incident bénévole"
        >
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-sm">Bénévole<select value={v.presence_id} onChange={(ev) => setV((x) => ({ ...x, presence_id: ev.target.value }))} className="w-full" required><option value="">—</option>{presences.map((p) => <option key={p.id} value={p.id}>{p.numero} {p.prenom} {p.nom}</option>)}</select></label>
            <label className="text-sm">Mission<select value={v.mission_id} onChange={(ev) => setV((x) => ({ ...x, mission_id: ev.target.value }))} className="w-full"><option value="">—</option>{missions.map((m) => <option key={m.id} value={m.id}>{m.numero} {m.titre}</option>)}</select></label>
            <label className="text-sm">Type<select value={v.type} onChange={(ev) => setV((x) => ({ ...x, type: ev.target.value }))} className="w-full">{TYPES_INCIDENT_BENEVOLE.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}</select></label>
            <label className="text-sm sm:col-span-3">Description<textarea value={v.description} onChange={(ev) => setV((x) => ({ ...x, description: ev.target.value }))} className="w-full" rows={2} required minLength={3} maxLength={2000} /></label>
          </div>
          {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}
          <BoutonPrincipal type="submit" className="mt-2">Enregistrer</BoutonPrincipal>
        </form>
      )}
      {liste === null ? <p className="text-sm text-sourdine">Chargement…</p> : liste.length === 0 ? <p className="text-sm text-sourdine">Aucun incident bénévole enregistré.</p> : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="grid gap-2">
          {liste.map((i) => {
            const p = presences.find((x) => x.id === i.presence_id)
            return (
              <li key={i.id} className="border border-trait rounded bg-surface p-2 text-sm">
                <b>{TYPES_INCIDENT_BENEVOLE.find((t) => t.valeur === i.type)?.libelle}</b> · {dateHeure(i.survenu_le)} · {p ? `${p.numero} ${p.prenom} ${p.nom}` : '—'}
                {i.mission_id && <> · {missions.find((m) => m.id === i.mission_id)?.numero}</>}
                <p className="text-sm text-encre" style={{ margin: '2px 0 0' }}>{i.description}</p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
