import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import { divIcon } from 'leaflet'
import { useEffect } from 'react'

/**
 * Carte Leaflet/OpenStreetMap générique, partagée par les apps Admin et
 * QG. Pas de clé API (même choix qu'Eventware, pour la cohérence entre
 * les deux produits — voir briefing-eventware-pour-crisiware.md §1).
 *
 * Volontairement en lecture pour cette première itération : afficher
 * ce qui est déjà saisi en coordonnées brutes, avant d'envisager une
 * édition par clic sur la carte.
 *
 * Chaque app importe une fois `leaflet/dist/leaflet.css` (dans main.jsx) —
 * ce composant ne le fait pas lui-même pour éviter de l'importer deux
 * fois si plusieurs cartes coexistent dans la même app.
 *
 * @param {{lat:number, lon:number}} centre
 * @param {number} [zoom]
 * @param {Array<{id:string, lat:number, lon:number, titre:string, sousTitre?:string, couleur?:string}>} [marqueurs]
 * @param {Array<{id:string, lat:number, lon:number, rayonM:number, couleur?:string, libelle?:string}>} [cercles]
 * @param {string} [hauteur] - toute valeur CSS valide, ex. '420px' ou '60vh'
 */
export default function CarteCrise({ centre, zoom = 13, marqueurs = [], cercles = [], hauteur = '420px' }) {
  return (
    <div style={{ height: hauteur, borderRadius: 8, overflow: 'hidden' }}>
      <MapContainer center={[centre.lat, centre.lon]} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecentrerSiChangement centre={centre} />

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
      </MapContainer>
    </div>
  )
}

/** Recentre la carte quand `centre` change de référence (changement de contexte, par ex.) — Leaflet ne le fait pas de lui-même. */
function RecentrerSiChangement({ centre }) {
  const carte = useMap()
  useEffect(() => {
    carte.setView([centre.lat, centre.lon])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centre.lat, centre.lon])
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
