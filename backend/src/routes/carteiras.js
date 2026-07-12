// ==========================================
// carteiras.js - Listagem e criação de carteiras (contas)
// ==========================================
import { obterUsuarioDaSessao } from "../utils/sessao.js";

export async function processarCarteiras(request, env) {
  const metodo = request.method;

  const usuarioLogado = await obterUsuarioDaSessao(request, env);
  if (!usuarioLogado) {
    return new Response(JSON.stringify({ erro: "Não autenticado." }), { status: 401 });
  }

  // ==========================================
  // LISTAR (só as carteiras às quais o usuário tem acesso)
  // ==========================================
  if (metodo === "GET") {
    try {
      const query = `
        SELECT c.id, c.nome, c.tipo, uc.papel
        FROM carteiras c
        JOIN usuarios_carteiras uc ON uc.carteira_id = c.id
        WHERE uc.usuario_id = ?
        ORDER BY c.tipo ASC, c.nome ASC
      `;
      const { results } = await env.DB.prepare(query).bind(usuarioLogado.id).all();
      return new Response(JSON.stringify(results), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao buscar carteiras." }), { status: 500 });
    }
  }

  // ==========================================
  // CRIAR NOVA CARTEIRA
  // ==========================================
  if (metodo === "POST") {
    try {
      const dados = await request.json();
      const nome = (dados.nome || "").trim();
      const tipo = dados.tipo === "compartilhada" ? "compartilhada" : "individual";

      if (!nome) {
        return new Response(JSON.stringify({ erro: "Informe um nome para a carteira." }), { status: 400 });
      }
      if (nome.length > 40) {
        return new Response(JSON.stringify({ erro: "Nome muito longo (máx. 40 caracteres)." }), { status: 400 });
      }

      const resultadoCarteira = await env.DB.prepare(`INSERT INTO carteiras (nome, tipo) VALUES (?, ?)`).bind(nome, tipo).run();
      const novaCarteiraId = resultadoCarteira.meta.last_row_id;

      // Quem criou sempre vira admin da carteira
      await env.DB.prepare(`INSERT INTO usuarios_carteiras (usuario_id, carteira_id, papel) VALUES (?, ?, 'admin')`).bind(usuarioLogado.id, novaCarteiraId).run();

      // Carteira compartilhada: dá acesso automático a todos os outros usuários da casa
      if (tipo === "compartilhada") {
        const { results: outros } = await env.DB.prepare(`SELECT id FROM usuarios WHERE id != ?`).bind(usuarioLogado.id).all();
        for (const outro of outros) {
          await env.DB.prepare(`INSERT INTO usuarios_carteiras (usuario_id, carteira_id, papel) VALUES (?, ?, 'membro')`).bind(outro.id, novaCarteiraId).run();
        }
      }

      return new Response(JSON.stringify({ id: novaCarteiraId, nome, tipo }), { status: 201 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao criar carteira.", detalhe: erro.message }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ erro: "Método não permitido." }), { status: 405 });
}
