-- Migration 0026: Tabela de transferências entre carteiras
-- Transferências são operações atômicas que movem dinheiro entre carteiras
-- sem contar como receita ou despesa no dashboard.

CREATE TABLE IF NOT EXISTS transferencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    valor REAL NOT NULL,
    data_transferencia DATE NOT NULL,
    carteira_origem_id INTEGER NOT NULL,
    carteira_destino_id INTEGER NOT NULL,
    descricao TEXT DEFAULT '',
    criado_por INTEGER NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (carteira_origem_id) REFERENCES carteiras(id) ON DELETE CASCADE,
    FOREIGN KEY (carteira_destino_id) REFERENCES carteiras(id) ON DELETE CASCADE,
    FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE CASCADE
);