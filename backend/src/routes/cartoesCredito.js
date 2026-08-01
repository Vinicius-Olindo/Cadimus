import { obterUsuarioDaSessao } from "../utils/sessao.js";

export async function processarCartoesCredito(request, env, ctx) {
  const url = new URL(request.url);
  const method = request.method;
  const usuario = await obterUsuarioDaSessao(request, env, ctx);

  if (!usuario) {
    return new Response(JSON.stringify({ erro: "Não autenticado." }), { status: 401 });
  }

  // GET /api/cartoes-credito — listar cartões do usuário
  if (method === "GET") {
    const carteiraId = url.searchParams.get("carteira_id");

    let query = `SELECT c.*,
      (SELECT COUNT(*) FROM compras_parceladas cp
       WHERE cp.cartao_credito_id = c.id AND cp.ativo = 1) as parcelas_ativas,
      (SELECT COALESCE(SUM(cp.valor_parcela), 0) FROM compras_parceladas cp
       WHERE cp.cartao_credito_id = c.id AND cp.ativo = 1) as gasto_atual
      FROM cartoes_credito c
      WHERE c.criado_por = ? AND c.ativo = 1`;
    const params = [usuario.id];

    if (carteiraId) {
      query += ` AND c.carteira_id = ?`;
      params.push(Number(carteiraId));
    }

    query += ` ORDER BY c.nome`;

    const { results } = await env.DB.prepare(query).bind(...params).all();
    return new Response(JSON.stringify(results), { status: 200 });
  }

  // POST /api/cartoes-credito — criar cartão
  if (method === "POST") {
    const body = await request.json();
    const { nome, bandeira, ultimos4, dia_fechamento, dia_vencimento, limite, carteira_id } = body;

    if (!nome || !dia_fechamento || !dia_vencimento || !carteira_id) {
      return new Response(JSON.stringify({ erro: "Nome, dia de fechamento, dia de vencimento e carteira são obrigatórios." }), { status: 400 });
    }

    if (dia_fechamento < 1 || dia_fechamento > 31 || dia_vencimento < 1 || dia_vencimento > 31) {
      return new Response(JSON.stringify({ erro: "Dias devem estar entre 1 e 31." }), { status: 400 });
    }

    const { success } = await env.DB.prepare(
      `INSERT INTO cartoes_credito (nome, bandeira, ultimos4, dia_fechamento, dia_vencimento, limite, carteira_id, criado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      nome,
      bandeira || "outro",
      ultimos4 || null,
      dia_fechamento,
      dia_vencimento,
      limite || 0,
      carteira_id,
      usuario.id
    ).run();

    if (success) return new Response(JSON.stringify({ ok: true }), { status: 201 });
    return new Response(JSON.stringify({ erro: "Erro ao criar cartão." }), { status: 500 });
  }

  // PUT /api/cartoes-credito?id=X — editar cartão
  if (method === "PUT") {
    const id = Number(url.searchParams.get("id"));
    if (!id) return new Response(JSON.stringify({ erro: "ID obrigatório." }), { status: 400 });

    const body = await request.json();
    const campos = [];
    const params = [];

    for (const [chave, valor] of Object.entries(body)) {
      if (["nome", "bandeira", "ultimos4", "dia_fechamento", "dia_vencimento", "limite"].includes(chave)) {
        campos.push(`${chave} = ?`);
        params.push(valor);
      }
    }

    if (campos.length === 0) return new Response(JSON.stringify({ erro: "Nenhum campo para atualizar." }), { status: 400 });

    params.push(id, usuario.id);
    await env.DB.prepare(
      `UPDATE cartoes_credito SET ${campos.join(", ")} WHERE id = ? AND criado_por = ?`
    ).bind(...params).run();

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  // DELETE /api/cartoes-credito?id=X — desativar cartão
  if (method === "DELETE") {
    const id = Number(url.searchParams.get("id"));
    if (!id) return new Response(JSON.stringify({ erro: "ID obrigatório." }), { status: 400 });

    await env.DB.prepare(
      `UPDATE cartoes_credito SET ativo = 0 WHERE id = ? AND criado_por = ?`
    ).bind(id, usuario.id).run();

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  return new Response(JSON.stringify({ erro: "Método não permitido." }), { status: 405 });
}
