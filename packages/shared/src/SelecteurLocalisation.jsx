import { useState } from 'react'
import CarteCrise from './CarteCrise.jsx'

const CENTRE_BELGIQUE = { lat: 50.5039, lon: 4.4699 }

/**
 * Sélecteur de position réutilisable : clic sur la carte, bouton
 * "Utiliser ma position" (géolocalisation du navigateur), ou saisie
 * manuelle des coordonnées — les trois restent toujours visibles et se
 * mettent à jour les uns les autres, pour ne jamais bloquer qui n'a
 * pas de GPS ou préfère taper des coordonnées connues.
 *
 * @param {number|null} lat
 * @param {number|null} lon
 * @param {(lat:number|null, lon:number|null) => void} onChange
 * @param {{lat:number, lon:number}} [centreDefaut] - centre de la carte avant toute sélection
 * @param {string} [hauteur]
 * @param {number} [zoomDefaut] - zoom avant toute sélection (8 par défaut ; plus serré quand `centreDefaut` est déjà précis)
 * @param {Array} [cercles] - périmètres affichés en repère (ex. zones d'intervention), non interactifs pendant la sélection
 * @param {Array} [marqueurs] - points déjà posés, affichés en repère
 */
export default function SelecteurLocalisation({ lat, lon, onChange, centreDefaut = CENTRE_BELGIQUE, hauteur = '280px', zoomDefaut = 8, cercles = [], marqueurs = [] }) {
  const [erreurGeo, setErreurGeo] = useState(null)
  const [rechercheGeo, setRechercheGeo] = useState(false)

  const selection = lat != null && lon != null ? { lat: Number(lat), lon: Number(lon) } : null
  const centre = selection ?? centreDefaut

  function utiliserPosition() {
    if (!navigator.geolocation) {
      setErreurGeo('Ce navigateur ne fournit pas de géolocalisation.')
      return
    }
    setRechercheGeo(true)
    setErreurGeo(null)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onChange(p.coords.latitude, p.coords.longitude)
        setRechercheGeo(false)
      },
      () => {
        setErreurGeo('Position refusée ou indisponible.')
        setRechercheGeo(false)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  return (
    <div>
      <CarteCrise
        centre={centre}
        zoom={selection ? 15 : zoomDefaut}
        cercles={cercles}
        marqueurs={marqueurs}
        selection={selection}
        onClicCarte={(p) => onChange(p.lat, p.lon)}
        hauteur={hauteur}
      />
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <button type="button" className="discret" onClick={utiliserPosition} disabled={rechercheGeo}>
          {rechercheGeo ? 'Recherche…' : 'Utiliser ma position'}
        </button>
        <input
          type="number"
          step="any"
          value={lat ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value), lon ?? null)}
          placeholder="latitude"
          className="w-28"
        />
        <input
          type="number"
          step="any"
          value={lon ?? ''}
          onChange={(e) => onChange(lat ?? null, e.target.value === '' ? null : Number(e.target.value))}
          placeholder="longitude"
          className="w-28"
        />
        {selection && (
          <button type="button" className="discret" onClick={() => onChange(null, null)}>
            Effacer
          </button>
        )}
      </div>
      {erreurGeo && <p className="text-xs text-chaud mt-1">{erreurGeo}</p>}
      <p className="text-xs text-sourdine mt-1">Cliquez sur la carte, utilisez votre position, ou tapez les coordonnées.</p>
    </div>
  )
}
