-- Auteurs des saisies du journal des décisions (adresse du compte + rôle), pour l'affichage « saisie par … ».
-- Fonction dédiée : le CC n'a pas accès à auth.users. Déjà appliquée en base (copie versionnée a posteriori).
create or replace function public.journal_decisions_auteurs(p_incident_id uuid)
returns table(user_id uuid, email text, role_libelle text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select distinct jd.enregistre_par, u.email::text, r.libelle
  from journal_decisions jd
  join incidents i on i.id = jd.incident_id
  left join auth.users u on u.id = jd.enregistre_par
  left join acces_utilisateurs au on au.user_id = jd.enregistre_par and au.contexte_id = jd.contexte_id
  left join roles r on r.id = au.role_id
  where jd.incident_id = p_incident_id
    and a_capacite(i.contexte_id, 'incidents', 'lire');
$function$;

revoke all on function public.journal_decisions_auteurs(uuid) from public, anon;
grant execute on function public.journal_decisions_auteurs(uuid) to authenticated, service_role;
