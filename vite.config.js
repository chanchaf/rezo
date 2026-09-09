import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Un "site de projet" GitHub Pages (chanchaf.github.io/rezo/) sert l'app depuis un
  // sous-dossier, pas la racine : les chemins des assets doivent en tenir compte au build.
  // En dev (`npm run dev`), on garde la racine pour que localhost:5173 fonctionne normalement.
  base: command === 'build' ? '/rezo/' : '/',
  server: {
    port: 5173,
    open: true,
  },
}));
