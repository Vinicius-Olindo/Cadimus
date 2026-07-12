-- ==========================================
-- Despesas (e receitas) fixas/recorrentes — ex: aluguel, assinatura, salário
-- O valor não muda de mês pra mês; o sistema gera o lançamento sozinho.
-- ==========================================
CREATE TABLE despesas_fixas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    carteira_id INTEGER NOT NULL,
    descricao TEXT NOT NULL,
    valor REAL NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'despesa' CHECK(tipo IN ('despesa', 'receita')),
    categoria TEXT NOT NULL,
    meio_pagamento TEXT NOT NULL,
    dia_vencimento INTEGER NOT NULL CHECK(dia_vencimento BETWEEN 1 AND 28),
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_por INTEGER NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (carteira_id) REFERENCES carteiras(id),
    FOREIGN KEY (criado_por) REFERENCES usuarios(id)
);

-- Liga cada lançamento gerado automaticamente à despesa fixa que o originou
-- (evita duplicar o mesmo mês e permite pausar/editar a regra depois)
ALTER TABLE lancamentos ADD COLUMN despesa_fixa_id INTEGER REFERENCES despesas_fixas(id);
