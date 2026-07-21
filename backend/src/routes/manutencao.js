// ==========================================
// manutencao.js - Ações de manutenção do sistema (restrito a superadmin)
// ==========================================
import { obterUsuarioDaSessao } from "../utils/sessao.js";

const CATEGORIAS_PADRAO = ["Mercado", "Transporte", "Moradia", "Contas", "Saúde", "Lazer", "Educação", "Salário", "Outros"];
const FRASE_CONFIRMACAO = "APAGAR TUDO";

export async function processarLimpezaDados(request, env) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ erro: "Método não permitido." }), { status: 405 });
  }

  const usuarioLogado = await obterUsuarioDaSessao(request, env);
  if (!usuarioLogado) {
    return new Response(JSON.stringify({ erro: "Não autenticado." }), { status: 401 });
  }
  if (usuarioLogado.perfil !== "superadmin") {
    return new Response(JSON.stringify({ erro: "Acesso restrito a administradores." }), { status: 403 });
  }

  try {
    const dados = await request.json().catch(() => ({}));

    // Exige digitar a frase exata — é uma ação irreversível que afeta TODO o sistema,
    // não só uma carteira, então o clique sozinho num botão não é confirmação suficiente.
    if (dados.confirmacao !== FRASE_CONFIRMACAO) {
      return new Response(JSON.stringify({ erro: `Confirmação inválida. Digite exatamente "${FRASE_CONFIRMACAO}" para prosseguir.` }), { status: 400 });
    }

    // Ordem importa: lancamentos referencia despesas_fixas e compras_parceladas por
    // chave estrangeira, então precisa ser apagado primeiro.
    await env.DB.prepare(`DELETE FROM lancamentos`).run();
    await env.DB.prepare(`DELETE FROM despesas_fixas`).run();
    await env.DB.prepare(`DELETE FROM compras_parceladas`).run();
    await env.DB.prepare(`DELETE FROM metas_categoria`).run();
    await env.DB.prepare(`DELETE FROM categorias`).run();

    // Restaura a lista de categorias padrão — deixa o app pronto pra usar de novo,
    // em vez de deixar a lista de categorias vazia.
    for (const nome of CATEGORIAS_PADRAO) {
      await env.DB.prepare(`INSERT INTO categorias (nome) VALUES (?)`).bind(nome).run();
    }

    // Não mexe em usuarios, carteiras, usuarios_carteiras nem sessoes — isso preserva
    // os acessos e contas, só zera os dados financeiros de fato.

    return new Response(
      JSON.stringify({ mensagem: "Todos os dados financeiros foram apagados. As categorias padrão foram restauradas." }),
      { status: 200 },
    );
  } catch (erro) {
    return new Response(JSON.stringify({ erro: "Erro ao limpar os dados.", detalhe: erro.message }), { status: 500 });
  }
}
