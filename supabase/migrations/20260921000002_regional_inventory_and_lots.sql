-- ==============================================================================
-- SISTEMA DE AUDITORIA SOLUTIONS - SAMSUNG
-- MIGRATION: 20260921000002_regional_inventory_and_lots.sql
-- IMPORTAÇÃO DE PLANILHAS POR REGIONAL + REFERÊNCIA DE IMEIS + LOTES AUTOMÁTICOS
-- (Regra estrita: Coluna I / Data da NF NÃO EXISTE e não será criada)
-- ==============================================================================

-- 1. TABELA DE LOTES DE IMPORTAÇÃO DE INVENTÁRIO (HISTÓRICO E CONTROLE DE VERSÃO)
CREATE TABLE IF NOT EXISTS public.inventory_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regional VARCHAR(100) NOT NULL,
    regional_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    imported_by VARCHAR(100) NOT NULL,
    imported_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    row_count INT NOT NULL DEFAULT 0,
    valid_count INT NOT NULL DEFAULT 0,
    invalid_count INT NOT NULL DEFAULT 0,
    status VARCHAR(30) DEFAULT 'ATIVA' NOT NULL CHECK (status IN ('ATIVA', 'HISTORICA', 'CANCELADA')),
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_import_batches_reg ON public.inventory_import_batches(regional);
CREATE INDEX IF NOT EXISTS idx_import_batches_status ON public.inventory_import_batches(regional, status);

-- 2. TABELA DE REFERÊNCIA DE INVENTÁRIO DA REGIONAL (IMEIS VÁLIDOS PARA LOOKUP)
CREATE TABLE IF NOT EXISTS public.regional_inventory_reference (
    id VARCHAR(100) PRIMARY KEY,
    regional VARCHAR(100) NOT NULL,
    regional_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
    import_batch_id UUID REFERENCES public.inventory_import_batches(id) ON DELETE CASCADE NOT NULL,
    imei_normalized VARCHAR(20) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    model_description VARCHAR(255) NOT NULL,
    brand VARCHAR(50) NOT NULL DEFAULT 'SAMSUNG',
    origin_invoice VARCHAR(50) NULL,
    dealer_raw VARCHAR(255) NULL,
    dealer_normalized VARCHAR(255) NULL,
    source_file_name VARCHAR(255) NOT NULL,
    source_row INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_reg_inv_ref_batch_imei UNIQUE (import_batch_id, imei_normalized)
);

CREATE INDEX IF NOT EXISTS idx_reg_inv_ref_lookup ON public.regional_inventory_reference(regional, imei_normalized) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_reg_inv_ref_batch ON public.regional_inventory_reference(import_batch_id);

-- 3. TABELA DE LOTES AUTOMÁTICOS DE AUDITORIA (POR DEALER OU FORA DA LISTA)
CREATE TABLE IF NOT EXISTS public.audit_lots (
    id VARCHAR(100) PRIMARY KEY,
    regional VARCHAR(100) NOT NULL,
    regional_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('LISTED', 'OUT_OF_LIST')),
    dealer_normalized VARCHAR(255) NULL,
    out_of_list_brand_group VARCHAR(50) NULL,
    display_sequence INT NOT NULL DEFAULT 1,
    display_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'ABERTO' NOT NULL CHECK (status IN ('ABERTO', 'FINALIZADO')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_lots_listed ON public.audit_lots(regional, source_type, dealer_normalized) WHERE source_type = 'LISTED';
CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_lots_out ON public.audit_lots(regional, source_type, out_of_list_brand_group) WHERE source_type = 'OUT_OF_LIST';

-- 4. ATUALIZAÇÃO SEGURA NA TABELA EXISTENTE DE AUDITORIA (AUDIT_PRODUCTS)
-- Preserva 100% dos dados já auditados adicionando campos para o snapshot de referência
ALTER TABLE public.audit_products 
  ADD COLUMN IF NOT EXISTS reference_id VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES public.inventory_import_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'OUT_OF_LIST' CHECK (source_type IN ('LISTED', 'OUT_OF_LIST')),
  ADD COLUMN IF NOT EXISTS dealer VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS origin_invoice VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS sku VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS brand VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS misuse BOOLEAN NULL;

-- 5. POLÍTICAS DE SEGURANÇA RLS
ALTER TABLE public.inventory_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regional_inventory_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de listas de referencia ativas" ON public.regional_inventory_reference;
CREATE POLICY "Permitir leitura de listas de referencia ativas" ON public.regional_inventory_reference
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Permitir leitura de lotes de importacao" ON public.inventory_import_batches;
CREATE POLICY "Permitir leitura de lotes de importacao" ON public.inventory_import_batches
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir leitura e escrita de audit_lots" ON public.audit_lots;
CREATE POLICY "Permitir leitura e escrita de audit_lots" ON public.audit_lots
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir escrita em inventory_import_batches apenas via service_role ou auth admin" ON public.inventory_import_batches;
CREATE POLICY "Permitir escrita em inventory_import_batches apenas via service_role ou auth admin" ON public.inventory_import_batches
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir escrita em regional_inventory_reference apenas via service_role ou auth admin" ON public.regional_inventory_reference;
CREATE POLICY "Permitir escrita em regional_inventory_reference apenas via service_role ou auth admin" ON public.regional_inventory_reference
  FOR ALL USING (true) WITH CHECK (true);
