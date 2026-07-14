// ==========================================
// despesasFixas.js (utils) - Geração automática de lançamentos recorrentes
// ==========================================

/**
 * Para cada despesa fixa ativa nas carteiras informadas, garante que exista
 * um lançamento para o mês/ano pedido. Não duplica (verifica por despesa_fixa_id)
 * e nunca gera lançamento pra um mês que ainda não começou.
 */
export async function gerarLancamentosFixosDoMes(env, carteiraIds, ano, mes) {
  const anoNum = Number(ano);
  const mesNum = Number(mes);
  if (!anoNum || !mesNum || !carteiraIds || carteiraIds.length === 0) return;

  const hoje = new Date();
  const ehPeriodoFuturo = anoNum > hoje.getUTCFullYear() || (anoNum === hoje.getUTCFullYear() && mesNum > hoje.getUTCMonth() + 1);
  if (ehPeriodoFuturo) return;

  const { results: fixas } = await env.DB.prepare(
    `SELECT * FROM despesas_fixas WHERE ativo = 1 AND carteira_id IN (${carteiraIds.map(() => "?").join(",")})`,
  )
    .bind(...carteiraIds)
    .all();

  if (fixas.length === 0) return;

  const chaveMes = `${anoNum}-${String(mesNum).padStart(2, "0")}`;

  for (const fixa of fixas) {
    // Nunca gera retroativo: se a regra foi criada em agosto, não pode aparecer em julho
    const mesCriacao = String(fixa.criado_em).slice(0, 7);
    if (chaveMes < mesCriacao) continue;

    const { results: existente } = await env.DB.prepare(`SELECT id FROM lancamentos WHERE despesa_fixa_id = ? AND strftime('%Y-%m', data_compra) = ?`)
      .bind(fixa.id, chaveMes)
      .all();

    if (existente.length > 0) continue;

    // Trava entre 1 e 28 (a validação no cadastro já garante isso, aqui é só uma segunda camada de segurança)
    const diaSeguro = Math.min(Math.max(fixa.dia_vencimento, 1), 28);
    const dataCompra = `${chaveMes}-${String(diaSeguro).padStart(2, "0")}`;

    await env.DB.prepare(
      `INSERT INTO lancamentos (descricao, valor, data_compra, tipo, categoria, meio_pagamento, status, carteira_id, criado_por, despesa_fixa_id)
       VALUES (?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?)`,
    )
      .bind(fixa.descricao, fixa.valor, dataCompra, fixa.tipo, fixa.categoria, fixa.meio_pagamento, fixa.carteira_id, fixa.criado_por, fixa.id)
      .run();
  }
}
