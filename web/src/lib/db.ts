import type { Track } from '../types';

// Speicher im Browser (IndexedDB), bis es eine echte Datenbank gibt.
// GPX-Tracks sind zu groß für localStorage, deshalb IndexedDB.

const DB = 'backtrack';
const META = 'meta';
const TRACKS = 'tracks';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(META);
      req.result.createObjectStore(TRACKS, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void) {
  const db = await open();
  return new Promise<T | undefined>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = run(t.objectStore(store));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

export const db = {
  getMeta: <T>(key: string) => tx<T>(META, 'readonly', (s) => s.get(key)),
  setMeta: (key: string, value: unknown) => tx(META, 'readwrite', (s) => void s.put(value, key)),

  async getTracks(ids: string[]): Promise<Track[]> {
    const all = await Promise.all(ids.map((id) => tx<Track>(TRACKS, 'readonly', (s) => s.get(id))));
    return all.filter((t): t is Track => t !== undefined);
  },
  putTracks: (tracks: Track[]) => tx(TRACKS, 'readwrite', (s) => void tracks.forEach((t) => s.put(t))),
  deleteTracks: (ids: string[]) => tx(TRACKS, 'readwrite', (s) => void ids.forEach((id) => s.delete(id))),
};
