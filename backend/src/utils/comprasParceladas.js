// ==========================================
// comprasParceladas.js (utils) - Geração automática das parcelas do mês
// ==========================================

/**
 * Para cada compra parcelada ativa nas carteiras informadas, garante que exista
 * o lançamento da parcela correspondente ao mês/ano pedido — só dentro da janela
 * [mes_inicio, mes_inicio + total_parcelas - 1]. Não duplica e nunca gera pra um
 * mês que ainda não começou.
 */
export async function gerarLancamentosParceladosDoMes(env, carteiraIds, ano, mes) {
  const anoNum = Number(ano);
  const mesNum = Number(mes);
  if (!anoNum || !mesNum || !carteiraIds || carteiraIds.length === 0) return;

  const hoje = new Date();
  const ehPeriodoFuturo = anoNum > hoje.getUTCFullYear() || (anoNum === hoje.getUTCFullYear() && mesNum > hoje.getUTCMonth() + 1);
  if (ehPeriodoFuturo) return;

  const { results: compras } = await env.DB.prepare(
    `SELECT * FROM compras_parceladas WHERE ativo = 1 AND carteira_id IN (${carteiraIds.map(() => "?").join(",")})`,
  )
    .bind(...carteiraIds)
    .all();

  if (compras.length === 0) return;

  const chaveMes = `${anoNum}-${String(mesNum).padStart(2, "0")}`;

  for (const compra of compras) {
    // Quantos meses se passaram desde a primeira parcela? Isso dá o número da parcela deste mês.
    const numeroParcela = (anoNum - compra.ano_inicio) * 12 + (mesNum - compra.mes_inicio) + 1;

    // Fora da janela do parcelamento (ainda não começou ou já terminou) — não gera nada
    if (numeroParcela < 1 || numeroParcela > compra.total_parcelas) continue;

    const { results: existente } = await env.DB.prepare(`SELECT id FROM lancamentos WHERE compra_parcelada_id = ? AND numero_parcela = ?`)
      .bind(compra.id, numeroParcela)
      .all();

    if (existente.length > 0) continue;

    const diaSeguro = Math.min(Math.max(compra.dia_vencimento, 1), 28);
    const dataCompra = `${chaveMes}-${String(diaSeguro).padStart(2, "0")}`;
    const descricaoComParcela = `${compra.descricao} (${numeroParcela}/${compra.total_parcelas})`;

    await env.DB.prepare(
      `INSERT INTO lancamentos
       (descricao, valor, data_compra, tipo, categoria, meio_pagamento, status, carteira_id, criado_por, compra_parcelada_id, numero_parcela)
       VALUES (?, ?, ?, 'despesa', ?, ?, 'pendente', ?, ?, ?, ?)`,
    )
      .bind(descricaoComParcela, compra.valor_parcela, dataCompra, compra.categoria, compra.meio_pagamento, compra.carteira_id, compra.criado_por, compra.id, numeroParcela)
      .run();
  }
}
