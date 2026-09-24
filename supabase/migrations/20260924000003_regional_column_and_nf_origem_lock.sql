-- ==============================================================================
-- SISTEMA DE AUDITORIA SOLUTIONS - SAMSUNG
-- MIGRATION: 20260924000003_regional_column_and_nf_origem_lock.sql
-- ADIÇÃO DOS CAMPOS REGIONAL E NFORIGEM_SAMSUNG NAS TABELAS
-- (regional_inventory_reference, audit_products, lots, audit_lots)
-- ==============================================================================

-- 1. TABELA DE REFERÊNCIA REGIONAL (regional_inventory_reference)
-- Garante nf_origem_samsung oficial persistido junto com a regional do IMEI
ALTER TABLE public.regional_inventory_reference 
  ADD COLUMN IF NOT EXISTS nf_origem_samsung VARCHAR(100) NULL;

CREATE INDEX IF NOT EXISTS idx_reg_inv_ref_nforigem 
  ON public.regional_inventory_reference(nf_origem_samsung);

-- Backfill idempotente da referência
UPDATE public.regional_inventory_reference
SET nf_origem_samsung = origin_invoice
WHERE nf_origem_samsung IS NULL AND origin_invoice IS NOT NULL;


-- 2. TABELA PRINCIPAL DE PRODUTOS AUDITADOS (audit_products)
-- Adiciona regional textual e nf_origem_samsung oficial para consulta e espelhos
ALTER TABLE public.audit_products 
  ADD COLUMN IF NOT EXISTS regional VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS nf_origem_samsung VARCHAR(100) NULL;

CREATE INDEX IF NOT EXISTS idx_audit_products_reg_str 
  ON public.audit_products(regional);

CREATE INDEX IF NOT EXISTS idx_audit_products_nforigem 
  ON public.audit_products(numero_caixa, nf_origem_samsung);

-- Backfill idempotente em audit_products
UPDATE public.audit_products
SET nf_origem_samsung = origin_invoice
WHERE nf_origem_samsung IS NULL AND origin_invoice IS NOT NULL;

UPDATE public.audit_products p
SET regional = COALESCE(r.nome, r.codigo, 'VIA VAREJO RJ')
FROM public.regions r
WHERE p.regional_id = r.id AND p.regional IS NULL;


-- 3. TABELA DE LOTES DE AUDITORIA (lots)
ALTER TABLE public.lots 
  ADD COLUMN IF NOT EXISTS regional VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS nf_origem_samsung VARCHAR(100) NULL;

-- Backfill idempotente em lots
UPDATE public.lots l
SET regional = COALESCE(r.nome, r.codigo, 'VIA VAREJO RJ')
FROM public.regions r
WHERE l.regional_id = r.id AND l.regional IS NULL;


-- 4. TABELA DE LOTES DINÂMICOS (audit_lots)
ALTER TABLE public.audit_lots 
  ADD COLUMN IF NOT EXISTS nf_origem_samsung VARCHAR(100) NULL;

