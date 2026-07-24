// ==========================================
// index.js - O Porteiro da API (Cloudflare Worker)
// ==========================================
import { processarLogin } from "./routes/auth.js";
import { processarLancamentos } from "./routes/lancamentos.js";
import { processarUsuarios } from "./routes/usuarios.js";
import { processarCategorias } from "./routes/categorias.js";
import { processarCarteiras } from "./routes/carteiras.js";
import { processarDespesasFixas } from "./routes/despesasFixas.js";
import { processarMetas } from "./routes/metas.js";
import { processarComprasParceladas } from "./routes/comprasParceladas.js";
import { processarLimpezaDados } from "./routes/manutencao.js";

// ==========================================
// HELPER: adiciona os headers de CORS à resposta e força Content-Type JSON.
// Centralizado aqui para não repetir o mesmo bloco em cada rota.
//
// origemPermitida vem de resolverOrigemPermitida() — é a origem da própria
// requisição, mas só se ela estiver na lista de permitidas (produção +
// endereços de desenvolvimento local). Isso permite testar em
// http://127.0.0.1:5500 (Live Server) ou http://localhost:5500 sem quebrar
// o CORS de produção.
// ==========================================
function comCors(resposta, origemPermitida) {
  const nova = new Response(resposta.body, resposta);
  nova.headers.set("Access-Control-Allow-Origin", origemPermitida);
  nova.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  nova.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  nova.headers.set("Vary", "Origin");
  nova.headers.set("Content-Type", "application/json");
  return nova;
}

// Decide qual Origin liberar: a de produção (env.FRONTEND_URL) sempre, e
// qualquer endereço de localhost/127.0.0.1 (em qualquer porta) durante
// desenvolvimento local. Se a origem da requisição não bater com nenhuma
// dessas, cai para env.FRONTEND_URL mesmo (a requisição vai ser bloqueada
// pelo navegador, como deveria).
function resolverOrigemPermitida(request, env) {
  const origemFrontendProducao = env.FRONTEND_URL || "*";
  const origemRequisicao = request.headers.get("Origin") || "";
  const ehLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origemRequisicao);

  if (ehLocalhost) return origemRequisicao;
  if (origemRequisicao === origemFrontendProducao) return origemRequisicao;
  return origemFrontendProducao;
}

export default {
  async fetch(request, env, ctx) {
    const frontendUrl = resolverOrigemPermitida(request, env);

    // Preflight CORS — responde antes de qualquer lógica de rota
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": frontendUrl,
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Vary": "Origin",
        },
      });
    }

    const url = new URL(request.url);

    try {
      // ==========================================
      // ROTA 1: LOGIN
      // ==========================================
      if (url.pathname.startsWith("/api/auth")) {
        return comCors(await processarLogin(request, env, ctx), frontendUrl);
      }

      // ==========================================
      // ROTA 2: LANÇAMENTOS
      // ==========================================
      if (url.pathname.startsWith("/api/lancamentos")) {
        return comCors(await processarLancamentos(request, env, ctx), frontendUrl);
      }

      // ==========================================
      // ROTA 3: USUÁRIOS (Painel Admin)
      // ==========================================
      if (url.pathname.startsWith("/api/usuarios")) {
        return comCors(await processarUsuarios(request, env, ctx), frontendUrl);
      }

      // ==========================================
      // ROTA 4: CATEGORIAS
      // ==========================================
      if (url.pathname.startsWith("/api/categorias")) {
        return comCors(await processarCategorias(request, env, ctx), frontendUrl);
      }

      // ==========================================
      // ROTA 5: CARTEIRAS (CONTAS)
      // ==========================================
      if (url.pathname.startsWith("/api/carteiras")) {
        return comCors(await processarCarteiras(request, env, ctx), frontendUrl);
      }

      // ==========================================
      // ROTA 6: DESPESAS FIXAS
      // ==========================================
      if (url.pathname.startsWith("/api/despesas-fixas")) {
        return comCors(await processarDespesasFixas(request, env, ctx), frontendUrl);
      }

      // ==========================================
      // ROTA 7: METAS POR CATEGORIA
      // ==========================================
      if (url.pathname.startsWith("/api/metas")) {
        return comCors(await processarMetas(request, env, ctx), frontendUrl);
      }

      // ==========================================
      // ROTA 8: COMPRAS PARCELADAS
      // ==========================================
      if (url.pathname.startsWith("/api/compras-parceladas")) {
        return comCors(await processarComprasParceladas(request, env, ctx), frontendUrl);
      }

      // ==========================================
      // ROTA 9: MANUTENÇÃO (zerar todos os dados — só superadmin)
      // ==========================================
      if (url.pathname.startsWith("/api/admin/zerar-dados")) {
        return comCors(await processarLimpezaDados(request, env, ctx), frontendUrl);
      }
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro interno no servidor", detalhe: erro.message }), {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": frontendUrl,
          "Content-Type": "application/json",
        },
      });
    }
  },
};
