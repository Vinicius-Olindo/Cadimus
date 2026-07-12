// ==========================================
// index.js - O Porteiro da API (Cloudflare Worker)
// ==========================================
import { processarLogin } from "./routes/auth.js";
import { processarLancamentos } from "./routes/lancamentos.js";
import { processarUsuarios } from "./routes/usuarios.js";
import { processarCategorias } from "./routes/categorias.js";
import { processarCarteiras } from "./routes/carteiras.js";
import { processarDespesasFixas } from "./routes/despesasFixas.js";

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      // ==========================================
      // ROTA 1: LOGIN
      // ==========================================
      if (url.pathname.startsWith("/api/auth")) {
        // Chama a função que acabamos de criar, passando a requisição e o ambiente (onde está o D1)
        const respostaAuth = await processarLogin(request, env);

        // Pega a resposta gerada e adiciona os cabeçalhos de CORS antes de devolver para o navegador
        const respostaComCors = new Response(respostaAuth.body, respostaAuth);
        Object.keys(corsHeaders).forEach((chave) => {
          respostaComCors.headers.set(chave, corsHeaders[chave]);
        });
        respostaComCors.headers.set("Content-Type", "application/json");

        return respostaComCors;
      }

      // ==========================================
      // ROTA 2: LANÇAMENTOS
      // ==========================================
      if (url.pathname.startsWith("/api/lancamentos")) {
        const respostaLancamentos = await processarLancamentos(request, env);

        const respostaComCors = new Response(respostaLancamentos.body, respostaLancamentos);
        Object.keys(corsHeaders).forEach((chave) => {
          respostaComCors.headers.set(chave, corsHeaders[chave]);
        });
        respostaComCors.headers.set("Content-Type", "application/json");

        return respostaComCors;
      }
      // ==========================================
      // ROTA 3: USUÁRIOS (Painel Admin)
      // ==========================================
      if (url.pathname.startsWith("/api/usuarios")) {
        const respostaUsuarios = await processarUsuarios(request, env);

        const respostaComCors = new Response(respostaUsuarios.body, respostaUsuarios);
        Object.keys(corsHeaders).forEach((chave) => {
          respostaComCors.headers.set(chave, corsHeaders[chave]);
        });
        respostaComCors.headers.set("Content-Type", "application/json");

        return respostaComCors;
      }

      // ==========================================
      // ROTA 4: CATEGORIAS
      // ==========================================
      if (url.pathname.startsWith("/api/categorias")) {
        const respostaCategorias = await processarCategorias(request, env);

        const respostaComCors = new Response(respostaCategorias.body, respostaCategorias);
        Object.keys(corsHeaders).forEach((chave) => {
          respostaComCors.headers.set(chave, corsHeaders[chave]);
        });
        respostaComCors.headers.set("Content-Type", "application/json");

        return respostaComCors;
      }

      // ==========================================
      // ROTA 5: CARTEIRAS (CONTAS)
      // ==========================================
      if (url.pathname.startsWith("/api/carteiras")) {
        const respostaCarteiras = await processarCarteiras(request, env);

        const respostaComCors = new Response(respostaCarteiras.body, respostaCarteiras);
        Object.keys(corsHeaders).forEach((chave) => {
          respostaComCors.headers.set(chave, corsHeaders[chave]);
        });
        respostaComCors.headers.set("Content-Type", "application/json");

        return respostaComCors;
      }

      // ==========================================
      // ROTA 6: DESPESAS FIXAS
      // ==========================================
      if (url.pathname.startsWith("/api/despesas-fixas")) {
        const respostaDespesasFixas = await processarDespesasFixas(request, env);

        const respostaComCors = new Response(respostaDespesasFixas.body, respostaDespesasFixas);
        Object.keys(corsHeaders).forEach((chave) => {
          respostaComCors.headers.set(chave, corsHeaders[chave]);
        });
        respostaComCors.headers.set("Content-Type", "application/json");

        return respostaComCors;
      }
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro interno no servidor", detalhe: erro.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
