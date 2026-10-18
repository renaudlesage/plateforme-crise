import { Link } from 'react-router-dom'
import { aleasDepuisTypeEvenement, choisirSourcesUtiles, libelleAleaSituation } from '@plateforme-crise/shared'
import Repliable from './Repliable'
import TuileSource from './TuileSource'
import { useSituation } from '../hooks/useSituation'

/**
 * Sources de veille proposées pour un incident : 3 à 5 liens choisis selon l'aléa (celles de la commune d'abord).
 * Anti-surcharge : jamais plus de 5, liens sortants, rien d'automatique. Sur un incident d'exercice le bloc reste
 * en lecture : aucune vérification n'y est enregistrée.
 */
export function BlocSourcesUtiles({ incident, situation, maintenant = Date.now() }) {
  if (situation.sources === null) return <p className="text-sm text-sourdine">Chargement…</p>
  const aleas = aleasDepuisTypeEvenement(incident.type_evenement)
  const choisies = choisirSourcesUtiles(situation.sources, aleas)

  return (
    <div>
      <p className="text-xs text-sourdine mb-2">
        {aleas.length > 0
          ? `Aléa retenu : ${aleas.map(libelleAleaSituation).join(', ')}.`
          : "Type d'incident non rattaché à un aléa connu : sources générales seulement."}{' '}
        Liens sortants, ouverts dans un nouvel onglet.
      </p>
      {situation.erreur && <p role="alert" className="text-sm text-chaud mb-2">{situation.erreur}</p>}
      {incident.est_exercice && (
        <p role="note" className="text-xs text-sourdine mb-2">
          Incident d'exercice : lecture seule, aucune vérification n'est enregistrée.
        </p>
      )}
      {choisies.length === 0 ? (
        <p className="text-sm text-sourdine">
          Aucune source liée à cet aléa. Elles se règlent dans l'administration (Anticipation › Sources de situation).
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {choisies.map((s) => (
            <TuileSource
              key={s.id}
              source={s}
              compact
              epinglee={situation.epinglee(s)}
              verification={situation.verifications[s.id]}
              peutVerifier={situation.peutVerifier}
              lectureSeule={incident.est_exercice === true}
              incidentId={incident.id}
              maintenant={maintenant}
              onEpingler={situation.basculerEpingle}
              onVu={situation.marquerVu}
            />
          ))}
        </div>
      )}
      <p className="text-sm mt-3" style={{ marginBottom: 0 }}>
        <Link to="/situation" className="text-sourdine hover:text-encre">Toute la veille sociétale →</Link>
      </p>
    </div>
  )
}

function ContenuSourcesUtiles({ incident, contexteId }) {
  const situation = useSituation(contexteId)
  return <BlocSourcesUtiles incident={incident} situation={situation} />
}

const PHASES_REPONSE = ['alerte', 'phase_active']

/** Bloc replié de l'onglet Pilotage d'un incident ; ouvert d'emblée seulement pendant la réponse. Les données ne sont lues qu'à l'ouverture. */
export default function SourcesUtilesIncident({ incident, contexteId }) {
  return (
    <Repliable
      titre="Sources utiles à la veille"
      aide="3 à 5 sources officielles selon l'aléa (hydrométrie, météo, radioactivité…), en liens sortants."
      ouvertParDefaut={PHASES_REPONSE.includes(incident.phase_cycle_vie)}
    >
      <ContenuSourcesUtiles incident={incident} contexteId={contexteId} />
    </Repliable>
  )
}
