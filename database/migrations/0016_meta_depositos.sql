-- ==========================================
-- Depósitos em metas — registrar aportes manuais para acompanhar progresso
-- ==========================================
CREATE TABLE meta_depositos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meta_id INTEGER NOT NULL,
    valor REAL NOT NULL,
    descricao TEXT DEFAULT '',
    criado_por INTEGER NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meta_id) REFERENCES metas_categoria(id) ON DELETE CASCADE,
    FOREIGN KEY (criado_por) REFERENCES usuarios(id)
);
