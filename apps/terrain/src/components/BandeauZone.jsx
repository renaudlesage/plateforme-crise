import { ilYA, libelleDistance } from '@plateforme-crise/shared'
import { usePosition } from '../context/PositionContext'

/**
 * Bandeau de géo-barrière, affiché partout où l'intervenant regarde (mission, outils de position) :
 *  - approche d'une zone rouge : orange, distance au bord ;
 *  - dans une zone rouge : rouge.
 * Dit aussi si les zones sont celles du cache (réseau tombé) et si le franchissement a été transmis au CC.
 * Rien n'est affiché hors de toute zone : pas de bruit.
 */
export default function BandeauZone() {
  const { actif, geoBarriere, zonesHorsLigne, zonesDepuis, partage, journalisation } = usePosition()
  if (!actif || geoBarriere.etat === 'hors') return null
  const dedans = geoBarriere.etat === 'dedans'
  return (
    <div className={`message ${dedans ? 'erreur zone-dedans' : 'veille zone-approche'}`} role="alert" aria-live="assertive">
      {dedans ? (
        <>⛔ Vous êtes dans la zone ROUGE (exclusion). Réservée aux services d'intervention, experts et techniciens.</>
      ) : (
        <>⚠ Zone ROUGE à {libelleDistance(Math.max(0, geoBarriere.distanceBord))}. N'entrez pas sans ordre du PC-Ops.</>
      )}
      <div className="text-xs font-normal mt-1 text-sourdine">
        {zonesHorsLigne && zonesDepuis && <span>Zones connues {ilYA(zonesDepuis)} (réseau indisponible). </span>}
        {dedans && partage && journalisation?.nature === 'entree' && (
          <span>
            {journalisation.statut === 'ok' && 'Entrée transmise au CC.'}
            {journalisation.statut === 'enfile' && 'Entrée enregistrée, sera transmise au CC au retour du réseau.'}
            {journalisation.statut === 'refus' && 'Entrée non transmise au CC (refusée).'}
          </span>
        )}
        {dedans && !partage && <span>Le CC n'en est pas informé : partage de position désactivé.</span>}
      </div>
    </div>
  )
}
