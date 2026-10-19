import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ListeJournal from '../components/ListeJournal'
import { PHASES_CYCLE_VIE, TYPES_CLIENT, dateHeure } from '../lib/libelles'

/** Vue d'ensemble de la plateforme : clients, comptes, incidents en cours, dernières actions. */
export default function Supervision() {
  const [stats, setStats] = useState(null)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    supabase.rpc('plateforme_statistiques').then(({ data, error }) => {
      if (error) setErreur(error.message)
      else setStats(data)
    })
  }, [])

  if (erreur) return <p className="text-sm text-chaud">{erreur}</p>
  if (!stats) return <p className="text-sm text-sourdine">Chargement…</p>

  const parType = Object.entries(stats.clients_par_type ?? {})
    .map(([t, n]) => `${n} ${(TYPES_CLIENT.find((x) => x.valeur === t)?.libelle ?? t).toLowerCase()}`)
    .join(' · ')
  const incidents = stats.incidents_actifs ?? []
  const reels = incidents.filter((i) => !i.est_exercice)

  return (
    <div>
      <h1 className="text-xl font-semibold text-encre mb-1">Supervision</h1>
      <p className="text-sm text-sourdine mb-4">État de la plateforme, tous clients confondus.</p>

      <div className="tuiles sm:grid-cols-4">
        <Tuile libelle="Clients" valeur={stats.nb_clients} detail={parType || 'aucun'} />
        <Tuile
          libelle="Clients suspendus"
          valeur={stats.nb_clients_suspendus}
          chaude={stats.nb_clients_suspendus > 0}
        />
        <Tuile
          libelle="Clients sans admin"
          valeur={stats.nb_clients_sans_admin}
          detail="à qui inviter un administrateur"
          chaude={stats.nb_clients_sans_admin > 0}
        />
        <Tuile
          libelle="Incidents en cours"
          valeur={reels.length}
          detail={incidents.length > reels.length ? `+ ${incidents.length - reels.length} exercice(s)` : 'hors exercices'}
          chaude={reels.length > 0}
        />
        <Tuile libelle="Comptes" valeur={stats.nb_utilisateurs} />
        <Tuile libelle="Actifs (30 j)" valeur={stats.nb_utilisateurs_actifs_30j} detail="connectés sur 30 jours" />
        <Tuile libelle="Invitations en attente" valeur={stats.nb_invitations_en_attente} detail="jamais connectés" />
        <Tuile
          libelle="Comptes sans accès"
          valeur={stats.nb_utilisateurs_sans_acces}
          detail="rattachés à aucun client"
          chaude={stats.nb_utilisateurs_sans_acces > 0}
        />
      </div>

      <h2 className="font-medium text-encre mt-6 mb-2">Incidents en cours</h2>
      {incidents.length === 0 ? (
        <p className="vide border border-dashed border-trait text-center p-4">Aucun incident ouvert sur la plateforme.</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {incidents.map((i) => (
            <li key={i.id} className="px-4 py-2.5 flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm text-encre">
                <strong>{i.nom}</strong>{' '}
                <Link to={`/clients/${i.contexte_id}`} className="lien text-xs">{i.contexte_nom}</Link>
                {i.est_exercice && <span className="jeton ml-2 text-info">exercice</span>}
                {i.degre_criticite && <span className="jeton ml-2 text-chaud">criticité {i.degre_criticite}</span>}
              </p>
              <p className="text-xs text-sourdine">
                {PHASES_CYCLE_VIE[i.phase_cycle_vie] ?? i.statut} · depuis le {dateHeure(i.date_debut)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between mt-6 mb-2">
        <h2 className="font-medium text-encre">Dernières actions</h2>
        <Link to="/journal" className="lien text-sm">Tout le journal</Link>
      </div>
      <ListeJournal limite={8} />
    </div>
  )
}

function Tuile({ libelle, valeur, detail, chaude = false }) {
  return (
    <div className={`tuile${chaude ? ' chaude' : ''}`}>
      <span className="tuile-libelle">{libelle}</span>
      <span className="tuile-valeur">{valeur ?? '—'}</span>
      {detail && <span className="tuile-detail">{detail}</span>}
    </div>
  )
}
