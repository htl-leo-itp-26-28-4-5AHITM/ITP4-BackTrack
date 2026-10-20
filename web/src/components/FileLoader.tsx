import type { Track } from '../types';
import { parseGpx } from '../lib/gpx';

interface Props {
  onLoad: (tracks: Track[]) => void;
  onError: (message: string) => void;
}

// Eigene GPX-Dateien (z. B. von der Uhr) direkt im Browser laden.
export default function FileLoader({ onLoad, onError }: Props) {
  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    try {
      const tracks = await Promise.all(files.map(async (f) => parseGpx(await f.text(), f.name)));
      onLoad(tracks);
    } catch (err) {
      onError((err as Error).message);
    }
    e.target.value = '';
  }

  return (
    <label className="button">
      GPX-Datei laden
      <input type="file" accept=".gpx" multiple hidden onChange={handleChange} />
    </label>
  );
}
