// Service Worker para Sistema de Auditoria Grupo Solutions - Samsung
// Garante que o sistema abra e funcione 100% OFFLINE mesmo sem conexão com a internet

const CACHE_NAME = 'solutions-auditoria-cache-v1';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo-solutions.png'
];

// 1. Instalação: Pré-carrega os arquivos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pré-carregando arquivos para suporte offline');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[Service Worker] Erro ao pré-carregar alguns arquivos:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Ativação: Limpa versões antigas de cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[Service Worker] Removendo cache antigo:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Interceptação de Requisições (Cache-First com fallback de rede e gravação dinâmica)
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Apenas métodos GET são cacheados
  if (req.method !== 'GET') {
    return;
  }

  // Não interceptar requisições externas desnecessárias
  const url = new URL(req.url);
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Para navegação entre páginas HTML: se offline, serve o index.html em cache
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
          console.log('[Service Worker] Modo Offline detectado. Servindo aplicação a partir do cache.');
          return caches.match('/index.html').then((cachedIndex) => {
            return cachedIndex || caches.match('/');
          });
        })
    );
    return;
  }

  // Para recursos estáticos (JS, CSS, Imagens, Fontes): Cache-First
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Atualiza o cache em segundo plano (Stale-While-Revalidate)
        fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // Se não estava no cache, busca na rede e salva para o próximo uso offline
      return fetch(req).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return networkResponse;
      }).catch((error) => {
        console.warn('[Service Worker] Falha de rede para recurso:', req.url);
        // Tenta fallback para imagens ou index se aplicável
        if (req.destination === 'image') {
          return caches.match('/logo-solutions.png');
        }
        throw error;
      });
    })
  );
});

