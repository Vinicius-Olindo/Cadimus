// ==========================================
// carteiras.js - Controle de acesso às carteiras do usuário
// ==========================================

export async function obterCarteirasDoUsuario(env, usuarioId) {
  const { results } = await env.DB.prepare(`SELECT carteira_id FROM usuarios_carteiras WHERE usuario_id = ?`).bind(usuarioId).all();

  return results.map((r) => r.carteira_id);
}
