// Eixo — Service Worker mínimo, só pra habilitar "Instalar aplicativo" no Android/Chrome e
// dar uma casca offline básica (abre o app mesmo sem internet, mesmo que sem dado atualizado).
//
// Importante: NUNCA intercepta nem armazena em cache chamadas pro Google Sheets/Apps Script
// (outra origem) — dado de prazo processual ou financeiro desatualizado é pior do que a tela
// não abrir. Só cuida do "shell" do próprio site (index.html, manifest, ícones), e sempre tenta
// buscar a versão mais nova na rede primeiro (network-first), só usando a cópia salva quando
// está mesmo sem internet. Isso evita o problema clássico de PWA de ficar preso numa versão
// antiga do site depois de uma atualização.
const CACHE_NAME = 'eixo-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL).catch(function () { /* não trava a instalação se algum arquivo faltar */ });
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return; // nunca intercepta POST (gravações no Apps Script)

  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return; // Sheets/Apps Script sempre direto pra rede

  event.respondWith(
    fetch(req).then(function (res) {
      var resClone = res.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put(req, resClone); });
      return res;
    }).catch(function () {
      return caches.match(req).then(function (cached) {
        return cached || caches.match('./index.html');
      });
    })
  );
});
