import { useState } from 'react';
import { UploadIcon, ZipIcon } from './Icons';

// Große Ablagefläche für den leeren Start: ein ZIP mit allen Dateien oder einzelne GPX-Dateien.
export default function UploadZone({ onFiles, busy }: { onFiles: (files: File[]) => void; busy: boolean }) {
  const [over, setOver] = useState(false);

  return (
    <label
      className={over ? 'dropzone over' : 'dropzone'}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <input
        type="file"
        accept=".gpx,.zip"
        multiple
        hidden
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      <span className="dropzone-icon">
        <ZipIcon />
      </span>
      <strong>{busy ? 'Dateien werden gelesen …' : 'ZIP oder GPX-Dateien hierher ziehen'}</strong>
      <span className="muted">Ein ZIP mit allen Spielern einer Einheit, oder einzelne .gpx-Dateien.</span>
      <span className="btn btn-inline">
        <UploadIcon />
        Dateien auswählen
      </span>
    </label>
  );
}
