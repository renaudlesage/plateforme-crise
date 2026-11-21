import { useState } from 'react'
import CarteCrise from './CarteCrise.jsx'
import { SOMMETS_MAX_CONTOUR, distanceM, libelleSurface, problemeContour, surfaceContourM2 } from './geo.js'

const CENTRE_BELGIQUE = { lat: 50.5039, lon: 4.4699 }

/**
 * Tracé d'un contour en touchant les coins sur la carte (périmètre non circulaire posé sur le terrain).
 * On touche les coins dans l'ordre du tour (rond-point, carrefour, pont…) ; le contour se ferme tout seul
 * entre le dernier et le premier coin. « Retirer le dernier coin » et « Tout effacer » corrigent ; « Ma position »
 * ajoute la position de l'appareil comme coin.
 *
 * @param {Array<{lat:number, lon:number}>} sommets
 * @param {(sommets: Array<{lat:number, lon:number}>) => void} onChange
 * @param {string} [couleur]
 * @param {Array} [cercles] - zones déjà posées, en repère
 */
export default function SelecteurContour({ sommets, onChange, couleur = '#c0392b', centreDefaut = CENTRE_BELGIQUE, zoomDefaut = 15, hauteur = '320px', cercles = [] }) {
  const ajouter = (p) => {
    if (sommets.length >= SOMMETS_MAX_CONTOUR) return
    // Un toucher sur le premier coin (moins de 8 m) ne rajoute rien : le contour est déjà fermé.
    if (sommets.length >= 3 && distanceM(p, sommets[0]) < 12) return
    onChange([...sommets, { lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6) }])
  }
  const maPosition = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((p) => ajouter({ lat: p.coords.latitude, lon: p.coords.longitude }), () => {}, { enableHighAccuracy: true, timeout: 15000 })
  }

  const apercu =
    sommets.length >= 3
      ? [{ id: 'contour-en-cours', contour: sommets.map((s) => [s.lat, s.lon]), couleur, enCours: true, lat: sommets[0].lat, lon: sommets[0].lon, rayonM: 0 }]
      : []
  const ligne = sommets.length === 2 ? [{ id: 'contour-en-cours-ligne', points: sommets.map((s) => [s.lat, s.lon]), couleur }] : []
  // Centre figé au montage : la carte ne doit pas bouger sous le doigt à chaque coin posé.
  const [centre] = useState(() => (sommets.length ? sommets[0] : centreDefaut))
  const probleme = sommets.length ? problemeContour(sommets) : null
  const surface = sommets.length >= 3 ? surfaceContourM2(sommets) : 0

  return (
    <div>
      <CarteCrise
        centre={centre}
        zoom={zoomDefaut}
        cercles={[...cercles, ...apercu]}
        traces={ligne}
        sommets={sommets.map((s) => [s.lat, s.lon])}
        onClicCarte={ajouter}
        hauteur={hauteur}
        messagePleinEcran={`Touchez les coins dans l'ordre du tour (${sommets.length} posé${sommets.length > 1 ? 's' : ''})`}
      />
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <button type="button" className="discret" onClick={() => onChange(sommets.slice(0, -1))} disabled={!sommets.length}>
          Retirer le dernier coin
        </button>
        <button type="button" className="discret" onClick={() => onChange([])} disabled={!sommets.length}>
          Tout effacer
        </button>
        <button type="button" className="discret" onClick={maPosition} disabled={sommets.length >= SOMMETS_MAX_CONTOUR}>
          Ma position comme coin
        </button>
      </div>
      <p className="text-xs text-sourdine mt-1" aria-live="polite">
        {sommets.length} coin{sommets.length > 1 ? 's' : ''}
        {surface > 0 && ` · ${libelleSurface(surface)}`}
        {' · '}touchez les coins dans l&apos;ordre du tour ; le contour se ferme seul.
      </p>
      {probleme && sommets.length > 0 && <p className="text-xs text-chaud mt-1">{probleme}</p>}
    </div>
  )
}

