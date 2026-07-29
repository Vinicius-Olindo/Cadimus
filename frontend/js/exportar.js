// ==========================================
// exportar.js — Exportação de lançamentos (CSV / OFX)
// ==========================================

let exportarLancamentosCache = [];

// ==========================================
// PREENCHER FILTROS DO MODAL
// ==========================================
function preencherFiltrosExportacao() {
  const selCategoria = document.getElementById("exportar-categoria");
  if (!selCategoria) return;

  selCategoria.innerHTML = '<option value="todas">Todas</option>';
  if (typeof categoriasGlobais !== "undefined" && Array.isArray(categoriasGlobais)) {
    categoriasGlobais.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.nome;
      opt.textContent = c.nome;
      selCategoria.appendChild(opt);
    });
  }

  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  document.getElementById("exportar-data-inicio").value = formatarDataIso(primeiroDiaMes);
  document.getElementById("exportar-data-fim").value = formatarDataIso(hoje);
}

function formatarDataIso(data) {
  return data.toISOString().split("T")[0];
}

// ==========================================
// BUSCAR LANÇAMENTOS FILTRADOS
// ==========================================
async function buscarLancamentosParaExportar() {
  const dataInicio = document.getElementById("exportar-data-inicio").value;
  const dataFim = document.getElementById("exportar-data-fim").value;
  const tipo = document.getElementById("exportar-tipo").value;
  const categoria = document.getElementById("exportar-categoria").value;

  const params = new URLSearchParams();
  if (dataInicio) params.append("data_inicio", dataInicio);
  if (dataFim) params.append("data_fim", dataFim);
  if (tipo !== "todos") params.append("tipo", tipo);
  if (categoria !== "todas") params.append("categoria", categoria);

  try {
    const url = `${API_URL}/api/lancamentos?${params.toString()}`;
    const resp = await fetch(url, { headers: headersAutenticados() });
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data) ? data : (data.lancamentos || []);
  } catch {
    return [];
  }
}

async function atualizarResumoExportacao() {
  const info = document.getElementById("exportar-info");
  if (!info) return;

  const lancamentos = await buscarLancamentosParaExportar();
  exportarLancamentosCache = lancamentos;

  if (lancamentos.length === 0) {
    info.textContent = "Nenhum lançamento encontrado para os filtros selecionados.";
    return;
  }

  const totalReceitas = lancamentos.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0);
  const totalDespesas = lancamentos.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);

  const partes = [`${lancamentos.length} lançamento${lancamentos.length !== 1 ? "s" : ""}`];
  if (totalReceitas > 0) partes.push(`Receitas: ${formatadorBRL.format(totalReceitas)}`);
  if (totalDespesas > 0) partes.push(`Despesas: ${formatadorBRL.format(totalDespesas)}`);
  info.textContent = partes.join(" · ");
}

// ==========================================
// GERAR CSV
// ==========================================
function gerarCSV(lancamentos) {
  const cabecalho = "Data;Tipo;Descricao;Valor;Categoria;Pagamento;Status;Carteira";
  const linhas = lancamentos.map((l) => {
    const data = l.data_compra || l.data || "";
    const desc = (l.descricao || "").replace(/;/g, ",").replace(/"/g, '""');
    const valor = (l.valor || 0).toFixed(2).replace(".", ",");
    const cat = l.categoria || "";
    const pagamento = l.meio_pagamento || "";
    const status = l.status || "";
    const carteira = l.carteira_nome || "";
    return `${data};${l.tipo};${desc};${valor};${cat};${pagamento};${status};${carteira}`;
  });

  const BOM = "\uFEFF";
  return BOM + cabecalho + "\n" + linhas.join("\n");
}

// ==========================================
// GERAR OFX
// ==========================================
function gerarOFX(lancamentos) {
  const formatarDataOFX = (dataStr) => {
    if (!dataStr) return "";
    return dataStr.replace(/-/g, "");
  };

  const formatarValorOFX = (valor, tipo) => {
    const sinal = tipo === "despesa" ? "-" : "";
    return sinal + valor.toFixed(2);
  };

  let corpo = "";

  lancamentos.forEach((l, idx) => {
    const data = formatarDataOFX(l.data_compra || l.data);
    const valor = formatarValorOFX(l.valor || 0, l.tipo);
    const desc = (l.descricao || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fitid = `CAD${data}${String(idx).padStart(4, "0")}`;

    corpo += `
  <STMTTRN>
    <TRNTYPE>${l.tipo === "receita" ? "CREDIT" : "DEBIT"}</TRNTOF>
    <DTPOSTED>${data}</DTPOSTED>
    <TRNAMT>${valor}</TRNAMT>
    <FITID>${fitid}</FITID>
    <NAME>${desc}</NAME>
    <MEMO>${desc}</MEMO>
  </STMTTRN>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0</CODE>
        <SEVERITY>INFO</SEVERITY>
      </STATUS>
      <DTSERVER>${new Date().toISOString().slice(0, 10).replace(/-/g, "")}</DTSERVER>
      <LANGUAGE>POR</LANGUAGE>
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <CURDEF>BRL</CURDEF>
        <BANKTRANLIST>
          ${corpo}
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;
}

// ==========================================
// DOWNLOAD DO ARQUIVO
// ==========================================
function downloadArquivo(conteudo, nomeArquivo, tipoMime) {
  const blob = new Blob([conteudo], { type: tipoMime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==========================================
// EXECUTAR EXPORTAÇÃO
// ==========================================
async function executarExportacao() {
  if (exportarLancamentosCache.length === 0) {
    await mostrarAviso("Nenhum lançamento para exportar. Ajuste os filtros.");
    return;
  }

  const formato = document.querySelector('input[name="exportar-formato"]:checked').value;
  const hoje = new Date().toISOString().slice(0, 10);
  let conteudo, nomeArquivo, tipoMime;

  if (formato === "csv") {
    conteudo = gerarCSV(exportarLancamentosCache);
    nomeArquivo = `cadimus-exportacao-${hoje}.csv`;
    tipoMime = "text/csv;charset=utf-8";
  } else {
    conteudo = gerarOFX(exportarLancamentosCache);
    nomeArquivo = `cadimus-exportacao-${hoje}.ofx`;
    tipoMime = "application/xml";
  }

  downloadArquivo(conteudo, nomeArquivo, tipoMime);

  const modal = document.getElementById("modal-exportar");
  modal.style.display = "none";
  liberarFoco();

  mostrarToast(`${exportarLancamentosCache.length} lançamento${exportarLancamentosCache.length !== 1 ? "s" : ""} exportado${exportarLancamentosCache.length !== 1 ? "s" : ""}.`, "sucesso", 3000);
}

// ==========================================
// CONTROLE DO MODAL
// ==========================================
function configurarModalExportacao() {
  const modal = document.getElementById("modal-exportar");
  const btnAbrir = document.getElementById("btn-exportar-extrato");
  const btnFechar = document.getElementById("btn-fechar-modal-exportar");
  const btnBaixar = document.getElementById("btn-exportar-baixar");
  const selTipo = document.getElementById("exportar-tipo");
  const selCategoria = document.getElementById("exportar-categoria");
  const inputInicio = document.getElementById("exportar-data-inicio");
  const inputFim = document.getElementById("exportar-data-fim");

  if (!modal || !btnAbrir || !btnFechar) return;

  function abrirModal() {
    preencherFiltrosExportacao();
    exportarLancamentosCache = [];
    document.getElementById("exportar-info").textContent = "";
    modal.style.display = "flex";
    trapFoco(modal);
    setTimeout(() => atualizarResumoExportacao(), 100);
  }

  btnAbrir.addEventListener("click", abrirModal);
  btnFechar.addEventListener("click", () => {
    modal.style.display = "none";
    liberarFoco();
  });

  selTipo?.addEventListener("change", atualizarResumoExportacao);
  selCategoria?.addEventListener("change", atualizarResumoExportacao);
  inputInicio?.addEventListener("change", atualizarResumoExportacao);
  inputFim?.addEventListener("change", atualizarResumoExportacao);

  document.querySelectorAll('input[name="exportar-formato"]').forEach((r) => {
    r.addEventListener("change", atualizarResumoExportacao);
  });

  btnBaixar?.addEventListener("click", executarExportacao);
}

document.addEventListener("DOMContentLoaded", configurarModalExportacao);
