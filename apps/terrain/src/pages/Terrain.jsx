import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonPrincipal, BoutonDiscret } from '../components/Boutons'
import { supabase } from '../lib/supabase'

const STORAGE_KEY_ROLE = 'terrain_role_id_selectionne'

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
    return <p className="text-sm text-slate-400 text-center mt-10">Chargement…</p>
  }

  if (!roleId) {
    return (
      <div>
        <h1 className="text-lg font-semibold text-slate-900 mb-1">Qui êtes-vous ?</h1>
        <p className="text-sm text-slate-500 mb-4">Sélectionnez votre rôle pour cette intervention.</p>
        {roles.length === 0 ? (
          <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
            Aucun rôle défini pour ce contexte (à créer dans l'app Admin).
          </p>
        ) : (
          <div className="space-y-2">
            {roles.map((r) => (
              <button
                key={r.id}
                onClick={() => choisirRole(r.id)}
                className="w-full text-left bg-white border border-slate-200 rounded-lg px-4 py-4 text-base font-medium text-slate-900 active:bg-slate-100"
              >
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
          <p className="text-xs text-slate-500">Rôle actif</p>
          <p className="text-base font-semibold text-slate-900">{roleActuel?.libelle ?? '—'}</p>
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
      .select('id, nom, type_evenement, statut')
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

  if (chargement) return <p className="text-sm text-slate-400 text-center mt-6">Chargement…</p>

  if (!incident) {
    return (
      <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
        Aucun incident en cours pour ce contexte actuellement.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
        <p className="text-sm font-medium text-red-800">{incident.nom}</p>
        {incident.type_evenement && <p className="text-xs text-red-600">{incident.type_evenement}</p>}
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
      <h2 className="text-sm font-semibold text-slate-700 mb-2">Ma checklist</h2>
      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}
      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-4 text-center">
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
                  className={`w-full text-left flex items-start gap-3 rounded-lg border px-4 py-3 active:bg-slate-100 ${
                    fait ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'
                  }`}
                >
                  <span
                    className={`flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center text-xs ${
                      fait ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'
                    }`}
                  >
                    {fait ? '✓' : ''}
                  </span>
                  <span className={`text-sm ${fait ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
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
      <h2 className="text-sm font-semibold text-slate-700 mb-2">Signaler quelque chose</h2>
      <form onSubmit={envoyer} className="space-y-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ce que vous constatez sur place…"
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        {envoye && <p className="text-sm text-emerald-600">Envoyé au PC-Ops.</p>}
        <BoutonPrincipal type="submit" disabled={enCours || !message.trim()}>
          {enCours ? 'Envoi…' : 'Envoyer au PC-Ops'}
        </BoutonPrincipal>
      </form>
    </div>
  )
}
