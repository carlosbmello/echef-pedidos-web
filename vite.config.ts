// echef-pedidos-web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({

  server: {
    host: true, 
  },

  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src', // Diretório onde o arquivo fonte do SW está (continua 'src')
      filename: 'sw.ts', // ATUALIZADO: Nome do arquivo fonte do SW (agora na raiz de srcDir)

      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        type: 'module',
      },

      injectManifest: {
        globPatterns: ['**/*.{html,ico,png,svg,json,woff2,ttf,eot}'],
        // Não defina swDest aqui, deixe o plugin usar o padrão
        // que é colocar na raiz de outDir com base no filename.
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