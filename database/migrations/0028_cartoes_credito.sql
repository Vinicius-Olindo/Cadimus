-- Migration 0028: Cartões de crédito
CREATE TABLE IF NOT EXISTS cartoes_credito (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  bandeira TEXT DEFAULT 'outro', -- visa, mastercard, elo, amex, outro
  ultimos4 TEXT, -- últimos 4 dígitos para identificação
  dia_fechamento INTEGER NOT NULL CHECK(dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento INTEGER NOT NULL CHECK(dia_vencimento BETWEEN 1 AND 31),
  limite REAL DEFAULT 0,
  carteira_id INTEGER NOT NULL REFERENCES carteiras(id),
  criado_por INTEGER NOT NULL REFERENCES usuarios(id),
  ativo INTEGER DEFAULT 1,
  criado_em TEXT DEFAULT (datetime('now'))
);

-- Parcelas no cartão (criadas automaticamente ao selecionar cartão na compra parcelada)
-- A tabela compras_parceladas já existe; vamos adicionar referência ao cartão
ALTER TABLE compras_parceladas ADD COLUMN cartao_credito_id INTEGER REFERENCES cartoes_credito(id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cartoes_carteira ON cartoes_credito(carteira_id);
CREATE INDEX IF NOT EXISTS idx_cartoes_criado_por ON cartoes_credito(criado_por);
