// ==========================================
// carteiras.js - Listagem e criação de carteiras (contas)
// ==========================================
import { obterUsuarioDaSessao } from "../utils/sessao.js";

// Filtra e confirma no banco quais ids recebidos são de usuários que existem
// de verdade (usado tanto na criação quanto na edição de membros).
async function idsValidosDeUsuarios(env, idsRecebidos) {
  if (idsRecebidos.length === 0) return [];
  const placeholders = idsRecebidos.map(() => "?").join(", ");
  const { results } = await env.DB.prepare(`SELECT id FROM usuarios WHERE id IN (${placeholders})`)
    .bind(...idsRecebidos)
    .all();
  return results.map((u) => u.id);
}

export async function processarCarteiras(request, env) {
  const metodo = request.method;
  const url = new URL(request.url);

  const usuarioLogado = await obterUsuarioDaSessao(request, env);
  if (!usuarioLogado) {
    return new Response(JSON.stringify({ erro: "Não autenticado." }), { status: 401 });
  }

  // ==========================================
  // LISTAR (só as carteiras às quais o usuário tem acesso)
  // ==========================================
  if (metodo === "GET") {
    try {
      // Lista básica dos outros usuários do sistema, sem dados sensíveis —
      // usada só pra montar a lista de "com quem compartilhar" na tela de
      // nova carteira. Qualquer usuário logado pode ver (não só o admin),
      // já que ele precisa escolher com quem compartilhar.
      if (url.searchParams.get("colegas") === "1") {
        const { results } = await env.DB.prepare(`SELECT id, nome, nome_usuario FROM usuarios WHERE id != ? ORDER BY nome ASC`)
          .bind(usuarioLogado.id)
          .all();
        return new Response(JSON.stringify(results), { status: 200 });
      }

      // Membros atuais de uma carteira específica — só quem já tem acesso a
      // ela pode ver quem mais tem.
      const carteiraMembrosId = url.searchParams.get("membros");
      if (carteiraMembrosId) {
        const { results: acesso } = await env.DB.prepare(`SELECT papel FROM usuarios_carteiras WHERE usuario_id = ? AND carteira_id = ?`)
          .bind(usuarioLogado.id, carteiraMembrosId)
          .all();
        if (acesso.length === 0) {
          return new Response(JSON.stringify({ erro: "Você não tem acesso a essa carteira." }), { status: 403 });
        }

        const { results } = await env.DB.prepare(
          `SELECT u.id, u.nome, u.nome_usuario, uc.papel
           FROM usuarios_carteiras uc
           JOIN usuarios u ON u.id = uc.usuario_id
           WHERE uc.carteira_id = ?
           ORDER BY uc.papel ASC, u.nome ASC`,
        )
          .bind(carteiraMembrosId)
          .all();
        return new Response(JSON.stringify({ souAdmin: acesso[0].papel === "admin", membros: results }), { status: 200 });
      }

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

      // Carteira compartilhada: quem cria escolhe explicitamente com quem
      // compartilhar (não é mais "todo mundo do sistema" automaticamente —
      // isso deixaria de fazer sentido assim que existirem contas que não
      // são da mesma casa). Dá pra ajustar depois em "Gerenciar membros".
      let membrosValidos = [];
      if (tipo === "compartilhada") {
        const idsRecebidos = Array.isArray(dados.membros) ? dados.membros.map(Number).filter((id) => Number.isInteger(id) && id !== usuarioLogado.id) : [];
        membrosValidos = await idsValidosDeUsuarios(env, idsRecebidos);
      }

      const resultadoCarteira = await env.DB.prepare(`INSERT INTO carteiras (nome, tipo) VALUES (?, ?)`).bind(nome, tipo).run();
      const novaCarteiraId = resultadoCarteira.meta.last_row_id;

      // Quem criou sempre vira admin da carteira
      await env.DB.prepare(`INSERT INTO usuarios_carteiras (usuario_id, carteira_id, papel) VALUES (?, ?, 'admin')`).bind(usuarioLogado.id, novaCarteiraId).run();

      for (const membroId of membrosValidos) {
        await env.DB.prepare(`INSERT INTO usuarios_carteiras (usuario_id, carteira_id, papel) VALUES (?, ?, 'membro')`).bind(membroId, novaCarteiraId).run();
      }

      return new Response(JSON.stringify({ id: novaCarteiraId, nome, tipo }), { status: 201 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao criar carteira.", detalhe: erro.message }), { status: 500 });
    }
  }

  // ==========================================
  // EDITAR MEMBROS (adicionar/remover quem tem acesso a uma compartilhada)
  // ==========================================
  if (metodo === "PUT") {
    try {
      const carteiraId = url.searchParams.get("id");
      if (!carteiraId) {
        return new Response(JSON.stringify({ erro: "ID da carteira não fornecido." }), { status: 400 });
      }

      const { results: carteira } = await env.DB.prepare(`SELECT id, tipo FROM carteiras WHERE id = ?`).bind(carteiraId).all();
      if (carteira.length === 0) {
        return new Response(JSON.stringify({ erro: "Carteira não encontrada." }), { status: 404 });
      }
      if (carteira[0].tipo !== "compartilhada") {
        return new Response(JSON.stringify({ erro: "Só é possível gerenciar membros de uma carteira compartilhada." }), { status: 400 });
      }

      // Só quem é admin dessa carteira específica pode mexer em quem tem acesso
      const { results: acesso } = await env.DB.prepare(`SELECT papel FROM usuarios_carteiras WHERE usuario_id = ? AND carteira_id = ?`)
        .bind(usuarioLogado.id, carteiraId)
        .all();
      if (acesso.length === 0 || acesso[0].papel !== "admin") {
        return new Response(JSON.stringify({ erro: "Só um administrador desta carteira pode gerenciar os membros." }), { status: 403 });
      }

      const dados = await request.json();
      const idsRecebidos = Array.isArray(dados.membros) ? dados.membros.map(Number).filter((id) => Number.isInteger(id) && id !== usuarioLogado.id) : [];
      const membrosDesejados = await idsValidosDeUsuarios(env, idsRecebidos);

      // Nunca mexe nos admins por aqui — só na lista de "membro" comum
      const { results: atuais } = await env.DB.prepare(`SELECT usuario_id FROM usuarios_carteiras WHERE carteira_id = ? AND papel = 'membro'`)
        .bind(carteiraId)
        .all();
      const atuaisIds = atuais.map((m) => m.usuario_id);

      const paraRemover = atuaisIds.filter((id) => !membrosDesejados.includes(id));
      const paraAdicionar = membrosDesejados.filter((id) => !atuaisIds.includes(id));

      for (const id of paraRemover) {
        await env.DB.prepare(`DELETE FROM usuarios_carteiras WHERE carteira_id = ? AND usuario_id = ? AND papel = 'membro'`).bind(carteiraId, id).run();
      }
      for (const id of paraAdicionar) {
        await env.DB.prepare(`INSERT INTO usuarios_carteiras (usuario_id, carteira_id, papel) VALUES (?, ?, 'membro')`).bind(id, carteiraId).run();
      }

      return new Response(JSON.stringify({ mensagem: "Membros atualizados com sucesso!" }), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao atualizar membros.", detalhe: erro.message }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ erro: "Método não permitido." }), { status: 405 });
}
