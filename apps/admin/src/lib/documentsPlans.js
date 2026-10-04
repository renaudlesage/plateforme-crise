import { supabase } from './supabase'

const BUCKET = 'plans-urgence-documents'

/**
 * Dépose (ou remplace) le document d'un plan d'urgence dans le bucket privé
 * "plans-urgence-documents", sous le chemin conventionnel
 * "<contexte_id>/<plan_id>/<nom_fichier>" — c'est ce chemin que lisent les
 * policies RLS de storage.objects (voir migration document_plan_urgence).
 *
 * @returns {{chemin_document, nom_fichier_document, type_mime_document, taille_document_octets, document_televerse_le}|{error}}
 */
export async function televerserDocumentPlan({ contexteId, planId, fichier }) {
  const chemin = `${contexteId}/${planId}/${fichier.name}`
  const { error: erreurUpload } = await supabase.storage.from(BUCKET).upload(chemin, fichier, {
    upsert: true,
    contentType: fichier.type || undefined,
  })
  if (erreurUpload) return { error: erreurUpload }

  return {
    error: null,
    colonnes: {
      chemin_document: chemin,
      nom_fichier_document: fichier.name,
      type_mime_document: fichier.type || null,
      taille_document_octets: fichier.size,
      document_televerse_le: new Date().toISOString(),
    },
  }
}

/** URL signée temporaire (1h) pour consulter/télécharger le document d'un plan. */
export async function urlDocumentPlan(chemin) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(chemin, 3600)
  if (error) return { error }
  return { error: null, url: data.signedUrl }
}

/** Retire le document stocké (sans toucher à la ligne plans_urgence). */
export async function supprimerDocumentPlan(chemin) {
  const { error } = await supabase.storage.from(BUCKET).remove([chemin])
  return { error }
}
