// echef-pedidos-web/vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// --- ADICIONADO: Imports para HTTPS ---
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// --- ADICIONADO: Definição moderna de __dirname ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));


export default defineConfig({

  server: {
    host: true, 
    port: 5173, // A porta que você definiu

    // --- ADICIONADO: Configuração HTTPS ---
    https: {
      key: fs.readFileSync(path.resolve(__dirname, '../certs/localhost+3-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '../certs/localhost+3.pem')),
    }
  },

  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',

      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        type: 'module',
      },

      injectManifest: {
        globPatterns: ['**/*.{html,ico,png,svg,json,woff2,ttf,eot}'],
      },

      manifest: {
        name: 'eChef - Pedidos Web',
        short_name: 'eChef Pedidos',
        description: 'Aplicativo do garçom para o sistema eChef de comandas eletrônicas.',
        theme_color: '#007bff',
        background_color: '#FFFFFF',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  base: '/',
  build: {
    outDir: 'dist',
  }
});