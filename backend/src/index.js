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
// O Origin permitido vem de env.FRONTEND_URL (configurado no wrangler.toml).
// Se a variável não estiver definida (ex.: ambiente local sem .dev.vars),
// cai para "*" para não quebrar o desenvolvimento.
// ==========================================
function comCors(resposta, frontendUrl) {
  const origem = frontendUrl || "*";
  const nova = new Response(resposta.body, resposta);
  nova.headers.set("Access-Control-Allow-Origin", origem);
  nova.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  nova.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  nova.headers.set("Content-Type", "application/json");
  return nova;
}

export default {
  async fetch(request, env, ctx) {
    const frontendUrl = env.FRONTEND_URL || "*";

    // Preflight CORS — responde antes de qualquer lógica de rota
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": frontendUrl,
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
