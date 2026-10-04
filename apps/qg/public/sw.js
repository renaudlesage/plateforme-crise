// Service worker Crisiware — qg
// Écrit à la main (pas de dépendance npm). Stratégie :
//  - navigation (HTML) : network-first avec repli sur le cache (app shell hors-ligne)
//  - assets statiques same-origin (JS/CSS/images/polices) : stale-while-revalidate
//  - tout le reste (notamment les appels Supabase cross-origin, REST/RPC) : jamais mis en cache,
//    on ne sert que le réseau — pour ne jamais afficher une donnée de crise périmée.

const CACHE_NAME = 'crisiware-qg-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(
        noms
          .filter((nom) => nom.startsWith('crisiware-qg-') && nom !== CACHE_NAME)
          .map((nom) => caches.delete(nom))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const requete = event.request

  if (requete.method !== 'GET') return

  const url = new URL(requete.url)

  // Jamais mettre en cache les appels cross-origin (API Supabase REST/RPC, etc.)
  if (url.origin !== self.location.origin) return

  // Navigation (chargement/rechargement de page) : network-first, repli cache = app shell hors-ligne
  if (requete.mode === 'navigate') {
    event.respondWith(
      fetch(requete)
        .then((reponse) => {
          const copie = reponse.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(requete, copie))
          return reponse
        })
        .catch(() =>
          caches.match(requete).then((reponse) => reponse || caches.match('/index.html'))
        )
    )
    return
  }

  // Assets statiques same-origin : stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(requete).then((reponseCache) => {
        const misAJour = fetch(requete)
          .then((reponseReseau) => {
            if (reponseReseau && reponseReseau.status === 200) {
              cache.put(requete, reponseReseau.clone())
            }
            return reponseReseau
          })
          .catch(() => reponseCache)
        return reponseCache || misAJour
      })
    )
  )
})
