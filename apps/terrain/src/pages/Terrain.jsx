import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret } from '../components/Boutons'
import VeilleMeteo from '../components/VeilleMeteo'
import { BandeauAppelsAide, DemandesATraiter, VueCommandement } from '../components/Commandement'
import { supabase } from '../lib/supabase'
import { fileEcritures } from '../lib/fileEcritures'
import { useIncidentsEnCours, SelecteurIncident } from '../hooks/useIncidentsEnCours'
import { Link } from 'react-router-dom'
import { BoutonAide, PanneauPosition, AutourDeMoi, Passation } from '../components/OutilsPosition'
import { RapportCan, PhotoGeo, ComptagePersonnes } from '../components/OutilsRapport'
import { usePosition } from '../context/PositionContext'

const STORAGE_KEY_ROLE = 'terrain_role_id_selectionne'
// Libellé du rôle, lu par le partage de position et les rapports (voir PositionContext)
const STORAGE_KEY_ROLE_LIBELLE = 'terrain_role_libelle'

const LIBELLE_PHASE_CYCLE_VIE = {
  veille: 'Veille',
  vigilance: 'Vigilance',
  pre_alerte: 'Pré-alerte',
  alerte: 'Alerte',
  phase_active: 'Phase active',
  levee: 'Levée',
  post_crise: 'Post-crise',
}

export default function Terrain() {
  const { contexteId } = useAuth()
  const { lignes: roles, chargement: chargementRoles } = useTableContexte('roles', contexteId, { tri: 'libelle' })

  const [roleId, setRoleId] = useState(() => localStorage.getItem(STORAGE_KEY_ROLE) || '')

  function choisirRole(id) {
    setRoleId(id)
    localStorage.setItem(STORAGE_KEY_ROLE, id)
    const libelle = roles.find((r) => r.id === id)?.libelle
    if (libelle) localStorage.setItem(STORAGE_KEY_ROLE_LIBELLE, libelle)
  }

  function changerDeRole() {
    setRoleId('')
    localStorage.removeItem(STORAGE_KEY_ROLE)
    localStorage.removeItem(STORAGE_KEY_ROLE_LIBELLE)
  }

  if (chargementRoles) {
    return <p className="vide text-center mt-10">Chargement…</p>
  }

  if (!roleId) {
    return (
      <div>
        <h1 className="text-lg font-semibold text-encre mb-1">Qui êtes-vous ?</h1>
        <p className="text-sm text-sourdine mb-4">Sélectionnez votre rôle pour cette intervention.</p>
        {roles.length === 0 ? (
          <p className="vide border border-dashed border-trait text-center p-6">
            Aucun rôle défini pour ce contexte (à créer dans l'app Admin).
          </p>
        ) : (
          <div className="space-y-2">
            {roles.map((r) => (
              <button key={r.id} onClick={() => choisirRole(r.id)} className="bouton-terrain discret">
                {r.libelle}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const roleActuel = roles.find((r) => r.id === roleId)
  // Rôle choisi avant l'ajout du libellé mémorisé : on le complète une fois
  if (roleActuel?.libelle && localStorage.getItem(STORAGE_KEY_ROLE_LIBELLE) !== roleActuel.libelle) {
    localStorage.setItem(STORAGE_KEY_ROLE_LIBELLE, roleActuel.libelle)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="etiquette">Rôle actif</p>
          <p className="text-base font-semibold text-encre">{roleActuel?.libelle ?? '—'}</p>
        </div>
        <BoutonDiscret onClick={changerDeRole}>Changer</BoutonDiscret>
      </div>

      <IncidentActif contexteId={contexteId} roleId={roleId} roleLibelle={roleActuel?.libelle ?? null} />
    </div>
  )
}

const ONGLETS_TERRAIN = [
  { cle: 'commandement', libelle: 'Commandement' },
  { cle: 'mission', libelle: 'Mission' },
  { cle: 'rapport', libelle: 'Rapport' },
  { cle: 'position', libelle: 'Ma position' },
  { cle: 'passation', libelle: 'Passation' },
]

function IncidentActif({ contexteId, roleId, roleLibelle }) {
  const { incidents, incident, choisir, chargement } = useIncidentsEnCours(contexteId)
  const { dansZoneRouge } = usePosition()
  // Le Dir PC-Ops (ou tout rôle PC-Ops) ouvre directement sur la vue de commandement
  const [onglet, setOnglet] = useState(() => (/pc.?ops/i.test(roleLibelle ?? '') ? 'commandement' : 'mission'))

  if (chargement) return <p className="vide text-center mt-6">Chargement…</p>

  if (!incident) {
    return (
      <p className="vide border border-dashed border-trait text-center p-6">
        Aucun incident en cours pour ce contexte actuellement.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <SelecteurIncident incidents={incidents} incident={incident} onChoisir={choisir} />
      <BandeauAppelsAide incidentId={incident.id} />
      <div className="bandeau-alerte niv-urgence">
        <div className="niv">Incident</div>
        <div className="contenu">
          <p className="consigne">
            {incident.nom}
            {incident.degre_criticite != null && (
              <span className="jeton text-chaud ml-2">degré {incident.degre_criticite}</span>
            )}
            {incident.phase_cycle_vie && (
              <span className="jeton ml-2">{LIBELLE_PHASE_CYCLE_VIE[incident.phase_cycle_vie] ?? incident.phase_cycle_vie}</span>
            )}
          </p>
          {incident.type_evenement && <p className="msg">{incident.type_evenement}</p>}
        </div>
      </div>

      {dansZoneRouge && (
        <div className="message erreur" role="alert">
          ⚠ Vous êtes dans la zone ROUGE (exclusion). Réservée aux services d'intervention, experts et techniciens.
        </div>
      )}

      <BoutonAide incidentId={incident.id} contexteId={contexteId} roleLibelle={roleLibelle} />

      <Link to="/situation" className="bouton-terrain principal">
        Voir la situation (Comité de Coordination)
      </Link>

      {onglet !== 'commandement' && <DemandesATraiter incidentId={incident.id} masquerSiVide />}

      <VeilleMeteo compact />

      <div className="onglets" role="tablist">
        {ONGLETS_TERRAIN.map((o) => (
          <button key={o.cle} type="button" role="tab" aria-selected={onglet === o.cle} className={`module${onglet === o.cle ? ' actif' : ''}`} onClick={() => setOnglet(o.cle)}>
            {o.libelle}
          </button>
        ))}
      </div>

      {onglet === 'commandement' && <VueCommandement incident={incident} />}

      {onglet === 'mission' && (
        <div className="space-y-6">
          <ChecklistRole incidentId={incident.id} contexteId={contexteId} roleId={roleId} />
          <SignalementRapide incidentId={incident.id} roleId={roleId} />
        </div>
      )}

      {onglet === 'rapport' && (
        <div className="space-y-6">
          <div>
            <h2>Rapport au CC (C.A.N.)</h2>
            <RapportCan incidentId={incident.id} contexteId={contexteId} roleLibelle={roleLibelle} />
          </div>
          <div>
            <h2>Photo géolocalisée</h2>
            <PhotoGeo incidentId={incident.id} contexteId={contexteId} />
          </div>
          <div>
            <h2>Comptage de personnes</h2>
            <ComptagePersonnes incidentId={incident.id} contexteId={contexteId} />
          </div>
        </div>
      )}

      {onglet === 'position' && (
        <div className="space-y-6">
          <div>
            <h2>Ma position</h2>
            <PanneauPosition />
          </div>
          <div>
            <h2>Autour de moi</h2>
            <AutourDeMoi />
          </div>
        </div>
      )}

      {onglet === 'passation' && (
        <div>
          <h2>Fiche de passation</h2>
          <Passation incident={incident} roleLibelle={roleLibelle} />
        </div>
      )}
    </div>
  )
}

function ChecklistRole({ incidentId, contexteId, roleId }) {
  const [templates, setTemplates] = useState([])
  const [executions, setExecutions] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const [tplRes, execRes] = await Promise.all([
      supabase
        .from('checklist_templates')
        .select('*')
        .eq('contexte_id', contexteId)
        .eq('role_id', roleId)
        .order('ordre'),
      supabase.from('checklist_executions').select('*').eq('incident_id', incidentId),
    ])
    if (tplRes.error) setErreur(tplRes.error.message)
    else setTemplates(tplRes.data ?? [])
    if (execRes.error) setErreur(execRes.error.message)
    else setExecutions(execRes.data ?? [])
    setChargement(false)
  }, [contexteId, incidentId, roleId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function basculer(template) {
    const existante = executions.find((e) => e.template_id === template.id)

    // Debout, une main, deux gestes maximum — et ça doit survivre à une
    // coupure réseau sans que la case se décoche en silence. Voir
    // packages/shared/src/fileEcritures.js : écrit d'abord dans le
    // téléphone (optimiste), envoie ensuite, rejoue si besoin.
    if (existante) {
      const champs = {
        execute: !existante.execute,
        horodatage_execution: !existante.execute ? new Date().toISOString() : null,
      }
      setExecutions((prev) => prev.map((e) => (e.id === existante.id ? { ...e, ...champs } : e)))
      const { statut, message } = await fileEcritures.ecrireOuEmpiler({
        nature: 'update',
        table: 'checklist_executions',
        id: existante.id,
        champs,
        libelle: `Checklist · ${template.libelle}`,
      })
      if (statut === 'refus') {
        // Refus immédiat (droits, ligne disparue) : l'optimisme ci-dessus
        // était injustifié, on revient en arrière et on le dit.
        setExecutions((prev) => prev.map((e) => (e.id === existante.id ? existante : e)))
        setErreur(message)
        return
      }
    } else {
      const champs = {
        incident_id: incidentId,
        template_id: template.id,
        execute: true,
        horodatage_execution: new Date().toISOString(),
      }
      const { statut, cle, message } = await fileEcritures.ecrireOuEmpiler({
        nature: 'insert',
        table: 'checklist_executions',
        champs,
        libelle: `Checklist · ${template.libelle}`,
      })
      if (statut === 'refus') {
        setErreur(message)
        return
      }
      // Optimiste, avec le même id que la ligne qui finira en base
      // (immédiatement ou après rejeu) — la case reste cochée à l'écran
      // même hors réseau.
      setExecutions((prev) => [...prev, { id: cle, ...champs }])
    }
    // Pas de rafraichir() ici : l'état optimiste ci-dessus est déjà ce
    // qu'on veut afficher, y compris hors réseau — un rechargement
    // échouerait silencieusement à ce moment précis et n'ajouterait
    // rien, et sur un refus RLS (le seul cas où erreur est affichée)
    // la ligne refusée ci-dessus n'a de toute façon pas été optimisée.
  }

  const executionParTemplate = Object.fromEntries(executions.map((e) => [e.template_id, e]))

  return (
    <div>
      <h2>Ma checklist</h2>
      {erreur && <p className="message erreur mb-2">{erreur}</p>}
      {chargement ? (
        <p className="vide">Chargement…</p>
      ) : templates.length === 0 ? (
        <p className="vide border border-dashed border-trait text-center p-4">
          Aucune action prévue pour votre rôle.
        </p>
      ) : (
        <ul className="space-y-2">
          {templates.map((t) => {
            const exec = executionParTemplate[t.id]
            const fait = exec?.execute ?? false
            return (
              <li key={t.id}>
                <button
                  onClick={() => basculer(t)}
                  className={`carte w-full text-left flex items-start gap-3 ${fait ? 'a-moi' : ''}`}
                >
                  <span className={`case flex-shrink-0 ${fait ? 'active' : ''}`} style={{ width: 22, height: 22 }}>
                    {fait ? '✓' : ''}
                  </span>
                  <span className={`text-sm ${fait ? 'text-sourdine line-through' : 'text-encre'}`}>
                    {t.libelle}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function SignalementRapide({ incidentId }) {
  const [message, setMessage] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [res, setRes] = useState(null)

  async function envoyer(e) {
    e.preventDefault()
    if (!message.trim()) return
    setEnCours(true)
    // Écrit d'abord dans le téléphone, envoie ensuite : le numéro d'ordre du journal est attribué par le serveur.
    const r = await fileEcritures.ecrireOuEmpiler({
      nature: 'insert',
      table: 'livre_de_bord',
      champs: { incident_id: incidentId, message: `[Terrain] ${message.trim()}` },
      libelle: 'Signalement au PC-Ops',
    })
    setEnCours(false)
    setRes(r)
    if (r.statut !== 'refus') {
      setMessage('')
      setTimeout(() => setRes(null), 4000)
    }
  }

  return (
    <div>
      <h2>Signaler quelque chose</h2>
      <form onSubmit={envoyer} className="space-y-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ce que vous constatez sur place…"
          rows={3}
          className="w-full"
        />
        {res?.statut === 'refus' && <p className="message erreur">{res.message}</p>}
        {res?.statut === 'enfile' && <p className="message">Enregistré sur l'appareil : part dès le retour du réseau.</p>}
        {res && res.statut !== 'refus' && res.statut !== 'enfile' && <p className="message">Envoyé au PC-Ops.</p>}
        <button type="submit" className="bouton-terrain principal" disabled={enCours || !message.trim()}>
          {enCours ? 'Envoi…' : 'Envoyer au PC-Ops'}
        </button>
      </form>
    </div>
  )
}
