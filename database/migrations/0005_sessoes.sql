-- ==========================================
-- Tabela de sessões (tokens de login persistidos e com expiração)
-- ==========================================
CREATE TABLE sessoes (
    token TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    expira_em DATETIME NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessoes_usuario ON sessoes(usuario_id);
