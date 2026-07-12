// ==========================================
// categorias.js - Lista de categorias reutilizáveis
// ==========================================
import { obterUsuarioDaSessao } from "../utils/sessao.js";

export async function processarCategorias(request, env) {
  const metodo = request.method;
  const url = new URL(request.url);

  // Qualquer pessoa da casa (autenticada) pode ver e cadastrar categorias
  const usuarioLogado = await obterUsuarioDaSessao(request, env);
  if (!usuarioLogado) {
    return new Response(JSON.stringify({ erro: "Não autenticado." }), { status: 401 });
  }

  if (metodo === "GET") {
    try {
      const { results } = await env.DB.prepare(`SELECT id, nome FROM categorias ORDER BY nome ASC`).all();
      return new Response(JSON.stringify(results), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao buscar categorias." }), { status: 500 });
    }
  }

  if (metodo === "POST") {
    try {
      const dados = await request.json();
      const nome = (dados.nome || "").trim();

      if (!nome) {
        return new Response(JSON.stringify({ erro: "Informe um nome para a categoria." }), { status: 400 });
      }
      if (nome.length > 40) {
        return new Response(JSON.stringify({ erro: "Nome de categoria muito longo (máx. 40 caracteres)." }), { status: 400 });
      }

      // Se já existir (comparação sem diferenciar maiúsculas/minúsculas), reaproveita em vez de duplicar
      const { results: existentes } = await env.DB.prepare(`SELECT id, nome FROM categorias WHERE LOWER(nome) = LOWER(?)`).bind(nome).all();
      if (existentes.length > 0) {
        return new Response(JSON.stringify(existentes[0]), { status: 200 });
      }

      const resultado = await env.DB.prepare(`INSERT INTO categorias (nome) VALUES (?)`).bind(nome).run();
      return new Response(JSON.stringify({ id: resultado.meta.last_row_id, nome }), { status: 201 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao cadastrar categoria." }), { status: 500 });
    }
  }

  // Excluir só pode quem administra — remover categoria em uso não afeta lançamentos já salvos
  // (a categoria do lançamento é um texto próprio, não depende desta tabela)
  if (metodo === "DELETE") {
    if (usuarioLogado.perfil !== "superadmin") {
      return new Response(JSON.stringify({ erro: "Acesso restrito a administradores." }), { status: 403 });
    }
    try {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ erro: "ID não fornecido." }), { status: 400 });
      }
      await env.DB.prepare(`DELETE FROM categorias WHERE id = ?`).bind(id).run();
      return new Response(JSON.stringify({ mensagem: "Categoria excluída." }), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao excluir categoria." }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ erro: "Método não permitido." }), { status: 405 });
}
