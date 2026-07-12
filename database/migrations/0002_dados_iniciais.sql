-- 1. Inserir os Usuários 
-- (Nota: Em produção as senhas seriam criptografadas, aqui usaremos '123456' como exemplo inicial)
INSERT INTO usuarios (email, senha_hash) VALUES 
('vinicius@email.com', '123456'),
('parceiro@email.com', '123456');

-- 2. Inserir as Carteiras (Orçamentos)
INSERT INTO carteiras (nome, tipo) VALUES 
('Casa (Compartilhada)', 'compartilhada'),
('Pessoal - Vinicius', 'individual'),
('Pessoal - Parceiro', 'individual');

-- 3. Distribuir os Acessos (A Mágica da Segurança)
-- Ambos têm acesso à carteira 1 (Casa)
INSERT INTO usuarios_carteiras (usuario_id, carteira_id, papel) VALUES (1, 1, 'admin');
INSERT INTO usuarios_carteiras (usuario_id, carteira_id, papel) VALUES (2, 1, 'admin');

-- Acesso exclusivo às carteiras individuais
INSERT INTO usuarios_carteiras (usuario_id, carteira_id, papel) VALUES (1, 2, 'admin'); -- Vinicius na sua carteira
INSERT INTO usuarios_carteiras (usuario_id, carteira_id, papel) VALUES (2, 3, 'admin'); -- Parceiro na sua carteira