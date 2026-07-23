// ==========================================
// components.js - Fábrica de Elementos HTML
// ==========================================

const MESES_ABREV_COMPONENTES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const ICONE_LAPIS =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';
const ICONE_LIXEIRA =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

/**
 * Cria o HTML de uma linha de lançamento (despesa ou receita)
 * @param {Object} lancamento - Objeto com os dados do gasto/receita
 * @returns {HTMLElement} Elemento div pronto para ser injetado na tela
 */
function criarLinhaLancamento(lancamento) {
  const div = document.createElement("div");
  div.classList.add("linha-item");
  div.setAttribute("data-id", lancamento.id);

  // Formata o valor para a moeda local (Real)
  const valorFormatado = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(lancamento.valor);

  // Formata a data de compra para exibição brasileira
  const dataObjeto = new Date(lancamento.data_compra);
  const dataFormatada = dataObjeto.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  const diaDoMes = dataObjeto.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit" });
  const mesAbrev = MESES_ABREV_COMPONENTES[dataObjeto.getUTCMonth()];

  // Define a classe de cor baseada no tipo (receita ou despesa)
  const classeTipo = lancamento.tipo === "receita" ? "texto-receita" : "texto-despesa";
  const sinal = lancamento.tipo === "receita" ? "+" : "−";

  // Define a cor/estilo do status de pagamento
  const classeStatus = lancamento.status === "pago" ? "status-pago" : "status-pendente";
  const textoStatus = lancamento.status === "pago" ? "Pago" : "Pendente";

  // Carimbo de autor: quem lançou esse registro (importante numa carteira compartilhada)
  const nomeAutor = lancamento.criado_por_nome || "?";
  const inicialAutor = nomeAutor.charAt(0).toUpperCase();
  const corAutor = corDoAutor(nomeAutor);
  const carimboAutorHtml = lancamento.criado_por_foto
    ? `<img class="carimbo-autor carimbo-autor-foto" src="${lancamento.criado_por_foto}" alt="" title="Lançado por ${nomeAutor}" />`
    : `<span class="carimbo-autor" style="--cor-autor: ${corAutor}" title="Lançado por ${nomeAutor}">${inicialAutor}</span>`;

  // Só quem criou o lançamento (ou um admin) pode editar/excluir — o backend também garante isso,
  // aqui é só pra não mostrar botões que vão falhar ao clicar
  const usuarioLogado = obterUsuarioLogado();
  const podeGerenciar = lancamento.criado_por === usuarioLogado.id || usuarioLogado.perfil === "superadmin";
  const botoesGerenciar = podeGerenciar
    ? `<button class="btn-editar" onclick="editarLancamento(${lancamento.id})" title="Editar registro">${ICONE_LAPIS}</button>
       <button class="btn-excluir" onclick="apagarLancamento(${lancamento.id})" title="Apagar registro">${ICONE_LIXEIRA}</button>`
    : "";

  // Estrutura da linha: etiqueta de data compacta + corpo do lançamento —
  // lista de transações, não mais uma página de livro-caixa
  div.innerHTML = `
        <div class="data-chip" title="${dataFormatada}">
          <span class="data-chip-dia">${diaDoMes}</span>
          <span class="data-chip-mes">${mesAbrev}</span>
        </div>
        <div class="linha-corpo">
            <div class="item-info-principal">
                <span class="item-descricao">${lancamento.descricao}</span>
                <span class="item-categoria">${lancamento.categoria}</span>
            </div>
            <div class="item-valores">
                ${carimboAutorHtml}
                <span class="item-meio-pagamento">${lancamento.meio_pagamento}</span>
                <button type="button" class="item-status ${classeStatus}" onclick="alternarStatusLancamento(${lancamento.id}, '${lancamento.status}')" title="Clique para marcar como ${lancamento.status === "pago" ? "pendente" : "pago"}">${textoStatus}</button>
                <span class="item-valor ${classeTipo}">${sinal} ${valorFormatado}</span>
                ${botoesGerenciar}
            </div>
        </div>
  `;

  return div;
}

/**
 * Escolhe uma cor estável para o carimbo de autor a partir do nome de usuário,
 * assim a mesma pessoa sempre aparece com a mesma cor.
 * @param {string} nome
 * @returns {string} valor CSS (ex: "var(--autor-b)")
 */
function corDoAutor(nome) {
  const cores = ["var(--autor-a)", "var(--autor-b)", "var(--autor-c)", "var(--autor-d)"];
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = (hash * 31 + nome.charCodeAt(i)) >>> 0;
  }
  return cores[hash % cores.length];
}

/**
 * Cria uma mensagem visual indicando que os dados estão sendo carregados da nuvem
 * @returns {HTMLElement} Elemento de carregamento
 */
function criarFeedbackCarregamento() {
  const div = document.createElement("div");
  div.classList.add("loading-container");
  div.innerHTML = `
        <div class="spinner"></div>
        <p>Sincronizando com a nuvem CADIMUS...</p>
    `;
  return div;
}

/**
 * Cria uma mensagem para quando o mês selecionado não possuir gastos cadastrados
 * (ou quando uma busca não encontrar nada)
 * @param {string} [mensagem] - Texto customizado (opcional)
 * @returns {HTMLElement} Elemento de lista vazia
 */
function criarAvisoListaVazia(mensagem) {
  const div = document.createElement("div");
  div.classList.add("lista-vazia");
  div.innerHTML = `
        <p>${mensagem || "Página em branco por aqui. Nenhum lançamento neste período."}</p>
    `;
  return div;
}
