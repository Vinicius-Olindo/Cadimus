-- 1. Adiciona a coluna de perfil na tabela de usuários (o padrão será usuário comum)
ALTER TABLE usuarios ADD COLUMN perfil TEXT DEFAULT 'comum';

-- 2. Transforma a sua conta (o primeiro usuário que criamos) no Super Admin
UPDATE usuarios SET perfil = 'superadmin' WHERE id = 1;