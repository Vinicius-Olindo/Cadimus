// ==========================================
// despesasFixas.js (rota) - Gestão das despesas/receitas fixas
// ==========================================
import { obterUsuarioDaSessao } from "../utils/sessao.js";
import { obterCarteirasDoUsuario } from "../utils/carteiras.js";

export async function processarDespesasFixas(request, env) {
  const metodo = request.method;
  const url = new URL(request.url);

  const usuarioLogado = await obterUsuarioDaSessao(request, env);
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

      let query = `SELECT * FROM despesas_fixas WHERE 1=1`;
      let params = [];

      if (carteiraId) {
        query += ` AND carteira_id = ?`;
        params.push(carteiraId);
      } else {
        query += ` AND carteira_id IN (${carteirasPermitidas.map(() => "?").join(",")})`;
        params.push(...carteirasPermitidas);
      }

      query += ` ORDER BY dia_vencimento ASC`;

      const { results } = await env.DB.prepare(query)
        .bind(...params)
        .all();
      return new Response(JSON.stringify(results), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao buscar despesas fixas." }), { status: 500 });
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
      const diaVencimento = parseInt(dados.dia_vencimento, 10);
      const tipo = dados.tipo === "receita" ? "receita" : "despesa";

      if (!descricao) {
        return new Response(JSON.stringify({ erro: "Informe uma descrição." }), { status: 400 });
      }
      if (!Number.isFinite(valor) || valor <= 0) {
        return new Response(JSON.stringify({ erro: "Informe um valor válido." }), { status: 400 });
      }
      if (!Number.isInteger(diaVencimento) || diaVencimento < 1 || diaVencimento > 28) {
        return new Response(JSON.stringify({ erro: "Escolha um dia de vencimento entre 1 e 28 (evita problemas em meses mais curtos)." }), { status: 400 });
      }
      if (!dados.categoria) {
        return new Response(JSON.stringify({ erro: "Escolha uma categoria." }), { status: 400 });
      }
      if (!dados.meio_pagamento) {
        return new Response(JSON.stringify({ erro: "Escolha um meio de pagamento." }), { status: 400 });
      }

      const resultado = await env.DB.prepare(
        `INSERT INTO despesas_fixas (carteira_id, descricao, valor, tipo, categoria, meio_pagamento, dia_vencimento, criado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(dados.carteira_id, descricao, valor, tipo, dados.categoria, dados.meio_pagamento, diaVencimento, usuarioLogado.id)
        .run();

      return new Response(JSON.stringify({ id: resultado.meta.last_row_id, mensagem: "Despesa fixa cadastrada!" }), { status: 201 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao cadastrar despesa fixa.", detalhe: erro.message }), { status: 500 });
    }
  }

  // ==========================================
  // EDITAR / PAUSAR / ATIVAR
  // ==========================================
  if (metodo === "PUT") {
    try {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ erro: "ID não fornecido." }), { status: 400 });
      }

      const { results: alvo } = await env.DB.prepare(`SELECT carteira_id FROM despesas_fixas WHERE id = ?`).bind(id).all();
      if (alvo.length === 0) {
        return new Response(JSON.stringify({ erro: "Despesa fixa não encontrada." }), { status: 404 });
      }
      if (!carteirasPermitidas.includes(alvo[0].carteira_id)) {
        return new Response(JSON.stringify({ erro: "Acesso negado a esta carteira." }), { status: 403 });
      }

      const dados = await request.json();
      const campos = [];
      const valores = [];

      if (dados.descricao !== undefined) {
        campos.push("descricao = ?");
        valores.push(String(dados.descricao).trim());
      }
      if (dados.valor !== undefined) {
        const valor = parseFloat(dados.valor);
        if (!Number.isFinite(valor) || valor <= 0) {
          return new Response(JSON.stringify({ erro: "Informe um valor válido." }), { status: 400 });
        }
        campos.push("valor = ?");
        valores.push(valor);
      }
      if (dados.categoria !== undefined) {
        campos.push("categoria = ?");
        valores.push(dados.categoria);
      }
      if (dados.meio_pagamento !== undefined) {
        campos.push("meio_pagamento = ?");
        valores.push(dados.meio_pagamento);
      }
      if (dados.dia_vencimento !== undefined) {
        const dia = parseInt(dados.dia_vencimento, 10);
        if (!Number.isInteger(dia) || dia < 1 || dia > 28) {
          return new Response(JSON.stringify({ erro: "Escolha um dia de vencimento entre 1 e 28." }), { status: 400 });
        }
        campos.push("dia_vencimento = ?");
        valores.push(dia);
      }
      if (dados.ativo !== undefined) {
        campos.push("ativo = ?");
        valores.push(dados.ativo ? 1 : 0);
      }

      if (campos.length === 0) {
        return new Response(JSON.stringify({ erro: "Nada para atualizar." }), { status: 400 });
      }

      valores.push(id);
      await env.DB.prepare(`UPDATE despesas_fixas SET ${campos.join(", ")} WHERE id = ?`)
        .bind(...valores)
        .run();

      return new Response(JSON.stringify({ mensagem: "Atualizado com sucesso." }), { status: 200 });
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

      const { results: alvo } = await env.DB.prepare(`SELECT carteira_id FROM despesas_fixas WHERE id = ?`).bind(id).all();
      if (alvo.length === 0) {
        return new Response(JSON.stringify({ erro: "Despesa fixa não encontrada." }), { status: 404 });
      }
      if (!carteirasPermitidas.includes(alvo[0].carteira_id)) {
        return new Response(JSON.stringify({ erro: "Acesso negado a esta carteira." }), { status: 403 });
      }

      // Desvincula os lançamentos que essa regra já gerou (eles continuam existindo,
      // só param de "pertencer" à regra) — sem isso, a chave estrangeira impede a exclusão
      await env.DB.prepare(`UPDATE lancamentos SET despesa_fixa_id = NULL WHERE despesa_fixa_id = ?`).bind(id).run();

      await env.DB.prepare(`DELETE FROM despesas_fixas WHERE id = ?`).bind(id).run();

      return new Response(JSON.stringify({ mensagem: "Despesa fixa excluída." }), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao excluir." }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ erro: "Método não permitido." }), { status: 405 });
}
