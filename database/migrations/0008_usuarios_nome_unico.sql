-- ==========================================
-- Garante nome_usuario único (evita ambiguidade no login e na edição)
-- ==========================================
CREATE UNIQUE INDEX idx_usuarios_nome_usuario ON usuarios(nome_usuario);
