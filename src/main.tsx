// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx'; // Certifique-se que o caminho para App.tsx está correto
import './index.css';     // Certifique-se que o caminho para index.css está correto

// Importa a função de registro do PWA
// Isso requer que você adicione um arquivo de declaração de tipos.
// Crie um arquivo `src/vite-env.d.ts` (ou similar) e adicione:
// /// <reference types="vite-plugin-pwa/client" />
import { registerSW } from 'virtual:pwa-register';

// Registra o Service Worker
// A função registerSW retorna uma função para disparar a atualização manualmente se necessário.
registerSW({
  onNeedRefresh() {
    // Este callback é chamado quando `registerType: 'prompt'` está configurado
    // e uma nova versão do SW está pronta.
    // Você pode mostrar uma UI para o usuário aqui. Ex: um toast com um botão "Atualizar".
    console.log('[PWA] Nova versão disponível. Por favor, atualize.');
    // if (confirm("Nova versão disponível. Atualizar agora?")) {
    //   updateSW(true); // Passar true recarrega a página e ativa o novo SW
    // }
  },
  onOfflineReady() {
    // Este callback é chamado quando o SW está instalado e os assets precacheados
    // estão prontos, indicando que o app pode funcionar offline.
    console.log('[PWA] Aplicativo pronto para funcionar offline.');
  },
  // onRegistered e onRegisterError são outros callbacks úteis
  onRegisteredSW(swUrl, _registration) {
    console.log(`[PWA] Service Worker registrado: ${swUrl}`);
    // Você pode enviar a mensagem 'SKIP_WAITING' aqui se `registerType` for 'prompt'
    // e você quiser que o SW pule a espera após o registro de uma nova versão.
    // registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  },
  onRegisterError(error) {
    console.error('[PWA] Erro no registro do Service Worker:', error);
  }
});

// Se você estiver usando 'autoUpdate' e quiser forçar uma checagem periódica por atualizações
// (geralmente não é necessário, pois o Workbox lida com isso na navegação):
// setInterval(() => {
//   updateSW();
// }, 60 * 60 * 1000); // Checa a cada hora


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);