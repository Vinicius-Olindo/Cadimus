-- ==========================================
-- Tabela de categorias (lista reutilizável para os lançamentos)
-- Obs: lancamentos.categoria continua sendo TEXT livre — esta tabela
-- serve para alimentar o seletor da interface e evitar duplicidade.
-- ==========================================
CREATE TABLE categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO categorias (nome) VALUES
    ('Mercado'),
    ('Transporte'),
    ('Moradia'),
    ('Contas'),
    ('Saúde'),
    ('Lazer'),
    ('Educação'),
    ('Salário'),
    ('Outros');
