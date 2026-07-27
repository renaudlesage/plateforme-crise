# Plateforme de gestion de crise — monorepo

## Structure

```
plateforme-crise/
├── apps/
│   └── admin/        (app Admin — config, référentiels)
├── packages/
│   └── shared/       (client Supabase partagé)
```

## Mise en route (app Admin)

Ces commandes se lancent **sur ta machine** (le sandbox de cette conversation n'a pas
accès au réseau, donc `npm install` n'a pas pu être vérifié ici) :

```bash
cd plateforme-crise
npm install                     # installe pour tous les workspaces
cp apps/admin/.env.example apps/admin/.env
npm run dev:admin
```

L'app démarre sur http://localhost:5173.

Le `.env.example` contient déjà l'URL et la clé publique du projet Supabase de test
(`pcops-generique-test`) — pas besoin de les rechercher.

## Créer ton premier utilisateur de test

1. Dans le dashboard Supabase → **Authentication → Users → Add user**, crée un
   utilisateur avec un email/mot de passe (coche "Auto Confirm User" pour éviter
   l'email de confirmation en test).
2. Récupère son `id` (UUID) affiché dans la liste des utilisateurs.
3. Dans **SQL Editor**, donne-lui accès au contexte de test créé précédemment :

```sql
insert into acces_utilisateurs (user_id, contexte_id, niveau_acces)
values ('<uuid-utilisateur>', '149654e6-8339-4771-8201-0eab24fc07d2', 'admin');
```

4. Connecte-toi avec cet utilisateur dans l'app Admin — tu devrais atterrir sur
   l'écran de sélection de contexte, voir "Commune Test", et accéder au tableau
   de bord après sélection.

## État actuel

- ✅ Connexion email/mot de passe
- ✅ Sélection de contexte (basée sur `acces_utilisateurs`)
- ✅ Mise en page avec contexte actif visible et changeable
- ✅ Module Configuration : Rôles / Niveaux d'escalade / Disciplines (CRUD complet)
- ⬜ Modules Référentiels, Gouvernance, Accès — prochaine étape

## Module Configuration

Accessible via le lien "Configuration" dans la navigation. Trois onglets :

- **Rôles** : code + libellé + indicateur "peut déclencher une escalade"
- **Niveaux d'escalade** : ordre, rôle déclencheur (tiré des rôles), critères de
  déclenchement en texte libre
- **Disciplines** : code + libellé + actif/inactif

Les écritures passent par les policies RLS déjà en place : un compte avec
`niveau_acces = 'lecture'` verra les listes mais pas les boutons d'ajout/modification
fonctionner (l'insert/update sera rejeté côté base — un message d'erreur RLS
s'affichera).
