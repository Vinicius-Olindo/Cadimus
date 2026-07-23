const API_URL = "https://cadimus-backend.olinbytedigital.workers.dev";

// ==========================================
// SESSÃO EM MEMÓRIA (de propósito, não usa localStorage/sessionStorage)
// Fechar a aba ou recarregar a página apaga isso automaticamente, forçando
// login de novo — importante num app financeiro que pode ficar numa tela
// compartilhada. A única coisa persistida entre sessões é a preferência de
// tema (claro/escuro), que não é informação sensível.
// ==========================================
const sessaoMemoria = {
  token: null,
  usuario: null,
};

function obterToken() {
  return sessaoMemoria.token;
}

function obterUsuarioLogado() {
  return sessaoMemoria.usuario || {};
}

function salvarSessao(token, usuario) {
  sessaoMemoria.token = token;
  sessaoMemoria.usuario = usuario;
}

function limparSessao() {
  sessaoMemoria.token = null;
  sessaoMemoria.usuario = null;
}

function alternarTelas(estaLogado) {
  const sLogin = document.getElementById("login-section");
  const sDash = document.getElementById("dashboard-section");
  const sAdmin = document.getElementById("admin-section");
  const bAdmin = document.getElementById("btn-admin");

  if (estaLogado) {
    sLogin.style.display = "none";
    sDash.style.display = "block";
    sAdmin.style.display = "none";

    const u = obterUsuarioLogado();
    bAdmin.style.display = u.perfil === "superadmin" ? "inline-block" : "none";
    if (window.carregarCarteiras) window.carregarCarteiras();
  } else {
    sLogin.style.display = "flex"; // Garante o centro da tela
    sDash.style.display = "none";
    sAdmin.style.display = "none";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const fLogin = document.getElementById("login-form");
  if (fLogin) {
    fLogin.addEventListener("submit", async (e) => {
      e.preventDefault();
      const usuario = document.getElementById("usuario").value;
      const senha = document.getElementById("senha").value;
      const res = await fetch(`${API_URL}/api/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, senha }),
      });
      const d = await res.json();
      if (res.ok) {
        salvarSessao(d.token, d.usuario);
        alternarTelas(true);
      } else {
        if (typeof mostrarAviso === "function") {
          await mostrarAviso(d.erro);
        } else {
          alert(d.erro); // segurança: se por algum motivo main.js não carregou ainda
        }
      }
    });
  }
  document.getElementById("btn-logout")?.addEventListener("click", async () => {
    const token = obterToken();
    if (token) {
      try {
        await fetch(`${API_URL}/api/auth`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (erro) {
        // Mesmo se a chamada falhar, seguimos limpando a sessão local
        console.error("Erro ao encerrar sessão no servidor:", erro);
      }
    }
    limparSessao();
    alternarTelas(false);
  });

  // ==========================================
  // ESQUECI MINHA SENHA
  // ==========================================
  const modalEsqueciSenha = document.getElementById("modal-esqueci-senha");
  const formEsqueciSenha = document.getElementById("form-esqueci-senha");

  document.getElementById("link-esqueci-senha")?.addEventListener("click", () => {
    if (modalEsqueciSenha) modalEsqueciSenha.style.display = "flex";
  });

  document.getElementById("btn-fechar-modal-esqueci-senha")?.addEventListener("click", () => {
    if (modalEsqueciSenha) modalEsqueciSenha.style.display = "none";
    formEsqueciSenha?.reset();
  });

  formEsqueciSenha?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("esqueci-email").value.trim();
    const btnEnviar = document.getElementById("btn-enviar-recuperacao");

    btnEnviar.disabled = true;
    btnEnviar.innerText = "Enviando...";

    try {
      const res = await fetch(`${API_URL}/api/auth/esqueci-senha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await res.json();

      if (modalEsqueciSenha) modalEsqueciSenha.style.display = "none";
      formEsqueciSenha.reset();
      await mostrarAviso(res.ok ? d.mensagem : d.erro);
    } catch (erro) {
      await mostrarAviso("Falha na comunicação com o servidor.");
    } finally {
      btnEnviar.disabled = false;
      btnEnviar.innerText = "Enviar link de recuperação";
    }
  });

  // ==========================================
  // REDEFINIR SENHA (link do e-mail: ?token=...)
  // ==========================================
  const tokenRecuperacao = new URLSearchParams(window.location.search).get("token");
  const sRedefinir = document.getElementById("redefinir-senha-section");
  const sLoginInicial = document.getElementById("login-section");

  if (tokenRecuperacao && sRedefinir && sLoginInicial) {
    sLoginInicial.style.display = "none";
    sRedefinir.style.display = "flex";
  }

  document.getElementById("link-voltar-login")?.addEventListener("click", () => {
    if (sRedefinir) sRedefinir.style.display = "none";
    if (sLoginInicial) sLoginInicial.style.display = "flex";
    window.history.replaceState({}, "", window.location.pathname);
  });

  document.getElementById("form-redefinir-senha")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const novaSenha = document.getElementById("redefinir-nova-senha").value;
    const confirmar = document.getElementById("redefinir-confirmar-senha").value;
    const btnSalvar = e.target.querySelector("button[type=submit]");

    if (novaSenha !== confirmar) {
      await mostrarAviso("As senhas não coincidem.");
      return;
    }

    btnSalvar.disabled = true;
    btnSalvar.innerText = "Salvando...";

    try {
      const res = await fetch(`${API_URL}/api/auth/redefinir-senha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenRecuperacao, novaSenha }),
      });
      const d = await res.json();

      await mostrarAviso(res.ok ? d.mensagem : d.erro);

      if (res.ok) {
        window.history.replaceState({}, "", window.location.pathname);
        if (sRedefinir) sRedefinir.style.display = "none";
        if (sLoginInicial) sLoginInicial.style.display = "flex";
      }
    } catch (erro) {
      await mostrarAviso("Falha na comunicação com o servidor.");
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.innerText = "Salvar nova senha";
    }
  });

  // Sempre começa deslogado: a sessão não sobrevive a reload nem a fechar a aba
  // (a não ser que a gente esteja mostrando a tela de redefinir senha)
  if (!tokenRecuperacao) {
    alternarTelas(false);
  }
});
