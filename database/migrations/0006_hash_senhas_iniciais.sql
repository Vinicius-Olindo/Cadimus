-- ==========================================
-- Converte as senhas de texto puro (seed inicial) para hash PBKDF2
-- Formato: "iteracoes:saltHex:hashHex" (ver backend/src/utils/crypto.js)
--
-- IMPORTANTE: a senha continua sendo '123456' para os dois usuários
-- seed (vinicius / parceiro); apenas o valor armazenado deixa de ser
-- texto puro. Troque essas senhas em produção assim que possível.
-- ==========================================
UPDATE usuarios
SET senha_hash = '100000:286ac93e57bbc6f1720b7274fdb6e16b:72573d16035f5f087ae0b22f40efd4fdd83635523f763674075830a3a09725e8'
WHERE nome_usuario IN ('vinicius', 'parceiro');
