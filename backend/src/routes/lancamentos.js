// ==========================================
// lancamentos.js - Lógica de Despesas e Receitas
// ==========================================
import { obterUsuarioDaSessao } from "../utils/sessao.js";
import { obterCarteirasDoUsuario } from "../utils/carteiras.js";
import { gerarLancamentosFixosDoMes } from "../utils/despesasFixas.js";
import { gerarLancamentosParceladosDoMes } from "../utils/comprasParceladas.js";

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

      // Antes de listar, garante que as despesas fixas ativas e as parcelas do mês já foram geradas
      if (mes && ano) {
        const carteirasAlvo = carteiraId ? [Number(carteiraId)] : carteirasPermitidas;
        await gerarLancamentosFixosDoMes(env, carteirasAlvo, ano, mes);
        await gerarLancamentosParceladosDoMes(env, carteirasAlvo, ano, mes);
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
  // 3. EDITAR (hoje usado pra alternar pago/pendente, mas aceita qualquer campo)
  // ==========================================
  if (metodo === "PUT") {
    try {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ erro: "ID não fornecido." }), { status: 400 });
      }

      const { results: alvo } = await env.DB.prepare(`SELECT carteira_id, criado_por FROM lancamentos WHERE id = ?`).bind(id).all();
      if (alvo.length === 0) {
        return new Response(JSON.stringify({ erro: "Lançamento não encontrado." }), { status: 404 });
      }
      if (!carteirasPermitidas.includes(alvo[0].carteira_id)) {
        return new Response(JSON.stringify({ erro: "Acesso negado a esta carteira." }), { status: 403 });
      }

      const dados = await request.json();
      const camposPermitidos = ["descricao", "valor", "data_compra", "tipo", "categoria", "meio_pagamento", "status"];
      const camposEnviados = Object.keys(dados).filter((campo) => camposPermitidos.includes(campo));

      // Marcar pago/pendente é livre pra quem acessa a carteira. Editar os detalhes
      // (valor, descrição, categoria, etc.) é restrito a quem criou o lançamento ou a um admin.
      const apenasAlternandoStatus = camposEnviados.length > 0 && camposEnviados.every((campo) => campo === "status");
      const podeEditarDetalhes = alvo[0].criado_por === usuarioLogado.id || usuarioLogado.perfil === "superadmin";

      if (!apenasAlternandoStatus && !podeEditarDetalhes) {
        return new Response(JSON.stringify({ erro: "Só quem lançou (ou um administrador) pode editar os detalhes deste registro." }), { status: 403 });
      }

      const campos = [];
      const valores = [];

      for (const campo of camposEnviados) {
        if (campo === "status" && !["pago", "pendente"].includes(dados.status)) {
          return new Response(JSON.stringify({ erro: "Status inválido." }), { status: 400 });
        }
        if (campo === "tipo" && !["despesa", "receita"].includes(dados.tipo)) {
          return new Response(JSON.stringify({ erro: "Tipo inválido." }), { status: 400 });
        }

        campos.push(`${campo} = ?`);
        valores.push(dados[campo]);
      }

      if (campos.length === 0) {
        return new Response(JSON.stringify({ erro: "Nada para atualizar." }), { status: 400 });
      }

      valores.push(id);
      await env.DB.prepare(`UPDATE lancamentos SET ${campos.join(", ")} WHERE id = ?`)
        .bind(...valores)
        .run();

      return new Response(JSON.stringify({ mensagem: "Atualizado com sucesso." }), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao atualizar.", detalhe: erro.message }), { status: 500 });
    }
  }

  // ==========================================
  // 4. APAGAR LANÇAMENTO (DELETE)
  // ==========================================
  if (metodo === "DELETE") {
    try {
      const idParaApagar = url.searchParams.get("id");

      if (!idParaApagar) {
        return new Response(JSON.stringify({ erro: "ID não fornecido." }), { status: 400 });
      }

      const { results } = await env.DB.prepare(`SELECT carteira_id, criado_por FROM lancamentos WHERE id = ?`).bind(idParaApagar).all();

      if (results.length === 0) {
        return new Response(JSON.stringify({ erro: "Lançamento não encontrado." }), { status: 404 });
      }
      if (!carteirasPermitidas.includes(results[0].carteira_id)) {
        return new Response(JSON.stringify({ erro: "Acesso negado a esta carteira." }), { status: 403 });
      }
      if (results[0].criado_por !== usuarioLogado.id && usuarioLogado.perfil !== "superadmin") {
        return new Response(JSON.stringify({ erro: "Só quem lançou (ou um administrador) pode excluir este registro." }), { status: 403 });
      }

      await env.DB.prepare(`DELETE FROM lancamentos WHERE id = ?`).bind(idParaApagar).run();

      return new Response(JSON.stringify({ mensagem: "Lançamento apagado." }), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao apagar." }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ erro: "Método não permitido." }), { status: 405 });
}
