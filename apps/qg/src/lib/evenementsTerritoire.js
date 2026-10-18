// Pont commune → événements : libellés et règles pures (testables sans réseau).

export const NIVEAUX = ['information', 'vigilance', 'urgence', 'evacuation']

export const LIBELLE_NIVEAU = {
  information: 'Information',
  vigilance: 'Vigilance',
  urgence: 'Urgence',
  evacuation: 'Évacuation',
}

export const COULEUR_NIVEAU = {
  information: '#475569',
  vigilance: '#b45309',
  urgence: '#b91c1c',
  evacuation: '#7f1d1d',
}

export const LIBELLE_STATUT = {
  a_valider: 'À valider',
  echec: 'Échec — à renvoyer ou à abandonner',
  envoye: 'Envoyé',
  annule: 'Non envoyé',
}

export const LIBELLE_PHASE = {
  pre_alerte: 'pré-alerte',
  alerte: 'alerte',
  phase_active: 'phase active',
  levee: 'levée',
}

/** Nom de domaine d'une adresse de réception, pour l'affichage (jamais l'adresse complète : elle peut porter un identifiant). */
export function hoteRecepteur(url) {
  if (!url) return null
  try {
    return new URL(url).host || null
  } catch {
    return null
  }
}

/**
 * Un envoi est-il possible, et sinon pourquoi ? Le serveur refait ces contrôles ; ici on évite seulement
 * de proposer un bouton qui ne peut pas aboutir, en disant ce qui manque.
 */
export function etatEnvoi(lien) {
  if (!lien) return { ok: false, raison: 'Événement introuvable.' }
  if (!lien.actif) return { ok: false, raison: 'Cet événement n\'est plus suivi : réactivez-le pour envoyer.' }
  if (!lien.url_recepteur) return { ok: false, raison: 'Aucune adresse de réception : renseignez-la dans « Événements suivis ».' }
  if (!lien.secret_defini) return { ok: false, raison: 'Aucun secret défini : définissez-le dans « Événements suivis ».' }
  return { ok: true, raison: null }
}

/** Résultat de la fonction d'envoi → phrase pour le CC. */
export function resumeEnvoi(r) {
  if (!r) return { ok: false, texte: 'Réponse inattendue du serveur : vérifiez l\'état du message avant de renvoyer.' }
  if (r.statut === 'envoye') return { ok: true, texte: `Message envoyé${r.code ? ` (réponse HTTP ${r.code})` : ''}.` }
  const detail = r.erreur || (r.code ? `réponse HTTP ${r.code}` : 'cause inconnue')
  return { ok: false, texte: `Envoi non abouti : ${detail}. Le message reste à envoyer ; rien n'est parti.` }
}

/** Secret aléatoire de 32 caractères hexadécimaux (128 bits), à communiquer à l'organisateur. */
export function genererSecret(cryptoApi = globalThis.crypto) {
  const octets = new Uint8Array(16)
  cryptoApi.getRandomValues(octets)
  return Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('')
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Champs du formulaire d'un événement suivi → ligne à écrire (texte vide = absent). */
export function ligneDepuisFormulaire(f) {
  const vide = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim())
  const erreurs = []
  if (!vide(f.nom) || vide(f.nom).length < 2) erreurs.push('Le nom de l\'événement est requis (2 caractères au moins).')
  if (vide(f.jeton_public) && !UUID.test(vide(f.jeton_public))) erreurs.push('Le jeton public Eventware doit être un identifiant du type 123e4567-e89b-12d3-a456-426614174000.')
  if (vide(f.date_debut) && vide(f.date_fin) && f.date_fin < f.date_debut) erreurs.push('La date de fin précède la date de début.')
  return {
    erreurs,
    ligne: {
      nom: vide(f.nom),
      organisateur: vide(f.organisateur),
      jeton_public: vide(f.jeton_public),
      url_recepteur: vide(f.url_recepteur),
      entete_secret: vide(f.entete_secret) ?? 'X-Diffusion-Secret',
      date_debut: vide(f.date_debut),
      date_fin: vide(f.date_fin),
      notes: vide(f.notes),
    },
  }
}
