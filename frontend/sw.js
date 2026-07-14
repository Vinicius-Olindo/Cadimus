// ==========================================
// sw.js - Service Worker do CADIMUS
// Cacheia só o "esqueleto" do app (HTML/CSS/JS estáticos).
// NUNCA intercepta chamadas à API — dados financeiros sempre vêm da rede.
// ==========================================

const CACHE_NAME = "cadimus-cache-v1";

const ARQUIVOS_PARA_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/variables.css",
  "./css/style.css",
  "./js/auth.js",
  "./js/components.js",
  "./js/main.js",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ARQUIVOS_PARA_CACHE))
      .catch((erro) => console.error("Erro ao pré-cachear o app shell:", erro)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((chave) => chave !== CACHE_NAME).map((chave) => caches.delete(chave))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);

  // Só GET, e só do mesmo domínio do app (nunca intercepta a API do backend,
  // que fica em outro domínio — dado financeiro nunca deve vir do cache)
  if (evento.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Stale-while-revalidate: responde rápido com o cache, mas já busca uma versão
  // nova em segundo plano pra próxima vez — assim não fica preso a uma versão velha.
  evento.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(evento.request).then((respostaCache) => {
        const buscaRede = fetch(evento.request)
          .then((respostaRede) => {
            if (respostaRede && respostaRede.status === 200) {
              cache.put(evento.request, respostaRede.clone());
            }
            return respostaRede;
          })
          .catch(() => respostaCache);

        return respostaCache || buscaRede;
      }),
    ),
  );
});
