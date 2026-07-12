// ==========================================
// usuarios.js - Gestão de Contas e Perfis (somente superadmin)
// ==========================================
import { hashSenha } from "../utils/crypto.js";
import { obterUsuarioDaSessao } from "../utils/sessao.js";

export async function processarUsuarios(request, env) {
  const metodo = request.method;
  const url = new URL(request.url);

  // Todo o painel de usuários é restrito: precisa estar logado E ser superadmin
  const usuarioLogado = await obterUsuarioDaSessao(request, env);
  if (!usuarioLogado) {
    return new Response(JSON.stringify({ erro: "Não autenticado." }), { status: 401 });
  }
  if (usuarioLogado.perfil !== "superadmin") {
    return new Response(JSON.stringify({ erro: "Acesso restrito a administradores." }), { status: 403 });
  }

  // ==========================================
  // LISTAR
  // ==========================================
  if (metodo === "GET") {
    try {
      const query = `SELECT id, nome_usuario, perfil FROM usuarios ORDER BY id ASC`;
      const { results } = await env.DB.prepare(query).all();
      return new Response(JSON.stringify(results), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao buscar usuários." }), { status: 500 });
    }
  }

  // ==========================================
  // CRIAR
  // ==========================================
  if (metodo === "POST") {
    try {
      const dados = await request.json();
      const perfil = dados.perfil === "superadmin" ? "superadmin" : "comum";

      if (!dados.usuario || !dados.senha) {
        return new Response(JSON.stringify({ erro: "Usuário e senha obrigatórios." }), { status: 400 });
      }
      if (dados.senha.length < 6) {
        return new Response(JSON.stringify({ erro: "A senha deve ter ao menos 6 caracteres." }), { status: 400 });
      }

      const { results: existente } = await env.DB.prepare(`SELECT id FROM usuarios WHERE LOWER(nome_usuario) = LOWER(?)`).bind(dados.usuario).all();
      if (existente.length > 0) {
        return new Response(JSON.stringify({ erro: "Já existe um usuário com esse nome." }), { status: 409 });
      }

      // Nunca mais gravamos a senha em texto puro
      const senhaHash = await hashSenha(dados.senha);

      const query = `INSERT INTO usuarios (nome_usuario, senha_hash, perfil) VALUES (?, ?, ?)`;
      await env.DB.prepare(query).bind(dados.usuario, senhaHash, perfil).run();

      return new Response(JSON.stringify({ mensagem: "Usuário cadastrado com sucesso!" }), { status: 201 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao cadastrar." }), { status: 500 });
    }
  }

  // ==========================================
  // EDITAR (nome, perfil e, opcionalmente, senha)
  // ==========================================
  if (metodo === "PUT") {
    try {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ erro: "ID não fornecido." }), { status: 400 });
      }

      const { results: alvo } = await env.DB.prepare(`SELECT id, perfil FROM usuarios WHERE id = ?`).bind(id).all();
      if (alvo.length === 0) {
        return new Response(JSON.stringify({ erro: "Usuário não encontrado." }), { status: 404 });
      }

      const dados = await request.json();
      const campos = [];
      const valores = [];

      if (dados.usuario) {
        const { results: duplicado } = await env.DB.prepare(`SELECT id FROM usuarios WHERE LOWER(nome_usuario) = LOWER(?) AND id != ?`).bind(dados.usuario, id).all();
        if (duplicado.length > 0) {
          return new Response(JSON.stringify({ erro: "Já existe um usuário com esse nome." }), { status: 409 });
        }
        campos.push("nome_usuario = ?");
        valores.push(dados.usuario);
      }

      if (dados.perfil) {
        const novoPerfil = dados.perfil === "superadmin" ? "superadmin" : "comum";

        // Impede remover o último superadmin do sistema (evitaria travar o painel pra sempre)
        if (alvo[0].perfil === "superadmin" && novoPerfil !== "superadmin") {
          const { results: contagem } = await env.DB.prepare(`SELECT COUNT(*) AS total FROM usuarios WHERE perfil = 'superadmin'`).all();
          if (contagem[0].total <= 1) {
            return new Response(JSON.stringify({ erro: "Não é possível remover o último administrador do sistema." }), { status: 400 });
          }
        }

        campos.push("perfil = ?");
        valores.push(novoPerfil);
      }

      if (dados.senha) {
        if (dados.senha.length < 6) {
          return new Response(JSON.stringify({ erro: "A senha deve ter ao menos 6 caracteres." }), { status: 400 });
        }
        campos.push("senha_hash = ?");
        valores.push(await hashSenha(dados.senha));
      }

      if (campos.length === 0) {
        return new Response(JSON.stringify({ erro: "Nada para atualizar." }), { status: 400 });
      }

      valores.push(id);
      await env.DB.prepare(`UPDATE usuarios SET ${campos.join(", ")} WHERE id = ?`)
        .bind(...valores)
        .run();

      return new Response(JSON.stringify({ mensagem: "Usuário atualizado com sucesso!" }), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao atualizar.", detalhe: erro.message }), { status: 500 });
    }
  }

  // ==========================================
  // EXCLUIR
  // ==========================================
  if (metodo === "DELETE") {
    try {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ erro: "ID não fornecido." }), { status: 400 });
      }

      if (Number(id) === usuarioLogado.id) {
        return new Response(JSON.stringify({ erro: "Você não pode excluir a própria conta enquanto está logado nela." }), { status: 400 });
      }

      const { results: alvo } = await env.DB.prepare(`SELECT id, perfil FROM usuarios WHERE id = ?`).bind(id).all();
      if (alvo.length === 0) {
        return new Response(JSON.stringify({ erro: "Usuário não encontrado." }), { status: 404 });
      }

      // Impede excluir o último superadmin
      if (alvo[0].perfil === "superadmin") {
        const { results: contagem } = await env.DB.prepare(`SELECT COUNT(*) AS total FROM usuarios WHERE perfil = 'superadmin'`).all();
        if (contagem[0].total <= 1) {
          return new Response(JSON.stringify({ erro: "Não é possível excluir o último administrador do sistema." }), { status: 400 });
        }
      }

      // Impede excluir quem já tem lançamentos gravados (evita registros órfãos)
      const { results: lancamentosDoUsuario } = await env.DB.prepare(`SELECT COUNT(*) AS total FROM lancamentos WHERE criado_por = ?`).bind(id).all();
      if (lancamentosDoUsuario[0].total > 0) {
        return new Response(
          JSON.stringify({ erro: "Este usuário já tem lançamentos registrados e não pode ser excluído. Você pode alterar o perfil dele em vez de excluir." }),
          { status: 400 },
        );
      }

      // Limpa acessos e sessões antes de remover a conta
      await env.DB.prepare(`DELETE FROM usuarios_carteiras WHERE usuario_id = ?`).bind(id).run();
      await env.DB.prepare(`DELETE FROM sessoes WHERE usuario_id = ?`).bind(id).run();
      await env.DB.prepare(`DELETE FROM usuarios WHERE id = ?`).bind(id).run();

      return new Response(JSON.stringify({ mensagem: "Usuário excluído." }), { status: 200 });
    } catch (erro) {
      return new Response(JSON.stringify({ erro: "Erro ao excluir.", detalhe: erro.message }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ erro: "Método não permitido." }), { status: 405 });
}
