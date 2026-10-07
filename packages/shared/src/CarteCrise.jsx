import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet'
import { divIcon, latLngBounds } from 'leaflet'
import { useEffect, useState } from 'react'
import { svgSymbole } from './symboles.js'

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
 * @param {Array<{id:string, lat:number, lon:number, titre:string, sousTitre?:string, couleur?:string, symbole?:string, badge?:string, onModifier?:()=>void}>} [marqueurs]  symbole = code de la bibliothèque (symboles.js), badge = couleur de la discipline
 * @param {Array<{id:string, lat:number, lon:number, rayonM:number, couleur?:string, libelle?:string}>} [cercles]
 * @param {{lat:number, lon:number}|null} [selection] - pastille de sélection, en mode édition
 * @param {(point: {lat:number, lon:number}) => void} [onClicCarte] - présence = active le mode sélection (clic + curseur adapté)
 * @param {number} [cleRecentrage] - changer cette valeur recentre la carte sur `centre` même si celui-ci n'a pas bougé (bouton « recentrer »)
 * @param {Array<{lat:number, lon:number}>|null} [ajusterSur] - si plusieurs points : la carte se cadre pour tous les montrer (prioritaire sur `centre`)
 * @param {number|null} [zoomRecentrage] - zoom appliqué lors d'un recentrage (sinon on garde le zoom courant)
 * @param {string} [messagePleinEcran] - en plein écran + mode sélection : consigne affichée dans la barre du bas
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
  messagePleinEcran = 'Touchez la carte pour placer le point',
}) {
  // Plein écran « maison » (CSS fixed) plutôt que l'API Fullscreen : Safari sur iPhone ne la
  // propose pas pour un élément quelconque, et on veut garder la même carte (zoom, position).
  const [plein, setPlein] = useState(false)

  useEffect(() => {
    if (!plein) return undefined
    const avant = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const surTouche = (e) => e.key === 'Escape' && setPlein(false)
    window.addEventListener('keydown', surTouche)
    return () => {
      document.body.style.overflow = avant
      window.removeEventListener('keydown', surTouche)
    }
  }, [plein])

  return (
    <div
      style={
        plein
          ? { position: 'fixed', inset: 0, zIndex: 2000, height: '100dvh', width: '100vw', background: '#fff', cursor: onClicCarte ? 'crosshair' : undefined }
          : { position: 'relative', height: hauteur, borderRadius: 8, overflow: 'hidden', cursor: onClicCarte ? 'crosshair' : undefined }
      }
    >
      <button
        type="button"
        onClick={() => setPlein((p) => !p)}
        aria-label={plein ? 'Quitter le plein écran' : 'Afficher la carte en plein écran'}
        title={plein ? 'Quitter le plein écran' : 'Plein écran'}
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1000,
          padding: '6px 10px',
          fontSize: 13,
          lineHeight: 1.2,
          background: '#fff',
          color: '#111',
          border: '1px solid rgba(0,0,0,0.35)',
          borderRadius: 8,
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}
      >
        {plein ? '✕ Quitter le plein écran' : '⤢ Plein écran'}
      </button>

      {plein && onClicCarte && (
        <div
          style={{
            position: 'absolute',
            left: 10,
            right: 10,
            bottom: 'max(10px, env(safe-area-inset-bottom))',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '8px 10px',
            background: '#fff',
            color: '#111',
            borderRadius: 10,
            boxShadow: '0 1px 6px rgba(0,0,0,0.4)',
            fontSize: 13,
          }}
        >
          <span>
            {selection ? `Position : ${selection.lat.toFixed(5)}, ${selection.lon.toFixed(5)}` : messagePleinEcran}
          </span>
          <button
            type="button"
            onClick={() => setPlein(false)}
            style={{ padding: '6px 12px', borderRadius: 8, border: 0, background: '#1e3a5f', color: '#fff', fontSize: 13, whiteSpace: 'nowrap' }}
          >
            {selection ? 'Valider' : 'Retour'}
          </button>
        </div>
      )}

      <MapContainer center={[centre.lat, centre.lon]} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <AjusterTaille cle={plein} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecentrerSiChangement centre={centre} cle={cleRecentrage} zoom={zoomRecentrage} ajusterSur={ajusterSur} />
        {onClicCarte && <CaptureClic onClicCarte={onClicCarte} />}

        {cercles.map((c) => (
          <Circle
            key={`${c.id}-${onClicCarte ? 'sel' : 'lec'}`} // remonté au changement de mode : `interactive` n'est lu qu'à la création
            center={[c.lat, c.lon]}
            radius={c.rayonM}
            // En mode sélection, le périmètre ne doit pas intercepter le clic : on veut
            // pouvoir poser un point DANS une zone d'intervention.
            pathOptions={{ color: c.couleur ?? '#dc5a3c', fillOpacity: 0.12, weight: 2, interactive: !onClicCarte }}
          >
            {c.libelle && !onClicCarte && <Popup>{c.libelle}</Popup>}
          </Circle>
        ))}

        {marqueurs.map((m) => (
          <Marker key={`${m.id}-${onClicCarte ? 'sel' : 'lec'}`} position={[m.lat, m.lon]} icon={m.symbole ? iconeSymbole(m.symbole, m.badge) : icone(m.couleur)} interactive={!onClicCarte}>
            <Popup>
              <strong>{m.titre}</strong>
              {m.sousTitre && (
                <>
                  <br />
                  {m.sousTitre}
                </>
              )}
              {m.onModifier && (
                <>
                  <br />
                  <button
                    type="button"
                    onClick={m.onModifier}
                    style={{ marginTop: 6, padding: '4px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #1e3a5f', background: '#1e3a5f', color: '#fff' }}
                  >
                    Modifier
                  </button>
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

/** Leaflet doit être prévenu quand son conteneur change de taille (entrée/sortie du plein écran). */
function AjusterTaille({ cle }) {
  const carte = useMap()
  useEffect(() => {
    const t = setTimeout(() => carte.invalidateSize(), 60)
    return () => clearTimeout(t)
  }, [cle, carte])
  return null
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
/** Marqueur en symbole de la charte (bibliothèque symboles.js), pastille de discipline en coin. */
function iconeSymbole(code, badge = null) {
  return divIcon({
    className: '',
    html: svgSymbole(code, { taille: 34, badge }),
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -14],
  })
}

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
