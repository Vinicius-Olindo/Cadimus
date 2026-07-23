-- ==========================================
-- Tabela de tokens de recuperação de senha ("esqueci minha senha").
-- Cada token é de uso único, expira rápido e é sempre limpo depois de
-- usado (ou quando expira, na próxima tentativa) — mesmo espírito de
-- "sessoes" e "tentativas_login".
-- ==========================================
CREATE TABLE tokens_recuperacao_senha (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expira_em TEXT NOT NULL,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE INDEX idx_tokens_recuperacao_token ON tokens_recuperacao_senha(token);
