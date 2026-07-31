-- Migration 0027: Tabela de orçamentos mensais por categoria
-- Permite ao usuário definir limites de gasto por categoria por mês.

CREATE TABLE IF NOT EXISTS orcamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria TEXT NOT NULL,
    valor REAL NOT NULL,
    carteira_id INTEGER NOT NULL,
    mes INTEGER NOT NULL CHECK(mes BETWEEN 1 AND 12),
    ano INTEGER NOT NULL,
    criado_por INTEGER NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (carteira_id) REFERENCES carteiras(id) ON DELETE CASCADE,
    FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE CASCADE,
    -- Um orçamento por categoria/mês/carteira
    UNIQUE(categoria, carteira_id, mes, ano)
);