# ITP4AHITM-FootballTrackerProjekt
Football Tracker Projekt named BackTrack. Leading Role: Michael Scheuringer Contributers: Noah Klug, Julian Ungerhofer, Benjamin Huskic Santic

## Webseite (`web/`)

React + TypeScript mit Vite, Diagramme mit Chart.js. Für das MVP liest die Seite GPX-Dateien
von Sportuhren direkt im Browser ein und berechnet daraus Strecke, max./Ø Tempo, Ø/max. Puls
und Sprints. Dazu gibt es eine Heatmap auf dem 105 × 68 m Spielfeld und einen Vergleich von
zwei Spielern. Später übernimmt das Backend das Berechnen beim Upload.

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
