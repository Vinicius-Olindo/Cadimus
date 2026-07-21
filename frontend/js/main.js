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
    mostrarAviso("Sua sessão expirou. Faça login novamente."); // não bloqueia: a função precisa continuar síncrona
    return true;
  }
  return false;
}

// ==========================================
// AVISO E CONFIRMAÇÃO EM MODAL (no lugar de alert()/confirm() nativos)
// ==========================================
function mostrarAviso(mensagem) {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal-aviso");
    const texto = document.getElementById("aviso-texto");
    const btnOk = document.getElementById("btn-aviso-ok");
    if (!modal || !texto || !btnOk) {
      resolve();
      return;
    }

    texto.textContent = mensagem;
    modal.style.display = "flex";

    function aoFechar() {
      modal.style.display = "none";
      btnOk.removeEventListener("click", aoFechar);
      resolve();
    }

    btnOk.addEventListener("click", aoFechar);
  });
}

function pedirConfirmacao(mensagem, opcoes = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal-confirmacao");
    const texto = document.getElementById("confirmacao-texto");
    const btnConfirmar = document.getElementById("btn-confirmacao-confirmar");
    const btnCancelar = document.getElementById("btn-confirmacao-cancelar");
    if (!modal || !texto || !btnConfirmar || !btnCancelar) {
      resolve(false);
      return;
    }

    texto.textContent = mensagem;
    btnConfirmar.textContent = opcoes.textoConfirmar || "Confirmar";
    btnConfirmar.classList.toggle("confirmacao-perigo", Boolean(opcoes.perigo));
    modal.style.display = "flex";

    function limpar() {
      modal.style.display = "none";
      btnConfirmar.removeEventListener("click", aoConfirmar);
      btnCancelar.removeEventListener("click", aoCancelar);
    }
    function aoConfirmar() {
      limpar();
      resolve(true);
    }
    function aoCancelar() {
      limpar();
      resolve(false);
    }

    btnConfirmar.addEventListener("click", aoConfirmar);
    btnCancelar.addEventListener("click", aoCancelar);
  });
}

// ==========================================
// PWA - Registro do Service Worker
// ==========================================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((erro) => {
      console.error("Erro ao registrar o service worker:", erro);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  inicializarFiltroMes();
  inicializarDarkMode();
  configurarMonitoresDeFiltro();
  configurarBuscaLancamentos();
  configurarModal();
  configurarModalCarteira();
  configurarModalDespesasFixas();
  configurarModalComprasParceladas();
  configurarModalMeta();
  configurarModalRenomearCategoria();
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
        await mostrarAviso(`Erro ao criar carteira: ${erro.erro}`);
      }
    } catch (erro) {
      console.error(erro);
      await mostrarAviso("Falha na comunicação com o servidor.");
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

function fecharModalDespesaFixa() {
  const modal = document.getElementById("modal-despesas-fixas");
  const form = document.getElementById("form-despesa-fixa");

  modal.style.display = "none";
  form.reset();
  document.getElementById("fixa-editando-id").value = "";
  document.getElementById("titulo-modal-fixa").innerText = "Despesas fixas";
  document.getElementById("btn-salvar-fixa").innerText = "Adicionar";
}

async function abrirModalDespesasFixas() {
  const modal = document.getElementById("modal-despesas-fixas");
  const carteiraId = document.getElementById("seletor-carteira").value;
  if (!modal) return;

  if (!carteiraId) {
    await mostrarAviso("Aguarde suas carteiras carregarem antes de abrir as despesas fixas.");
    return;
  }

  document.getElementById("fixa-editando-id").value = "";
  document.getElementById("titulo-modal-fixa").innerText = "Nova despesa fixa";
  document.getElementById("btn-salvar-fixa").innerText = "Adicionar";
  await popularSelectCategorias(document.getElementById("fixa-categoria"));
  modal.style.display = "flex";
}

async function editarDespesaFixa(id) {
  const fixa = despesasFixasCarregadas.find((f) => f.id === id);
  if (!fixa) return;

  const modal = document.getElementById("modal-despesas-fixas");
  if (!modal) return;

  await popularSelectCategorias(document.getElementById("fixa-categoria"));
  adicionarOpcaoSelect(document.getElementById("fixa-categoria"), fixa.categoria);

  document.getElementById("fixa-editando-id").value = fixa.id;
  document.getElementById("fixa-descricao").value = fixa.descricao;
  document.getElementById("fixa-valor").value = fixa.valor;
  document.getElementById("fixa-dia").value = fixa.dia_vencimento;
  document.getElementById("fixa-categoria").value = fixa.categoria;
  document.getElementById("fixa-meio-pagamento").value = fixa.meio_pagamento;
  document.getElementById("fixa-tipo").value = fixa.tipo;

  document.getElementById("titulo-modal-fixa").innerText = `Editando "${fixa.descricao}"`;
  document.getElementById("btn-salvar-fixa").innerText = "Salvar edição";
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
  btnFechar.addEventListener("click", fecharModalDespesaFixa);

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const idEdicao = document.getElementById("fixa-editando-id").value;
    const carteiraId = document.getElementById("seletor-carteira").value;
    const btnSalvar = document.getElementById("btn-salvar-fixa");
    btnSalvar.disabled = true;
    btnSalvar.innerText = idEdicao ? "Salvando edição..." : "Salvando...";

    try {
      const corpo = {
        descricao: document.getElementById("fixa-descricao").value.trim(),
        valor: parseFloat(document.getElementById("fixa-valor").value),
        dia_vencimento: parseInt(document.getElementById("fixa-dia").value, 10),
        categoria: document.getElementById("fixa-categoria").value,
        meio_pagamento: document.getElementById("fixa-meio-pagamento").value,
        tipo: document.getElementById("fixa-tipo").value,
      };
      if (!idEdicao) corpo.carteira_id = carteiraId; // carteira só é definida na criação, não muda na edição

      const resposta = idEdicao
        ? await fetch(`${API_URL}/api/despesas-fixas?id=${idEdicao}`, {
            method: "PUT",
            headers: headersAutenticados(),
            body: JSON.stringify(corpo),
          })
        : await fetch(`${API_URL}/api/despesas-fixas`, {
            method: "POST",
            headers: headersAutenticados(),
            body: JSON.stringify(corpo),
          });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        fecharModalDespesaFixa();
        carregarPainelDespesasFixas();
        carregarLancamentos(); // se o mês atual já bateu o vencimento, aparece na hora
      } else {
        const erro = await resposta.json();
        await mostrarAviso(`Erro: ${erro.erro}`);
      }
    } catch (erro) {
      console.error(erro);
      await mostrarAviso("Erro de conexão ao salvar despesa fixa.");
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.innerText = idEdicao ? "Salvar edição" : "Adicionar";
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
      const aviso = fixa.ativo ? calcularAvisoVencimento(fixa.dia_vencimento) : null;

      const badgeAviso = aviso ? `<span class="aviso-vencimento ${aviso.atrasado ? "aviso-vencimento-atrasado" : ""}">${aviso.texto}</span>` : "";
      const classeDestaque = aviso ? (aviso.atrasado ? "linha-vencimento-atrasado" : "linha-vencimento-proximo") : "";

      const div = document.createElement("div");
      div.className = `linha-item linha-usuario ${classeDestaque}`.trim();
      div.innerHTML = `
        <div class="item-info-principal linha-usuario-info">
          <span class="item-descricao">${fixa.descricao}</span>
          <span class="item-categoria">Todo dia ${fixa.dia_vencimento} · ${valorFormatado}</span>
        </div>
        <div class="item-valores">
          ${badgeAviso}
          <span class="item-status ${fixa.ativo ? "status-pago" : "status-pendente"}">${fixa.ativo ? "Ativa" : "Pausada"}</span>
          <button type="button" class="btn-editar-usuario btn-editar-fixa" data-id="${fixa.id}">Editar</button>
          <button type="button" class="btn-editar-usuario btn-alternar-fixa" data-id="${fixa.id}">${fixa.ativo ? "Pausar" : "Ativar"}</button>
          <button type="button" class="btn-excluir-conta" data-id="${fixa.id}">Excluir</button>
        </div>
      `;
      container.appendChild(div);
    });

    container.querySelectorAll(".btn-editar-fixa").forEach((btn) => {
      btn.addEventListener("click", () => editarDespesaFixa(Number(btn.dataset.id)));
    });
    container.querySelectorAll(".btn-alternar-fixa").forEach((btn) => {
      btn.addEventListener("click", () => alternarDespesaFixa(Number(btn.dataset.id)));
    });
    container.querySelectorAll(".btn-excluir-conta").forEach((btn) => {
      btn.addEventListener("click", () => excluirDespesaFixa(Number(btn.dataset.id)));
    });
  } catch (erro) {
    console.error("Erro ao carregar despesas fixas:", erro);
  }
}

// Calcula se o vencimento está próximo (até 3 dias), hoje, ou já passou (até 3 dias atrás)
function calcularAvisoVencimento(diaVencimento) {
  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const diferenca = diaVencimento - diaAtual;

  if (diferenca === 0) {
    return { texto: "Vence hoje", atrasado: false };
  }
  if (diferenca > 0 && diferenca <= 3) {
    return { texto: `Vence em ${diferenca} dia${diferenca > 1 ? "s" : ""}`, atrasado: false };
  }
  if (diferenca < 0 && diferenca >= -3) {
    const diasAtraso = Math.abs(diferenca);
    return { texto: `Venceu há ${diasAtraso} dia${diasAtraso > 1 ? "s" : ""}`, atrasado: true };
  }
  return null;
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
      await mostrarAviso(`Erro: ${erro.erro}`);
    }
  } catch (erro) {
    await mostrarAviso("Erro de conexão.");
  }
}

async function excluirDespesaFixa(id) {
  if (!(await pedirConfirmacao("Excluir esta despesa fixa? Ela para de gerar lançamentos novos, mas os que já foram criados continuam na lista.", { textoConfirmar: "Excluir", perigo: true }))) return;

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
      await mostrarAviso(`Erro: ${erro.erro}`);
    }
  } catch (erro) {
    await mostrarAviso("Erro de conexão.");
  }
}

// ==========================================
// COMPRAS PARCELADAS (ex: "Notebook em 10x de R$300")
// ==========================================
let comprasParceladasCarregadas = [];

async function abrirModalComprasParceladas() {
  const modal = document.getElementById("modal-compra-parcelada");
  const carteiraId = document.getElementById("seletor-carteira").value;
  if (!modal) return;

  if (!carteiraId) {
    await mostrarAviso("Aguarde suas carteiras carregarem antes de cadastrar uma compra parcelada.");
    return;
  }

  popularSelectCategorias(document.getElementById("parcelada-categoria"));

  // Sugere o mês atual como padrão pra 1ª parcela
  const campoMesInicio = document.getElementById("parcelada-mes-inicio");
  if (campoMesInicio && !campoMesInicio.value) {
    const hoje = new Date();
    campoMesInicio.value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  }

  modal.style.display = "flex";
}

function configurarModalComprasParceladas() {
  const modal = document.getElementById("modal-compra-parcelada");
  const btnAbrirTopo = document.getElementById("btn-compras-parceladas");
  const btnAbrirDoCard = document.getElementById("btn-nova-compra-parcelada");
  const btnFechar = document.getElementById("btn-fechar-modal-parcelada");
  const form = document.getElementById("form-compra-parcelada");

  if (!modal || !btnFechar || !form) return;

  btnAbrirTopo?.addEventListener("click", abrirModalComprasParceladas);
  btnAbrirDoCard?.addEventListener("click", abrirModalComprasParceladas);

  btnFechar.addEventListener("click", () => {
    modal.style.display = "none";
    form.reset();
  });

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const carteiraId = document.getElementById("seletor-carteira").value;
    const btnSalvar = document.getElementById("btn-salvar-parcelada");
    btnSalvar.disabled = true;
    btnSalvar.innerText = "Salvando...";

    try {
      const mesInicioValor = document.getElementById("parcelada-mes-inicio").value; // "YYYY-MM"
      if (!mesInicioValor) {
        await mostrarAviso("Escolha o mês da primeira parcela.");
        return;
      }
      const [anoInicio, mesInicio] = mesInicioValor.split("-").map(Number);

      const corpo = {
        carteira_id: carteiraId,
        descricao: document.getElementById("parcelada-descricao").value.trim(),
        valor_parcela: parseFloat(document.getElementById("parcelada-valor").value),
        total_parcelas: parseInt(document.getElementById("parcelada-total").value, 10),
        dia_vencimento: parseInt(document.getElementById("parcelada-dia").value, 10),
        ano_inicio: anoInicio,
        mes_inicio: mesInicio,
        categoria: document.getElementById("parcelada-categoria").value,
        meio_pagamento: document.getElementById("parcelada-meio-pagamento").value,
      };

      const resposta = await fetch(`${API_URL}/api/compras-parceladas`, {
        method: "POST",
        headers: headersAutenticados(),
        body: JSON.stringify(corpo),
      });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        form.reset();
        modal.style.display = "none";
        carregarPainelComprasParceladas();
        carregarLancamentos(); // se a parcela já bate no mês visível, aparece na hora
      } else {
        const erro = await resposta.json();
        await mostrarAviso(`Erro: ${erro.erro}`);
      }
    } catch (erro) {
      console.error(erro);
      await mostrarAviso("Erro de conexão ao cadastrar compra parcelada.");
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.innerText = "Adicionar";
    }
  });
}

// Calcula em que parcela a compra está HOJE (pode ser <1 = ainda não começou, ou >total = já terminou)
function calcularParcelaAtual(compra) {
  const hoje = new Date();
  return (hoje.getFullYear() - compra.ano_inicio) * 12 + (hoje.getMonth() + 1 - compra.mes_inicio) + 1;
}

async function carregarPainelComprasParceladas() {
  const card = document.getElementById("card-compras-parceladas");
  const container = document.getElementById("lista-compras-parceladas-painel");
  const carteiraId = document.getElementById("seletor-carteira").value;
  if (!card || !container || !carteiraId) return;

  try {
    const resposta = await fetch(`${API_URL}/api/compras-parceladas?carteira_id=${carteiraId}`, { headers: headersAutenticados(false) });
    if (tratarSessaoExpirada(resposta)) return;
    if (!resposta.ok) return;

    comprasParceladasCarregadas = await resposta.json();

    if (comprasParceladasCarregadas.length === 0) {
      card.style.display = "none";
      return;
    }

    card.style.display = "flex";
    container.innerHTML = "";

    comprasParceladasCarregadas.forEach((compra) => {
      const valorFormatado = formatadorBRL.format(compra.valor_parcela);
      const parcelaAtual = calcularParcelaAtual(compra);
      const concluida = parcelaAtual > compra.total_parcelas;

      let rotuloParcela;
      if (!compra.ativo) {
        rotuloParcela = "Cancelada";
      } else if (concluida) {
        rotuloParcela = `Concluída (${compra.total_parcelas}/${compra.total_parcelas})`;
      } else if (parcelaAtual < 1) {
        rotuloParcela = `Começa em ${NOMES_MESES_ABREV[compra.mes_inicio - 1]}/${compra.ano_inicio}`;
      } else {
        rotuloParcela = `Parcela ${parcelaAtual}/${compra.total_parcelas}`;
      }

      const div = document.createElement("div");
      div.className = "linha-item linha-usuario";
      div.innerHTML = `
        <div class="item-info-principal linha-usuario-info">
          <span class="item-descricao">${compra.descricao}</span>
          <span class="item-categoria">${rotuloParcela} · ${valorFormatado}/mês</span>
        </div>
        <div class="item-valores">
          <span class="item-status ${compra.ativo && !concluida ? "status-pago" : "status-pendente"}">${compra.ativo ? (concluida ? "Concluída" : "Ativa") : "Cancelada"}</span>
          ${!concluida ? `<button type="button" class="btn-editar-usuario" data-id="${compra.id}">${compra.ativo ? "Cancelar" : "Reativar"}</button>` : ""}
          <button type="button" class="btn-excluir-conta" data-id="${compra.id}">Excluir</button>
        </div>
      `;
      container.appendChild(div);
    });

    container.querySelectorAll(".btn-editar-usuario").forEach((btn) => {
      btn.addEventListener("click", () => alternarComprasParcelada(Number(btn.dataset.id)));
    });
    container.querySelectorAll(".btn-excluir-conta").forEach((btn) => {
      btn.addEventListener("click", () => excluirComprasParcelada(Number(btn.dataset.id)));
    });
  } catch (erro) {
    console.error("Erro ao carregar compras parceladas:", erro);
  }
}

async function alternarComprasParcelada(id) {
  const alvo = comprasParceladasCarregadas.find((c) => c.id === id);
  if (!alvo) return;

  try {
    const resposta = await fetch(`${API_URL}/api/compras-parceladas?id=${id}`, {
      method: "PUT",
      headers: headersAutenticados(),
      body: JSON.stringify({ ativo: !alvo.ativo }),
    });

    if (tratarSessaoExpirada(resposta)) return;

    if (resposta.ok) {
      carregarPainelComprasParceladas();
    } else {
      const erro = await resposta.json();
      await mostrarAviso(`Erro: ${erro.erro}`);
    }
  } catch (erro) {
    await mostrarAviso("Erro de conexão.");
  }
}

async function excluirComprasParcelada(id) {
  if (!(await pedirConfirmacao("Excluir esta compra parcelada? As parcelas já lançadas continuam na lista, só param de ser geradas novas.", { textoConfirmar: "Excluir", perigo: true }))) return;

  try {
    const resposta = await fetch(`${API_URL}/api/compras-parceladas?id=${id}`, {
      method: "DELETE",
      headers: headersAutenticados(false),
    });

    if (tratarSessaoExpirada(resposta)) return;

    if (resposta.ok) {
      carregarPainelComprasParceladas();
    } else {
      const erro = await resposta.json();
      await mostrarAviso(`Erro: ${erro.erro}`);
    }
  } catch (erro) {
    await mostrarAviso("Erro de conexão.");
  }
}

// ==========================================
// METAS POR CATEGORIA (orçamento)
// ==========================================
let metasCarregadas = [];

async function carregarMetas() {
  const carteiraId = document.getElementById("seletor-carteira").value;
  if (!carteiraId) return;

  try {
    const resposta = await fetch(`${API_URL}/api/metas?carteira_id=${carteiraId}`, { headers: headersAutenticados(false) });
    if (tratarSessaoExpirada(resposta)) return;
    if (!resposta.ok) return;
    metasCarregadas = await resposta.json();
  } catch (erro) {
    console.error("Erro ao carregar metas:", erro);
  }
}

function obterMetaPorCategoria(categoria) {
  return metasCarregadas.find((m) => m.categoria === categoria);
}

function abrirModalMeta(categoria, valorAtual) {
  const modal = document.getElementById("modal-meta");
  if (!modal) return;

  document.getElementById("meta-categoria-nome").value = categoria;
  document.getElementById("meta-categoria-label").textContent = `Categoria: ${categoria}`;
  document.getElementById("meta-valor").value = valorAtual || "";
  document.getElementById("btn-remover-meta").style.display = valorAtual ? "inline-block" : "none";
  modal.style.display = "flex";
}

function configurarModalMeta() {
  const modal = document.getElementById("modal-meta");
  const form = document.getElementById("form-meta");
  const btnFechar = document.getElementById("btn-fechar-modal-meta");
  const btnRemover = document.getElementById("btn-remover-meta");

  if (!modal || !form || !btnFechar || !btnRemover) return;

  btnFechar.addEventListener("click", () => {
    modal.style.display = "none";
  });

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const carteiraId = document.getElementById("seletor-carteira").value;
    const categoria = document.getElementById("meta-categoria-nome").value;
    const valorLimite = parseFloat(document.getElementById("meta-valor").value);
    const btnSalvar = document.getElementById("btn-salvar-meta");

    btnSalvar.disabled = true;
    btnSalvar.innerText = "Salvando...";

    try {
      const resposta = await fetch(`${API_URL}/api/metas`, {
        method: "POST",
        headers: headersAutenticados(),
        body: JSON.stringify({ carteira_id: carteiraId, categoria, valor_limite: valorLimite }),
      });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        modal.style.display = "none";
        await carregarMetas();
        carregarLancamentos();
      } else {
        const erro = await resposta.json();
        await mostrarAviso(`Erro: ${erro.erro}`);
      }
    } catch (erro) {
      await mostrarAviso("Erro de conexão ao salvar meta.");
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.innerText = "Salvar meta";
    }
  });

  btnRemover.addEventListener("click", async () => {
    const categoria = document.getElementById("meta-categoria-nome").value;
    const meta = obterMetaPorCategoria(categoria);
    if (!meta) return;
    if (!(await pedirConfirmacao(`Remover a meta de "${categoria}"?`, { textoConfirmar: "Remover", perigo: true }))) return;

    try {
      const resposta = await fetch(`${API_URL}/api/metas?id=${meta.id}`, {
        method: "DELETE",
        headers: headersAutenticados(false),
      });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        modal.style.display = "none";
        await carregarMetas();
        carregarLancamentos();
      } else {
        const erro = await resposta.json();
        await mostrarAviso(`Erro: ${erro.erro}`);
      }
    } catch (erro) {
      await mostrarAviso("Erro de conexão ao remover meta.");
    }
  });
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

function adicionarOpcaoSelect(select, nome) {
  if (!select || !nome) return;
  const opcaoNova = select.querySelector('option[value="__nova__"]');
  const jaExiste = Array.from(select.options).some((op) => op.value.toLowerCase() === nome.toLowerCase());
  if (jaExiste) return;

  const opcao = document.createElement("option");
  opcao.value = nome;
  opcao.textContent = nome;
  opcao.dataset.categoria = "true";
  select.insertBefore(opcao, opcaoNova || null);
}

function adicionarCategoriaAoSelect(nome) {
  adicionarOpcaoSelect(document.getElementById("categoria"), nome);
}

// --- CONTROLE DO MODAL DE LANÇAMENTO ---
function fecharModalLancamento() {
  const modal = document.getElementById("modal-lancamento");
  const form = document.getElementById("form-lancamento");
  const campoCategoriaNova = document.getElementById("categoria-nova");

  modal.style.display = "none";
  form.reset();
  document.getElementById("lancamento-editando-id").value = "";
  document.getElementById("titulo-modal-lancamento").innerText = "Novo lançamento";
  document.getElementById("btn-salvar-lancamento").innerText = "Salvar";
  campoCategoriaNova.style.display = "none";
  campoCategoriaNova.required = false;
}

async function abrirModalNovoLancamento() {
  const carteiraAtual = document.getElementById("seletor-carteira").value;
  if (!carteiraAtual) {
    await mostrarAviso("Aguarde suas carteiras carregarem antes de lançar algo.");
    return;
  }

  carregarCategorias();
  document.getElementById("lancamento-editando-id").value = "";
  document.getElementById("titulo-modal-lancamento").innerText = "Novo lançamento";
  document.getElementById("btn-salvar-lancamento").innerText = "Salvar";
  document.getElementById("data-compra").valueAsDate = new Date();
  document.getElementById("modal-lancamento").style.display = "flex";
}

async function editarLancamento(id) {
  const lancamento = ultimoLoteLancamentos.find((l) => l.id === id);
  if (!lancamento) return;

  await popularSelectCategorias(document.getElementById("categoria"));
  adicionarCategoriaAoSelect(lancamento.categoria);

  document.getElementById("lancamento-editando-id").value = lancamento.id;
  document.getElementById("tipo-gasto").value = lancamento.tipo;
  document.getElementById("descricao").value = lancamento.descricao;
  document.getElementById("valor").value = lancamento.valor;
  document.getElementById("data-compra").value = String(lancamento.data_compra).slice(0, 10);
  document.getElementById("categoria").value = lancamento.categoria;
  document.getElementById("meio-pagamento").value = lancamento.meio_pagamento;
  document.getElementById("status-pagamento").value = lancamento.status;

  document.getElementById("titulo-modal-lancamento").innerText = "Editar lançamento";
  document.getElementById("btn-salvar-lancamento").innerText = "Salvar edição";
  document.getElementById("modal-lancamento").style.display = "flex";
}

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

  btnNovo.addEventListener("click", abrirModalNovoLancamento);
  btnFechar.addEventListener("click", fecharModalLancamento);

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const idEdicao = document.getElementById("lancamento-editando-id").value;
    const btnSalvar = document.getElementById("btn-salvar-lancamento");
    btnSalvar.innerText = idEdicao ? "Salvando edição..." : "Salvando...";
    btnSalvar.disabled = true;

    try {
      const carteiraId = document.getElementById("seletor-carteira").value;

      // Se o usuário escolheu "+ Nova categoria…", cadastra ela antes de salvar o lançamento
      let nomeCategoria = selectCategoria.value;
      if (nomeCategoria === "__nova__") {
        nomeCategoria = campoCategoriaNova.value.trim();
        if (!nomeCategoria) {
          await mostrarAviso("Digite o nome da nova categoria.");
          btnSalvar.innerText = idEdicao ? "Salvar edição" : "Salvar";
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
          await mostrarAviso(`Erro ao cadastrar categoria: ${erro.erro}`);
          btnSalvar.innerText = idEdicao ? "Salvar edição" : "Salvar";
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

      const resposta = idEdicao
        ? await fetch(`${API_URL}/api/lancamentos?id=${idEdicao}`, {
            method: "PUT",
            headers: headersAutenticados(),
            body: JSON.stringify(pacoteDados),
          })
        : await fetch(`${API_URL}/api/lancamentos`, {
            method: "POST",
            headers: headersAutenticados(),
            body: JSON.stringify(pacoteDados),
          });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        fecharModalLancamento();
        carregarLancamentos();
      } else {
        const erro = await resposta.json();
        await mostrarAviso(`Erro ao salvar: ${erro.erro}`);
      }
    } catch (erro) {
      console.error(erro);
      await mostrarAviso("Falha na comunicação com o servidor.");
    } finally {
      btnSalvar.innerText = idEdicao ? "Salvar edição" : "Salvar";
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


// --- RENDERIZA A LISTA (aplica o filtro de busca, se houver, sem afetar os totais do mês) ---
function renderizarListaLancamentos() {
  const container = document.getElementById("lista-lancamentos");
  if (!container) return;

  const termo = termoBuscaAtual.trim().toLowerCase();
  const filtrados = termo
    ? ultimoLoteLancamentos.filter((l) => l.descricao.toLowerCase().includes(termo) || l.categoria.toLowerCase().includes(termo))
    : ultimoLoteLancamentos;

  container.innerHTML = "";

  if (filtrados.length === 0) {
    container.appendChild(criarAvisoListaVazia(termo ? `Nada encontrado para "${termoBuscaAtual.trim()}".` : undefined));
    return;
  }

  filtrados.forEach((lancamento) => container.appendChild(criarLinhaLancamento(lancamento)));
}

function configurarBuscaLancamentos() {
  const campo = document.getElementById("busca-lancamento");
  if (!campo) return;

  campo.addEventListener("input", (evento) => {
    termoBuscaAtual = evento.target.value;
    renderizarListaLancamentos();
  });
}

// --- COMUNICAÇÃO COM A API (BUSCA FILTRADA) ---
let ultimaRequisicaoLancamentos = 0;
let ultimoLoteLancamentos = [];
let termoBuscaAtual = "";

async function carregarLancamentos() {
  const container = document.getElementById("lista-lancamentos");
  if (!container) return;

  const carteiraId = document.getElementById("seletor-carteira").value;
  if (!carteiraId) return; // carteiras ainda carregando

  carregarPainelDespesasFixas();
  carregarPainelComprasParceladas();
  const promiseMetas = carregarMetas();

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

    const [resposta] = await Promise.all([fetch(urlComFiltros, { headers: headersAutenticados(false) }), promiseMetas]);

    // Chegou uma requisição mais nova enquanto esperávamos? Descarta esta resposta.
    if (idDestaRequisicao !== ultimaRequisicaoLancamentos) return;

    if (tratarSessaoExpirada(resposta)) return;
    const dados = await resposta.json();

    if (idDestaRequisicao !== ultimaRequisicaoLancamentos) return;

    container.innerHTML = "";

    if (dados.length === 0) {
      ultimoLoteLancamentos = [];
      container.appendChild(criarAvisoListaVazia());
      animarValorMonetario(document.getElementById("total-receitas"), 0);
      animarValorMonetario(document.getElementById("total-despesas"), 0);
      animarValorMonetario(document.getElementById("saldo-total"), 0);
      document.getElementById("saldo-total").style.color = "var(--cor-texto)";
      document.getElementById("resumo-categorias").style.display = "none";
      document.getElementById("resumo-pendente-item").style.display = "none";
      renderizarResumoAutores([]);
      carregarComparacaoMesAnterior(0);
      carregarTendencia();
      return;
    }

    ultimoLoteLancamentos = dados;

    let totalReceitas = 0;
    let totalDespesas = 0;
    let totalPendente = 0;
    const totaisPorCategoria = {};

    dados.forEach((lancamento) => {
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

    renderizarListaLancamentos();

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
    renderizarResumoAutores(dados);
    carregarComparacaoMesAnterior(totalDespesas);
    carregarTendencia();
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
    const meta = categoria !== "Outras" ? obterMetaPorCategoria(categoria) : null;
    const valorFormatado = formatadorBRL.format(valor);

    let percentualLargura;
    let classeCor = "";
    let textoValor = valorFormatado;

    if (meta) {
      const percentualMeta = (valor / meta.valor_limite) * 100;
      percentualLargura = Math.min(percentualMeta, 100);
      classeCor = percentualMeta >= 100 ? "barra-estourou" : percentualMeta >= 80 ? "barra-atencao" : "barra-ok";
      textoValor = `${valorFormatado} / ${formatadorBRL.format(meta.valor_limite)}`;
    } else {
      percentualLargura = Math.round((valor / maiorValor) * 100);
    }

    const linha = document.createElement("div");
    linha.className = "categoria-barra-linha";
    linha.innerHTML = `
      <div class="categoria-barra-topo">
        <strong class="${categoria !== "Outras" ? "categoria-barra-nome" : ""}" data-categoria="${categoria}" data-meta="${meta ? meta.valor_limite : ""}">
          ${categoria}${meta ? " 🎯" : ""}
        </strong>
        <span class="categoria-barra-valor">${textoValor}</span>
      </div>
      <div class="categoria-barra-trilho">
        <div class="categoria-barra-preenchimento ${classeCor}" data-largura="${percentualLargura}"></div>
      </div>
    `;
    container.appendChild(linha);
  });

  container.querySelectorAll(".categoria-barra-nome").forEach((el) => {
    el.addEventListener("click", () => abrirModalMeta(el.dataset.categoria, el.dataset.meta));
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
      await mostrarAviso(`Não foi possível atualizar: ${erro.erro}`);
    }
  } catch (erro) {
    console.error(erro);
    await mostrarAviso("Erro ao se conectar com o servidor.");
  }
}

// --- COMPARAÇÃO COM O MÊS ANTERIOR ---
let ultimaRequisicaoComparacao = 0;

async function carregarComparacaoMesAnterior(despesasAtuais) {
  const carteiraId = document.getElementById("seletor-carteira").value;
  const campoMes = document.getElementById("filtro-mes");
  if (!carteiraId || !campoMes || !campoMes.dataset.ano) return;

  const idRequisicao = ++ultimaRequisicaoComparacao;

  let ano = Number(campoMes.dataset.ano);
  let mes = Number(campoMes.dataset.mes) - 1; // mês anterior (0-indexado)
  if (mes < 0) {
    mes = 11;
    ano -= 1;
  }
  const mesStr = String(mes + 1).padStart(2, "0");

  try {
    const resposta = await fetch(`${API_URL}/api/lancamentos?carteira_id=${carteiraId}&mes=${mesStr}&ano=${ano}`, { headers: headersAutenticados(false) });
    if (idRequisicao !== ultimaRequisicaoComparacao) return;
    if (!resposta.ok) return;

    const dados = await resposta.json();
    if (idRequisicao !== ultimaRequisicaoComparacao) return;

    const despesasAnteriores = dados.filter((l) => l.tipo === "despesa" && l.status === "pago").reduce((soma, l) => soma + l.valor, 0);

    renderizarComparacaoMesAnterior(despesasAtuais, despesasAnteriores);
  } catch (erro) {
    console.error("Erro ao comparar com mês anterior:", erro);
  }
}

function renderizarComparacaoMesAnterior(atual, anterior) {
  const elemento = document.getElementById("comparacao-mes");
  if (!elemento) return;

  if (anterior <= 0) {
    elemento.style.display = "none";
    return;
  }

  const diferenca = ((atual - anterior) / anterior) * 100;
  const arredondado = Math.round(Math.abs(diferenca));

  if (arredondado === 0) {
    elemento.style.display = "none";
    return;
  }

  const subiu = diferenca > 0;
  elemento.textContent = `${subiu ? "▲" : "▼"} ${arredondado}% vs mês anterior`;
  elemento.className = `comparacao-mes ${subiu ? "comparacao-pior" : "comparacao-melhor"}`;
  elemento.style.display = "inline-flex";
}

// --- QUEM GASTOU QUANTO (útil na carteira compartilhada) ---
function renderizarResumoAutores(dados) {
  const card = document.getElementById("card-por-autor");
  const container = document.getElementById("lista-autores-resumo");
  if (!card || !container) return;

  const totais = {};
  dados.forEach((l) => {
    if (l.tipo !== "despesa" || l.status !== "pago") return;
    const nome = l.criado_por_nome || "?";
    totais[nome] = (totais[nome] || 0) + l.valor;
  });

  const autores = Object.entries(totais).sort((a, b) => b[1] - a[1]);

  // Só faz sentido mostrar quando mais de uma pessoa lançou algo (ex: carteira individual não precisa)
  if (autores.length < 2) {
    card.style.display = "none";
    return;
  }

  card.style.display = "flex";
  container.innerHTML = "";

  const somaTotal = autores.reduce((soma, [, valor]) => soma + valor, 0);

  autores.forEach(([nome, valor]) => {
    const percentual = Math.round((valor / somaTotal) * 100);
    const cor = typeof corDoAutor === "function" ? corDoAutor(nome) : "var(--cor-marca)";

    const linha = document.createElement("div");
    linha.className = "categoria-barra-linha";
    linha.innerHTML = `
      <div class="categoria-barra-topo">
        <strong>${nome}</strong>
        <span class="categoria-barra-valor">${formatadorBRL.format(valor)} · ${percentual}%</span>
      </div>
      <div class="categoria-barra-trilho">
        <div class="categoria-barra-preenchimento" style="background: ${cor}" data-largura="${percentual}"></div>
      </div>
    `;
    container.appendChild(linha);
  });

  requestAnimationFrame(() => {
    container.querySelectorAll(".categoria-barra-preenchimento").forEach((barra) => {
      barra.style.width = `${barra.dataset.largura}%`;
    });
  });
}

// --- TENDÊNCIA (últimos 6 meses, terminando no mês visualizado) ---
const cacheTendencia = new Map();
let ultimaRequisicaoTendencia = 0;
const NOMES_MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

async function carregarTendencia() {
  const carteiraId = document.getElementById("seletor-carteira").value;
  const campoMes = document.getElementById("filtro-mes");
  if (!carteiraId || !campoMes || !campoMes.dataset.ano) return;

  const idRequisicao = ++ultimaRequisicaoTendencia;

  const anoBase = Number(campoMes.dataset.ano);
  const mesBase = Number(campoMes.dataset.mes); // 0-indexado

  const meses = [];
  for (let i = 5; i >= 0; i--) {
    let m = mesBase - i;
    let a = anoBase;
    while (m < 0) {
      m += 12;
      a -= 1;
    }
    meses.push({ ano: a, mes: m });
  }

  const totais = await Promise.all(
    meses.map(async ({ ano, mes }) => {
      const chave = `${carteiraId}:${ano}-${String(mes + 1).padStart(2, "0")}`;
      if (cacheTendencia.has(chave)) return cacheTendencia.get(chave);

      try {
        const resposta = await fetch(`${API_URL}/api/lancamentos?carteira_id=${carteiraId}&mes=${mes + 1}&ano=${ano}`, {
          headers: headersAutenticados(false),
        });
        if (!resposta.ok) return 0;
        const dadosMes = await resposta.json();
        const total = dadosMes.filter((l) => l.tipo === "despesa" && l.status === "pago").reduce((soma, l) => soma + l.valor, 0);
        cacheTendencia.set(chave, total);
        return total;
      } catch {
        return 0;
      }
    }),
  );

  if (idRequisicao !== ultimaRequisicaoTendencia) return;

  renderizarTendencia(meses, totais, mesBase, anoBase);
}

function renderizarTendencia(meses, totais, mesAtualIdx, anoAtual) {
  const card = document.getElementById("card-tendencia");
  const container = document.getElementById("grafico-tendencia");
  if (!card || !container) return;

  const algumValor = totais.some((v) => v > 0);
  if (!algumValor) {
    card.style.display = "none";
    return;
  }

  card.style.display = "flex";
  container.innerHTML = "";

  const maior = Math.max(...totais, 1);

  meses.forEach(({ ano, mes }, i) => {
    const altura = Math.round((totais[i] / maior) * 100);
    const ehMesAtual = mes === mesAtualIdx && ano === anoAtual;

    const coluna = document.createElement("div");
    coluna.className = "tendencia-coluna";
    coluna.innerHTML = `
      <span class="tendencia-valor">${totais[i] > 0 ? formatadorBRL.format(totais[i]).replace("R$", "").trim() : ""}</span>
      <div class="tendencia-barra-trilho">
        <div class="tendencia-barra ${ehMesAtual ? "tendencia-barra-atual" : ""}" data-altura="${altura}"></div>
      </div>
      <span class="tendencia-rotulo">${NOMES_MESES_ABREV[mes]}</span>
    `;
    container.appendChild(coluna);
  });

  requestAnimationFrame(() => {
    container.querySelectorAll(".tendencia-barra").forEach((barra) => {
      barra.style.height = `${barra.dataset.altura}%`;
    });
  });
}


// --- FUNÇÃO PARA EXCLUIR REGISTROS ---
async function apagarLancamento(id) {
  if (!(await pedirConfirmacao("Deseja realmente excluir este lançamento permanentemente?", { textoConfirmar: "Excluir", perigo: true }))) return;

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
      await mostrarAviso(`Não foi possível apagar: ${erro.erro}`);
    }
  } catch (erro) {
    console.error(erro);
    await mostrarAviso("Erro ao se conectar com a nuvem.");
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
    secaoDashboard.style.display = "block";
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
      await mostrarAviso("Defina uma senha para o novo usuário.");
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
        await mostrarAviso(`Erro: ${erro.erro}`);
      }
    } catch (erro) {
      await mostrarAviso("Erro de conexão ao salvar usuário.");
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
  if (!(await pedirConfirmacao("Excluir este usuário permanentemente? Essa ação não pode ser desfeita.", { textoConfirmar: "Excluir", perigo: true }))) return;

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
      await mostrarAviso(`Não foi possível excluir: ${erro.erro}`);
      botao.disabled = false;
      botao.innerText = "Excluir";
    }
  } catch (erro) {
    await mostrarAviso("Erro ao se conectar com o servidor.");
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
        await mostrarAviso(`Erro: ${erro.erro}`);
      }
    } catch (erro) {
      await mostrarAviso("Erro de conexão ao cadastrar categoria.");
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
          <button type="button" class="btn-editar-usuario" data-id="${cat.id}" data-nome="${cat.nome}" title="Renomear categoria">Editar</button>
          <button type="button" class="btn-excluir-conta" data-id="${cat.id}" title="Excluir categoria">Excluir</button>
        </div>
      `;
      container.appendChild(div);
    });

    container.querySelectorAll(".btn-editar-usuario").forEach((btn) => {
      btn.addEventListener("click", () => abrirModalRenomearCategoria(Number(btn.dataset.id), btn.dataset.nome));
    });
    container.querySelectorAll(".btn-excluir-conta").forEach((btn) => {
      btn.addEventListener("click", () => excluirCategoria(Number(btn.dataset.id), btn));
    });
  } catch (erro) {
    container.innerHTML = '<p style="color: var(--cor-despesa); padding: 1rem;">Erro ao carregar categorias.</p>';
  }
}

async function excluirCategoria(id, botao) {
  if (!(await pedirConfirmacao("Excluir esta categoria da lista? Lançamentos que já usam ela não são afetados.", { textoConfirmar: "Excluir", perigo: true }))) return;

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
      await mostrarAviso(`Não foi possível excluir: ${erro.erro}`);
      botao.disabled = false;
      botao.innerText = "Excluir";
    }
  } catch (erro) {
    await mostrarAviso("Erro ao se conectar com o servidor.");
    botao.disabled = false;
    botao.innerText = "Excluir";
  }
}

window.carregarLancamentos = carregarLancamentos;
window.apagarLancamento = apagarLancamento;
window.alternarStatusLancamento = alternarStatusLancamento;
window.editarLancamento = editarLancamento;
window.carregarCarteiras = carregarCarteiras;

// --- RENOMEAR CATEGORIA (aplica em massa nos lançamentos e despesas fixas existentes) ---
function abrirModalRenomearCategoria(id, nomeAtual) {
  const modal = document.getElementById("modal-renomear-categoria");
  if (!modal) return;

  document.getElementById("categoria-renomear-id").value = id;
  document.getElementById("categoria-novo-nome").value = nomeAtual;
  modal.style.display = "flex";
}

function configurarModalRenomearCategoria() {
  const modal = document.getElementById("modal-renomear-categoria");
  const form = document.getElementById("form-renomear-categoria");
  const btnFechar = document.getElementById("btn-fechar-modal-renomear-categoria");

  if (!modal || !form || !btnFechar) return;

  btnFechar.addEventListener("click", () => {
    modal.style.display = "none";
  });

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const id = document.getElementById("categoria-renomear-id").value;
    const novoNome = document.getElementById("categoria-novo-nome").value.trim();
    const btnSalvar = document.getElementById("btn-salvar-renomear-categoria");

    btnSalvar.disabled = true;
    btnSalvar.innerText = "Renomeando...";

    try {
      const resposta = await fetch(`${API_URL}/api/categorias?id=${id}`, {
        method: "PUT",
        headers: headersAutenticados(),
        body: JSON.stringify({ nome: novoNome }),
      });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        modal.style.display = "none";
        carregarListaCategorias();
      } else {
        const erro = await resposta.json();
        await mostrarAviso(`Erro: ${erro.erro}`);
      }
    } catch (erro) {
      await mostrarAviso("Erro de conexão ao renomear categoria.");
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.innerText = "Renomear";
    }
  });
}
