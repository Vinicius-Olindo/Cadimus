// ==========================================
// recorrentes.js — Lançamentos com frequência customizável
// ==========================================

let recorrentesCarregadas = [];

// ==========================================
// CARREGAR LISTA
// ==========================================
async function carregarPainelRecorrentes() {
  const container = document.getElementById("lista-recorrentes-admin");
  const badge = document.getElementById("badge-recorrentes");
  const carteiraId = document.getElementById("seletor-carteira").value;
  if (!container || !carteiraId) return;

  try {
    const resposta = await fetch(`${API_URL}/api/lancamentos-recorrentes?carteira_id=${carteiraId}`, { headers: headersAutenticados(false) });
    if (tratarSessaoExpirada(resposta)) return;
    if (!resposta.ok) return;

    recorrentesCarregadas = await resposta.json();

    if (badge) badge.textContent = recorrentesCarregadas.length;

    if (recorrentesCarregadas.length === 0) {
      container.innerHTML = '<div class="estado-vazio-admin"><div class="icone-vazio">🔄</div><p>Nenhuma recorrência cadastrada.<br>Crie a primeira acima.</p></div>';
      return;
    }

    container.innerHTML = "";

    const NOMES_FREQUENCIA = { semanal: "Semanal", quinzenal: "Quinzenal", mensal: "Mensal", trimestral: "Trimestral", anual: "Anual" };
    const NOMES_DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    recorrentesCarregadas.forEach((rec) => {
      const valorFormatado = formatadorBRL.format(rec.valor);
      const nomeFreq = NOMES_FREQUENCIA[rec.frequencia] || rec.frequencia || "Mensal";
      let detalhe = nomeFreq;
      if (rec.frequencia === "semanal") {
        detalhe += ` · ${NOMES_DIAS[rec.dia_semana || 0]}`;
      } else {
        detalhe += ` · Dia ${rec.dia_mes || 1}`;
      }

      const div = document.createElement("div");
      div.className = "linha-item linha-usuario";
      div.innerHTML = `
        <div class="item-info-principal linha-usuario-info">
          <span class="item-descricao">${escaparHtml(rec.descricao)}</span>
          <span class="item-categoria">${detalhe} · ${valorFormatado}</span>
        </div>
        <div class="item-valores">
          <span class="item-status ${rec.ativo ? "status-pago" : "status-pendente"}">${rec.ativo ? "Ativa" : "Pausada"}</span>
          <button type="button" class="fixa-btn btn-editar-recorrencia" data-id="${rec.id}">Editar</button>
          <button type="button" class="fixa-btn btn-alternar-recorrencia" data-id="${rec.id}">${rec.ativo ? "Pausar" : "Ativar"}</button>
          <button type="button" class="fixa-btn-excluir btn-excluir-recorrencia" data-id="${rec.id}">Excluir</button>
        </div>
      `;
      container.appendChild(div);
    });

    container.querySelectorAll(".btn-editar-recorrencia").forEach((btn) => {
      btn.addEventListener("click", () => editarRecorrencia(Number(btn.dataset.id)));
    });
    container.querySelectorAll(".btn-alternar-recorrencia").forEach((btn) => {
      btn.addEventListener("click", () => alternarRecorrencia(Number(btn.dataset.id)));
    });
    container.querySelectorAll(".btn-excluir-recorrencia").forEach((btn) => {
      btn.addEventListener("click", () => excluirRecorrencia(Number(btn.dataset.id)));
    });
  } catch (erro) {
    console.error("Erro ao carregar recorrências:", erro);
  }
}

// ==========================================
// MODAL
// ==========================================
function configurarModalRecorrencia() {
  const modal = document.getElementById("modal-recorrencia");
  const btnAbrir = document.getElementById("btn-nova-recorrencia-admin");
  const btnFechar = document.getElementById("btn-fechar-modal-recorrencia");
  const form = document.getElementById("form-recorrencia");
  const selFrequencia = document.getElementById("recorrencia-frequencia");
  const campoDiaSemana = document.getElementById("campo-dia-semana");
  const campoDiaMes = document.getElementById("campo-dia-mes");

  if (!modal || !btnFechar || !form) return;

  btnAbrir?.addEventListener("click", async () => {
    document.getElementById("recorrencia-editando-id").value = "";
    document.getElementById("titulo-modal-recorrencia").innerText = "Nova recorrência";
    document.getElementById("btn-salvar-recorrencia").innerText = "Adicionar";
    document.getElementById("form-recorrencia").reset();
    document.getElementById("recorrencia-data-inicio").value = new Date().toISOString().slice(0, 10);
    await popularSelectCategorias(document.getElementById("recorrencia-categoria"));
    modal.style.display = "flex";
    trapFoco(modal);
  });

  btnFechar.addEventListener("click", () => {
    modal.style.display = "none";
    liberarFoco();
  });

  selFrequencia.addEventListener("change", () => {
    const val = selFrequencia.value;
    if (val === "semanal") {
      campoDiaSemana.style.display = "block";
      campoDiaMes.style.display = "none";
    } else {
      campoDiaSemana.style.display = "none";
      campoDiaMes.style.display = "block";
    }
  });

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const idEdicao = document.getElementById("recorrencia-editando-id").value;
    const carteiraId = document.getElementById("seletor-carteira").value;
    const btnSalvar = document.getElementById("btn-salvar-recorrencia");
    btnSalvar.disabled = true;
    btnSalvar.innerText = idEdicao ? "Salvando..." : "Salvando...";

    const frequencia = document.getElementById("recorrencia-frequencia").value;

    try {
      const corpo = {
        descricao: document.getElementById("recorrencia-descricao").value.trim(),
        valor: parseFloat(document.getElementById("recorrencia-valor").value),
        tipo: document.getElementById("recorrencia-tipo").value,
        frequencia,
        dia_semana: frequencia === "semanal" ? parseInt(document.getElementById("recorrencia-dia-semana").value) : null,
        dia_mes: frequencia !== "semanal" ? parseInt(document.getElementById("recorrencia-dia-mes").value) : null,
        data_inicio: document.getElementById("recorrencia-data-inicio").value,
        data_fim: document.getElementById("recorrencia-data-fim").value || null,
        categoria: document.getElementById("recorrencia-categoria").value,
        meio_pagamento: document.getElementById("recorrencia-meio-pagamento").value,
      };
      if (!idEdicao) corpo.carteira_id = carteiraId;

      const resposta = idEdicao
        ? await fetch(`${API_URL}/api/lancamentos-recorrentes?id=${idEdicao}`, {
            method: "PUT",
            headers: headersAutenticados(),
            body: JSON.stringify(corpo),
          })
        : await fetch(`${API_URL}/api/lancamentos-recorrentes`, {
            method: "POST",
            headers: headersAutenticados(),
            body: JSON.stringify(corpo),
          });

      if (tratarSessaoExpirada(resposta)) return;

      if (resposta.ok) {
        modal.style.display = "none";
        liberarFoco();
        carregarPainelRecorrentes();
        carregarLancamentos();
        mostrarToast(idEdicao ? "Recorrência atualizada" : "Recorrência criada");
      } else {
        const erro = await resposta.json();
        await mostrarAviso(`Erro: ${erro.erro}`);
      }
    } catch (erro) {
      console.error(erro);
      await mostrarAviso("Erro de conexão ao salvar recorrência.");
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.innerText = idEdicao ? "Salvar edição" : "Adicionar";
    }
  });
}

// ==========================================
// EDITAR
// ==========================================
async function editarRecorrencia(id) {
  const rec = recorrentesCarregadas.find((r) => r.id === id);
  if (!rec) return;

  const modal = document.getElementById("modal-recorrencia");
  if (!modal) return;

  await popularSelectCategorias(document.getElementById("recorrencia-categoria"));
  adicionarOpcaoSelect(document.getElementById("recorrencia-categoria"), rec.categoria);

  document.getElementById("recorrencia-editando-id").value = rec.id;
  document.getElementById("recorrencia-descricao").value = rec.descricao;
  document.getElementById("recorrencia-valor").value = rec.valor;
  document.getElementById("recorrencia-tipo").value = rec.tipo;
  document.getElementById("recorrencia-frequencia").value = rec.frequencia;
  document.getElementById("recorrencia-dia-semana").value = rec.dia_semana || 0;
  document.getElementById("recorrencia-dia-mes").value = rec.dia_mes || 1;
  document.getElementById("recorrencia-data-inicio").value = rec.data_inicio;
  document.getElementById("recorrencia-data-fim").value = rec.data_fim || "";
  document.getElementById("recorrencia-categoria").value = rec.categoria;
  document.getElementById("recorrencia-meio-pagamento").value = rec.meio_pagamento;

  // Ajusta campos de dia
  const selFrequencia = document.getElementById("recorrencia-frequencia");
  selFrequencia.dispatchEvent(new Event("change"));

  document.getElementById("titulo-modal-recorrencia").innerText = `Editando "${rec.descricao}"`;
  document.getElementById("btn-salvar-recorrencia").innerText = "Salvar edição";
  modal.style.display = "flex";
  trapFoco(modal);
}

// ==========================================
// ALTERNAR ATIVO/INATIVO
// ==========================================
async function alternarRecorrencia(id) {
  const alvo = recorrentesCarregadas.find((r) => r.id === id);
  if (!alvo) return;

  try {
    const resposta = await fetch(`${API_URL}/api/lancamentos-recorrentes?id=${id}`, {
      method: "PUT",
      headers: headersAutenticados(),
      body: JSON.stringify({ ativo: !alvo.ativo }),
    });

    if (tratarSessaoExpirada(resposta)) return;

    if (resposta.ok) {
      carregarPainelRecorrentes();
      mostrarToast(alvo.ativo ? "Recorrência pausada" : "Recorrência ativada", "info");
    } else {
      const erro = await resposta.json();
      await mostrarAviso(`Erro: ${erro.erro}`);
    }
  } catch (erro) {
    await mostrarAviso("Erro de conexão.");
  }
}

// ==========================================
// EXCLUIR
// ==========================================
async function excluirRecorrencia(id) {
  if (!(await pedirConfirmacao("Excluir esta recorrência? Lançamentos já gerados continuam na lista.", { textoConfirmar: "Excluir", perigo: true }))) return;

  try {
    const resposta = await fetch(`${API_URL}/api/lancamentos-recorrentes?id=${id}`, {
      method: "DELETE",
      headers: headersAutenticados(false),
    });

    if (tratarSessaoExpirada(resposta)) return;

    if (resposta.ok) {
      carregarPainelRecorrentes();
      mostrarToast("Recorrência excluída", "info");
    } else {
      const erro = await resposta.json();
      await mostrarAviso(`Erro: ${erro.erro}`);
    }
  } catch (erro) {
    await mostrarAviso("Erro de conexão.");
  }
}

document.addEventListener("DOMContentLoaded", configurarModalRecorrencia);
