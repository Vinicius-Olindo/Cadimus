-- ==========================================
-- Controle de tentativas de login (rate limit contra força bruta)
-- ==========================================
CREATE TABLE tentativas_login (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identificador TEXT NOT NULL,
    tentativa_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tentativas_login_identificador ON tentativas_login(identificador, tentativa_em);
