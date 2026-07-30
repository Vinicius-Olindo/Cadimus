// ==========================================
// components.js - Fábrica de Elementos HTML
// ==========================================

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(texto));
  return div.innerHTML;
}

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
  const dataVenc = new Date(lancamento.data_compra + "T23:59:59");
  const hoje = new Date();
  const atrasado = lancamento.status !== "pago" && dataVenc < hoje;
  const classeStatus = lancamento.status === "pago" ? "status-pago" : atrasado ? "status-atrasado" : "status-pendente";
  const textoStatus = lancamento.status === "pago" ? "Pago" : atrasado ? "Atrasado" : "Pendente";

  // Carimbo de autor: quem lançou esse registro (importante numa carteira compartilhada)
  const nomeAutor = lancamento.criado_por_nome || "?";
  const inicialAutor = nomeAutor.charAt(0).toUpperCase();
  const corAutor = corDoAutor(nomeAutor);
  const carimboAutorHtml = lancamento.criado_por_foto
    ? `<img class="carimbo-autor carimbo-autor-foto" src="${escaparHtml(lancamento.criado_por_foto)}" alt="" title="Lançado por ${escaparHtml(nomeAutor)}" />`
    : `<span class="carimbo-autor" style="--cor-autor: ${corAutor}" title="Lançado por ${escaparHtml(nomeAutor)}">${inicialAutor}</span>`;

  // Só quem criou o lançamento (ou um admin) pode editar/excluir — o backend também garante isso,
  // aqui é só pra não mostrar botões que vão falhar ao clicar
  const usuarioLogado = obterUsuarioLogado();
  const podeGerenciar = lancamento.criado_por === usuarioLogado.id || usuarioLogado.perfil === "superadmin";
  const botoesGerenciar = podeGerenciar
    ? `<button class="btn-editar" onclick="editarLancamento(${lancamento.id})" title="Editar registro">${ICONE_LAPIS}</button>
       <button class="btn-excluir" onclick="apagarLancamento(${lancamento.id})" title="Apagar registro">${ICONE_LIXEIRA}</button>`
    : "";

  // Ícone de nota quando o lançamento tem observação
  const temNota = lancamento.nota && lancamento.nota.trim().length > 0;
  const iconeNota = temNota
    ? `<span class="item-nota-indicator" title="${escaparHtml(lancamento.nota)}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
       </span>`
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
                <span class="item-descricao">${escaparHtml(lancamento.descricao)}${iconeNota}</span>
                <span class="item-categoria">${escaparHtml(lancamento.categoria)}</span>
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
        <div class="lista-vazia-icone">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
        </div>
        <p class="lista-vazia-texto">${mensagem || "Nenhum lançamento neste período."}</p>
        <button type="button" class="lista-vazia-btn" onclick="abrirModalNovoLancamento()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Criar primeiro lançamento
        </button>
    `;
  return div;
}
