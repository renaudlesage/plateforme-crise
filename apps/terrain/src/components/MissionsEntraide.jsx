import { useCallback, useEffect, useState } from 'react'
import { PRIORITES_MISSION, STATUTS_MISSION, ZONES_LIBELLES, classeDe, libelleCompetence, libelleStatutMission, trierMissions } from '@plateforme-crise/shared'
import { supabase } from '../lib/supabase'
import { fileEcritures } from '../lib/fileEcritures'
import { usePosition } from '../context/PositionContext'
import { BoutonDiscret, BoutonPrincipal } from './Boutons'

const ecrire = (operation) => fileEcritures.ecrireOuEmpiler(operation)
const heure = (t) => (t ? new Date(t).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' }) : '—')

/**
 * Missions d'entraide (bénévoles) sur la zone : celles qui tombent dans un périmètre d'intervention
 * sont « sous PC-Ops », donc affectées depuis ici par le Dir PC-Ops et ses directeurs, jamais par le
 * coordinateur des bénévoles. Un besoin constaté sur place devient une mission en deux gestes.
 * Les écritures passent par la file hors ligne ; la base décide des droits et des zones.
 */
export default function MissionsEntraide({ incident, contexteId, profil }) {
  const incidentId = incident.id
  const [missions, setMissions] = useState(null)
  const [equipes, setEquipes] = useState([])
  const [droits, setDroits] = useState({ zone: false, actif: false })
  const [erreur, setErreur] = useState(null)
  const [info, setInfo] = useState(null)
  const [creation, setCreation] = useState(false)
  const { position } = usePosition()

  const charger = useCallback(async () => {
    const [m, q, z, inc] = await Promise.all([
      supabase.from('missions_entraide').select('id, numero, titre, description, priorite, competence_requise, nb_personnes, materiel_requis, adresse, point_rdv, latitude, longitude, type_zone, sous_pc_ops, equipe_id, statut, raison_statut, derogation_motif, derogation_zone_rouge_par, created_at, debut_le').eq('incident_id', incidentId).in('statut', ['ouverte', 'affectee', 'en_cours', 'refusee']).order('created_at'),
      supabase.from('equipes_entraide').select('id, nom, statut, chef_libelle').eq('incident_id', incidentId).neq('statut', 'dissoute').order('numero'),
      supabase.rpc('peut_commander_zone_entraide', { p_incident_id: incidentId }),
      supabase.from('incidents').select('coordinateur_benevoles').eq('id', incidentId).maybeSingle(),
    ])
    if (m.error) setErreur(m.error.message)
    else {
      setErreur(null)
      setMissions(m.data ?? [])
    }
    setEquipes(q.data ?? [])
    setDroits({ zone: z.data === true, actif: (inc.data?.coordinateur_benevoles ?? 'aucun') !== 'aucun' })
  }, [incidentId])

  useEffect(() => {
    charger()
    const t = setInterval(charger, 30000)
    return () => clearInterval(t)
  }, [charger])

  async function agir(operation, message) {
    setErreur(null)
    setInfo(null)
    const res = await ecrire(operation)
    if (res.statut === 'refus') return setErreur(res.message)
    setInfo(res.statut === 'enfile' ? `${message} — en attente d'envoi (pas de réseau)` : message)
    await charger()
  }

  if (!droits.actif) {
    return <p className="vide text-sm">Entraide fermée pour cet incident (aucun coordinateur des bénévoles désigné par le CC).</p>
  }
  if (missions === null) return <p className="vide text-sm">Chargement…</p>

  const surZone = trierMissions(missions.filter((m) => m.sous_pc_ops))
  const horsZone = trierMissions(missions.filter((m) => !m.sous_pc_ops))

  return (
    <div className="space-y-4" data-missions-entraide>
      <div>
        <h2>Missions d'entraide sur la zone</h2>
        <p className="text-xs text-sourdine">
          {droits.zone
            ? 'Vous commandez la zone : ces missions sont affectées depuis ici, pas par le coordinateur des bénévoles. Zone rouge : interdite aux bénévoles sauf votre dérogation motivée.'
            : 'Lecture : seul le Dir PC-Ops (ou ses directeurs) affecte les missions situées dans un périmètre d’intervention.'}
        </p>
      </div>
      {erreur && <p className="message erreur" role="alert">{erreur}</p>}
      {info && <p className="message ok" role="status">{info}</p>}
      {droits.zone && !creation && <BoutonDiscret type="button" onClick={() => setCreation(true)}>+ Mission d'entraide (besoin constaté)</BoutonDiscret>}
      {creation && <FormulaireMissionTerrain incidentId={incidentId} position={position} onFermer={() => setCreation(false)} onEnvoyer={agir} />}
      {surZone.length === 0 ? (
        <p className="vide text-sm">Aucune mission d'entraide dans un périmètre d'intervention.</p>
      ) : (
        <ul className="space-y-2" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {surZone.map((m) => (
            <CarteMissionTerrain key={m.id} mission={m} equipes={equipes} peut={droits.zone} onEnvoyer={agir} />
          ))}
        </ul>
      )}
      {horsZone.length > 0 && (
        <details>
          <summary className="text-sm text-sourdine cursor-pointer">{horsZone.length} mission{horsZone.length > 1 ? 's' : ''} hors zone (coordinateur des bénévoles)</summary>
          <ul className="space-y-2 mt-2" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {horsZone.map((m) => (
              <CarteMissionTerrain key={m.id} mission={m} equipes={equipes} peut={false} onEnvoyer={agir} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function CarteMissionTerrain({ mission: m, equipes, peut, onEnvoyer }) {
  const [equipe, setEquipe] = useState(m.equipe_id ?? '')
  const [motif, setMotif] = useState('')
  const [raison, setRaison] = useState('')
  const [refus, setRefus] = useState(false)
  const maj = (champs, message) => onEnvoyer({ nature: 'update', table: 'missions_entraide', id: m.id, champs, libelle: `Mission ${m.numero} · ${message}` }, `${m.numero} : ${message}`)
  return (
    <li data-mission={m.numero} className="border border-trait rounded p-3 bg-surface">
      <p className="text-sm" style={{ margin: 0 }}>
        <span className={`jeton prio-${m.priorite}`}>{m.priorite}</span> <b>{m.numero}</b> · {m.titre}
        <span className={`jeton ml-2 ${classeDe(STATUTS_MISSION, m.statut)}`}>{libelleStatutMission(m.statut)}</span>
        {m.type_zone && <span className="jeton ml-1">{ZONES_LIBELLES[m.type_zone]}</span>}
        {m.derogation_zone_rouge_par && <span className="jeton ml-1 text-chaud">Dérogation</span>}
      </p>
      <p className="text-xs text-sourdine" style={{ margin: '2px 0 0' }}>
        {m.adresse && <>{m.adresse} · </>}{m.point_rdv && <>RDV {m.point_rdv} · </>}{m.nb_personnes && <>{m.nb_personnes} pers. · </>}
        {m.competence_requise?.length > 0 && <>{m.competence_requise.map(libelleCompetence).join(', ')} · </>}
        créée {heure(m.created_at)}{m.debut_le && <> · démarrée {heure(m.debut_le)}</>}
      </p>
      {m.description && <p className="text-sm" style={{ margin: '4px 0 0' }}>{m.description}</p>}
      {m.equipe_id && <p className="text-xs" style={{ margin: '2px 0 0' }}>Équipe : {equipes.find((q) => q.id === m.equipe_id)?.nom ?? '—'}</p>}
      {m.raison_statut && <p className="text-xs text-chaud" style={{ margin: '2px 0 0' }}>{m.raison_statut}</p>}
      {peut && (
        <div className="flex flex-wrap gap-2 mt-2">
          {['ouverte', 'affectee'].includes(m.statut) && (
            <>
              <select value={equipe} onChange={(e) => setEquipe(e.target.value)} aria-label="Équipe">
                <option value="">— équipe —</option>
                {equipes.map((q) => (
                  <option key={q.id} value={q.id}>{q.nom}{q.chef_libelle ? ` · ${q.chef_libelle}` : ''}{q.statut === 'engagee' ? ' (engagée)' : ''}</option>
                ))}
              </select>
              <BoutonPrincipal type="button" disabled={!equipe || equipe === m.equipe_id} onClick={() => maj({ equipe_id: equipe }, 'affectée')}>Affecter</BoutonPrincipal>
            </>
          )}
          {m.statut === 'affectee' && <BoutonDiscret type="button" onClick={() => maj({ statut: 'en_cours' }, 'démarrée')}>Démarrer</BoutonDiscret>}
          {['affectee', 'en_cours'].includes(m.statut) && <BoutonDiscret type="button" onClick={() => maj({ statut: 'close' }, 'close')}>Clore</BoutonDiscret>}
          {['ouverte', 'affectee'].includes(m.statut) && <BoutonDiscret type="button" onClick={() => setRefus((v) => !v)}>Refuser…</BoutonDiscret>}
        </div>
      )}
      {peut && refus && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            maj({ statut: 'annulee', raison_statut: raison.trim() || 'Refusée par le commandement de zone' }, 'refusée')
            setRefus(false)
          }}
          className="flex gap-2 mt-2"
        >
          <input value={raison} onChange={(e) => setRaison(e.target.value)} placeholder="Motif du refus" maxLength={500} />
          <BoutonDiscret type="submit">Confirmer</BoutonDiscret>
        </form>
      )}
      {peut && m.type_zone === 'rouge' && m.statut === 'refusee' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            maj({ derogation_motif: motif.trim() }, 'dérogation zone rouge')
          }}
          className="flex gap-2 mt-2"
          aria-label="Dérogation zone rouge"
        >
          <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif de dérogation (vous l'assumez)" maxLength={500} required />
          <BoutonDiscret type="submit">Déroger</BoutonDiscret>
        </form>
      )}
    </li>
  )
}

function FormulaireMissionTerrain({ incidentId, position, onFermer, onEnvoyer }) {
  const [titre, setTitre] = useState('')
  const [priorite, setPriorite] = useState('P2')
  const [nb, setNb] = useState('')
  const [rdv, setRdv] = useState('')
  const [ici, setIci] = useState(!!position)
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        await onEnvoyer(
          {
            nature: 'insert',
            table: 'missions_entraide',
            champs: {
              incident_id: incidentId,
              titre: titre.trim(),
              priorite,
              nb_personnes: nb === '' ? null : Number(nb),
              point_rdv: rdv.trim() || null,
              latitude: ici && position ? position.lat : null,
              longitude: ici && position ? position.lon : null,
              origine_type: 'pc_ops',
            },
            libelle: `Mission d'entraide · ${titre.trim()}`,
          },
          'Mission créée (le coordinateur et le CC sont prévenus)'
        )
        onFermer()
      }}
      className="border border-trait rounded p-3 bg-surface space-y-2"
      aria-label="Mission d'entraide depuis le terrain"
    >
      <label className="text-sm">Besoin<input value={titre} onChange={(e) => setTitre(e.target.value)} required minLength={3} maxLength={160} placeholder="ex. 6 personnes pour sacs de sable, pont de Logne" className="w-full" /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">Priorité<select value={priorite} onChange={(e) => setPriorite(e.target.value)} className="w-full">{PRIORITES_MISSION.map((p) => <option key={p.valeur} value={p.valeur}>{p.libelle}</option>)}</select></label>
        <label className="text-sm">Personnes<input type="number" min={1} max={200} value={nb} onChange={(e) => setNb(e.target.value)} className="w-full" /></label>
      </div>
      <label className="text-sm">Point de rendez-vous<input value={rdv} onChange={(e) => setRdv(e.target.value)} maxLength={300} className="w-full" /></label>
      <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={ici} onChange={(e) => setIci(e.target.checked)} disabled={!position} />Lieu = ma position{position ? '' : ' (position inconnue)'}</label>
      <div className="flex gap-2">
        <BoutonPrincipal type="submit">Créer la mission</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onFermer}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
