-- Planos: projetos financeiros específicos (viagem, compra, reserva, etc.)

CREATE TABLE IF NOT EXISTS planos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  valor_alvo REAL NOT NULL DEFAULT 0,
  depositado REAL NOT NULL DEFAULT 0,
  data_limite TEXT,
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK(prioridade IN ('alta', 'media', 'baixa')),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo', 'concluido', 'cancelado')),
  icone TEXT DEFAULT '🎯',
  cor TEXT DEFAULT '#6366f1',
  criado_em TEXT DEFAULT (datetime('now')),
  atualizado_em TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Depósitos em planos (histórico)
CREATE TABLE IF NOT EXISTS plano_depositos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plano_id INTEGER NOT NULL,
  valor REAL NOT NULL,
  descricao TEXT DEFAULT '',
  criado_em TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (plano_id) REFERENCES planos(id) ON DELETE CASCADE
);
