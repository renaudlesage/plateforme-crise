/**
 * File d'attente locale des signalements citoyens.
 *
 * Porté de fileSos.js (Eventware 2.0) — voir briefing-eventware-pour-crisiware.md
 * §4, "Signalement citoyen par QR/lien, hors ligne : reprendre — c'est
 * le différenciateur". Principe : un signalement est d'abord écrit
 * dans le téléphone, puis envoyé. Jamais l'inverse. Si le réseau
 * manque, il part dès que la couverture revient, sans que le riverain
 * ait à y penser.
 *
 * `cle_client` est générée AVANT le premier envoi et ne change jamais :
 * c'est elle qui garantit qu'un renvoi ne crée pas de doublon côté
 * base (voir creer_signalement_citoyen, idempotent sur cette clé).
 */

const CLEF = 'crisiware.signalements.file'

export function lireFile() {
  try {
    return JSON.parse(localStorage.getItem(CLEF) || '[]')
  } catch {
    return []
  }
}

function ecrireFile(file) {
  try {
    localStorage.setItem(CLEF, JSON.stringify(file))
  } catch {
    /* stockage plein ou navigation privée : on continue en mémoire */
  }
}

export function ajouter(signalement) {
  const file = lireFile()
  file.unshift(signalement)
  ecrireFile(file)
  return file
}

export function majSignalement(cleClient, champs) {
  const file = lireFile().map((s) => (s.cle_client === cleClient ? { ...s, ...champs } : s))
  ecrireFile(file)
  return file
}

export function retirer(cleClient) {
  const file = lireFile().filter((s) => s.cle_client !== cleClient)
  ecrireFile(file)
  return file
}

export const ETATS = {
  en_attente: "En attente d'envoi",
  envoi: 'Envoi en cours…',
  recu: 'Reçu',
  echec: 'Refusé',
}

export const ETIQUETTES_STATUT = {
  recu: 'Reçu, en attente de traitement',
  pris_en_charge: 'Pris en charge — quelqu\'un s\'en occupe',
  en_cours: 'Intervention en cours',
  clos: 'Clôturé',
  sans_suite: 'Classé sans suite',
}
