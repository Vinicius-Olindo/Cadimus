-- Migration 0019: Adiciona coluna ativo na tabela usuarios
-- Por padrão todos os usuarios existentes ficam ativos.
-- Usuarios inativos nao conseguem fazer login.

ALTER TABLE usuarios ADD COLUMN ativo INTEGER DEFAULT 1;
