-- 1. Adiciona a coluna para o nome de usuário
ALTER TABLE usuarios ADD COLUMN nome_usuario TEXT;

-- 2. Define os nomes de usuário para as contas que já existem
UPDATE usuarios SET nome_usuario = 'vinicius' WHERE id = 1;
UPDATE usuarios SET nome_usuario = 'parceiro' WHERE id = 2;