// ==========================================
// main.js - Controle de Interface, UI e Filtros
// ==========================================

// ==========================================
// HELPER: headers autenticados para chamadas à API
// ==========================================
function headersAutenticados(comJson = true) {
  const token = localStorage.getItem("cadimus_token");
  const headers = {};
  if (comJson) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// Se a API responder 401 (sessão inválida/expirada), desloga e volta pro login
function tratarSessaoExpirada(resposta) {
  if (resposta.status === 401) {
    localStorage.clear();
    alternarTelas(false);
    alert("Sua sessão expirou. Faça login novamente.");
    return true;
  }
  return false;
}

document.addEventListener("DOMContentLoaded", () => {
  inicializarFiltroMes();
  inicializarDarkMode();
  configurarMonitoresDeFiltro();
  configurarModal();
  configurarModalCarteira();
  configurarModalDespesasFixas();
  configurarPainelAdmin();
});

// --- SELETOR DE MÊS (setas, sem depender do calendário nativo do navegador) ---
const NOMES_MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function inicializarFiltroMes() {
  const campoMes = document.getElementById("filtro-mes");
  if (!campoMes) return;

  const hoje = new Date();
  definirMesExibido(hoje.getFullYear(), hoje.getMonth(), { disparaEvento: false });

  const btnAnterior = document.getElementById("btn-mes-anterior");
  const btnSeguinte = document.getElementById("btn-mes-seguinte");
  const rotulo = document.getElementById("rotulo-mes");

  btnAnterior?.addEventListener("click", () => navegarMes(-1));
  btnSeguinte?.addEventListener("click", () => navegarMes(1));
  rotulo?.addEventListener("click", () => {
    const agora = new Date();
    definirMesExibido(agora.getFullYear(), agora.getMonth());
    animarTrocaDePeriodo("agora");
  });
}

function definirMesExibido(ano, mesIndiceZero, opcoes = {}) {
  const campoMes = document.getElementById("filtro-mes");
  const rotulo = document.getElementById("rotulo-mes");
  if (!campoMes) return;

  const mesTexto = String(mesIndiceZero + 1).padStart(2, "0");
  campoMes.value = `${ano}-${mesTexto}`;
  campoMes.dataset.ano = String(ano);
  campoMes.dataset.mes = String(mesIndiceZero);

  if (rotulo) rotulo.textContent = `${NOMES_MESES[mesIndiceZero]} de ${ano}`;

  if (opcoes.disparaEvento !== false) {
    campoMes.dispatchEvent(new Event("change"));
  }
}

function navegarMes(delta) {
  const campoMes = document.getElementById("filtro-mes");
  if (!campoMes) return;

  let ano = Number(campoMes.dataset.ano);
  let mes = Number(campoMes.dataset.mes) + delta;

  if (mes < 0) {
    mes = 11;
    ano -= 1;
  } else if (mes > 11) {
    mes = 0;
    ano += 1;
  }

  definirMesExibido(ano, mes);
  animarTrocaDePeriodo(delta > 0 ? "frente" : "tras");
}

// Reforça a metáfora do caderno: o conteúdo desliza como se estivesse virando a página
function animarTrocaDePeriodo(direcao) {
  const container = document.getElementById("conteudo-periodo");
  if (!container || prefereMovimentoReduzido()) return;

  container.classList.remove("anim-frente", "anim-tras", "anim-agora");
  void container.offsetWidth; // força reflow pra poder reiniciar a mesma animação em sequência
  container.classList.add(`anim-${direcao}`);
}

function prefereMovimentoReduzido() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// --- MONITORES DE EVENTO (OUVINTES) ---
function configurarMonitoresDeFiltro() {
  const seletorCarteira = document.getElementById("seletor-carteira");
  const filtroMes = document.getElementById("filtro-mes");

  if (seletorCarteira) {
    seletorCarteira.addEventListener("change", () => carregarLancamentos());
  }
  if (filtroMes) {
    filtroMes.addEventListener("change", () => carregarLancamentos());
  }
}

// --- MODO ESCURO ---
function inicializarDarkMode() {
  const areaAcoes = document.querySelector(".acoes-topo");
  if (!areaAcoes) return;

  const btnTheme = document.createElement("button");
  btnTheme.innerText = "🌙";
  btnTheme.id = "btn-theme-toggle";
  btnTheme.title = "Alternar tema";

  areaAcoes.insertBefore(btnTheme, document.getElementById("btn-logout"));

  if (localStorage.getItem("cadimus_tema") === "dark") {
    document.body.classList.add("dark-mode");
  }

  btnTheme.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    localStorage.setItem("cadimus_tema", document.body.classList.contains("dark-mode") ? "dark" : "light");
  });
}

// ==========================================
// CARTEIRAS (contas) — carregadas dinamicamente, sem limite fixo
// ==========================================
let carteirasDoUsuario = [];
let ultimaRequisicaoCarteiras = 0;

async function carregarCarteiras() {
  const container = document.getElementById("carteira-tabs");
  const inputOculto = document.getElementById("seletor-carteira");
  if (!container || !inputOculto) return;

  const idDestaRequisicao = ++ultimaRequisicaoCarteiras;

  try {
    const resposta = await fetch(`${API_URL}/api/carteiras`, { headers: headersAutenticados(false) });
    if (idDestaRequisicao !== ultimaRequisicaoCarteiras) return;
    if (tratarSessaoExpirada(resposta)) return;
    if (!resposta.ok) return;

    carteirasDoUsuario = await resposta.json();
    if (idDestaRequisicao !== ultimaRequisicaoCarteiras) return;

    renderizarTabsCarteira();
  } catch (erro) {
    console.error("Erro ao carregar carteiras:", erro);
  }
}

function renderizarTabsCarteira() {
  const container = document.getElementById("carteira-tabs");
  const inputOculto = document.getElementById("seletor-carteira");
  if (!container || !inputOculto) return;

  const valorAtual = inputOculto.value;
  const aindaExiste = carteirasDoUsuario.some((c) => String(c.id) === String(valorAtual));

  container.innerHTML = "";

  carteirasDoUsuario.forEach((carteira) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab-carteira";
    btn.textContent = carteira.nome;
    btn.title = carteira.tipo === "compartilhada" ? `${carteira.nome} · compartilhada` : `${carteira.nome} · só sua`;
    btn.dataset.valor = carteira.id;
    if (aindaExiste && String(carteira.id) === String(valorAtual)) {
      btn.classList.add("ativo");
    }
    btn.addEventListener("click", () => selecionarCarteira(carteira.id));
    container.appendChild(btn);
  });

  const btnAdd = document.createElement("button");
  btnAdd.type = "button";
  btnAdd.className = "tab-carteira tab-carteira-add";
  btnAdd.textContent = "+";
  btnAdd.title = "Nova carteira";
  btnAdd.addEventListener("click", () => abrirModalCarteira());
  container.appendChild(btnAdd);

  // Se a carteira selecionada não existe mais (ou é a primeira carga), seleciona a primeira disponível
  if (!aindaExiste && carteirasDoUsuario.length > 0) {
    selecionarCarteira(carteirasDoUsuario[0].id);
  }
}

function selecionarCarteira(id) {
  const inputOculto = document.getElementById("seletor-carteira");
  if (!inputOculto) return;

  inputOculto.value = id;
  document.querySelectorAll(".tab-carteira").forEach((t) => {
    t.classList.toggle("ativo", t.dataset.valor === String(id));
  });
  inputOculto.dispatchEvent(new Event("change"));
}

// --- MODAL: NOVA CARTEIRA ---
function abrirModalCarteira() {
  const modal = document.getElementById("modal-carteira");
  if (modal) modal.style.display = "flex";
}

function configurarModalCarteira() {
  const modal = document.getElementById("modal-carteira");
  const btnFechar = document.getElementById("btn-fechar-modal-carteira");
  const form = document.getElementById("form-carteira");

  if (!modal || !btnFechar || !form) return;

  btnFechar.addEventListener("click", () => {
    modal.style.display = "none";
    form.reset();
  });

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const btnSalvar = document.getElementById("btn-salvar-carteira");
    btnSalvar.innerText = "Criando...";
    btnSalvar.disabled = true;

    try {
      const nome = document.getElementById("nome-carteira").value.trim();
      const tipo = document.getElementById("tipo-carteira").value;

      const resposta = await fetch(`${API_URL}/api/carteiras`, {
        method: "POST",
        headers: headersAutenticados(),
        body: JSON.stringify({ nome, tipo }),
      });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        const novaCarteira = await resposta.json();
        modal.style.display = "none";
        form.reset();
        await carregarCarteiras();
        selecionarCarteira(novaCarteira.id);
      } else {
        const erro = await resposta.json();
        alert(`Erro ao criar carteira: ${erro.erro}`);
      }
    } catch (erro) {
      console.error(erro);
      alert("Falha na comunicação com o servidor.");
    } finally {
      btnSalvar.innerText = "Criar carteira";
      btnSalvar.disabled = false;
    }
  });
}

// ==========================================
// DESPESAS FIXAS (recorrentes — ex: aluguel)
// ==========================================
let despesasFixasCarregadas = [];

function abrirModalDespesasFixas() {
  const modal = document.getElementById("modal-despesas-fixas");
  const carteiraId = document.getElementById("seletor-carteira").value;
  if (!modal) return;

  if (!carteiraId) {
    alert("Aguarde suas carteiras carregarem antes de abrir as despesas fixas.");
    return;
  }

  popularSelectCategorias(document.getElementById("fixa-categoria"));
  modal.style.display = "flex";
}

function configurarModalDespesasFixas() {
  const modal = document.getElementById("modal-despesas-fixas");
  const btnAbrir = document.getElementById("btn-despesas-fixas");
  const btnAbrirDoCard = document.getElementById("btn-nova-despesa-fixa");
  const btnFechar = document.getElementById("btn-fechar-modal-fixas");
  const form = document.getElementById("form-despesa-fixa");

  if (!modal || !btnFechar || !form) return;

  btnAbrir?.addEventListener("click", abrirModalDespesasFixas);
  btnAbrirDoCard?.addEventListener("click", abrirModalDespesasFixas);

  btnFechar.addEventListener("click", () => {
    modal.style.display = "none";
    form.reset();
  });

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const carteiraId = document.getElementById("seletor-carteira").value;
    const btnSalvar = document.getElementById("btn-salvar-fixa");
    btnSalvar.disabled = true;
    btnSalvar.innerText = "Salvando...";

    try {
      const corpo = {
        carteira_id: carteiraId,
        descricao: document.getElementById("fixa-descricao").value.trim(),
        valor: parseFloat(document.getElementById("fixa-valor").value),
        dia_vencimento: parseInt(document.getElementById("fixa-dia").value, 10),
        categoria: document.getElementById("fixa-categoria").value,
        meio_pagamento: document.getElementById("fixa-meio-pagamento").value,
        tipo: document.getElementById("fixa-tipo").value,
      };

      const resposta = await fetch(`${API_URL}/api/despesas-fixas`, {
        method: "POST",
        headers: headersAutenticados(),
        body: JSON.stringify(corpo),
      });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        form.reset();
        modal.style.display = "none";
        carregarPainelDespesasFixas();
        carregarLancamentos(); // se o mês atual já bateu o vencimento, aparece na hora
      } else {
        const erro = await resposta.json();
        alert(`Erro: ${erro.erro}`);
      }
    } catch (erro) {
      console.error(erro);
      alert("Erro de conexão ao cadastrar despesa fixa.");
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.innerText = "Adicionar";
    }
  });
}

async function carregarPainelDespesasFixas() {
  const card = document.getElementById("card-despesas-fixas");
  const container = document.getElementById("lista-despesas-fixas-painel");
  const carteiraId = document.getElementById("seletor-carteira").value;
  if (!card || !container || !carteiraId) return;

  try {
    const resposta = await fetch(`${API_URL}/api/despesas-fixas?carteira_id=${carteiraId}`, { headers: headersAutenticados(false) });
    if (tratarSessaoExpirada(resposta)) return;
    if (!resposta.ok) return;

    despesasFixasCarregadas = await resposta.json();

    if (despesasFixasCarregadas.length === 0) {
      card.style.display = "none";
      return;
    }

    card.style.display = "flex";
    container.innerHTML = "";

    despesasFixasCarregadas.forEach((fixa) => {
      const valorFormatado = formatadorBRL.format(fixa.valor);
      const div = document.createElement("div");
      div.className = "linha-item linha-usuario";
      div.innerHTML = `
        <div class="item-info-principal linha-usuario-info">
          <span class="item-descricao">${fixa.descricao}</span>
          <span class="item-categoria">Todo dia ${fixa.dia_vencimento} · ${valorFormatado}</span>
        </div>
        <div class="item-valores">
          <span class="item-status ${fixa.ativo ? "status-pago" : "status-pendente"}">${fixa.ativo ? "Ativa" : "Pausada"}</span>
          <button type="button" class="btn-editar-usuario" data-id="${fixa.id}">${fixa.ativo ? "Pausar" : "Ativar"}</button>
          <button type="button" class="btn-excluir-conta" data-id="${fixa.id}">Excluir</button>
        </div>
      `;
      container.appendChild(div);
    });

    container.querySelectorAll(".btn-editar-usuario").forEach((btn) => {
      btn.addEventListener("click", () => alternarDespesaFixa(Number(btn.dataset.id)));
    });
    container.querySelectorAll(".btn-excluir-conta").forEach((btn) => {
      btn.addEventListener("click", () => excluirDespesaFixa(Number(btn.dataset.id)));
    });
  } catch (erro) {
    console.error("Erro ao carregar despesas fixas:", erro);
  }
}

async function alternarDespesaFixa(id) {
  const alvo = despesasFixasCarregadas.find((f) => f.id === id);
  if (!alvo) return;

  try {
    const resposta = await fetch(`${API_URL}/api/despesas-fixas?id=${id}`, {
      method: "PUT",
      headers: headersAutenticados(),
      body: JSON.stringify({ ativo: !alvo.ativo }),
    });

    if (tratarSessaoExpirada(resposta)) return;

    if (resposta.ok) {
      carregarPainelDespesasFixas();
    } else {
      const erro = await resposta.json();
      alert(`Erro: ${erro.erro}`);
    }
  } catch (erro) {
    alert("Erro de conexão.");
  }
}

async function excluirDespesaFixa(id) {
  if (!confirm("Excluir esta despesa fixa? Ela para de gerar lançamentos novos, mas os que já foram criados continuam na lista.")) return;

  try {
    const resposta = await fetch(`${API_URL}/api/despesas-fixas?id=${id}`, {
      method: "DELETE",
      headers: headersAutenticados(false),
    });

    if (tratarSessaoExpirada(resposta)) return;

    if (resposta.ok) {
      carregarPainelDespesasFixas();
    } else {
      const erro = await resposta.json();
      alert(`Erro: ${erro.erro}`);
    }
  } catch (erro) {
    alert("Erro de conexão.");
  }
}

// --- CATEGORIAS (carrega em qualquer select e permite cadastrar novas) ---
async function popularSelectCategorias(select) {
  if (!select) return;

  try {
    const resposta = await fetch(`${API_URL}/api/categorias`, { headers: headersAutenticados(false) });
    if (tratarSessaoExpirada(resposta)) return;
    if (!resposta.ok) return;

    const categorias = await resposta.json();
    const opcaoNova = select.querySelector('option[value="__nova__"]');

    // Remove opções antigas (menos a de placeholder e a de "+ Nova categoria", se existir)
    select.querySelectorAll("option[data-categoria]").forEach((op) => op.remove());

    categorias.forEach((cat) => {
      const opcao = document.createElement("option");
      opcao.value = cat.nome;
      opcao.textContent = cat.nome;
      opcao.dataset.categoria = "true";
      select.insertBefore(opcao, opcaoNova || null);
    });
  } catch (erro) {
    console.error("Erro ao carregar categorias:", erro);
  }
}

function carregarCategorias() {
  return popularSelectCategorias(document.getElementById("categoria"));
}

function adicionarCategoriaAoSelect(nome) {
  const select = document.getElementById("categoria");
  const opcaoNova = select.querySelector('option[value="__nova__"]');
  const jaExiste = Array.from(select.options).some((op) => op.value.toLowerCase() === nome.toLowerCase());
  if (jaExiste) return;

  const opcao = document.createElement("option");
  opcao.value = nome;
  opcao.textContent = nome;
  opcao.dataset.categoria = "true";
  select.insertBefore(opcao, opcaoNova);
}

// --- CONTROLE DO MODAL DE LANÇAMENTO ---
function configurarModal() {
  const modal = document.getElementById("modal-lancamento");
  const btnNovo = document.getElementById("btn-novo-gasto");
  const btnFechar = document.getElementById("btn-fechar-modal");
  const form = document.getElementById("form-lancamento");
  const selectCategoria = document.getElementById("categoria");
  const campoCategoriaNova = document.getElementById("categoria-nova");

  if (!modal || !btnNovo || !btnFechar || !form) return;

  selectCategoria?.addEventListener("change", () => {
    const escolheuNova = selectCategoria.value === "__nova__";
    campoCategoriaNova.style.display = escolheuNova ? "block" : "none";
    campoCategoriaNova.required = escolheuNova;
    if (escolheuNova) campoCategoriaNova.focus();
  });

  btnNovo.addEventListener("click", () => {
    const carteiraAtual = document.getElementById("seletor-carteira").value;
    if (!carteiraAtual) {
      alert("Aguarde suas carteiras carregarem antes de lançar algo.");
      return;
    }
    carregarCategorias();
    document.getElementById("data-compra").valueAsDate = new Date();
    modal.style.display = "flex";
  });

  btnFechar.addEventListener("click", () => {
    modal.style.display = "none";
    form.reset();
    campoCategoriaNova.style.display = "none";
    campoCategoriaNova.required = false;
  });

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const btnSalvar = document.getElementById("btn-salvar-lancamento");
    btnSalvar.innerText = "Salvando...";
    btnSalvar.disabled = true;

    try {
      const carteiraId = document.getElementById("seletor-carteira").value;

      // Se o usuário escolheu "+ Nova categoria…", cadastra ela antes de salvar o lançamento
      let nomeCategoria = selectCategoria.value;
      if (nomeCategoria === "__nova__") {
        nomeCategoria = campoCategoriaNova.value.trim();
        if (!nomeCategoria) {
          alert("Digite o nome da nova categoria.");
          btnSalvar.innerText = "Salvar";
          btnSalvar.disabled = false;
          return;
        }

        const respostaCategoria = await fetch(`${API_URL}/api/categorias`, {
          method: "POST",
          headers: headersAutenticados(),
          body: JSON.stringify({ nome: nomeCategoria }),
        });

        if (tratarSessaoExpirada(respostaCategoria)) return;

        if (!respostaCategoria.ok) {
          const erro = await respostaCategoria.json();
          alert(`Erro ao cadastrar categoria: ${erro.erro}`);
          btnSalvar.innerText = "Salvar";
          btnSalvar.disabled = false;
          return;
        }

        const categoriaCriada = await respostaCategoria.json();
        nomeCategoria = categoriaCriada.nome; // usa o nome já normalizado pelo servidor
        adicionarCategoriaAoSelect(nomeCategoria);
      }

      const pacoteDados = {
        tipo: document.getElementById("tipo-gasto").value,
        descricao: document.getElementById("descricao").value,
        valor: parseFloat(document.getElementById("valor").value),
        data_compra: document.getElementById("data-compra").value,
        categoria: nomeCategoria,
        meio_pagamento: document.getElementById("meio-pagamento").value,
        status: document.getElementById("status-pagamento").value,
        carteira_id: carteiraId,
      };

      const resposta = await fetch(`${API_URL}/api/lancamentos`, {
        method: "POST",
        headers: headersAutenticados(),
        body: JSON.stringify(pacoteDados),
      });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        modal.style.display = "none";
        form.reset();
        selectCategoria.value = "";
        campoCategoriaNova.style.display = "none";
        campoCategoriaNova.required = false;
        carregarLancamentos();
      } else {
        const erro = await resposta.json();
        alert(`Erro ao salvar: ${erro.erro}`);
      }
    } catch (erro) {
      console.error(erro);
      alert("Falha na comunicação com o servidor.");
    } finally {
      btnSalvar.innerText = "Salvar";
      btnSalvar.disabled = false;
    }
  });
}

// --- ANIMAÇÃO DE CONTAGEM (números "sobem" até o valor final) ---
const formatadorBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const valoresAnimadosAtuais = new WeakMap();

function animarValorMonetario(elemento, valorFinal) {
  if (!elemento) return;

  if (prefereMovimentoReduzido()) {
    elemento.textContent = formatadorBRL.format(valorFinal);
    valoresAnimadosAtuais.set(elemento, valorFinal);
    return;
  }

  const valorInicial = valoresAnimadosAtuais.get(elemento) ?? 0;
  const duracao = 550;
  const inicioTempo = performance.now();

  function passo(agora) {
    const progresso = Math.min((agora - inicioTempo) / duracao, 1);
    const facilitado = 1 - Math.pow(1 - progresso, 3); // ease-out cúbico
    const valorAtual = valorInicial + (valorFinal - valorInicial) * facilitado;
    elemento.textContent = formatadorBRL.format(valorAtual);
    if (progresso < 1) requestAnimationFrame(passo);
  }

  requestAnimationFrame(passo);
  valoresAnimadosAtuais.set(elemento, valorFinal);
}


// --- COMUNICAÇÃO COM A API (BUSCA FILTRADA) ---
let ultimaRequisicaoLancamentos = 0;

async function carregarLancamentos() {
  const container = document.getElementById("lista-lancamentos");
  if (!container) return;

  const carteiraId = document.getElementById("seletor-carteira").value;
  if (!carteiraId) return; // carteiras ainda carregando

  carregarPainelDespesasFixas();

  // Marca esta chamada como "a mais recente". Se outra começar antes dela terminar,
  // esta vira obsoleta e seu resultado é descartado (evita sobrescrever a tela com dado velho).
  const idDestaRequisicao = ++ultimaRequisicaoLancamentos;

  container.innerHTML = "";
  container.appendChild(criarFeedbackCarregamento());

  try {
    const inputMes = document.getElementById("filtro-mes").value;

    let urlComFiltros = `${API_URL}/api/lancamentos?carteira_id=${carteiraId}`;

    if (inputMes) {
      const [ano, mes] = inputMes.split("-");
      urlComFiltros += `&mes=${mes}&ano=${ano}`;
    }

    const resposta = await fetch(urlComFiltros, { headers: headersAutenticados(false) });

    // Chegou uma requisição mais nova enquanto esperávamos? Descarta esta resposta.
    if (idDestaRequisicao !== ultimaRequisicaoLancamentos) return;

    if (tratarSessaoExpirada(resposta)) return;
    const dados = await resposta.json();

    if (idDestaRequisicao !== ultimaRequisicaoLancamentos) return;

    container.innerHTML = "";

    if (dados.length === 0) {
      container.appendChild(criarAvisoListaVazia());
      animarValorMonetario(document.getElementById("total-receitas"), 0);
      animarValorMonetario(document.getElementById("total-despesas"), 0);
      animarValorMonetario(document.getElementById("saldo-total"), 0);
      document.getElementById("saldo-total").style.color = "var(--cor-texto)";
      document.getElementById("resumo-categorias").style.display = "none";
      document.getElementById("resumo-pendente-item").style.display = "none";
      return;
    }

    let totalReceitas = 0;
    let totalDespesas = 0;
    let totalPendente = 0;
    const totaisPorCategoria = {};

    dados.forEach((lancamento) => {
      const linha = criarLinhaLancamento(lancamento);
      container.appendChild(linha);

      // Pendente é um compromisso, não dinheiro que já entrou ou saiu — não conta no saldo nem nas categorias
      if (lancamento.status === "pendente") {
        if (lancamento.tipo === "despesa") {
          totalPendente += lancamento.valor;
        }
        return;
      }

      if (lancamento.tipo === "receita") {
        totalReceitas += lancamento.valor;
      } else {
        totalDespesas += lancamento.valor;
        totaisPorCategoria[lancamento.categoria] = (totaisPorCategoria[lancamento.categoria] || 0) + lancamento.valor;
      }
    });

    const saldoCalculado = totalReceitas - totalDespesas;

    animarValorMonetario(document.getElementById("total-receitas"), totalReceitas);
    animarValorMonetario(document.getElementById("total-despesas"), totalDespesas);

    const elementoPendente = document.getElementById("resumo-pendente-item");
    if (elementoPendente) {
      if (totalPendente > 0) {
        elementoPendente.style.display = "flex";
        animarValorMonetario(document.getElementById("total-pendente"), totalPendente);
      } else {
        elementoPendente.style.display = "none";
      }
    }

    const elementoSaldo = document.getElementById("saldo-total");
    if (elementoSaldo) {
      animarValorMonetario(elementoSaldo, saldoCalculado);
      elementoSaldo.style.color = saldoCalculado >= 0 ? "var(--cor-receita)" : "var(--cor-despesa)";
    }

    renderizarResumoCategorias(totaisPorCategoria);
  } catch (erro) {
    if (idDestaRequisicao !== ultimaRequisicaoLancamentos) return;
    console.error("Erro:", erro);
    container.innerHTML = '<p style="color: var(--cor-despesa); padding: 1rem;">Erro ao carregar os dados.</p>';
  }
}

// --- RAIO-X POR CATEGORIA (só despesas, é o que faz sentido controlar) ---
function renderizarResumoCategorias(totaisPorCategoria) {
  const card = document.getElementById("resumo-categorias");
  const container = document.getElementById("lista-categorias-resumo");
  if (!card || !container) return;

  const categorias = Object.entries(totaisPorCategoria).sort((a, b) => b[1] - a[1]);

  if (categorias.length === 0) {
    card.style.display = "none";
    return;
  }

  card.style.display = "flex";
  container.innerHTML = "";

  const maiorValor = categorias[0][1];
  const TOP_N = 5;
  const principais = categorias.slice(0, TOP_N);
  const restante = categorias.slice(TOP_N).reduce((soma, [, valor]) => soma + valor, 0);

  const linhas = restante > 0 ? [...principais, ["Outras", restante]] : principais;

  linhas.forEach(([categoria, valor]) => {
    const percentual = Math.round((valor / maiorValor) * 100);
    const valorFormatado = formatadorBRL.format(valor);

    const linha = document.createElement("div");
    linha.className = "categoria-barra-linha";
    linha.innerHTML = `
      <div class="categoria-barra-topo">
        <strong>${categoria}</strong>
        <span class="categoria-barra-valor">${valorFormatado}</span>
      </div>
      <div class="categoria-barra-trilho">
        <div class="categoria-barra-preenchimento" data-largura="${percentual}"></div>
      </div>
    `;
    container.appendChild(linha);
  });

  // Anima a largura das barras depois de inseridas no DOM (senão a transição CSS não dispara)
  requestAnimationFrame(() => {
    container.querySelectorAll(".categoria-barra-preenchimento").forEach((barra) => {
      barra.style.width = `${barra.dataset.largura}%`;
    });
  });
}

// --- ALTERNAR STATUS (pago ⇄ pendente) ---
async function alternarStatusLancamento(id, statusAtual) {
  const novoStatus = statusAtual === "pago" ? "pendente" : "pago";

  try {
    const resposta = await fetch(`${API_URL}/api/lancamentos?id=${id}`, {
      method: "PUT",
      headers: headersAutenticados(),
      body: JSON.stringify({ status: novoStatus }),
    });

    if (tratarSessaoExpirada(resposta)) return;

    if (resposta.ok) {
      carregarLancamentos();
    } else {
      const erro = await resposta.json();
      alert(`Não foi possível atualizar: ${erro.erro}`);
    }
  } catch (erro) {
    console.error(erro);
    alert("Erro ao se conectar com o servidor.");
  }
}

// --- FUNÇÃO PARA EXCLUIR REGISTROS ---
async function apagarLancamento(id) {
  if (!confirm("Deseja realmente excluir este lançamento permanentemente?")) return;

  try {
    const resposta = await fetch(`${API_URL}/api/lancamentos?id=${id}`, {
      method: "DELETE",
      headers: headersAutenticados(false),
    });

    if (tratarSessaoExpirada(resposta)) return;

    if (resposta.ok) {
      carregarLancamentos();
    } else {
      const erro = await resposta.json();
      alert(`Não foi possível apagar: ${erro.erro}`);
    }
  } catch (erro) {
    console.error(erro);
    alert("Erro ao se conectar com a nuvem.");
  }
}

// ==========================================
// CONTROLE DO PAINEL ADMIN / CONFIGURAÇÕES
// ==========================================
function configurarPainelAdmin() {
  const btnAdmin = document.getElementById("btn-admin");
  const btnVoltar = document.getElementById("btn-voltar-dashboard");
  const secaoDashboard = document.getElementById("dashboard-section");
  const secaoAdmin = document.getElementById("admin-section");

  if (!btnAdmin || !btnVoltar || !secaoDashboard || !secaoAdmin) return;

  btnAdmin.addEventListener("click", () => {
    secaoDashboard.style.display = "none";
    secaoAdmin.style.display = "flex";
    secaoAdmin.style.flexDirection = "column";
    carregarUsuarios();
  });

  btnVoltar.addEventListener("click", () => {
    secaoAdmin.style.display = "none";
    secaoDashboard.style.display = "flex";
    carregarLancamentos();
  });

  configurarSubAbasAdmin();
  configurarFormularioUsuario();
  configurarFormularioCategoria();
}

function configurarSubAbasAdmin() {
  const tabs = document.querySelectorAll(".tab-admin");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("ativo"));
      tab.classList.add("ativo");

      document.querySelectorAll(".painel-admin").forEach((p) => (p.style.display = "none"));
      const painel = document.getElementById(tab.dataset.painel);
      if (painel) painel.style.display = "block";

      if (tab.dataset.painel === "painel-categorias") carregarListaCategorias();
      if (tab.dataset.painel === "painel-usuarios") carregarUsuarios();
    });
  });
}

// --- FORMULÁRIO DE USUÁRIO (criar E editar no mesmo formulário) ---
function configurarFormularioUsuario() {
  const form = document.getElementById("form-novo-usuario");
  const btnCancelar = document.getElementById("btn-cancelar-edicao");

  if (!form) return;

  btnCancelar?.addEventListener("click", () => sairModoEdicaoUsuario());

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const idEdicao = document.getElementById("usuario-editando-id").value;
    const usuario = document.getElementById("novo-usuario").value.trim();
    const senha = document.getElementById("nova-senha").value;
    const perfil = document.getElementById("novo-perfil").value;
    const btnSalvar = document.getElementById("btn-salvar-usuario");

    if (!idEdicao && !senha) {
      alert("Defina uma senha para o novo usuário.");
      return;
    }

    btnSalvar.disabled = true;
    btnSalvar.innerText = idEdicao ? "Salvando..." : "Criando...";

    try {
      let resposta;

      if (idEdicao) {
        const corpo = { usuario, perfil };
        if (senha) corpo.senha = senha;
        resposta = await fetch(`${API_URL}/api/usuarios?id=${idEdicao}`, {
          method: "PUT",
          headers: headersAutenticados(),
          body: JSON.stringify(corpo),
        });
      } else {
        resposta = await fetch(`${API_URL}/api/usuarios`, {
          method: "POST",
          headers: headersAutenticados(),
          body: JSON.stringify({ usuario, senha, perfil }),
        });
      }

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        sairModoEdicaoUsuario();
        carregarUsuarios();
      } else {
        const erro = await resposta.json();
        alert(`Erro: ${erro.erro}`);
      }
    } catch (erro) {
      alert("Erro de conexão ao salvar usuário.");
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.innerText = idEdicao ? "Salvar edição" : "Criar";
    }
  });
}

function entrarModoEdicaoUsuario(usuario) {
  document.getElementById("usuario-editando-id").value = usuario.id;
  document.getElementById("novo-usuario").value = usuario.nome_usuario;
  document.getElementById("nova-senha").value = "";
  document.getElementById("novo-perfil").value = usuario.perfil;
  document.getElementById("dica-senha").style.display = "inline-block";
  document.getElementById("titulo-form-usuario").innerText = `Editando "${usuario.nome_usuario}"`;
  document.getElementById("btn-salvar-usuario").innerText = "Salvar edição";
  document.getElementById("btn-cancelar-edicao").style.display = "inline-block";
  document.getElementById("painel-usuarios").scrollIntoView({ behavior: "smooth", block: "start" });
}

function sairModoEdicaoUsuario() {
  const form = document.getElementById("form-novo-usuario");
  form.reset();
  document.getElementById("usuario-editando-id").value = "";
  document.getElementById("dica-senha").style.display = "none";
  document.getElementById("titulo-form-usuario").innerText = "Novo usuário";
  document.getElementById("btn-salvar-usuario").innerText = "Criar";
  document.getElementById("btn-cancelar-edicao").style.display = "none";
}

async function carregarUsuarios() {
  const container = document.getElementById("lista-usuarios");
  if (!container) return;

  container.innerHTML = '<div style="text-align: center; padding: 2rem;">Carregando usuários...</div>';

  try {
    const resposta = await fetch(`${API_URL}/api/usuarios`, { headers: headersAutenticados(false) });
    if (tratarSessaoExpirada(resposta)) return;
    const dados = await resposta.json();

    container.innerHTML = "";

    const usuarioLogado = JSON.parse(localStorage.getItem("cadimus_usuario") || "{}");

    dados.forEach((user) => {
      const ehVoceMesmo = user.id === usuarioLogado.id;

      const div = document.createElement("div");
      div.className = "linha-item linha-usuario";
      div.innerHTML = `
        <div class="item-info-principal linha-usuario-info">
          <span class="item-descricao">${user.nome_usuario}${ehVoceMesmo ? " (você)" : ""}</span>
          <span class="item-status status-pago">${user.perfil.toUpperCase()}</span>
        </div>
        <div class="item-valores">
          <button type="button" class="btn-editar-usuario" data-id="${user.id}">Editar</button>
          <button type="button" class="btn-excluir-conta" data-id="${user.id}" ${ehVoceMesmo ? "disabled" : ""} title="${ehVoceMesmo ? "Você não pode excluir a própria conta" : "Excluir usuário"}">Excluir</button>
        </div>
      `;
      container.appendChild(div);
    });

    container.querySelectorAll(".btn-editar-usuario").forEach((btn) => {
      btn.addEventListener("click", () => {
        const alvo = dados.find((u) => u.id === Number(btn.dataset.id));
        if (alvo) entrarModoEdicaoUsuario(alvo);
      });
    });

    container.querySelectorAll(".btn-excluir-conta").forEach((btn) => {
      btn.addEventListener("click", () => excluirUsuario(Number(btn.dataset.id), btn));
    });
  } catch (erro) {
    container.innerHTML = '<p style="color: var(--cor-despesa); padding: 1rem;">Erro ao carregar usuários.</p>';
  }
}

async function excluirUsuario(id, botao) {
  if (!confirm("Excluir este usuário permanentemente? Essa ação não pode ser desfeita.")) return;

  botao.disabled = true;
  botao.innerText = "Excluindo...";

  try {
    const resposta = await fetch(`${API_URL}/api/usuarios?id=${id}`, {
      method: "DELETE",
      headers: headersAutenticados(false),
    });

    if (tratarSessaoExpirada(resposta)) return;

    if (resposta.ok) {
      carregarUsuarios();
    } else {
      const erro = await resposta.json();
      alert(`Não foi possível excluir: ${erro.erro}`);
      botao.disabled = false;
      botao.innerText = "Excluir";
    }
  } catch (erro) {
    alert("Erro ao se conectar com o servidor.");
    botao.disabled = false;
    botao.innerText = "Excluir";
  }
}

// --- PAINEL: CATEGORIAS (admin) ---
function configurarFormularioCategoria() {
  const form = document.getElementById("form-nova-categoria");
  if (!form) return;

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const campo = document.getElementById("nome-nova-categoria");
    const nome = campo.value.trim();
    if (!nome) return;

    const btn = form.querySelector("button");
    btn.disabled = true;
    btn.innerText = "Adicionando...";

    try {
      const resposta = await fetch(`${API_URL}/api/categorias`, {
        method: "POST",
        headers: headersAutenticados(),
        body: JSON.stringify({ nome }),
      });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        form.reset();
        carregarListaCategorias();
      } else {
        const erro = await resposta.json();
        alert(`Erro: ${erro.erro}`);
      }
    } catch (erro) {
      alert("Erro de conexão ao cadastrar categoria.");
    } finally {
      btn.disabled = false;
      btn.innerText = "Adicionar";
    }
  });
}

async function carregarListaCategorias() {
  const container = document.getElementById("lista-categorias");
  if (!container) return;

  container.innerHTML = '<div style="text-align: center; padding: 2rem;">Carregando categorias...</div>';

  try {
    const resposta = await fetch(`${API_URL}/api/categorias`, { headers: headersAutenticados(false) });
    if (tratarSessaoExpirada(resposta)) return;
    const categorias = await resposta.json();

    container.innerHTML = "";

    if (categorias.length === 0) {
      container.innerHTML = '<p style="padding: 1rem; color: var(--cor-texto-suave);">Nenhuma categoria cadastrada.</p>';
      return;
    }

    categorias.forEach((cat) => {
      const div = document.createElement("div");
      div.className = "linha-item linha-usuario";
      div.innerHTML = `
        <div class="item-info-principal linha-usuario-info">
          <span class="item-descricao">${cat.nome}</span>
        </div>
        <div class="item-valores">
          <button type="button" class="btn-excluir-conta" data-id="${cat.id}" title="Excluir categoria">Excluir</button>
        </div>
      `;
      container.appendChild(div);
    });

    container.querySelectorAll(".btn-excluir-conta").forEach((btn) => {
      btn.addEventListener("click", () => excluirCategoria(Number(btn.dataset.id), btn));
    });
  } catch (erro) {
    container.innerHTML = '<p style="color: var(--cor-despesa); padding: 1rem;">Erro ao carregar categorias.</p>';
  }
}

async function excluirCategoria(id, botao) {
  if (!confirm("Excluir esta categoria da lista? Lançamentos que já usam ela não são afetados.")) return;

  botao.disabled = true;
  botao.innerText = "Excluindo...";

  try {
    const resposta = await fetch(`${API_URL}/api/categorias?id=${id}`, {
      method: "DELETE",
      headers: headersAutenticados(false),
    });

    if (tratarSessaoExpirada(resposta)) return;

    if (resposta.ok) {
      carregarListaCategorias();
    } else {
      const erro = await resposta.json();
      alert(`Não foi possível excluir: ${erro.erro}`);
      botao.disabled = false;
      botao.innerText = "Excluir";
    }
  } catch (erro) {
    alert("Erro ao se conectar com o servidor.");
    botao.disabled = false;
    botao.innerText = "Excluir";
  }
}

window.carregarLancamentos = carregarLancamentos;
window.apagarLancamento = apagarLancamento;
window.alternarStatusLancamento = alternarStatusLancamento;
window.carregarCarteiras = carregarCarteiras;
