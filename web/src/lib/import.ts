import type { Player, Track } from '../types';
import { parseGpx } from './gpx';
import { readZip } from './zip';

// Optionale index.json im ZIP mit Spielerdaten, gleiches Format wie public/samples/index.json.
export interface SessionInfo {
  title: string;
  kind: string;
  place: string;
}

interface Index {
  session?: SessionInfo;
  players?: (Player & { file: string })[];
}

export interface ImportResult {
  tracks: Track[];
  session?: SessionInfo;
  errors: string[];
}

const baseName = (path: string) => path.split('/').pop()!;

// Nimmt GPX- und ZIP-Dateien gemischt entgegen. Fehlerhafte Dateien werden übersprungen und gemeldet.
export async function importFiles(files: File[]): Promise<ImportResult> {
  const result: ImportResult = { tracks: [], errors: [] };
  const gpx: { name: string; text: () => Promise<string> }[] = [];
  let index: Index = {};

  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      try {
        for (const entry of await readZip(file)) {
          if (/\.gpx$/i.test(entry.name)) gpx.push(entry);
          else if (baseName(entry.name) === 'index.json') index = JSON.parse(await entry.text());
        }
      } catch (err) {
        result.errors.push(`${file.name}: ${(err as Error).message}`);
      }
    } else if (/\.gpx$/i.test(file.name)) {
      gpx.push({ name: file.name, text: () => file.text() });
    } else {
      result.errors.push(`${file.name}: nur .gpx und .zip werden unterstützt.`);
    }
  }

  for (const entry of gpx) {
    const name = baseName(entry.name);
    try {
      const meta = index.players?.find((p) => p.file === name);
      const player = meta && { name: meta.name, number: meta.number, position: meta.position, hrMax: meta.hrMax };
      result.tracks.push(parseGpx(await entry.text(), name, player));
    } catch (err) {
      result.errors.push((err as Error).message);
    }
  }

  if (files.length && !gpx.length && !result.errors.length) result.errors.push('Keine GPX-Dateien gefunden.');
  result.session = index.session;
  return result;
}
