// ==========================================
// metas.js - Metas (orçamento) por categoria + depósitos
// ==========================================
import { obterUsuarioDaSessao } from "../utils/sessao.js";
import { obterCarteirasDoUsuario } from "../utils/carteiras.js";

export async function processarMetas(request, env, ctx) {
  const metodo = request.method;
  const url = new URL(request.url);

  const usuarioLogado = await obterUsuarioDaSessao(request, env, ctx);
  if (!usuarioLogado) {
    return new Response(JSON.stringify({ erro: "Não autenticado." }), { status: 401 });
  }

  const carteirasPermitidas = await obterCarteirasDoUsuario(env, usuarioLogado.id);

  // ==========================================
  // LISTAR
  // ==========================================
  if (metodo === "GET") {
    try {
      const carteiraId = url.searchParams.get("carteira_id");
      const metaId = url.searchParams.get("meta_id");

      if (carteiraId && !carteirasPermitidas.includes(Number(carteiraId))) {
        return new Response(JSON.stringify({ erro: "Acesso negado a esta carteira." }), { status: 403 });
      }
      if (carteirasPermitidas.length === 0) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      let query = `SELECT * FROM metas_categoria WHERE 1=1`;
      let params = [];

      if (carteiraId) {
        query += ` AND carteira_id = ?`;
        params.push(carteiraId);
      } else {
        query += ` AND carteira_id IN (${carteirasPermitidas.map(() => "?").join(",")})`;
        params.push(...carteirasPermitidas);
      }

      const { results } = await env.DB.prepare(query)
        .bind(...params)
        .all();

      if (metaId) {
        const metasFiltradas = results.filter((m) => m.id === Number(metaId));
        return new Response(JSON.stringify(metasFiltradas), { status: 200 });
      }

      return new Response(JSON.stringify(results), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao buscar metas." }), { status: 500 });
    }
  }

  // ==========================================
  // CRIAR OU ATUALIZAR (upsert por carteira + categoria)
  // ==========================================
  if (metodo === "POST") {
    try {
      const dados = await request.json();

      if (!carteirasPermitidas.includes(Number(dados.carteira_id))) {
        return new Response(JSON.stringify({ erro: "Acesso negado a esta carteira." }), { status: 403 });
      }

      const categoria = (dados.categoria || "").trim();
      const valorLimite = parseFloat(dados.valor_limite);

      if (!categoria) {
        return new Response(JSON.stringify({ erro: "Categoria não informada." }), { status: 400 });
      }
      if (!Number.isFinite(valorLimite) || valorLimite <= 0) {
        return new Response(JSON.stringify({ erro: "Informe um valor de meta válido." }), { status: 400 });
      }

      const resultado = await env.DB.prepare(
        `INSERT INTO metas_categoria (carteira_id, categoria, valor_limite, criado_por)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(carteira_id, categoria) DO UPDATE SET valor_limite = excluded.valor_limite`,
      )
        .bind(dados.carteira_id, categoria, valorLimite, usuarioLogado.id)
        .run();

      return new Response(JSON.stringify({ mensagem: "Meta salva com sucesso!" }), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao salvar meta.", detalhe: erro.message }), { status: 500 });
    }
  }

  // ==========================================
  // EXCLUIR (remove o limite e seus depósitos)
  // ==========================================
  if (metodo === "DELETE") {
    try {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ erro: "ID não fornecido." }), { status: 400 });
      }

      const { results: alvo } = await env.DB.prepare(`SELECT carteira_id FROM metas_categoria WHERE id = ?`).bind(id).all();
      if (alvo.length === 0) {
        return new Response(JSON.stringify({ erro: "Meta não encontrada." }), { status: 404 });
      }
      if (!carteirasPermitidas.includes(alvo[0].carteira_id)) {
        return new Response(JSON.stringify({ erro: "Acesso negado a esta carteira." }), { status: 403 });
      }

      await env.DB.prepare(`DELETE FROM meta_depositos WHERE meta_id = ?`).bind(id).run();
      await env.DB.prepare(`DELETE FROM metas_categoria WHERE id = ?`).bind(id).run();

      return new Response(JSON.stringify({ mensagem: "Meta removida." }), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao remover meta.", detalhe: erro.message }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ erro: "Método não permitido." }), { status: 405 });
}

// ==========================================
// processarMetaDepositos - CRUD de depósitos em metas
// ==========================================
export async function processarMetaDepositos(request, env, ctx) {
  const metodo = request.method;
  const url = new URL(request.url);

  const usuarioLogado = await obterUsuarioDaSessao(request, env, ctx);
  if (!usuarioLogado) {
    return new Response(JSON.stringify({ erro: "Não autenticado." }), { status: 401 });
  }

  const carteirasPermitidas = await obterCarteirasDoUsuario(env, usuarioLogado.id);

  // ==========================================
  // LISTAR DEPÓSITOS
  // ==========================================
  if (metodo === "GET") {
    try {
      const metaId = url.searchParams.get("meta_id");
      if (!metaId) {
        return new Response(JSON.stringify({ erro: "meta_id não fornecido." }), { status: 400 });
      }

      const { results: meta } = await env.DB.prepare(`SELECT carteira_id FROM metas_categoria WHERE id = ?`).bind(metaId).all();
      if (meta.length === 0) {
        return new Response(JSON.stringify({ erro: "Meta não encontrada." }), { status: 404 });
      }
      if (!carteirasPermitidas.includes(meta[0].carteira_id)) {
        return new Response(JSON.stringify({ erro: "Acesso negado." }), { status: 403 });
      }

      const { results } = await env.DB.prepare(
        `SELECT d.*, COALESCE(u.nome, u.nome_usuario) AS criado_por_nome
         FROM meta_depositos d
         JOIN usuarios u ON u.id = d.criado_por
         WHERE d.meta_id = ?
         ORDER BY d.criado_em DESC`,
      )
        .bind(metaId)
        .all();

      return new Response(JSON.stringify(results), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao buscar depósitos.", detalhe: erro.message }), { status: 500 });
    }
  }

  // ==========================================
  // CRIAR DEPÓSITO
  // ==========================================
  if (metodo === "POST") {
    try {
      const dados = await request.json();
      const metaId = dados.meta_id;
      const valor = parseFloat(dados.valor);
      const descricao = (dados.descricao || "").trim();

      if (!metaId) {
        return new Response(JSON.stringify({ erro: "meta_id não fornecido." }), { status: 400 });
      }
      if (!Number.isFinite(valor) || valor <= 0) {
        return new Response(JSON.stringify({ erro: "Informe um valor válido." }), { status: 400 });
      }

      const { results: meta } = await env.DB.prepare(`SELECT carteira_id FROM metas_categoria WHERE id = ?`).bind(metaId).all();
      if (meta.length === 0) {
        return new Response(JSON.stringify({ erro: "Meta não encontrada." }), { status: 404 });
      }
      if (!carteirasPermitidas.includes(meta[0].carteira_id)) {
        return new Response(JSON.stringify({ erro: "Acesso negado." }), { status: 403 });
      }

      const resultado = await env.DB.prepare(
        `INSERT INTO meta_depositos (meta_id, valor, descricao, criado_por) VALUES (?, ?, ?, ?)`,
      )
        .bind(metaId, valor, descricao, usuarioLogado.id)
        .run();

      return new Response(JSON.stringify({ id: resultado.meta.last_row_id, mensagem: "Depósito registrado!" }), { status: 201 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao registrar depósito.", detalhe: erro.message }), { status: 500 });
    }
  }

  // ==========================================
  // EXCLUIR DEPÓSITO
  // ==========================================
  if (metodo === "DELETE") {
    try {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ erro: "ID não fornecido." }), { status: 400 });
      }

      const { results: deposito } = await env.DB.prepare(
        `SELECT d.meta_id, m.carteira_id FROM meta_depositos d JOIN metas_categoria m ON m.id = d.meta_id WHERE d.id = ?`,
      )
        .bind(id)
        .all();

      if (deposito.length === 0) {
        return new Response(JSON.stringify({ erro: "Depósito não encontrado." }), { status: 404 });
      }
      if (!carteirasPermitidas.includes(deposito[0].carteira_id)) {
        return new Response(JSON.stringify({ erro: "Acesso negado." }), { status: 403 });
      }

      await env.DB.prepare(`DELETE FROM meta_depositos WHERE id = ?`).bind(id).run();

      return new Response(JSON.stringify({ mensagem: "Depósito removido." }), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao remover depósito.", detalhe: erro.message }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ erro: "Método não permitido." }), { status: 405 });
}
