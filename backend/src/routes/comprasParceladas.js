// ==========================================
// comprasParceladas.js (rota) - Gestão das compras parceladas
// ==========================================
import { obterUsuarioDaSessao } from "../utils/sessao.js";
import { obterCarteirasDoUsuario } from "../utils/carteiras.js";
import { gerarTodasParcelasDaCompra } from "../utils/comprasParceladas.js";

export async function processarComprasParceladas(request, env) {
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

      let query = `SELECT * FROM compras_parceladas WHERE 1=1`;
      let params = [];

      if (carteiraId) {
        query += ` AND carteira_id = ?`;
        params.push(carteiraId);
      } else {
        query += ` AND carteira_id IN (${carteirasPermitidas.map(() => "?").join(",")})`;
        params.push(...carteirasPermitidas);
      }

      query += ` ORDER BY ano_inicio DESC, mes_inicio DESC`;

      const { results } = await env.DB.prepare(query)
        .bind(...params)
        .all();
      return new Response(JSON.stringify(results), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao buscar compras parceladas." }), { status: 500 });
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
      const valorParcela = parseFloat(dados.valor_parcela);
      const diaVencimento = parseInt(dados.dia_vencimento, 10);
      const totalParcelas = parseInt(dados.total_parcelas, 10);
      const anoInicio = parseInt(dados.ano_inicio, 10);
      const mesInicio = parseInt(dados.mes_inicio, 10);

      if (!descricao) {
        return new Response(JSON.stringify({ erro: "Informe uma descrição." }), { status: 400 });
      }
      if (!Number.isFinite(valorParcela) || valorParcela <= 0) {
        return new Response(JSON.stringify({ erro: "Informe o valor da parcela." }), { status: 400 });
      }
      if (!Number.isInteger(diaVencimento) || diaVencimento < 1 || diaVencimento > 28) {
        return new Response(JSON.stringify({ erro: "Escolha um dia de vencimento entre 1 e 28." }), { status: 400 });
      }
      if (!Number.isInteger(totalParcelas) || totalParcelas < 2) {
        return new Response(JSON.stringify({ erro: "Uma compra parcelada precisa de pelo menos 2 parcelas (pra 1x, lance como despesa comum)." }), { status: 400 });
      }
      if (totalParcelas > 60) {
        return new Response(JSON.stringify({ erro: "Máximo de 60 parcelas." }), { status: 400 });
      }
      if (!Number.isInteger(anoInicio) || !Number.isInteger(mesInicio) || mesInicio < 1 || mesInicio > 12) {
        return new Response(JSON.stringify({ erro: "Informe o mês da primeira parcela." }), { status: 400 });
      }
      if (!dados.categoria) {
        return new Response(JSON.stringify({ erro: "Escolha uma categoria." }), { status: 400 });
      }
      if (!dados.meio_pagamento) {
        return new Response(JSON.stringify({ erro: "Escolha um meio de pagamento." }), { status: 400 });
      }

      const resultado = await env.DB.prepare(
        `INSERT INTO compras_parceladas
         (carteira_id, descricao, valor_parcela, categoria, meio_pagamento, dia_vencimento, total_parcelas, ano_inicio, mes_inicio, criado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(dados.carteira_id, descricao, valorParcela, dados.categoria, dados.meio_pagamento, diaVencimento, totalParcelas, anoInicio, mesInicio, usuarioLogado.id)
        .run();

      // Gera todas as N parcelas de uma vez (inclusive as de meses futuros) — diferente da
      // despesa fixa, aqui já sabemos exatamente quando tudo termina desde o cadastro
      await gerarTodasParcelasDaCompra(env, resultado.meta.last_row_id);

      return new Response(JSON.stringify({ id: resultado.meta.last_row_id, mensagem: "Compra parcelada cadastrada!" }), { status: 201 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao cadastrar compra parcelada.", detalhe: erro.message }), { status: 500 });
    }
  }

  // ==========================================
  // EDITAR / CANCELAR
  // ==========================================
  if (metodo === "PUT") {
    try {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ erro: "ID não fornecido." }), { status: 400 });
      }

      const { results: alvo } = await env.DB.prepare(`SELECT carteira_id FROM compras_parceladas WHERE id = ?`).bind(id).all();
      if (alvo.length === 0) {
        return new Response(JSON.stringify({ erro: "Compra parcelada não encontrada." }), { status: 404 });
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
      if (dados.valor_parcela !== undefined) {
        const valor = parseFloat(dados.valor_parcela);
        if (!Number.isFinite(valor) || valor <= 0) {
          return new Response(JSON.stringify({ erro: "Informe o valor da parcela." }), { status: 400 });
        }
        campos.push("valor_parcela = ?");
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
      await env.DB.prepare(`UPDATE compras_parceladas SET ${campos.join(", ")} WHERE id = ?`)
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

      const { results: alvo } = await env.DB.prepare(`SELECT carteira_id FROM compras_parceladas WHERE id = ?`).bind(id).all();
      if (alvo.length === 0) {
        return new Response(JSON.stringify({ erro: "Compra parcelada não encontrada." }), { status: 404 });
      }
      if (!carteirasPermitidas.includes(alvo[0].carteira_id)) {
        return new Response(JSON.stringify({ erro: "Acesso negado a esta carteira." }), { status: 403 });
      }

      // Desvincula as parcelas já geradas antes de excluir a regra (evita violar a chave estrangeira)
      await env.DB.prepare(`UPDATE lancamentos SET compra_parcelada_id = NULL WHERE compra_parcelada_id = ?`).bind(id).run();

      await env.DB.prepare(`DELETE FROM compras_parceladas WHERE id = ?`).bind(id).run();

      return new Response(JSON.stringify({ mensagem: "Compra parcelada excluída." }), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao excluir." }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ erro: "Método não permitido." }), { status: 405 });
}
