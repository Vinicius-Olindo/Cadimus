// ==========================================
// orcamentos.js - Orçamentos Mensais por Categoria
// ==========================================
import { obterUsuarioDaSessao } from "../utils/sessao.js";
import { obterCarteirasDoUsuario } from "../utils/carteiras.js";

export async function processarOrcamentos(request, env, ctx) {
  const metodo = request.method;
  const url = new URL(request.url);

  // Toda operação exige login
  const usuarioLogado = await obterUsuarioDaSessao(request, env, ctx);
  if (!usuarioLogado) {
    return new Response(JSON.stringify({ erro: "Não autenticado." }), { status: 401 });
  }

  // Só pode operar nas carteiras às quais tem acesso
  const carteirasPermitidas = await obterCarteirasDoUsuario(env, usuarioLogado.id);

  // ==========================================
  // 1. BUSCAR ORÇAMENTOS (GET)
  // ==========================================
  if (metodo === "GET") {
    try {
      const mes = url.searchParams.get("mes");
      const ano = url.searchParams.get("ano");
      const carteiraId = url.searchParams.get("carteira_id");

      if (!mes || !ano) {
        return new Response(JSON.stringify({ erro: "Mês e ano são obrigatórios." }), { status: 400 });
      }

      if (carteiraId && !carteirasPermitidas.includes(Number(carteiraId))) {
        return new Response(JSON.stringify({ erro: "Acesso negado a esta carteira." }), { status: 403 });
      }

      let query = `
        SELECT o.*, 
               COALESCE(gasto.total_gasto, 0) AS total_gasto
        FROM orcamentos o
        LEFT JOIN (
          SELECT categoria, SUM(valor) AS total_gasto
          FROM lancamentos
          WHERE tipo = 'despesa'
            AND status = 'pago'
            AND strftime('%m', data_compra) = ?
            AND strftime('%Y', data_compra) = ?
          GROUP BY categoria
        ) gasto ON LOWER(gasto.categoria) = LOWER(o.categoria)
        WHERE o.mes = ? AND o.ano = ?
      `;
      const params = [mes.padStart(2, "0"), ano, mes, ano];

      if (carteiraId) {
        query += ` AND o.carteira_id = ?`;
        params.push(carteiraId);
      } else {
        if (carteirasPermitidas.length === 0) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        const placeholders = carteirasPermitidas.map(() => "?").join(",");
        query += ` AND o.carteira_id IN (${placeholders})`;
        params.push(...carteirasPermitidas);
      }

      query += ` ORDER BY o.categoria ASC`;

      const { results } = await env.DB.prepare(query).bind(...params).all();

      // Calcular progresso para cada orçamento
      const orcamentosComProgresso = results.map((o) => {
        const progresso = o.valor > 0 ? (o.total_gasto / o.valor) * 100 : 0;
        const status = progresso >= 100 ? "estourado" : progresso >= 80 ? "alerta" : "ok";
        return {
          ...o,
          progresso: Math.min(progresso, 100),
          progresso_real: progresso,
          status,
          saldo: Math.max(o.valor - o.total_gasto, 0),
        };
      });

      return new Response(JSON.stringify(orcamentosComProgresso), { status: 200 });
    } catch (erro) {
      console.error("Erro:", erro);
      return new Response(JSON.stringify({ erro: "Erro ao buscar orçamentos." }), { status: 500 });
    }
  }

  // ==========================================
  // 2. CRIAR/ATUALIZAR ORÇAMENTO (POST)
  // ==========================================
  if (metodo === "POST") {
    try {
      const dados = await request.json();

      if (!dados.categoria || !dados.valor || !dados.mes || !dados.ano || !dados.carteira_id) {
        return new Response(JSON.stringify({ erro: "Categoria, valor, mês, ano e carteira são obrigatórios." }), { status: 400 });
      }

      if (dados.valor < 0) {
        return new Response(JSON.stringify({ erro: "Valor não pode ser negativo." }), { status: 400 });
      }

      if (!carteirasPermitidas.includes(Number(dados.carteira_id))) {
        return new Response(JSON.stringify({ erro: "Acesso negado a esta carteira." }), { status: 403 });
      }

      // Upsert: insere ou atualiza se já existe ( UNIQUE constraint )
      const query = `
        INSERT INTO orcamentos (categoria, valor, carteira_id, mes, ano, criado_por)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(categoria, carteira_id, mes, ano)
        DO UPDATE SET valor = excluded.valor
      `;
      await env.DB.prepare(query)
        .bind(
          dados.categoria.toLowerCase(),
          dados.valor,
          dados.carteira_id,
          dados.mes,
          dados.ano,
          usuarioLogado.id
        )
        .run();

      return new Response(JSON.stringify({ mensagem: "Orçamento salvo com sucesso!" }), { status: 201 });
    } catch (erro) {
      console.error("Erro:", erro);
      return new Response(JSON.stringify({ erro: "Erro ao salvar orçamento." }), { status: 500 });
    }
  }

  // ==========================================
  // 3. APAGAR ORÇAMENTO (DELETE)
  // ==========================================
  if (metodo === "DELETE") {
    try {
      const id = url.searchParams.get("id");

      if (!id) {
        return new Response(JSON.stringify({ erro: "ID não fornecido." }), { status: 400 });
      }

      // Verificar se o orçamento existe e o usuário tem acesso
      const { results: alvo } = await env.DB.prepare(
        `SELECT carteira_id, criado_por FROM orcamentos WHERE id = ?`
      ).bind(id).all();

      if (alvo.length === 0) {
        return new Response(JSON.stringify({ erro: "Orçamento não encontrado." }), { status: 404 });
      }

      if (!carteirasPermitidas.includes(alvo[0].carteira_id)) {
        return new Response(JSON.stringify({ erro: "Acesso negado a esta carteira." }), { status: 403 });
      }

      // Só quem criou ou superadmin pode apagar
      if (alvo[0].criado_por !== usuarioLogado.id && usuarioLogado.perfil !== "superadmin") {
        return new Response(JSON.stringify({ erro: "Só quem criou (ou um administrador) pode excluir este orçamento." }), { status: 403 });
      }

      await env.DB.prepare(`DELETE FROM orcamentos WHERE id = ?`).bind(id).run();

      return new Response(JSON.stringify({ mensagem: "Orçamento apagado." }), { status: 200 });
    } catch (erro) {
      console.error("Erro:", erro);
      return new Response(JSON.stringify({ erro: "Erro ao apagar orçamento." }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ erro: "Método não permitido." }), { status: 405 });
}