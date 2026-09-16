// Service Worker para Sistema de Auditoria Grupo Solutions - Samsung
// v4: Network-First agressivo para scripts e estilos quando online, garantindo que atualizações
// entrem imediatamente sem prender o navegador em arquivos JS antigos/incompatíveis.

const CACHE_NAME = 'solutions-auditoria-cache-v4';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo-solutions.png'
];

// 1. Instalação: Pré-carrega os arquivos essenciais e ativa imediatamente
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker v4] Pré-carregando arquivos para suporte offline');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[Service Worker v4] Erro ao pré-carregar alguns arquivos:', err);
      });
    })
  );
});

// 2. Ativação: Limpa versões antigas de cache agressivamente
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[Service Worker v4] Removendo cache antigo:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Interceptação de Requisições
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Apenas métodos GET são interceptados
  if (req.method !== 'GET') {
    return;
  }

  const url = new URL(req.url);
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // CRÍTICO: NUNCA interceptar nem cachear chamadas de API, sincronização, downloads ou nuvem
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/downloads') ||
    url.hostname.includes('extendsclass.com')
  ) {
    return;
  }

  // Para navegação entre páginas HTML: Network-First com fallback para cache offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          console.log('[Service Worker v4] Modo Offline detectado. Servindo aplicação do cache.');
          return caches.match('/index.html').then((cachedIndex) => {
            return cachedIndex || caches.match('/');
          });
        })
    );
    return;
  }

  // Para arquivos JS e CSS: Network-First quando online para evitar telas brancas por chunks defasados
  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback offline caso a rede falhe
        return caches.match(req);
      })
  );
});
