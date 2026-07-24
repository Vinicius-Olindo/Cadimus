-- ==========================================
-- 15. ORDEM DAS CARTEIRAS (por usuário)
-- ==========================================
-- Cada pessoa pode reordenar suas próprias abas de carteira arrastando
-- na tela. Fica em usuarios_carteiras (não em carteiras) porque a ordem
-- é uma preferência de cada usuário, não da carteira em si.
ALTER TABLE usuarios_carteiras ADD COLUMN ordem INTEGER DEFAULT 0;
