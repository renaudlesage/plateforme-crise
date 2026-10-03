export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acces_utilisateurs: {
        Row: {
          contexte_id: string
          id: string
          niveau_acces: string
          role_id: string | null
          user_id: string
        }
        Insert: {
          contexte_id: string
          id?: string
          niveau_acces?: string
          role_id?: string | null
          user_id: string
        }
        Update: {
          contexte_id?: string
          id?: string
          niveau_acces?: string
          role_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acces_utilisateurs_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acces_utilisateurs_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      alertes_publiques: {
        Row: {
          actif: boolean
          consignes: string | null
          contexte_id: string
          date_expiration: string | null
          date_publication: string
          id: string
          incident_id: string | null
          message: string
          niveau_alerte: string
          publie_par_contact_id: string | null
          titre: string
          zone_concernee: string | null
        }
        Insert: {
          actif?: boolean
          consignes?: string | null
          contexte_id: string
          date_expiration?: string | null
          date_publication?: string
          id?: string
          incident_id?: string | null
          message: string
          niveau_alerte?: string
          publie_par_contact_id?: string | null
          titre: string
          zone_concernee?: string | null
        }
        Update: {
          actif?: boolean
          consignes?: string | null
          contexte_id?: string
          date_expiration?: string | null
          date_publication?: string
          id?: string
          incident_id?: string | null
          message?: string
          niveau_alerte?: string
          publie_par_contact_id?: string | null
          titre?: string
          zone_concernee?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alertes_publiques_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertes_publiques_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertes_publiques_publie_par_contact_id_fkey"
            columns: ["publie_par_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      benevoles_entraide: {
        Row: {
          adresse: string | null
          competences: string[]
          competences_autre: string | null
          consentement_rgpd: boolean
          contexte_id: string
          date_inscription: string
          disponibilite: string | null
          email: string
          id: string
          missions_possibles: string[]
          nom: string
          note_interne: string | null
          prenom: string
          statut: string
          telephone: string | null
        }
        Insert: {
          adresse?: string | null
          competences?: string[]
          competences_autre?: string | null
          consentement_rgpd?: boolean
          contexte_id: string
          date_inscription?: string
          disponibilite?: string | null
          email: string
          id?: string
          missions_possibles?: string[]
          nom: string
          note_interne?: string | null
          prenom: string
          statut?: string
          telephone?: string | null
        }
        Update: {
          adresse?: string | null
          competences?: string[]
          competences_autre?: string | null
          consentement_rgpd?: boolean
          contexte_id?: string
          date_inscription?: string
          disponibilite?: string | null
          email?: string
          id?: string
          missions_possibles?: string[]
          nom?: string
          note_interne?: string | null
          prenom?: string
          statut?: string
          telephone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "benevoles_entraide_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
        ]
      }
      canaux_diffusion: {
        Row: {
          actif: boolean
          config: Json
          contexte_id: string
          id: string
          nom: string
          type: string
        }
        Insert: {
          actif?: boolean
          config?: Json
          contexte_id: string
          id?: string
          nom: string
          type: string
        }
        Update: {
          actif?: boolean
          config?: Json
          contexte_id?: string
          id?: string
          nom?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "canaux_diffusion_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
        ]
      }
      canaux_radio: {
        Row: {
          code: string
          contexte_id: string
          description: string | null
          discipline_id: string | null
          id: string
          niveau_id: string | null
        }
        Insert: {
          code: string
          contexte_id: string
          description?: string | null
          discipline_id?: string | null
          id?: string
          niveau_id?: string | null
        }
        Update: {
          code?: string
          contexte_id?: string
          description?: string | null
          discipline_id?: string | null
          id?: string
          niveau_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canaux_radio_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canaux_radio_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canaux_radio_niveau_id_fkey"
            columns: ["niveau_id"]
            isOneToOne: false
            referencedRelation: "niveaux_escalade"
            referencedColumns: ["id"]
          },
        ]
      }
      centres_accueil: {
        Row: {
          accessible_poids_lourd: boolean | null
          adresse: string | null
          capacite_debout: number | null
          capacite_hebergement: number | null
          contact_id: string | null
          contexte_id: string
          dons_acceptes: boolean
          eclairage_exterieur: boolean | null
          id: string
          largeur_voirie_acces: string | null
          latitude: number | null
          longitude: number | null
          nom: string
          parking_vehicules_legers: number | null
          parking_vehicules_lourds: number | null
          seuil_fermeture_dons: string | null
          seuil_ouverture_dons: string | null
          specificites: string | null
          type_lieu: string | null
        }
        Insert: {
          accessible_poids_lourd?: boolean | null
          adresse?: string | null
          capacite_debout?: number | null
          capacite_hebergement?: number | null
          contact_id?: string | null
          contexte_id: string
          dons_acceptes?: boolean
          eclairage_exterieur?: boolean | null
          id?: string
          largeur_voirie_acces?: string | null
          latitude?: number | null
          longitude?: number | null
          nom: string
          parking_vehicules_legers?: number | null
          parking_vehicules_lourds?: number | null
          seuil_fermeture_dons?: string | null
          seuil_ouverture_dons?: string | null
          specificites?: string | null
          type_lieu?: string | null
        }
        Update: {
          accessible_poids_lourd?: boolean | null
          adresse?: string | null
          capacite_debout?: number | null
          capacite_hebergement?: number | null
          contact_id?: string | null
          contexte_id?: string
          dons_acceptes?: boolean
          eclairage_exterieur?: boolean | null
          id?: string
          largeur_voirie_acces?: string | null
          latitude?: number | null
          longitude?: number | null
          nom?: string
          parking_vehicules_legers?: number | null
          parking_vehicules_lourds?: number | null
          seuil_fermeture_dons?: string | null
          seuil_ouverture_dons?: string | null
          specificites?: string | null
          type_lieu?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "centres_accueil_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "centres_accueil_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_executions: {
        Row: {
          execute: boolean
          execute_par_contact_id: string | null
          horodatage_execution: string | null
          id: string
          incident_id: string
          template_id: string
        }
        Insert: {
          execute?: boolean
          execute_par_contact_id?: string | null
          horodatage_execution?: string | null
          id?: string
          incident_id: string
          template_id: string
        }
        Update: {
          execute?: boolean
          execute_par_contact_id?: string | null
          horodatage_execution?: string | null
          id?: string
          incident_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_executions_execute_par_contact_id_fkey"
            columns: ["execute_par_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_executions_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_executions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          contexte_id: string
          declencheur: string
          id: string
          libelle: string
          niveau_id: string | null
          ordre: number
          role_id: string | null
        }
        Insert: {
          contexte_id: string
          declencheur: string
          id?: string
          libelle: string
          niveau_id?: string | null
          ordre: number
          role_id?: string | null
        }
        Update: {
          contexte_id?: string
          declencheur?: string
          id?: string
          libelle?: string
          niveau_id?: string | null
          ordre?: number
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_niveau_id_fkey"
            columns: ["niveau_id"]
            isOneToOne: false
            referencedRelation: "niveaux_escalade"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          actif: boolean
          categorie: string
          contexte_id: string
          discipline_id: string | null
          email: string | null
          est_suppleant_de: string | null
          fonction: string | null
          id: string
          nom: string | null
          organisation: string | null
          prenom: string | null
          role_id: string | null
          sous_categorie: string | null
          telephone: string | null
        }
        Insert: {
          actif?: boolean
          categorie: string
          contexte_id: string
          discipline_id?: string | null
          email?: string | null
          est_suppleant_de?: string | null
          fonction?: string | null
          id?: string
          nom?: string | null
          organisation?: string | null
          prenom?: string | null
          role_id?: string | null
          sous_categorie?: string | null
          telephone?: string | null
        }
        Update: {
          actif?: boolean
          categorie?: string
          contexte_id?: string
          discipline_id?: string | null
          email?: string | null
          est_suppleant_de?: string | null
          fonction?: string | null
          id?: string
          nom?: string | null
          organisation?: string | null
          prenom?: string | null
          role_id?: string | null
          sous_categorie?: string | null
          telephone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_est_suppleant_de_fkey"
            columns: ["est_suppleant_de"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      contextes: {
        Row: {
          config: Json
          created_at: string
          id: string
          nom: string
          type: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          nom: string
          type: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          nom?: string
          type?: string
        }
        Relationships: []
      }
      conventions: {
        Row: {
          contexte_id: string
          date_debut: string | null
          date_fin: string | null
          fichier_url: string | null
          id: string
          objet: string | null
          partenaire: string
        }
        Insert: {
          contexte_id: string
          date_debut?: string | null
          date_fin?: string | null
          fichier_url?: string | null
          id?: string
          objet?: string | null
          partenaire: string
        }
        Update: {
          contexte_id?: string
          date_debut?: string | null
          date_fin?: string | null
          fichier_url?: string | null
          id?: string
          objet?: string | null
          partenaire?: string
        }
        Relationships: [
          {
            foreignKeyName: "conventions_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
        ]
      }
      diffusions: {
        Row: {
          alerte_id: string
          canal_id: string
          created_at: string
          horodatage_envoi: string | null
          id: string
          message_erreur: string | null
          statut: string
        }
        Insert: {
          alerte_id: string
          canal_id: string
          created_at?: string
          horodatage_envoi?: string | null
          id?: string
          message_erreur?: string | null
          statut?: string
        }
        Update: {
          alerte_id?: string
          canal_id?: string
          created_at?: string
          horodatage_envoi?: string | null
          id?: string
          message_erreur?: string | null
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "diffusions_alerte_id_fkey"
            columns: ["alerte_id"]
            isOneToOne: false
            referencedRelation: "alertes_publiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diffusions_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canaux_diffusion"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplines: {
        Row: {
          actif: boolean
          code: string
          contexte_id: string
          id: string
          libelle: string
        }
        Insert: {
          actif?: boolean
          code: string
          contexte_id: string
          id?: string
          libelle: string
        }
        Update: {
          actif?: boolean
          code?: string
          contexte_id?: string
          id?: string
          libelle?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplines_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations_crise: {
        Row: {
          created_at: string
          date_incident_cloture: string | null
          date_realisation: string | null
          echeance_rex: string | null
          id: string
          incident_id: string
          responsable_contact_id: string | null
          statut: string
          synthese: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_incident_cloture?: string | null
          date_realisation?: string | null
          echeance_rex?: string | null
          id?: string
          incident_id: string
          responsable_contact_id?: string | null
          statut?: string
          synthese?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_incident_cloture?: string | null
          date_realisation?: string | null
          echeance_rex?: string | null
          id?: string
          incident_id?: string
          responsable_contact_id?: string | null
          statut?: string
          synthese?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_crise_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_crise_responsable_contact_id_fkey"
            columns: ["responsable_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations_risque: {
        Row: {
          date_evaluation: string
          duree_situation: string | null
          elements_aggravants: string | null
          elements_attenuants: string | null
          environnement_probabilite: string | null
          environnement_probabilite_exceptionnel: string | null
          environnement_score: number | null
          environnement_score_exceptionnel: number | null
          evaluation_globale: string | null
          financier_probabilite: string | null
          financier_probabilite_exceptionnel: string | null
          financier_score: number | null
          financier_score_exceptionnel: number | null
          id: string
          infrastructure_probabilite: string | null
          infrastructure_probabilite_exceptionnel: string | null
          infrastructure_score: number | null
          infrastructure_score_exceptionnel: number | null
          objet_risque_id: string
          victimes_probabilite: string | null
          victimes_probabilite_exceptionnel: string | null
          victimes_score: number | null
          victimes_score_exceptionnel: number | null
          vitesse_developpement: string | null
        }
        Insert: {
          date_evaluation?: string
          duree_situation?: string | null
          elements_aggravants?: string | null
          elements_attenuants?: string | null
          environnement_probabilite?: string | null
          environnement_probabilite_exceptionnel?: string | null
          environnement_score?: number | null
          environnement_score_exceptionnel?: number | null
          evaluation_globale?: string | null
          financier_probabilite?: string | null
          financier_probabilite_exceptionnel?: string | null
          financier_score?: number | null
          financier_score_exceptionnel?: number | null
          id?: string
          infrastructure_probabilite?: string | null
          infrastructure_probabilite_exceptionnel?: string | null
          infrastructure_score?: number | null
          infrastructure_score_exceptionnel?: number | null
          objet_risque_id: string
          victimes_probabilite?: string | null
          victimes_probabilite_exceptionnel?: string | null
          victimes_score?: number | null
          victimes_score_exceptionnel?: number | null
          vitesse_developpement?: string | null
        }
        Update: {
          date_evaluation?: string
          duree_situation?: string | null
          elements_aggravants?: string | null
          elements_attenuants?: string | null
          environnement_probabilite?: string | null
          environnement_probabilite_exceptionnel?: string | null
          environnement_score?: number | null
          environnement_score_exceptionnel?: number | null
          evaluation_globale?: string | null
          financier_probabilite?: string | null
          financier_probabilite_exceptionnel?: string | null
          financier_score?: number | null
          financier_score_exceptionnel?: number | null
          id?: string
          infrastructure_probabilite?: string | null
          infrastructure_probabilite_exceptionnel?: string | null
          infrastructure_score?: number | null
          infrastructure_score_exceptionnel?: number | null
          objet_risque_id?: string
          victimes_probabilite?: string | null
          victimes_probabilite_exceptionnel?: string | null
          victimes_score?: number | null
          victimes_score_exceptionnel?: number | null
          vitesse_developpement?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_risque_objet_id_fkey"
            columns: ["objet_risque_id"]
            isOneToOne: false
            referencedRelation: "objets_a_risque"
            referencedColumns: ["id"]
          },
        ]
      }
      exercice_evaluations: {
        Row: {
          constat: string | null
          evaluateur_contact_id: string | null
          exercice_id: string
          id: string
          niveau_atteinte: string
          objectif_evalue: string
          recommandation: string | null
        }
        Insert: {
          constat?: string | null
          evaluateur_contact_id?: string | null
          exercice_id: string
          id?: string
          niveau_atteinte: string
          objectif_evalue: string
          recommandation?: string | null
        }
        Update: {
          constat?: string | null
          evaluateur_contact_id?: string | null
          exercice_id?: string
          id?: string
          niveau_atteinte?: string
          objectif_evalue?: string
          recommandation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercice_evaluations_evaluateur_contact_id_fkey"
            columns: ["evaluateur_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercice_evaluations_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["id"]
          },
        ]
      }
      exercice_roles: {
        Row: {
          contact_id: string | null
          est_evaluateur: boolean
          exercice_id: string
          fonction_jouee: string
          id: string
          role_id: string | null
        }
        Insert: {
          contact_id?: string | null
          est_evaluateur?: boolean
          exercice_id: string
          fonction_jouee: string
          id?: string
          role_id?: string | null
        }
        Update: {
          contact_id?: string | null
          est_evaluateur?: boolean
          exercice_id?: string
          fonction_jouee?: string
          id?: string
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercice_roles_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercice_roles_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercice_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercices: {
        Row: {
          consignes_securite: string | null
          contexte_id: string
          date_planifiee: string | null
          date_realisee: string | null
          evaluation: string | null
          fiche_risque_id: string | null
          id: string
          mel: Json
          objectifs: string | null
          objectifs_jsonb: Json
          objet_risque_id: string | null
          rapport_final: string | null
          type_exercice: string | null
          valide_par_niveau_superieur: boolean | null
        }
        Insert: {
          consignes_securite?: string | null
          contexte_id: string
          date_planifiee?: string | null
          date_realisee?: string | null
          evaluation?: string | null
          fiche_risque_id?: string | null
          id?: string
          mel?: Json
          objectifs?: string | null
          objectifs_jsonb?: Json
          objet_risque_id?: string | null
          rapport_final?: string | null
          type_exercice?: string | null
          valide_par_niveau_superieur?: boolean | null
        }
        Update: {
          consignes_securite?: string | null
          contexte_id?: string
          date_planifiee?: string | null
          date_realisee?: string | null
          evaluation?: string | null
          fiche_risque_id?: string | null
          id?: string
          mel?: Json
          objectifs?: string | null
          objectifs_jsonb?: Json
          objet_risque_id?: string | null
          rapport_final?: string | null
          type_exercice?: string | null
          valide_par_niveau_superieur?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "exercices_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercices_fiche_risque_id_fkey"
            columns: ["fiche_risque_id"]
            isOneToOne: false
            referencedRelation: "objets_a_risque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercices_objet_risque_id_fkey"
            columns: ["objet_risque_id"]
            isOneToOne: false
            referencedRelation: "objets_a_risque"
            referencedColumns: ["id"]
          },
        ]
      }
      exposition_economique: {
        Row: {
          annee_reference_bce: number | null
          commune_code: string
          id: string
          nb_entreprises_exposees: number | null
          niveau_alea: number
          part_entreprises_exposees: number | null
          scenario_climatique: string
          secteur_statistique_code: string
          source: string
          type_alea: string
          updated_at: string
        }
        Insert: {
          annee_reference_bce?: number | null
          commune_code: string
          id?: string
          nb_entreprises_exposees?: number | null
          niveau_alea: number
          part_entreprises_exposees?: number | null
          scenario_climatique: string
          secteur_statistique_code: string
          source?: string
          type_alea: string
          updated_at?: string
        }
        Update: {
          annee_reference_bce?: number | null
          commune_code?: string
          id?: string
          nb_entreprises_exposees?: number | null
          niveau_alea?: number
          part_entreprises_exposees?: number | null
          scenario_climatique?: string
          secteur_statistique_code?: string
          source?: string
          type_alea?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exposition_economique_secteur_statistique_code_fkey"
            columns: ["secteur_statistique_code"]
            isOneToOne: false
            referencedRelation: "secteurs_statistiques"
            referencedColumns: ["code"]
          },
        ]
      }
      fonctions_critiques: {
        Row: {
          acteur_responsable_contact_id: string | null
          contexte_id: string
          delai_max_interruption: string | null
          id: string
          nom: string
          solution_secours: string | null
          statut_actuel: string
          updated_at: string
        }
        Insert: {
          acteur_responsable_contact_id?: string | null
          contexte_id: string
          delai_max_interruption?: string | null
          id?: string
          nom: string
          solution_secours?: string | null
          statut_actuel?: string
          updated_at?: string
        }
        Update: {
          acteur_responsable_contact_id?: string | null
          contexte_id?: string
          delai_max_interruption?: string | null
          id?: string
          nom?: string
          solution_secours?: string | null
          statut_actuel?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fonctions_critiques_acteur_responsable_contact_id_fkey"
            columns: ["acteur_responsable_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fonctions_critiques_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          contexte_id: string
          date_debut: string
          date_fin: string | null
          degre_criticite: number | null
          id: string
          niveau_actuel_id: string | null
          nom: string
          site_qg_actuel_id: string | null
          statut: string
          type_evenement: string | null
        }
        Insert: {
          contexte_id: string
          date_debut?: string
          date_fin?: string | null
          degre_criticite?: number | null
          id?: string
          niveau_actuel_id?: string | null
          nom: string
          site_qg_actuel_id?: string | null
          statut?: string
          type_evenement?: string | null
        }
        Update: {
          contexte_id?: string
          date_debut?: string
          date_fin?: string | null
          degre_criticite?: number | null
          id?: string
          niveau_actuel_id?: string | null
          nom?: string
          site_qg_actuel_id?: string | null
          statut?: string
          type_evenement?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_niveau_actuel_id_fkey"
            columns: ["niveau_actuel_id"]
            isOneToOne: false
            referencedRelation: "niveaux_escalade"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_site_qg_actuel_id_fkey"
            columns: ["site_qg_actuel_id"]
            isOneToOne: false
            referencedRelation: "sites_qg"
            referencedColumns: ["id"]
          },
        ]
      }
      indicateurs_vulnerabilite: {
        Row: {
          annee_reference: number
          categorie: string
          classe_globale: number | null
          commune_code: string
          id: string
          population_concernee: number | null
          score: number | null
          secteur_statistique_code: string
          source: string
          updated_at: string
        }
        Insert: {
          annee_reference: number
          categorie: string
          classe_globale?: number | null
          commune_code: string
          id?: string
          population_concernee?: number | null
          score?: number | null
          secteur_statistique_code: string
          source?: string
          updated_at?: string
        }
        Update: {
          annee_reference?: number
          categorie?: string
          classe_globale?: number | null
          commune_code?: string
          id?: string
          population_concernee?: number | null
          score?: number | null
          secteur_statistique_code?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicateurs_vulnerabilite_secteur_statistique_code_fkey"
            columns: ["secteur_statistique_code"]
            isOneToOne: false
            referencedRelation: "secteurs_statistiques"
            referencedColumns: ["code"]
          },
        ]
      }
      infrastructures_critiques: {
        Row: {
          actif: boolean
          adresse: string | null
          contexte_id: string
          created_at: string
          degre_criticite: number | null
          expositions_risques: string[]
          gestionnaire_contact_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nom: string
          type: string
        }
        Insert: {
          actif?: boolean
          adresse?: string | null
          contexte_id: string
          created_at?: string
          degre_criticite?: number | null
          expositions_risques?: string[]
          gestionnaire_contact_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nom: string
          type: string
        }
        Update: {
          actif?: boolean
          adresse?: string | null
          contexte_id?: string
          created_at?: string
          degre_criticite?: number | null
          expositions_risques?: string[]
          gestionnaire_contact_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nom?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "infrastructures_critiques_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infrastructures_critiques_gestionnaire_contact_id_fkey"
            columns: ["gestionnaire_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      instances_coordination: {
        Row: {
          active_depuis_degre_criticite: number | null
          contexte_id: string
          frequence_reunion: string | null
          id: string
          mode_deliberation: string | null
          niveau_id: string | null
          president_role_id: string | null
          quorum_regle: string | null
          reglement_interieur_url: string | null
          statut_activation: string
          type: string
        }
        Insert: {
          active_depuis_degre_criticite?: number | null
          contexte_id: string
          frequence_reunion?: string | null
          id?: string
          mode_deliberation?: string | null
          niveau_id?: string | null
          president_role_id?: string | null
          quorum_regle?: string | null
          reglement_interieur_url?: string | null
          statut_activation?: string
          type: string
        }
        Update: {
          active_depuis_degre_criticite?: number | null
          contexte_id?: string
          frequence_reunion?: string | null
          id?: string
          mode_deliberation?: string | null
          niveau_id?: string | null
          president_role_id?: string | null
          quorum_regle?: string | null
          reglement_interieur_url?: string | null
          statut_activation?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "instances_coordination_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instances_coordination_niveau_id_fkey"
            columns: ["niveau_id"]
            isOneToOne: false
            referencedRelation: "niveaux_escalade"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instances_coordination_president_role_id_fkey"
            columns: ["president_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      instances_coordination_membres: {
        Row: {
          contact_id: string
          instance_id: string
          voix_deliberative: boolean
        }
        Insert: {
          contact_id: string
          instance_id: string
          voix_deliberative?: boolean
        }
        Update: {
          contact_id?: string
          instance_id?: string
          voix_deliberative?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "instances_coordination_membres_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instances_coordination_membres_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances_coordination"
            referencedColumns: ["id"]
          },
        ]
      }
      livre_de_bord: {
        Row: {
          decision: string | null
          destinataire_contact_id: string | null
          expediteur_contact_id: string | null
          horodatage: string
          id: string
          incident_id: string
          message: string
          numero_ordre: number
        }
        Insert: {
          decision?: string | null
          destinataire_contact_id?: string | null
          expediteur_contact_id?: string | null
          horodatage?: string
          id?: string
          incident_id: string
          message: string
          numero_ordre: number
        }
        Update: {
          decision?: string | null
          destinataire_contact_id?: string | null
          expediteur_contact_id?: string | null
          horodatage?: string
          id?: string
          incident_id?: string
          message?: string
          numero_ordre?: number
        }
        Relationships: [
          {
            foreignKeyName: "livre_de_bord_destinataire_contact_id_fkey"
            columns: ["destinataire_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livre_de_bord_expediteur_contact_id_fkey"
            columns: ["expediteur_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livre_de_bord_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      mesures_compensatoires_suivi: {
        Row: {
          created_at: string
          date_cible: string | null
          date_realisation: string | null
          id: string
          mesure: string
          objet_risque_id: string
          quantification: string | null
          responsable_contact_id: string | null
          statut: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_cible?: string | null
          date_realisation?: string | null
          id?: string
          mesure: string
          objet_risque_id: string
          quantification?: string | null
          responsable_contact_id?: string | null
          statut?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_cible?: string | null
          date_realisation?: string | null
          id?: string
          mesure?: string
          objet_risque_id?: string
          quantification?: string | null
          responsable_contact_id?: string | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mesures_compensatoires_suivi_objet_id_fkey"
            columns: ["objet_risque_id"]
            isOneToOne: false
            referencedRelation: "objets_a_risque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesures_compensatoires_suivi_responsable_contact_id_fkey"
            columns: ["responsable_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      niveaux_escalade: {
        Row: {
          code: string
          contexte_id: string
          criteres_declenchement: string | null
          id: string
          libelle: string
          ordre: number
          role_declencheur_id: string | null
        }
        Insert: {
          code: string
          contexte_id: string
          criteres_declenchement?: string | null
          id?: string
          libelle: string
          ordre: number
          role_declencheur_id?: string | null
        }
        Update: {
          code?: string
          contexte_id?: string
          criteres_declenchement?: string | null
          id?: string
          libelle?: string
          ordre?: number
          role_declencheur_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "niveaux_escalade_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "niveaux_escalade_role_declencheur_id_fkey"
            columns: ["role_declencheur_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      objets_a_risque: {
        Row: {
          adresse: string | null
          capacite_occupants: number | null
          categorie: string
          code: string | null
          conformite_date: string | null
          conformite_prevention: boolean | null
          contexte_id: string
          decisions_a_preparer: string | null
          declencheur: string | null
          effets_cascade: string | null
          effets_directs: string | null
          hauteur_infrastructure: string | null
          id: string
          identification: string
          latitude: number | null
          longitude: number | null
          messages_publics_predefinis: string | null
          mesures_compensatoires: string | null
          mesures_preventives: string | null
          niveau_confidentialite: string
          piu_recu: boolean | null
          plan_reference_id: string | null
          ppd_conditions: string | null
          ppd_distance_securite_m: number | null
          ppd_requis: boolean
          priorite_cellule_securite: number | null
          priorite_declarant: number | null
          signaux_faibles: string | null
          type_risque: string
        }
        Insert: {
          adresse?: string | null
          capacite_occupants?: number | null
          categorie: string
          code?: string | null
          conformite_date?: string | null
          conformite_prevention?: boolean | null
          contexte_id: string
          decisions_a_preparer?: string | null
          declencheur?: string | null
          effets_cascade?: string | null
          effets_directs?: string | null
          hauteur_infrastructure?: string | null
          id?: string
          identification: string
          latitude?: number | null
          longitude?: number | null
          messages_publics_predefinis?: string | null
          mesures_compensatoires?: string | null
          mesures_preventives?: string | null
          niveau_confidentialite?: string
          piu_recu?: boolean | null
          plan_reference_id?: string | null
          ppd_conditions?: string | null
          ppd_distance_securite_m?: number | null
          ppd_requis?: boolean
          priorite_cellule_securite?: number | null
          priorite_declarant?: number | null
          signaux_faibles?: string | null
          type_risque: string
        }
        Update: {
          adresse?: string | null
          capacite_occupants?: number | null
          categorie?: string
          code?: string | null
          conformite_date?: string | null
          conformite_prevention?: boolean | null
          contexte_id?: string
          decisions_a_preparer?: string | null
          declencheur?: string | null
          effets_cascade?: string | null
          effets_directs?: string | null
          hauteur_infrastructure?: string | null
          id?: string
          identification?: string
          latitude?: number | null
          longitude?: number | null
          messages_publics_predefinis?: string | null
          mesures_compensatoires?: string | null
          mesures_preventives?: string | null
          niveau_confidentialite?: string
          piu_recu?: boolean | null
          plan_reference_id?: string | null
          ppd_conditions?: string | null
          ppd_distance_securite_m?: number | null
          ppd_requis?: boolean
          priorite_cellule_securite?: number | null
          priorite_declarant?: number | null
          signaux_faibles?: string | null
          type_risque?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_objets_a_risque_plan"
            columns: ["plan_reference_id"]
            isOneToOne: false
            referencedRelation: "plans_reference"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objets_a_risque_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
        ]
      }
      objets_a_risque_fonctions_critiques: {
        Row: {
          fonction_critique_id: string
          objet_id: string
        }
        Insert: {
          fonction_critique_id: string
          objet_id: string
        }
        Update: {
          fonction_critique_id?: string
          objet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "objets_a_risque_fonctions_critiques_fonction_critique_id_fkey"
            columns: ["fonction_critique_id"]
            isOneToOne: false
            referencedRelation: "fonctions_critiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objets_a_risque_fonctions_critiques_objet_id_fkey"
            columns: ["objet_id"]
            isOneToOne: false
            referencedRelation: "objets_a_risque"
            referencedColumns: ["id"]
          },
        ]
      }
      organes_crise_log: {
        Row: {
          declenche_par_contact_id: string | null
          degre_criticite: number | null
          horodatage: string
          id: string
          incident_id: string | null
          instance_id: string
          motif: string | null
          statut: string
        }
        Insert: {
          declenche_par_contact_id?: string | null
          degre_criticite?: number | null
          horodatage?: string
          id?: string
          incident_id?: string | null
          instance_id: string
          motif?: string | null
          statut?: string
        }
        Update: {
          declenche_par_contact_id?: string | null
          degre_criticite?: number | null
          horodatage?: string
          id?: string
          incident_id?: string | null
          instance_id?: string
          motif?: string | null
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "organes_crise_log_declenche_par_contact_id_fkey"
            columns: ["declenche_par_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organes_crise_log_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organes_crise_log_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances_coordination"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_transitoire_secteurs: {
        Row: {
          id: string
          incident_id: string
          responsable_contact_id: string | null
          secteur: string
          statut: string
          synthese: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          incident_id: string
          responsable_contact_id?: string | null
          secteur: string
          statut?: string
          synthese?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          incident_id?: string
          responsable_contact_id?: string | null
          secteur?: string
          statut?: string
          synthese?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phase_transitoire_secteurs_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phase_transitoire_secteurs_responsable_contact_id_fkey"
            columns: ["responsable_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      phases_incident: {
        Row: {
          autorite_contact_id: string | null
          date_declenchement: string
          date_levee: string | null
          horizon_temporel: string
          id: string
          incident_id: string
          motif: string | null
          niveau_id: string
          statut: string
        }
        Insert: {
          autorite_contact_id?: string | null
          date_declenchement?: string
          date_levee?: string | null
          horizon_temporel?: string
          id?: string
          incident_id: string
          motif?: string | null
          niveau_id: string
          statut?: string
        }
        Update: {
          autorite_contact_id?: string | null
          date_declenchement?: string
          date_levee?: string | null
          horizon_temporel?: string
          id?: string
          incident_id?: string
          motif?: string | null
          niveau_id?: string
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "phases_incident_autorite_contact_id_fkey"
            columns: ["autorite_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phases_incident_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phases_incident_niveau_id_fkey"
            columns: ["niveau_id"]
            isOneToOne: false
            referencedRelation: "niveaux_escalade"
            referencedColumns: ["id"]
          },
        ]
      }
      plans_action_risque: {
        Row: {
          id: string
          libelle: string
          objet_risque_id: string
          ordre: number
          responsable_contact_id: string | null
          statut: string | null
        }
        Insert: {
          id?: string
          libelle: string
          objet_risque_id: string
          ordre: number
          responsable_contact_id?: string | null
          statut?: string | null
        }
        Update: {
          id?: string
          libelle?: string
          objet_risque_id?: string
          ordre?: number
          responsable_contact_id?: string | null
          statut?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plans_action_risque_objet_id_fkey"
            columns: ["objet_risque_id"]
            isOneToOne: false
            referencedRelation: "objets_a_risque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_action_risque_responsable_contact_id_fkey"
            columns: ["responsable_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      plans_reference: {
        Row: {
          autorite_approbatrice: string | null
          contexte_id: string
          date_agrement_local: string | null
          date_approbation_autorite: string | null
          fichier_url: string | null
          frequence_mise_a_jour: string | null
          id: string
          nom: string
          objet_risque_id: string | null
          type: string
          version: string | null
        }
        Insert: {
          autorite_approbatrice?: string | null
          contexte_id: string
          date_agrement_local?: string | null
          date_approbation_autorite?: string | null
          fichier_url?: string | null
          frequence_mise_a_jour?: string | null
          id?: string
          nom: string
          objet_risque_id?: string | null
          type: string
          version?: string | null
        }
        Update: {
          autorite_approbatrice?: string | null
          contexte_id?: string
          date_agrement_local?: string | null
          date_approbation_autorite?: string | null
          fichier_url?: string | null
          frequence_mise_a_jour?: string | null
          id?: string
          nom?: string
          objet_risque_id?: string | null
          type?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plans_reference_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_reference_objet_risque_id_fkey"
            columns: ["objet_risque_id"]
            isOneToOne: false
            referencedRelation: "objets_a_risque"
            referencedColumns: ["id"]
          },
        ]
      }
      population_non_residente: {
        Row: {
          actif: boolean
          capacite_max: number | null
          contexte_id: string
          created_at: string
          gestionnaire_contact_id: string | null
          id: string
          latitude: number | null
          lieu: string
          longitude: number | null
          periode_debut: string | null
          periode_fin: string | null
          type_population: string
        }
        Insert: {
          actif?: boolean
          capacite_max?: number | null
          contexte_id: string
          created_at?: string
          gestionnaire_contact_id?: string | null
          id?: string
          latitude?: number | null
          lieu: string
          longitude?: number | null
          periode_debut?: string | null
          periode_fin?: string | null
          type_population: string
        }
        Update: {
          actif?: boolean
          capacite_max?: number | null
          contexte_id?: string
          created_at?: string
          gestionnaire_contact_id?: string | null
          id?: string
          latitude?: number | null
          lieu?: string
          longitude?: number | null
          periode_debut?: string | null
          periode_fin?: string | null
          type_population?: string
        }
        Relationships: [
          {
            foreignKeyName: "population_non_residente_contact_gestionnaire_id_fkey"
            columns: ["gestionnaire_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "population_non_residente_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
        ]
      }
      registre_expertises: {
        Row: {
          actif: boolean
          contact_id: string | null
          contexte_id: string
          created_at: string
          description: string | null
          disponibilite: string | null
          domaine_expertise: string
          id: string
        }
        Insert: {
          actif?: boolean
          contact_id?: string | null
          contexte_id: string
          created_at?: string
          description?: string | null
          disponibilite?: string | null
          domaine_expertise: string
          id?: string
        }
        Update: {
          actif?: boolean
          contact_id?: string | null
          contexte_id?: string
          created_at?: string
          description?: string | null
          disponibilite?: string | null
          domaine_expertise?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registre_expertises_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registre_expertises_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
        ]
      }
      ressources: {
        Row: {
          attributs: Json | null
          categorie: string
          conditions_partage: string | null
          contact_id: string | null
          contexte_id: string
          convention_id: string | null
          disponible_hors_contexte: boolean
          id: string
          nom: string
          rayon_partage_km: number | null
          type_public_prive: string
        }
        Insert: {
          attributs?: Json | null
          categorie: string
          conditions_partage?: string | null
          contact_id?: string | null
          contexte_id: string
          convention_id?: string | null
          disponible_hors_contexte?: boolean
          id?: string
          nom: string
          rayon_partage_km?: number | null
          type_public_prive: string
        }
        Update: {
          attributs?: Json | null
          categorie?: string
          conditions_partage?: string | null
          contact_id?: string | null
          contexte_id?: string
          convention_id?: string | null
          disponible_hors_contexte?: boolean
          id?: string
          nom?: string
          rayon_partage_km?: number | null
          type_public_prive?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ressources_convention"
            columns: ["convention_id"]
            isOneToOne: false
            referencedRelation: "conventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ressources_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ressources_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
        ]
      }
      rex_recommandations: {
        Row: {
          constat: string
          created_at: string
          echeance: string | null
          evaluation_crise_id: string
          id: string
          recommandation: string
          responsable_contact_id: string | null
          statut: string
        }
        Insert: {
          constat: string
          created_at?: string
          echeance?: string | null
          evaluation_crise_id: string
          id?: string
          recommandation: string
          responsable_contact_id?: string | null
          statut?: string
        }
        Update: {
          constat?: string
          created_at?: string
          echeance?: string | null
          evaluation_crise_id?: string
          id?: string
          recommandation?: string
          responsable_contact_id?: string | null
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "rex_recommandations_evaluation_crise_id_fkey"
            columns: ["evaluation_crise_id"]
            isOneToOne: false
            referencedRelation: "evaluations_crise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rex_recommandations_responsable_contact_id_fkey"
            columns: ["responsable_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          contexte_id: string
          id: string
          libelle: string
          peut_declencher_escalade: boolean
        }
        Insert: {
          code: string
          contexte_id: string
          id?: string
          libelle: string
          peut_declencher_escalade?: boolean
        }
        Update: {
          code?: string
          contexte_id?: string
          id?: string
          libelle?: string
          peut_declencher_escalade?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "roles_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
        ]
      }
      secteurs_statistiques: {
        Row: {
          code: string
          commune_code: string
          commune_nom: string | null
          created_at: string
          geom: unknown
          nom: string | null
          population: number | null
          superficie_km2: number | null
        }
        Insert: {
          code: string
          commune_code: string
          commune_nom?: string | null
          created_at?: string
          geom?: unknown
          nom?: string | null
          population?: number | null
          superficie_km2?: number | null
        }
        Update: {
          code?: string
          commune_code?: string
          commune_nom?: string | null
          created_at?: string
          geom?: unknown
          nom?: string | null
          population?: number | null
          superficie_km2?: number | null
        }
        Relationships: []
      }
      seuils_action: {
        Row: {
          actif: boolean
          action: string
          action_degradee: string | null
          contexte_id: string
          id: string
          libelle: string
          objet_risque_id: string | null
          ordre: number
          responsable_role_id: string | null
          ressource_substitution_id: string | null
          seuil_description: string
        }
        Insert: {
          actif?: boolean
          action: string
          action_degradee?: string | null
          contexte_id: string
          id?: string
          libelle: string
          objet_risque_id?: string | null
          ordre?: number
          responsable_role_id?: string | null
          ressource_substitution_id?: string | null
          seuil_description: string
        }
        Update: {
          actif?: boolean
          action?: string
          action_degradee?: string | null
          contexte_id?: string
          id?: string
          libelle?: string
          objet_risque_id?: string | null
          ordre?: number
          responsable_role_id?: string | null
          ressource_substitution_id?: string | null
          seuil_description?: string
        }
        Relationships: [
          {
            foreignKeyName: "seuils_action_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seuils_action_objet_risque_id_fkey"
            columns: ["objet_risque_id"]
            isOneToOne: false
            referencedRelation: "objets_a_risque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seuils_action_responsable_role_id_fkey"
            columns: ["responsable_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seuils_action_ressource_substitution_id_fkey"
            columns: ["ressource_substitution_id"]
            isOneToOne: false
            referencedRelation: "ressources"
            referencedColumns: ["id"]
          },
        ]
      }
      seuils_meteo_declencheurs: {
        Row: {
          actif: boolean
          action_associee: string | null
          contexte_id: string
          created_at: string
          id: string
          libelle: string
          objet_risque_id: string | null
          operateur: string
          parametre: string
          unite: string | null
          valeur_seuil: number
        }
        Insert: {
          actif?: boolean
          action_associee?: string | null
          contexte_id: string
          created_at?: string
          id?: string
          libelle: string
          objet_risque_id?: string | null
          operateur: string
          parametre: string
          unite?: string | null
          valeur_seuil: number
        }
        Update: {
          actif?: boolean
          action_associee?: string | null
          contexte_id?: string
          created_at?: string
          id?: string
          libelle?: string
          objet_risque_id?: string | null
          operateur?: string
          parametre?: string
          unite?: string | null
          valeur_seuil?: number
        }
        Relationships: [
          {
            foreignKeyName: "seuils_meteo_declencheurs_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seuils_meteo_declencheurs_objet_risque_id_fkey"
            columns: ["objet_risque_id"]
            isOneToOne: false
            referencedRelation: "objets_a_risque"
            referencedColumns: ["id"]
          },
        ]
      }
      sites_qg: {
        Row: {
          acces: Json | null
          actif: boolean
          adresse: string | null
          contexte_id: string
          equipements: Json | null
          id: string
          latitude: number | null
          longitude: number | null
          nom: string
          priorite: number
        }
        Insert: {
          acces?: Json | null
          actif?: boolean
          adresse?: string | null
          contexte_id: string
          equipements?: Json | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nom: string
          priorite?: number
        }
        Update: {
          acces?: Json | null
          actif?: boolean
          adresse?: string | null
          contexte_id?: string
          equipements?: Json | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nom?: string
          priorite?: number
        }
        Relationships: [
          {
            foreignKeyName: "sites_qg_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "contextes"
            referencedColumns: ["id"]
          },
        ]
      }
      sitrep_disciplines: {
        Row: {
          actions_en_cours: string | null
          besoins_internes: string | null
          demandes_vers_autres_disciplines: string | null
          discipline_id: string
          id: string
          personnes_presentes: Json | null
          remarques: string | null
          sitrep_id: string
        }
        Insert: {
          actions_en_cours?: string | null
          besoins_internes?: string | null
          demandes_vers_autres_disciplines?: string | null
          discipline_id: string
          id?: string
          personnes_presentes?: Json | null
          remarques?: string | null
          sitrep_id: string
        }
        Update: {
          actions_en_cours?: string | null
          besoins_internes?: string | null
          demandes_vers_autres_disciplines?: string | null
          discipline_id?: string
          id?: string
          personnes_presentes?: Json | null
          remarques?: string | null
          sitrep_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sitrep_disciplines_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sitrep_disciplines_sitrep_id_fkey"
            columns: ["sitrep_id"]
            isOneToOne: false
            referencedRelation: "sitreps"
            referencedColumns: ["id"]
          },
        ]
      }
      sitreps: {
        Row: {
          dir_pc_ops_contact_id: string | null
          horodatage: string
          id: string
          incident_id: string
          localisation_centre_accueil_id: string | null
          localisation_incident: string | null
          localisation_pc_ops: string | null
          localisation_pma: string | null
          localisation_ppd: string | null
          mesures_reflexes: string | null
          niveau_id: string | null
          numero: number
          type_incident: string | null
          victimes_u0: number | null
          victimes_u1: number | null
          victimes_u2: number | null
          victimes_u3: number | null
        }
        Insert: {
          dir_pc_ops_contact_id?: string | null
          horodatage?: string
          id?: string
          incident_id: string
          localisation_centre_accueil_id?: string | null
          localisation_incident?: string | null
          localisation_pc_ops?: string | null
          localisation_pma?: string | null
          localisation_ppd?: string | null
          mesures_reflexes?: string | null
          niveau_id?: string | null
          numero: number
          type_incident?: string | null
          victimes_u0?: number | null
          victimes_u1?: number | null
          victimes_u2?: number | null
          victimes_u3?: number | null
        }
        Update: {
          dir_pc_ops_contact_id?: string | null
          horodatage?: string
          id?: string
          incident_id?: string
          localisation_centre_accueil_id?: string | null
          localisation_incident?: string | null
          localisation_pc_ops?: string | null
          localisation_pma?: string | null
          localisation_ppd?: string | null
          mesures_reflexes?: string | null
          niveau_id?: string | null
          numero?: number
          type_incident?: string | null
          victimes_u0?: number | null
          victimes_u1?: number | null
          victimes_u2?: number | null
          victimes_u3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sitreps_dir_pc_ops_contact_id_fkey"
            columns: ["dir_pc_ops_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sitreps_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sitreps_localisation_centre_accueil_id_fkey"
            columns: ["localisation_centre_accueil_id"]
            isOneToOne: false
            referencedRelation: "centres_accueil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sitreps_niveau_id_fkey"
            columns: ["niveau_id"]
            isOneToOne: false
            referencedRelation: "niveaux_escalade"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      suivi_intervenants: {
        Row: {
          contact_id: string | null
          discipline_id: string | null
          horodatage: string
          id: string
          incident_id: string
          indicateur: string
          necessite_relai: boolean
          note: string | null
          valeur: string | null
        }
        Insert: {
          contact_id?: string | null
          discipline_id?: string | null
          horodatage?: string
          id?: string
          incident_id: string
          indicateur: string
          necessite_relai?: boolean
          note?: string | null
          valeur?: string | null
        }
        Update: {
          contact_id?: string | null
          discipline_id?: string | null
          horodatage?: string
          id?: string
          incident_id?: string
          indicateur?: string
          necessite_relai?: boolean
          note?: string | null
          valeur?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suivi_intervenants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suivi_intervenants_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suivi_intervenants_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      v_exposition_economique_critique: {
        Row: {
          commune_code: string | null
          nb_entreprises_exposees_total: number | null
          scenario_climatique: string | null
          type_alea: string | null
        }
        Relationships: []
      }
      v_vulnerabilite_sociale_commune: {
        Row: {
          annee_reference: number | null
          classe_moyenne: number | null
          commune_code: string | null
          population_totale: number | null
          population_vulnerable_elevee: number | null
          score_moyen: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      a_acces: {
        Args: { p_contexte_id: string; p_min?: string }
        Returns: boolean
      }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      contextes_publics: {
        Args: never
        Returns: {
          id: string
          nom: string
          type: string
        }[]
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      gettransactionid: { Args: never; Returns: unknown }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mon_niveau_acces: { Args: { p_contexte_id: string }; Returns: string }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      ressources_partageables: {
        Args: { p_contexte_id: string }
        Returns: {
          categorie: string
          conditions_partage: string
          contexte_id: string
          contexte_nom: string
          id: string
          nom: string
          rayon_partage_km: number
        }[]
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
