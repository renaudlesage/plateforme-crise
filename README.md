# Crisiware 2 — plateforme de gestion de crise (monorepo)

## Structure

```
plateforme-crise/
├── apps/
│   ├── admin/        (app Admin — config d'un client, référentiels)
│   ├── qg/ terrain/ citoyen/
│   └── plateforme/   (console Plateforme — super-admin : clients, comptes, supervision)
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

## Console Plateforme (`apps/plateforme`)

Application à part, réservée au **super-admin** (compte ayant un accès `admin` au contexte
« plateforme »). Elle remplace l'ancienne section « Plateforme → Clients » de l'app Admin.

```bash
npm run dev:plateforme          # http://localhost:5177
npm run build:plateforme
```

Variables d'environnement (`apps/plateforme/.env`) : les mêmes `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` que l'app Admin, plus, en option, `VITE_URL_ADMIN` (URL de l'app
Admin : lien depuis la console et redirection des invitations faites à un client). Côté
Admin, `VITE_URL_PLATEFORME` affiche un lien « Console Plateforme » au super-admin.

Pages :

- **Supervision** : nombre de clients (dont suspendus et sans administrateur), comptes
  (actifs sur 30 j, invitations en attente, sans accès), incidents en cours sur toute la
  plateforme, dernières actions.
- **Clients** : recherche et filtres, création (type, province, rattachement facultatif du
  créateur), fiche client (modification, notes internes, suspension/réactivation, comptes
  et niveaux d'accès, invitation par email, historique).
- **Utilisateurs** : tous les comptes et leurs accès client par client ; donner/retirer un
  accès, nommer un super-admin (accès `admin` au contexte plateforme), désactiver un compte.
- **Référentiels nationaux** : sources de situation nationales, validation du catalogue de
  messages d'alerte, nucléaire (sites, rayons, blocs), formations CBRN, lexique d'appels.
- **Journal** : toutes les actions des super-admins (table `journal_plateforme`, ajout seul).

Sécurité : l'écran vérifie `est_super_admin()`, mais la vraie barrière est en base. Chaque
fonction `plateforme_*` refuse un appelant non super-admin, et le dernier super-admin actif
ne peut être ni rétrogradé, ni retiré, ni désactivé. Un client **suspendu**
(`contextes.suspendu`) n'est plus accessible à ses membres : `mon_niveau_acces()` renvoie
null, donc toutes les policies fondées sur `a_acces()` se ferment. La désactivation d'un
compte pose `auth.users.banned_until` : plus de connexion ni de renouvellement de session
(la session en cours expire au plus tard dans l'heure).

Migration : `supabase/migrations/20261019120000_console_plateforme.sql`. Fonction Edge
`inviter-membre` (source dans `supabase/functions/inviter-membre/`) : accepte désormais un
super-admin sur n'importe quel client et trace l'invitation au journal.
