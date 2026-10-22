import { useEffect, useState } from 'react';

// Seiten über den Hash in der Adresse: #uebersicht, #spieler-<id>, #vergleich, #kader
export type Route = { page: 'overview' } | { page: 'player'; id?: string } | { page: 'compare' } | { page: 'kader' };

function readRoute(): Route {
  const hash = decodeURIComponent(window.location.hash.slice(1));
  if (hash.startsWith('spieler')) return { page: 'player', id: hash.slice('spieler-'.length) || undefined };
  if (hash === 'vergleich') return { page: 'compare' };
  if (hash === 'kader') return { page: 'kader' };
  return { page: 'overview' };
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(readRoute);
  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

export function go(hash: string) {
  window.location.hash = hash;
  window.scrollTo({ top: 0 });
}
