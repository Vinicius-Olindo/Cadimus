// ==========================================
// auth.js - Lógica de Login e Autenticação
// ==========================================
import { verificarSenha } from "../utils/crypto.js";
import { criarSessao, encerrarSessao } from "../utils/sessao.js";

const LIMITE_TENTATIVAS = 5; // por usuário, dentro dos últimos 15 minutos (ver datetime('now', '-15 minutes') abaixo)

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

    const identificador = usuario.trim().toLowerCase();

    // Limpeza preguiçosa: some com tentativas velhas pra tabela não crescer sem parar.
    // Usa datetime() do próprio SQLite (mesmo formato do CURRENT_TIMESTAMP) em vez de
    // gerar a data no JS — evita descompasso de formato entre os dois lados.
    await env.DB.prepare(`DELETE FROM tentativas_login WHERE tentativa_em <= datetime('now', '-15 minutes')`).run();

    const { results: tentativas } = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM tentativas_login WHERE identificador = ? AND tentativa_em > datetime('now', '-15 minutes')`,
    )
      .bind(identificador)
      .all();

    if (tentativas[0].total >= LIMITE_TENTATIVAS) {
      return new Response(JSON.stringify({ erro: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente." }), { status: 429 });
    }

    // Busca o usuário pelo nome_usuario, sem diferenciar maiúsculas/minúsculas — teclados
    // de celular costumam capitalizar a primeira letra sozinhos, e o cadastro/edição de
    // usuário já trata "Vinicius" e "vinicius" como o mesmo nome (ver usuarios.js)
    const query = `SELECT id, nome_usuario, perfil, senha_hash FROM usuarios WHERE LOWER(nome_usuario) = LOWER(?)`;
    const { results } = await env.DB.prepare(query).bind(usuario).all();

    const userDB = results[0];
    const senhaValida = userDB ? await verificarSenha(senha, userDB.senha_hash) : false;

    if (!userDB || !senhaValida) {
      // Registra a tentativa errada (mesmo se o usuário nem existir — evita revelar quais contas existem)
      await env.DB.prepare(`INSERT INTO tentativas_login (identificador) VALUES (?)`).bind(identificador).run();
      return new Response(JSON.stringify({ erro: "Usuário ou senha incorretos." }), { status: 401 });
    }

    // Login certo: limpa o histórico de tentativas erradas desse usuário
    await env.DB.prepare(`DELETE FROM tentativas_login WHERE identificador = ?`).bind(identificador).run();

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
