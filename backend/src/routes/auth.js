// ==========================================
// auth.js - Lógica de Login e Autenticação
// ==========================================
import { verificarSenha, hashSenha } from "../utils/crypto.js";
import { criarSessao, encerrarSessao } from "../utils/sessao.js";
import { enviarEmail, templateRecuperacaoSenha } from "../utils/email.js";

const LIMITE_TENTATIVAS = 5; // por usuário, dentro dos últimos 15 minutos (ver datetime('now', '-15 minutes') abaixo)
const DURACAO_TOKEN_RECUPERACAO_MS = 30 * 60 * 1000; // 30 minutos

export async function processarLogin(request, env) {
  const url = new URL(request.url);

  // ==========================================
  // LOGOUT: encerra a sessão atual
  // ==========================================
  if (request.method === "DELETE" || url.pathname.endsWith("/logout")) {
    await encerrarSessao(request, env);
    return new Response(JSON.stringify({ mensagem: "Sessão encerrada." }), { status: 200 });
  }

  // ==========================================
  // ESQUECI MINHA SENHA: gera um token e manda o link por e-mail
  // ==========================================
  if (url.pathname.endsWith("/esqueci-senha")) {
    if (request.method !== "POST") return new Response(JSON.stringify({ erro: "Use POST." }), { status: 405 });

    try {
      const { email } = await request.json();
      const emailNormalizado = (email || "").trim().toLowerCase();

      if (!emailNormalizado) {
        return new Response(JSON.stringify({ erro: "Informe o e-mail." }), { status: 400 });
      }

      // Mesmo limite de tentativas do login, só que por e-mail — evita que alguém
      // fique disparando e-mails de recuperação pra caixa de entrada de outra pessoa.
      const identificador = `reset:${emailNormalizado}`;
      await env.DB.prepare(`DELETE FROM tentativas_login WHERE tentativa_em <= datetime('now', '-15 minutes')`).run();
      const { results: tentativas } = await env.DB.prepare(
        `SELECT COUNT(*) AS total FROM tentativas_login WHERE identificador = ? AND tentativa_em > datetime('now', '-15 minutes')`,
      )
        .bind(identificador)
        .all();
      if (tentativas[0].total >= LIMITE_TENTATIVAS) {
        return new Response(JSON.stringify({ erro: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }), { status: 429 });
      }
      await env.DB.prepare(`INSERT INTO tentativas_login (identificador) VALUES (?)`).bind(identificador).run();

      const { results } = await env.DB.prepare(`SELECT id, nome FROM usuarios WHERE LOWER(email) = LOWER(?)`).bind(emailNormalizado).all();

      // Resposta sempre igual, exista ou não o e-mail — não dá pra alguém usar essa
      // tela pra descobrir quais e-mails estão cadastrados no sistema.
      const mensagemGenerica = { mensagem: "Se esse e-mail estiver cadastrado, você vai receber um link de recuperação em instantes." };

      if (results.length === 0) {
        return new Response(JSON.stringify(mensagemGenerica), { status: 200 });
      }

      const usuarioId = results[0].id;

      // Limpa tokens antigos desse usuário antes de gerar um novo
      await env.DB.prepare(`DELETE FROM tokens_recuperacao_senha WHERE usuario_id = ?`).bind(usuarioId).run();

      const token = crypto.randomUUID();
      const expiraEm = new Date(Date.now() + DURACAO_TOKEN_RECUPERACAO_MS).toISOString();
      await env.DB.prepare(`INSERT INTO tokens_recuperacao_senha (usuario_id, token, expira_em) VALUES (?, ?, ?)`).bind(usuarioId, token, expiraEm).run();

      const linkFrontend = `${env.FRONTEND_URL || ""}?token=${token}`;
      await enviarEmail(env, {
        para: emailNormalizado,
        assunto: "Recuperação de senha — Cadimus",
        html: templateRecuperacaoSenha(linkFrontend),
      });

      return new Response(JSON.stringify(mensagemGenerica), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro interno.", detalhe: erro.message }), { status: 500 });
    }
  }

  // ==========================================
  // REDEFINIR SENHA: valida o token do e-mail e grava a senha nova
  // ==========================================
  if (url.pathname.endsWith("/redefinir-senha")) {
    if (request.method !== "POST") return new Response(JSON.stringify({ erro: "Use POST." }), { status: 405 });

    try {
      const { token, novaSenha } = await request.json();

      if (!token || !novaSenha) {
        return new Response(JSON.stringify({ erro: "Token e nova senha são obrigatórios." }), { status: 400 });
      }
      if (novaSenha.length < 6) {
        return new Response(JSON.stringify({ erro: "A senha deve ter ao menos 6 caracteres." }), { status: 400 });
      }

      const { results } = await env.DB.prepare(`SELECT id, usuario_id, expira_em FROM tokens_recuperacao_senha WHERE token = ?`).bind(token).all();
      if (results.length === 0) {
        return new Response(JSON.stringify({ erro: "Link inválido ou já utilizado. Peça a recuperação de senha novamente." }), { status: 400 });
      }

      const registroToken = results[0];
      if (new Date(registroToken.expira_em) < new Date()) {
        await env.DB.prepare(`DELETE FROM tokens_recuperacao_senha WHERE id = ?`).bind(registroToken.id).run();
        return new Response(JSON.stringify({ erro: "Esse link expirou. Peça a recuperação de senha novamente." }), { status: 400 });
      }

      const senhaHash = await hashSenha(novaSenha);
      await env.DB.prepare(`UPDATE usuarios SET senha_hash = ? WHERE id = ?`).bind(senhaHash, registroToken.usuario_id).run();

      // Token é de uso único
      await env.DB.prepare(`DELETE FROM tokens_recuperacao_senha WHERE id = ?`).bind(registroToken.id).run();

      // Derruba todas as sessões abertas dessa conta — se alguém mais tinha acesso
      // (ex: sessão esquecida aberta em outro aparelho), ele precisa logar de novo
      // com a senha nova.
      await env.DB.prepare(`DELETE FROM sessoes WHERE usuario_id = ?`).bind(registroToken.usuario_id).run();

      return new Response(JSON.stringify({ mensagem: "Senha redefinida com sucesso! Já pode fazer login." }), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro interno.", detalhe: erro.message }), { status: 500 });
    }
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
