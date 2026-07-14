-- ==========================================
-- Metas (orçamento) por categoria — um limite mensal opcional por categoria/carteira
-- ==========================================
CREATE TABLE metas_categoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    carteira_id INTEGER NOT NULL,
    categoria TEXT NOT NULL,
    valor_limite REAL NOT NULL,
    criado_por INTEGER NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (carteira_id) REFERENCES carteiras(id),
    FOREIGN KEY (criado_por) REFERENCES usuarios(id),
    UNIQUE (carteira_id, categoria)
);
