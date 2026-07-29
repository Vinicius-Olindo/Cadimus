// ==========================================
// lancamentosRecorrentes.js (utils) - Geração automática de lançamentos recorrentes
// ==========================================

/**
 * Calcula a próxima data de ocorrência baseado na frequência
 */
function calcularProximaData(dataAtual, frequencia, diaSemana, diaMes) {
  const data = new Date(dataAtual + "T12:00:00");

  switch (frequencia) {
    case "semanal": {
      data.setDate(data.getDate() + 7);
      return data.toISOString().slice(0, 10);
    }
    case "quinzenal": {
      data.setDate(data.getDate() + 14);
      return data.toISOString().slice(0, 10);
    }
    case "mensal": {
      data.setMonth(data.getMonth() + 1);
      if (diaMes) data.setDate(Math.min(diaMes, 28));
      return data.toISOString().slice(0, 10);
    }
    case "trimestral": {
      data.setMonth(data.getMonth() + 3);
      if (diaMes) data.setDate(Math.min(diaMes, 28));
      return data.toISOString().slice(0, 10);
    }
    case "anual": {
      data.setFullYear(data.getFullYear() + 1);
      if (diaMes) data.setDate(Math.min(diaMes, 28));
      return data.toISOString().slice(0, 10);
    }
    default:
      return data.toISOString().slice(0, 10);
  }
}

/**
 * Para cada recorrência ativa, garante que exista um lançamento para o mês/ano pedido.
 */
export async function gerarLancamentosRecorrentesDoMes(env, carteiraIds, ano, mes) {
  const anoNum = Number(ano);
  const mesNum = Number(mes);
  if (!anoNum || !mesNum || !carteiraIds || carteiraIds.length === 0) return;

  const { results: recorrentes } = await env.DB.prepare(
    `SELECT * FROM lancamentos_recorrentes WHERE ativo = 1 AND carteira_id IN (${carteiraIds.map(() => "?").join(",")})`,
  )
    .bind(...carteiraIds)
    .all();

  if (recorrentes.length === 0) return;

  const chaveMes = `${anoNum}-${String(mesNum).padStart(2, "0")}`;

  for (const rec of recorrentes) {
    // Verifica se a data de início é anterior ou igual ao mês consultado
    if (rec.data_inicio > `${chaveMes}-31`) continue;

    // Verifica se já passou da data fim
    if (rec.data_fim && rec.data_fim < `${chaveMes}-01`) continue;

    // Calcula a próxima data esperada
    const proximaData = calcularProximaData(rec.data_inicio, rec.frequencia, rec.dia_semana, rec.dia_mes);
    const proximoMes = proximaData.slice(0, 7);

    // Se o próximo mês não é o mês consultado, pula
    // Para frequências como semanal/quinzenal, pode haver múltiplas ocorrências no mesmo mês
    // Nesse caso, verificamos se alguma ocorrência cai neste mês
    let deveGerar = false;

    if (rec.frequencia === "mensal" || rec.frequencia === "trimestral" || rec.frequencia === "anual") {
      deveGerar = proximoMes === chaveMes;
    } else {
      // Para semanal e quinzenal, verifica se alguma ocorrência cai neste mês
      let dataVerificacao = rec.data_inicio;
      while (dataVerificacao <= `${chaveMes}-31`) {
        if (dataVerificacao >= `${chaveMes}-01` && dataVerificacao <= `${chaveMes}-31`) {
          deveGerar = true;
          break;
        }
        dataVerificacao = calcularProximaData(dataVerificacao, rec.frequencia, rec.dia_semana, rec.dia_mes);
      }
    }

    if (!deveGerar) continue;

    // Verifica se já existe lançamento para esta recorrência neste mês
    const { results: existente } = await env.DB.prepare(
      `SELECT id FROM lancamentos WHERE recorrencia_id = ? AND strftime('%Y-%m', data_compra) = ?`,
    )
      .bind(rec.id, chaveMes)
      .all();

    if (existente.length > 0) continue;

    // Gera o lançamento
    const diaSeguro = rec.dia_mes ? Math.min(Math.max(rec.dia_mes, 1), 28) : 1;
    const dataCompra = `${chaveMes}-${String(diaSeguro).padStart(2, "0")}`;

    await env.DB.prepare(
      `INSERT INTO lancamentos (descricao, valor, data_compra, tipo, categoria, meio_pagamento, status, carteira_id, criado_por, recorrencia_id)
       VALUES (?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?)`,
    )
      .bind(rec.descricao, rec.valor, dataCompra, rec.tipo, rec.categoria, rec.meio_pagamento, rec.carteira_id, rec.criado_por, rec.id)
      .run();
  }
}
