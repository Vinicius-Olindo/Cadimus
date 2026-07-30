-- Migration 0021: Tabela de convites para cadastro de novos usuarios
-- Cada convite gera um token unico que permite ao convidado criar sua conta.
-- O token expira em 3 horas e so pode ser usado uma vez.

CREATE TABLE IF NOT EXISTS convites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  nome TEXT NOT NULL,
  perfil TEXT DEFAULT 'comum',
  criado_por INTEGER REFERENCES usuarios(id),
  expira_em TEXT NOT NULL,
  usado_em TEXT,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);
