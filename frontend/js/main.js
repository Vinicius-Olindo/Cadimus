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
  configurarPainelAdmin();
});

// --- CONFIGURAÇÃO INICIAL DO MÊS ---
function inicializarFiltroMes() {
  const campoMes = document.getElementById("filtro-mes");
  if (!campoMes) return;

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");

  campoMes.value = `${ano}-${mes}`;
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

async function carregarCarteiras() {
  const container = document.getElementById("carteira-tabs");
  const inputOculto = document.getElementById("seletor-carteira");
  if (!container || !inputOculto) return;

  try {
    const resposta = await fetch(`${API_URL}/api/carteiras`, { headers: headersAutenticados(false) });
    if (tratarSessaoExpirada(resposta)) return;
    if (!resposta.ok) return;

    carteirasDoUsuario = await resposta.json();
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

// --- CATEGORIAS (carrega no select do lançamento e permite cadastrar novas) ---
async function carregarCategorias() {
  const select = document.getElementById("categoria");
  if (!select) return;

  try {
    const resposta = await fetch(`${API_URL}/api/categorias`, { headers: headersAutenticados(false) });
    if (tratarSessaoExpirada(resposta)) return;
    if (!resposta.ok) return;

    const categorias = await resposta.json();
    const opcaoNova = select.querySelector('option[value="__nova__"]');

    // Remove opções antigas (menos a de placeholder e a de "+ Nova categoria")
    select.querySelectorAll("option[data-categoria]").forEach((op) => op.remove());

    categorias.forEach((cat) => {
      const opcao = document.createElement("option");
      opcao.value = cat.nome;
      opcao.textContent = cat.nome;
      opcao.dataset.categoria = "true";
      select.insertBefore(opcao, opcaoNova);
    });
  } catch (erro) {
    console.error("Erro ao carregar categorias:", erro);
  }
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

// --- COMUNICAÇÃO COM A API (BUSCA FILTRADA) ---
async function carregarLancamentos() {
  const container = document.querySelector(".lista-lancamentos");
  if (!container) return;

  const carteiraId = document.getElementById("seletor-carteira").value;
  if (!carteiraId) return; // carteiras ainda carregando

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
    if (tratarSessaoExpirada(resposta)) return;
    const dados = await resposta.json();

    container.innerHTML = "";

    if (dados.length === 0) {
      container.appendChild(criarAvisoListaVazia());
      document.getElementById("saldo-total").innerText = "R$ 0,00";
      document.getElementById("saldo-total").style.color = "var(--cor-texto)";
      return;
    }

    let saldoCalculado = 0;

    dados.forEach((lancamento) => {
      const linha = criarLinhaLancamento(lancamento);
      container.appendChild(linha);

      if (lancamento.tipo === "receita") {
        saldoCalculado += lancamento.valor;
      } else {
        saldoCalculado -= lancamento.valor;
      }
    });

    const elementoSaldo = document.getElementById("saldo-total");
    if (elementoSaldo) {
      elementoSaldo.innerText = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(saldoCalculado);
      elementoSaldo.style.color = saldoCalculado >= 0 ? "var(--cor-receita)" : "var(--cor-despesa)";
    }
  } catch (erro) {
    console.error("Erro:", erro);
    container.innerHTML = '<p style="color: var(--cor-despesa); padding: 1rem;">Erro ao carregar os dados.</p>';
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
window.carregarCarteiras = carregarCarteiras;
