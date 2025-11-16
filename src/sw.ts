// src/PWA/service-worker.ts

/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */

// Importações do Workbox
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst } from 'workbox-strategies'; // Removido CacheFirst se não usado
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// 1. PRECACHING (gerenciado pelo vite-plugin-pwa com injectManifest)
cleanupOutdatedCaches(); // Limpa caches de versões anteriores do precache
precacheAndRoute(self.__WB_MANIFEST || []); // self.__WB_MANIFEST é injetado pelo plugin

// 2. CACHING PARA NAVEGAÇÃO (APP SHELL)
// Se você tiver uma SPA e quiser garantir que o index.html seja servido para navegações:
// (Opcional, pois o precache de '/' ou '/index.html' geralmente cobre isso)
// import { NavigationRoute } from 'workbox-routing'; // Descomente se for usar
// import { getCacheKeyForURL } from 'workbox-precaching'; // Descomente se for usar
// const navigationRoute = new NavigationRoute(
//   async ({ event }) => {
//     const cacheKey = getCacheKeyForURL('/index.html'); // Ou a URL do seu shell HTML
//     const cache = await self.caches.open(cacheKey); // Use self.caches
//     let cachedResponse = await cache.match(event.request);
//     if (!cachedResponse) { // Tenta encontrar o cache pelo cacheKey em si, se a request específica não estiver
//        cachedResponse = await cache.match(cacheKey);
//     }
//     return cachedResponse || fetch(event.request);
//   },
//   {
//     // Opcional: defina uma allowlist ou denylist para quais navegações essa rota se aplica
//     // allowlist: [/^\/app/], // Exemplo: apenas para rotas que começam com /app
//   }
// );
// registerRoute(navigationRoute);


// 3. RUNTIME CACHING PARA APIs E OUTROS RECURSOS

// API do Cardápio (StaleWhileRevalidate)
registerRoute(
  ({ request, url }) =>
    // Workaround para TS2367: converter request.destination para string
    String(request.destination) === 'fetch' && url.pathname.startsWith('/api/cardapio'),
  new StaleWhileRevalidate({
    cacheName: 'echef-api-cardapio-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200], // Cacheia respostas OK ou opacas (CORS)
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 dias
      }),
    ],
  })
);

// API de Comandas Abertas (NetworkFirst)
registerRoute(
  ({ request, url }) =>
    // Workaround para TS2367: converter request.destination para string
    String(request.destination) === 'fetch' && url.pathname.startsWith('/api/comandas_abertas_cache'), // ou a URL da sua API de comandas abertas
  new NetworkFirst({
    cacheName: 'echef-api-comandas-abertas-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 15, // Cache curto: 15 minutos
      }),
    ],
  })
);

// Cache para fontes do Google Fonts (ou outras fontes externas)
registerRoute(
  ({url}) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }), // Cache de 1 ano
    ],
  })
);

// Cache para imagens estáticas (se não forem precacheadas e você quiser uma estratégia específica)
// Se você precisar disso, descomente e importe CacheFirst de 'workbox-strategies'
// registerRoute(
//   ({request}) => request.destination === 'image',
//   new CacheFirst({ // Necessitaria importar CacheFirst
//     cacheName: 'echef-image-cache',
//     plugins: [
//       new CacheableResponsePlugin({ statuses: [0, 200] }),
//       new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }), // Cache de 30 dias
//     ],
//   })
// );


// 4. SERVICE WORKER LIFECYCLE EVENTS
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Service Worker] Skip waiting recebido, ativando novo SW.');
    self.skipWaiting();
  }
});

// O parâmetro 'event' não estava sendo usado, então prefixado com '_' para evitar o erro TS6133.
// Se você precisar usar event.waitUntil(), remova o '_' e use-o.
self.addEventListener('install', (_event) => {
  console.log('[Service Worker] Evento: install. SW instalado.');
  // Exemplo de uso de event.waitUntil se necessário:
  // _event.waitUntil(
  //   Promise.resolve().then(() => console.log('Alguma tarefa assíncrona na instalação concluída'))
  // );
  // Para autoUpdate, o skipWaiting pode ser chamado aqui para acelerar a ativação,
  // ou via mensagem do cliente como configurado acima.
  // self.skipWaiting(); // Descomente se quiser forçar skipWaiting na instalação.
});

self.addEventListener('activate', (_event) => {
  console.log('[Service Worker] Evento: activate. SW ativado e controlando clientes.');
  // Garante que o SW controle clientes abertos imediatamente.
  // _event.waitUntil(self.clients.claim()); // Descomente se desejar que o SW assuma o controle imediatamente.
});