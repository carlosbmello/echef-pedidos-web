// echef-pedidos-web/vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Imports para HTTPS
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Definição moderna de __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));


export default defineConfig({

  // Configuração para 'npm run dev'
  server: {
    host: true, 
    port: 5173, // A porta que você definiu
    https: {
      key: fs.readFileSync(path.resolve(__dirname, '../certs/local-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '../certs/local-cert.pem')),
    }
  },

  // --- ADICIONADO: Configuração para 'npm run preview' (usado pelo PM2) ---
  preview: {
    host: true,
    port: 5173, // Usar a mesma porta para consistência
    https: {
      key: fs.readFileSync(path.resolve(__dirname, '../certs/local-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '../certs/local-cert.pem')),
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
            src: 'icons/icon-512x192.png',
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