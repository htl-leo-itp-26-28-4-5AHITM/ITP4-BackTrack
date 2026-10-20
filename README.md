# ITP4AHITM-FootballTrackerProjekt
Football Tracker Projekt named BackTrack. Leading Role: Michael Scheuringer Contributers: Noah Klug, Julian Ungerhofer, Benjamin Huskic Santic

## Webseite (`web/`)

React + TypeScript mit Vite, Diagramme mit Chart.js. Für das MVP liest die Seite GPX-Dateien
von Sportuhren direkt im Browser ein. Später übernimmt das Backend das Berechnen beim Upload.

- **Übersicht:** Team-Kennzahlen, sortierbare Spielertabelle, Team-Heatmap, Laufleistung pro Spieler
- **Spieler:** Strecke, m/min, Top-Speed, Puls, Sprints, Antritte und Abstopper, Verlauf von Tempo
  und Puls, Heatmap, Vergleich 1. und 2. Halbzeit, Strecke pro Tempozone, Zeit pro Pulszone
- **Vergleich:** zwei Spieler Kennzahl für Kennzahl, Tempo über die Zeit, beide Heatmaps

Die Beispieldaten sind vier erfundene Spieler (2 × 30 min, 1 Hz, mit Puls).

```bash
cd web
npm install
npm run dev       # dann http://localhost:5173 im Browser öffnen
npm run build     # Produktions-Build nach web/dist
npm run samples   # Beispiel-GPX-Dateien in web/public/samples neu erzeugen
```

Wichtig: `index.html` nicht direkt per Doppelklick öffnen, dann bleibt die Seite weiß. Der Browser
lädt die Skripte nur über einen Server (`npm run dev` oder `npm run preview` nach dem Build).

Eigene GPX-Dateien lassen sich über „GPX-Datei laden“ öffnen. Damit die Heatmap passt, muss das
Spielfeld in `web/src/lib/geo.ts` (`DEFAULT_PITCH`) zum Platz passen, auf dem aufgezeichnet wurde.
