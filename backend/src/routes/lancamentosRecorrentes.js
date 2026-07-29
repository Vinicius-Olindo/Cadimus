// ==========================================
// lancamentosRecorrentes.js (rota) - Lançamentos com frequência customizável
// ==========================================
import { obterUsuarioDaSessao } from "../utils/sessao.js";
import { obterCarteirasDoUsuario } from "../utils/carteiras.js";

export async function processarLancamentosRecorrentes(request, env, ctx) {
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

      if (carteiraId && !carteirasPermitidas.includes(Number(carteiraId))) {
        return new Response(JSON.stringify({ erro: "Acesso negado a esta carteira." }), { status: 403 });
      }
      if (carteirasPermitidas.length === 0) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      let query = `SELECT * FROM lancamentos_recorrentes WHERE 1=1`;
      let params = [];

      if (carteiraId) {
        query += ` AND carteira_id = ?`;
        params.push(carteiraId);
      } else {
        query += ` AND carteira_id IN (${carteirasPermitidas.map(() => "?").join(",")})`;
        params.push(...carteirasPermitidas);
      }

      query += ` ORDER BY criado_em DESC`;

      const { results } = await env.DB.prepare(query)
        .bind(...params)
        .all();
      return new Response(JSON.stringify(results), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao buscar recorrências.", detalhe: erro.message }), { status: 500 });
    }
  }

  // ==========================================
  // CRIAR
  // ==========================================
  if (metodo === "POST") {
    try {
      const dados = await request.json();

      if (!carteirasPermitidas.includes(Number(dados.carteira_id))) {
        return new Response(JSON.stringify({ erro: "Acesso negado a esta carteira." }), { status: 403 });
      }

      const descricao = (dados.descricao || "").trim();
      const valor = parseFloat(dados.valor);
      const tipo = dados.tipo === "receita" ? "receita" : "despesa";
      const frequencia = dados.frequencia;
      const dataInicio = dados.data_inicio;

      if (!descricao) {
        return new Response(JSON.stringify({ erro: "Informe uma descrição." }), { status: 400 });
      }
      if (!Number.isFinite(valor) || valor <= 0) {
        return new Response(JSON.stringify({ erro: "Informe um valor válido." }), { status: 400 });
      }
      if (!["semanal", "quinzenal", "mensal", "trimestral", "anual"].includes(frequencia)) {
        return new Response(JSON.stringify({ erro: "Frequência inválida." }), { status: 400 });
      }
      if (!dataInicio) {
        return new Response(JSON.stringify({ erro: "Informe a data de início." }), { status: 400 });
      }
      if (!dados.categoria) {
        return new Response(JSON.stringify({ erro: "Escolha uma categoria." }), { status: 400 });
      }
      if (!dados.meio_pagamento) {
        return new Response(JSON.stringify({ erro: "Escolha um meio de pagamento." }), { status: 400 });
      }

      if (frequencia === "semanal" && (dados.dia_semana < 0 || dados.dia_semana > 6)) {
        return new Response(JSON.stringify({ erro: "Dia da semana inválido." }), { status: 400 });
      }
      if (["mensal", "trimestral", "anual"].includes(frequencia) && (dados.dia_mes < 1 || dados.dia_mes > 28)) {
        return new Response(JSON.stringify({ erro: "Dia do mês inválido (1-28)." }), { status: 400 });
      }

      const resultado = await env.DB.prepare(
        `INSERT INTO lancamentos_recorrentes
         (carteira_id, descricao, valor, tipo, categoria, meio_pagamento, frequencia, dia_semana, dia_mes, data_inicio, data_fim, criado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          dados.carteira_id, descricao, valor, tipo, dados.categoria, dados.meio_pagamento,
          frequencia,
          frequencia === "semanal" ? (dados.dia_semana || 0) : null,
          ["mensal", "trimestral", "anual"].includes(frequencia) ? (dados.dia_mes || 1) : null,
          dataInicio,
          dados.data_fim || null,
          usuarioLogado.id,
        )
        .run();

      return new Response(JSON.stringify({ id: resultado.meta.last_row_id, mensagem: "Recorrência criada!" }), { status: 201 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao criar recorrência.", detalhe: erro.message }), { status: 500 });
    }
  }

  // ==========================================
  // EDITAR / PAUSAR
  // ==========================================
  if (metodo === "PUT") {
    try {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ erro: "ID não fornecido." }), { status: 400 });
      }

      const { results: alvo } = await env.DB.prepare(`SELECT carteira_id FROM lancamentos_recorrentes WHERE id = ?`).bind(id).all();
      if (alvo.length === 0) {
        return new Response(JSON.stringify({ erro: "Recorrência não encontrada." }), { status: 404 });
      }
      if (!carteirasPermitidas.includes(alvo[0].carteira_id)) {
        return new Response(JSON.stringify({ erro: "Acesso negado." }), { status: 403 });
      }

      const dados = await request.json();
      const campos = [];
      const valores = [];

      if (dados.descricao !== undefined) { campos.push("descricao = ?"); valores.push(String(dados.descricao).trim()); }
      if (dados.valor !== undefined) {
        const v = parseFloat(dados.valor);
        if (!Number.isFinite(v) || v <= 0) return new Response(JSON.stringify({ erro: "Valor inválido." }), { status: 400 });
        campos.push("valor = ?"); valores.push(v);
      }
      if (dados.tipo !== undefined) { campos.push("tipo = ?"); valores.push(dados.tipo === "receita" ? "receita" : "despesa"); }
      if (dados.categoria !== undefined) { campos.push("categoria = ?"); valores.push(dados.categoria); }
      if (dados.meio_pagamento !== undefined) { campos.push("meio_pagamento = ?"); valores.push(dados.meio_pagamento); }
      if (dados.frequencia !== undefined) { campos.push("frequencia = ?"); valores.push(dados.frequencia); }
      if (dados.dia_semana !== undefined) { campos.push("dia_semana = ?"); valores.push(dados.dia_semana); }
      if (dados.dia_mes !== undefined) { campos.push("dia_mes = ?"); valores.push(dados.dia_mes); }
      if (dados.data_inicio !== undefined) { campos.push("data_inicio = ?"); valores.push(dados.data_inicio); }
      if (dados.data_fim !== undefined) { campos.push("data_fim = ?"); valores.push(dados.data_fim); }
      if (dados.ativo !== undefined) { campos.push("ativo = ?"); valores.push(dados.ativo ? 1 : 0); }

      if (campos.length === 0) {
        return new Response(JSON.stringify({ erro: "Nada para atualizar." }), { status: 400 });
      }

      valores.push(id);
      await env.DB.prepare(`UPDATE lancamentos_recorrentes SET ${campos.join(", ")} WHERE id = ?`)
        .bind(...valores)
        .run();

      return new Response(JSON.stringify({ mensagem: "Atualizado." }), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao atualizar.", detalhe: erro.message }), { status: 500 });
    }
  }

  // ==========================================
  // EXCLUIR
  // ==========================================
  if (metodo === "DELETE") {
    try {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ erro: "ID não fornecido." }), { status: 400 });
      }

      const { results: alvo } = await env.DB.prepare(`SELECT carteira_id FROM lancamentos_recorrentes WHERE id = ?`).bind(id).all();
      if (alvo.length === 0) {
        return new Response(JSON.stringify({ erro: "Recorrência não encontrada." }), { status: 404 });
      }
      if (!carteirasPermitidas.includes(alvo[0].carteira_id)) {
        return new Response(JSON.stringify({ erro: "Acesso negado." }), { status: 403 });
      }

      await env.DB.prepare(`UPDATE lancamentos SET recorrencia_id = NULL WHERE recorrencia_id = ?`).bind(id).run();
      await env.DB.prepare(`DELETE FROM lancamentos_recorrentes WHERE id = ?`).bind(id).run();

      return new Response(JSON.stringify({ mensagem: "Recorrência excluída." }), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao excluir.", detalhe: erro.message }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ erro: "Método não permitido." }), { status: 405 });
}
