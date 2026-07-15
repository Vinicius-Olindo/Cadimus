-- ==========================================
-- Compras parceladas — ex: "Notebook em 10x de R$300"
-- Diferente da despesa fixa: tem início, fim (total_parcelas) e numera cada parcela.
-- ==========================================
CREATE TABLE compras_parceladas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    carteira_id INTEGER NOT NULL,
    descricao TEXT NOT NULL,
    valor_parcela REAL NOT NULL,
    categoria TEXT NOT NULL,
    meio_pagamento TEXT NOT NULL,
    dia_vencimento INTEGER NOT NULL CHECK(dia_vencimento BETWEEN 1 AND 28),
    total_parcelas INTEGER NOT NULL CHECK(total_parcelas >= 2),
    ano_inicio INTEGER NOT NULL,
    mes_inicio INTEGER NOT NULL CHECK(mes_inicio BETWEEN 1 AND 12),
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_por INTEGER NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (carteira_id) REFERENCES carteiras(id),
    FOREIGN KEY (criado_por) REFERENCES usuarios(id)
);

-- Liga cada lançamento gerado à compra parcelada que o originou, e guarda qual parcela é
ALTER TABLE lancamentos ADD COLUMN compra_parcelada_id INTEGER REFERENCES compras_parceladas(id);
ALTER TABLE lancamentos ADD COLUMN numero_parcela INTEGER;
