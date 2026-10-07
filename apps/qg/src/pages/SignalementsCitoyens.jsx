import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret } from '../components/Boutons'

const LIBELLE_TYPE = {
  route_coupee: 'Route coupée / inondée',
  inondation: 'Inondation',
  degats_materiels: 'Dégâts matériels',
  personne_isolee: 'Personne isolée / en danger',
  danger: 'Danger immédiat',
  autre: 'Autre',
}

const LIBELLE_STATUT = {
  recu: 'Reçu',
  pris_en_charge: 'Pris en charge',
  en_cours: 'Intervention en cours',
  clos: 'Clôturé',
  sans_suite: 'Classé sans suite',
}

const SUITE_POSSIBLE = {
  recu: ['pris_en_charge', 'sans_suite'],
  pris_en_charge: ['en_cours', 'clos'],
  en_cours: ['clos'],
  clos: [],
  sans_suite: [],
}

/**
 * Vue PC-Ops/CC des signalements remontés sans compte par les riverains
 * (apps/citoyen, page Signaler). Port du principe "conversion en
 * mission" d'Eventware — ici une simple progression de statut, sans
 * conversion automatique en incident (à faire à la main si pertinent).
 */
export default function SignalementsCitoyens() {
  const { contexteId } = useAuth()
  const {
    lignes: signalements,
    chargement,
    erreur,
    modifier,
  } = useTableContexte('signalements_citoyens', contexteId, { tri: 'recu_le' })

  const tries = [...signalements].sort((a, b) => new Date(b.recu_le) - new Date(a.recu_le))
  const ouverts = tries.filter((s) => !['clos', 'sans_suite'].includes(s.statut))
  const clotures = tries.filter((s) => ['clos', 'sans_suite'].includes(s.statut))

  async function changerStatut(s, statut) {
    const champs = { statut }
    if (statut === 'pris_en_charge' && !s.pris_en_charge_le) {
      champs.pris_en_charge_le = new Date().toISOString()
    }
    await modifier(s.id, champs)
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-encre mb-1">Signalements citoyens</h1>
      <p className="text-sm text-sourdine mb-4">
        Remontés sans compte depuis l'app Citoyen (QR/lien public). Position GPS ou lieu
        décrit par le riverain lui-même.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : (
        <>
          <h2 className="text-sm font-medium text-encre mb-2">
            En cours ({ouverts.length})
          </h2>
          {ouverts.length === 0 ? (
            <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center mb-6">
              Aucun signalement ouvert pour l'instant.
            </p>
          ) : (
            <ul className="divide-y divide-trait border border-trait rounded overflow-hidden mb-6">
              {ouverts.map((s) => (
                <li key={s.id} className="px-4 py-3 bg-surface">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-encre">
                        {LIBELLE_TYPE[s.type] ?? s.type}
                        <span className="jeton ml-2 font-mono text-sourdine">{s.reference}</span>
                        <span className="jeton ml-2 text-veille">{LIBELLE_STATUT[s.statut]}</span>
                      </p>
                      {s.description && <p className="text-sm text-sourdine mt-0.5">{s.description}</p>}
                      <p className="text-xs text-sourdine mt-1">
                        {s.lieu_libre ? `${s.lieu_libre} · ` : ''}
                        {s.latitude != null && s.longitude != null && (
                          <span className="font-mono">
                            {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)} ·{' '}
                          </span>
                        )}
                        reçu le {new Date(s.recu_le).toLocaleString('fr-BE')}
                        {s.contact && <> · rappel : {s.contact}</>}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {SUITE_POSSIBLE[s.statut]?.map((suivant) => (
                        <BoutonDiscret key={suivant} onClick={() => changerStatut(s, suivant)}>
                          {LIBELLE_STATUT[suivant]}
                        </BoutonDiscret>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {clotures.length > 0 && (
            <>
              <h2 className="text-sm font-medium text-sourdine mb-2">
                Clôturés ({clotures.length})
              </h2>
              <ul className="divide-y divide-trait border border-trait rounded overflow-hidden opacity-70">
                {clotures.map((s) => (
                  <li key={s.id} className="px-4 py-2.5 bg-surface flex items-center justify-between">
                    <span className="text-sm text-encre">
                      {LIBELLE_TYPE[s.type] ?? s.type}
                      <span className="jeton ml-2 font-mono text-sourdine">{s.reference}</span>
                    </span>
                    <span className="jeton text-sourdine">{LIBELLE_STATUT[s.statut]}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
