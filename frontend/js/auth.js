const API_URL = "https://cadimus-backend.olinbytedigital.workers.dev";

function alternarTelas(estaLogado) {
  const sLogin = document.getElementById("login-section");
  const sDash = document.getElementById("dashboard-section");
  const sAdmin = document.getElementById("admin-section");
  const bAdmin = document.getElementById("btn-admin");

  if (estaLogado) {
    sLogin.style.display = "none";
    sDash.style.display = "block";
    sAdmin.style.display = "none";

    const u = JSON.parse(localStorage.getItem("cadimus_usuario") || "{}");
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
        localStorage.setItem("cadimus_token", d.token);
        localStorage.setItem("cadimus_usuario", JSON.stringify(d.usuario));
        alternarTelas(true);
      } else {
        alert(d.erro);
      }
    });
  }
  document.getElementById("btn-logout")?.addEventListener("click", async () => {
    const token = localStorage.getItem("cadimus_token");
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
    localStorage.clear();
    alternarTelas(false);
  });
  alternarTelas(!!localStorage.getItem("cadimus_token"));
});
