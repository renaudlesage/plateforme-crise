// =====================================================================
// Lecture du flux Atom « legacy » de MeteoAlarm (Belgique) — Crisiware,
// chantier C1. Le flux liste les avertissements en cours ; chaque entrée
// donne l'identifiant CAP et le lien du message CAP complet, lu ensuite
// par cap.ts. Structure vérifiée sur le flux réel le 13/11/2026 : une
// entrée par message et par zone, d'où le dédoublonnage par identifiant.
// Pur : utilisable dans une Edge Function (Deno) et dans Vitest (Node).
// =====================================================================

import { enfantsNommes, lireXml, texteEnfant } from './xml.ts'
import { dateIso } from './cap.ts'

export const URL_FLUX_BELGIQUE = 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-belgium'
// Seuls les messages servis par MeteoAlarm sont suivis : un flux altéré ne peut pas faire lire une autre adresse.
const PREFIXE_CAP = 'https://feeds.meteoalarm.org/api/v1/warnings/'
const TAILLE_MAX_FLUX = 5_000_000

export interface EntreeFlux {
  identifiant: string
  lien: string
  emis_le: string | null
  type_message: string | null
}

/** Flux Atom → entrées à lire, une par identifiant CAP, dans l'ordre d'émission. */
export function entreesFlux(xml: string): { entrees: EntreeFlux[]; ecartees: number } {
  const racine = lireXml(xml, { tailleMax: TAILLE_MAX_FLUX })
  if (racine.nom !== 'feed') throw new Error(`Élément racine <${racine.nom}> : <feed> attendu`)
  const vues = new Map<string, EntreeFlux>()
  let ecartees = 0
  for (const e of enfantsNommes(racine, 'entry')) {
    const identifiant = texteEnfant(e, 'identifier')
    const lien = enfantsNommes(e, 'link').find((l) => l.attributs.type === 'application/cap+xml')?.attributs.href ?? null
    if (!identifiant || !/^[^\s,<&]{1,255}$/.test(identifiant) || !lien || !lien.startsWith(PREFIXE_CAP)) {
      ecartees += 1
      continue
    }
    if (!vues.has(identifiant)) {
      vues.set(identifiant, {
        identifiant,
        lien,
        emis_le: dateIso(texteEnfant(e, 'sent')),
        type_message: texteEnfant(e, 'message_type'),
      })
    }
  }
  const entrees = [...vues.values()].sort((a, b) => (a.emis_le ?? '').localeCompare(b.emis_le ?? ''))
  return { entrees, ecartees }
}
