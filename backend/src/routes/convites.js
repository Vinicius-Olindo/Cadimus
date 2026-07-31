// ==========================================
// convites.js - Sistema de Convites para Cadastro
// ==========================================
import { hashSenha } from "../utils/crypto.js";
import { obterUsuarioDaSessao } from "../utils/sessao.js";

const DURACAO_CONVITE_MS = 3 * 60 * 60 * 1000; // 3 horas
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function processarConvites(request, env, ctx) {
  const metodo = request.method;
  const url = new URL(request.url);

  // ==========================================
  // GET /api/convites?token=xxx — Valida token (público)
  // ==========================================
  if (metodo === "GET") {
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response(JSON.stringify({ erro: "Token não fornecido." }), { status: 400 });
    }

    try {
      const { results } = await env.DB.prepare(
        `SELECT id, nome, email, perfil, expira_em, usado_em FROM convites WHERE token = ?`
      ).bind(token).all();

      if (results.length === 0) {
        return new Response(JSON.stringify({ erro: "Convite não encontrado." }), { status: 404 });
      }

      const convite = results[0];

      if (convite.usado_em) {
        return new Response(JSON.stringify({ erro: "Este convite já foi utilizado." }), { status: 410 });
      }

      if (new Date(convite.expira_em) < new Date()) {
        return new Response(JSON.stringify({ erro: "Este convite expirou. Solicite um novo." }), { status: 410 });
      }

      return new Response(JSON.stringify({
        nome: convite.nome,
        email: convite.email,
        perfil: convite.perfil,
      }), { status: 200 });
    } catch (erro) {
      console.error("Erro:", erro);
      return new Response(JSON.stringify({ erro: "Erro ao validar convite." }), { status: 500 });
    }
  }

  // ==========================================
  // POST /api/convites — Cria convite (somente superadmin)
  // ==========================================
  if (metodo === "POST") {
    const body = await request.json().catch(() => ({}));

    // Se tem campo "senha", é aceitação de convite (público)
    if (body.token && body.senha) {
      return aceitarConvite(body, env);
    }

    // Caso contrário, é criação de convite (admin)
    const usuarioLogado = await obterUsuarioDaSessao(request, env, ctx);
    if (!usuarioLogado) {
      return new Response(JSON.stringify({ erro: "Não autenticado." }), { status: 401 });
    }
    if (usuarioLogado.perfil !== "superadmin") {
      return new Response(JSON.stringify({ erro: "Acesso restrito a administradores." }), { status: 403 });
    }

    const { nome, email, perfil } = body;

    if (!nome || !nome.trim()) {
      return new Response(JSON.stringify({ erro: "Informe o nome do convidado." }), { status: 400 });
    }
    if (!email || !REGEX_EMAIL.test(email.trim())) {
      return new Response(JSON.stringify({ erro: "Informe um e-mail válido." }), { status: 400 });
    }

    const perfilFinal = perfil === "superadmin" ? "superadmin" : "comum";

    try {
      // Verifica se já existe usuário com esse e-mail
      const { results: existente } = await env.DB.prepare(
        `SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?)`
      ).bind(email.trim()).all();

      if (existente.length > 0) {
        return new Response(JSON.stringify({ erro: "Já existe um usuário com esse e-mail." }), { status: 409 });
      }

      // Verifica se já existe convite pendente para esse e-mail
      const { results: convitePendente } = await env.DB.prepare(
        `SELECT id FROM convites WHERE LOWER(email) = LOWER(?) AND usado_em IS NULL AND expira_em > datetime('now')`
      ).bind(email.trim()).all();

      if (convitePendente.length > 0) {
        return new Response(JSON.stringify({ erro: "Já existe um convite pendente para esse e-mail." }), { status: 409 });
      }

      const token = crypto.randomUUID();
      const expiraEm = new Date(Date.now() + DURACAO_CONVITE_MS).toISOString();

      await env.DB.prepare(
        `INSERT INTO convites (token, email, nome, perfil, criado_por, expira_em) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(token, email.trim().toLowerCase(), nome.trim(), perfilFinal, usuarioLogado.id, expiraEm).run();

      return new Response(JSON.stringify({
        mensagem: "Convite criado com sucesso!",
        token,
        expira_em: expiraEm,
      }), { status: 201 });
    } catch (erro) {
      console.error("Erro:", erro);
      return new Response(JSON.stringify({ erro: "Erro ao criar convite." }), { status: 500 });
    }
  }

  // ==========================================
  // DELETE /api/convites?id=xxx — Remove convite (admin)
  // ==========================================
  if (metodo === "DELETE") {
    const usuarioLogado = await obterUsuarioDaSessao(request, env, ctx);
    if (!usuarioLogado) {
      return new Response(JSON.stringify({ erro: "Não autenticado." }), { status: 401 });
    }
    if (usuarioLogado.perfil !== "superadmin") {
      return new Response(JSON.stringify({ erro: "Acesso restrito a administradores." }), { status: 403 });
    }

    const id = url.searchParams.get("id");
    if (!id) {
      return new Response(JSON.stringify({ erro: "ID não fornecido." }), { status: 400 });
    }

    try {
      await env.DB.prepare(`DELETE FROM convites WHERE id = ?`).bind(id).run();
      return new Response(JSON.stringify({ mensagem: "Convite removido." }), { status: 200 });
    } catch (erro) {
      console.error("Erro:", erro);
      return new Response(JSON.stringify({ erro: "Erro ao remover convite." }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ erro: "Método não permitido." }), { status: 405 });
}

// ==========================================
// Aceita o convite e cria o usuário
// ==========================================
async function aceitarConvite(body, env) {
  const { token, senha, nome, usuario } = body;

  if (!token || !senha) {
    return new Response(JSON.stringify({ erro: "Token e senha são obrigatórios." }), { status: 400 });
  }

  if (!usuario || !usuario.trim()) {
    return new Response(JSON.stringify({ erro: "Escolha um nome de usuário." }), { status: 400 });
  }

  if (senha.length < 6) {
    return new Response(JSON.stringify({ erro: "A senha deve ter ao menos 6 caracteres." }), { status: 400 });
  }

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, nome, email, perfil, criado_por, expira_em, usado_em FROM convites WHERE token = ?`
    ).bind(token).all();

    if (results.length === 0) {
      return new Response(JSON.stringify({ erro: "Convite não encontrado." }), { status: 404 });
    }

    const convite = results[0];

    if (convite.usado_em) {
      return new Response(JSON.stringify({ erro: "Este convite já foi utilizado." }), { status: 410 });
    }

    if (new Date(convite.expira_em) < new Date()) {
      return new Response(JSON.stringify({ erro: "Este convite expirou. Solicite um novo." }), { status: 410 });
    }

    const nomeUsuario = usuario.trim();

    // Verifica se o nome de usuário já existe
    const { results: usuarioExistente } = await env.DB.prepare(
      `SELECT id FROM usuarios WHERE LOWER(nome_usuario) = LOWER(?)`
    ).bind(nomeUsuario).all();

    if (usuarioExistente.length > 0) {
      return new Response(JSON.stringify({ 
        erro: "Esse nome de usuário já está em uso. Escolha outro."
      }), { status: 409 });
    }

    const senhaHash = await hashSenha(senha);
    const nomeFinal = nome || convite.nome;

    // Cria o usuário com criado_por do admin que gerou o convite
    const resultado = await env.DB.prepare(
      `INSERT INTO usuarios (nome_usuario, senha_hash, perfil, nome, email, criado_por) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(nomeUsuario, senhaHash, convite.perfil, nomeFinal, convite.email, convite.criado_por).run();
    const novoUsuarioId = resultado.meta.last_row_id;

    // Cria carteira pessoal (mesma lógica do cadastro pelo painel admin)
    try {
      const nomeCarteira = `Pessoal - ${nomeFinal}`.slice(0, 40);
      const resultadoCarteira = await env.DB.prepare(`INSERT INTO carteiras (nome, tipo) VALUES (?, 'individual')`).bind(nomeCarteira).run();
      const novaCarteiraId = resultadoCarteira.meta.last_row_id;
      await env.DB.prepare(`INSERT INTO usuarios_carteiras (usuario_id, carteira_id, papel) VALUES (?, ?, 'admin')`)
        .bind(novoUsuarioId, novaCarteiraId)
        .run();
    } catch (erroCarteira) {
      // Desfaz o usuário pra não deixar conta órfã
      await env.DB.prepare(`DELETE FROM usuarios WHERE id = ?`).bind(novoUsuarioId).run();
      return new Response(JSON.stringify({ erro: "Erro ao criar conta. Tente novamente." }), { status: 500 });
    }

    // Marca convite como usado
    await env.DB.prepare(
      `UPDATE convites SET usado_em = datetime('now') WHERE id = ?`
    ).bind(convite.id).run();

    return new Response(JSON.stringify({
      mensagem: "Conta criada com sucesso! Já pode fazer login.",
      usuario: nomeUsuario,
    }), { status: 201 });
  } catch (erro) {
    console.error("Erro:", erro);
    return new Response(JSON.stringify({ erro: "Erro ao criar conta." }), { status: 500 });
  }
}
