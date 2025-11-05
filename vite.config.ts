// echef-pedidos-web/vite.config.ts (VERSÃO FINAL COM LÓGICA CONDICIONAL)

import { defineConfig, loadEnv } from 'vite';
import type { ServerOptions } from 'vite'; // Importa o TIPO separadamente
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente do arquivo .env correspondente
  const env = loadEnv(mode, process.cwd(), '');

  // Log de diagnóstico
  console.log('--- VITE CONFIG DEBUG ---');
  console.log('Modo de Build:', mode);
  console.log('USE_HTTPS:', env.USE_HTTPS);
  console.log('VITE_API_BASE_URL:', env.VITE_API_BASE_URL);
  console.log('-------------------------');

  // Objeto base de configuração do servidor
  const serverConfig: ServerOptions = {
    host: true, 
    port: 5173, // Sua porta de desenvolvimento
  };

  // ----- INÍCIO DA LÓGICA CONDICIONAL -----
  // Só tenta carregar os certificados HTTPS se a variável USE_HTTPS for 'true'
  if (env.USE_HTTPS === 'true') {
    console.log('--- MODO HTTPS ATIVADO (Desenvolvimento Local) ---');
    try {
      // Define a configuração HTTPS para o objeto serverConfig
      serverConfig.https = {
        key: fs.readFileSync(path.resolve(__dirname, '../certs/local-key.pem')),
        cert: fs.readFileSync(path.resolve(__dirname, '../certs/local-cert.pem')),
      };
    } catch (e) {
      console.error('--- ERRO DE HTTPS ---');
      console.error('AVISO: USE_HTTPS está como "true", mas os arquivos de certificado não foram encontrados.');
    }
  } else {
    console.log('--- MODO HTTP ATIVADO (Produção ou Desenvolvimento Padrão) ---');
  }
  // ----- FIM DA LÓGICA CONDICIONAL -----

  return {
    // Configuração para 'npm run dev'
    server: serverConfig,

    // Configuração para 'npm run preview'
    preview: serverConfig,

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
              src: 'icons/icon-512x192.png', // Corrigindo para 512x512
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
  };
});