import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet'
import { divIcon, latLngBounds } from 'leaflet'
import { useEffect } from 'react'

/**
 * Carte Leaflet/OpenStreetMap générique, partagée par les apps Admin et
 * QG. Pas de clé API (même choix qu'Eventware, pour la cohérence entre
 * les deux produits — voir briefing-eventware-pour-crisiware.md §1).
 *
 * En lecture par défaut. Passer `onClicCarte` bascule en mode
 * sélection : un clic sur la carte renvoie `{lat, lon}` et une pastille
 * de sélection (distincte des marqueurs de couche) se positionne là —
 * c'est ce qui sert à géolocaliser le déclenchement d'un incident ou
 * le centre d'une zone, sans taper des coordonnées à la main.
 *
 * Chaque app importe une fois `leaflet/dist/leaflet.css` (dans main.jsx) —
 * ce composant ne le fait pas lui-même pour éviter de l'importer deux
 * fois si plusieurs cartes coexistent dans la même app.
 *
 * @param {{lat:number, lon:number}} centre
 * @param {number} [zoom]
 * @param {Array<{id:string, lat:number, lon:number, titre:string, sousTitre?:string, couleur?:string}>} [marqueurs]
 * @param {Array<{id:string, lat:number, lon:number, rayonM:number, couleur?:string, libelle?:string}>} [cercles]
 * @param {{lat:number, lon:number}|null} [selection] - pastille de sélection, en mode édition
 * @param {(point: {lat:number, lon:number}) => void} [onClicCarte] - présence = active le mode sélection (clic + curseur adapté)
 * @param {number} [cleRecentrage] - changer cette valeur recentre la carte sur `centre` même si celui-ci n'a pas bougé (bouton « recentrer »)
 * @param {Array<{lat:number, lon:number}>|null} [ajusterSur] - si plusieurs points : la carte se cadre pour tous les montrer (prioritaire sur `centre`)
 * @param {number|null} [zoomRecentrage] - zoom appliqué lors d'un recentrage (sinon on garde le zoom courant)
 * @param {string} [hauteur] - toute valeur CSS valide, ex. '420px' ou '60vh'
 */
export default function CarteCrise({
  centre,
  zoom = 13,
  marqueurs = [],
  cercles = [],
  selection = null,
  onClicCarte = null,
  cleRecentrage = 0,
  zoomRecentrage = null,
  ajusterSur = null,
  hauteur = '420px',
}) {
  return (
    <div
      style={{ height: hauteur, borderRadius: 8, overflow: 'hidden', cursor: onClicCarte ? 'crosshair' : undefined }}
    >
      <MapContainer center={[centre.lat, centre.lon]} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecentrerSiChangement centre={centre} cle={cleRecentrage} zoom={zoomRecentrage} ajusterSur={ajusterSur} />
        {onClicCarte && <CaptureClic onClicCarte={onClicCarte} />}

        {cercles.map((c) => (
          <Circle
            key={c.id}
            center={[c.lat, c.lon]}
            radius={c.rayonM}
            pathOptions={{ color: c.couleur ?? '#dc5a3c', fillOpacity: 0.12, weight: 2 }}
          >
            {c.libelle && <Popup>{c.libelle}</Popup>}
          </Circle>
        ))}

        {marqueurs.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lon]} icon={icone(m.couleur)}>
            <Popup>
              <strong>{m.titre}</strong>
              {m.sousTitre && (
                <>
                  <br />
                  {m.sousTitre}
                </>
              )}
            </Popup>
          </Marker>
        ))}

        {selection && <Marker position={[selection.lat, selection.lon]} icon={iconeSelection()} />}
      </MapContainer>
    </div>
  )
}

/** Mode sélection : chaque clic sur la carte renvoie le point cliqué. */
function CaptureClic({ onClicCarte }) {
  useMapEvents({
    click(e) {
      onClicCarte({ lat: e.latlng.lat, lon: e.latlng.lng })
    },
  })
  return null
}

/** Recentre la carte quand `centre` change de référence (changement de contexte, par ex.) — Leaflet ne le fait pas de lui-même. */
function RecentrerSiChangement({ centre, cle, zoom, ajusterSur }) {
  const carte = useMap()
  // Signature stable de l'ensemble à cadrer : ne recadre que si les points changent.
  const signature = ajusterSur ? ajusterSur.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join('|') : ''
  useEffect(() => {
    if (ajusterSur && ajusterSur.length > 1) {
      // Plusieurs points (ex. plusieurs incidents cochés) : tout faire tenir à l'écran.
      carte.fitBounds(latLngBounds(ajusterSur.map((p) => [p.lat, p.lon])), { padding: [30, 30], maxZoom: 16 })
    } else {
      carte.setView([centre.lat, centre.lon], zoom ?? carte.getZoom())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centre.lat, centre.lon, cle, zoom, signature])
  return null
}

/**
 * Pastille colorée en divIcon plutôt que l'image de marqueur par défaut
 * de Leaflet : évite le casse-tête classique des icônes par défaut
 * cassées par les bundlers (chemin d'image non résolu), et permet un
 * code couleur par type de point sans jeu d'icônes à maintenir.
 */
function icone(couleur = '#2563eb') {
  return divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${couleur};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

/** Pastille de sélection : plus grande, anneau marqué, pour qu'elle ne se confonde jamais avec un marqueur de couche. */
function iconeSelection() {
  return divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:50%;background:#dc2626;border:3px solid white;box-shadow:0 0 0 2px #dc2626,0 1px 4px rgba(0,0,0,0.5)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}
