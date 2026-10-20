import { useEffect, useMemo, useState } from 'react';
import type { Track } from './types';
import { parseGpx } from './lib/gpx';
import { computeMetrics } from './lib/metrics';
import FileLoader from './components/FileLoader';
import KpiCards from './components/KpiCards';
import PitchHeatmap from './components/PitchHeatmap';
import Comparison from './components/Comparison';

// Beispiel-Dateien in public/samples, erzeugt mit `npm run samples`.
const SAMPLE_FILES = ['spieler-7.gpx', 'spieler-10.gpx'];

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [compareId, setCompareId] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    Promise.all(
      SAMPLE_FILES.map(async (file) => {
        const res = await fetch(`${import.meta.env.BASE_URL}samples/${file}`);
        return parseGpx(await res.text(), file);
      }),
    )
      .then(addTracks)
      .catch((err: Error) => setError(err.message));
  }, []);

  function addTracks(newTracks: Track[]) {
    setTracks((prev) => {
      const ids = new Set(prev.map((t) => t.id));
      const merged = [...prev, ...newTracks.filter((t) => !ids.has(t.id))];
      setSelectedId((id) => id ?? merged[0]?.id);
      setCompareId((id) => id ?? merged[1]?.id);
      return merged;
    });
  }

  const metrics = useMemo(() => new Map(tracks.map((t) => [t.id, computeMetrics(t)])), [tracks]);
  const selected = tracks.find((t) => t.id === selectedId);
  const compare = tracks.find((t) => t.id === compareId);

  return (
    <>
      <header className="topbar">
        <h1 className="logo">
          Back<span>Track</span>
        </h1>
        <FileLoader onLoad={addTracks} onError={setError} />
      </header>

      <main>
        {error && <p className="error">{error}</p>}

        {selected && (
          <section>
            <div className="section-head">
              <h2>Spieler</h2>
              <PlayerSelect tracks={tracks} value={selected.id} onChange={setSelectedId} />
            </div>
            <KpiCards metrics={metrics.get(selected.id)!} />
            <h3>Heatmap</h3>
            <PitchHeatmap track={selected} />
          </section>
        )}

        {selected && compare && (
          <section>
            <div className="section-head">
              <h2>Vergleich</h2>
              <span className="muted">{selected.playerName} gegen</span>
              <PlayerSelect tracks={tracks} value={compare.id} onChange={setCompareId} />
            </div>
            <Comparison
              a={{ name: selected.playerName, metrics: metrics.get(selected.id)! }}
              b={{ name: compare.playerName, metrics: metrics.get(compare.id)! }}
            />
          </section>
        )}
      </main>
    </>
  );
}

function PlayerSelect(props: { tracks: Track[]; value: string; onChange: (id: string) => void }) {
  return (
    <select value={props.value} onChange={(e) => props.onChange(e.target.value)}>
      {props.tracks.map((t) => (
        <option key={t.id} value={t.id}>
          {t.playerName}
        </option>
      ))}
    </select>
  );
}
