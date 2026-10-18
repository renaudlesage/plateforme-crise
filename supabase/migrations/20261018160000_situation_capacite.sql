-- Page CC › « Situation » : nouvelle ressource « situation » dans les capacités des rôles.
-- Aucun rôle n'a aujourd'hui de capacité en base (0 ligne dans role_capacites) : tous retombent sur le niveau d'accès
-- (lecture / écriture / admin), donc l'ajout ne change les droits de personne. Les droits fins se règlent ensuite
-- dans Admin › Rôles.
alter table public.role_capacites
  drop constraint if exists role_capacites_ressource_check;

alter table public.role_capacites
  add constraint role_capacites_ressource_check
  check (ressource = any (array[
    'configuration', 'referentiels', 'plans_urgence', 'exercices', 'incidents', 'communication',
    'resilience_territoriale', 'conformite_legale', 'comptes', 'situation'
  ]));
