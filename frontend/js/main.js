// ==========================================
// main.js - Controle de Interface, UI e Filtros
// ==========================================
//
// ESTRUTURA DO ARQUIVO:
// [1]   CONSTANTES E HELPERS GLOBAIS
// [2]   ESTADO GLOBAL
// [3]   UI: Focus Trap, Toast, Aviso, Confirmação
// [4]   INICIALIZAÇÃO (DOMContentLoaded)
// [5]   FILTROS: Mês, Período, Dark Mode
// [6]   CARTEIRAS: Carregamento, Renderização, Tabs
// [7]   MODAIS: Carteira, Transferência, Orçamento, Membros
// [8]   DESPESAS FIXAS
// [9]   COMPRAS PARCELADAS
// [10]  ORÇAMENTOS MENSAIS
// [11]  METAS E DEPÓSITOS
// [12]  CATEGORIAS (Utilitários)
// [13]  LANÇAMENTOS: Modal, CRUD, Renderização
// [14]  ANIMAÇÕES
// [15]  RENDERIZAÇÃO: Lista de Lançamentos, Grupos
// [16]  NOTIFICAÇÕES
// [17]  EDIÇÃO EM LOTE
// [18]  POPUP DE NOTA
// [19]  COMPARATIVO POR PERÍODO
// [20]  CARREGAMENTO PRINCIPAL (carregarLancamentos)
// [21]  DASHBOARD: Resumo Categorias, Autores, KPIs
// [22]  STATUS: Alternar Pago/Pendente
// [23]  COMPARAÇÃO MÊS A MÊS
// [24]  TENDÊNCIA E GRÁFICOS
// [25]  TAXA DE POUPANÇA
// [26]  APAGAR LANÇAMENTO
// [27]  ADMIN: Painel, Usuários, Categorias
// [28]  PLANEJAMENTO: Planos Financeiros
// [29]  EXPORTAÇÃO GLOBAL
// ==========================================

// ==========================================
// [1] CONSTANTES E HELPERS GLOBAIS
// ==========================================

// ==========================================
// HELPER: headers autenticados para chamadas à API
// ==========================================
function headersAutenticados(comJson = true) {
  const token = obterToken();
  const headers = {};
  if (comJson) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// Se a API responder 401 (sessão inválida/expirada), desloga e volta pro login
function tratarSessaoExpirada(resposta) {
  if (resposta.status === 401) {
    limparSessao();
    alternarTelas(false);
    mostrarAviso("Sua sessão expirou. Faça login novamente."); // não bloqueia: a função precisa continuar síncrona
    return true;
  }
  return false;
}

function formatarDataHora(dataISO) {
  if (!dataISO) return "—";
  try {
    const normalizado = dataISO.replace(" ", "T");
    const d = new Date(normalizado);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

// ==========================================
// FOCUS TRAP — mantém o Tab preso dentro do modal aberto
// ==========================================
let modalFocoAtivo = null;
let trapHandler = null;

function trapFoco(modal) {
  liberarFoco();
  modalFocoAtivo = modal;
  const anterior = document.activeElement;

  function aoTeclar(e) {
    if (e.key === "Escape") {
      const btnFechar = modal.querySelector("[id^='btn-fechar-modal'], #btn-aviso-ok, #btn-confirmacao-cancelar, #btn-fechar-modal-meta");
      if (btnFechar) btnFechar.click();
      return;
    }
    if (e.key !== "Tab") return;

    const alvos = modal.querySelectorAll(
      'button:not([disabled]):not([style*="display: none"]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (alvos.length === 0) return;

    const primeiro = alvos[0];
    const ultimo = alvos[alvos.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      }
    } else {
      if (document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }
  }

  trapHandler = aoTeclar;
  document.addEventListener("keydown", aoTeclar);

  requestAnimationFrame(() => {
    const focavel = modal.querySelector(
      'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
    );
    if (focavel) focavel.focus();
  });

  return () => {
    document.removeEventListener("keydown", aoTeclar);
    trapHandler = null;
    modalFocoAtivo = null;
    if (anterior && anterior.focus) anterior.focus();
  };
}

function liberarFoco() {
  if (trapHandler) {
    document.removeEventListener("keydown", trapHandler);
    trapHandler = null;
    modalFocoAtivo = null;
  }
}

// ==========================================
// TOAST — notificação flutuante de feedback
// ==========================================
function mostrarToast(mensagem, tipo = "sucesso", duracao = 2500) {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${tipo}`;
  toast.textContent = mensagem;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-saindo");
    toast.addEventListener("animationend", () => toast.remove());
  }, duracao);
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
    const liberar = trapFoco(modal);

    function aoFechar() {
      modal.style.display = "none";
      liberar();
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
    const liberar = trapFoco(modal);

    function limpar() {
      modal.style.display = "none";
      liberar();
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
  const ehCadastroConvite = verificarCadastroConvite();
  if (ehCadastroConvite) return;

  inicializarFiltroMes();
  inicializarDarkMode();
  configurarMonitoresDeFiltro();
  configurarBuscaLancamentos();
  configurarNotificacoes();
  configurarLote();
  configurarPopupNota();
  configurarComparativoPeriodo();
  configurarModal();
  configurarModalCarteira();
  configurarModalGerenciarMembros();
  configurarModalDespesasFixas();
  configurarModalComprasParceladas();
  configurarModalMeta();
  configurarModalDeposito();
  configurarModalRenomearCategoria();
  configurarPainelAdmin();
  configurarPlano();
  configurarModalTransferencia();
  configurarModalOrcamento();
  configurarModalCartaoCredito();
  configurarRelatorios();

  // Botão de transferência
  const btnTransferencia = document.getElementById("btn-transferencia");
  if (btnTransferencia) {
    btnTransferencia.addEventListener("click", () => window.abrirModalTransferencia());
  }

  // Botão de novo orçamento
  const btnNovoOrcamento = document.getElementById("btn-novo-orcamento");
  if (btnNovoOrcamento) {
    btnNovoOrcamento.addEventListener("click", () => window.abrirModalOrcamento());
  }

  // Botão de novo cartão de crédito
  const btnNovoCartao = document.getElementById("btn-novo-cartao");
  if (btnNovoCartao) {
    btnNovoCartao.addEventListener("click", () => window.abrirModalCartao());
  }

  // Botão de cartões de crédito no header
  const btnCartoesCredito = document.getElementById("btn-cartoes-credito");
  if (btnCartoesCredito) {
    btnCartoesCredito.addEventListener("click", () => {
      // Se já tem cartões, scrolla para o painel; senão abre modal de novo
      if (cartoesCreditoCarregados.length > 0) {
        const card = document.getElementById("card-cartoes-credito");
        if (card && card.style.display !== "none") {
          card.scrollIntoView({ behavior: "smooth" });
          return;
        }
      }
      window.abrirModalCartao();
    });
  }

  // Botão de relatório PDF
  const btnRelatorioPdf = document.getElementById("btn-relatorio-pdf");
  if (btnRelatorioPdf) {
    btnRelatorioPdf.addEventListener("click", gerarRelatorioPDF);
  }

  // PWA: instalação na tela inicial
  configurarInstallBanner();
});

// --- PWA INSTALL BANNER ---
let deferredInstallPrompt = null;

function configurarInstallBanner() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    mostrarBannerInstalacao();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    ocultarBannerInstalacao();
    mostrarToast("App instalado com sucesso!", "sucesso");
  });
}

function mostrarBannerInstalacao() {
  if (localStorage.getItem("cadimus_install_dismissed") === "1") return;
  if (typeof obterUsuarioLogado !== "function") return;
  const usuario = obterUsuarioLogado();
  if (!usuario) return;

  let banner = document.getElementById("pwa-install-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "pwa-install-banner";
    banner.className = "pwa-install-banner";
    banner.innerHTML = `
      <span class="pwa-install-texto">📱 Instale o Gestor Financeiro na sua tela inicial</span>
      <div class="pwa-install-acoes">
        <button type="button" class="pwa-install-btn" id="pwa-install-btn">Instalar</button>
        <button type="button" class="pwa-install-dismiss" id="pwa-install-dismiss">Agora não</button>
      </div>
    `;
    document.body.appendChild(banner);

    document.getElementById("pwa-install-btn").addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === "accepted") {
        mostrarToast("Instalando app...");
      }
      deferredInstallPrompt = null;
      ocultarBannerInstalacao();
    });

    document.getElementById("pwa-install-dismiss").addEventListener("click", () => {
      localStorage.setItem("cadimus_install_dismissed", "1");
      ocultarBannerInstalacao();
    });
  }
}

function ocultarBannerInstalacao() {
  const banner = document.getElementById("pwa-install-banner");
  if (banner) banner.remove();
}

// --- ONBOARDING INTERATIVO (Tour Guiado) ---
const ONBOARDING_STEPS = [
  { alvo: ".seletor-mes", titulo: "Navegue pelos meses", texto: "Use as setas para ver lançamentos de outros meses." },
  { alvo: ".carteira-tabs", titulo: "Suas carteiras", texto: "Clique para trocar de conta ou criar uma nova." },
  { alvo: "#btn-novo-gasto", titulo: "Novo lançamento", texto: "Adicione receitas e despesas aqui." },
  { alvo: "#btn-transferencia", titulo: "Transferências", texto: "Transfira valores entre suas carteiras." },
  { alvo: "#btn-notificacoes", titulo: "Alertas", texto: "Notificações de vencimentos aparecem aqui." },
];

function iniciarOnboarding() {
  if (localStorage.getItem("cadimus_onboarding_done") === "1") return;
  const usuario = obterUsuarioLogado();
  if (!usuario) return;

  // Só iniciar se estiver no dashboard (não na tela de login)
  const dashboard = document.getElementById("dashboard-section");
  if (!dashboard || dashboard.style.display === "none") return;

  const firstLogin = !localStorage.getItem("cadimus_onboarding_seen_" + usuario.id);
  if (!firstLogin && localStorage.getItem("cadimus_onboarding_done") !== "0") return;

  localStorage.setItem("cadimus_onboarding_seen_" + usuario.id, "1");
  localStorage.setItem("cadimus_onboarding_done", "0");

  let stepIdx = 0;

  function showStep(idx) {
    removerOnboarding();

    if (idx >= ONBOARDING_STEPS.length) {
      localStorage.setItem("cadimus_onboarding_done", "1");
      removerOnboarding();
      return;
    }

    const step = ONBOARDING_STEPS[idx];
    const alvo = document.querySelector(step.alvo);
    if (!alvo || alvo.offsetParent === null) { showStep(idx + 1); return; }

    const rect = alvo.getBoundingClientRect();
    const overlay = document.createElement("div");
    overlay.className = "onboarding-overlay";
    overlay.innerHTML = `
      <div class="onboarding-tooltip" style="top:${rect.bottom + 10}px; left:${Math.min(rect.left, window.innerWidth - 300)}px;">
        <div class="onboarding-tooltip-titulo">${step.titulo}</div>
        <div class="onboarding-tooltip-texto">${step.texto}</div>
        <div class="onboarding-tooltip-nav">
          <span class="onboarding-progresso">${idx + 1} / ${ONBOARDING_STEPS.length}</span>
          <div class="onboarding-botoes">
            <button type="button" class="onboarding-btn onboarding-pular">Pular</button>
            <button type="button" class="onboarding-btn onboarding-proximo">Próximo</button>
          </div>
        </div>
      </div>
      <div class="onboarding-highlight" style="top:${rect.top - 4}px; left:${rect.left - 4}px; width:${rect.width + 8}px; height:${rect.height + 8}px;"></div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector(".onboarding-proximo").addEventListener("click", () => showStep(idx + 1));
    overlay.querySelector(".onboarding-pular").addEventListener("click", () => {
      localStorage.setItem("cadimus_onboarding_done", "1");
      removerOnboarding();
    });
  }

  function removerOnboarding() {
    document.querySelectorAll(".onboarding-overlay").forEach((el) => el.remove());
  }

  // Iniciar após a renderização do dashboard
  setTimeout(() => showStep(0), 1200);
}

// Expor para chamada externa
window.iniciarOnboarding = iniciarOnboarding;

// --- SELETOR DE MÊS (setas, sem depender do calendário nativo do navegador) ---
// ==========================================
// [2] ESTADO GLOBAL
// ==========================================
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

// ==========================================
// [5] FILTROS: Mês, Período, Dark Mode
// ==========================================

// --- MODO ESCURO ---
const ICONE_LUA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>';
const ICONE_SOL =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';

function inicializarDarkMode() {
  const areaAcoes = document.querySelector(".acoes-topo");
  if (!areaAcoes) return;

  const btnTheme = document.createElement("button");
  btnTheme.id = "btn-theme-toggle";
  btnTheme.className = "btn-topo-icone btn-topo-icone-only";
  btnTheme.title = "Alternar tema";

  areaAcoes.insertBefore(btnTheme, document.querySelector(".avatar-dropdown-wrapper"));

  function atualizarIconeTema() {
    // Mostra o ícone do modo que a pessoa vai ATIVAR ao clicar (convenção comum)
    const estaEscuro = document.body.classList.contains("dark-mode");
    btnTheme.innerHTML = estaEscuro ? ICONE_SOL : ICONE_LUA;
  }

  if (localStorage.getItem("cadimus_tema") === "dark") {
    document.body.classList.add("dark-mode");
  }
  atualizarIconeTema();

  btnTheme.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    localStorage.setItem("cadimus_tema", document.body.classList.contains("dark-mode") ? "dark" : "light");
    atualizarIconeTema();
  });
}

// ==========================================
// [6] CARTEIRAS: Carregamento, Renderização, Tabs
// ==========================================

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

  carteirasDoUsuario.forEach((carteira, indice) => {
    const wrapper = document.createElement("div");
    wrapper.className = "tab-carteira-wrapper";
    wrapper.draggable = true;
    wrapper.dataset.id = carteira.id;

    wrapper.addEventListener("dragstart", (evento) => {
      wrapper.classList.add("arrastando");
      evento.dataTransfer.setData("text/plain", String(carteira.id));
      evento.dataTransfer.effectAllowed = "move";
    });

    wrapper.addEventListener("dragend", () => {
      wrapper.classList.remove("arrastando");
      container.querySelectorAll(".tab-carteira-wrapper").forEach((w) => w.classList.remove("alvo-drop"));
    });

    wrapper.addEventListener("dragover", (evento) => {
      evento.preventDefault();
      evento.dataTransfer.dropEffect = "move";
      wrapper.classList.add("alvo-drop");
    });

    wrapper.addEventListener("dragleave", () => {
      wrapper.classList.remove("alvo-drop");
    });

    wrapper.addEventListener("drop", (evento) => {
      evento.preventDefault();
      wrapper.classList.remove("alvo-drop");
      const idArrastado = evento.dataTransfer.getData("text/plain");
      if (!idArrastado || String(idArrastado) === String(carteira.id)) return;
      reordenarCarteiras(idArrastado, carteira.id);
    });

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab-carteira";
    btn.dataset.valor = carteira.id;
    btn.title = carteira.tipo === "compartilhada" ? `${carteira.nome} · compartilhada` : `${carteira.nome} · só sua`;
    if (aindaExiste && String(carteira.id) === String(valorAtual)) {
      btn.classList.add("ativo");
    }
    if (carteira.tipo === "compartilhada") {
      btn.classList.add("tab-compartilhada");
    }

    // Ícone do tipo de carteira
    const svgIcone = carteira.tipo === "compartilhada"
      ? `<svg class="tab-carteira-icone" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
      : `<svg class="tab-carteira-icone" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

    btn.innerHTML = svgIcone + `<span class="tab-carteira-nome">${escaparHtml(carteira.nome)}</span>`;
    btn.addEventListener("click", () => selecionarCarteira(carteira.id));
    wrapper.appendChild(btn);

    // Quem é admin da carteira (individual sempre é; compartilhada só quem administra)
    // pode abrir as configurações dela — gerenciar membros (se compartilhada) e excluir.
    if (carteira.papel === "admin") {
      const btnGerenciar = document.createElement("button");
      btnGerenciar.type = "button";
      btnGerenciar.className = "btn-gerenciar-membros";
      btnGerenciar.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>`;
      btnGerenciar.title = `Configurações de "${carteira.nome}"`;
      btnGerenciar.addEventListener("click", (evento) => {
        evento.stopPropagation();
        abrirModalGerenciarMembros(carteira);
      });
      wrapper.appendChild(btnGerenciar);
    }

    container.appendChild(wrapper);
  });

  // Separador visual antes do botão de adicionar
  const separador = document.createElement("div");
  separador.className = "tab-carteira-separador";
  container.appendChild(separador);

  const btnAdd = document.createElement("button");
  btnAdd.type = "button";
  btnAdd.className = "tab-carteira-add";
  btnAdd.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  btnAdd.title = "Nova carteira";
  btnAdd.setAttribute("aria-label", "Nova carteira");
  btnAdd.addEventListener("click", () => abrirModalCarteira());
  container.appendChild(btnAdd);

  // Se a carteira selecionada não existe mais (ou é a primeira carga), seleciona a primeira disponível
  if (!aindaExiste && carteirasDoUsuario.length > 0) {
    selecionarCarteira(carteirasDoUsuario[0].id);
  }
}

function reordenarCarteiras(idArrastadoStr, idAlvo) {
  const idArrastado = carteirasDoUsuario.find((c) => String(c.id) === String(idArrastadoStr))?.id;
  if (idArrastado === undefined) return;

  const indiceOrigem = carteirasDoUsuario.findIndex((c) => String(c.id) === String(idArrastado));
  const indiceDestino = carteirasDoUsuario.findIndex((c) => String(c.id) === String(idAlvo));
  if (indiceOrigem === -1 || indiceDestino === -1) return;

  const [movida] = carteirasDoUsuario.splice(indiceOrigem, 1);
  carteirasDoUsuario.splice(indiceDestino, 0, movida);

  renderizarTabsCarteira();
  salvarOrdemCarteiras();
}

async function salvarOrdemCarteiras() {
  try {
    const resposta = await fetch(`${API_URL}/api/carteiras`, {
      method: "PATCH",
      headers: headersAutenticados(),
      body: JSON.stringify({ ordem: carteirasDoUsuario.map((c) => c.id) }),
    });
    tratarSessaoExpirada(resposta);
  } catch (erro) {
    // Se falhar, a ordem só não persiste — não vale travar a interface por isso
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
// ==========================================
// [7] MODAIS: Carteira, Transferência, Orçamento, Membros
// ==========================================

function abrirModalCarteira() {
  const modal = document.getElementById("modal-carteira");
  if (modal) {
    modal.style.display = "flex";
    trapFoco(modal);
  }
}

function configurarModalCarteira() {
  const modal = document.getElementById("modal-carteira");
  const btnFechar = document.getElementById("btn-fechar-modal-carteira");
  const form = document.getElementById("form-carteira");
  const selectTipo = document.getElementById("tipo-carteira");
  const campoMembros = document.getElementById("campo-membros-carteira");
  const listaMembros = document.getElementById("lista-membros-carteira");

  if (!modal || !btnFechar || !form) return;

  async function atualizarListaMembros() {
    if (selectTipo.value !== "compartilhada") {
      campoMembros.style.display = "none";
      return;
    }

    campoMembros.style.display = "block";
    listaMembros.innerHTML = `<span class="dica-campo">Carregando...</span>`;

    try {
      const resposta = await fetch(`${API_URL}/api/carteiras?colegas=1`, { headers: headersAutenticados() });
      if (tratarSessaoExpirada(resposta)) return;
      const colegas = await resposta.json();

      if (colegas.length === 0) {
        listaMembros.innerHTML = `<span class="dica-campo">Não há outros usuários cadastrados ainda.</span>`;
        return;
      }

      // Vem pré-marcado pra manter a conveniência de quem sempre compartilhou
      // com todo mundo — mas agora dá pra desmarcar quem não deve ter acesso.
      listaMembros.innerHTML = colegas
        .map(
          (colega) => `
        <label class="opcao-membro">
          <input type="checkbox" class="checkbox-membro-carteira" value="${colega.id}" checked />
          ${escaparHtml(colega.nome || colega.nome_usuario)}
        </label>
      `,
        )
        .join("");
    } catch (erro) {
      listaMembros.innerHTML = `<span class="dica-campo">Não foi possível carregar a lista de usuários.</span>`;
    }
  }

  selectTipo?.addEventListener("change", atualizarListaMembros);

  btnFechar.addEventListener("click", () => {
    modal.style.display = "none";
    liberarFoco();
    form.reset();
    campoMembros.style.display = "none";
  });

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const btnSalvar = document.getElementById("btn-salvar-carteira");
    btnSalvar.innerText = "Criando...";
    btnSalvar.disabled = true;

    try {
      const nome = document.getElementById("nome-carteira").value.trim();
      const tipo = document.getElementById("tipo-carteira").value;
      const corpo = { nome, tipo };

      if (tipo === "compartilhada") {
        corpo.membros = Array.from(document.querySelectorAll(".checkbox-membro-carteira:checked")).map((chk) => Number(chk.value));
      }

      const resposta = await fetch(`${API_URL}/api/carteiras`, {
        method: "POST",
        headers: headersAutenticados(),
        body: JSON.stringify(corpo),
      });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        const novaCarteira = await resposta.json();
        modal.style.display = "none";
        form.reset();
        campoMembros.style.display = "none";
        await carregarCarteiras();
        selecionarCarteira(novaCarteira.id);
        mostrarToast("Carteira criada");
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

// --- MODAL: TRANSFERÊNCIA ENTRE CARTEIRAS ---
function configurarModalTransferencia() {
  const modal = document.getElementById("modal-transferencia");
  const btnFechar = document.getElementById("btn-fechar-modal-transferencia");
  const form = document.getElementById("form-transferencia");
  const selectOrigem = document.getElementById("transferencia-carteira-origem");
  const selectDestino = document.getElementById("transferencia-carteira-destino");

  if (!modal || !btnFechar || !form) return;

  // Preencher selects com as carteiras do usuário
  function preencherSelectsCarteiras() {
    if (!carteirasDoUsuario || carteirasDoUsuario.length === 0) return;

    const opcoesHtml = carteirasDoUsuario
      .map((c) => `<option value="${c.id}">${escaparHtml(c.nome)}</option>`)
      .join("");

    selectOrigem.innerHTML = `<option value="" disabled selected>Selecionar carteira</option>${opcoesHtml}`;
    selectDestino.innerHTML = `<option value="" disabled selected>Selecionar carteira</option>${opcoesHtml}`;
  }

  // Abrir modal
  function abrirModalTransferencia() {
    preencherSelectsCarteiras();
    document.getElementById("transferencia-data").valueAsDate = new Date();
    modal.style.display = "flex";
    trapFoco(modal);
  }

  // Expor globalmente para chamar do botão
  window.abrirModalTransferencia = abrirModalTransferencia;

  // Fechar modal
  btnFechar.addEventListener("click", () => {
    modal.style.display = "none";
    liberarFoco();
    form.reset();
  });

  // Submeter transferência
  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const btnSalvar = document.getElementById("btn-salvar-transferencia");
    btnSalvar.innerText = "Transferindo...";
    btnSalvar.disabled = true;

    try {
      const origemId = Number(selectOrigem.value);
      const destinoId = Number(selectDestino.value);
      const valor = parseFloat(document.getElementById("transferencia-valor").value);
      const data = document.getElementById("transferencia-data").value;
      const descricao = document.getElementById("transferencia-descricao").value.trim();

      // Validações locais
      if (!origemId || !destinoId) {
        await mostrarAviso("Selecione as carteiras de origem e destino.");
        return;
      }

      if (origemId === destinoId) {
        await mostrarAviso("As carteiras de origem e destino devem ser diferentes.");
        return;
      }

      if (!valor || valor <= 0) {
        await mostrarAviso("Informe um valor válido.");
        return;
      }

      const resposta = await fetch(`${API_URL}/api/transferencias`, {
        method: "POST",
        headers: headersAutenticados(),
        body: JSON.stringify({
          valor,
          data_transferencia: data,
          carteira_origem_id: origemId,
          carteira_destino_id: destinoId,
          descricao,
        }),
      });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        modal.style.display = "none";
        liberarFoco();
        form.reset();
        carregarLancamentos();
        mostrarToast("Transferência realizada com sucesso!");
      } else {
        const erro = await resposta.json();
        await mostrarAviso(`Erro: ${erro.erro}`);
      }
    } catch (erro) {
      await mostrarAviso("Falha na comunicação com o servidor.");
    } finally {
      btnSalvar.innerText = "Transferir";
      btnSalvar.disabled = false;
    }
  });
}

// --- MODAL: ORÇAMENTO MENSAL POR CATEGORIA ---
function configurarModalOrcamento() {
  const modal = document.getElementById("modal-orcamento");
  const btnFechar = document.getElementById("btn-fechar-modal-orcamento");
  const form = document.getElementById("form-orcamento");
  const selectCategoria = document.getElementById("orcamento-categoria");

  if (!modal || !btnFechar || !form) return;

  // Preencher select de categorias
  async function carregarCategorias() {
    try {
      const resposta = await fetch(`${API_URL}/api/categorias`, { headers: headersAutenticados(false) });
      if (tratarSessaoExpirada(resposta)) return;
      const categorias = await resposta.json();

      const categoriasDespesa = categorias.filter((c) => c.tipo === "despesa" || !c.tipo);
      selectCategoria.innerHTML = `<option value="" disabled selected>Selecionar categoria</option>`;
      categoriasDespesa.forEach((c) => {
        selectCategoria.innerHTML += `<option value="${escaparHtml(c.nome)}">${escaparHtml(c.nome)}</option>`;
      });
    } catch (erro) {
      console.error("Erro ao carregar categorias:", erro);
    }
  }

  // Abrir modal
  function abrirModalOrcamento() {
    carregarCategorias();
    const agora = new Date();
    document.getElementById("orcamento-mes").value = agora.getMonth() + 1;
    document.getElementById("orcamento-ano").value = agora.getFullYear();
    document.getElementById("orcamento-editando-id").value = "";
    document.getElementById("titulo-modal-orcamento").innerText = "Novo orçamento";
    modal.style.display = "flex";
    trapFoco(modal);
  }

  // Expor globalmente
  window.abrirModalOrcamento = abrirModalOrcamento;

  // Fechar modal
  btnFechar.addEventListener("click", () => {
    modal.style.display = "none";
    liberarFoco();
    form.reset();
  });

  // Submeter orçamento
  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const btnSalvar = document.getElementById("btn-salvar-orcamento");
    btnSalvar.innerText = "Salvando...";
    btnSalvar.disabled = true;

    try {
      const categoria = selectCategoria.value;
      const valor = parseFloat(document.getElementById("orcamento-valor").value);
      const mes = parseInt(document.getElementById("orcamento-mes").value);
      const ano = parseInt(document.getElementById("orcamento-ano").value);
      const carteiraId = document.getElementById("seletor-carteira").value;

      if (!categoria || !valor || !mes || !ano || !carteiraId) {
        await mostrarAviso("Preencha todos os campos.");
        return;
      }

      if (valor < 0) {
        await mostrarAviso("O valor não pode ser negativo.");
        return;
      }

      const resposta = await fetch(`${API_URL}/api/orcamentos`, {
        method: "POST",
        headers: headersAutenticados(),
        body: JSON.stringify({
          categoria,
          valor,
          mes,
          ano,
          carteira_id: Number(carteiraId),
        }),
      });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        modal.style.display = "none";
        liberarFoco();
        form.reset();
        carregarOrcamentos();
        mostrarToast("Orçamento salvo com sucesso!");
      } else {
        const erro = await resposta.json();
        await mostrarAviso(`Erro: ${erro.erro}`);
      }
    } catch (erro) {
      await mostrarAviso("Falha na comunicação com o servidor.");
    } finally {
      btnSalvar.innerText = "Salvar orçamento";
      btnSalvar.disabled = false;
    }
  });
}

// --- MODAL: CARTÃO DE CRÉDITO ---
let cartoesCreditoCarregados = [];

function configurarModalCartaoCredito() {
  const modal = document.getElementById("modal-cartao-credito");
  const btnFechar = document.getElementById("btn-fechar-modal-cartao");
  const form = document.getElementById("form-cartao-credito");

  if (!modal || !btnFechar || !form) return;

  function abrirModalCartao(editar) {
    form.reset();
    document.getElementById("cartao-editando-id").value = "";
    document.getElementById("titulo-modal-cartao").innerText = "Novo cartão de crédito";

    if (editar) {
      document.getElementById("cartao-editando-id").value = editar.id;
      document.getElementById("titulo-modal-cartao").innerText = "Editar cartão";
      document.getElementById("cartao-nome").value = editar.nome || "";
      document.getElementById("cartao-bandeira").value = editar.bandeira || "outro";
      document.getElementById("cartao-ultimos4").value = editar.ultimos4 || "";
      document.getElementById("cartao-dia-fechamento").value = editar.dia_fechamento;
      document.getElementById("cartao-dia-vencimento").value = editar.dia_vencimento;
      document.getElementById("cartao-limite").value = editar.limite || "";
    }

    modal.style.display = "flex";
    trapFoco(modal);
  }

  window.abrirModalCartao = abrirModalCartao;

  btnFechar.addEventListener("click", () => {
    modal.style.display = "none";
    liberarFoco();
    form.reset();
  });

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const idEdicao = document.getElementById("cartao-editando-id").value;
    const btnSalvar = document.getElementById("btn-salvar-cartao");
    btnSalvar.disabled = true;
    btnSalvar.innerText = "Salvando...";

    try {
      const carteiraId = document.getElementById("seletor-carteira").value;
      const corpo = {
        nome: document.getElementById("cartao-nome").value.trim(),
        bandeira: document.getElementById("cartao-bandeira").value,
        ultimos4: document.getElementById("cartao-ultimos4").value.trim() || null,
        dia_fechamento: parseInt(document.getElementById("cartao-dia-fechamento").value),
        dia_vencimento: parseInt(document.getElementById("cartao-dia-vencimento").value),
        limite: parseFloat(document.getElementById("cartao-limite").value) || 0,
        carteira_id: Number(carteiraId),
      };

      const url = idEdicao ? `${API_URL}/api/cartoes-credito?id=${idEdicao}` : `${API_URL}/api/cartoes-credito`;
      const metodo = idEdicao ? "PUT" : "POST";

      const resposta = await fetch(url, {
        method: metodo,
        headers: headersAutenticados(),
        body: JSON.stringify(corpo),
      });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        modal.style.display = "none";
        liberarFoco();
        carregarCartoesCredito();
        mostrarToast(idEdicao ? "Cartão atualizado" : "Cartão criado", "sucesso");
      } else {
        const erro = await resposta.json();
        await mostrarAviso(`Erro: ${erro.erro}`);
      }
    } catch {
      await mostrarAviso("Falha na comunicação com o servidor.");
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.innerText = "Salvar cartão";
    }
  });
}

async function carregarCartoesCredito() {
  const card = document.getElementById("card-cartoes-credito");
  const container = document.getElementById("lista-cartoes-painel");
  const carteiraId = document.getElementById("seletor-carteira")?.value;
  if (!card || !container || !carteiraId) return;

  try {
    const resposta = await fetch(`${API_URL}/api/cartoes-credito?carteira_id=${carteiraId}`, {
      headers: headersAutenticados(false),
    });
    if (tratarSessaoExpirada(resposta)) return;
    if (!resposta.ok) return;

    cartoesCreditoCarregados = await resposta.json();

    if (cartoesCreditoCarregados.length === 0) {
      card.style.display = "none";
      return;
    }

    card.style.display = "flex";
    container.innerHTML = "";

    const NOMES_BANDEIRAS = { visa: "Visa", mastercard: "Mastercard", elo: "Elo", amex: "Amex", outro: "Cartão" };
    const CORES_BANDEIRAS = { visa: "#1a1f71", mastercard: "#eb001b", elo: "#f5a623", amex: "#006fcf", outro: "#666" };

    cartoesCreditoCarregados.forEach((cartao) => {
      const cor = CORES_BANDEIRAS[cartao.bandeira] || CORES_BANDEIRAS.outro;
      const nomeBandeira = NOMES_BANDEIRAS[cartao.bandeira] || "Cartão";
      const pctLimite = cartao.limite > 0 ? Math.min((cartao.gasto_atual / cartao.limite) * 100, 100) : 0;
      const corBarra = pctLimite >= 80 ? "var(--cor-despesa)" : pctLimite >= 50 ? "var(--cor-pendente)" : "var(--cor-receita)";

      const div = document.createElement("div");
      div.className = "cartao-item";
      div.innerHTML = `
        <div class="cartao-item-header">
          <div class="cartao-item-bandeira" style="background:${cor}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
          <div class="cartao-item-info">
            <strong>${escaparHtml(cartao.nome)}</strong>
            <span class="cartao-item-detalhe">${nomeBandeira}${cartao.ultimos4 ? " •••• " + cartao.ultimos4 : ""}</span>
          </div>
          <div class="cartao-item-acoes">
            <button type="button" class="cartao-editar-btn" data-id="${cartao.id}" title="Editar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button type="button" class="cartao-apagar-btn" data-id="${cartao.id}" data-nome="${escaparHtml(cartao.nome)}" title="Excluir">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        <div class="cartao-item-datas">
          <span>Fechamento: dia ${cartao.dia_fechamento}</span>
          <span>Vencimento: dia ${cartao.dia_vencimento}</span>
        </div>
        ${cartao.limite > 0 ? `
        <div class="cartao-item-limite">
          <div class="cartao-limite-texto">
            <span>${formatadorBRL.format(cartao.gasto_atual)} usado</span>
            <span>de ${formatadorBRL.format(cartao.limite)}</span>
          </div>
          <div class="cartao-limite-barra">
            <div class="cartao-limite-preenchimento" style="width:${pctLimite}%;background:${corBarra}"></div>
          </div>
        </div>
        ` : ""}
        ${cartao.parcelas_ativas > 0 ? `<div class="cartao-item-parcelas">${cartao.parcelas_ativas} parcela(s) ativa(s)</div>` : ""}
      `;
      container.appendChild(div);
    });

    // Eventos de editar
    container.querySelectorAll(".cartao-editar-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const cartao = cartoesCreditoCarregados.find((c) => c.id === id);
        if (cartao) abrirModalCartao(cartao);
      });
    });

    // Eventos de apagar
    container.querySelectorAll(".cartao-apagar-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        const nome = btn.dataset.nome;
        if (!(await pedirConfirmacao(`Excluir o cartão "${nome}"?`, { textoConfirmar: "Excluir", perigo: true }))) return;

        try {
          const resposta = await fetch(`${API_URL}/api/cartoes-credito?id=${id}`, {
            method: "DELETE",
            headers: headersAutenticados(),
          });
          if (tratarSessaoExpirada(resposta)) return;
          if (resposta.ok) {
            carregarCartoesCredito();
            mostrarToast("Cartão excluído", "sucesso");
          }
        } catch {
          await mostrarAviso("Erro ao excluir cartão.");
        }
      });
    });
  } catch (erro) {
    console.error("Erro ao carregar cartões:", erro);
  }
}

// --- MODAL: GERENCIAR MEMBROS DE UMA CARTEIRA COMPARTILHADA ---
async function abrirModalGerenciarMembros(carteira) {
  const modal = document.getElementById("modal-gerenciar-membros");
  const lista = document.getElementById("lista-gerenciar-membros");
  const campoMembros = document.getElementById("campo-gerenciar-membros");
  const btnSalvarMembros = document.getElementById("btn-salvar-membros");
  if (!modal || !lista) return;

  document.getElementById("titulo-gerenciar-membros").innerText = `Configurações de "${carteira.nome}"`;
  document.getElementById("gerenciar-membros-carteira-id").value = carteira.id;
  document.getElementById("btn-excluir-carteira").dataset.nome = carteira.nome;
  modal.style.display = "flex";
  trapFoco(modal);

  // Carteira individual não tem com quem compartilhar — só mostra a zona de excluir
  if (carteira.tipo !== "compartilhada") {
    campoMembros.style.display = "none";
    btnSalvarMembros.style.display = "none";
    return;
  }
  campoMembros.style.display = "";
  btnSalvarMembros.style.display = "";
  lista.innerHTML = `<span class="dica-campo">Carregando...</span>`;

  try {
    const [respostaMembros, respostaColegas] = await Promise.all([
      fetch(`${API_URL}/api/carteiras?membros=${carteira.id}`, { headers: headersAutenticados(false) }),
      fetch(`${API_URL}/api/carteiras?colegas=1`, { headers: headersAutenticados(false) }),
    ]);

    if (tratarSessaoExpirada(respostaMembros) || tratarSessaoExpirada(respostaColegas)) return;

    const dadosMembros = await respostaMembros.json();
    const colegas = await respostaColegas.json();

    if (!respostaMembros.ok) {
      lista.innerHTML = `<span class="dica-campo">${dadosMembros.erro || "Erro ao carregar membros."}</span>`;
      return;
    }

    const idsAtuais = new Set(dadosMembros.membros.map((m) => m.id));
    const idsAdmins = new Set(dadosMembros.membros.filter((m) => m.papel === "admin").map((m) => m.id));

    if (colegas.length === 0) {
      lista.innerHTML = `<span class="dica-campo">Não há outros usuários cadastrados ainda.</span>`;
      return;
    }

    lista.innerHTML = colegas
      .map((colega) => {
        const jaAdmin = idsAdmins.has(colega.id);
        const marcado = idsAtuais.has(colega.id);
        return `
          <label class="opcao-membro ${jaAdmin ? "opcao-membro-desabilitada" : ""}">
            <input type="checkbox" class="checkbox-gerenciar-membro" value="${colega.id}" ${marcado ? "checked" : ""} ${jaAdmin ? "disabled" : ""} />
            ${escaparHtml(colega.nome || colega.nome_usuario)}${jaAdmin ? " (admin)" : ""}
          </label>
        `;
      })
      .join("");
  } catch (erro) {
    lista.innerHTML = `<span class="dica-campo">Falha na comunicação com o servidor.</span>`;
  }
}

function configurarModalGerenciarMembros() {
  const modal = document.getElementById("modal-gerenciar-membros");
  const btnFechar = document.getElementById("btn-fechar-modal-membros");
  const btnSalvar = document.getElementById("btn-salvar-membros");
  const btnExcluir = document.getElementById("btn-excluir-carteira");

  if (!modal || !btnFechar || !btnSalvar || !btnExcluir) return;

  btnFechar.addEventListener("click", () => {
    modal.style.display = "none";
    liberarFoco();
  });

  btnExcluir.addEventListener("click", async () => {
    const carteiraId = document.getElementById("gerenciar-membros-carteira-id").value;
    const nome = btnExcluir.dataset.nome || "esta carteira";
    if (!carteiraId) return;

    const confirmou = await pedirConfirmacao(
      `Excluir "${nome}"? Todos os lançamentos, despesas fixas e metas dela serão apagados para sempre.`,
      { textoConfirmar: "Excluir", perigo: true },
    );
    if (!confirmou) return;

    btnExcluir.disabled = true;
    btnExcluir.innerText = "Excluindo...";

    try {
      const resposta = await fetch(`${API_URL}/api/carteiras?id=${carteiraId}`, {
        method: "DELETE",
        headers: headersAutenticados(false),
      });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        modal.style.display = "none";
        liberarFoco();
        carteirasDoUsuario = await (await fetch(`${API_URL}/api/carteiras`, { headers: headersAutenticados(false) })).json();
        renderizarTabsCarteira();
        mostrarToast("Carteira excluída", "info");
      } else {
        const erro = await resposta.json();
        await mostrarAviso(`Erro: ${erro.erro}`);
      }
    } catch (erro) {
      await mostrarAviso("Falha na comunicação com o servidor.");
    } finally {
      btnExcluir.disabled = false;
      btnExcluir.innerText = "Excluir esta carteira";
    }
  });

  btnSalvar.addEventListener("click", async () => {
    const carteiraId = document.getElementById("gerenciar-membros-carteira-id").value;
    if (!carteiraId) return;

    const membros = Array.from(document.querySelectorAll(".checkbox-gerenciar-membro:checked:not(:disabled)")).map((chk) => Number(chk.value));

    btnSalvar.disabled = true;
    btnSalvar.innerText = "Salvando...";

    try {
      const resposta = await fetch(`${API_URL}/api/carteiras?id=${carteiraId}`, {
        method: "PUT",
        headers: headersAutenticados(),
        body: JSON.stringify({ membros }),
      });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        modal.style.display = "none";
        liberarFoco();
        mostrarToast("Membros atualizados");
      } else {
        const erro = await resposta.json();
        await mostrarAviso(`Erro: ${erro.erro}`);
      }
    } catch (erro) {
      await mostrarAviso("Falha na comunicação com o servidor.");
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.innerText = "Salvar";
    }
  });
}


// ==========================================
// [8] DESPESAS FIXAS
// ==========================================

let despesasFixasCarregadas = [];

function fecharModalDespesaFixa() {
  const modal = document.getElementById("modal-despesas-fixas");
  const form = document.getElementById("form-despesa-fixa");

  modal.style.display = "none";
  liberarFoco();
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
  trapFoco(modal);
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
  trapFoco(modal);
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

  // Modal de histórico
  const modalHistorico = document.getElementById("modal-historico-fixa");
  const btnFecharHistorico = document.getElementById("btn-fechar-modal-historico-fixa");
  btnFecharHistorico?.addEventListener("click", () => {
    modalHistorico.style.display = "none";
    liberarFoco();
  });

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
        carregarLancamentos();
        mostrarToast(idEdicao ? "Despesa fixa atualizada" : "Despesa fixa criada");
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
        <button type="button" class="fixa-btn-toggle btn-alternar-fixa ${fixa.ativo ? "fixa-ativa" : "fixa-pausada"}" data-id="${fixa.id}" title="${fixa.ativo ? "Pausar" : "Ativar"}">
          ${fixa.ativo
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>'}
        </button>
        <div class="fixa-conteudo">
          <span class="item-descricao">${escaparHtml(fixa.descricao)}</span>
          <span class="item-categoria">${valorFormatado} · Dia ${fixa.dia_vencimento}</span>
          <div class="fixa-botoes">
            ${badgeAviso}
            <button type="button" class="fixa-btn btn-historico-fixa" data-id="${fixa.id}" data-descricao="${escaparHtml(fixa.descricao)}">Histórico</button>
            <button type="button" class="fixa-btn btn-editar-fixa" data-id="${fixa.id}">Editar</button>
            <button type="button" class="fixa-btn-excluir btn-excluir-conta" data-id="${fixa.id}">Excluir</button>
          </div>
        </div>
      `;
      container.appendChild(div);
    });

    container.querySelectorAll(".btn-editar-fixa").forEach((btn) => {
      btn.addEventListener("click", () => editarDespesaFixa(Number(btn.dataset.id)));
    });
    container.querySelectorAll(".btn-historico-fixa").forEach((btn) => {
      btn.addEventListener("click", () => abrirHistoricoFixa(Number(btn.dataset.id), btn.dataset.descricao));
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

  renderizarNotificacoes();
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
      mostrarToast(alvo.ativo ? "Despesa fixa pausada" : "Despesa fixa ativada", "info");
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
      mostrarToast("Despesa fixa excluída", "info");
    } else {
      const erro = await resposta.json();
      await mostrarAviso(`Erro: ${erro.erro}`);
    }
  } catch (erro) {
    await mostrarAviso("Erro de conexão.");
  }
}

// --- HISTÓRICO DE PAGAMENTOS (DESPESA FIXA) ---
async function abrirHistoricoFixa(fixaId, descricao) {
  const modal = document.getElementById("modal-historico-fixa");
  const titulo = document.getElementById("titulo-historico-fixa");
  const lista = document.getElementById("historico-fixa-lista");
  if (!modal || !titulo || !lista) return;

  titulo.textContent = `Histórico — ${descricao}`;
  lista.innerHTML = '<p class="historico-fixa-vazio">Carregando...</p>';
  modal.style.display = "flex";
  trapFoco(modal);

  try {
    const resposta = await fetch(`${API_URL}/api/lancamentos?despesa_fixa_id=${fixaId}`, {
      headers: headersAutenticados(false),
    });

    if (!resposta.ok) {
      lista.innerHTML = '<p class="historico-fixa-vazio">Erro ao carregar histórico.</p>';
      return;
    }

    const lancamentos = await resposta.json();

    if (lancamentos.length === 0) {
      lista.innerHTML = '<p class="historico-fixa-vazio">Nenhum pagamento registrado ainda.</p>';
      return;
    }

    lista.innerHTML = "";
    lancamentos.forEach((l) => {
      const dataFormatada = new Date(l.data_compra + "T12:00:00").toLocaleDateString("pt-BR");
      const valorFormatado = formatadorBRL.format(l.valor);
      const classeTipo = l.tipo === "receita" ? "texto-receita" : "texto-despesa";
      const sinal = l.tipo === "receita" ? "+" : "-";
      const dataVenc = new Date(l.data_compra + "T23:59:59");
      const hoje = new Date();
      const atrasado = l.status !== "pago" && dataVenc < hoje;
      const classeStatus = l.status === "pago" ? "status-pago" : atrasado ? "status-atrasado" : "status-pendente";
      const textoStatus = l.status === "pago" ? "Pago" : atrasado ? "Atrasado" : "Pendente";

      const linha = document.createElement("div");
      linha.className = "historico-fixa-linha";
      linha.innerHTML = `
        <span class="historico-fixa-data">${dataFormatada}</span>
        <span class="historico-fixa-valor ${classeTipo}">${sinal} ${valorFormatado}</span>
        <span class="historico-fixa-status ${classeStatus}">${textoStatus}</span>
      `;
      lista.appendChild(linha);
    });
  } catch (erro) {
    lista.innerHTML = '<p class="historico-fixa-vazio">Erro de conexão.</p>';
  }
}

// ==========================================
// [9] COMPRAS PARCELADAS
// ==========================================

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
  trapFoco(modal);
}

function configurarModalComprasParceladas() {
  const modal = document.getElementById("modal-compra-parcelada");
  const btnAbrirTopo = document.getElementById("btn-compras-parceladas");
  const btnAbrirDoCard = document.getElementById("btn-nova-compra-parcelada");
  const btnFechar = document.getElementById("btn-fechar-modal-parcelada");
  const form = document.getElementById("form-compra-parcelada");
  const campoValorTotal = document.getElementById("parcelada-valor-total");
  const campoTotalParcelas = document.getElementById("parcelada-total");
  const preview = document.getElementById("parcelada-preview");

  if (!modal || !btnFechar || !form) return;

  btnAbrirTopo?.addEventListener("click", abrirModalComprasParceladas);
  btnAbrirDoCard?.addEventListener("click", abrirModalComprasParceladas);

  // Modal de histórico
  const modalHistorico = document.getElementById("modal-historico-parcela");
  const btnFecharHistorico = document.getElementById("btn-fechar-modal-historico-parcela");
  btnFecharHistorico?.addEventListener("click", () => {
    modalHistorico.style.display = "none";
    liberarFoco();
  });

  function atualizarPreview() {
    const total = parseFloat(campoValorTotal.value);
    const parcelas = parseInt(campoTotalParcelas.value, 10);

    if (!Number.isFinite(total) || total <= 0 || !Number.isInteger(parcelas) || parcelas < 2) {
      preview.style.display = "none";
      return;
    }

    const valorParcela = total / parcelas;
    preview.textContent = `= ${parcelas}x de ${formatadorBRL.format(valorParcela)}`;
    preview.style.display = "block";
  }

  campoValorTotal?.addEventListener("input", atualizarPreview);
  campoTotalParcelas?.addEventListener("input", atualizarPreview);

  btnFechar.addEventListener("click", () => {
    modal.style.display = "none";
    liberarFoco();
    form.reset();
    preview.style.display = "none";
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

      const valorTotal = parseFloat(campoValorTotal.value);
      const totalParcelas = parseInt(campoTotalParcelas.value, 10);
      // O valor de cada parcela é calculado aqui (total ÷ parcelas); o backend guarda
      // um valor fixo por parcela, então pode sobrar/faltar poucos centavos no total
      // exato — é a mesma simplificação que a maioria dos apps de finanças faz.
      const valorParcela = Math.round((valorTotal / totalParcelas) * 100) / 100;

      const corpo = {
        carteira_id: carteiraId,
        descricao: document.getElementById("parcelada-descricao").value.trim(),
        valor_parcela: valorParcela,
        total_parcelas: totalParcelas,
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
        preview.style.display = "none";
        modal.style.display = "none";
        liberarFoco();
        carregarPainelComprasParceladas();
        carregarLancamentos();
        mostrarToast("Compra parcelada criada");
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
        ${!concluida ? `
        <button type="button" class="fixa-btn-toggle btn-alternar-parcela ${compra.ativo ? "fixa-ativa" : "fixa-pausada"}" data-id="${compra.id}" title="${compra.ativo ? "Pausar" : "Ativar"}">
          ${compra.ativo
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>'}
        </button>` : ""}
        <div class="fixa-conteudo">
          <span class="item-descricao">${escaparHtml(compra.descricao)}</span>
          <span class="item-categoria">${rotuloParcela} · ${valorFormatado}/mês</span>
          <div class="fixa-botoes">
            <span class="item-status ${compra.ativo && !concluida ? "status-pago" : "status-pendente"}">${compra.ativo ? (concluida ? "Concluída" : "Ativa") : "Pausada"}</span>
            <button type="button" class="fixa-btn btn-historico-parcela" data-id="${compra.id}" data-descricao="${escaparHtml(compra.descricao)}">Histórico</button>
            <button type="button" class="fixa-btn-excluir btn-excluir-parcela" data-id="${compra.id}">Excluir</button>
          </div>
        </div>
      `;
      container.appendChild(div);
    });

    container.querySelectorAll(".btn-historico-parcela").forEach((btn) => {
      btn.addEventListener("click", () => abrirHistoricoParcela(Number(btn.dataset.id), btn.dataset.descricao));
    });
    container.querySelectorAll(".btn-alternar-parcela").forEach((btn) => {
      btn.addEventListener("click", () => alternarComprasParcelada(Number(btn.dataset.id)));
    });
    container.querySelectorAll(".btn-excluir-parcela").forEach((btn) => {
      btn.addEventListener("click", () => excluirComprasParcelada(Number(btn.dataset.id)));
    });
  } catch (erro) {
    console.error("Erro ao carregar compras parceladas:", erro);
  }

  renderizarNotificacoes();
}

// ==========================================
// [10] ORÇAMENTOS MENSAIS
// ==========================================

// --- PAINEL DE ORÇAMENTOS ---
let orcamentosCarregados = [];

async function carregarOrcamentos() {
  const card = document.getElementById("card-orcamentos");
  const container = document.getElementById("lista-orcamentos-painel");
  const carteiraId = document.getElementById("seletor-carteira").value;
  if (!card || !container || !carteiraId) return;

  const inputMes = document.getElementById("filtro-mes").value;
  if (!inputMes) {
    card.style.display = "none";
    return;
  }

  const [ano, mes] = inputMes.split("-");

  try {
    const resposta = await fetch(`${API_URL}/api/orcamentos?carteira_id=${carteiraId}&mes=${mes}&ano=${ano}`, {
      headers: headersAutenticados(false),
    });

    if (tratarSessaoExpirada(resposta)) return;
    if (!resposta.ok) {
      card.style.display = "none";
      return;
    }

    orcamentosCarregados = await resposta.json();

    if (orcamentosCarregados.length === 0) {
      card.style.display = "none";
      return;
    }

    card.style.display = "flex";
    container.innerHTML = "";

    orcamentosCarregados.forEach((orc) => {
      const div = document.createElement("div");
      div.className = "orcamento-item";

      const corBarra = orc.status === "estourado" ? "var(--cor-despesa)" : orc.status === "alerta" ? "var(--cor-pendente)" : "var(--cor-receita)";

      div.innerHTML = `
        <div class="orcamento-cabecalho">
          <span class="orcamento-categoria">${escaparHtml(orc.categoria)}</span>
          <span class="orcamento-status status-${orc.status}">${orc.progresso_real.toFixed(0)}%</span>
        </div>
        <div class="orcamento-barra-fundo">
          <div class="orcamento-barra-progresso" style="width: ${orc.progresso}%; background: ${corBarra}"></div>
        </div>
        <div class="orcamento-valores">
          <span class="orcamento-gasto">${formatadorBRL.format(orc.total_gasto)} / ${formatadorBRL.format(orc.valor)}</span>
          <span class="orcamento-saldo">${orc.saldo > 0 ? `Restam ${formatadorBRL.format(orc.saldo)}` : "Estourado!"}</span>
        </div>
        <button type="button" class="orcamento-btn-excluir" data-id="${orc.id}" title="Excluir orçamento">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      `;

      container.appendChild(div);
    });

    // Botão de excluir
    container.querySelectorAll(".orcamento-btn-excluir").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const confirmado = await pedirConfirmacao("Tem certeza que deseja excluir este orçamento?");
        if (!confirmado) return;

        try {
          const resp = await fetch(`${API_URL}/api/orcamentos?id=${btn.dataset.id}`, {
            method: "DELETE",
            headers: headersAutenticados(),
          });

          if (tratarSessaoExpirada(resp)) return;

          if (resp.ok) {
            carregarOrcamentos();
            mostrarToast("Orçamento excluído.");
          } else {
            const erro = await resp.json();
            await mostrarAviso(`Erro: ${erro.erro}`);
          }
        } catch (e) {
          await mostrarAviso("Erro de conexão.");
        }
      });
    });
  } catch (erro) {
    console.error("Erro ao carregar orçamentos:", erro);
    card.style.display = "none";
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
      mostrarToast(alvo.ativo ? "Compra parcelada cancelada" : "Compra parcelada reativada", "info");
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
      mostrarToast("Compra parcelada excluída", "info");
    } else {
      const erro = await resposta.json();
      await mostrarAviso(`Erro: ${erro.erro}`);
    }
  } catch (erro) {
    await mostrarAviso("Erro de conexão.");
  }
}

// --- HISTÓRICO DE PARCELAS (COMPRA PARCELADA) ---
async function abrirHistoricoParcela(compraId, descricao) {
  const modal = document.getElementById("modal-historico-parcela");
  const titulo = document.getElementById("titulo-historico-parcela");
  const lista = document.getElementById("historico-parcela-lista");
  if (!modal || !titulo || !lista) return;

  titulo.textContent = `Histórico — ${descricao}`;
  lista.innerHTML = '<p class="historico-fixa-vazio">Carregando...</p>';
  modal.style.display = "flex";
  trapFoco(modal);

  try {
    const resposta = await fetch(`${API_URL}/api/lancamentos?compra_parcelada_id=${compraId}`, {
      headers: headersAutenticados(false),
    });

    if (!resposta.ok) {
      lista.innerHTML = '<p class="historico-fixa-vazio">Erro ao carregar histórico.</p>';
      return;
    }

    const lancamentos = await resposta.json();

    if (lancamentos.length === 0) {
      lista.innerHTML = '<p class="historico-fixa-vazio">Nenhuma parcela registrada ainda.</p>';
      return;
    }

    lista.innerHTML = "";
    lancamentos.forEach((l) => {
      const dataFormatada = new Date(l.data_compra + "T12:00:00").toLocaleDateString("pt-BR");
      const valorFormatado = formatadorBRL.format(l.valor);
      const classeTipo = l.tipo === "receita" ? "texto-receita" : "texto-despesa";
      const sinal = l.tipo === "receita" ? "+" : "-";
      const dataVenc = new Date(l.data_compra + "T23:59:59");
      const hoje = new Date();
      const atrasado = l.status !== "pago" && dataVenc < hoje;
      const classeStatus = l.status === "pago" ? "status-pago" : atrasado ? "status-atrasado" : "status-pendente";
      const textoStatus = l.status === "pago" ? "Pago" : atrasado ? "Atrasado" : "Pendente";

      const linha = document.createElement("div");
      linha.className = "historico-fixa-linha";
      linha.innerHTML = `
        <span class="historico-fixa-data">${dataFormatada}</span>
        <span class="historico-fixa-valor ${classeTipo}">${sinal} ${valorFormatado}</span>
        <span class="historico-fixa-status ${classeStatus}">${textoStatus}</span>
      `;
      lista.appendChild(linha);
    });
  } catch (erro) {
    lista.innerHTML = '<p class="historico-fixa-vazio">Erro de conexão.</p>';
  }
}

// ==========================================
// [11] METAS E DEPÓSITOS
// ==========================================

// ==========================================
// METAS POR CATEGORIA (ex: "Quero gastar no máximo R$500 com Delivery")
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

function abrirModalMeta(categoria, valorAtual, dataLimite) {
  const modal = document.getElementById("modal-meta");
  if (!modal) return;

  document.getElementById("meta-categoria-nome").value = categoria;
  document.getElementById("meta-categoria-label").textContent = `Categoria: ${categoria}`;
  document.getElementById("meta-valor").value = valorAtual || "";
  document.getElementById("meta-data-limite").value = dataLimite || "";
  document.getElementById("btn-remover-meta").style.display = valorAtual ? "inline-block" : "none";
  modal.style.display = "flex";
  trapFoco(modal);
}

function configurarModalMeta() {
  const modal = document.getElementById("modal-meta");
  const form = document.getElementById("form-meta");
  const btnFechar = document.getElementById("btn-fechar-modal-meta");
  const btnRemover = document.getElementById("btn-remover-meta");

  if (!modal || !form || !btnFechar || !btnRemover) return;

  btnFechar.addEventListener("click", () => {
    modal.style.display = "none";
    liberarFoco();
  });

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const carteiraId = document.getElementById("seletor-carteira").value;
    const categoria = document.getElementById("meta-categoria-nome").value;
    const valorLimite = parseFloat(document.getElementById("meta-valor").value);
    const dataLimite = document.getElementById("meta-data-limite").value || null;
    const btnSalvar = document.getElementById("btn-salvar-meta");

    btnSalvar.disabled = true;
    btnSalvar.innerText = "Salvando...";

    try {
      const resposta = await fetch(`${API_URL}/api/metas`, {
        method: "POST",
        headers: headersAutenticados(),
        body: JSON.stringify({ carteira_id: carteiraId, categoria, valor_limite: valorLimite, data_limite: dataLimite }),
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
        liberarFoco();
        await carregarMetas();
        carregarLancamentos();
        mostrarToast("Meta removida", "info");
      } else {
        const erro = await resposta.json();
        await mostrarAviso(`Erro: ${erro.erro}`);
      }
    } catch (erro) {
      await mostrarAviso("Erro de conexão ao remover meta.");
    }
  });
}


// --- DEPÓSITOS EM METAS ---
let metaDepositandoId = null;

async function abrirModalDeposito(metaId, categoria) {
  const modal = document.getElementById("modal-meta-deposito");
  const titulo = document.getElementById("titulo-meta-deposito");
  const inputMetaId = document.getElementById("deposito-meta-id");
  const inputValor = document.getElementById("deposito-valor");
  const inputDescricao = document.getElementById("deposito-descricao");
  const lista = document.getElementById("lista-depositos");
  if (!modal) return;

  metaDepositandoId = metaId;
  titulo.textContent = `Depósito — ${categoria}`;
  inputMetaId.value = metaId;
  inputValor.value = "";
  inputDescricao.value = "";

  modal.style.display = "flex";
  trapFoco(modal);

  await carregarDadosDeposito(metaId);
  await carregarListaDepositos(metaId);
}

async function carregarDadosDeposito(metaId) {
  const meta = metasCarregadas.find((m) => m.id === metaId);
  if (!meta) return;

  const valorDepositado = await obterTotalDepositado(metaId);
  const valorMeta = meta.valor_limite;
  const percentual = Math.min((valorDepositado / valorMeta) * 100, 100);

  document.getElementById("deposito-valor-depositado").textContent = formatadorBRL.format(valorDepositado);
  document.getElementById("deposito-valor-meta").textContent = formatadorBRL.format(valorMeta);

  const barra = document.getElementById("deposito-barra-progresso");
  barra.style.width = `${percentual}%`;
  barra.className = `meta-deposito-progresso-barra ${percentual >= 100 ? "barra-estourou" : ""}`;

  const info = document.getElementById("deposito-info-progresso");
  const restante = valorMeta - valorDepositado;
  if (restante <= 0) {
    info.textContent = "Meta atingida!";
  } else {
    info.textContent = `Faltam ${formatadorBRL.format(restante)} (${Math.round(percentual)}%)`;
  }
}

async function obterTotalDepositado(metaId) {
  try {
    const resposta = await fetch(`${API_URL}/api/metas-depositos?meta_id=${metaId}`, {
      headers: headersAutenticados(false),
    });
    if (!resposta.ok) return 0;
    const depositos = await resposta.json();
    return depositos.reduce((soma, d) => soma + d.valor, 0);
  } catch {
    return 0;
  }
}

async function carregarListaDepositos(metaId) {
  const container = document.getElementById("lista-depositos");
  if (!container) return;

  try {
    const resposta = await fetch(`${API_URL}/api/metas-depositos?meta_id=${metaId}`, {
      headers: headersAutenticados(false),
    });
    if (!resposta.ok) {
      container.innerHTML = '<p class="historico-fixa-vazio">Erro ao carregar.</p>';
      return;
    }

    const depositos = await resposta.json();

    if (depositos.length === 0) {
      container.innerHTML = '<p class="historico-fixa-vazio">Nenhum depósito ainda.</p>';
      return;
    }

    container.innerHTML = "";
    depositos.forEach((d) => {
      const data = new Date(d.criado_em).toLocaleDateString("pt-BR");
      const linha = document.createElement("div");
      linha.className = "historico-deposito-linha";
      linha.innerHTML = `
        <span class="historico-deposito-data">${data}</span>
        <span class="historico-deposito-desc">${escaparHtml(d.descricao || "Depósito")}</span>
        <span class="historico-deposito-valor">+ ${formatadorBRL.format(d.valor)}</span>
        <button type="button" class="historico-deposito-excluir" data-id="${d.id}" title="Excluir">×</button>
      `;
      container.appendChild(linha);
    });

    container.querySelectorAll(".historico-deposito-excluir").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await excluirDeposito(Number(btn.dataset.id), metaId);
      });
    });
  } catch {
    container.innerHTML = '<p class="historico-fixa-vazio">Erro de conexão.</p>';
  }
}

async function excluirDeposito(depositoId, metaId) {
  if (!(await pedirConfirmacao("Excluir este depósito?", { textoConfirmar: "Excluir", perigo: true }))) return;

  try {
    const resposta = await fetch(`${API_URL}/api/metas-depositos?id=${depositoId}`, {
      method: "DELETE",
      headers: headersAutenticados(false),
    });
    if (resposta.ok) {
      await carregarDadosDeposito(metaId);
      await carregarListaDepositos(metaId);
      mostrarToast("Depósito excluído", "info");
    }
  } catch {
    await mostrarAviso("Erro de conexão.");
  }
}

function configurarModalDeposito() {
  const modal = document.getElementById("modal-meta-deposito");
  const btnFechar = document.getElementById("btn-fechar-modal-meta-deposito");
  const form = document.getElementById("form-meta-deposito");

  if (!modal || !btnFechar || !form) return;

  btnFechar.addEventListener("click", () => {
    modal.style.display = "none";
    liberarFoco();
    metaDepositandoId = null;
  });

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const metaId = Number(document.getElementById("deposito-meta-id").value);
    const valor = parseFloat(document.getElementById("deposito-valor").value);
    const descricao = document.getElementById("deposito-descricao").value.trim();
    const btn = document.getElementById("btn-confirmar-deposito");

    if (!Number.isFinite(valor) || valor <= 0) return;

    btn.disabled = true;
    btn.innerText = "Salvando...";

    try {
      const resposta = await fetch(`${API_URL}/api/metas-depositos`, {
        method: "POST",
        headers: headersAutenticados(),
        body: JSON.stringify({ meta_id: metaId, valor, descricao }),
      });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        document.getElementById("deposito-valor").value = "";
        document.getElementById("deposito-descricao").value = "";
        await carregarDadosDeposito(metaId);
        await carregarListaDepositos(metaId);
        mostrarToast("Depósito registrado!");
      } else {
        const erro = await resposta.json();
        await mostrarAviso(`Erro: ${erro.erro}`);
      }
    } catch {
      await mostrarAviso("Erro de conexão ao depositar.");
    } finally {
      btn.disabled = false;
      btn.innerText = "Depositar";
    }
  });
}


// ==========================================
// [12] CATEGORIAS (Utilitários)
// ==========================================

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
  popularSelectCategorias(document.getElementById("categoria"));
  popularSelectFiltroCategorias();
}

async function popularSelectFiltroCategorias() {
  const select = document.getElementById("filtro-categoria-lancamento");
  if (!select) return;

  try {
    const resposta = await fetch(`${API_URL}/api/categorias`, { headers: headersAutenticados(false) });
    if (tratarSessaoExpirada(resposta)) return;
    if (!resposta.ok) return;

    const categorias = await resposta.json();

    select.querySelectorAll("option[data-categoria]").forEach((op) => op.remove());

    categorias.forEach((cat) => {
      const opcao = document.createElement("option");
      opcao.value = cat.nome;
      opcao.textContent = cat.nome;
      opcao.dataset.categoria = "true";
      select.appendChild(opcao);
    });
  } catch (erro) {
    console.error("Erro ao carregar categorias do filtro:", erro);
  }
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

// ==========================================
// [13] LANÇAMENTOS: Modal, CRUD, Renderização
// ==========================================

// --- CONTROLE DO MODAL DE LANÇAMENTO ---
function fecharModalLancamento() {
  const modal = document.getElementById("modal-lancamento");
  const form = document.getElementById("form-lancamento");
  const campoCategoriaNova = document.getElementById("categoria-nova");

  modal.style.display = "none";
  liberarFoco();
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
  trapFoco(document.getElementById("modal-lancamento"));
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
  document.getElementById("nota-lancamento").value = lancamento.nota || "";

  document.getElementById("titulo-modal-lancamento").innerText = "Editar lançamento";
  document.getElementById("btn-salvar-lancamento").innerText = "Salvar edição";
  document.getElementById("modal-lancamento").style.display = "flex";
  trapFoco(document.getElementById("modal-lancamento"));
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
        nota: document.getElementById("nota-lancamento").value.trim(),
      };

      // Verificar orçamento antes de salvar (apenas para despesas novas)
      if (!idEdicao && pacoteDados.tipo === "despesa" && pacoteDados.status === "pago") {
        const orcamento = orcamentosCarregados.find(
          (o) => o.categoria.toLowerCase() === pacoteDados.categoria.toLowerCase()
        );
        if (orcamento && orcamento.total_gasto + pacoteDados.valor > orcamento.valor) {
          const excedente = formatadorBRL.format(orcamento.total_gasto + pacoteDados.valor - orcamento.valor);
          const confirmado = await pedirConfirmacao(
            `Atenção: este lançamento excederá o orçamento de ${pacoteDados.categoria} em ${excedente}.\n\nDeseja salvar mesmo assim?`,
            { textoConfirmar: "Salvar assim mesmo" }
          );
          if (!confirmado) {
            btnSalvar.innerText = "Salvar";
            btnSalvar.disabled = false;
            return;
          }
        }
      }

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
        mostrarToast(idEdicao ? "Lançamento atualizado" : "Lançamento salvo");
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

// ==========================================
// [14] ANIMAÇÕES
// ==========================================

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


function obterGrupoData(dataStr) {
  const data = new Date(dataStr + "T12:00:00");
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);

  const diffMs = hoje - data;
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (data.toDateString() === hoje.toDateString()) return "Hoje";
  if (data.toDateString() === ontem.toDateString()) return "Ontem";
  if (diffDias >= 2 && diffDias <= 6) return "Esta semana";
  if (diffDias >= 7 && diffDias <= 13) return "Semana passada";

  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();
  const mesLanc = data.getMonth();
  const anoLanc = data.getFullYear();

  if (mesLanc === mesAtual && anoLanc === anoAtual) return "Este mês";
  if ((mesLanc === mesAtual - 1 && anoLanc === anoAtual) || (mesAtual === 0 && mesLanc === 11 && anoLanc === anoAtual - 1)) return "Mês passado";

  return "Mais antigo";
}

// ==========================================
// [15] RENDERIZAÇÃO: Lista de Lançamentos, Grupos
// ==========================================

const ORDEM_GRUPOS = ["Hoje", "Ontem", "Esta semana", "Semana passada", "Este mês", "Mês passado", "Mais antigo"];

// --- RENDERIZA A LISTA (aplica o filtro de busca, se houver, sem afetar os totais do mês) ---
let gruposRecolhidos = new Set();

function renderizarListaLancamentos() {
  const container = document.getElementById("lista-lancamentos");
  if (!container) return;

  const termo = termoBuscaAtual.trim().toLowerCase();
  const tipoFiltro = document.getElementById("filtro-tipo")?.value || "";
  const statusFiltro = document.getElementById("filtro-status")?.value || "";
  const categoriaFiltro = document.getElementById("filtro-categoria-lancamento")?.value || "";

  const hoje = new Date();
  const filtrados = ultimoLoteLancamentos.filter((l) => {
    if (termo && !l.descricao.toLowerCase().includes(termo) && !l.categoria.toLowerCase().includes(termo)) return false;
    if (tipoFiltro && l.tipo !== tipoFiltro) return false;
    if (statusFiltro) {
      const dataVenc = new Date(l.data_compra + "T23:59:59");
      const atrasado = l.status !== "pago" && dataVenc < hoje;
      const statusAtual = l.status === "pago" ? "pago" : atrasado ? "atrasado" : "pendente";
      if (statusAtual !== statusFiltro) return false;
    }
    if (categoriaFiltro && l.categoria !== categoriaFiltro) return false;
    return true;
  });

  container.innerHTML = "";

  if (filtrados.length === 0) {
    const temFiltro = termo || tipoFiltro || statusFiltro || categoriaFiltro;
    if (temFiltro) {
      container.appendChild(criarAvisoListaVazia("Nenhum lançamento encontrado com esses filtros.", "Limpar filtros", "limpar-filtros"));
    } else {
      container.appendChild(criarAvisoListaVazia());
    }
    return;
  }

  const grupos = {};
  filtrados.forEach((l) => {
    const grupo = obterGrupoData(l.data_compra);
    if (!grupos[grupo]) grupos[grupo] = [];
    grupos[grupo].push(l);
  });

  ORDEM_GRUPOS.forEach((nomeGrupo) => {
    const itens = grupos[nomeGrupo];
    if (!itens || itens.length === 0) return;

    const recolhido = gruposRecolhidos.has(nomeGrupo);

    const header = document.createElement("div");
    header.className = "grupo-data-header";
    header.innerHTML = `
      <span class="grupo-data-texto">${nomeGrupo}</span>
      <div class="grupo-data-direita">
        <span class="grupo-data-qtd">${itens.length}</span>
        <button type="button" class="grupo-data-toggle${recolhido ? ' recolhido' : ''}" data-grupo="${nomeGrupo}" title="Recolher/Expandir" aria-label="Recolher grupo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>`;
    container.appendChild(header);

    header.querySelector(".grupo-data-toggle").addEventListener("click", () => {
      if (gruposRecolhidos.has(nomeGrupo)) {
        gruposRecolhidos.delete(nomeGrupo);
      } else {
        gruposRecolhidos.add(nomeGrupo);
      }
      renderizarListaLancamentos();
    });

    if (!recolhido) {
      itens.forEach((lancamento) => container.appendChild(criarLinhaLancamento(lancamento)));
    }
  });
}

function limparFiltros() {
  const campoBusca = document.getElementById("busca-lancamento");
  const filtroTipo = document.getElementById("filtro-tipo");
  const filtroStatus = document.getElementById("filtro-status");
  const filtroCategoria = document.getElementById("filtro-categoria-lancamento");

  if (campoBusca) campoBusca.value = "";
  if (filtroTipo) filtroTipo.value = "";
  if (filtroStatus) filtroStatus.value = "";
  if (filtroCategoria) filtroCategoria.value = "";

  termoBuscaAtual = "";
  renderizarListaLancamentos();
}

function configurarBuscaLancamentos() {
  const campo = document.getElementById("busca-lancamento");
  if (!campo) return;

  let timeoutBusca;
  campo.addEventListener("input", (evento) => {
    clearTimeout(timeoutBusca);
    timeoutBusca = setTimeout(() => {
      termoBuscaAtual = evento.target.value;
      renderizarListaLancamentos();
    }, 250);
  });

  ["filtro-tipo", "filtro-status", "filtro-categoria-lancamento"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", renderizarListaLancamentos);
  });

  const containerLancamentos = document.getElementById("lista-lancamentos");
  if (containerLancamentos) {
    containerLancamentos.addEventListener("click", (e) => {
      const alvo = e.target.closest("[data-action]");
      if (!alvo) return;
      const acao = alvo.dataset.action;
      const id = Number(alvo.dataset.id);
      if (acao === "editar") editarLancamento(id);
      else if (acao === "apagar") apagarLancamento(id);
      else if (acao === "status") alternarStatusLancamento(id, alvo.dataset.statusAtual);
      else if (acao === "novo-lancamento") abrirModalNovoLancamento();
      else if (acao === "limpar-filtros") limparFiltros();
    });
  }
}

// ==========================================
// [16] NOTIFICAÇÕES
// ==========================================

// --- NOTIFICAÇÕES DE VENCIMENTO ---
function verificarNotificacoes() {
  const notificacoes = [];
  const hoje = new Date();
  const diaAtual = hoje.getDate();

  despesasFixasCarregadas.forEach((fixa) => {
    if (!fixa.ativo) return;
    const aviso = calcularAvisoVencimento(fixa.dia_vencimento);
    if (aviso) {
      notificacoes.push({
        tipo: "fixa",
        descricao: fixa.descricao,
        valor: fixa.valor,
        dia: fixa.dia_vencimento,
        texto: aviso.texto,
        atrasado: aviso.atrasado,
        urgencia: aviso.atrasado ? 0 : diaAtual === fixa.dia_vencimento ? 1 : 2,
      });
    }
  });

  comprasParceladasCarregadas.forEach((compra) => {
    if (!compra.ativo) return;
    const aviso = calcularAvisoVencimento(compra.dia_vencimento);
    if (aviso) {
      notificacoes.push({
        tipo: "parcelada",
        descricao: compra.descricao,
        valor: compra.valor_parcela,
        dia: compra.dia_vencimento,
        texto: aviso.texto,
        atrasado: aviso.atrasado,
        urgencia: aviso.atrasado ? 0 : diaAtual === compra.dia_vencimento ? 1 : 2,
      });
    }
  });

  ultimoLoteLancamentos.forEach((lanc) => {
    if (lanc.status === "pago") return;
    const dataLanc = new Date(lanc.data_compra + "T12:00:00");
    const diffMs = hoje - dataLanc;
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let texto = null;
    let atrasado = false;

    if (diffDias === 0) {
      texto = "Vence hoje";
    } else if (diffDias > 0 && diffDias <= 3) {
      texto = `Vence em ${diffDias} dia${diffDias > 1 ? "s" : ""}`;
    } else if (diffDias < 0 && diffDias >= -3) {
      texto = `Venceu há ${Math.abs(diffDias)} dia${Math.abs(diffDias) > 1 ? "s" : ""}`;
      atrasado = true;
    }

    if (texto) {
      notificacoes.push({
        tipo: "lancamento",
        descricao: lanc.descricao,
        valor: lanc.valor,
        dia: dataLanc.getUTCDate(),
        texto,
        atrasado,
        urgencia: atrasado ? 0 : diffDias === 0 ? 1 : 2,
      });
    }
  });

  // Metas com prazo — lembrete semanal
  if (typeof metasCarregadas !== "undefined") {
    metasCarregadas.forEach((meta) => {
      if (!meta.data_limite || meta.falta <= 0) return;
      const dataLimite = new Date(meta.data_limite + "T23:59:59");
      const diffMs = dataLimite - hoje;
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      let texto = null;
      let atrasado = false;

      if (diffDias < 0) {
        texto = `Meta "${meta.categoria}" passou do prazo! Faltava ${formatadorBRL.format(meta.falta)}`;
        atrasado = true;
      } else if (diffDias <= 7) {
        texto = `Meta "${meta.categoria}": faltam ${formatadorBRL.format(meta.falta)} (${meta.semanas_restantes} sem.)`;
      }

      if (texto) {
        notificacoes.push({
          tipo: "meta",
          descricao: meta.categoria,
          valor: meta.falta,
          dia: dataLimite.getUTCDate(),
          texto,
          atrasado,
          urgencia: atrasado ? 0 : diffDias <= 7 ? 2 : 3,
        });
      }
    });
  }

  notificacoes.sort((a, b) => a.urgencia - b.urgencia);
  return notificacoes;
}

function renderizarNotificacoes() {
  const notificacoes = verificarNotificacoes();
  const badge = document.getElementById("notificacao-badge");
  const lista = document.getElementById("lista-notificacoes");

  if (notificacoes.length === 0) {
    badge.classList.remove("com-alertas");
    lista.innerHTML = '<div class="notificacao-vazio">Nenhum vencimento próximo.</div>';
    return;
  }

  badge.classList.add("com-alertas");

  lista.innerHTML = notificacoes.map((n) => {
    const iconeClasse = n.atrasado ? "atrasado" : n.urgencia === 1 ? "hoje" : "proximo";
    const svgIcone = n.atrasado
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
    const tipoLabel = n.tipo === "fixa" ? "Fixa" : n.tipo === "parcelada" ? "Parcelada" : "Lançamento";
    const valorFormatado = formatadorBRL.format(n.valor);

    return `
      <div class="notificacao-item">
        <div class="notificacao-icone ${iconeClasse}">${svgIcone}</div>
        <div class="notificacao-info">
          <div class="notificacao-descricao">${escaparHtml(n.descricao)}</div>
          <div class="notificacao-detalhe">${tipoLabel} · Dia ${n.dia} · ${n.texto}</div>
        </div>
        <span class="notificacao-valor">${valorFormatado}</span>
      </div>
    `;
  }).join("");
}

function configurarNotificacoes() {
  const btn = document.getElementById("btn-notificacoes");
  const modal = document.getElementById("modal-notificacoes");
  const btnFechar = document.getElementById("btn-fechar-modal-notificacoes");
  const badge = document.getElementById("notificacao-badge");
  if (!btn || !modal) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    modal.style.display = "flex";
    renderizarNotificacoes();
    trapFoco(modal);
  });

  if (btnFechar) {
    btnFechar.addEventListener("click", () => {
      modal.style.display = "none";
      liberarFoco();
    });
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
      liberarFoco();
    }
  });
}

// --- EDIÇÃO EM LOTE ---
let idsSelecionadosLote = new Set();

// ==========================================
// [17] EDIÇÃO EM LOTE
// ==========================================

function configurarLote() {
  const container = document.getElementById("lista-lancamentos");
  const barra = document.getElementById("lote-barra");
  const contador = document.getElementById("lote-contador");
  const btnAplicar = document.getElementById("lote-btn-aplicar");
  const btnCancelar = document.getElementById("lote-btn-cancelar");
  const selectStatus = document.getElementById("lote-status");
  const selectCategoria = document.getElementById("lote-categoria");

  if (!container || !barra) return;

  container.addEventListener("change", (e) => {
    if (!e.target.classList.contains("lote-check")) return;
    const id = Number(e.target.dataset.id);
    const linha = e.target.closest(".linha-item");

    if (e.target.checked) {
      idsSelecionadosLote.add(id);
      linha?.classList.add("selecionada");
    } else {
      idsSelecionadosLote.delete(id);
      linha?.classList.remove("selecionada");
    }

    atualizarBarraLote();
  });

  btnCancelar?.addEventListener("click", limparSelecaoLote);

  btnAplicar?.addEventListener("click", async () => {
    const novoStatus = selectStatus.value;
    const novaCategoria = selectCategoria.value;

    if (!novoStatus && !novaCategoria) {
      await mostrarAviso("Selecione ao menos uma ação (status ou categoria).");
      return;
    }

    btnAplicar.disabled = true;
    btnAplicar.textContent = "Aplicando...";

    try {
      const corpo = { ids: Array.from(idsSelecionadosLote) };
      if (novoStatus) corpo.status = novoStatus;
      if (novaCategoria) corpo.categoria = novaCategoria;

      const resposta = await fetch(`${API_URL}/api/lancamentos`, {
        method: "PATCH",
        headers: headersAutenticados(),
        body: JSON.stringify(corpo),
      });

      if (tratarSessaoExpirada(resposta)) return;

      const resultado = await resposta.json();

      if (!resposta.ok) {
        await mostrarAviso(resultado.erro || "Erro ao atualizar.");
        return;
      }

      mostrarToast(resultado.mensagem || "Lançamentos atualizados!", "sucesso");
      limparSelecaoLote();
      await carregarLancamentos();
    } catch (erro) {
      await mostrarAviso("Erro de conexão ao atualizar em lote.");
    } finally {
      btnAplicar.disabled = false;
      btnAplicar.textContent = "Aplicar";
      selectStatus.value = "";
      selectCategoria.value = "";
    }
  });
}

function atualizarBarraLote() {
  const barra = document.getElementById("lote-barra");
  const contador = document.getElementById("lote-contador");
  if (!barra || !contador) return;

  const qtd = idsSelecionadosLote.size;
  barra.style.display = qtd > 0 ? "flex" : "none";
  contador.textContent = `${qtd} selecionado${qtd !== 1 ? "s" : ""}`;
}

function limparSelecaoLote() {
  idsSelecionadosLote.clear();
  document.querySelectorAll(".lote-check").forEach((ck) => {
    ck.checked = false;
    ck.closest(".linha-item")?.classList.remove("selecionada");
  });
  atualizarBarraLote();
}

function popularSelectLoteCategorias() {
  const select = document.getElementById("lote-categoria");
  if (!select) return;

  const categorias = new Set(ultimoLoteLancamentos.map((l) => l.categoria));
  select.querySelectorAll("option[data-cat-lote]").forEach((op) => op.remove());

  Array.from(categorias).sort().forEach((cat) => {
    const opcao = document.createElement("option");
    opcao.value = cat;
    opcao.textContent = cat;
    opcao.dataset.catLote = "true";
    select.appendChild(opcao);
  });
}

// --- POPUP DE NOTA ---
// ==========================================
// [18] POPUP DE NOTA
// ==========================================

function configurarPopupNota() {
  document.addEventListener("click", (e) => {
    const alvo = e.target.closest(".item-nota-clique");
    if (!alvo) return;

    e.preventDefault();
    e.stopPropagation();

    const nota = alvo.dataset.nota;
    const descricao = alvo.dataset.descricao;
    if (!nota) return;

    let popup = document.getElementById("popup-nota");
    if (!popup) {
      popup = document.createElement("div");
      popup.id = "popup-nota";
      popup.className = "popup-nota-overlay";
      popup.innerHTML = `
        <div class="popup-nota-conteudo">
          <div class="popup-nota-header">
            <span class="popup-nota-titulo">Nota</span>
            <button type="button" class="popup-nota-fechar" id="popup-nota-fechar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="popup-nota-descricao" id="popup-nota-descricao"></div>
          <div class="popup-nota-texto" id="popup-nota-texto"></div>
        </div>
      `;
      document.body.appendChild(popup);

      document.getElementById("popup-nota-fechar").addEventListener("click", fecharPopupNota);
      popup.addEventListener("click", (ev) => {
        if (ev.target === popup) fecharPopupNota();
      });
    }

    document.getElementById("popup-nota-descricao").textContent = descricao || "";
    document.getElementById("popup-nota-texto").textContent = nota;
    popup.style.display = "flex";
  });
}

function fecharPopupNota() {
  const popup = document.getElementById("popup-nota");
  if (popup) popup.style.display = "none";
}

// --- COMPARATIVO POR PERÍODO ---
let periodoTipoAtual = "mes";

function configurarComparativoPeriodo() {
  const botoes = document.querySelectorAll(".periodo-btn");
  botoes.forEach((btn) => {
    btn.addEventListener("click", () => {
      botoes.forEach((b) => b.classList.remove("ativo"));
      btn.classList.add("ativo");
      periodoTipoAtual = btn.dataset.periodo;
      renderizarComparativoPeriodo();
    });
  });
}

// ==========================================
// [19] COMPARATIVO POR PERÍODO
// ==========================================

let periodoDadosAnterior = { receitas: 0, despesas: 0, saldo: 0 };
let periodoDadosAtual = { receitas: 0, despesas: 0, saldo: 0 };

async function renderizarComparativoPeriodo() {
  const carteiraId = document.getElementById("seletor-carteira")?.value;
  if (!carteiraId) return;

  const agora = new Date();
  let inicioAtual, fimAtual, inicioAnterior, fimAnterior, rotuloAtual, rotuloAnterior;

  if (periodoTipoAtual === "mes") {
    inicioAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
    fimAtual = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59);
    inicioAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    fimAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59);
    rotuloAtual = "Este mês";
    rotuloAnterior = "Mês passado";
  } else if (periodoTipoAtual === "trimestre") {
    const trimestreAtual = Math.floor(agora.getMonth() / 3);
    inicioAtual = new Date(agora.getFullYear(), trimestreAtual * 3, 1);
    fimAtual = new Date(agora.getFullYear(), (trimestreAtual + 1) * 3, 0, 23, 59, 59);
    inicioAnterior = new Date(agora.getFullYear(), (trimestreAtual - 1) * 3, 1);
    fimAnterior = new Date(agora.getFullYear(), trimestreAtual * 3, 0, 23, 59, 59);
    rotuloAtual = `1° Tri ${agora.getFullYear()}`;
    rotuloAnterior = `4° Tri ${trimestreAtual === 0 ? agora.getFullYear() - 1 : agora.getFullYear()}`;
    if (trimestreAtual === 0) {
      rotuloAnterior = `4° Tri ${agora.getFullYear() - 1}`;
    } else if (trimestreAtual === 1) {
      rotuloAnterior = `1° Tri ${agora.getFullYear()}`;
    } else if (trimestreAtual === 2) {
      rotuloAnterior = `2° Tri ${agora.getFullYear()}`;
    } else {
      rotuloAnterior = `3° Tri ${agora.getFullYear()}`;
    }
  } else {
    inicioAtual = new Date(agora.getFullYear(), 0, 1);
    fimAtual = new Date(agora.getFullYear(), 11, 31, 23, 59, 59);
    inicioAnterior = new Date(agora.getFullYear() - 1, 0, 1);
    fimAnterior = new Date(agora.getFullYear() - 1, 11, 31, 23, 59, 59);
    rotuloAtual = `${agora.getFullYear()}`;
    rotuloAnterior = `${agora.getFullYear() - 1}`;
  }

  const calcularTotaisDeLancamentos = (lancamentos, inicio, fim) => {
    let receitas = 0, despesas = 0;
    lancamentos.forEach((l) => {
      if (l.status !== "pago") return;
      const d = new Date(l.data_compra + "T12:00:00");
      if (d >= inicio && d <= fim) {
        if (l.tipo === "receita") receitas += l.valor;
        else despesas += l.valor;
      }
    });
    return { receitas, despesas, saldo: receitas - despesas };
  };

  const buscarLancamentosPeriodo = async (inicio, fim) => {
    const anoInicio = inicio.getFullYear();
    const mesInicio = inicio.getMonth() + 1;
    const anoFim = fim.getFullYear();
    const mesFim = fim.getMonth() + 1;
    const todos = [];
    for (let a = anoInicio; a <= anoFim; a++) {
      const mStart = a === anoInicio ? mesInicio : 1;
      const mEnd = a === anoFim ? mesFim : 12;
      for (let m = mStart; m <= mEnd; m++) {
        const url = `${API_URL}/api/lancamentos?carteira_id=${carteiraId}&mes=${String(m).padStart(2, "0")}&ano=${a}`;
        try {
          const res = await fetch(url, { headers: headersAutenticados(false) });
          if (res.ok) {
            const dados = await res.json();
            todos.push(...dados);
          }
        } catch (e) { /* ignora erro individual */ }
      }
    }
    return todos;
  };

  const [lancAtual, lancAnterior] = await Promise.all([
    buscarLancamentosPeriodo(inicioAtual, fimAtual),
    buscarLancamentosPeriodo(inicioAnterior, fimAnterior)
  ]);

  periodoDadosAtual = calcularTotaisDeLancamentos(lancAtual, inicioAtual, fimAtual);
  periodoDadosAnterior = calcularTotaisDeLancamentos(lancAnterior, inicioAnterior, fimAnterior);

  document.getElementById("periodo-atual-rotulo").textContent = rotuloAtual;
  document.getElementById("periodo-anterior-rotulo").textContent = rotuloAnterior;

  document.getElementById("periodo-atual-receitas").textContent = formatadorBRL.format(periodoDadosAtual.receitas);
  document.getElementById("periodo-atual-despesas").textContent = formatadorBRL.format(periodoDadosAtual.despesas);
  document.getElementById("periodo-atual-saldo").textContent = formatadorBRL.format(periodoDadosAtual.saldo);

  document.getElementById("periodo-anterior-receitas").textContent = formatadorBRL.format(periodoDadosAnterior.receitas);
  document.getElementById("periodo-anterior-despesas").textContent = formatadorBRL.format(periodoDadosAnterior.despesas);
  document.getElementById("periodo-anterior-saldo").textContent = formatadorBRL.format(periodoDadosAnterior.saldo);

  const variacaoEl = document.getElementById("periodo-variacao-saldo");
  if (periodoDadosAnterior.saldo === 0 && periodoDadosAtual.saldo === 0) {
    variacaoEl.textContent = "—";
    variacaoEl.className = "periodo-variacao-valor neutro";
  } else if (periodoDadosAnterior.saldo === 0) {
    variacaoEl.textContent = periodoDadosAtual.saldo > 0 ? "+∞" : "-∞";
    variacaoEl.className = `periodo-variacao-valor ${periodoDadosAtual.saldo >= 0 ? "positivo" : "negativo"}`;
  } else {
    const variacao = ((periodoDadosAtual.saldo - periodoDadosAnterior.saldo) / Math.abs(periodoDadosAnterior.saldo)) * 100;
    const sinal = variacao >= 0 ? "+" : "";
    variacaoEl.textContent = `${sinal}${variacao.toFixed(0)}%`;
    variacaoEl.className = `periodo-variacao-valor ${variacao >= 0 ? "positivo" : "negativo"}`;
  }
}

// ==========================================
// [20] CARREGAMENTO PRINCIPAL (carregarLancamentos)
// ==========================================

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
  carregarOrcamentos();
  popularSelectFiltroCategorias();
  const promiseMetas = carregarMetas();

  // Marca esta chamada como "a mais recente". Se outra começar antes dela terminar,
  // esta vira obsoleta e seu resultado é descartado (evita sobrescrever a tela com dado velho).
  const idDestaRequisicao = ++ultimaRequisicaoLancamentos;

  container.innerHTML = "";
  container.appendChild(criarFeedbackCarregamento());

  try {
    const inputMes = document.getElementById("filtro-mes").value;

    let urlComFiltros = `${API_URL}/api/lancamentos?carteira_id=${carteiraId}`;
    let urlTransferencias = `${API_URL}/api/transferencias?carteira_id=${carteiraId}`;

    if (inputMes) {
      const [ano, mes] = inputMes.split("-");
      urlComFiltros += `&mes=${mes}&ano=${ano}`;
      urlTransferencias += `&mes=${mes}&ano=${ano}`;
    }

    const [resposta, respostaTransferencias] = await Promise.all([
      fetch(urlComFiltros, { headers: headersAutenticados(false) }),
      fetch(urlTransferencias, { headers: headersAutenticados(false) }),
      promiseMetas,
    ]);

    // Chegou uma requisição mais nova enquanto esperávamos? Descarta esta resposta.
    if (idDestaRequisicao !== ultimaRequisicaoLancamentos) return;

    if (tratarSessaoExpirada(resposta) || tratarSessaoExpirada(respostaTransferencias)) return;
    const dados = await resposta.json();
    const transferencias = await respostaTransferencias.json();

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
      carregarComparativo6Meses();
      document.getElementById("card-poupanca").style.display = "none";
      return;
    }

    ultimoLoteLancamentos = dados;

    let totalReceitas = 0;
    let totalDespesas = 0;
    let totalPendente = 0;
    let totalTransferenciasSaida = 0;
    let totalTransferenciasEntrada = 0;
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

    // Calcular transferências (saída e entrada)
    const carteiraIdNum = Number(carteiraId);
    transferencias.forEach((t) => {
      if (t.carteira_origem_id === carteiraIdNum) {
        totalTransferenciasSaida += t.valor;
      }
      if (t.carteira_destino_id === carteiraIdNum) {
        totalTransferenciasEntrada += t.valor;
      }
    });

    renderizarListaLancamentos();
    popularSelectLoteCategorias();
    renderizarComparativoPeriodo();

    // Saldo = Receitas - Despesas - Transferências Saída + Transferências Entrada
    const saldoCalculado = totalReceitas - totalDespesas - totalTransferenciasSaida + totalTransferenciasEntrada;

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
    carregarComparativo6Meses();
    calcularTaxaPoupanca(totalReceitas, totalDespesas);
    calcularCapacidadeGuarda();
    calcularScoreSaude(totalReceitas, totalDespesas, totaisPorCategoria);
    carregarCartoesCredito();
  } catch (erro) {
    if (idDestaRequisicao !== ultimaRequisicaoLancamentos) return;
    console.error("Erro:", erro);
    container.innerHTML = '<p style="color: var(--cor-despesa); padding: 1rem;">Erro ao carregar os dados.</p>';
  }
}

// ==========================================
// [21] DASHBOARD: Resumo Categorias, Autores, KPIs
// ==========================================

// --- RAIO-X POR CATEGORIA (só despesas, é o que faz sentido controlar) ---
function renderizarResumoCategorias(totaisPorCategoria) {
  const card = document.getElementById("resumo-categorias");
  const container = document.getElementById("lista-categorias-resumo");
  const donutEl = document.getElementById("grafico-donut");
  const legendaEl = document.getElementById("grafico-legenda");
  if (!card || !container) return;

  const categorias = Object.entries(totaisPorCategoria).sort((a, b) => b[1] - a[1]);

  if (categorias.length === 0) {
    card.style.display = "none";
    if (donutEl) donutEl.style.background = "none";
    if (legendaEl) legendaEl.innerHTML = "";
    return;
  }

  card.style.display = "flex";

  const cores = ["#4caf50","#2196f3","#ff9800","#e91e63","#9c27b0","#00bcd4","#f44336","#607d8b","#795548","#cddc39"];
  const totalDespesas = categorias.reduce((soma, [, v]) => soma + v, 0);

  let conicParts = [];
  let accum = 0;
  categorias.forEach(([cat, valor], i) => {
    const pct = (valor / totalDespesas) * 100;
    const cor = cores[i % cores.length];
    conicParts.push(`${cor} ${accum}% ${accum + pct}%`);
    accum += pct;
  });

  if (donutEl) {
    donutEl.style.background = `conic-gradient(${conicParts.join(", ")})`;
  }

  if (legendaEl) {
    legendaEl.innerHTML = "";
    categorias.forEach(([cat, valor], i) => {
      const cor = cores[i % cores.length];
      const pct = ((valor / totalDespesas) * 100).toFixed(1);
      const item = document.createElement("div");
      item.className = "grafico-legenda-item";
      item.innerHTML = `
        <span class="grafico-legenda-cor" style="background:${cor}"></span>
        <span class="grafico-legenda-nome">${escaparHtml(cat)}</span>
        <span class="grafico-legenda-valor">${pct}%</span>
      `;
      legendaEl.appendChild(item);
    });
  }
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

    const iconeMeta = meta
      ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/></svg>'
      : "";

    const linha = document.createElement("div");
    linha.className = "categoria-barra-linha";
    linha.innerHTML = `
      <div class="categoria-barra-topo">
        <strong class="${categoria !== "Outras" ? "categoria-barra-nome" : ""} ${meta ? "barra-meta-clicavel" : ""}" data-categoria="${escaparHtml(categoria)}" data-meta="${meta ? meta.valor_limite : ""}" data-datalimite="${meta?.data_limite || ""}">
          ${escaparHtml(categoria)} ${iconeMeta}
        </strong>
        <span class="categoria-barra-valor">${textoValor}</span>
        ${meta && meta.data_limite && meta.falta > 0 ? `<span class="badge-semana">~${formatadorBRL.format(meta.guarda_semanal)}/sem.</span>` : ""}
      </div>
      <div class="categoria-barra-trilho ${meta ? "barra-meta-clicavel" : ""}" data-categoria="${escaparHtml(categoria)}" data-meta="${meta ? meta.valor_limite : ""}">
        <div class="categoria-barra-preenchimento ${classeCor}" data-largura="${percentualLargura}"></div>
      </div>
    `;
    container.appendChild(linha);
  });

  container.querySelectorAll(".categoria-barra-nome").forEach((el) => {
    el.addEventListener("click", () => {
      const categoria = el.dataset.categoria;
      const meta = obterMetaPorCategoria(categoria);
      if (meta) {
        abrirModalDeposito(meta.id, categoria);
      } else {
        abrirModalMeta(categoria, el.dataset.meta, el.dataset.datalimite || null);
      }
    });
  });

  container.querySelectorAll(".categoria-barra-trilho.barra-meta-clicavel").forEach((el) => {
    el.addEventListener("click", () => {
      const categoria = el.dataset.categoria;
      const meta = obterMetaPorCategoria(categoria);
      if (meta) {
        abrirModalDeposito(meta.id, categoria);
      }
    });
  });

  // Anima a largura das barras depois de inseridas no DOM (senão a transição CSS não dispara)
  requestAnimationFrame(() => {
    container.querySelectorAll(".categoria-barra-preenchimento").forEach((barra) => {
      barra.style.width = `${barra.dataset.largura}%`;
    });
  });
}

// ==========================================
// [22] STATUS: Alternar Pago/Pendente
// ==========================================

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
      mostrarToast(novoStatus === "pago" ? "Marcado como pago" : "Marcado como pendente", "info");
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

// ==========================================
// [23] COMPARAÇÃO MÊS A MÊS
// ==========================================

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
        <strong>${escaparHtml(nome)}</strong>
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
// ==========================================
// [24] TENDÊNCIA E GRÁFICOS
// ==========================================

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

  const dados = await Promise.all(
    meses.map(async ({ ano, mes }) => {
      const chave = `${carteiraId}:${ano}-${String(mes + 1).padStart(2, "0")}`;
      if (cacheTendencia.has(chave)) return cacheTendencia.get(chave);

      try {
        const resposta = await fetch(`${API_URL}/api/lancamentos?carteira_id=${carteiraId}&mes=${mes + 1}&ano=${ano}`, {
          headers: headersAutenticados(false),
        });
        if (!resposta.ok) return { receitas: 0, despesas: 0 };
        const dadosMes = await resposta.json();
        const receitas = dadosMes.filter((l) => l.tipo === "receita" && l.status === "pago").reduce((soma, l) => soma + l.valor, 0);
        const despesas = dadosMes.filter((l) => l.tipo === "despesa" && l.status === "pago").reduce((soma, l) => soma + l.valor, 0);
        const total = { receitas, despesas };
        cacheTendencia.set(chave, total);
        return total;
      } catch {
        return { receitas: 0, despesas: 0 };
      }
    }),
  );

  if (idRequisicao !== ultimaRequisicaoTendencia) return;

  renderizarTendencia(meses, dados, mesBase, anoBase);
}

function renderizarTendencia(meses, dados, mesAtualIdx, anoAtual) {
  const card = document.getElementById("card-tendencia");
  const container = document.getElementById("grafico-tendencia");
  if (!card || !container) return;

  const algumValor = dados.some((d) => d.receitas > 0 || d.despesas > 0);
  if (!algumValor) {
    card.style.display = "none";
    return;
  }

  card.style.display = "flex";
  container.innerHTML = "";

  const todosValores = dados.flatMap((d) => [d.receitas, d.despesas]);
  const maior = Math.max(...todosValores, 1);

  const svgNS = "http://www.w3.org/2000/svg";
  const W = 280, H = 120, PAD_X = 30, PAD_Y = 10;
  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_Y * 2;

  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "tendencia-svg");

  const gridGroup = document.createElementNS(svgNS, "g");
  for (let i = 0; i <= 4; i++) {
    const y = PAD_Y + (plotH / 4) * i;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", PAD_X);
    line.setAttribute("y1", y);
    line.setAttribute("x2", W - PAD_X);
    line.setAttribute("y2", y);
    line.setAttribute("class", "tendencia-grid-line");
    gridGroup.appendChild(line);
  }
  svg.appendChild(gridGroup);

  function buildPath(values) {
    return values.map((v, i) => {
      const x = PAD_X + (plotW / (values.length - 1)) * i;
      const y = PAD_Y + plotH - (v / maior) * plotH;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    }).join(" ");
  }

  function addLine(values, cssClass) {
    if (values.every((v) => v === 0)) return;
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", buildPath(values));
    path.setAttribute("class", `tendencia-line ${cssClass}`);
    svg.appendChild(path);

    values.forEach((v, i) => {
      if (v === 0) return;
      const cx = PAD_X + (plotW / (values.length - 1)) * i;
      const cy = PAD_Y + plotH - (v / maior) * plotH;
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", cx);
      circle.setAttribute("cy", cy);
      circle.setAttribute("r", 3);
      circle.setAttribute("class", `tendencia-dot ${cssClass}`);
      svg.appendChild(circle);

      const title = document.createElementNS(svgNS, "title");
      title.textContent = formatadorBRL.format(v);
      circle.appendChild(title);
    });
  }

  addLine(dados.map((d) => d.receitas), "tendencia-receita");
  addLine(dados.map((d) => d.despesas), "tendencia-despesa");

  container.appendChild(svg);

  const rotulos = document.createElement("div");
  rotulos.className = "tendencia-rotulos";
  meses.forEach(({ mes }, i) => {
    const span = document.createElement("span");
    span.className = "tendencia-rotulo";
    span.textContent = NOMES_MESES_ABREV[mes];
    rotulos.appendChild(span);
  });
  container.appendChild(rotulos);
}


// --- COMPARATIVO 6 MESES (RECEITAS vs DESPESAS) ---
let ultimaRequisicaoComparativo6 = 0;
const cacheComparativo6 = new Map();

async function carregarComparativo6Meses() {
  const carteiraId = document.getElementById("seletor-carteira").value;
  const campoMes = document.getElementById("filtro-mes");
  if (!carteiraId || !campoMes || !campoMes.dataset.ano) return;

  const idRequisicao = ++ultimaRequisicaoComparativo6;

  const anoBase = Number(campoMes.dataset.ano);
  const mesBase = Number(campoMes.dataset.mes);

  const meses = [];
  for (let i = 5; i >= 0; i--) {
    let m = mesBase - i;
    let a = anoBase;
    while (m < 0) { m += 12; a -= 1; }
    meses.push({ ano: a, mes: m });
  }

  const dados = await Promise.all(
    meses.map(async ({ ano, mes }) => {
      const chave = `${carteiraId}:${ano}-${String(mes + 1).padStart(2, "0")}`;
      if (cacheComparativo6.has(chave)) return cacheComparativo6.get(chave);

      try {
        const resposta = await fetch(`${API_URL}/api/lancamentos?carteira_id=${carteiraId}&mes=${mes + 1}&ano=${ano}`, {
          headers: headersAutenticados(false),
        });
        if (!resposta.ok) return { receitas: 0, despesas: 0 };
        const dadosMes = await resposta.json();
        let receitas = 0, despesas = 0;
        dadosMes.forEach((l) => {
          if (l.status === "pendente") return;
          if (l.tipo === "receita") receitas += l.valor;
          else despesas += l.valor;
        });
        const resultado = { receitas, despesas };
        cacheComparativo6.set(chave, resultado);
        return resultado;
      } catch {
        return { receitas: 0, despesas: 0 };
      }
    }),
  );

  if (idRequisicao !== ultimaRequisicaoComparativo6) return;
  renderizarComparativo6Meses(meses, dados, mesBase, anoBase);
}

function renderizarComparativo6Meses(meses, dados, mesAtualIdx, anoAtual) {
  const card = document.getElementById("card-comparativo");
  const container = document.getElementById("grafico-comparativo");
  if (!card || !container) return;

  const algumValor = dados.some((d) => d.receitas > 0 || d.despesas > 0);
  if (!algumValor) {
    card.style.display = "none";
    return;
  }

  card.style.display = "flex";
  container.innerHTML = "";

  const maiorValor = Math.max(...dados.map((d) => Math.max(d.receitas, d.despesas)), 1);

  const barrasContainer = document.createElement("div");
  barrasContainer.className = "comparativo-barras-container";

  meses.forEach(({ ano, mes }, i) => {
    const alturaRec = Math.round((dados[i].receitas / maiorValor) * 100);
    const alturaDesp = Math.round((dados[i].despesas / maiorValor) * 100);
    const ehMesAtual = mes === mesAtualIdx && ano === anoAtual;

    const coluna = document.createElement("div");
    coluna.className = "comparativo-coluna";
    coluna.innerHTML = `
      <div class="comparativo-barras">
        <div class="comparativo-barra comparativo-barra-receita ${ehMesAtual ? "comparativo-barra-atual" : ""}" data-altura="${alturaRec}"></div>
        <div class="comparativo-barra comparativo-barra-despesa ${ehMesAtual ? "comparativo-barra-atual" : ""}" data-altura="${alturaDesp}"></div>
      </div>
      <span class="comparativo-rotulo">${NOMES_MESES_ABREV[mes]}</span>
    `;
    barrasContainer.appendChild(coluna);
  });

  container.appendChild(barrasContainer);

  // Legenda
  const legenda = document.createElement("div");
  legenda.className = "comparativo-legenda";
  legenda.innerHTML = `
    <span class="comparativo-legenda-item"><span class="comparativo-legenda-dot" style="background: var(--cor-receita)"></span>Saldo</span>
    <span class="comparativo-legenda-item"><span class="comparativo-legenda-dot" style="background: var(--cor-despesa)"></span>Despesas</span>
  `;
  container.appendChild(legenda);

  requestAnimationFrame(() => {
    container.querySelectorAll(".comparativo-barra").forEach((barra) => {
      barra.style.height = `${barra.dataset.altura}%`;
    });
  });
}


// ==========================================
// [25] TAXA DE POUPANÇA
// ==========================================

// --- TAXA DE POUPANÇA ---
function calcularTaxaPoupanca(totalReceitas, totalDespesas) {
  const card = document.getElementById("card-poupanca");
  const valorEl = document.getElementById("taxa-poupanca");
  const descEl = document.getElementById("poupanca-desc");
  if (!card || !valorEl || !descEl) return;

  if (totalReceitas <= 0) {
    card.style.display = "none";
    return;
  }

  const economia = totalReceitas - totalDespesas;
  const taxa = Math.round((economia / totalReceitas) * 100);

  card.style.display = "flex";
  valorEl.textContent = `${taxa}%`;
  valorEl.style.color = taxa >= 0 ? "var(--cor-receita)" : "var(--cor-despesa)";

  if (taxa >= 20) {
    descEl.textContent = "Excelente! Você está economizando bem.";
  } else if (taxa >= 10) {
    descEl.textContent = "Bom. Tente aumentar para 20%.";
  } else if (taxa > 0) {
    descEl.textContent = "Espere um pouco mais da entrada.";
  } else {
    descEl.textContent = "Gastos maiores que receitas este mês.";
  }
}

// --- CAPACIDADE DE GUARDA ---
function calcularCapacidadeGuarda() {
  const card = document.getElementById("card-guarda");
  const valorEl = document.getElementById("valor-guarda");
  const descEl = document.getElementById("guarda-desc");
  if (!card || !valorEl || !descEl) return;

  const usuario = obterUsuarioLogado();
  const salario = usuario.salario || 0;

  if (salario <= 0) {
    card.style.display = "none";
    return;
  }

  let totalFixas = 0;
  let totalParcelas = 0;

  if (typeof despesasFixasCarregadas !== "undefined") {
    despesasFixasCarregadas.forEach((f) => {
      if (f.ativo) totalFixas += f.valor || 0;
    });
  }

  if (typeof comprasParceladasCarregadas !== "undefined") {
    comprasParceladasCarregadas.forEach((c) => {
      if (c.ativo) totalParcelas += c.valor_parcela || 0;
    });
  }

  const guards = salario - totalFixas - totalParcelas;
  const guardaMensal = Math.max(0, guards);

  card.style.display = "flex";
  valorEl.textContent = formatadorBRL.format(guardaMensal);
  valorEl.style.color = guards >= 0 ? "var(--cor-receita)" : "var(--cor-despesa)";

  if (guards <= 0) {
    descEl.textContent = "Suas fixas e parcelas consomem todo o salário.";
  } else {
    const guardaSemanal = Math.round(guardaMensal / 4);
    descEl.textContent = `Dá pra guardar ~${formatadorBRL.format(guardaSemanal)}/semana.`;
  }
}

// --- SCORE DE SAÚDE FINANCEIRA (0-100) ---
function calcularScoreSaude(totalReceitas, totalDespesas, totaisPorCategoria) {
  const card = document.getElementById("card-score");
  const ringFill = document.getElementById("score-ring-fill");
  const valorEl = document.getElementById("score-valor");
  const detalhesEl = document.getElementById("score-detalhes");
  if (!card || !ringFill || !valorEl || !detalhesEl) return;

  const totalPago = totalReceitas + totalDespesas;
  if (totalPago === 0) {
    card.style.display = "none";
    return;
  }

  let score = 0;
  const criterios = [];

  // 1. Taxa de poupança (40 pts) — receitas vs despesas
  const taxaPoupanca = totalReceitas > 0 ? ((totalReceitas - totalDespesas) / totalReceitas) * 100 : 0;
  const ptsPoupanca = Math.min(40, Math.max(0, Math.round(taxaPoupanca * 0.8)));
  score += ptsPoupanca;
  criterios.push({
    nome: "Taxa de poupança",
    valor: `${Math.round(taxaPoupanca)}%`,
    pontos: ptsPoupanca,
    max: 40,
  });

  // 2. Controle de gastos (25 pts) — despesas < receitas
  const razaoGastos = totalReceitas > 0 ? (totalDespesas / totalReceitas) * 100 : 100;
  const ptsControle = razaoGastos <= 80 ? 25 : razaoGastos <= 100 ? Math.round(25 * (1 - (razaoGastos - 80) / 40)) : 0;
  score += ptsControle;
  criterios.push({
    nome: "Controle de gastos",
    valor: `${Math.round(razaoGastos)}%`,
    pontos: ptsControle,
    max: 25,
  });

  // 3. Diversificação (15 pts) — menos concentração = melhor
  const numCategorias = Object.keys(totaisPorCategoria).length;
  const maiorCategoria = Object.values(totaisPorCategoria).sort((a, b) => b - a)[0] || 0;
  const concentracao = totalDespesas > 0 ? (maiorCategoria / totalDespesas) * 100 : 0;
  const ptsDiversificacao = numCategorias >= 5 && concentracao < 40 ? 15 : numCategorias >= 3 ? 10 : numCategorias >= 1 ? 5 : 0;
  score += ptsDiversificacao;
  criterios.push({
    nome: "Diversificação",
    valor: `${numCategorias} cats`,
    pontos: ptsDiversificacao,
    max: 15,
  });

  // 4. Regularidade (10 pts) — fixas ativas < 50% do salário
  let totalFixas = 0;
  if (typeof despesasFixasCarregadas !== "undefined") {
    despesasFixasCarregadas.forEach((f) => { if (f.ativo) totalFixas += f.valor || 0; });
  }
  const usuario = obterUsuarioLogado();
  const salario = usuario.salario || 0;
  const pctFixas = salario > 0 ? (totalFixas / salario) * 100 : 100;
  const ptsRegularidade = pctFixas <= 30 ? 10 : pctFixas <= 50 ? 6 : 0;
  score += ptsRegularidade;
  criterios.push({
    nome: "Fixas do salário",
    valor: `${Math.round(pctFixas)}%`,
    pontos: ptsRegularidade,
    max: 10,
  });

  // 5. Pagamentos em dia (10 pts) — sem atrasados
  const temAtrasado = typeof ultimoLoteLancamentos !== "undefined" && ultimoLoteLancamentos.some((l) => l.status === "atrasado");
  const ptsAtrasados = temAtrasado ? 0 : 10;
  score += ptsAtrasados;
  criterios.push({
    nome: "Pagamentos em dia",
    valor: temAtrasado ? "Atrasados" : "Em dia",
    pontos: ptsAtrasados,
    max: 10,
  });

  // Renderizar
  card.style.display = "flex";
  valorEl.textContent = score;

  const circ = 2 * Math.PI * 52; // 326.73
  const offset = circ - (score / 100) * circ;
  ringFill.style.strokeDashoffset = offset;

  let cor;
  if (score >= 70) cor = "var(--cor-receita)";
  else if (score >= 40) cor = "var(--cor-pendente)";
  else cor = "var(--cor-despesa)";
  ringFill.style.stroke = cor;
  valorEl.style.color = cor;

  detalhesEl.innerHTML = "";
  criterios.forEach((c) => {
    const pct = c.pontos / c.max;
    let cls = pct >= 0.7 ? "score-criterio-ok" : pct >= 0.4 ? "score-criterio-medio" : "score-criterio-ruim";
    const icone = pct >= 0.7 ? "✓" : pct >= 0.4 ? "!" : "✗";
    const div = document.createElement("div");
    div.className = "score-criterio";
    div.innerHTML = `
      <span class="score-criterio-icone ${cls}">${icone}</span>
      <span class="score-criterio-texto">${c.nome}</span>
      <span class="score-criterio-valor">${c.valor}</span>
    `;
    detalhesEl.appendChild(div);
  });
}


// --- RELATÓRIO PDF (via impressão do navegador) ---
function gerarRelatorioPDF() {
  const usuario = obterUsuarioLogado();
  const nomeMes = document.getElementById("rotulo-mes")?.textContent || "";
  const dados = typeof ultimoLoteLancamentos !== "undefined" ? ultimoLoteLancamentos : [];

  let totalReceitas = 0, totalDespesas = 0, totalPendente = 0, qtdPendentes = 0, qtdAtrasados = 0;
  const porCategoria = {};
  const porStatus = { pago: 0, pendente: 0, atrasado: 0 };

  dados.forEach((l) => {
    porStatus[l.status] = (porStatus[l.status] || 0) + l.valor;
    if (l.status === "pendente" && l.tipo === "despesa") { totalPendente += l.valor; qtdPendentes++; }
    if (l.status === "atrasado") qtdAtrasados++;
    if (l.status !== "pago") return;
    if (l.tipo === "receita") totalReceitas += l.valor;
    else {
      totalDespesas += l.valor;
      porCategoria[l.categoria] = (porCategoria[l.categoria] || 0) + l.valor;
    }
  });

  const saldo = totalReceitas - totalDespesas;
  const taxaPoupanca = totalReceitas > 0 ? ((totalReceitas - totalDespesas) / totalReceitas * 100) : 0;
  const categorias = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);
  const maiorCategoria = categorias.length > 0 ? categorias[0][1] : 1;
  const cores = ["#2e7d32","#1565c0","#e65100","#6a1b9a","#c62828","#00838f","#4e342e","#37474f","#827717","#ad1457"];

  // Status badges
  const statusBadge = (s) => {
    const cores = { pago: "#2e7d32", pendente: "#f9a825", atrasado: "#c62828" };
    const labels = { pago: "Pago", pendente: "Pendente", atrasado: "Atrasado" };
    return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:600;color:#fff;background:${cores[s] || "#666"}">${labels[s] || s}</span>`;
  };

  const html = `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8"/>
    <title>Relatório Financeiro — ${nomeMes}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', sans-serif; padding: 48px; color: #1a1a2e; background: #fafafa; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #e8e8e8; padding-bottom: 20px; }
      .header-left h1 { font-size: 1.6rem; font-weight: 700; color: #1a1a2e; }
      .header-left .sub { color: #666; font-size: 0.85rem; margin-top: 4px; }
      .header-right { text-align: right; font-size: 0.75rem; color: #999; }
      .header-right .logo-text { font-size: 1.1rem; font-weight: 700; color: #a97a2f; }

      .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
      .kpi { background: #fff; border: 1px solid #e8e8e8; border-radius: 10px; padding: 16px; text-align: center; border-top: 3px solid #e0e0e0; }
      .kpi-receita { border-top-color: #2e7d32; }
      .kpi-despesa { border-top-color: #c62828; }
      .kpi-saldo { border-top-color: ${saldo >= 0 ? "#2e7d32" : "#c62828"}; }
      .kpi-pendente { border-top-color: #f9a825; }
      .kpi-rotulo { font-size: 0.68rem; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
      .kpi-valor { font-size: 1.3rem; font-weight: 700; margin-top: 6px; }
      .kpi-receita .kpi-valor { color: #2e7d32; }
      .kpi-despesa .kpi-valor { color: #c62828; }
      .kpi-saldo .kpi-valor { color: ${saldo >= 0 ? "#2e7d32" : "#c62828"}; }
      .kpi-pendente .kpi-valor { color: #f9a825; }
      .kpi-extra { font-size: 0.68rem; color: #999; margin-top: 4px; }

      .section-title { font-size: 1rem; font-weight: 700; margin: 28px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #e8e8e8; color: #1a1a2e; }

      .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }

      .card { background: #fff; border: 1px solid #e8e8e8; border-radius: 10px; padding: 16px; }
      .card-title { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 12px; }

      .cat-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
      .cat-bar-nome { width: 120px; font-size: 0.8rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .cat-bar-trilho { flex: 1; height: 10px; background: #f0f0f0; border-radius: 5px; overflow: hidden; }
      .cat-bar-fill { height: 100%; border-radius: 5px; }
      .cat-bar-valor { width: 80px; text-align: right; font-size: 0.78rem; font-weight: 600; font-family: monospace; }

      .resumo-item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f5f5f5; font-size: 0.82rem; }
      .resumo-item:last-child { border-bottom: none; }
      .resumo-label { color: #666; }
      .resumo-valor { font-weight: 600; font-family: monospace; }

      table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
      th { background: #f8f8f8; font-weight: 600; text-transform: uppercase; font-size: 0.65rem; letter-spacing: 0.5px; color: #888; padding: 10px 12px; text-align: left; border-bottom: 2px solid #e8e8e8; }
      td { padding: 9px 12px; border-bottom: 1px solid #f0f0f0; }
      tr:hover td { background: #fafafa; }
      .text-right { text-align: right; }
      .text-receita { color: #2e7d32; font-weight: 600; }
      .text-despesa { color: #c62828; font-weight: 600; }
      .text-pendente { color: #f9a825; }
      .nota-cell { font-size: 0.72rem; color: #999; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      .footer { margin-top: 40px; padding-top: 16px; border-top: 2px solid #e8e8e8; display: flex; justify-content: space-between; font-size: 0.7rem; color: #aaa; }

      .print-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: #fff;
        border-top: 1px solid #e0e0e0;
        padding: 16px 48px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        box-shadow: 0 -2px 10px rgba(0,0,0,0.08);
        z-index: 100;
      }
      .print-bar-texto { font-size: 0.82rem; color: #666; }
      .print-bar-texto strong { color: #333; }
      .print-bar-btn {
        background: #a97a2f;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 10px 28px;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        white-space: nowrap;
      }
      .print-bar-btn:hover { background: #8c6520; }
      .print-bar-btn svg { flex-shrink: 0; }
      .print-bar-dica { font-size: 0.7rem; color: #999; }
      body { padding-bottom: 80px; }

      @media print {
        body { padding: 24px; padding-bottom: 0; background: #fff; }
        .card { break-inside: avoid; }
        tr { break-inside: avoid; }
        .print-bar { display: none !important; }
      }
    </style>
  </head>
  <body>
    <div class="print-bar">
      <div>
        <div class="print-bar-texto"><strong>Salvo como PDF:</strong> clique em "Imprimir" e selecione <strong>"Salvar como PDF"</strong> no destino.</div>
        <div class="print-bar-dica">No Chrome: Destino → Salvar como PDF · No Firefox: Configurações → PDF</div>
      </div>
      <button class="print-bar-btn" onclick="window.print()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Imprimir / Salvar PDF
      </button>
    </div>
    <div class="header">
      <div class="header-left">
        <h1>Relatório Financeiro</h1>
        <div class="sub">${escaparHtml(usuario.nome || "Usuário")} — ${nomeMes}</div>
      </div>
      <div class="header-right">
        <div class="logo-text">Gestor Financeiro</div>
        <div>Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi kpi-receita">
        <div class="kpi-rotulo">Saldo</div>
        <div class="kpi-valor">${formatadorBRL.format(totalReceitas)}</div>
        <div class="kpi-extra">${dados.filter((l) => l.tipo === "receita" && l.status === "pago").length} receita(s)</div>
      </div>
      <div class="kpi kpi-despesa">
        <div class="kpi-rotulo">Despesas</div>
        <div class="kpi-valor">${formatadorBRL.format(totalDespesas)}</div>
        <div class="kpi-extra">${categorias.length} categoria(s)</div>
      </div>
      <div class="kpi kpi-saldo">
        <div class="kpi-rotulo">Saldo do período</div>
        <div class="kpi-valor">${formatadorBRL.format(saldo)}</div>
        <div class="kpi-extra">Poupança: ${taxaPoupanca.toFixed(1)}%</div>
      </div>
      <div class="kpi kpi-pendente">
        <div class="kpi-rotulo">A pagar</div>
        <div class="kpi-valor">${formatadorBRL.format(totalPendente)}</div>
        <div class="kpi-extra">${qtdPendentes} pendente(s)${qtdAtrasados > 0 ? " · " + qtdAtrasados + " atrasado(s)" : ""}</div>
      </div>
    </div>

    <div class="two-col">
      <div class="card">
        <div class="card-title">Despesas por categoria</div>
        ${categorias.length > 0 ? categorias.slice(0, 8).map(([cat, val], i) => {
          const pct = (val / maiorCategoria) * 100;
          const pctTotal = (val / totalDespesas * 100).toFixed(1);
          return `<div class="cat-bar">
            <span class="cat-bar-nome">${escaparHtml(cat)}</span>
            <div class="cat-bar-trilho"><div class="cat-bar-fill" style="width:${pct}%;background:${cores[i % cores.length]}"></div></div>
            <span class="cat-bar-valor">${formatadorBRL.format(val)} <span style="color:#999;font-weight:400">(${pctTotal}%)</span></span>
          </div>`;
        }).join("") : "<p style='color:#999;font-size:0.82rem'>Nenhuma despesa paga neste período.</p>"}
      </div>
      <div class="card">
        <div class="card-title">Resumo do período</div>
        <div class="resumo-item"><span class="resumo-label">Total de lançamentos</span><span class="resumo-valor">${dados.length}</span></div>
        <div class="resumo-item"><span class="resumo-label">Pagos</span><span class="resumo-valor" style="color:#2e7d32">${porStatus.pago ? formatadorBRL.format(porStatus.pago) : "R$ 0,00"}</span></div>
        <div class="resumo-item"><span class="resumo-label">Pendentes</span><span class="resumo-valor" style="color:#f9a825">${porStatus.pendente ? formatadorBRL.format(porStatus.pendente) : "R$ 0,00"}</span></div>
        ${porStatus.atrasado > 0 ? `<div class="resumo-item"><span class="resumo-label">Atrasados</span><span class="resumo-valor" style="color:#c62828">${formatadorBRL.format(porStatus.atrasado)}</span></div>` : ""}
        <div class="resumo-item"><span class="resumo-label">Ticket médio (despesa)</span><span class="resumo-valor">${totalDespesas > 0 && categorias.length > 0 ? formatadorBRL.format(totalDespesas / dados.filter((l) => l.tipo === "despesa" && l.status === "pago").length) : "—"}</span></div>
        <div class="resumo-item"><span class="resumo-label">Maior gasto</span><span class="resumo-valor">${categorias.length > 0 ? escaparHtml(categorias[0][0]) : "—"}</span></div>
      </div>
    </div>

    <h2 class="section-title">Lançamentos (${dados.length})</h2>
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Descrição</th>
          <th>Categoria</th>
          <th>Status</th>
          <th class="text-right">Valor</th>
        </tr>
      </thead>
      <tbody>
        ${dados.map((l) => `
          <tr>
            <td style="white-space:nowrap">${new Date(l.data_compra + "T12:00:00").toLocaleDateString("pt-BR")}</td>
            <td>${escaparHtml(l.descricao || "—")}</td>
            <td>${escaparHtml(l.categoria || "—")}</td>
            <td>${statusBadge(l.status)}</td>
            <td class="text-right ${l.tipo === "receita" ? "text-receita" : l.status === "atrasado" ? "text-despesa" : l.status === "pendente" ? "text-pendente" : "text-despesa"}">${l.tipo === "receita" ? "+" : "−"}${formatadorBRL.format(l.valor)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div class="footer">
      <span>Gestor Financeiro — ${new Date().getFullYear()}</span>
      <span>Documento gerado automaticamente</span>
    </div>
  </body></html>`;

  const janela = window.open("", "_blank");
  if (janela) {
    janela.document.write(html);
    janela.document.close();
  } else {
    mostrarToast("Permita pop-ups para gerar o relatório.", "aviso");
  }
}


// ==========================================
// [26] APAGAR LANÇAMENTO
// ==========================================

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
      mostrarToast("Lançamento excluído", "info");
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
// [27] ADMIN: Painel, Usuários, Categorias
// ==========================================

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
  configurarSistemaConvites();
  configurarFormularioCategoria();
  configurarZonaDePerigo();
}

// --- PLANEJAMENTO ---
let planosCarregados = [];

// ==========================================
// [28] PLANEJAMENTO: Planos Financeiros
// ==========================================

function configurarPlano() {
  const btnPlano = document.getElementById("btn-planejamento");
  const btnVoltar = document.getElementById("btn-voltar-dashboard-plano");
  const secaoDashboard = document.getElementById("dashboard-section");
  const secaoPlano = document.getElementById("planejamento-section");

  if (!btnPlano || !btnVoltar || !secaoDashboard || !secaoPlano) return;

  btnPlano.addEventListener("click", () => {
    secaoDashboard.style.display = "none";
    secaoPlano.style.display = "flex";
    secaoPlano.style.flexDirection = "column";
    renderizarPlano();
  });

  btnVoltar.addEventListener("click", () => {
    secaoPlano.style.display = "none";
    secaoDashboard.style.display = "block";
    carregarLancamentos();
  });

  configurarTabsPlano();
  configurarSalarioPlano();
  configurarMetaPlano();
  configurarModalPlano();
  configurarModalPlanoDeposito();
}

function configurarTabsPlano() {
  document.querySelectorAll(".plano-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".plano-tab").forEach((t) => t.classList.remove("ativo"));
      document.querySelectorAll(".plano-painel").forEach((p) => (p.style.display = "none"));
      tab.classList.add("ativo");
      const painel = document.getElementById(tab.dataset.painel);
      if (painel) painel.style.display = "block";
      renderizarPlano();
    });
  });

  document.querySelectorAll(".plano-sub-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".plano-sub-tab").forEach((t) => t.classList.remove("ativo"));
      tab.classList.add("ativo");
      const tipo = tab.dataset.tipo;
      const listaMeus = document.getElementById("lista-planos");
      const listaCompartilhados = document.getElementById("lista-planos-compartilhados");
      const titulo = document.getElementById("titulo-lista-planos");

      if (tipo === "meus") {
        listaMeus.style.display = "block";
        listaCompartilhados.style.display = "none";
        titulo.textContent = "Meus planos";
      } else {
        listaMeus.style.display = "none";
        listaCompartilhados.style.display = "block";
        titulo.textContent = "Compartilhados";
        carregarPlanosCompartilhados();
      }
    });
  });
}

function configurarSalarioPlano() {
  const btnEditar = document.getElementById("btn-editar-salario");
  const btnSalvar = document.getElementById("btn-salvar-salario");
  const btnCancelar = document.getElementById("btn-cancelar-salario");
  const form = document.getElementById("plano-salario-form");
  const display = document.querySelector(".plano-salario-linha");
  const input = document.getElementById("plano-salario-input");

  if (!btnEditar || !btnSalvar || !btnCancelar || !form || !display || !input) return;

  btnEditar.addEventListener("click", () => {
    const usuario = obterUsuarioLogado();
    input.value = usuario.salario || "";
    form.style.display = "block";
    display.querySelector(".plano-salario-valor").style.display = "none";
    btnEditar.style.display = "none";
  });

  btnCancelar.addEventListener("click", () => {
    form.style.display = "none";
    display.querySelector(".plano-salario-valor").style.display = "";
    btnEditar.style.display = "";
  });

  btnSalvar.addEventListener("click", async () => {
    const valor = parseFloat(input.value) || 0;
    const usuario = obterUsuarioLogado();

    btnSalvar.disabled = true;
    btnSalvar.innerText = "Salvando...";

    try {
      const resposta = await fetch(`${API_URL}/api/usuarios/${usuario.id}`, {
        method: "PUT",
        headers: headersAutenticados(),
        body: JSON.stringify({ salario: valor }),
      });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        usuario.salario = valor;
        localStorage.setItem("usuario", JSON.stringify(usuario));
        form.style.display = "none";
        display.querySelector(".plano-salario-valor").style.display = "";
        btnEditar.style.display = "";
        renderizarPlano();
        mostrarToast("Salário atualizado", "sucesso");
      }
    } catch (erro) {
      console.error("Erro ao salvar salário:", erro);
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.innerText = "Salvar";
    }
  });
}

async function carregarPlanos() {
  try {
    const resposta = await fetch(`${API_URL}/api/planos`, { headers: headersAutenticados() });
    if (tratarSessaoExpirada(resposta)) return;
    if (resposta.ok) {
      planosCarregados = await resposta.json();
    }
  } catch (erro) {
    console.error("Erro ao carregar planos:", erro);
  }
}

async function carregarPlanosCompartilhados() {
  const container = document.getElementById("lista-planos-compartilhados");
  if (!container) return;

  try {
    const resposta = await fetch(`${API_URL}/api/planos?tipo=compartilhados`, { headers: headersAutenticados() });
    if (tratarSessaoExpirada(resposta)) return;
    if (resposta.ok) {
      const planos = await resposta.json();
      renderizarListaPlanosCompartilhados(planos);
    }
  } catch (erro) {
    console.error("Erro ao carregar planos compartilhados:", erro);
  }
}

function renderizarListaPlanosCompartilhados(planos) {
  const container = document.getElementById("lista-planos-compartilhados");
  if (!container) return;

  if (planos.length === 0) {
    container.innerHTML = '<div class="plano-vazio">Nenhum plano compartilhado por outros usuários.</div>';
    return;
  }

  container.innerHTML = planos.map((plano) => {
    const temPrazo = !!plano.data_limite;
    const dataFormatada = temPrazo ? new Date(plano.data_limite + "T12:00:00").toLocaleDateString("pt-BR") : "";
    const statusLabel = { ativo: "Ativo", concluido: "Concluído", cancelado: "Cancelado" }[plano.status] || plano.status;
    const prioridadeLabel = { alta: "Alta", media: "Média", baixa: "Baixa" }[plano.prioridade] || plano.prioridade;

    return `
      <div class="plano-card-item" data-id="${plano.id}">
        <div class="plano-card-topo">
          <div class="plano-card-icone" style="background: ${plano.cor}22">${plano.icone}</div>
          <div class="plano-card-info">
            <div class="plano-card-nome">${escaparHtml(plano.nome)} <span class="plano-badge-compartilhado">Compartilhado</span></div>
            <div class="plano-card-autor">Criado por ${escaparHtml(plano.criado_por_nome || "Usuário")}</div>
            ${plano.descricao ? `<div class="plano-card-desc">${escaparHtml(plano.descricao)}</div>` : ""}
          </div>
          <span class="plano-status-badge status-${plano.status}">${statusLabel}</span>
        </div>
        <div class="plano-card-barra">
          <div class="plano-card-barra-fill" style="width: ${plano.percentual}%; background: ${plano.cor}"></div>
        </div>
        <div class="plano-card-detalhes">
          <span>
            <span class="plano-card-valores">${formatadorBRL.format(plano.depositado)} / ${formatadorBRL.format(plano.valor_alvo)}</span>
            ${temPrazo ? ` · Prazo: ${dataFormatada}` : ""}
          </span>
          <span class="plano-card-prioridade prioridade-${plano.prioridade}">${prioridadeLabel}</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderizarPlano() {
  const usuario = obterUsuarioLogado();
  const salario = usuario.salario || 0;

  const salarioDisplay = document.getElementById("plano-salario-display");
  if (salarioDisplay) {
    salarioDisplay.textContent = salario > 0 ? formatadorBRL.format(salario) : "Não definido";
  }

  renderizarKPIsPlano(salario);
  renderizarIndicadoresPlano(salario);
  renderizarAlertasPlano(salario);
  renderizarOrcamentosPlano();
  renderizarMetasPlano();
  renderizarReceitasPlano();
  renderizarDespesasPlano();
  renderizarComparacaoPlano();
  configurarSimulacaoPlano();
}

function renderizarGuardaPlano(salario) {
  const cardGuarda = document.getElementById("plano-card-guarda");
  const guardaValor = document.getElementById("plano-guarda-valor");
  const guardaDetalhe = document.getElementById("plano-guarda-detalhe");

  if (salario > 0 && cardGuarda) {
    let totalFixas = 0;
    let totalParcelas = 0;

    if (typeof despesasFixasCarregadas !== "undefined") {
      despesasFixasCarregadas.forEach((f) => { if (f.ativo) totalFixas += f.valor || 0; });
    }
    if (typeof comprasParceladasCarregadas !== "undefined") {
      comprasParceladasCarregadas.forEach((c) => { if (c.ativo) totalParcelas += c.valor_parcela || 0; });
    }

    const sobra = salario - totalFixas - totalParcelas;
    const sobraPositiva = Math.max(0, sobra);
    const guardaSemanal = Math.round(sobraPositiva / 4);

    cardGuarda.style.display = "flex";
    guardaValor.textContent = formatadorBRL.format(sobraPositiva);
    guardaValor.style.color = sobra >= 0 ? "var(--cor-receita)" : "var(--cor-despesa)";

    if (sobra <= 0) {
      guardaDetalhe.textContent = "Suas fixas e parcelas consomem todo o salário.";
    } else {
      guardaDetalhe.textContent = `Dá pra guardar ~${formatadorBRL.format(guardaSemanal)}/semana.`;
    }

    const maxValor = Math.max(salario, 1);
    const el = (id) => document.getElementById(id);
    if (el("plano-barra-fixas")) el("plano-barra-fixas").style.width = `${Math.round((totalFixas / maxValor) * 100)}%`;
    if (el("plano-barra-parcelas")) el("plano-barra-parcelas").style.width = `${Math.round((totalParcelas / maxValor) * 100)}%`;
    if (el("plano-barra-sobra")) el("plano-barra-sobra").style.width = `${Math.round((sobraPositiva / maxValor) * 100)}%`;
    if (el("plano-valor-fixas")) el("plano-valor-fixas").textContent = formatadorBRL.format(totalFixas);
    if (el("plano-valor-parcelas")) el("plano-valor-parcelas").textContent = formatadorBRL.format(totalParcelas);
    if (el("plano-valor-sobra")) el("plano-valor-sobra").textContent = formatadorBRL.format(sobraPositiva);
  } else if (cardGuarda) {
    cardGuarda.style.display = "none";
  }
}

function renderizarDistribuicaoPlano(salario) {
  const container = document.getElementById("plano-distribuicao");
  if (!container) return;

  if (salario <= 0) {
    container.innerHTML = '<div class="plano-vazio">Defina o salário para ver a distribuição.</div>';
    return;
  }

  let totalFixas = 0;
  let totalParcelas = 0;
  let totalPlanos = 0;

  if (typeof despesasFixasCarregadas !== "undefined") {
    despesasFixasCarregadas.forEach((f) => { if (f.ativo) totalFixas += f.valor || 0; });
  }
  if (typeof comprasParceladasCarregadas !== "undefined") {
    comprasParceladasCarregadas.forEach((c) => { if (c.ativo) totalParcelas += c.valor_parcela || 0; });
  }

  planosCarregados.forEach((p) => {
    if (p.status === "ativo" && p.parcela_mensal) totalPlanos += p.parcela_mensal;
  });

  const sobra = Math.max(0, salario - totalFixas - totalParcelas - totalPlanos);
  const itens = [];

  if (totalFixas > 0) {
    itens.push(`<div class="plano-dist-item">
      <span class="plano-dist-icone">🔁</span>
      <div class="plano-dist-info"><div class="plano-dist-nome">Despesas fixas</div><div class="plano-dist-detalhe">Mensal</div></div>
      <span class="plano-dist-valor">-${formatadorBRL.format(totalFixas)}</span>
    </div>`);
  }

  if (totalParcelas > 0) {
    itens.push(`<div class="plano-dist-item">
      <span class="plano-dist-icone">📦</span>
      <div class="plano-dist-info"><div class="plano-dist-nome">Parcelas</div><div class="plano-dist-detalhe">Mensal</div></div>
      <span class="plano-dist-valor">-${formatadorBRL.format(totalParcelas)}</span>
    </div>`);
  }

  if (totalPlanos > 0) {
    itens.push(`<div class="plano-dist-item">
      <span class="plano-dist-icone">🎯</span>
      <div class="plano-dist-info"><div class="plano-dist-nome">Planos ativos</div><div class="plano-dist-detalhe">${planosCarregados.filter((p) => p.status === "ativo" && p.parcela_mensal).length} plano(s)</div></div>
      <span class="plano-dist-valor">-${formatadorBRL.format(totalPlanos)}</span>
    </div>`);
  }

  itens.push(`<div class="plano-dist-item" style="border-bottom: none; padding-top: 0.75rem">
    <span class="plano-dist-icone">💰</span>
    <div class="plano-dist-info"><div class="plano-dist-nome" style="font-weight: 700">Sobra mensal</div></div>
    <span class="plano-dist-restante">${formatadorBRL.format(sobra)}</span>
  </div>`);

  container.innerHTML = itens.join("");
}

// --- KPIs DO PLANEJAMENTO ---
function renderizarKPIsPlano(salario) {
  const el = (id) => document.getElementById(id);
  let totalFixas = 0, totalParcelas = 0;
  if (typeof despesasFixasCarregadas !== "undefined") despesasFixasCarregadas.forEach((f) => { if (f.ativo) totalFixas += f.valor || 0; });
  if (typeof comprasParceladasCarregadas !== "undefined") comprasParceladasCarregadas.forEach((c) => { if (c.ativo) totalParcelas += c.valor_parcela || 0; });

  const despesasPlanejadas = totalFixas + totalParcelas;
  const economia = Math.max(0, salario - despesasPlanejadas);
  const pct = salario > 0 ? ((economia / salario) * 100).toFixed(1) : "0";

  if (el("plano-kpi-receita")) el("plano-kpi-receita").textContent = formatadorBRL.format(salario);
  if (el("plano-kpi-despesas")) el("plano-kpi-despesas").textContent = formatadorBRL.format(despesasPlanejadas);
  if (el("plano-kpi-economia")) el("plano-kpi-economia").textContent = formatadorBRL.format(economia);
  if (el("plano-kpi-pct")) el("plano-kpi-pct").textContent = `${pct}%`;
  if (el("plano-kpi-saldo")) {
    el("plano-kpi-saldo").textContent = formatadorBRL.format(economia);
    el("plano-kpi-saldo").style.color = economia >= 0 ? "var(--cor-receita)" : "var(--cor-despesa)";
  }
}

// --- INDICADORES FINANCEIROS ---
function renderizarIndicadoresPlano(salario) {
  const container = document.getElementById("plano-indicadores");
  if (!container) return;

  let totalFixas = 0, totalParcelas = 0;
  if (typeof despesasFixasCarregadas !== "undefined") despesasFixasCarregadas.forEach((f) => { if (f.ativo) totalFixas += f.valor || 0; });
  if (typeof comprasParceladasCarregadas !== "undefined") comprasParceladasCarregadas.forEach((c) => { if (c.ativo) totalParcelas += c.valor_parcela || 0; });

  const despesasFixas = totalFixas;
  const despesasVar = totalParcelas;
  const comprometido = despesasFixas + despesasVar;
  const pctComprometido = salario > 0 ? ((comprometido / salario) * 100).toFixed(1) : "0";
  const capacidadeInvest = Math.max(0, salario - comprometido);

  const itens = [
    { nome: "Taxa de economia", valor: `${salario > 0 ? (((salario - comprometido) / salario) * 100).toFixed(0) : 0}%`, cor: "var(--cor-receita)", bg: "rgba(46,125,50,0.1)" },
    { nome: "Renda comprometida", valor: `${pctComprometido}%`, cor: "var(--cor-despesa)", bg: "rgba(198,40,40,0.1)" },
    { nome: "Investimentos", valor: formatadorBRL.format(planosCarregados.filter((p) => p.status === "ativo" && p.tipo === "investimento").reduce((s, p) => s + (p.parcela_mensal || 0), 0)), cor: "var(--cor-marca)", bg: "rgba(169,122,47,0.1)" },
    { nome: "Despesas fixas", valor: formatadorBRL.format(despesasFixas), cor: "var(--cor-texto)", bg: "var(--cor-fundo)" },
    { nome: "Despesas variáveis", valor: formatadorBRL.format(despesasVar), cor: "var(--cor-texto)", bg: "var(--cor-fundo)" },
    { nome: "Capacidade de invest.", valor: formatadorBRL.format(capacidadeInvest), cor: "var(--cor-receita)", bg: "rgba(46,125,50,0.1)" },
  ];

  container.innerHTML = itens.map((item) => `
    <div class="plano-ind-item">
      <div class="plano-ind-icone" style="background:${item.bg};color:${item.cor}">•</div>
      <div class="plano-ind-info">
        <div class="plano-ind-nome">${item.nome}</div>
        <div class="plano-ind-valor" style="color:${item.cor}">${item.valor}</div>
      </div>
    </div>
  `).join("");
}

// --- ALERTAS ---
function renderizarAlertasPlano(salario) {
  const card = document.getElementById("plano-card-alertas");
  const container = document.getElementById("plano-alertas");
  if (!card || !container) return;

  const alertas = [];
  let totalFixas = 0, totalParcelas = 0;
  if (typeof despesasFixasCarregadas !== "undefined") despesasFixasCarregadas.forEach((f) => { if (f.ativo) totalFixas += f.valor || 0; });
  if (typeof comprasParceladasCarregadas !== "undefined") comprasParceladasCarregadas.forEach((c) => { if (c.ativo) totalParcelas += c.valor_parcela || 0; });

  const comprometido = totalFixas + totalParcelas;
  const pct = salario > 0 ? (comprometido / salario) * 100 : 0;

  if (pct > 90) alertas.push({ tipo: "erro", texto: `Seu orçamento está ${pct.toFixed(0)}% comprometido. Considere reduzir gastos.` });
  else if (pct > 70) alertas.push({ tipo: "aviso", texto: `Seu orçamento está ${pct.toFixed(0)}% comprometido. Atenção aos gastos.` });
  else if (salario > 0) alertas.push({ tipo: "ok", texto: `Parabéns! Apenas ${pct.toFixed(0)}% da renda está comprometida.` });

  if (typeof ultimoLoteLancamentos !== "undefined") {
    const atrasados = ultimoLoteLancamentos.filter((l) => l.status === "atrasado");
    if (atrasados.length > 0) alertas.push({ tipo: "erro", texto: `Você tem ${atrasados.length} conta(s) atrasada(s).` });
  }

  if (alertas.length === 0) { card.style.display = "none"; return; }
  card.style.display = "flex";
  container.innerHTML = alertas.map((a) => `<div class="plano-alerta-item plano-alerta-${a.tipo}">${a.texto}</div>`).join("");
}

// --- ORÇAMENTO POR CATEGORIA ---
function renderizarOrcamentosPlano() {
  const container = document.getElementById("plano-lista-orcamentos");
  if (!container) return;

  if (typeof orcamentosCarregados === "undefined" || orcamentosCarregados.length === 0) {
    container.innerHTML = '<div class="plano-vazio">Nenhum orçamento definido. Clique em "+ Novo orçamento" para começar.</div>';
    return;
  }

  container.innerHTML = orcamentosCarregados.map((o) => {
    const gasto = o.gasto_atual || 0;
    const pct = o.valor_limite > 0 ? Math.min((gasto / o.valor_limite) * 100, 100) : 0;
    const cor = pct >= 90 ? "var(--cor-despesa)" : pct >= 70 ? "var(--cor-pendente)" : "var(--cor-receita)";
    return `
      <div class="plano-lista-item">
        <div class="plano-lista-info">
          <div class="plano-lista-nome">${escaparHtml(o.categoria)}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
            <div style="flex:1;height:6px;background:var(--cor-pauta-forte);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${cor};border-radius:3px"></div>
            </div>
            <span style="font-size:0.7rem;color:${cor}">${pct.toFixed(0)}%</span>
          </div>
        </div>
        <div class="plano-lista-valor" style="color:${cor}">${formatadorBRL.format(gasto)} / ${formatadorBRL.format(o.valor_limite)}</div>
      </div>`;
  }).join("");
}

// --- RECEITAS PLANEJADAS ---
function renderizarReceitasPlano() {
  const container = document.getElementById("plano-lista-receitas");
  if (!container) return;

  if (typeof ultimoLoteLancamentos === "undefined") {
    container.innerHTML = '<div class="plano-vazio">Carregue os lançamentos primeiro.</div>';
    return;
  }

  const receitas = ultimoLoteLancamentos.filter((l) => l.tipo === "receita");
  if (receitas.length === 0) {
    container.innerHTML = '<div class="plano-vazio">Nenhuma receita registrada neste período.</div>';
    return;
  }

  container.innerHTML = receitas.map((r) => {
    const statusCls = r.status === "pago" ? "plano-status-recebido" : "plano-status-pendente";
    const statusLabel = r.status === "pago" ? "Recebido" : "Pendente";
    return `
      <div class="plano-lista-item">
        <div class="plano-lista-info">
          <div class="plano-lista-nome">${escaparHtml(r.descricao || r.categoria)}</div>
          <div class="plano-lista-detalhe">${new Date(r.data_compra + "T12:00:00").toLocaleDateString("pt-BR")} · ${escaparHtml(r.categoria || "")}</div>
        </div>
        <span class="plano-lista-status ${statusCls}">${statusLabel}</span>
        <span class="plano-lista-valor" style="color:var(--cor-receita)">+${formatadorBRL.format(r.valor)}</span>
      </div>`;
  }).join("");
}

// --- DESPESAS PLANEJADAS ---
function renderizarDespesasPlano() {
  const container = document.getElementById("plano-lista-despesas");
  if (!container) return;

  const itens = [];
  if (typeof despesasFixasCarregadas !== "undefined") {
    despesasFixasCarregadas.filter((f) => f.ativo).forEach((f) => {
      itens.push({ nome: f.descricao, valor: f.valor, cat: f.categoria, freq: "Mensal", tipo: "fixa" });
    });
  }
  if (typeof comprasParceladasCarregadas !== "undefined") {
    comprasParceladasCarregadas.filter((c) => c.ativo).forEach((c) => {
      itens.push({ nome: c.descricao, valor: c.valor_parcela, cat: c.categoria, freq: `Parcela ${c.parcela_atual || 1}/${c.total_parcelas}`, tipo: "parcela" });
    });
  }

  if (itens.length === 0) {
    container.innerHTML = '<div class="plano-vazio">Nenhuma despesa fixa ou parcelada ativa.</div>';
    return;
  }

  container.innerHTML = itens.map((d) => `
    <div class="plano-lista-item">
      <div class="plano-lista-info">
        <div class="plano-lista-nome">${escaparHtml(d.nome)}</div>
        <div class="plano-lista-detalhe">${escaparHtml(d.cat || "")} · ${d.freq}</div>
      </div>
      <span class="plano-lista-valor" style="color:var(--cor-despesa)">-${formatadorBRL.format(d.valor)}</span>
    </div>
  `).join("");
}

// --- COMPARAÇÃO PLANEJADO × REAL ---
function renderizarComparacaoPlano() {
  const container = document.getElementById("plano-comparacao");
  if (!container) return;

  if (typeof orcamentosCarregados === "undefined" || orcamentosCarregados.length === 0) {
    container.innerHTML = '<div class="plano-vazio">Defina orçamentos para ver a comparação.</div>';
    return;
  }

  const header = `<div class="plano-comp-linha plano-comp-header"><span>Categoria</span><span style="text-align:right">Planejado</span><span style="text-align:right">Real</span><span style="text-align:right">Diferença</span></div>`;

  const linhas = orcamentosCarregados.map((o) => {
    const real = o.gasto_atual || 0;
    const diff = real - o.valor_limite;
    const diffLabel = diff > 0 ? `+${formatadorBRL.format(diff)}` : diff < 0 ? formatadorBRL.format(diff) : "—";
    const cls = diff > 0 ? "positivo" : diff < 0 ? "negativo" : "";
    return `<div class="plano-comp-linha"><span class="plano-comp-categoria">${escaparHtml(o.categoria)}</span><span class="plano-comp-valor">${formatadorBRL.format(o.valor_limite)}</span><span class="plano-comp-valor">${formatadorBRL.format(real)}</span><span class="plano-comp-diferenca ${cls}">${diffLabel}</span></div>`;
  }).join("");

  container.innerHTML = header + linhas;
}

// --- SIMULAÇÃO ---
function configurarSimulacaoPlano() {
  const btn = document.getElementById("btn-simular");
  const input = document.getElementById("simulacao-valor");
  const resultado = document.getElementById("plano-resultado-simulacao");
  if (!btn || !input || !resultado) return;

  btn.onclick = () => {
    const valor = parseFloat(input.value) || 0;
    if (valor <= 0) return;

    resultado.innerHTML = `
      <div class="plano-sim-result">
        <div class="plano-sim-card">
          <div class="plano-sim-periodo">Em 12 meses</div>
          <div class="plano-sim-valor">${formatadorBRL.format(valor * 12)}</div>
        </div>
        <div class="plano-sim-card">
          <div class="plano-sim-periodo">Em 24 meses</div>
          <div class="plano-sim-valor">${formatadorBRL.format(valor * 24)}</div>
        </div>
        <div class="plano-sim-card">
          <div class="plano-sim-periodo">Em 60 meses</div>
          <div class="plano-sim-valor">${formatadorBRL.format(valor * 60)}</div>
        </div>
      </div>
    `;
  };
}

function renderizarListaPlanos() {
  const container = document.getElementById("lista-planos");
  if (!container) return;

  if (planosCarregados.length === 0) {
    container.innerHTML = '<div class="plano-vazio">Nenhum plano criado. Crie um plano para organizar seus objetivos!</div>';
    return;
  }

  container.innerHTML = planosCarregados.map((plano) => {
    const temPrazo = !!plano.data_limite;
    const dataFormatada = temPrazo ? new Date(plano.data_limite + "T12:00:00").toLocaleDateString("pt-BR") : "";
    const statusLabel = { ativo: "Ativo", concluido: "Concluído", cancelado: "Cancelado" }[plano.status] || plano.status;
    const prioridadeLabel = { alta: "Alta", media: "Média", baixa: "Baixa" }[plano.prioridade] || plano.prioridade;

    return `
      <div class="plano-card-item" data-id="${plano.id}">
        <div class="plano-card-topo">
          <div class="plano-card-icone" style="background: ${plano.cor}22">${plano.icone}</div>
          <div class="plano-card-info">
            <div class="plano-card-nome">${escaparHtml(plano.nome)} ${plano.compartilhado ? '<span class="plano-badge-compartilhado">Compartilhado</span>' : ""}</div>
            ${plano.descricao ? `<div class="plano-card-desc">${escaparHtml(plano.descricao)}</div>` : ""}
          </div>
          <span class="plano-status-badge status-${plano.status}">${statusLabel}</span>
        </div>
        <div class="plano-card-barra">
          <div class="plano-card-barra-fill" style="width: ${plano.percentual}%; background: ${plano.cor}"></div>
        </div>
        <div class="plano-card-detalhes">
          <span>
            <span class="plano-card-valores">${formatadorBRL.format(plano.depositado)} / ${formatadorBRL.format(plano.valor_alvo)}</span>
            ${temPrazo ? ` · Prazo: ${dataFormatada}` : ""}
          </span>
          <span class="plano-card-prioridade prioridade-${plano.prioridade}">${prioridadeLabel}</span>
        </div>
        ${plano.status === "ativo" && plano.parcela_mensal ? `<div class="plano-card-detalhes"><span>Guarda mensal necessária</span><span class="plano-card-badge">~${formatadorBRL.format(plano.parcela_mensal)}/mês</span></div>` : ""}
        ${plano.status === "ativo" ? `
        <div class="plano-card-acoes">
          <button type="button" class="btn-link-adicionar plano-btn-depositar" data-id="${plano.id}">Depositar</button>
          <button type="button" class="btn-link-adicionar plano-btn-editar-plano" data-id="${plano.id}">Editar</button>
          <button type="button" class="btn-link-adicionar plano-btn-concluir" data-id="${plano.id}">Concluir</button>
          <button type="button" class="btn-link-adicionar plano-btn-cancelar" data-id="${plano.id}" style="color: var(--cor-despesa)">Cancelar</button>
        </div>` : ""}
      </div>
    `;
  }).join("");

  container.querySelectorAll(".plano-btn-depositar").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirModalPlanoDeposito(Number(btn.dataset.id));
    });
  });

  container.querySelectorAll(".plano-btn-editar-plano").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const plano = planosCarregados.find((p) => p.id === Number(btn.dataset.id));
      if (plano) abrirModalPlano(plano);
    });
  });

  container.querySelectorAll(".plano-btn-concluir").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!(await pedirConfirmacao("Marcar este plano como concluído?"))) return;
      await atualizarStatusPlano(Number(btn.dataset.id), "concluido");
    });
  });

  container.querySelectorAll(".plano-btn-cancelar").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!(await pedirConfirmacao("Cancelar este plano?", { textoConfirmar: "Cancelar plano", perigo: true }))) return;
      await atualizarStatusPlano(Number(btn.dataset.id), "cancelado");
    });
  });
}

async function atualizarStatusPlano(id, status) {
  try {
    const resposta = await fetch(`${API_URL}/api/planos`, {
      method: "PUT",
      headers: headersAutenticados(),
      body: JSON.stringify({ id, status }),
    });
    if (tratarSessaoExpirada(resposta)) return;
    if (resposta.ok) {
      mostrarToast(status === "concluido" ? "Plano concluído!" : "Plano cancelado.", "info");
      await carregarPlanos();
      renderizarListaPlanos();
      renderizarDistribuicaoPlano(obterUsuarioLogado().salario || 0);
    }
  } catch (erro) {
    console.error("Erro ao atualizar plano:", erro);
  }
}

// --- MODAL PLANO ---
function configurarModalPlano() {
  const modal = document.getElementById("modal-plano");
  const btnNovo = document.getElementById("btn-novo-plano");
  const btnFechar = document.getElementById("btn-fechar-modal-plano");
  const form = document.getElementById("form-plano");

  if (!btnNovo || !btnFechar || !form) return;

  btnNovo.addEventListener("click", () => abrirModalPlano(null));
  btnFechar.addEventListener("click", () => { modal.style.display = "none"; liberarFoco(); });

  document.querySelectorAll(".plano-icone-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".plano-icone-btn").forEach((b) => b.classList.remove("selecionado"));
      btn.classList.add("selecionado");
      document.getElementById("plano-icone").value = btn.dataset.icone;
    });
  });

  document.querySelectorAll(".plano-cor-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".plano-cor-btn").forEach((b) => b.classList.remove("selecionado"));
      btn.classList.add("selecionado");
      document.getElementById("plano-cor").value = btn.dataset.cor;
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const idEdicao = document.getElementById("plano-editando-id").value;
    const dados = {
      nome: document.getElementById("plano-nome").value.trim(),
      descricao: document.getElementById("plano-descricao").value.trim(),
      valor_alvo: parseFloat(document.getElementById("plano-valor-alvo").value) || 0,
      data_limite: document.getElementById("plano-data-limite").value || null,
      prioridade: document.getElementById("plano-prioridade").value,
      icone: document.getElementById("plano-icone").value,
      cor: document.getElementById("plano-cor").value,
      compartilhado: document.getElementById("plano-compartilhado").checked,
    };

    if (!dados.nome) return mostrarToast("Informe o nome do plano.", "erro");
    if (!dados.valor_alvo || dados.valor_alvo <= 0) return mostrarToast("Informe um valor alvo válido.", "erro");

    try {
      let resposta;
      if (idEdicao) {
        resposta = await fetch(`${API_URL}/api/planos`, {
          method: "PUT",
          headers: headersAutenticados(),
          body: JSON.stringify({ id: Number(idEdicao), ...dados }),
        });
      } else {
        resposta = await fetch(`${API_URL}/api/planos`, {
          method: "POST",
          headers: headersAutenticados(),
          body: JSON.stringify(dados),
        });
      }

      if (tratarSessaoExpirada(resposta)) return;
      if (resposta.ok) {
        mostrarToast(idEdicao ? "Plano atualizado!" : "Plano criado!", "sucesso");
        modal.style.display = "none";
        liberarFoco();
        await carregarPlanos();
        renderizarListaPlanos();
        renderizarDistribuicaoPlano(obterUsuarioLogado().salario || 0);
      } else {
        const erro = await resposta.json();
        mostrarToast(erro.erro || "Erro ao salvar plano.", "erro");
      }
    } catch (erro) {
      console.error("Erro ao salvar plano:", erro);
    }
  });
}

function abrirModalPlano(plano) {
  const modal = document.getElementById("modal-plano");
  const titulo = document.getElementById("titulo-modal-plano");
  const form = document.getElementById("form-plano");

  if (!modal || !form) return;

  form.reset();
  document.getElementById("plano-editando-id").value = "";
  document.querySelectorAll(".plano-icone-btn").forEach((b) => b.classList.remove("selecionado"));
  document.querySelectorAll(".plano-cor-btn").forEach((b) => b.classList.remove("selecionado"));

  if (plano) {
    titulo.textContent = "Editar plano";
    document.getElementById("plano-editando-id").value = plano.id;
    document.getElementById("plano-nome").value = plano.nome;
    document.getElementById("plano-descricao").value = plano.descricao || "";
    document.getElementById("plano-valor-alvo").value = plano.valor_alvo;
    document.getElementById("plano-data-limite").value = plano.data_limite || "";
    document.getElementById("plano-prioridade").value = plano.prioridade;
    document.getElementById("plano-icone").value = plano.icone;
    document.getElementById("plano-cor").value = plano.cor;
    document.getElementById("plano-compartilhado").checked = plano.compartilhado === 1;

    const iconeBtn = document.querySelector(`.plano-icone-btn[data-icone="${plano.icone}"]`);
    if (iconeBtn) iconeBtn.classList.add("selecionado");
    const corBtn = document.querySelector(`.plano-cor-btn[data-cor="${plano.cor}"]`);
    if (corBtn) corBtn.classList.add("selecionado");
  } else {
    titulo.textContent = "Novo plano";
    document.getElementById("plano-icone").value = "🎯";
    document.getElementById("plano-cor").value = "#6366f1";
    document.getElementById("plano-compartilhado").checked = false;
    const btnPadrao = document.querySelector('.plano-icone-btn[data-icone="🎯"]');
    if (btnPadrao) btnPadrao.classList.add("selecionado");
    const corPadrao = document.querySelector('.plano-cor-btn[data-cor="#6366f1"]');
    if (corPadrao) corPadrao.classList.add("selecionado");
  }

  modal.style.display = "flex";
  capturarFoco(modal);
}

// --- MODAL DEPÓSITO PLANO ---
function configurarModalPlanoDeposito() {
  const modal = document.getElementById("modal-plano-deposito");
  const btnFechar = document.getElementById("btn-fechar-modal-plano-deposito");
  const form = document.getElementById("form-plano-deposito");

  if (!btnFechar || !form) return;

  btnFechar.addEventListener("click", () => { modal.style.display = "none"; liberarFoco(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const planoId = document.getElementById("plano-dep-id").value;
    const valor = parseFloat(document.getElementById("plano-dep-valor").value) || 0;
    const descricao = document.getElementById("plano-dep-descricao").value.trim();

    if (!valor || valor <= 0) return mostrarToast("Informe um valor válido.", "erro");

    try {
      const resposta = await fetch(`${API_URL}/api/planos-depositos`, {
        method: "POST",
        headers: headersAutenticados(),
        body: JSON.stringify({ plano_id: Number(planoId), valor, descricao }),
      });

      if (tratarSessaoExpirada(resposta)) return;
      if (resposta.ok) {
        mostrarToast("Depósito registrado!", "sucesso");
        document.getElementById("plano-dep-valor").value = "";
        document.getElementById("plano-dep-descricao").value = "";
        await carregarPlanos();
        const plano = planosCarregados.find((p) => p.id === Number(planoId));
        if (plano) preencherModalDepositoPlano(plano);
        renderizarListaPlanos();
        renderizarDistribuicaoPlano(obterUsuarioLogado().salario || 0);
      } else {
        const erro = await resposta.json();
        mostrarToast(erro.erro || "Erro ao registrar depósito.", "erro");
      }
    } catch (erro) {
      console.error("Erro ao registrar depósito:", erro);
    }
  });
}

async function abrirModalPlanoDeposito(planoId) {
  const modal = document.getElementById("modal-plano-deposito");
  if (!modal) return;

  const plano = planosCarregados.find((p) => p.id === planoId);
  if (!plano) return;

  preencherModalDepositoPlano(plano);

  const { results: depositos } = await fetch(`${API_URL}/api/planos-depositos?plano_id=${planoId}`, { headers: headersAutenticados() })
    .then((r) => r.json())
    .then((dados) => ({ results: Array.isArray(dados) ? dados : [] }))
    .catch(() => ({ results: [] }));

  const lista = document.getElementById("lista-plano-depositos");
  if (lista) {
    if (depositos.length === 0) {
      lista.innerHTML = '<div class="plano-vazio" style="padding: 0.5rem">Nenhum depósito ainda.</div>';
    } else {
      lista.innerHTML = depositos.map((d) => `
        <div class="historico-fixa-linha">
          <div class="historico-fixa-info">
            <span class="historico-fixa-desc">${escaparHtml(d.descricao || "Depósito")}</span>
            <span class="historico-fixa-data">${new Date(d.criado_em).toLocaleDateString("pt-BR")}</span>
          </div>
          <span class="historico-fixa-valor">+${formatadorBRL.format(d.valor)}</span>
        </div>
      `).join("");
    }
  }

  modal.style.display = "flex";
  capturarFoco(modal);
}

function preencherModalDepositoPlano(plano) {
  document.getElementById("plano-dep-id").value = plano.id;
  document.getElementById("plano-dep-valor-depositado").textContent = formatadorBRL.format(plano.depositado);
  document.getElementById("plano-dep-valor-objetivo").textContent = formatadorBRL.format(plano.valor_alvo);
  document.getElementById("plano-dep-barra-progresso").style.width = `${plano.percentual}%`;
  document.getElementById("plano-dep-info-progresso").textContent = `${plano.percentual}% concluído`;
  document.querySelector(".plano-deposito-icone").textContent = plano.icone;
  document.querySelector(".plano-deposito-nome").textContent = plano.nome;
  document.querySelector(".plano-deposito-icone").style.background = `${plano.cor}22`;
}

// --- METAS NO PLANEJAMENTO ---
function configurarMetaPlano() {
  const btnNovaMeta = document.getElementById("btn-nova-meta-plano");
  if (!btnNovaMeta) return;
  btnNovaMeta.addEventListener("click", () => abrirModalMeta("", "", null));
}

function renderizarMetasPlano() {
  const container = document.getElementById("plano-lista-metas");
  if (!container) return;

  if (typeof metasCarregadas === "undefined" || metasCarregadas.length === 0) {
    container.innerHTML = '<div class="plano-vazio">Nenhuma meta criada ainda.</div>';
    return;
  }

  container.innerHTML = metasCarregadas.map((meta) => {
    const percentual = meta.valor_limite > 0 ? Math.min(100, Math.round((meta.total_depositado / meta.valor_limite) * 100)) : 0;
    const temPrazo = !!meta.data_limite;

    return `
      <div class="plano-meta-item" data-id="${meta.id}">
        <div class="plano-meta-topo">
          <span class="plano-meta-categoria">${escaparHtml(meta.categoria)}</span>
          <span class="plano-meta-valor">${formatadorBRL.format(meta.total_depositado)} / ${formatadorBRL.format(meta.valor_limite)}</span>
        </div>
        <div class="plano-meta-barra">
          <div class="plano-meta-preenchimento" style="width: ${percentual}%"></div>
        </div>
        <div class="plano-meta-detalhes">
          <span>${percentual}% concluído${temPrazo ? ` · Prazo: ${new Date(meta.data_limite + "T12:00:00").toLocaleDateString("pt-BR")}` : ""}</span>
          ${temPrazo && meta.falta > 0 ? `<span class="plano-meta-badge-semana">~${formatadorBRL.format(meta.guarda_semanal)}/sem.</span>` : ""}
        </div>
        <div class="plano-meta-acoes">
          <button type="button" class="btn-link-adicionar plano-btn-depositar" data-id="${meta.id}" data-categoria="${escaparHtml(meta.categoria)}">Depositar</button>
          <button type="button" class="btn-link-adicionar plano-btn-editar" data-categoria="${escaparHtml(meta.categoria)}" data-valor="${meta.valor_limite}" data-datalimite="${meta.data_limite || ""}">Editar</button>
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".plano-btn-depositar").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirModalDeposito(Number(btn.dataset.id), btn.dataset.categoria);
    });
  });

  container.querySelectorAll(".plano-btn-editar").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirModalMeta(btn.dataset.categoria, btn.dataset.valor, btn.dataset.datalimite || null);
    });
  });
}

function configurarSubAbasAdmin() {
  const navItems = document.querySelectorAll(".settings-nav-item");

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      navItems.forEach((t) => t.classList.remove("ativo"));
      item.classList.add("ativo");

      document.querySelectorAll(".settings-painel").forEach((p) => (p.style.display = "none"));
      const painel = document.getElementById(item.dataset.settingsPainel);
      if (painel) painel.style.display = "block";

      const painelId = item.dataset.settingsPainel;
      if (painelId === "sp-categorias") carregarListaCategorias();
      if (painelId === "sp-usuarios") carregarUsuarios();
      if (painelId === "sp-recorrentes") carregarPainelRecorrentes();
      if (painelId === "sp-perfil") preencherPerfilAtual();
      if (painelId === "sp-tema") sincronizarToggleTema();
    });
  });

  const searchInput = document.getElementById("settings-search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.toLowerCase();
      navItems.forEach((item) => {
        const texto = item.textContent.toLowerCase();
        item.style.display = texto.includes(q) || q === "" ? "" : "none";
      });
    });
  }

  document.querySelectorAll(".settings-tema-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tema = btn.dataset.tema;
      if (tema === "escuro") {
        document.body.classList.add("dark-mode");
        localStorage.setItem("cadimus_tema", "dark");
      } else if (tema === "claro") {
        document.body.classList.remove("dark-mode");
        localStorage.setItem("cadimus_tema", "light");
      } else {
        localStorage.removeItem("cadimus_tema");
        if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
          document.body.classList.add("dark-mode");
        } else {
          document.body.classList.remove("dark-mode");
        }
      }
      sincronizarToggleTema();
      const btnTheme = document.getElementById("btn-theme-toggle");
      if (btnTheme) {
        const estaEscuro = document.body.classList.contains("dark-mode");
        btnTheme.innerHTML = estaEscuro ? ICONE_SOL : ICONE_LUA;
      }
    });
  });
}

function preencherPerfilAtual() {
  const usuario = obterUsuarioLogado();
  if (!usuario) return;
  const el = (id) => document.getElementById(id);
  if (el("novo-nome")) el("novo-nome").value = usuario.nome || "";
  if (el("novo-email")) el("novo-email").value = usuario.email || "";
  if (el("novo-telefone")) el("novo-telefone").value = usuario.telefone || "";
  if (el("novo-usuario")) el("novo-usuario").value = usuario.usuario || "";
  if (el("novo-salario")) el("novo-salario").value = usuario.salario || "";
  if (el("novo-perfil")) el("novo-perfil").value = usuario.perfil || "comum";
  if (el("usuario-editando-id")) el("usuario-editando-id").value = usuario.id;
  if (el("nova-senha")) el("nova-senha").value = "";
  if (el("dica-senha")) el("dica-senha").style.display = "none";
  if (el("btn-cancelar-edicao")) el("btn-cancelar-edicao").style.display = "none";
  definirPreviewFoto(usuario.foto_perfil || null);
}

function sincronizarToggleTema() {
  const darkMode = localStorage.getItem("darkMode");
  document.querySelectorAll(".settings-tema-btn").forEach((btn) => {
    btn.classList.remove("ativo");
    if (darkMode === "true" && btn.dataset.tema === "escuro") btn.classList.add("ativo");
    else if (darkMode === "false" && btn.dataset.tema === "claro") btn.classList.add("ativo");
    else if (!darkMode && btn.dataset.tema === "auto") btn.classList.add("ativo");
  });
}

// ==========================================
// ZONA DE PERIGO: apagar todos os dados financeiros (só superadmin)
// ==========================================
const FRASE_CONFIRMACAO_ZERAR = "APAGAR TUDO";

function configurarZonaDePerigo() {
  const btnAbrir = document.getElementById("btn-abrir-zerar-dados");
  const modal = document.getElementById("modal-zerar-dados");
  const btnFechar = document.getElementById("btn-fechar-modal-zerar-dados");
  const btnConfirmar = document.getElementById("btn-confirmar-zerar-dados");
  const campoConfirmacao = document.getElementById("confirmacao-zerar-dados");

  if (!btnAbrir || !modal || !btnFechar || !btnConfirmar || !campoConfirmacao) return;

  function fecharModalZerarDados() {
    modal.style.display = "none";
    liberarFoco();
    campoConfirmacao.value = "";
    btnConfirmar.disabled = true;
  }

  btnAbrir.addEventListener("click", () => {
    campoConfirmacao.value = "";
    btnConfirmar.disabled = true;
    modal.style.display = "flex";
    trapFoco(modal);
  });

  btnFechar.addEventListener("click", fecharModalZerarDados);

  campoConfirmacao.addEventListener("input", () => {
    btnConfirmar.disabled = campoConfirmacao.value !== FRASE_CONFIRMACAO_ZERAR;
  });

  btnConfirmar.addEventListener("click", async () => {
    if (campoConfirmacao.value !== FRASE_CONFIRMACAO_ZERAR) return;

    btnConfirmar.disabled = true;
    btnConfirmar.innerText = "Apagando...";

    try {
      const resposta = await fetch(`${API_URL}/api/admin/zerar-dados`, {
        method: "POST",
        headers: headersAutenticados(),
        body: JSON.stringify({ confirmacao: campoConfirmacao.value }),
      });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        fecharModalZerarDados();
        cacheTendencia.clear();
        cacheComparativo6.clear();
        await mostrarAviso("Todos os dados financeiros foram apagados. As categorias voltaram ao padrão.");
        carregarListaCategorias();
        carregarLancamentos();
      } else {
        const erro = await resposta.json();
        await mostrarAviso(`Erro: ${erro.erro}`);
      }
    } catch (erro) {
      console.error(erro);
      await mostrarAviso("Erro de conexão ao apagar os dados.");
    } finally {
      btnConfirmar.innerText = "Apagar tudo permanentemente";
      btnConfirmar.disabled = campoConfirmacao.value !== FRASE_CONFIRMACAO_ZERAR;
    }
  });
}

// --- FOTO DE PERFIL: redimensiona e comprime no navegador antes de enviar ---
// Evita mandar fotos de celular (que podem vir com vários MB) pro backend;
// aqui já sai como base64 pequeno, do tamanho certo pra um avatar.
function comprimirImagemParaBase64(arquivo, ladoMaximo = 256, qualidade = 0.8) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    leitor.onload = () => {
      const imagem = new Image();
      imagem.onerror = () => reject(new Error("Arquivo não é uma imagem válida."));
      imagem.onload = () => {
        const escala = Math.min(1, ladoMaximo / Math.max(imagem.width, imagem.height));
        const largura = Math.round(imagem.width * escala);
        const altura = Math.round(imagem.height * escala);

        const canvas = document.createElement("canvas");
        canvas.width = largura;
        canvas.height = altura;
        canvas.getContext("2d").drawImage(imagem, 0, 0, largura, altura);

        resolve(canvas.toDataURL("image/jpeg", qualidade));
      };
      imagem.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  });
}

function definirPreviewFoto(dataUrl) {
  const preview = document.getElementById("preview-foto-perfil");
  const vazio = document.getElementById("avatar-vazio");
  const btnRemover = document.getElementById("btn-remover-foto");
  document.getElementById("nova-foto-perfil").value = dataUrl || "";

  // Sanitizar URL (data URLs de preview são permitidos, http/https também)
  const urlSegura = dataUrl && (dataUrl.startsWith("data:") || sanitizarUrl(dataUrl)) ? dataUrl : "";

  if (urlSegura) {
    preview.src = urlSegura;
    preview.style.display = "block";
    vazio.style.display = "none";
    btnRemover.style.display = "inline-block";
  } else {
    preview.src = "";
    preview.style.display = "none";
    vazio.style.display = "flex";
    btnRemover.style.display = "none";
  }
}

// --- FORMULÁRIO DE USUÁRIO (criar E editar no mesmo formulário) ---
function configurarFormularioUsuario() {
  const form = document.getElementById("form-perfil-usuario");
  const btnCancelar = document.getElementById("btn-cancelar-edicao");
  const inputFoto = document.getElementById("input-foto-perfil");
  const btnRemoverFoto = document.getElementById("btn-remover-foto");

  if (!form) return;

  btnCancelar?.addEventListener("click", () => sairModoEdicaoUsuario());

  inputFoto?.addEventListener("change", async () => {
    const arquivo = inputFoto.files[0];
    if (!arquivo) return;
    try {
      const dataUrl = await comprimirImagemParaBase64(arquivo);
      definirPreviewFoto(dataUrl);
    } catch (erro) {
      await mostrarAviso("Não foi possível usar essa imagem. Tente outra foto.");
    } finally {
      inputFoto.value = "";
    }
  });

  btnRemoverFoto?.addEventListener("click", () => definirPreviewFoto(null));

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const idEdicao = document.getElementById("usuario-editando-id").value;
    const nome = document.getElementById("novo-nome").value.trim();
    const usuario = document.getElementById("novo-usuario").value.trim();
    const email = document.getElementById("novo-email").value.trim();
    const telefone = document.getElementById("novo-telefone").value.trim();
    const salario = parseFloat(document.getElementById("novo-salario").value) || 0;
    const fotoPerfil = document.getElementById("nova-foto-perfil").value;
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
      const corpo = { nome, usuario, email, telefone, salario, perfil, foto_perfil: fotoPerfil };
      if (senha) corpo.senha = senha;

      if (idEdicao) {
        resposta = await fetch(`${API_URL}/api/usuarios?id=${idEdicao}`, {
          method: "PUT",
          headers: headersAutenticados(),
          body: JSON.stringify(corpo),
        });
      } else {
        resposta = await fetch(`${API_URL}/api/usuarios`, {
          method: "POST",
          headers: headersAutenticados(),
          body: JSON.stringify(corpo),
        });
      }

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        sairModoEdicaoUsuario();
        carregarUsuarios();
        if (idEdicao) {
          const usuarioLogado = obterUsuarioLogado();
          if (String(idEdicao) === String(usuarioLogado.id)) {
            const dadosAtualizados = { ...usuarioLogado };
            if (nome) dadosAtualizados.nome = nome;
            if (fotoPerfil !== undefined) dadosAtualizados.foto_perfil = fotoPerfil || null;
            if (email !== undefined) dadosAtualizados.email = email;
            if (telefone !== undefined) dadosAtualizados.telefone = telefone;
            if (salario !== undefined) dadosAtualizados.salario = salario;
            const token = obterToken();
            sessaoMemoria.usuario = dadosAtualizados;
            sessionStorage.setItem("sessao", JSON.stringify({ token, usuario: dadosAtualizados }));
            atualizarAvatarTopo(dadosAtualizados);
          }
        }
        mostrarToast(idEdicao ? "Usuário atualizado" : "Usuário criado");
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

// --- SISTEMA DE CONVITES ---
function configurarSistemaConvites() {
  const btnConvidar = document.getElementById("btn-convidar-usuario");
  const modalConvite = document.getElementById("modal-convite");
  const formConvite = document.getElementById("form-convite");
  const btnFecharModal = document.getElementById("btn-fechar-modal-convite");
  const divResultado = document.getElementById("convite-resultado");
  const btnCopiar = document.getElementById("btn-copiar-convite");
  const btnFecharResultado = document.getElementById("btn-fechar-convite-resultado");

  if (!btnConvidar) return;

  btnConvidar.addEventListener("click", () => {
    modalConvite.style.display = "flex";
    formConvite.style.display = "block";
    divResultado.style.display = "none";
    formConvite.reset();
  });

  btnFecharModal?.addEventListener("click", () => {
    modalConvite.style.display = "none";
  });

  formConvite?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = document.getElementById("convite-nome").value.trim();
    const email = document.getElementById("convite-email").value.trim();
    const perfil = document.getElementById("convite-perfil").value;
    const btnGerar = document.getElementById("btn-gerar-convite");

    if (!nome || !email) {
      await mostrarAviso("Preencha nome e e-mail.");
      return;
    }

    btnGerar.disabled = true;
    btnGerar.innerText = "Gerando...";

    try {
      const resposta = await fetch(`${API_URL}/api/convites`, {
        method: "POST",
        headers: headersAutenticados(),
        body: JSON.stringify({ nome, email, perfil }),
      });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        const dados = await resposta.json();
        const linkCompleto = `${window.location.origin}?token=${dados.token}`;
        document.getElementById("convite-link").value = linkCompleto;
        formConvite.style.display = "none";
        divResultado.style.display = "block";
        mostrarToast("Convite gerado com sucesso!");
      } else {
        const erro = await resposta.json();
        await mostrarAviso(`Erro: ${erro.erro}`);
      }
    } catch (erro) {
      await mostrarAviso("Erro de conexão ao gerar convite.");
    } finally {
      btnGerar.disabled = false;
      btnGerar.innerText = "Gerar convite";
    }
  });

  btnCopiar?.addEventListener("click", async () => {
    const link = document.getElementById("convite-link").value;
    try {
      await navigator.clipboard.writeText(link);
      mostrarToast("Link copiado!");
    } catch {
      document.getElementById("convite-link").select();
      document.execCommand("copy");
      mostrarToast("Link copiado!");
    }
  });

  btnFecharResultado?.addEventListener("click", () => {
    modalConvite.style.display = "none";
  });
}

// --- CADASTRO POR CONVITE (página pública) ---
function verificarCadastroConvite() {
  const token = new URLSearchParams(window.location.search).get("token");
  if (!token) return false;

  const sLogin = document.getElementById("login-section");
  const sCadastro = document.getElementById("cadastro-section");
  const sDash = document.getElementById("dashboard-section");
  const sAdmin = document.getElementById("admin-section");

  if (sLogin) sLogin.style.display = "none";
  if (sDash) sDash.style.display = "none";
  if (sAdmin) sAdmin.style.display = "none";
  if (sCadastro) sCadastro.style.display = "flex";

  document.getElementById("cadastro-token").value = token;

  carregarInfoConvite(token);
  configurarFormularioCadastroConvite(token);

  return true;
}

async function carregarInfoConvite(token) {
  const infoEl = document.getElementById("cadastro-convite-info");
  try {
    const resposta = await fetch(`${API_URL}/api/convites?token=${token}`);
    if (resposta.ok) {
      const dados = await resposta.json();
      infoEl.innerHTML = `Olá, <strong>${dados.nome}</strong>! Você foi convidado(a) para usar o Gestor Financeiro.<br>Crie sua senha para acessar.`;
      document.getElementById("cadastro-nome").value = dados.nome;
    } else {
      const erro = await resposta.json();
      infoEl.innerHTML = `<span class="erro-convite">${erro.erro}</span>`;
      document.getElementById("form-cadastro-convite").style.display = "none";
    }
  } catch {
    infoEl.innerHTML = '<span class="erro-convite">Erro ao validar convite.</span>';
  }
}

function configurarFormularioCadastroConvite(token) {
  const form = document.getElementById("form-cadastro-convite");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = document.getElementById("cadastro-nome").value.trim();
    const usuario = document.getElementById("cadastro-usuario").value.trim();
    const senha = document.getElementById("cadastro-senha").value;
    const confirmarSenha = document.getElementById("cadastro-confirmar-senha").value;
    const btnCriar = form.querySelector("button[type='submit']");
    const erroEl = document.getElementById("cadastro-erro");

    function mostrarErro(msg) {
      erroEl.textContent = msg;
      erroEl.style.display = "block";
    }

    if (!usuario) {
      mostrarErro("Escolha um nome de usuário.");
      return;
    }

    if (senha !== confirmarSenha) {
      mostrarErro("As senhas não coincidem.");
      return;
    }

    if (senha.length < 6) {
      mostrarErro("A senha deve ter ao menos 6 caracteres.");
      return;
    }

    erroEl.style.display = "none";
    btnCriar.disabled = true;
    btnCriar.innerText = "Criando conta...";

    try {
      const resposta = await fetch(`${API_URL}/api/convites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, senha, nome, usuario }),
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        mostrarErro("");
        erroEl.style.display = "none";
        form.innerHTML = `<p class="sucesso-convite">Conta criada com sucesso!<br>Seu login: <strong>${dados.usuario}</strong><br><a href="/">Fazer login</a></p>`;
      } else {
        mostrarErro(dados.erro || "Erro ao criar conta.");
      }
    } catch {
      mostrarErro("Erro de conexão. Tente novamente.");
    } finally {
      btnCriar.disabled = false;
      btnCriar.innerText = "Criar conta";
    }
  });
}

function entrarModoEdicaoUsuario(usuario) {
  const secaoAdmin = document.getElementById("admin-section");
  const secaoDash = document.getElementById("dashboard-section");
  if (secaoAdmin && secaoDash) {
    secaoDash.style.display = "none";
    secaoAdmin.style.display = "flex";
    secaoAdmin.style.flexDirection = "column";
  }
  document.querySelectorAll(".settings-nav-item").forEach((t) => t.classList.remove("ativo"));
  const navPerfil = document.querySelector('[data-settings-painel="sp-perfil"]');
  if (navPerfil) navPerfil.classList.add("ativo");
  document.querySelectorAll(".settings-painel").forEach((p) => (p.style.display = "none"));
  const painelPerfil = document.getElementById("sp-perfil");
  if (painelPerfil) painelPerfil.style.display = "block";

  document.getElementById("usuario-editando-id").value = usuario.id;
  document.getElementById("novo-nome").value = usuario.nome || "";
  document.getElementById("novo-usuario").value = usuario.nome_usuario;
  document.getElementById("novo-email").value = usuario.email || "";
  document.getElementById("novo-telefone").value = usuario.telefone || "";
  document.getElementById("novo-salario").value = usuario.salario || "";
  document.getElementById("nova-senha").value = "";
  document.getElementById("novo-perfil").value = usuario.perfil;
  definirPreviewFoto(usuario.foto_perfil || null);
  document.getElementById("dica-senha").style.display = "inline-block";
  document.getElementById("btn-salvar-usuario").innerText = "Salvar edição";
  document.getElementById("btn-cancelar-edicao").style.display = "inline-block";
  document.getElementById("sp-perfil").scrollIntoView({ behavior: "smooth", block: "start" });
}

function sairModoEdicaoUsuario() {
  const form = document.getElementById("form-perfil-usuario");
  if (form) form.reset();
  document.getElementById("usuario-editando-id").value = "";
  definirPreviewFoto(null);
  document.getElementById("dica-senha").style.display = "none";
  document.getElementById("titulo-form-usuario").innerText = "Perfil";
  document.getElementById("btn-salvar-usuario").innerText = "Salvar alterações";
  document.getElementById("btn-cancelar-edicao").style.display = "none";
}


async function carregarUsuarios() {
  const container = document.getElementById("lista-usuarios");
  const badge = document.getElementById("badge-usuarios");
  const campoBusca = document.getElementById("busca-usuarios");
  if (!container) return;

  container.innerHTML = '<div class="estado-vazio-admin"><div class="icone-vazio">👤</div><p>Carregando usuários...</p></div>';

  try {
    const resposta = await fetch(`${API_URL}/api/usuarios`, { headers: headersAutenticados(false) });
    if (tratarSessaoExpirada(resposta)) return;
    const dados = await resposta.json();

    if (badge) badge.textContent = dados.length;
    container.innerHTML = "";

    if (dados.length === 0) {
      container.innerHTML = '<div class="estado-vazio-admin"><div class="icone-vazio">👤</div><p>Nenhum usuário cadastrado.</p></div>';
      return;
    }

    const usuarioLogado = obterUsuarioLogado();

    function renderizarListaUsuarios(filtro) {
      container.innerHTML = "";
      const termo = (filtro || "").toLowerCase();
      const filtrados = termo ? dados.filter((u) => {
        const texto = `${u.nome || ""} ${u.nome_usuario || ""} ${u.email || ""}`.toLowerCase();
        return texto.includes(termo);
      }) : dados;

      if (filtrados.length === 0) {
        container.innerHTML = '<div class="estado-vazio-admin"><div class="icone-vazio">🔍</div><p>Nenhum usuário encontrado para "' + escaparHtml(termo) + '"</p></div>';
        return;
      }

      filtrados.forEach((user) => {
        const ehVoceMesmo = user.id === usuarioLogado.id;
        const ehAtivo = user.ativo !== 0;

        const div = document.createElement("div");
        div.className = "linha-item linha-usuario" + (ehAtivo ? "" : " linha-inativa");
        const fotoSegura = sanitizarUrl(user.foto_perfil);
        const avatarHtml = fotoSegura
          ? `<img class="avatar-lista" src="${fotoSegura}" alt="" />`
          : `<div class="avatar-lista avatar-vazio">${escaparHtml((user.nome || user.nome_usuario).charAt(0).toUpperCase())}</div>`;
        div.innerHTML = `
          ${avatarHtml}
          <div class="item-info-principal linha-usuario-info">
            <div class="linha-usuario-nome-linha">
              <span class="item-descricao">${escaparHtml(user.nome || user.nome_usuario)}${ehVoceMesmo ? " (você)" : ""}</span>
              <span class="item-status status-pago">${escaparHtml(user.perfil.toUpperCase())}</span>
            </div>
            <span class="linha-usuario-detalhe">@${escaparHtml(user.nome_usuario)}${user.email ? ` · ${escaparHtml(user.email)}` : ""}</span>
            <span class="linha-usuario-detalhe">
              Criado em ${formatarDataHora(user.criado_em)}${user.ultimo_acesso ? ` · Último acesso: ${formatarDataHora(user.ultimo_acesso)}` : " · Nunca acessou"}
            </span>
          </div>
          <div class="item-valores">
            <button type="button" class="btn-toggle-ativo ${ehAtivo ? "ativo" : "inativo"}" data-id="${user.id}" ${ehVoceMesmo ? "disabled title='Você não pode desativar a própria conta'" : ""}>${ehAtivo ? "Ativo" : "Inativo"}</button>
            <button type="button" class="btn-editar-usuario" data-id="${user.id}">Editar</button>
            <button type="button" class="btn-excluir-conta" data-id="${user.id}" ${ehVoceMesmo ? "disabled" : ""} title="${ehVoceMesmo ? "Você não pode excluir a própria conta" : "Excluir usuário"}">Excluir</button>
          </div>
        `;
        container.appendChild(div);
      });

      container.querySelectorAll(".btn-toggle-ativo").forEach((btn) => {
        btn.addEventListener("click", () => alternarStatusUsuario(Number(btn.dataset.id), btn));
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
    }

    renderizarListausuarios = renderizarListaUsuarios;
    renderizarListaUsuarios("");

    if (campoBusca) {
      campoBusca.oninput = () => renderizarListaUsuarios(campoBusca.value);
    }
  } catch (erro) {
    container.innerHTML = '<div class="estado-vazio-admin" style="color: var(--cor-despesa);"><div class="icone-vazio">⚠️</div><p>Erro ao carregar usuários.</p></div>';
  }
}

async function alternarStatusUsuario(id, botao) {
  const ehAtivo = botao.classList.contains("ativo");
  const acao = ehAtivo ? "desativar" : "ativar";
  const msg = ehAtivo
    ? "Desativar esta conta? O usuário não conseguirá mais fazer login."
    : "Reativar esta conta? O usuário poderá fazer login novamente.";

  if (!(await pedirConfirmacao(msg, { textoConfirmar: ehAtivo ? "Desativar" : "Ativar", perigo: ehAtivo }))) return;

  botao.disabled = true;
  botao.innerText = "Alterando...";

  try {
    const resposta = await fetch(`${API_URL}/api/usuarios?id=${id}`, {
      method: "PATCH",
      headers: headersAutenticados(false),
    });

    if (tratarSessaoExpirada(resposta)) return;

    if (resposta.ok) {
      carregarUsuarios();
      mostrarToast(resposta.ok ? `Usuário ${acao === "ativar" ? "ativado" : "desativado"}` : "Erro");
    } else {
      const erro = await resposta.json();
      await mostrarAviso(`Não foi possível ${acao}: ${erro.erro}`);
      botao.disabled = false;
      botao.innerText = ehAtivo ? "Ativo" : "Inativo";
    }
  } catch (erro) {
    await mostrarAviso("Erro ao se conectar com o servidor.");
    botao.disabled = false;
    botao.innerText = ehAtivo ? "Ativo" : "Inativo";
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
      mostrarToast("Usuário excluído", "info");
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
        mostrarToast("Categoria criada");
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
  const badge = document.getElementById("badge-categorias");
  const campoBusca = document.getElementById("busca-categorias");
  if (!container) return;

  container.innerHTML = '<div class="estado-vazio-admin"><div class="icone-vazio">🏷️</div><p>Carregando categorias...</p></div>';

  try {
    const resposta = await fetch(`${API_URL}/api/categorias`, { headers: headersAutenticados(false) });
    if (tratarSessaoExpirada(resposta)) return;
    const categorias = await resposta.json();

    if (badge) badge.textContent = categorias.length;
    container.innerHTML = "";

    if (categorias.length === 0) {
      container.innerHTML = '<div class="estado-vazio-admin"><div class="icone-vazio">🏷️</div><p>Nenhuma categoria cadastrada.<br>Crie a primeira acima.</p></div>';
      return;
    }

    function renderizarListaCategorias(filtro) {
      container.innerHTML = "";
      const termo = (filtro || "").toLowerCase();
      const filtradas = termo ? categorias.filter((c) => c.nome.toLowerCase().includes(termo)) : categorias;

      if (filtradas.length === 0) {
        container.innerHTML = '<div class="estado-vazio-admin"><div class="icone-vazio">🔍</div><p>Nenhuma categoria encontrada para "' + escaparHtml(termo) + '"</p></div>';
        return;
      }

      filtradas.forEach((cat) => {
        const div = document.createElement("div");
        div.className = "linha-item linha-usuario";
        div.innerHTML = `
          <div class="item-info-principal linha-usuario-info">
            <span class="item-descricao">${escaparHtml(cat.nome)}</span>
          </div>
          <div class="item-valores">
            <button type="button" class="btn-editar-usuario" data-id="${cat.id}" data-nome="${escaparHtml(cat.nome)}" title="Renomear categoria">Editar</button>
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
    }

    renderizarListaCategorias("");
    if (campoBusca) {
      campoBusca.oninput = () => renderizarListaCategorias(campoBusca.value);
    }
  } catch (erro) {
    container.innerHTML = '<div class="estado-vazio-admin" style="color: var(--cor-despesa);"><div class="icone-vazio">⚠️</div><p>Erro ao carregar categorias.</p></div>';
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
      mostrarToast("Categoria excluída", "info");
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

// ==========================================
// [29] EXPORTAÇÃO GLOBAL
// ==========================================

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
  trapFoco(modal);
}

function configurarModalRenomearCategoria() {
  const modal = document.getElementById("modal-renomear-categoria");
  const form = document.getElementById("form-renomear-categoria");
  const btnFechar = document.getElementById("btn-fechar-modal-renomear-categoria");

  if (!modal || !form || !btnFechar) return;

  btnFechar.addEventListener("click", () => {
    modal.style.display = "none";
    liberarFoco();
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
        liberarFoco();
        carregarListaCategorias();
        mostrarToast("Categoria renomeada");
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

/* ======================== RELATÓRIOS FINANCEIROS ======================== */
let relatorioDados = { lancamentos: [], periodo: {}, filtros: {} };
const relatorioPagina = { atual: 1, porPagina: 20 };
const CORES_GRAFICO = ["#2e7d32","#c62828","#1565c0","#e65100","#6a1b9a","#00838f","#4e342e","#ad1457","#827717","#00695c","#d84315","#283593"];

function configurarRelatorios() {
  const btnRel = document.getElementById("btn-relatorios");
  const btnVoltar = document.getElementById("btn-voltar-dashboard-relatorio");
  const secaoDash = document.getElementById("dashboard-section");
  const secaoRel = document.getElementById("relatorios-section");

  if (btnRel) {
    btnRel.addEventListener("click", () => {
      secaoDash.style.display = "none";
      secaoRel.style.display = "flex";
      secaoRel.style.flexDirection = "column";
      inicializarFiltrosRelatorio();
      carregarDadosRelatorio();
    });
  }
  if (btnVoltar) {
    btnVoltar.addEventListener("click", () => {
      secaoRel.style.display = "none";
      secaoDash.style.display = "block";
      carregarLancamentos();
    });
  }

  configurarTabsRelatorio();
  configurarPeriodoRelatorio();
  configurarExportarRelatorio();
}

function configurarTabsRelatorio() {
  document.querySelectorAll(".relatorio-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".relatorio-tab").forEach((t) => t.classList.remove("ativo"));
      document.querySelectorAll(".relatorio-painel").forEach((p) => (p.style.display = "none"));
      tab.classList.add("ativo");
      const painel = document.getElementById(tab.dataset.painel);
      if (painel) painel.style.display = "block";
    });
  });
}

function configurarPeriodoRelatorio() {
  const sel = document.getElementById("relatorio-periodo");
  const grupoData = document.querySelector(".relatorio-periodo-personalizado");
  if (sel) {
    sel.addEventListener("change", () => {
      if (grupoData) grupoData.style.display = sel.value === "personalizado" ? "flex" : "none";
      carregarDadosRelatorio();
    });
  }
  const dtInicio = document.getElementById("relatorio-data-inicio");
  const dtFim = document.getElementById("relatorio-data-fim");
  if (dtInicio) dtInicio.addEventListener("change", carregarDadosRelatorio);
  if (dtFim) dtFim.addEventListener("change", carregarDadosRelatorio);

  ["relatorio-filtro-carteira", "relatorio-filtro-categoria", "relatorio-filtro-tipo"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", carregarDadosRelatorio);
  });
}

function inicializarFiltrosRelatorio() {
  popularSelectRelatorio("relatorio-filtro-carteira", "carteiras", "Todas");
  popularSelectRelatorio("relatorio-filtro-categoria", "categorias", "Todas");
}

function popularSelectRelatorio(selectId, tipo, labelPadrao) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const valorAtual = sel.value;
  sel.innerHTML = `<option value="">${labelPadrao}</option>`;
  const dados = tipo === "carteiras" ? (typeof carteirasCarregadas !== "undefined" ? carteirasCarregadas : []) :
    tipo === "categorias" ? (typeof categoriasCarregadas !== "undefined" ? categoriasCarregadas.map((c) => ({ id: c, nome: c })) : []) : [];
  dados.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = tipo === "categorias" ? d.nome || d : d.id;
    opt.textContent = tipo === "categorias" ? (d.nome || d) : (d.nome || d.id);
    sel.appendChild(opt);
  });
  sel.value = valorAtual;
}

function obterPeriodoRelatorio() {
  const sel = document.getElementById("relatorio-periodo");
  const tipo = sel ? sel.value : "mes";
  const hoje = new Date();
  let inicio, fim;

  switch (tipo) {
    case "hoje":
      inicio = fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      break;
    case "semana": {
      const dia = hoje.getDay();
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - dia);
      fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + (6 - dia));
      break;
    }
    case "mes":
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      break;
    case "3meses":
      inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
      fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      break;
    case "6meses":
      inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
      fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      break;
    case "ano":
      inicio = new Date(hoje.getFullYear(), 0, 1);
      fim = new Date(hoje.getFullYear(), 11, 31);
      break;
    case "personalizado": {
      const di = document.getElementById("relatorio-data-inicio");
      const df = document.getElementById("relatorio-data-fim");
      inicio = di && di.value ? new Date(di.value + "T12:00:00") : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      fim = df && df.value ? new Date(df.value + "T12:00:00") : hoje;
      break;
    }
    default:
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  }

  return {
    inicio: inicio.toISOString().split("T")[0],
    fim: fim.toISOString().split("T")[0],
    inicioDate: inicio,
    fimDate: fim,
    tipo
  };
}

async function carregarDadosRelatorio() {
  const periodo = obterPeriodoRelatorio();
  const filtroCarteira = document.getElementById("relatorio-filtro-carteira")?.value || "";
  const filtroCategoria = document.getElementById("relatorio-filtro-categoria")?.value || "";
  const filtroTipo = document.getElementById("relatorio-filtro-tipo")?.value || "";

  const usuario = obterUsuarioLogado();
  const params = new URLSearchParams({
    data_inicio: periodo.inicio,
    data_fim: periodo.fim,
    usuario_id: usuario.id
  });
  if (filtroCarteira) params.set("carteira_id", filtroCarteira);
  if (filtroCategoria) params.set("categoria", filtroCategoria);
  if (filtroTipo) params.set("tipo", filtroTipo);

  try {
    const resposta = await fetch(`${API_URL}/api/lancamentos?${params}`, { headers: headersAutenticados() });
    if (tratarSessaoExpirada(resposta)) return;
    if (!resposta.ok) throw new Error("Erro ao carregar");
    relatorioDados.lancamentos = await resposta.json();
    relatorioDados.periodo = periodo;
    relatorioDados.filtros = { filtroCarteira, filtroCategoria, filtroTipo };

    renderizarRelatorioCompleto();
  } catch (erro) {
    mostrarToast("Erro ao carregar dados do relatório", "erro");
  }
}

function renderizarRelatorioCompleto() {
  const { lancamentos, periodo } = relatorioDados;
  const mesAnterior = obterPeriodoMesAnterior(periodo);

  renderizarKPIsRelatorio(lancamentos, mesAnterior);
  renderizarFluxoCaixa(lancamentos, periodo);
  renderizarBarrasReceitasDespesas(lancamentos, periodo);
  renderizarDonutCategorias(lancamentos);
  renderizarIndicadoresFinanceiros(lancamentos, periodo);
  renderizarEvolucaoCategorias(lancamentos, periodo);
  renderizarRankingCategorias(lancamentos);
  renderizarTabelaContas(lancamentos);
  renderizarTabelaFormasPagamento(lancamentos);
  renderizarMaioresDespesas(lancamentos);
  renderizarMaioresReceitas(lancamentos);
  renderizarRecorrentesRelatorio(lancamentos);
  renderizarComparativoPeriodos(lancamentos, mesAnterior);
  renderizarMetasRelatorio();
  renderizarInsights(lancamentos, mesAnterior);
  renderizarTabelaTransacoes(lancamentos);
}

function obterPeriodoMesAnterior(periodo) {
  const ini = new Date(periodo.inicioDate);
  const fim = new Date(periodo.fimDate);
  const diff = Math.round((fim - ini) / (1000 * 60 * 60 * 24)) + 1;
  const antInicio = new Date(ini);
  antInicio.setDate(antInicio.getDate() - diff);
  const antFim = new Date(ini);
  antFim.setDate(antFim.getDate() - 1);
  return { inicio: antInicio.toISOString().split("T")[0], fim: antFim.toISOString().split("T")[0] };
}

async function carregarLancamentosPeriodo(inicio, fim) {
  const usuario = obterUsuarioLogado();
  const params = new URLSearchParams({ data_inicio: inicio, data_fim: fim, usuario_id: usuario.id });
  try {
    const resposta = await fetch(`${API_URL}/api/lancamentos?${params}`, { headers: headersAutenticados() });
    if (!resposta.ok) return [];
    return await resposta.json();
  } catch { return []; }
}

/* --- KPIs --- */
function renderizarKPIsRelatorio(lancamentos, mesAnterior) {
  const receitas = lancamentos.filter((l) => l.tipo === "receita").reduce((s, l) => s + (l.valor || 0), 0);
  const despesas = lancamentos.filter((l) => l.tipo === "despesa").reduce((s, l) => s + (l.valor || 0), 0);
  const saldo = receitas - despesas;
  const economia = receitas > 0 ? Math.round((saldo / receitas) * 100) : 0;

  const el = (id) => document.getElementById(id);
  if (el("rel-kpi-receitas")) el("rel-kpi-receitas").textContent = formatadorBRL.format(receitas);
  if (el("rel-kpi-despesas")) el("rel-kpi-despesas").textContent = formatadorBRL.format(despesas);
  if (el("rel-kpi-saldo")) {
    el("rel-kpi-saldo").textContent = formatadorBRL.format(saldo);
    el("rel-kpi-saldo").style.color = saldo >= 0 ? "var(--cor-receita)" : "var(--cor-despesa)";
  }
  if (el("rel-kpi-economia")) el("rel-kpi-economia").textContent = `${economia}%`;

  // Maior gasto
  const porCategoria = {};
  lancamentos.filter((l) => l.tipo === "despesa").forEach((l) => {
    porCategoria[l.categoria] = (porCategoria[l.categoria] || 0) + (l.valor || 0);
  });
  const maior = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0];
  if (el("rel-kpi-maior-gasto") && maior) {
    el("rel-kpi-maior-gasto").textContent = maior[0];
    el("rel-kpi-maior-gasto-valor").textContent = formatadorBRL.format(maior[1]);
  }

  if (el("rel-kpi-transacoes")) el("rel-kpi-transacoes").textContent = lancamentos.length;

  // Tendências
  carregarLancamentosPeriodo(mesAnterior.inicio, mesAnterior.fim).then((ant) => {
    const recAnt = ant.filter((l) => l.tipo === "receita").reduce((s, l) => s + (l.valor || 0), 0);
    const despAnt = ant.filter((l) => l.tipo === "despesa").reduce((s, l) => s + (l.valor || 0), 0);
    if (el("rel-kpi-receitas-tendencia") && recAnt > 0) {
      const pct = ((receitas - recAnt) / recAnt * 100).toFixed(0);
      const cls = pct >= 0 ? "tendencia-positiva" : "tendencia-negativa";
      el("rel-kpi-receitas-tendencia").textContent = `${pct >= 0 ? "↑" : "↓"} ${Math.abs(pct)}%`;
      el("rel-kpi-receitas-tendencia").className = `rel-kpi-tendencia ${cls}`;
    }
    if (el("rel-kpi-despesas-tendencia") && despAnt > 0) {
      const pct = ((despesas - despAnt) / despAnt * 100).toFixed(0);
      const cls = pct <= 0 ? "tendencia-positiva" : "tendencia-negativa";
      el("rel-kpi-despesas-tendencia").textContent = `${pct >= 0 ? "↑" : "↓"} ${Math.abs(pct)}%`;
      el("rel-kpi-despesas-tendencia").className = `rel-kpi-tendencia ${cls}`;
    }
  });
}

/* --- Fluxo de Caixa (SVG) --- */
function renderizarFluxoCaixa(lancamentos, periodo) {
  const container = document.getElementById("rel-grafico-fluxo");
  if (!container) return;

  const meses = obterMesesPeriodo(periodo);
  const dados = meses.map((m) => {
    const rec = lancamentos.filter((l) => l.tipo === "receita" && l.data_compra?.startsWith(m.key)).reduce((s, l) => s + (l.valor || 0), 0);
    const desp = lancamentos.filter((l) => l.tipo === "despesa" && l.data_compra?.startsWith(m.key)).reduce((s, l) => s + (l.valor || 0), 0);
    return { ...m, receitas: rec, despesas: desp, saldo: rec - desp };
  });

  if (dados.length < 2) { container.innerHTML = '<div class="plano-vazio">Período muito curto para gráfico.</div>'; return; }

  const W = 600, H = 200, P = 40;
  const vals = dados.flatMap((d) => [d.receitas, d.despesas, d.saldo]);
  const maxV = Math.max(...vals, 1);
  const minV = Math.min(...vals, 0);
  const escala = (v) => P + ((v - minV) / (maxV - minV || 1)) * (H - 2 * P);
  const x = (i) => P + (i / (dados.length - 1)) * (W - 2 * P);

  const pathRec = dados.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${escala(d.receitas)}`).join(" ");
  const pathDesp = dados.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${escala(d.despesas)}`).join(" ");
  const pathSaldo = dados.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${escala(d.saldo)}`).join(" ");

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<line x1="${P}" y1="${escala(0)}" x2="${W - P}" y2="${escala(0)}" stroke="var(--cor-pauta-fraca)" stroke-dasharray="4"/>`;
  dados.forEach((d, i) => {
    svg += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" fill="var(--cor-texto-suave)" font-size="10">${d.label}</text>`;
  });
  svg += `<path d="${pathRec}" fill="none" stroke="var(--cor-receita)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  svg += `<path d="${pathDesp}" fill="none" stroke="var(--cor-despesa)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  svg += `<path d="${pathSaldo}" fill="none" stroke="var(--cor-marca)" stroke-width="2" stroke-dasharray="6,3" stroke-linecap="round" stroke-linejoin="round"/>`;
  dados.forEach((d, i) => {
    svg += `<circle cx="${x(i)}" cy="${escala(d.receitas)}" r="3.5" fill="var(--cor-receita)"/>`;
    svg += `<circle cx="${x(i)}" cy="${escala(d.despesas)}" r="3.5" fill="var(--cor-despesa)"/>`;
  });
  svg += `<text x="${W - P + 5}" y="${escala(dados[dados.length - 1]?.receitas || 0) + 4}" fill="var(--cor-receita)" font-size="9">Receitas</text>`;
  svg += `<text x="${W - P + 5}" y="${escala(dados[dados.length - 1]?.despesas || 0) + 4}" fill="var(--cor-despesa)" font-size="9">Despesas</text>`;
  svg += `<text x="${W - P + 5}" y="${escala(dados[dados.length - 1]?.saldo || 0) + 4}" fill="var(--cor-marca)" font-size="9">Saldo</text>`;
  svg += `</svg>`;
  container.innerHTML = svg;
}

/* --- Barras Receitas × Despesas --- */
function renderizarBarrasReceitasDespesas(lancamentos, periodo) {
  const container = document.getElementById("rel-grafico-barras");
  if (!container) return;

  const meses = obterMesesPeriodo(periodo);
  const dados = meses.map((m) => {
    const rec = lancamentos.filter((l) => l.tipo === "receita" && l.data_compra?.startsWith(m.key)).reduce((s, l) => s + (l.valor || 0), 0);
    const desp = lancamentos.filter((l) => l.tipo === "despesa" && l.data_compra?.startsWith(m.key)).reduce((s, l) => s + (l.valor || 0), 0);
    return { ...m, receitas: rec, despesas: desp };
  });

  const maxV = Math.max(...dados.flatMap((d) => [d.receitas, d.despesas]), 1);
  const W = 600, H = 180, P = 40;
  const barW = Math.min(30, (W - 2 * P) / (dados.length * 3));
  const centro = (i) => P + (i + 0.5) * ((W - 2 * P) / dados.length);

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<line x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}" stroke="var(--cor-pauta-fraca)"/>`;
  dados.forEach((d, i) => {
    const cx = centro(i);
    const hRec = (d.receitas / maxV) * (H - 2 * P);
    const hDesp = (d.despesas / maxV) * (H - 2 * P);
    svg += `<rect x="${cx - barW - 1}" y="${H - P - hRec}" width="${barW}" height="${hRec}" fill="var(--cor-receita)" rx="2"/>`;
    svg += `<rect x="${cx + 1}" y="${H - P - hDesp}" width="${barW}" height="${hDesp}" fill="var(--cor-despesa)" rx="2"/>`;
    svg += `<text x="${cx}" y="${H - 8}" text-anchor="middle" fill="var(--cor-texto-suave)" font-size="9">${d.label}</text>`;
  });
  svg += `</svg>`;
  container.innerHTML = svg;
}

/* --- Donut Categorias --- */
function renderizarDonutCategorias(lancamentos) {
  const svgEl = document.getElementById("rel-donut-svg");
  const legEl = document.getElementById("rel-donut-legenda");
  if (!svgEl || !legEl) return;

  const despesas = lancamentos.filter((l) => l.tipo === "despesa");
  if (despesas.length === 0) { svgEl.innerHTML = '<div class="plano-vazio">Sem despesas no período.</div>'; legEl.innerHTML = ""; return; }

  const porCategoria = {};
  despesas.forEach((l) => { porCategoria[l.categoria] = (porCategoria[l.categoria] || 0) + (l.valor || 0); });
  const total = Object.values(porCategoria).reduce((s, v) => s + v, 0);
  const categorias = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);

  const R = 70, cx = 90, cy = 90, stroke = 24;
  let svg = `<svg width="180" height="180" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">`;
  let angulo = -90;
  categorias.forEach(([nome, valor], i) => {
    const pct = valor / total;
    const comprimento = pct * 2 * Math.PI * R;
    const cor = CORES_GRAFICO[i % CORES_GRAFICO.length];
    svg += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${cor}" stroke-width="${stroke}" stroke-dasharray="${comprimento} ${2 * Math.PI * R}" stroke-dashoffset="${-angulo * Math.PI * R / 180}" transform="rotate(0 ${cx} ${cy})"/>`;
    angulo += pct * 360;
  });
  svg += `<text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="var(--cor-texto)" font-size="13" font-weight="700">${formatadorBRL.format(total)}</text>`;
  svg += `<text x="${cx}" y="${cy + 10}" text-anchor="middle" fill="var(--cor-texto-suave)" font-size="9">Total</text>`;
  svg += `</svg>`;
  svgEl.innerHTML = svg;

  legEl.innerHTML = categorias.map(([nome, valor], i) => {
    const pct = ((valor / total) * 100).toFixed(1);
    const cor = CORES_GRAFICO[i % CORES_GRAFICO.length];
    return `<div class="rel-donut-item"><span class="rel-donut-cor" style="background:${cor}"></span><span class="rel-donut-nome">${escaparHtml(nome)}</span><span class="rel-donut-pct">${pct}%</span><span class="rel-donut-valor">${formatadorBRL.format(valor)}</span></div>`;
  }).join("");
}

/* --- Indicadores Financeiros --- */
function renderizarIndicadoresFinanceiros(lancamentos, periodo) {
  const container = document.getElementById("rel-indicadores");
  if (!container) return;

  const rec = lancamentos.filter((l) => l.tipo === "receita");
  const desp = lancamentos.filter((l) => l.tipo === "despesa");
  const totalRec = rec.reduce((s, l) => s + (l.valor || 0), 0);
  const totalDesp = desp.reduce((s, l) => s + (l.valor || 0), 0);
  const meses = Math.max(1, obterMesesPeriodo(periodo).length);
  const ticketRec = rec.length > 0 ? totalRec / rec.length : 0;
  const ticketDesp = desp.length > 0 ? totalDesp / desp.length : 0;
  const diasNegativos = calcularDiasNegativos(lancamentos);
  const rendaComprometida = totalRec > 0 ? ((totalDesp / totalRec) * 100).toFixed(0) : 0;

  const itens = [
    { nome: "Receita média mensal", valor: formatadorBRL.format(totalRec / meses), icone: "📊", cor: "var(--cor-receita)" },
    { nome: "Despesa média mensal", valor: formatadorBRL.format(totalDesp / meses), icone: "📉", cor: "var(--cor-despesa)" },
    { nome: "Saldo médio", valor: formatadorBRL.format((totalRec - totalDesp) / meses), icone: "💰", cor: "var(--cor-marca)" },
    { nome: "Maior gasto do período", valor: formatadorBRL.format(Math.max(...desp.map((l) => l.valor || 0), 0)), icone: "🔺", cor: "var(--cor-despesa)" },
    { nome: "Maior receita", valor: formatadorBRL.format(Math.max(...rec.map((l) => l.valor || 0), 0)), icone: "🔺", cor: "var(--cor-receita)" },
    { nome: "Ticket médio despesas", valor: formatadorBRL.format(ticketDesp), icone: "🧾", cor: "var(--cor-texto)" },
    { nome: "Ticket médio receitas", valor: formatadorBRL.format(ticketRec), icone: "🧾", cor: "var(--cor-texto)" },
    { nome: "Total transações", valor: String(lancamentos.length), icone: "📋", cor: "var(--cor-marca)" },
    { nome: "Dias com saldo negativo", valor: String(diasNegativos), icone: "⚠️", cor: "var(--cor-despesa)" },
    { nome: "Renda comprometida", valor: `${rendaComprometida}%`, icone: "📌", cor: "var(--cor-texto)" },
  ];

  container.innerHTML = itens.map((item) => `
    <div class="rel-ind-item">
      <div class="rel-ind-icone" style="background:${item.cor}15;color:${item.cor}">${item.icone}</div>
      <div class="rel-ind-info">
        <span class="rel-ind-nome">${item.nome}</span>
        <span class="rel-ind-valor">${item.valor}</span>
      </div>
    </div>
  `).join("");
}

function calcularDiasNegativos(lancamentos) {
  const porDia = {};
  lancamentos.forEach((l) => {
    if (!l.data_compra) return;
    if (!porDia[l.data_compra]) porDia[l.data_compra] = 0;
    porDia[l.data_compra] += (l.tipo === "receita" ? 1 : -1) * (l.valor || 0);
  });
  return Object.values(porDia).filter((v) => v < 0).length;
}

/* --- Evolução por Categoria --- */
function renderizarEvolucaoCategorias(lancamentos, periodo) {
  const container = document.getElementById("rel-grafico-evolucao-categorias");
  if (!container) return;

  const meses = obterMesesPeriodo(periodo);
  const categoriasSet = new Set();
  lancamentos.filter((l) => l.tipo === "despesa").forEach((l) => categoriasSet.add(l.categoria));
  const cats = [...categoriasSet].slice(0, 6);
  if (cats.length === 0) { container.innerHTML = '<div class="plano-vazio">Sem categorias para exibir.</div>'; return; }

  const W = 600, H = 200, P = 40;
  const dados = meses.map((m) => {
    const obj = { label: m.label };
    cats.forEach((c) => { obj[c] = lancamentos.filter((l) => l.tipo === "despesa" && l.categoria === c && l.data_compra?.startsWith(m.key)).reduce((s, l) => s + (l.valor || 0), 0); });
    return obj;
  });

  const maxV = Math.max(...dados.flatMap((d) => cats.map((c) => d[c] || 0)), 1);
  const x = (i) => P + (i / (dados.length - 1 || 1)) * (W - 2 * P);
  const escala = (v) => H - P - (v / maxV) * (H - 2 * P);

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  dados.forEach((d, i) => {
    svg += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" fill="var(--cor-texto-suave)" font-size="9">${d.label}</text>`;
  });

  cats.forEach((cat, ci) => {
    const cor = CORES_GRAFICO[ci % CORES_GRAFICO.length];
    const path = dados.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${escala(d[cat] || 0)}`).join(" ");
    svg += `<path d="${path}" fill="none" stroke="${cor}" stroke-width="2" stroke-linecap="round"/>`;
    dados.forEach((d, i) => {
      if (d[cat] > 0) svg += `<circle cx="${x(i)}" cy="${escala(d[cat])}" r="2.5" fill="${cor}"/>`;
    });
  });
  svg += `</svg>`;

  const legenda = cats.map((c, i) => `<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.75rem;margin-right:12px"><span style="width:10px;height:10px;border-radius:50%;background:${CORES_GRAFICO[i % CORES_GRAFICO.length]};display:inline-block"></span>${escaparHtml(c)}</span>`).join("");
  container.innerHTML = svg + `<div style="margin-top:8px">${legenda}</div>`;
}

/* --- Ranking Categorias --- */
function renderizarRankingCategorias(lancamentos) {
  const container = document.getElementById("rel-ranking-categorias");
  if (!container) return;

  const porCategoria = {};
  lancamentos.filter((l) => l.tipo === "despesa").forEach((l) => {
    porCategoria[l.categoria] = (porCategoria[l.categoria] || 0) + (l.valor || 0);
  });
  const total = Object.values(porCategoria).reduce((s, v) => s + v, 0);
  const ranking = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);

  if (ranking.length === 0) { container.innerHTML = '<div class="plano-vazio">Sem dados.</div>'; return; }

  container.innerHTML = ranking.map(([nome, valor], i) => {
    const pct = total > 0 ? (valor / total * 100) : 0;
    const cor = CORES_GRAFICO[i % CORES_GRAFICO.length];
    return `
      <div class="rel-ranking-item">
        <span class="rel-ranking-pos">${i + 1}</span>
        <div class="rel-ranking-info">
          <span class="rel-ranking-nome">${escaparHtml(nome)}</span>
          <div class="rel-ranking-barra"><div class="rel-ranking-barra-fill" style="width:${pct}%;background:${cor}"></div></div>
        </div>
        <div class="rel-ranking-valores">
          <div class="rel-ranking-valor-principal">${formatadorBRL.format(valor)}</div>
          <div class="rel-ranking-valor-secundario">${pct.toFixed(1)}%</div>
        </div>
      </div>`;
  }).join("");
}

/* --- Tabelas --- */
function renderizarTabelaContas(lancamentos) {
  const container = document.getElementById("rel-tabela-contas");
  if (!container) return;

  const porConta = {};
  lancamentos.forEach((l) => {
    const conta = l.carteira_nome || l.carteira_id || "Sem conta";
    if (!porConta[conta]) porConta[conta] = { entradas: 0, saidas: 0 };
    if (l.tipo === "receita") porConta[conta].entradas += l.valor || 0;
    else if (l.tipo === "despesa") porConta[conta].saidas += l.valor || 0;
  });

  const contas = Object.entries(porConta);
  if (contas.length === 0) { container.innerHTML = '<div class="plano-vazio">Sem dados.</div>'; return; }

  container.innerHTML = `<table class="rel-tabela"><thead><tr><th>Conta</th><th class="col-valor">Entradas</th><th class="col-valor">Saídas</th><th class="col-valor">Saldo</th></tr></thead><tbody>${
    contas.map(([nome, d]) => {
      const saldo = d.entradas - d.saidas;
      return `<tr><td>${escaparHtml(nome)}</td><td class="col-valor tipo-receita">${formatadorBRL.format(d.entradas)}</td><td class="col-valor tipo-despesa">${formatadorBRL.format(d.saidas)}</td><td class="col-valor" style="color:${saldo >= 0 ? "var(--cor-receita)" : "var(--cor-despesa)"}">${formatadorBRL.format(saldo)}</td></tr>`;
    }).join("")
  }</tbody></table>`;
}

function renderizarTabelaFormasPagamento(lancamentos) {
  const container = document.getElementById("rel-tabela-formas");
  if (!container) return;

  const porForma = {};
  lancamentos.filter((l) => l.tipo === "despesa").forEach((l) => {
    const forma = l.forma_pagamento || "Não informado";
    porForma[forma] = (porForma[forma] || 0) + (l.valor || 0);
  });

  const total = Object.values(porForma).reduce((s, v) => s + v, 0);
  const formas = Object.entries(porForma).sort((a, b) => b[1] - a[1]);

  if (formas.length === 0) { container.innerHTML = '<div class="plano-vazio">Sem dados.</div>'; return; }

  container.innerHTML = `<table class="rel-tabela"><thead><tr><th>Forma</th><th class="col-valor">Valor</th><th class="col-valor">%</th><th style="width:40%">Proporção</th></tr></thead><tbody>${
    formas.map(([nome, valor]) => {
      const pct = total > 0 ? (valor / total * 100) : 0;
      return `<tr><td>${escaparHtml(nome)}</td><td class="col-valor">${formatadorBRL.format(valor)}</td><td class="col-valor">${pct.toFixed(1)}%</td><td><div class="rel-barra-progresso"><div class="rel-barra-trilho"><div class="rel-barra-preenchimento" style="width:${pct}%;background:var(--cor-marca)"></div></div></div></td></tr>`;
    }).join("")
  }</tbody></table>`;
}

function renderizarMaioresDespesas(lancamentos) {
  const container = document.getElementById("rel-tabela-maiores-despesas");
  if (!container) return;

  const despesas = lancamentos.filter((l) => l.tipo === "despesa").sort((a, b) => (b.valor || 0) - (a.valor || 0)).slice(0, 15);
  if (despesas.length === 0) { container.innerHTML = '<div class="plano-vazio">Sem despesas.</div>'; return; }

  container.innerHTML = `<table class="rel-tabela"><thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th class="col-valor">Valor</th></tr></thead><tbody>${
    despesas.map((l) => `<tr><td>${escaparHtml(l.descricao || l.categoria)}</td><td><span class="rel-tabela col-categoria" style="background:var(--cor-despesa)15;color:var(--cor-despesa)">${escaparHtml(l.categoria || "")}</span></td><td>${l.data_compra ? new Date(l.data_compra + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td><td class="col-valor tipo-despesa">${formatadorBRL.format(l.valor)}</td></tr>`).join("")
  }</tbody></table>`;
}

function renderizarMaioresReceitas(lancamentos) {
  const container = document.getElementById("rel-tabela-maiores-receitas");
  if (!container) return;

  const receitas = lancamentos.filter((l) => l.tipo === "receita").sort((a, b) => (b.valor || 0) - (a.valor || 0)).slice(0, 15);
  if (receitas.length === 0) { container.innerHTML = '<div class="plano-vazio">Sem receitas.</div>'; return; }

  container.innerHTML = `<table class="rel-tabela"><thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th class="col-valor">Valor</th></tr></thead><tbody>${
    receitas.map((l) => `<tr><td>${escaparHtml(l.descricao || l.categoria)}</td><td><span class="rel-tabela col-categoria" style="background:var(--cor-receita)15;color:var(--cor-receita)">${escaparHtml(l.categoria || "")}</span></td><td>${l.data_compra ? new Date(l.data_compra + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td><td class="col-valor tipo-receita">${formatadorBRL.format(l.valor)}</td></tr>`).join("")
  }</tbody></table>`;
}

function renderizarRecorrentesRelatorio(lancamentos) {
  const container = document.getElementById("rel-tabela-recorrentes");
  if (!container) return;

  const fixas = typeof despesasFixasCarregadas !== "undefined" ? despesasFixasCarregadas.filter((f) => f.ativo) : [];
  if (fixas.length === 0) { container.innerHTML = '<div class="plano-vazio">Sem despesas recorrentes.</div>'; return; }

  container.innerHTML = `<table class="rel-tabela"><thead><tr><th>Despesa</th><th>Frequência</th><th class="col-valor">Valor</th></tr></thead><tbody>${
    fixas.map((f) => `<tr><td>${escaparHtml(f.descricao)}</td><td>Mensal</td><td class="col-valor">${formatadorBRL.format(f.valor)}</td></tr>`).join("")
  }</tbody></table>`;
}

/* --- Comparativo --- */
function renderizarComparativoPeriodos(lancamentos, mesAnterior) {
  const container = document.getElementById("rel-comparacao-periodos");
  if (!container) return;

  const recAtual = lancamentos.filter((l) => l.tipo === "receita").reduce((s, l) => s + (l.valor || 0), 0);
  const despAtual = lancamentos.filter((l) => l.tipo === "despesa").reduce((s, l) => s + (l.valor || 0), 0);

  carregarLancamentosPeriodo(mesAnterior.inicio, mesAnterior.fim).then((ant) => {
    const recAnt = ant.filter((l) => l.tipo === "receita").reduce((s, l) => s + (l.valor || 0), 0);
    const despAnt = ant.filter((l) => l.tipo === "despesa").reduce((s, l) => s + (l.valor || 0), 0);
    const ecoAtual = recAtual - despAtual;
    const ecoAnt = recAnt - despAnt;

    const calcPct = (atual, anterior) => anterior > 0 ? ((atual - anterior) / anterior * 100).toFixed(0) : "—";

    container.innerHTML = `
      <div class="rel-comp-linha rel-comp-header"><span>Métrica</span><span style="text-align:right">Período atual</span><span style="text-align:right">Período anterior</span><span style="text-align:right">Variação</span></div>
      <div class="rel-comp-linha"><span>Receitas</span><span class="rel-comp-valor">${formatadorBRL.format(recAtual)}</span><span class="rel-comp-valor">${formatadorBRL.format(recAnt)}</span><span class="rel-comp-diferenca ${recAtual >= recAnt ? "positivo" : "negativo"}">${calcPct(recAtual, recAnt)}%</span></div>
      <div class="rel-comp-linha"><span>Despesas</span><span class="rel-comp-valor">${formatadorBRL.format(despAtual)}</span><span class="rel-comp-valor">${formatadorBRL.format(despAnt)}</span><span class="rel-comp-diferenca ${despAtual <= despAnt ? "positivo" : "negativo"}">${calcPct(despAtual, despAnt)}%</span></div>
      <div class="rel-comp-linha"><span>Economia</span><span class="rel-comp-valor">${formatadorBRL.format(ecoAtual)}</span><span class="rel-comp-valor">${formatadorBRL.format(ecoAnt)}</span><span class="rel-comp-diferenca ${ecoAtual >= ecoAnt ? "positivo" : "negativo"}">${calcPct(ecoAtual, ecoAnt)}%</span></div>
    `;
  });
}

/* --- Metas --- */
function renderizarMetasRelatorio() {
  const container = document.getElementById("rel-metas-progresso");
  if (!container) return;

  if (typeof metasCarregadas === "undefined" || metasCarregadas.length === 0) {
    container.innerHTML = '<div class="plano-vazio">Nenhuma meta configurada.</div>';
    return;
  }

  container.innerHTML = metasCarregadas.map((meta) => {
    const pct = meta.valor_limite > 0 ? Math.min(100, Math.round((meta.total_depositado / meta.valor_limite) * 100)) : 0;
    const cor = pct >= 80 ? "var(--cor-receita)" : pct >= 40 ? "var(--cor-marca)" : "var(--cor-despesa)";
    return `
      <div class="rel-ranking-item">
        <div class="rel-ranking-info">
          <span class="rel-ranking-nome">${escaparHtml(meta.categoria)}</span>
          <div class="rel-barra-progresso" style="margin-top:4px">
            <div class="rel-barra-trilho"><div class="rel-barra-preenchimento" style="width:${pct}%;background:${cor}"></div></div>
            <span class="rel-barra-pct" style="color:${cor}">${pct}%</span>
          </div>
          <span class="rel-ranking-valor-secundario">${formatadorBRL.format(meta.total_depositado)} / ${formatadorBRL.format(meta.valor_limite)}</span>
        </div>
      </div>`;
  }).join("");
}

/* --- Insights Automáticos --- */
function renderizarInsights(lancamentos, mesAnterior) {
  const container = document.getElementById("rel-insights-lista");
  if (!container) return;

  const insights = [];
  const desp = lancamentos.filter((l) => l.tipo === "despesa");
  const rec = lancamentos.filter((l) => l.tipo === "receita");
  const totalDesp = desp.reduce((s, l) => s + (l.valor || 0), 0);
  const totalRec = rec.reduce((s, l) => s + (l.valor || 0), 0);

  // Insight: despesas maiores que receitas
  if (totalDesp > totalRec && totalRec > 0) {
    insights.push({ tipo: "alerta", texto: `Suas despesas (${formatadorBRL.format(totalDesp)}) ultrapassam as receitas (${formatadorBRL.format(totalRec)}) neste período.` });
  }

  // Insight: categoria com maior aumento
  carregarLancamentosPeriodo(mesAnterior.inicio, mesAnterior.fim).then((ant) => {
    const despAnt = ant.filter((l) => l.tipo === "despesa");
    const catAtual = {}, catAnt = {};
    desp.forEach((l) => { catAtual[l.categoria] = (catAtual[l.categoria] || 0) + (l.valor || 0); });
    despAnt.forEach((l) => { catAnt[l.categoria] = (catAnt[l.categoria] || 0) + (l.valor || 0); });

    Object.keys(catAtual).forEach((cat) => {
      if (catAnt[cat] && catAtual[cat] > catAnt[cat] * 1.15) {
        const pct = ((catAtual[cat] - catAnt[cat]) / catAnt[cat] * 100).toFixed(0);
        insights.push({ tipo: "alerta", texto: `Você gastou ${pct}% mais com ${cat} em relação ao período anterior.` });
      }
    });

    Object.keys(catAtual).forEach((cat) => {
      if (catAnt[cat] && catAtual[cat] < catAnt[cat] * 0.85) {
        const pct = ((catAnt[cat] - catAtual[cat]) / catAnt[cat] * 100).toFixed(0);
        insights.push({ tipo: "ok", texto: `Redução de ${pct}% nos gastos com ${cat}. Continue assim!` });
      }
    });

    // Economia
    const ecoAtual = totalRec - totalDesp;
    const ecoAnt = rec.reduce((s, l) => s + (l.valor || 0), 0) - despAnt.reduce((s, l) => s + (l.valor || 0), 0);
    if (ecoAtual > ecoAnt && ecoAnt > 0) {
      insights.push({ tipo: "ok", texto: `Sua economia cresceu ${((ecoAtual - ecoAnt) / ecoAnt * 100).toFixed(0)}% em relação ao período anterior.` });
    }

    // Fixas > 60% renda
    const fixas = typeof despesasFixasCarregadas !== "undefined" ? despesasFixasCarregadas.filter((f) => f.ativo).reduce((s, f) => s + (f.valor || 0), 0) : 0;
    if (totalRec > 0 && fixas / totalRec > 0.6) {
      insights.push({ tipo: "alerta", texto: `As despesas fixas representam ${((fixas / totalRec) * 100).toFixed(0)}% da sua renda.` });
    }

    // Ticket médio
    if (desp.length > 0) {
      const ticket = totalDesp / desp.length;
      insights.push({ tipo: "info", texto: `Ticket médio das despesas: ${formatadorBRL.format(ticket)}. Considere analisar transações acima deste valor.` });
    }

    // Zero insights = mensagem padrão
    if (insights.length === 0) {
      insights.push({ tipo: "ok", texto: "Seus indicadores estão dentro do esperado. Continue monitorando!" });
    }

    container.innerHTML = insights.map((ins) => {
      const cls = ins.tipo === "alerta" ? "insight-alerta" : ins.tipo === "ok" ? "insight-ok" : "insight-info";
      const icone = ins.tipo === "alerta" ? "⚠️" : ins.tipo === "ok" ? "✅" : "ℹ️";
      return `<div class="rel-insight-item"><div class="rel-insight-icone ${cls}">${icone}</div><span class="rel-insight-texto">${ins.texto}</span></div>`;
    }).join("");
  });
}

/* --- Tabela Completa --- */
function renderizarTabelaTransacoes(lancamentos) {
  const container = document.getElementById("rel-tabela-transacoes");
  const pagContainer = document.getElementById("rel-tabela-paginacao");
  if (!container) return;

  const busca = document.getElementById("rel-busca-transacoes")?.value?.toLowerCase() || "";
  const ordem = document.getElementById("rel-ordem-tabela")?.value || "data-desc";

  let filtrados = lancamentos.filter((l) => {
    if (busca && !(l.descricao || "").toLowerCase().includes(busca) && !(l.categoria || "").toLowerCase().includes(busca)) return false;
    return true;
  });

  filtrados.sort((a, b) => {
    switch (ordem) {
      case "data-desc": return (b.data_compra || "").localeCompare(a.data_compra || "");
      case "data-asc": return (a.data_compra || "").localeCompare(b.data_compra || "");
      case "valor-desc": return (b.valor || 0) - (a.valor || 0);
      case "valor-asc": return (a.valor || 0) - (b.valor || 0);
      case "desc-alf": return (a.descricao || "").localeCompare(b.descricao || "");
      default: return 0;
    }
  });

  const totalPaginas = Math.ceil(filtrados.length / relatorioPagina.porPagina);
  if (relatorioPagina.atual > totalPaginas) relatorioPagina.atual = 1;
  const inicio = (relatorioPagina.atual - 1) * relatorioPagina.porPagina;
  const pagina = filtrados.slice(inicio, inicio + relatorioPagina.porPagina);

  container.innerHTML = `<table class="rel-tabela"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th class="col-valor">Valor</th></tr></thead><tbody>${
    pagina.map((l) => {
      const tipoCor = l.tipo === "receita" ? "tipo-receita" : l.tipo === "despesa" ? "tipo-despesa" : "tipo-transferencia";
      return `<tr><td>${l.data_compra ? new Date(l.data_compra + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td><td>${escaparHtml(l.descricao || "")}</td><td>${escaparHtml(l.categoria || "")}</td><td class="${tipoCor}">${l.tipo || ""}</td><td class="col-valor">${formatadorBRL.format(l.valor)}</td></tr>`;
    }).join("")
  }</tbody></table>`;

  if (pagContainer) {
    if (totalPaginas <= 1) { pagContainer.innerHTML = ""; return; }
    let html = `<button ${relatorioPagina.atual <= 1 ? "disabled" : ""} onclick="relatorioPagina.atual--;renderizarTabelaTransacoes(relatorioDados.lancamentos)">‹</button>`;
    for (let i = 1; i <= totalPaginas; i++) {
      if (totalPaginas > 7 && i > 3 && i < totalPaginas - 1 && Math.abs(i - relatorioPagina.atual) > 1) { if (i === 4 || i === totalPaginas - 2) html += `<button disabled>…</button>`; continue; }
      html += `<button class="${i === relatorioPagina.atual ? "ativo" : ""}" onclick="relatorioPagina.atual=${i};renderizarTabelaTransacoes(relatorioDados.lancamentos)">${i}</button>`;
    }
    html += `<button ${relatorioPagina.atual >= totalPaginas ? "disabled" : ""} onclick="relatorioPagina.atual++;renderizarTabelaTransacoes(relatorioDados.lancamentos)">›</button>`;
    pagContainer.innerHTML = html;
  }
}

/* --- Helpers --- */
function obterMesesPeriodo(periodo) {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const resultado = [];
  const ini = new Date(periodo.inicioDate);
  const fim = new Date(periodo.fimDate);
  const atual = new Date(ini);
  while (atual <= fim) {
    resultado.push({ key: `${atual.getFullYear()}-${String(atual.getMonth() + 1).padStart(2, "0")}`, label: `${meses[atual.getMonth()]}${periodo.tipo === "ano" ? "" : " " + (atual.getMonth() + 1)}` });
    atual.setMonth(atual.getMonth() + 1);
  }
  return resultado;
}

/* --- Exportar --- */
function configurarExportarRelatorio() {
  const btnExp = document.getElementById("btn-relatorio-exportar");
  const modal = document.getElementById("modal-relatorio-exportar");
  const btnFechar = document.getElementById("btn-fechar-modal-relatorio-exportar");
  if (btnExp && modal) {
    btnExp.addEventListener("click", () => { modal.style.display = "flex"; modal.classList.add("modal-aberto"); });
  }
  if (btnFechar && modal) {
    btnFechar.addEventListener("click", () => { modal.style.display = "none"; modal.classList.remove("modal-aberto"); });
  }
  if (modal) {
    modal.addEventListener("click", (e) => { if (e.target === modal) { modal.style.display = "none"; modal.classList.remove("modal-aberto"); } });
  }

  document.querySelectorAll(".rel-exportar-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const formato = btn.dataset.formato;
      if (formato === "csv") exportarRelatorioCSV();
      else if (formato === "json") exportarRelatorioJSON();
      else if (formato === "imprimir") window.print();
      else if (formato === "pdf") exportarRelatorioPDF();
      if (modal) { modal.style.display = "none"; modal.classList.remove("modal-aberto"); }
    });
  });

  // Busca e ordenação da tabela
  const busca = document.getElementById("rel-busca-transacoes");
  const ordem = document.getElementById("rel-ordem-tabela");
  if (busca) busca.addEventListener("input", () => { relatorioPagina.atual = 1; renderizarTabelaTransacoes(relatorioDados.lancamentos); });
  if (ordem) ordem.addEventListener("change", () => { relatorioPagina.atual = 1; renderizarTabelaTransacoes(relatorioDados.lancamentos); });

  // Botão compartilhar
  const btnComp = document.getElementById("btn-relatorio-compartilhar");
  if (btnComp) btnComp.addEventListener("click", () => {
    if (navigator.share) navigator.share({ title: "Relatório Financeiro", text: "Meu relatório financeiro - Gestor Financeiro" });
    else mostrarToast("Função de compartilhar não disponível neste navegador", "aviso");
  });

  // Botão salvar
  const btnSalvar = document.getElementById("btn-relatorio-salvar");
  if (btnSalvar) btnSalvar.addEventListener("click", () => exportarRelatorioPDF());
}

function exportarRelatorioCSV() {
  const { lancamentos } = relatorioDados;
  if (lancamentos.length === 0) { mostrarToast("Sem dados para exportar", "aviso"); return; }

  const linhas = [["Data", "Descrição", "Categoria", "Tipo", "Valor", "Conta", "Forma Pagamento"]];
  lancamentos.forEach((l) => {
    linhas.push([l.data_compra || "", l.descricao || "", l.categoria || "", l.tipo || "", l.valor || 0, l.carteira_nome || "", l.forma_pagamento || ""]);
  });

  const csv = linhas.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  baixarArquivo(blob, `relatorio_financeiro_${new Date().toISOString().split("T")[0]}.csv`);
}

function exportarRelatorioJSON() {
  const { lancamentos, periodo } = relatorioDados;
  const json = JSON.stringify({ periodo, lancamentos }, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  baixarArquivo(blob, `relatorio_financeiro_${new Date().toISOString().split("T")[0]}.json`);
}

function exportarRelatorioPDF() {
  const { lancamentos, periodo } = relatorioDados;
  const totalRec = lancamentos.filter((l) => l.tipo === "receita").reduce((s, l) => s + (l.valor || 0), 0);
  const totalDesp = lancamentos.filter((l) => l.tipo === "despesa").reduce((s, l) => s + (l.valor || 0), 0);
  const saldo = totalRec - totalDesp;

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório Financeiro</title><style>
    body{font-family:'IBM Plex Sans',sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#1a1a1a}
    h1{font-size:1.3rem;border-bottom:2px solid #2e7d32;padding-bottom:8px}
    .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0}
    .kpi{padding:12px;border:1px solid #e0e0e0;border-radius:8px;text-align:center}
    .kpi-rotulo{font-size:0.75rem;color:#666;text-transform:uppercase}
    .kpi-valor{font-size:1.2rem;font-weight:700;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin:16px 0;font-size:0.85rem}
    th,td{padding:8px;border-bottom:1px solid #e0e0e0;text-align:left}
    th{background:#f5f5f5;font-weight:600;font-size:0.75rem;text-transform:uppercase}
    .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e0e0e0;font-size:0.7rem;color:#999;text-align:center}
  </style></head><body>
    <h1>Relatório Financeiro — Gestor Financeiro</h1>
    <p style="color:#666;font-size:0.85rem">Período: ${periodo.inicio} a ${periodo.fim}</p>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-rotulo">Receitas</div><div class="kpi-valor" style="color:#2e7d32">${formatadorBRL.format(totalRec)}</div></div>
      <div class="kpi"><div class="kpi-rotulo">Despesas</div><div class="kpi-valor" style="color:#c62828">${formatadorBRL.format(totalDesp)}</div></div>
      <div class="kpi"><div class="kpi-rotulo">Saldo</div><div class="kpi-valor" style="color:${saldo >= 0 ? "#2e7d32" : "#c62828"}">${formatadorBRL.format(saldo)}</div></div>
    </div>
    <h2>Transações</h2>
    <table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th style="text-align:right">Valor</th></tr></thead><tbody>${
      lancamentos.map((l) => `<tr><td>${l.data_compra ? new Date(l.data_compra + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td><td>${escaparHtml(l.descricao || "")}</td><td>${escaparHtml(l.categoria || "")}</td><td>${l.tipo || ""}</td><td style="text-align:right">${formatadorBRL.format(l.valor)}</td></tr>`).join("")
    }</tbody></table>
    <div class="footer">Gerado em ${new Date().toLocaleString("pt-BR")} — Gestor Financeiro</div></body></html>`;

  const janela = window.open("", "_blank");
  if (janela) { janela.document.write(html); janela.document.close(); janela.print(); }
}

function baixarArquivo(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
