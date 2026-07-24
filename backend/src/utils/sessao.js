// ==========================================
// sessao.js - Criação e validação de sessões de login
// ==========================================

const DURACAO_SESSAO_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export async function criarSessao(env, usuarioId) {
  const token = crypto.randomUUID();
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS).toISOString();

  await env.DB.prepare(`INSERT INTO sessoes (token, usuario_id, expira_em) VALUES (?, ?, ?)`).bind(token, usuarioId, expiraEm).run();

  return token;
}

/**
 * Remove sessões expiradas do banco.
 * Chamado em background (ctx.waitUntil) a cada requisição autenticada —
 * não bloqueia a resposta, mas vai limpando a tabela ao longo do tempo
 * sem precisar de um job agendado separado.
 */
export async function limparSessoesExpiradas(env) {
  await env.DB.prepare(`DELETE FROM sessoes WHERE expira_em < datetime('now')`).run();
}

/**
 * Lê o header Authorization: Bearer <token>, valida contra o banco
 * e retorna o usuário logado (ou null se não autenticado/expirado).
 */
export async function obterUsuarioDaSessao(request, env, ctx) {
  const cabecalho = request.headers.get("Authorization") || "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7).trim() : null;
  if (!token) return null;

  const query = `
    SELECT u.id, u.nome_usuario, u.perfil, s.expira_em
    FROM sessoes s
    JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token = ?
  `;
  const { results } = await env.DB.prepare(query).bind(token).all();
  if (results.length === 0) return null;

  const sessao = results[0];
  if (new Date(sessao.expira_em) < new Date()) {
    // Sessão expirada: remove e nega acesso
    await env.DB.prepare(`DELETE FROM sessoes WHERE token = ?`).bind(token).run();
    return null;
  }

  // Limpeza em background: não atrasa a resposta, mas vai varrendo registros
  // mortos a cada requisição autenticada (lazy cleanup sem job agendado)
  if (ctx?.waitUntil) {
    ctx.waitUntil(limparSessoesExpiradas(env));
  }

  return { id: sessao.id, nome_usuario: sessao.nome_usuario, perfil: sessao.perfil };
}

export async function encerrarSessao(request, env) {
  const cabecalho = request.headers.get("Authorization") || "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7).trim() : null;
  if (!token) return;
  await env.DB.prepare(`DELETE FROM sessoes WHERE token = ?`).bind(token).run();
}
