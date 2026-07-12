-- ==========================================
-- 1. TABELA DE USUÁRIOS
-- ==========================================
CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 2. TABELA DE CARTEIRAS (Contas)
-- ==========================================
-- Aqui nascem os orçamentos (Ex: "Casa Compartilhada", "Pessoal")
CREATE TABLE carteiras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('individual', 'compartilhada')),
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 3. TABELA DE PERMISSÕES (Segurança)
-- ==========================================
-- Define quem tem acesso a qual carteira
CREATE TABLE usuarios_carteiras (
    usuario_id INTEGER,
    carteira_id INTEGER,
    papel TEXT DEFAULT 'membro',
    PRIMARY KEY (usuario_id, carteira_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (carteira_id) REFERENCES carteiras(id) ON DELETE CASCADE
);

-- ==========================================
-- 4. TABELA DE LANÇAMENTOS (As despesas e receitas)
-- ==========================================
CREATE TABLE lancamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descricao TEXT NOT NULL,
    valor REAL NOT NULL,
    data_compra DATE NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('receita', 'despesa')),
    categoria TEXT NOT NULL,
    meio_pagamento TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pendente', 'pago')),
    
    -- Amarra o gasto à carteira certa e a quem digitou
    carteira_id INTEGER NOT NULL,
    criado_por INTEGER NOT NULL,
    
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (carteira_id) REFERENCES carteiras(id) ON DELETE CASCADE,
    FOREIGN KEY (criado_por) REFERENCES usuarios(id)
);