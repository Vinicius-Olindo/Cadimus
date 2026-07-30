-- Migration 0023: Planejamento financeiro
-- Adiciona data_limite nas metas e salario nos usuarios.

ALTER TABLE metas_categoria ADD COLUMN data_limite TEXT;
ALTER TABLE usuarios ADD COLUMN salario REAL DEFAULT 0;
