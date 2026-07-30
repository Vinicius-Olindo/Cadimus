-- Migration 0022: Adiciona criado_por na tabela usuarios
-- Permite que cada admin so veja os usuarios que ele mesmo criou.
-- Usuarios criados antes desta migration ficam com criado_por = NULL (visiveis para todos os superadmins).

ALTER TABLE usuarios ADD COLUMN criado_por INTEGER REFERENCES usuarios(id);
