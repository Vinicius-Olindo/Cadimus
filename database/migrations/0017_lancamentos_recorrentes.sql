-- ==========================================
-- Lançamentos recorrentes — frequência customizável (semanal, quinzenal, mensal, trimestral, anual)
-- ==========================================
CREATE TABLE lancamentos_recorrentes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    carteira_id INTEGER NOT NULL,
    descricao TEXT NOT NULL,
    valor REAL NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'despesa' CHECK (tipo IN ('despesa', 'receita')),
    categoria TEXT NOT NULL,
    meio_pagamento TEXT NOT NULL,
    frequencia TEXT NOT NULL CHECK (frequencia IN ('semanal', 'quinzenal', 'mensal', 'trimestral', 'anual')),
    dia_semana INTEGER,
    dia_mes INTEGER,
    ativo INTEGER NOT NULL DEFAULT 1,
    data_inicio TEXT NOT NULL,
    data_fim TEXT,
    criado_por INTEGER NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (carteira_id) REFERENCES carteiras(id),
    FOREIGN KEY (criado_por) REFERENCES usuarios(id)
);
