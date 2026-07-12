// ==========================================
// lancamentos.js - Lógica de Despesas e Receitas
// ==========================================
import { obterUsuarioDaSessao } from "../utils/sessao.js";
import { obterCarteirasDoUsuario } from "../utils/carteiras.js";

export async function processarLancamentos(request, env) {
  const metodo = request.method;
  const url = new URL(request.url);

  // Toda operação em lançamentos exige login
  const usuarioLogado = await obterUsuarioDaSessao(request, env);
  if (!usuarioLogado) {
    return new Response(JSON.stringify({ erro: "Não autenticado." }), { status: 401 });
  }

  // Só pode ler/gravar/apagar nas carteiras às quais tem acesso (usuarios_carteiras)
  const carteirasPermitidas = await obterCarteirasDoUsuario(env, usuarioLogado.id);

  // ==========================================
  // 1. BUSCAR LANÇAMENTOS (GET COM FILTROS)
  // ==========================================
  if (metodo === "GET") {
    try {
      const mes = url.searchParams.get("mes");
      const ano = url.searchParams.get("ano");
      const carteiraId = url.searchParams.get("carteira_id");

      if (carteiraId && !carteirasPermitidas.includes(Number(carteiraId))) {
        return new Response(JSON.stringify({ erro: "Acesso negado a esta carteira." }), { status: 403 });
      }

      if (carteirasPermitidas.length === 0) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      let query = `
        SELECT l.*, u.nome_usuario AS criado_por_nome
        FROM lancamentos l
        JOIN usuarios u ON u.id = l.criado_por
        WHERE 1=1
      `;
      let params = [];

      if (carteiraId) {
        query += ` AND l.carteira_id = ?`;
        params.push(carteiraId);
      } else {
        // Sem filtro explícito: restringe automaticamente às carteiras do usuário
        query += ` AND l.carteira_id IN (${carteirasPermitidas.map(() => "?").join(",")})`;
        params.push(...carteirasPermitidas);
      }

      if (mes && ano) {
        query += ` AND strftime('%m', l.data_compra) = ? AND strftime('%Y', l.data_compra) = ?`;
        params.push(mes.padStart(2, "0"), ano);
      }

      query += ` ORDER BY l.data_compra DESC`;

      const { results } = await env.DB.prepare(query)
        .bind(...params)
        .all();
      return new Response(JSON.stringify(results), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao buscar dados.", detalhe: erro.message }), { status: 500 });
    }
  }

  // ==========================================
  // 2. SALVAR NOVO LANÇAMENTO (POST)
  // ==========================================
  if (metodo === "POST") {
    try {
      const dados = await request.json();

      if (!carteirasPermitidas.includes(Number(dados.carteira_id))) {
        return new Response(JSON.stringify({ erro: "Acesso negado a esta carteira." }), { status: 403 });
      }

      const query = `
                INSERT INTO lancamentos 
                (descricao, valor, data_compra, tipo, categoria, meio_pagamento, status, carteira_id, criado_por)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
      await env.DB.prepare(query)
        .bind(
          dados.descricao,
          dados.valor,
          dados.data_compra,
          dados.tipo,
          dados.categoria,
          dados.meio_pagamento,
          dados.status,
          dados.carteira_id,
          usuarioLogado.id, // criado_por vem da sessão, nunca do corpo enviado pelo cliente
        )
        .run();

      return new Response(JSON.stringify({ mensagem: "Salvo com sucesso!" }), { status: 201 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao salvar." }), { status: 500 });
    }
  }

  // ==========================================
  // 3. APAGAR LANÇAMENTO (DELETE)
  // ==========================================
  if (metodo === "DELETE") {
    try {
      const idParaApagar = url.searchParams.get("id");

      if (!idParaApagar) {
        return new Response(JSON.stringify({ erro: "ID não fornecido." }), { status: 400 });
      }

      const { results } = await env.DB.prepare(`SELECT carteira_id FROM lancamentos WHERE id = ?`).bind(idParaApagar).all();

      if (results.length === 0) {
        return new Response(JSON.stringify({ erro: "Lançamento não encontrado." }), { status: 404 });
      }
      if (!carteirasPermitidas.includes(results[0].carteira_id)) {
        return new Response(JSON.stringify({ erro: "Acesso negado a esta carteira." }), { status: 403 });
      }

      await env.DB.prepare(`DELETE FROM lancamentos WHERE id = ?`).bind(idParaApagar).run();

      return new Response(JSON.stringify({ mensagem: "Lançamento apagado." }), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao apagar." }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ erro: "Método não permitido." }), { status: 405 });
}
