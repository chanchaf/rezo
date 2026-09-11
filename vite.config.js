import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => ({
  plugins: [react()],
  // Domaine personnalisé (rezomeet.com, voir public/CNAME) : servi à la racine, pas depuis un
  // sous-dossier — contrairement à l'ancienne URL "site de projet" chanchaf.github.io/rezo/, qui
  // nécessitait un base "/rezo/" pour que les chemins des assets soient corrects. Avec un domaine
  // personnalisé, la racine "/" est correcte à la fois en dev et en build.
  base: '/',
  server: {
    port: 5173,
    open: true,
  },
}));
