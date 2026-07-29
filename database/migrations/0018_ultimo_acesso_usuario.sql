-- Migration 0018: Adiciona coluna ultimo_acesso na tabela usuarios
-- Registra a data/hora do último login bem-sucedido de cada usuário.

ALTER TABLE usuarios ADD COLUMN ultimo_acesso DATETIME;
