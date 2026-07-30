-- Adicionar campo compartilhado aos planos
ALTER TABLE planos ADD COLUMN compartilhado INTEGER NOT NULL DEFAULT 0;
