import { creerFileEcritures } from '@plateforme-crise/shared'
import { supabase } from './supabase'

/**
 * Instance unique pour l'app Terrain — voir packages/shared/src/fileEcritures.js
 * pour le mécanisme. Démarrée une fois à la racine de l'app (App.jsx).
 */
export const fileEcritures = creerFileEcritures({
  supabase,
  clef: 'crisiware.terrain.ecritures.file',
})
