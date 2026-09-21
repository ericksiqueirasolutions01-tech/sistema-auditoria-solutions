-- ==============================================================================
-- SISTEMA DE AUDITORIA SOLUTIONS - SAMSUNG
-- SCHEMA CENTRAL OFICIAL POSTGRESQL + RLS (SUPABASE)
-- Migração: 20260921000001_sistema_auditoria_solutions_schema.sql
-- ==============================================================================

-- Extensões Criptográficas e UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Trigger para atualização automática de timestamps server-side
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. TABELA DE REGIONAIS (REGIONS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nome VARCHAR(100) UNIQUE NOT NULL,
    ativo BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_timestamp_regions ON public.regions;
CREATE TRIGGER set_timestamp_regions
BEFORE UPDATE ON public.regions
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Seed das regionais homologadas
INSERT INTO public.regions (codigo, nome)
VALUES
    ('RJ', 'VIA VAREJO RJ'),
    ('SP', 'VIA VAREJO SP'),
    ('MG', 'VIA VAREJO MG'),
    ('BA', 'VIA VAREJO BA')
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome;

-- ------------------------------------------------------------------------------
-- 2. TABELA DE PERFIS DE USUÁRIO (PROFILES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE, -- Vínculo com auth.users do Supabase
    login VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(120) NOT NULL,
    perfil VARCHAR(30) NOT NULL CHECK (perfil IN ('SUPER_ADMIN', 'ADMINISTRADOR', 'SUPERVISOR_REGIONAL', 'OPERADOR')),
    regional_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
    ativo BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_login ON public.profiles(login);
CREATE INDEX IF NOT EXISTS idx_profiles_perfil ON public.profiles(perfil);
CREATE INDEX IF NOT EXISTS idx_profiles_regional ON public.profiles(regional_id);

DROP TRIGGER IF EXISTS set_timestamp_profiles ON public.profiles;
CREATE TRIGGER set_timestamp_profiles
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ------------------------------------------------------------------------------
-- 3. TABELA DE DISPOSITIVOS / ESTAÇÕES (DEVICES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    regional_id UUID REFERENCES public.regions(id) ON DELETE RESTRICT NOT NULL,
    status VARCHAR(20) DEFAULT 'ATIVO' NOT NULL CHECK (status IN ('ATIVO', 'PENDENTE', 'REVOGADO')),
    app_version VARCHAR(20) DEFAULT '1.2.0' NOT NULL,
    last_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    revoked_at TIMESTAMPTZ NULL,
    revoked_reason TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_devices_device_id ON public.devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON public.devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_regional ON public.devices(regional_id);

DROP TRIGGER IF EXISTS set_timestamp_devices ON public.devices;
CREATE TRIGGER set_timestamp_devices
BEFORE UPDATE ON public.devices
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ------------------------------------------------------------------------------
-- 4. TABELA DE LOTES DE AUDITORIA (LOTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_lote VARCHAR(50) NOT NULL,
    regional_id UUID REFERENCES public.regions(id) ON DELETE RESTRICT NOT NULL,
    status VARCHAR(20) DEFAULT 'ABERTO' NOT NULL CHECK (status IN ('ABERTO', 'FINALIZADO')),
    total_caixas INT DEFAULT 0 NOT NULL,
    total_produtos INT DEFAULT 0 NOT NULL,
    fechado_por VARCHAR(100) NULL,
    data_fechamento TIMESTAMPTZ NULL,
    revisao INT DEFAULT 1 NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_lots_regional_numero UNIQUE (regional_id, numero_lote)
);

CREATE INDEX IF NOT EXISTS idx_lots_regional ON public.lots(regional_id);
CREATE INDEX IF NOT EXISTS idx_lots_status ON public.lots(status);

DROP TRIGGER IF EXISTS set_timestamp_lots ON public.lots;
CREATE TRIGGER set_timestamp_lots
BEFORE UPDATE ON public.lots
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ------------------------------------------------------------------------------
-- 5. TABELA PRINCIPAL DE AUDITORIA DE PRODUTOS (AUDIT_PRODUCTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_local VARCHAR(100) NOT NULL,
    serial VARCHAR(50) NOT NULL,
    imei VARCHAR(20) NOT NULL,
    ean VARCHAR(20) NOT NULL,
    modelo VARCHAR(120) NOT NULL,
    fabricante VARCHAR(50) DEFAULT 'SAMSUNG' NOT NULL,
    numero_lote VARCHAR(50) NOT NULL,
    numero_caixa VARCHAR(50) NOT NULL,
    regional_id UUID REFERENCES public.regions(id) ON DELETE RESTRICT NOT NULL,
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    produto_lacrado VARCHAR(5) NOT NULL CHECK (produto_lacrado IN ('SIM', 'NÃO')),
    kit_completo VARCHAR(5) NULL CHECK (kit_completo IN ('SIM', 'NÃO', NULL)),
    aparelho_marcas_uso VARCHAR(5) NULL CHECK (aparelho_marcas_uso IN ('SIM', 'NÃO', NULL)),
    observacao TEXT NULL,
    usuario_bipagem VARCHAR(100) NOT NULL,
    status_sincronizacao VARCHAR(20) DEFAULT 'ENVIADO' NOT NULL CHECK (status_sincronizacao IN ('PENDENTE', 'ENVIADO', 'ERRO_DUPLICADO')),
    data_auditoria DATE NOT NULL,
    revisao INT DEFAULT 1 NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_audit_products_serial_regional UNIQUE (serial, regional_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_products_serial ON public.audit_products(serial);
CREATE INDEX IF NOT EXISTS idx_audit_products_imei ON public.audit_products(imei);
CREATE INDEX IF NOT EXISTS idx_audit_products_lote ON public.audit_products(numero_lote);
CREATE INDEX IF NOT EXISTS idx_audit_products_caixa ON public.audit_products(numero_caixa);
CREATE INDEX IF NOT EXISTS idx_audit_products_regional ON public.audit_products(regional_id);
CREATE INDEX IF NOT EXISTS idx_audit_products_data ON public.audit_products(data_auditoria);
CREATE INDEX IF NOT EXISTS idx_audit_products_status ON public.audit_products(status_sincronizacao);
CREATE INDEX IF NOT EXISTS idx_audit_products_delta_sync ON public.audit_products(regional_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_audit_products_lote_caixa ON public.audit_products(numero_lote, numero_caixa);

DROP TRIGGER IF EXISTS set_timestamp_audit_products ON public.audit_products;
CREATE TRIGGER set_timestamp_audit_products
BEFORE UPDATE ON public.audit_products
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ------------------------------------------------------------------------------
-- 6. TABELA DE FOTOS E EVIDÊNCIAS (LOT_PHOTOS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lot_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('LOTE', 'CAIXA', 'PRODUTO')),
    entity_id VARCHAR(100) NOT NULL,
    regional_id UUID REFERENCES public.regions(id) ON DELETE RESTRICT NOT NULL,
    rotulo VARCHAR(100) NOT NULL,
    descricao TEXT NULL,
    mime_type VARCHAR(50) NOT NULL,
    tamanho_bytes INT NOT NULL,
    sha256 CHAR(64) NOT NULL,
    storage_path TEXT NOT NULL,
    sync_status VARCHAR(20) DEFAULT 'SINCRONIZADO' NOT NULL CHECK (sync_status IN ('PENDENTE', 'SINCRONIZADO', 'ERRO')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lot_photos_entity ON public.lot_photos(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_lot_photos_sha256 ON public.lot_photos(sha256);
CREATE INDEX IF NOT EXISTS idx_lot_photos_regional ON public.lot_photos(regional_id);

-- ------------------------------------------------------------------------------
-- 7. TABELA DE EVENTOS DE SINCRONIZAÇÃO (SYNC_EVENTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID UNIQUE NOT NULL,
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    regional_id UUID REFERENCES public.regions(id) ON DELETE RESTRICT NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'PROCESSADO' NOT NULL CHECK (status IN ('PENDENTE', 'PROCESSADO', 'ERRO')),
    attempts INT DEFAULT 1 NOT NULL,
    last_error TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_events_event_id ON public.sync_events(event_id);
CREATE INDEX IF NOT EXISTS idx_sync_events_regional ON public.sync_events(regional_id);

-- ------------------------------------------------------------------------------
-- 8. TABELA DE TRILHA DE AUDITORIA (AUDIT_LOG - APPEND-ONLY)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id VARCHAR(100) NOT NULL,
    device_id VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    before JSONB NULL,
    after JSONB NULL,
    reason TEXT NULL,
    server_timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    request_id VARCHAR(100) NULL,
    regional VARCHAR(100) NOT NULL,
    -- Campos de compatibilidade
    id UUID NULL,
    usuario VARCHAR(100) NULL,
    acao VARCHAR(100) NULL,
    detalhes TEXT NULL,
    regional_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(server_timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_regional ON public.audit_log(regional);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_id ON public.audit_log(event_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);

-- Regra de Segurança Append-Only: impede UPDATE e DELETE
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_log é estritamente append-only: atualizações e exclusões são proibidas no servidor';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_append_only ON public.audit_log;
CREATE TRIGGER trg_audit_log_append_only
    BEFORE UPDATE OR DELETE ON public.audit_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

-- ------------------------------------------------------------------------------
-- 9. TABELA DE RELEASES DO EXECUTÁVEL (APP_RELEASES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(20) UNIQUE NOT NULL,
    release_notes TEXT NULL,
    download_url TEXT NOT NULL,
    sha256 CHAR(64) NOT NULL,
    min_supported_version VARCHAR(20) NOT NULL,
    is_mandatory BOOLEAN DEFAULT FALSE NOT NULL,
    released_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

-- Função auxiliar segura para obter o perfil do usuário atual
CREATE OR REPLACE FUNCTION auth_user_profile()
RETURNS TABLE (profile_id UUID, user_perfil VARCHAR, user_regional_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id, perfil, regional_id FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Releases: leitura pública para verificação de atualização do executável
DROP POLICY IF EXISTS "app_releases_select_all" ON public.app_releases;
CREATE POLICY "app_releases_select_all" ON public.app_releases FOR SELECT USING (true);

-- Regionais: visíveis para todos os usuários autenticados
DROP POLICY IF EXISTS "regions_select_authenticated" ON public.regions;
CREATE POLICY "regions_select_authenticated" ON public.regions FOR SELECT TO authenticated USING (true);

-- Perfis: operadores e supervisores veem apenas si próprios ou sua regional; admin vê todos
DROP POLICY IF EXISTS "profiles_select_scoped" ON public.profiles;
CREATE POLICY "profiles_select_scoped" ON public.profiles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (SELECT user_perfil FROM auth_user_profile()) IN ('ADMINISTRADOR', 'SUPER_ADMIN')
    OR (
      (SELECT user_perfil FROM auth_user_profile()) = 'SUPERVISOR_REGIONAL'
      AND regional_id = (SELECT user_regional_id FROM auth_user_profile())
    )
  );

-- Produtos:
DROP POLICY IF EXISTS "audit_products_select_scoped" ON public.audit_products;
CREATE POLICY "audit_products_select_scoped" ON public.audit_products FOR SELECT TO authenticated
  USING (
    (SELECT user_perfil FROM auth_user_profile()) IN ('ADMINISTRADOR', 'SUPER_ADMIN')
    OR regional_id = (SELECT user_regional_id FROM auth_user_profile())
  );

DROP POLICY IF EXISTS "audit_products_insert_scoped" ON public.audit_products;
CREATE POLICY "audit_products_insert_scoped" ON public.audit_products FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT user_perfil FROM auth_user_profile()) IN ('ADMINISTRADOR', 'SUPER_ADMIN')
    OR (
      (SELECT user_perfil FROM auth_user_profile()) IN ('OPERADOR', 'SUPERVISOR_REGIONAL')
      AND regional_id = (SELECT user_regional_id FROM auth_user_profile())
    )
  );

DROP POLICY IF EXISTS "audit_products_update_scoped" ON public.audit_products;
CREATE POLICY "audit_products_update_scoped" ON public.audit_products FOR UPDATE TO authenticated
  USING (
    (SELECT user_perfil FROM auth_user_profile()) IN ('ADMINISTRADOR', 'SUPER_ADMIN')
    OR (
      (SELECT user_perfil FROM auth_user_profile()) = 'SUPERVISOR_REGIONAL'
      AND regional_id = (SELECT user_regional_id FROM auth_user_profile())
    )
  );

-- Lotes:
DROP POLICY IF EXISTS "lots_select_scoped" ON public.lots;
CREATE POLICY "lots_select_scoped" ON public.lots FOR SELECT TO authenticated
  USING (
    (SELECT user_perfil FROM auth_user_profile()) IN ('ADMINISTRADOR', 'SUPER_ADMIN')
    OR regional_id = (SELECT user_regional_id FROM auth_user_profile())
  );

DROP POLICY IF EXISTS "lots_insert_scoped" ON public.lots;
CREATE POLICY "lots_insert_scoped" ON public.lots FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT user_perfil FROM auth_user_profile()) IN ('ADMINISTRADOR', 'SUPER_ADMIN')
    OR (
      (SELECT user_perfil FROM auth_user_profile()) IN ('OPERADOR', 'SUPERVISOR_REGIONAL')
      AND regional_id = (SELECT user_regional_id FROM auth_user_profile())
    )
  );

DROP POLICY IF EXISTS "lots_update_scoped" ON public.lots;
CREATE POLICY "lots_update_scoped" ON public.lots FOR UPDATE TO authenticated
  USING (
    (SELECT user_perfil FROM auth_user_profile()) IN ('ADMINISTRADOR', 'SUPER_ADMIN')
    OR (
      (SELECT user_perfil FROM auth_user_profile()) = 'SUPERVISOR_REGIONAL'
      AND regional_id = (SELECT user_regional_id FROM auth_user_profile())
    )
  );

-- Dispositivos:
DROP POLICY IF EXISTS "devices_select_scoped" ON public.devices;
CREATE POLICY "devices_select_scoped" ON public.devices FOR SELECT TO authenticated
  USING (
    (SELECT user_perfil FROM auth_user_profile()) IN ('ADMINISTRADOR', 'SUPER_ADMIN')
    OR regional_id = (SELECT user_regional_id FROM auth_user_profile())
  );

DROP POLICY IF EXISTS "devices_admin_only" ON public.devices;
CREATE POLICY "devices_admin_only" ON public.devices FOR ALL TO authenticated
  USING (
    (SELECT user_perfil FROM auth_user_profile()) IN ('ADMINISTRADOR', 'SUPER_ADMIN')
  );

-- Garantia de aplicação estrita de RLS
ALTER TABLE public.audit_products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.devices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
