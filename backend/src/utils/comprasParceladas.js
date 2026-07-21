// ==========================================
// comprasParceladas.js (utils) - Geração das parcelas
// ==========================================

/**
 * Gera de uma vez TODAS as parcelas de uma compra parcelada recém-criada — do mês de
 * início até a última parcela, mesmo que sejam meses futuros. Diferente da despesa fixa
 * (que não tem fim e por isso só gera mês a mês), a compra parcelada já tem tudo definido
 * no cadastro: quantas parcelas e quando termina. Idempotente (não duplica se já existir).
 */
export async function gerarTodasParcelasDaCompra(env, compraId) {
  const { results } = await env.DB.prepare(`SELECT * FROM compras_parceladas WHERE id = ?`).bind(compraId).all();
  if (results.length === 0) return;

  const compra = results[0];
  const diaSeguro = Math.min(Math.max(compra.dia_vencimento, 1), 28);

  for (let numeroParcela = 1; numeroParcela <= compra.total_parcelas; numeroParcela++) {
    const { results: existente } = await env.DB.prepare(`SELECT id FROM lancamentos WHERE compra_parcelada_id = ? AND numero_parcela = ?`)
      .bind(compra.id, numeroParcela)
      .all();

    if (existente.length > 0) continue;

    // mes_inicio é 1-indexado; somamos (numeroParcela - 1) meses e normalizamos o ano
    let mes = compra.mes_inicio + (numeroParcela - 1);
    let ano = compra.ano_inicio;
    while (mes > 12) {
      mes -= 12;
      ano += 1;
    }

    const dataCompra = `${ano}-${String(mes).padStart(2, "0")}-${String(diaSeguro).padStart(2, "0")}`;
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

/**
 * Rede de segurança: garante que as parcelas do mês pedido existam, caso a compra tenha
 * sido criada antes desta função existir (ou algo tenha falhado na criação). Não bloqueia
 * mais meses futuros — a janela [mes_inicio, mes_inicio + total_parcelas - 1] já delimita
 * tudo que deveria existir, então não há risco de gerar parcela "cedo demais".
 */
export async function gerarLancamentosParceladosDoMes(env, carteiraIds, ano, mes) {
  const anoNum = Number(ano);
  const mesNum = Number(mes);
  if (!anoNum || !mesNum || !carteiraIds || carteiraIds.length === 0) return;

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
