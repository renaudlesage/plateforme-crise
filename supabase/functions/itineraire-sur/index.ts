// =====================================================================
// itineraire-sur (Crisiware) — palier 2 de la géo-barrière
//
// Calcule un itinéraire qui ÉVITE les zones rouges de l'incident (les oranges
// sur demande) et les points terrain bloquants ouverts (route coupée,
// inondation), par OpenRouteService (`options.avoid_polygons`). Rend le tracé,
// le résumé, les points de passage pour Google Maps, et un contrôle
// indépendant que le tracé ne traverse aucune zone.
//
// Appel : POST { incident_id, depart: {lat, lon}, arrivee: {lat, lon},
//                profil?: 'driving-car' | 'foot-walking', inclure_orange?: boolean }
// avec le JWT de l'utilisateur (verify_jwt=true). Les zones et points sont lus
// avec SES droits (RLS) : un utilisateur sans accès à l'incident ne voit rien
// et reçoit 403. Rien n'est stocké.
//
// Secret attendu : ORS_API_KEY (clé OpenRouteService, compte gratuit :
// 2 000 requêtes de directions par jour). Jamais côté client.
//
// Le guidage reste une aide : le conducteur reste responsable, et la zone peut
// bouger pendant le trajet. Le client doit redemander un itinéraire quand les
// zones changent.
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  cerclesDesPoints,
  cerclesDesZones,
  interpreterReponseOrs,
  multiPolygoneAEviter,
  preparerCercles,
  type Position,
} from '../_shared/itineraire.ts'

// Depuis novembre 2026, l'API est servie sous api.heigit.org (l'ancien api.openrouteservice.org est arrêté) ;
// même clé, même format de requête.
const URL_ORS = 'https://api.heigit.org/openrouteservice/v2/directions'
const PROFILS = new Set(['driving-car', 'foot-walking'])
const DISTANCE_MAX_M = 150000 // au-delà, ce n'est plus un déplacement d'intervention communal
const DELAI_ORS_MS = 15000 // au-delà, on rend la main à l'intervenant plutôt que de le laisser sur « Calcul… »

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reponseJson(corps: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(corps), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...(init.headers ?? {}) },
  })
}

function lirePosition(v: unknown): Position | null {
  if (!v || typeof v !== 'object') return null
  const lat = Number((v as { lat?: unknown }).lat)
  const lon = Number((v as { lon?: unknown }).lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat, lon }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return reponseJson({ error: 'POST attendu' }, { status: 405 })

  try {
    const cle = Deno.env.get('ORS_API_KEY')
    if (!cle) {
      return reponseJson(
        { error: "Itinéraire sûr non configuré : la clé OpenRouteService (secret ORS_API_KEY) n'est pas posée sur le projet.", code: 'non_configure' },
        { status: 503 }
      )
    }

    const corps = await req.json().catch(() => ({}))
    const incidentId = typeof corps.incident_id === 'string' ? corps.incident_id : null
    const depart = lirePosition(corps.depart)
    const arrivee = lirePosition(corps.arrivee)
    const profil = typeof corps.profil === 'string' && PROFILS.has(corps.profil) ? corps.profil : 'driving-car'
    const inclureOrange = corps.inclure_orange === true
    if (!incidentId || !depart || !arrivee) {
      return reponseJson({ error: 'incident_id, depart {lat, lon} et arrivee {lat, lon} sont requis' }, { status: 400 })
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    // Accès à l'incident vérifié par la RLS : rien de lisible → 403.
    const { data: incident, error: erreurIncident } = await supabase
      .from('incidents')
      .select('id, contexte_id')
      .eq('id', incidentId)
      .maybeSingle()
    if (erreurIncident || !incident) return reponseJson({ error: 'Incident inaccessible' }, { status: 403 })

    const [zonesRes, pointsRes] = await Promise.all([
      supabase
        .from('zones_intervention')
        .select('id, type_zone, centre_latitude, centre_longitude, rayon_metres, date_levee')
        .eq('incident_id', incidentId)
        .is('date_levee', null),
      supabase
        .from('observations_terrain')
        .select('id, type, latitude, longitude')
        .eq('incident_id', incidentId)
        .eq('statut', 'ouvert')
        .in('type', ['route_coupee', 'inondation']),
    ])
    if (zonesRes.error) return reponseJson({ error: `Zones illisibles : ${zonesRes.error.message}` }, { status: 500 })

    const cercles = [...cerclesDesZones(zonesRes.data ?? [], inclureOrange), ...cerclesDesPoints(pointsRes.data ?? [])]
    const evites = {
      rouges: cercles.filter((c) => c.nature === 'rouge').length,
      oranges: cercles.filter((c) => c.nature === 'orange').length,
      points_bloquants: cercles.filter((c) => c.nature === 'route_coupee' || c.nature === 'inondation').length,
    }

    // Destination ou départ dans une zone à éviter : le moteur refuserait ; on le dit clairement.
    const { zoneArrivee, zonesDepart, cerclesCalcul } = preparerCercles(depart, arrivee, cercles)
    if (zoneArrivee) {
      return reponseJson(
        {
          error: `La destination est dans une zone ${zoneArrivee.nature} : aucun itinéraire ne peut l'éviter. Approchez-vous au bord de la zone, puis suivez les ordres du PC-Ops.`,
          code: 'destination_en_zone',
          evites,
        },
        { status: 422 }
      )
    }
    // Départ en zone : tous les cercles qui le contiennent sont retirés du calcul (il faut bien en sortir).

    const corpsOrs: Record<string, unknown> = {
      coordinates: [
        [depart.lon, depart.lat],
        [arrivee.lon, arrivee.lat],
      ],
      instructions: false,
      geometry_simplify: false,
      radiuses: [-1, -1],
    }
    const mp = multiPolygoneAEviter(cerclesCalcul)
    if (mp) corpsOrs.options = { avoid_polygons: mp }

    const controleur = new AbortController()
    const minuterie = setTimeout(() => controleur.abort(), DELAI_ORS_MS)
    let reponseOrs: Response
    let texte: string
    try {
      reponseOrs = await fetch(`${URL_ORS}/${profil}/geojson`, {
        method: 'POST',
        headers: { Authorization: cle, 'Content-Type': 'application/json', Accept: 'application/geo+json' },
        body: JSON.stringify(corpsOrs),
        signal: controleur.signal,
      })
      texte = await reponseOrs.text()
    } catch (e) {
      if (controleur.signal.aborted) {
        return reponseJson(
          { error: `Le moteur de routage n'a pas répondu en ${DELAI_ORS_MS / 1000} s. Réessayez, ou utilisez le lien Google Maps direct en gardant l'œil sur les zones.`, code: 'delai', evites },
          { status: 504 }
        )
      }
      throw e
    } finally {
      clearTimeout(minuterie)
    }
    if (!reponseOrs.ok) {
      let message = `Moteur de routage indisponible (HTTP ${reponseOrs.status})`
      let code = 'moteur'
      try {
        const e = JSON.parse(texte)?.error
        if (e?.code === 2009 || e?.code === 2010) {
          message = 'Aucun itinéraire trouvé en évitant les zones. Le départ ou la destination est peut-être hors du réseau routier, ou le contournement est impossible.'
          code = 'aucun_itineraire'
        } else if (e?.code === 2004) {
          message = 'Trajet trop long pour le moteur de routage.'
          code = 'trop_long'
        } else if (e?.message) message = `Moteur de routage : ${e.message}`
      } catch {
        /* texte non JSON */
      }
      return reponseJson({ error: message, code, evites }, { status: reponseOrs.status === 429 ? 429 : 502 })
    }

    // Contrôle de non-traversée sur les cercles du calcul : le tracé part forcément de la zone de départ.
    const resultat = interpreterReponseOrs(JSON.parse(texte), cerclesCalcul)
    if (resultat.distance_m > DISTANCE_MAX_M) {
      resultat.avertissements.push('Itinéraire très long : vérifiez que la destination est la bonne.')
    }
    if (pointsRes.error) {
      // Sans les points terrain, l'itinéraire n'évite que les zones : l'intervenant doit le savoir.
      resultat.avertissements.unshift(
        "Routes coupées et inondations NON prises en compte (points terrain illisibles pour le moment) : seules les zones sont évitées."
      )
    }
    if (zonesDepart.length) {
      const natures = [...new Set(zonesDepart.map((c) => c.nature))].join(', ')
      resultat.avertissements.unshift(`Vous partez de l'intérieur d'une zone à éviter (${natures}) : commencez par en sortir.`)
    }

    return reponseJson({
      ...resultat,
      profil,
      inclure_orange: inclureOrange,
      evites,
      calcule_le: new Date().toISOString(),
      source: 'OpenRouteService (© openrouteservice.org, données © OpenStreetMap)',
    })
  } catch (e) {
    return reponseJson({ error: e instanceof Error ? e.message : 'Erreur inattendue' }, { status: 500 })
  }
})
