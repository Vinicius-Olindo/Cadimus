// ==========================================
// auth.js - Lógica de Login e Autenticação
// ==========================================
import { verificarSenha } from "../utils/crypto.js";
import { criarSessao, encerrarSessao } from "../utils/sessao.js";

export async function processarLogin(request, env) {
  const url = new URL(request.url);

  // ==========================================
  // LOGOUT: encerra a sessão atual
  // ==========================================
  if (request.method === "DELETE" || url.pathname.endsWith("/logout")) {
    await encerrarSessao(request, env);
    return new Response(JSON.stringify({ mensagem: "Sessão encerrada." }), { status: 200 });
  }

  if (request.method !== "POST") return new Response(JSON.stringify({ erro: "Use POST." }), { status: 405 });

  try {
    const corpo = await request.json();
    const { usuario, senha } = corpo;

    if (!usuario || !senha) {
      return new Response(JSON.stringify({ erro: "Usuário e senha são obrigatórios." }), { status: 400 });
    }

    // Busca o usuário pelo nome_usuario (o hash não sai daqui)
    const query = `SELECT id, nome_usuario, perfil, senha_hash FROM usuarios WHERE nome_usuario = ?`;
    const { results } = await env.DB.prepare(query).bind(usuario).all();

    if (results.length === 0) {
      return new Response(JSON.stringify({ erro: "Usuário ou senha incorretos." }), { status: 401 });
    }

    const userDB = results[0];
    const senhaValida = await verificarSenha(senha, userDB.senha_hash);

    if (!senhaValida) {
      return new Response(JSON.stringify({ erro: "Usuário ou senha incorretos." }), { status: 401 });
    }

    // Gera e persiste um token de sessão real (antes o token era descartado)
    const tokenSessao = await criarSessao(env, userDB.id);

    return new Response(
      JSON.stringify({
        mensagem: "Login autorizado!",
        token: tokenSessao,
        usuario: {
          id: userDB.id,
          nome_usuario: userDB.nome_usuario,
          perfil: userDB.perfil,
        },
      }),
      { status: 200 },
    );
  } catch (erro) {
    return new Response(JSON.stringify({ erro: "Erro interno.", detalhe: erro.message }), { status: 500 });
  }
}
