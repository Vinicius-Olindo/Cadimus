// ==========================================
// sw.js - Service Worker do CADIMUS
// Cacheia o "esqueleto" do app (HTML/CSS/JS estáticos).
// NUNCA intercepta chamadas à API — dados financeiros sempre vêm da rede.
// Estratégia: network-first para arquivos do app (sempre pega versão nova),
//            cache-first para ícones e logos (raramente mudam).
// ==========================================

const CACHE_NAME = "cadimus-cache-v10";

const RECURSOS_ESTATISCOS = [
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/logo.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(RECURSOS_ESTATISCOS))
      .catch((erro) => console.error("Erro ao pré-cachear recursos estáticos:", erro)),
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

  if (evento.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  const isRecursoEstatico = RECURSOS_ESTATISCOS.some((r) => url.pathname.endsWith(r.replace("./", "/")));

  if (isRecursoEstatico) {
    evento.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(evento.request).then((respostaCache) => {
          if (respostaCache) return respostaCache;
          return fetch(evento.request).then((respostaRede) => {
            if (respostaRede && respostaRede.status === 200) {
              cache.put(evento.request, respostaRede.clone());
            }
            return respostaRede;
          });
        }),
      ),
    );
    return;
  }

  evento.respondWith(
    fetch(evento.request)
      .then((respostaRede) => {
        if (respostaRede && respostaRede.status === 200) {
          const clone = respostaRede.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(evento.request, clone));
        }
        return respostaRede;
      })
      .catch(() => caches.match(evento.request).then((respostaCache) => respostaCache || caches.match("./offline.html"))),
  );
});
