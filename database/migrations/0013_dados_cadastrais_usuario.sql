-- ==========================================
-- Dados cadastrais do usuário: nome completo, telefone e foto de perfil.
--
-- O e-mail já existia desde a migration 0001 (era usado como login antes
-- de virarmos para nome_usuario) e já é UNIQUE NOT NULL — a partir de
-- agora ele volta a ser preenchido de verdade, para recuperação de senha.
--
-- foto_perfil guarda uma data URL (base64) já redimensionada e comprimida
-- no navegador antes do envio — ver frontend/js/main.js. Não usamos R2
-- por enquanto pra não exigir configuração extra de infraestrutura;
-- se o app crescer muito, migrar pra R2 é a evolução natural (ver
-- sugestão no chat).
-- ==========================================
ALTER TABLE usuarios ADD COLUMN nome TEXT;
ALTER TABLE usuarios ADD COLUMN telefone TEXT;
ALTER TABLE usuarios ADD COLUMN foto_perfil TEXT;
