// ==========================================
// usuarios.js - Gestão de Contas e Perfis (somente superadmin)
// ==========================================
import { hashSenha } from "../utils/crypto.js";
import { obterUsuarioDaSessao } from "../utils/sessao.js";

// Regra simples de formato (não valida se o e-mail existe de verdade — isso
// só o envio da confirmação/recuperação por e-mail vai garantir, quando essa
// parte for implementada).
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Tamanho máximo da data URL da foto (base64). Isso equivale a ~220KB de
// imagem já comprimida — a compressão de verdade acontece no navegador
// (ver frontend/js/main.js) antes de chegar aqui; este limite é só uma
// trava de segurança contra uploads gigantes ou manipulados.
const TAMANHO_MAXIMO_FOTO = 300000;

// Valida e normaliza os campos cadastrais (nome, telefone, e-mail, foto).
// Usado tanto na criação quanto na edição. `idAtual` é usado para não
// barrar o próprio e-mail do usuário quando ele edita outra coisa.
async function validarDadosCadastrais(dados, env, idAtual = null) {
  const resultado = {};

  if (dados.nome !== undefined) {
    const nome = String(dados.nome).trim();
    if (!nome) {
      return { erro: "Informe o nome completo." };
    }
    if (nome.length > 80) {
      return { erro: "Nome muito longo (máx. 80 caracteres)." };
    }
    resultado.nome = nome;
  }

  if (dados.email !== undefined) {
    const email = String(dados.email).trim().toLowerCase();
    if (!email || !REGEX_EMAIL.test(email)) {
      return { erro: "Informe um e-mail válido." };
    }

    const condicaoId = idAtual !== null ? "AND id != ?" : "";
    const binds = idAtual !== null ? [email, idAtual] : [email];
    const { results: duplicado } = await env.DB.prepare(`SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?) ${condicaoId}`)
      .bind(...binds)
      .all();
    if (duplicado.length > 0) {
      return { erro: "Já existe um usuário cadastrado com esse e-mail." };
    }
    resultado.email = email;
  }

  if (dados.telefone !== undefined) {
    const digitos = String(dados.telefone).replace(/\D/g, "");
    if (digitos && (digitos.length < 10 || digitos.length > 11)) {
      return { erro: "Telefone inválido (informe DDD + número)." };
    }
    resultado.telefone = digitos || null;
  }

  if (dados.foto_perfil !== undefined) {
    const foto = dados.foto_perfil;
    if (foto) {
      if (typeof foto !== "string" || !foto.startsWith("data:image/")) {
        return { erro: "Foto de perfil inválida." };
      }
      if (foto.length > TAMANHO_MAXIMO_FOTO) {
        return { erro: "Foto de perfil muito grande. Tente uma imagem menor." };
      }
    }
    resultado.foto_perfil = foto || null;
  }

  return resultado;
}

export async function processarUsuarios(request, env, ctx) {
  const metodo = request.method;
  const url = new URL(request.url);

  // Todo o painel de usuários é restrito: precisa estar logado E ser superadmin
  const usuarioLogado = await obterUsuarioDaSessao(request, env, ctx);
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
      const query = `SELECT id, nome_usuario, perfil, nome, telefone, email, foto_perfil FROM usuarios ORDER BY id ASC`;
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
      if (!dados.nome || !dados.email) {
        return new Response(JSON.stringify({ erro: "Nome completo e e-mail são obrigatórios." }), { status: 400 });
      }

      const { results: existente } = await env.DB.prepare(`SELECT id FROM usuarios WHERE LOWER(nome_usuario) = LOWER(?)`).bind(dados.usuario).all();
      if (existente.length > 0) {
        return new Response(JSON.stringify({ erro: "Já existe um usuário com esse nome." }), { status: 409 });
      }

      const cadastrais = await validarDadosCadastrais(dados, env);
      if (cadastrais.erro) {
        return new Response(JSON.stringify({ erro: cadastrais.erro }), { status: 400 });
      }

      // Nunca mais gravamos a senha em texto puro
      const senhaHash = await hashSenha(dados.senha);

      const query = `INSERT INTO usuarios (nome_usuario, senha_hash, perfil, nome, telefone, email, foto_perfil) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      const resultadoUsuario = await env.DB.prepare(query)
        .bind(dados.usuario, senhaHash, perfil, cadastrais.nome, cadastrais.telefone ?? null, cadastrais.email, cadastrais.foto_perfil ?? null)
        .run();
      const novoUsuarioId = resultadoUsuario.meta.last_row_id;

      // Toda conta nova já nasce com sua própria carteira pessoal — sem isso
      // o usuário fica sem nenhum lugar pra lançar nada. Quem cria carteiras
      // compartilhadas continua sendo decisão manual, feita depois pelo próprio
      // usuário (ver carteiras.js).
      try {
        const nomeCarteira = `Pessoal - ${cadastrais.nome}`.slice(0, 40);
        const resultadoCarteira = await env.DB.prepare(`INSERT INTO carteiras (nome, tipo) VALUES (?, 'individual')`).bind(nomeCarteira).run();
        const novaCarteiraId = resultadoCarteira.meta.last_row_id;
        await env.DB.prepare(`INSERT INTO usuarios_carteiras (usuario_id, carteira_id, papel) VALUES (?, ?, 'admin')`)
          .bind(novoUsuarioId, novaCarteiraId)
          .run();
      } catch (erroCarteira) {
        // Desfaz o usuário pra não deixar uma conta órfã, sem carteira e presa
        await env.DB.prepare(`DELETE FROM usuarios WHERE id = ?`).bind(novoUsuarioId).run();
        return new Response(JSON.stringify({ erro: "Usuário não pôde ser cadastrado (falha ao criar a carteira pessoal)." }), { status: 500 });
      }

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

      const cadastrais = await validarDadosCadastrais(dados, env, Number(id));
      if (cadastrais.erro) {
        return new Response(JSON.stringify({ erro: cadastrais.erro }), { status: 400 });
      }
      if (cadastrais.nome !== undefined) {
        campos.push("nome = ?");
        valores.push(cadastrais.nome);
      }
      if (cadastrais.email !== undefined) {
        campos.push("email = ?");
        valores.push(cadastrais.email);
      }
      if (cadastrais.telefone !== undefined) {
        campos.push("telefone = ?");
        valores.push(cadastrais.telefone);
      }
      if (cadastrais.foto_perfil !== undefined) {
        campos.push("foto_perfil = ?");
        valores.push(cadastrais.foto_perfil);
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
