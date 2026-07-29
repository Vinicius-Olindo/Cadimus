// ==========================================
// importar.js — Importação de extratos (OFX / CSV)
// ==========================================

let importarTransacoes = [];

// ==========================================
// PARSER OFX
// ==========================================
function parseOFX(texto) {
  const transacoes = [];
  const blocos = texto.split(/<STMTTRN>/i).slice(1);

  for (const bloco of blocos) {
    const fechamento = bloco.split(/<\/STMTTRN>/i)[0];
    if (!fechamento) continue;

    const extrair = (tag) => {
      const m = fechamento.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, "i"));
      return m ? m[1].trim() : "";
    };

    const trnType = extrair("TRNTYPE");
    const amount = parseFloat(extrair("TRNAMT"));
    const dateStr = extrair("DTPOSTED");
    const name = extrair("NAME") || extrair("MEMO") || "";

    if (!Number.isFinite(amount) || amount === 0) continue;

    let data = "";
    if (dateStr) {
      const clean = dateStr.replace(/[^0-9]/g, "").slice(0, 8);
      if (clean.length === 8) {
        data = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
      }
    }

    const tipo = amount < 0 ? "despesa" : "receita";

    transacoes.push({
      data,
      descricao: name,
      valor: Math.abs(amount),
      tipo,
      selecionada: true,
    });
  }

  return transacoes;
}

// ==========================================
// PARSER CSV (flexível)
// ==========================================
function parseCSV(texto) {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length < 2) return [];

  const separador = linhas[0].includes(";") ? ";" : ",";
  const cabecalho = linhas[0].split(separador).map((h) => h.trim().toLowerCase().replace(/"/g, ""));

  const colData = cabecalho.findIndex((h) => /data|date|dt/i.test(h));
  const colDesc = cabecalho.findIndex((h) => /descri|desc|hist|memo|nome|payee|favorecido/i.test(h));
  const colValor = cabecalho.findIndex((h) => /valor|amount|value|quant/i.test(h));
  const colTipo = cabecalho.findIndex((h) => /tipo|type|category|cat/i.test(h));

  if (colValor === -1) return [];

  const transacoes = [];

  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split(separador).map((c) => c.trim().replace(/"/g, ""));
    if (cols.length < 2) continue;

    let valorStr = (cols[colValor] || "").replace(/[^\d,.\-]/g, "").replace(",", ".");
    const valor = parseFloat(valorStr);
    if (!Number.isFinite(valor) || valor === 0) continue;

    let data = "";
    if (colData !== -1 && cols[colData]) {
      const raw = cols[colData].replace(/["']/g, "").trim();
      const m = raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
      if (m) {
        let [, dia, mes, ano] = m;
        if (ano.length === 2) ano = (parseInt(ano) > 50 ? "19" : "20") + ano;
        data = `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
      }
    }

    const descRaw = colDesc !== -1 ? cols[colDesc] : "";
    const tipoRaw = colTipo !== -1 ? cols[colTipo].toLowerCase() : "";

    let tipo = "despesa";
    if (tipoRaw.includes("receita") || tipoRaw.includes("income") || tipoRaw.includes("crédito")) {
      tipo = "receita";
    } else if (valor > 0 && (tipoRaw.includes("despesa") || tipoRaw.includes("expense") || tipoRaw.includes("débito"))) {
      tipo = "despesa";
    } else if (valor > 0 && tipoRaw === "") {
      tipo = "receita";
    }

    transacoes.push({
      data,
      descricao: descRaw || `Linha ${i + 1}`,
      valor: Math.abs(valor),
      tipo,
      selecionada: true,
    });
  }

  return transacoes;
}

// ==========================================
// RENDERIZAÇÃO DO PREVIEW
// ==========================================
function renderizarPreviewImportacao() {
  const tbody = document.getElementById("importar-lista");
  const infoArquivo = document.getElementById("importar-info-arquivo");
  const resumo = document.getElementById("importar-resumo");
  const preview = document.getElementById("importar-preview");
  const dropzone = document.getElementById("importar-dropzone");

  if (!tbody || !preview) return;

  dropzone.style.display = "none";
  preview.style.display = "block";

  const qtd = importarTransacoes.length;
  const receitas = importarTransacoes.filter((t) => t.tipo === "receita").length;
  const despesas = importarTransacoes.filter((t) => t.tipo === "despesa").length;
  infoArquivo.textContent = `${qtd} lançamento${qtd !== 1 ? "s" : ""} encontrado${qtd !== 1 ? "s" : ""}`;
  resumo.textContent = `${receitas} receita${receitas !== 1 ? "s" : ""} · ${despesas} despesa${despesas !== 1 ? "s" : ""}`;

  tbody.innerHTML = "";

  importarTransacoes.forEach((t, idx) => {
    const tr = document.createElement("tr");
    const valorFormatado = formatadorBRL.format(t.valor);
    const classeTipo = t.tipo === "receita" ? "importar-receita" : "importar-despesa";
    const sinal = t.tipo === "receita" ? "+" : "-";

    tr.innerHTML = `
      <td class="importar-td-check"><input type="checkbox" data-idx="${idx}" ${t.selecionada ? "checked" : ""} /></td>
      <td>${t.data || "-"}</td>
      <td>${escaparHtml(t.descricao)}</td>
      <td class="importar-td-valor ${classeTipo}">${sinal} ${valorFormatado}</td>
      <td class="importar-td-categoria">
        <select data-idx="${idx}">
          <option value="Alimentação">Alimentação</option>
          <option value="Transporte">Transporte</option>
          <option value="Moradia">Moradia</option>
          <option value="Saúde">Saúde</option>
          <option value="Educação">Educação</option>
          <option value="Lazer">Lazer</option>
          <option value="Vestuário">Vestuário</option>
          <option value="Serviços">Serviços</option>
          <option value="Transferência">Transferência</option>
          <option value="Salário">Salário</option>
          <option value="Outros">Outros</option>
        </select>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("input[type='checkbox']").forEach((chk) => {
    chk.addEventListener("change", () => {
      importarTransacoes[Number(chk.dataset.idx)].selecionada = chk.checked;
      atualizarResumoImportacao();
    });
  });

  tbody.querySelectorAll("select").forEach((sel) => {
    sel.addEventListener("change", () => {
      importarTransacoes[Number(sel.dataset.idx)].categoriaManual = sel.value;
    });
  });

  document.getElementById("importar-marcar-todos")?.addEventListener("change", (e) => {
    const marcado = e.target.checked;
    importarTransacoes.forEach((t) => (t.selecionada = marcado));
    tbody.querySelectorAll("input[type='checkbox']").forEach((chk) => (chk.checked = marcado));
    atualizarResumoImportacao();
  });
}

function atualizarResumoImportacao() {
  const selecionadas = importarTransacoes.filter((t) => t.selecionada);
  const receitas = selecionadas.filter((t) => t.tipo === "receita").reduce((s, t) => s + t.valor, 0);
  const despesas = selecionadas.filter((t) => t.tipo === "despesa").reduce((s, t) => s + t.valor, 0);
  const resumo = document.getElementById("importar-resumo");
  if (resumo) {
    const partes = [];
    if (selecionadas.length < importarTransacoes.length) partes.push(`${selecionadas.length}/${importarTransacoes.length} selecionados`);
    if (receitas > 0) partes.push(`Receitas: ${formatadorBRL.format(receitas)}`);
    if (despesas > 0) partes.push(`Despesas: ${formatadorBRL.format(despesas)}`);
    resumo.textContent = partes.join(" · ");
  }
}

// ==========================================
// IMPORTAÇÃO (envia para a API)
// ==========================================
async function executarImportacao() {
  const selecionadas = importarTransacoes.filter((t) => t.selecionada);
  if (selecionadas.length === 0) {
    await mostrarAviso("Nenhum lançamento selecionado para importar.");
    return;
  }

  const carteiraId = document.getElementById("seletor-carteira").value;
  if (!carteiraId) {
    await mostrarAviso("Aguarde suas carteiras carregarem.");
    return;
  }

  const btn = document.getElementById("importar-confirmar");
  btn.disabled = true;
  btn.innerText = "Importando...";

  let importados = 0;
  let erros = 0;

  for (const t of selecionadas) {
    try {
      const corpo = {
        tipo: t.tipo,
        descricao: t.descricao,
        valor: t.valor,
        data_compra: t.data || new Date().toISOString().slice(0, 10),
        categoria: t.categoriaManual || "Outros",
        meio_pagamento: "outro",
        status: "pago",
        carteira_id: carteiraId,
      };

      const resposta = await fetch(`${API_URL}/api/lancamentos`, {
        method: "POST",
        headers: headersAutenticados(),
        body: JSON.stringify(corpo),
      });

      if (resposta.ok) importados++;
      else erros++;
    } catch {
      erros++;
    }
  }

  btn.disabled = false;
  btn.innerText = "Importar selecionados";

  const modal = document.getElementById("modal-importar");
  modal.style.display = "none";
  liberarFoco();

  let msg = `${importados} lançamento${importados !== 1 ? "s" : ""} importado${importados !== 1 ? "s" : ""} com sucesso.`;
  if (erros > 0) msg += ` ${erros} falhou.`;

  mostrarToast(msg, importados > 0 ? "sucesso" : "erro", 3500);
  if (importados > 0) carregarLancamentos();
}

// ==========================================
// CONTROLE DO MODAL
// ==========================================
function configurarModalImportacao() {
  const modal = document.getElementById("modal-importar");
  const btnAbrir = document.getElementById("btn-importar-extrato");
  const btnFechar = document.getElementById("btn-fechar-modal-importar");
  const dropzone = document.getElementById("importar-dropzone");
  const inputArquivo = document.getElementById("importar-arquivo");
  const btnLimpar = document.getElementById("importar-limpar");
  const btnConfirmar = document.getElementById("importar-confirmar");

  if (!modal || !btnAbrir || !btnFechar || !dropzone || !inputArquivo) return;

  function abrirModal() {
    importarTransacoes = [];
    document.getElementById("importar-preview").style.display = "none";
    dropzone.style.display = "flex";
    inputArquivo.value = "";
    modal.style.display = "flex";
    trapFoco(modal);
  }

  btnAbrir.addEventListener("click", abrirModal);
  btnFechar.addEventListener("click", () => {
    modal.style.display = "none";
    liberarFoco();
  });

  dropzone.addEventListener("click", () => inputArquivo.click());

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    const arquivo = e.dataTransfer.files[0];
    if (arquivo) processarArquivo(arquivo);
  });

  inputArquivo.addEventListener("change", () => {
    if (inputArquivo.files[0]) processarArquivo(inputArquivo.files[0]);
  });

  btnLimpar?.addEventListener("click", () => {
    importarTransacoes = [];
    document.getElementById("importar-preview").style.display = "none";
    dropzone.style.display = "flex";
    inputArquivo.value = "";
  });

  btnConfirmar?.addEventListener("click", executarImportacao);
}

function processarArquivo(arquivo) {
  const extensao = arquivo.name.split(".").pop().toLowerCase();
  const leitor = new FileReader();

  leitor.onload = (e) => {
    const texto = e.target.result;

    if (extensao === "ofx" || extensao === "qif") {
      importarTransacoes = parseOFX(texto);
    } else if (extensao === "csv") {
      importarTransacoes = parseCSV(texto);
    } else {
      mostrarAviso("Formato não reconhecido. Use arquivos .OFX, .QIF ou .CSV.");
      return;
    }

    if (importarTransacoes.length === 0) {
      mostrarAviso("Nenhuma transação encontrada no arquivo.");
      return;
    }

    renderizarPreviewImportacao();
  };

  leitor.readAsText(arquivo);
}

document.addEventListener("DOMContentLoaded", configurarModalImportacao);
