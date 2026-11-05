import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative Pfade, damit die Seite auch in einem Unterordner läuft (z. B. GitHub Pages).
  base: './',
});
