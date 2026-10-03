import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret } from '../components/Boutons'
import { supabase } from '../lib/supabase'

const STORAGE_KEY_ROLE = 'terrain_role_id_selectionne'

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
  }

  function changerDeRole() {
    setRoleId('')
    localStorage.removeItem(STORAGE_KEY_ROLE)
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="etiquette">Rôle actif</p>
          <p className="text-base font-semibold text-encre">{roleActuel?.libelle ?? '—'}</p>
        </div>
        <BoutonDiscret onClick={changerDeRole}>Changer</BoutonDiscret>
      </div>

      <IncidentActif contexteId={contexteId} roleId={roleId} />
    </div>
  )
}

function IncidentActif({ contexteId, roleId }) {
  const [incident, setIncident] = useState(null)
  const [chargement, setChargement] = useState(true)

  const charger = useCallback(async () => {
    setChargement(true)
    const { data } = await supabase
      .from('incidents')
      .select('id, nom, type_evenement, statut, degre_criticite, phase_cycle_vie')
      .eq('contexte_id', contexteId)
      .eq('statut', 'en_cours')
      .order('date_debut', { ascending: false })
      .limit(1)
      .maybeSingle()
    setIncident(data)
    setChargement(false)
  }, [contexteId])

  useEffect(() => {
    charger()
  }, [charger])

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

      <ChecklistRole incidentId={incident.id} contexteId={contexteId} roleId={roleId} />
      <SignalementRapide incidentId={incident.id} roleId={roleId} />
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
    if (existante) {
      await supabase
        .from('checklist_executions')
        .update({
          execute: !existante.execute,
          horodatage_execution: !existante.execute ? new Date().toISOString() : null,
        })
        .eq('id', existante.id)
    } else {
      await supabase.from('checklist_executions').insert({
        incident_id: incidentId,
        template_id: template.id,
        execute: true,
        horodatage_execution: new Date().toISOString(),
      })
    }
    await rafraichir()
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
  const [envoye, setEnvoye] = useState(false)
  const [erreur, setErreur] = useState(null)

  async function envoyer(e) {
    e.preventDefault()
    if (!message.trim()) return
    setEnCours(true)
    setErreur(null)

    const { data: dernier } = await supabase
      .from('livre_de_bord')
      .select('numero_ordre')
      .eq('incident_id', incidentId)
      .order('numero_ordre', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { error } = await supabase.from('livre_de_bord').insert({
      incident_id: incidentId,
      numero_ordre: (dernier?.numero_ordre ?? 0) + 1,
      message: `[Terrain] ${message.trim()}`,
    })

    setEnCours(false)
    if (error) {
      setErreur(error.message)
    } else {
      setMessage('')
      setEnvoye(true)
      setTimeout(() => setEnvoye(false), 2500)
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
        {erreur && <p className="message erreur">{erreur}</p>}
        {envoye && <p className="message">Envoyé au PC-Ops.</p>}
        <button type="submit" className="bouton-terrain principal" disabled={enCours || !message.trim()}>
          {enCours ? 'Envoi…' : 'Envoyer au PC-Ops'}
        </button>
      </form>
    </div>
  )
}
