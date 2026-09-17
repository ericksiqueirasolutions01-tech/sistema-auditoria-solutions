-- ==============================================================================
-- SISTEMA DE AUDITORIA SOLUTIONS - SAMSUNG
-- GATE 4: ESQUEMA OFICIAL DO BANCO CENTRAL TRANSACIONAL (POSTGRESQL + RLS)
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
CREATE TABLE IF NOT EXISTS regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nome VARCHAR(100) UNIQUE NOT NULL,
    ativo BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER set_timestamp_regions
BEFORE UPDATE ON regions
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Seed das regionais homologadas
INSERT INTO regions (codigo, nome)
VALUES
    ('RJ', 'VIA VAREJO RJ'),
    ('SP', 'VIA VAREJO SP'),
    ('MG', 'VIA VAREJO MG'),
    ('BA', 'VIA VAREJO BA')
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome;

-- ------------------------------------------------------------------------------
-- 2. TABELA DE PERFIS DE USUÁRIO (PROFILES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE, -- Vínculo opcional com auth.users do Supabase/Auth Provider
    login VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(120) NOT NULL,
    perfil VARCHAR(30) NOT NULL CHECK (perfil IN ('SUPER_ADMIN', 'ADMINISTRADOR', 'SUPERVISOR_REGIONAL', 'OPERADOR')),
    regional_id UUID REFERENCES regions(id) ON DELETE SET NULL,
    ativo BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_login ON profiles(login);
CREATE INDEX IF NOT EXISTS idx_profiles_perfil ON profiles(perfil);
CREATE INDEX IF NOT EXISTS idx_profiles_regional ON profiles(regional_id);

CREATE TRIGGER set_timestamp_profiles
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ------------------------------------------------------------------------------
-- 3. TABELA DE DISPOSITIVOS / ESTAÇÕES (DEVICES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    regional_id UUID REFERENCES regions(id) ON DELETE RESTRICT NOT NULL,
    status VARCHAR(20) DEFAULT 'ATIVO' NOT NULL CHECK (status IN ('ATIVO', 'PENDENTE', 'REVOGADO')),
    app_version VARCHAR(20) DEFAULT '1.2.0' NOT NULL,
    last_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    revoked_at TIMESTAMPTZ NULL,
    revoked_reason TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_regional ON devices(regional_id);

CREATE TRIGGER set_timestamp_devices
BEFORE UPDATE ON devices
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ------------------------------------------------------------------------------
-- 4. TABELA DE LOTES DE AUDITORIA (LOTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_lote VARCHAR(50) NOT NULL,
    regional_id UUID REFERENCES regions(id) ON DELETE RESTRICT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_lots_regional ON lots(regional_id);
CREATE INDEX IF NOT EXISTS idx_lots_status ON lots(status);

CREATE TRIGGER set_timestamp_lots
BEFORE UPDATE ON lots
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ------------------------------------------------------------------------------
-- 5. TABELA PRINCIPAL DE AUDITORIA DE PRODUTOS (AUDIT_PRODUCTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_local VARCHAR(100) NOT NULL,
    serial VARCHAR(50) NOT NULL,
    imei VARCHAR(20) NOT NULL,
    ean VARCHAR(20) NOT NULL,
    modelo VARCHAR(120) NOT NULL,
    fabricante VARCHAR(50) DEFAULT 'SAMSUNG' NOT NULL,
    numero_lote VARCHAR(50) NOT NULL,
    numero_caixa VARCHAR(50) NOT NULL,
    regional_id UUID REFERENCES regions(id) ON DELETE RESTRICT NOT NULL,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_audit_products_serial ON audit_products(serial);
CREATE INDEX IF NOT EXISTS idx_audit_products_imei ON audit_products(imei);
CREATE INDEX IF NOT EXISTS idx_audit_products_lote ON audit_products(numero_lote);
CREATE INDEX IF NOT EXISTS idx_audit_products_caixa ON audit_products(numero_caixa);
CREATE INDEX IF NOT EXISTS idx_audit_products_regional ON audit_products(regional_id);
CREATE INDEX IF NOT EXISTS idx_audit_products_data ON audit_products(data_auditoria);
CREATE INDEX IF NOT EXISTS idx_audit_products_status ON audit_products(status_sincronizacao);

CREATE TRIGGER set_timestamp_audit_products
BEFORE UPDATE ON audit_products
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ------------------------------------------------------------------------------
-- 6. TABELA DE FOTOS E EVIDÊNCIAS (LOT_PHOTOS / EVIDENCE_PHOTOS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lot_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('LOTE', 'CAIXA', 'PRODUTO')),
    entity_id VARCHAR(100) NOT NULL,
    regional_id UUID REFERENCES regions(id) ON DELETE RESTRICT NOT NULL,
    rotulo VARCHAR(100) NOT NULL,
    descricao TEXT NULL,
    mime_type VARCHAR(50) NOT NULL,
    tamanho_bytes INT NOT NULL,
    sha256 CHAR(64) NOT NULL,
    storage_path TEXT NOT NULL,
    sync_status VARCHAR(20) DEFAULT 'SINCRONIZADO' NOT NULL CHECK (sync_status IN ('PENDENTE', 'SINCRONIZADO', 'ERRO')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lot_photos_entity ON lot_photos(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_lot_photos_sha256 ON lot_photos(sha256);
CREATE INDEX IF NOT EXISTS idx_lot_photos_regional ON lot_photos(regional_id);

-- ------------------------------------------------------------------------------
-- 7. TABELA DE EVENTOS DE SINCRONIZAÇÃO (SYNC_EVENTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID UNIQUE NOT NULL,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    regional_id UUID REFERENCES regions(id) ON DELETE RESTRICT NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'PROCESSADO' NOT NULL CHECK (status IN ('PENDENTE', 'PROCESSADO', 'ERRO')),
    attempts INT DEFAULT 1 NOT NULL,
    last_error TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_events_event_id ON sync_events(event_id);
CREATE INDEX IF NOT EXISTS idx_sync_events_regional ON sync_events(regional_id);

-- ------------------------------------------------------------------------------
-- 8. TABELA DE AUDIT TRAIL / LOG DE AUDITORIA (AUDIT_LOG)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario VARCHAR(100) NOT NULL,
    acao VARCHAR(50) NOT NULL,
    detalhes TEXT NOT NULL,
    regional_id UUID REFERENCES regions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_regional ON audit_log(regional_id);

-- ------------------------------------------------------------------------------
-- 9. TABELA DE RELEASES DO EXECUTÁVEL / ATUALIZADOR (APP_RELEASES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_releases (
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
-- 10. SEGURANÇA: ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Habilita RLS em todas as tabelas
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_releases ENABLE ROW LEVEL SECURITY;

-- Função auxiliar segura para obter o perfil do usuário atual
CREATE OR REPLACE FUNCTION auth_user_profile()
RETURNS TABLE (profile_id UUID, user_perfil VARCHAR, user_regional_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id, perfil, regional_id FROM profiles WHERE user_id = auth.uid();
$$;

-- Releases: leitura pública para verificação de atualização do executável
CREATE POLICY "app_releases_select_all" ON app_releases FOR SELECT USING (true);

-- Regionais: visíveis para todos os usuários autenticados
CREATE POLICY "regions_select_authenticated" ON regions FOR SELECT TO authenticated USING (true);

-- Perfis: operadores e supervisores veem apenas si próprios ou sua regional; admin vê todos
CREATE POLICY "profiles_select_scoped" ON profiles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (SELECT user_perfil FROM auth_user_profile()) IN ('ADMINISTRADOR', 'SUPER_ADMIN')
    OR (
      (SELECT user_perfil FROM auth_user_profile()) = 'SUPERVISOR_REGIONAL'
      AND regional_id = (SELECT user_regional_id FROM auth_user_profile())
    )
  );

-- Produtos:
-- Leitura restrita à própria regional (operador/supervisor) ou global (admin)
CREATE POLICY "audit_products_select_scoped" ON audit_products FOR SELECT TO authenticated
  USING (
    (SELECT user_perfil FROM auth_user_profile()) IN ('ADMINISTRADOR', 'SUPER_ADMIN')
    OR regional_id = (SELECT user_regional_id FROM auth_user_profile())
  );

-- Inserção restrita à regional autorizada do colaborador
CREATE POLICY "audit_products_insert_scoped" ON audit_products FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT user_perfil FROM auth_user_profile()) IN ('ADMINISTRADOR', 'SUPER_ADMIN')
    OR (
      (SELECT user_perfil FROM auth_user_profile()) IN ('OPERADOR', 'SUPERVISOR_REGIONAL')
      AND regional_id = (SELECT user_regional_id FROM auth_user_profile())
    )
  );

-- Edição restrita a Supervisor na sua regional ou Admin globalmente
CREATE POLICY "audit_products_update_scoped" ON audit_products FOR UPDATE TO authenticated
  USING (
    (SELECT user_perfil FROM auth_user_profile()) IN ('ADMINISTRADOR', 'SUPER_ADMIN')
    OR (
      (SELECT user_perfil FROM auth_user_profile()) = 'SUPERVISOR_REGIONAL'
      AND regional_id = (SELECT user_regional_id FROM auth_user_profile())
    )
  );

-- Lotes:
CREATE POLICY "lots_select_scoped" ON lots FOR SELECT TO authenticated
  USING (
    (SELECT user_perfil FROM auth_user_profile()) IN ('ADMINISTRADOR', 'SUPER_ADMIN')
    OR regional_id = (SELECT user_regional_id FROM auth_user_profile())
  );

CREATE POLICY "lots_insert_scoped" ON lots FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT user_perfil FROM auth_user_profile()) IN ('ADMINISTRADOR', 'SUPER_ADMIN')
    OR (
      (SELECT user_perfil FROM auth_user_profile()) IN ('OPERADOR', 'SUPERVISOR_REGIONAL')
      AND regional_id = (SELECT user_regional_id FROM auth_user_profile())
    )
  );

CREATE POLICY "lots_update_scoped" ON lots FOR UPDATE TO authenticated
  USING (
    (SELECT user_perfil FROM auth_user_profile()) IN ('ADMINISTRADOR', 'SUPER_ADMIN')
    OR (
      (SELECT user_perfil FROM auth_user_profile()) = 'SUPERVISOR_REGIONAL'
      AND regional_id = (SELECT user_regional_id FROM auth_user_profile())
    )
  );

-- Dispositivos:
CREATE POLICY "devices_select_scoped" ON devices FOR SELECT TO authenticated
  USING (
    (SELECT user_perfil FROM auth_user_profile()) IN ('ADMINISTRADOR', 'SUPER_ADMIN')
    OR regional_id = (SELECT user_regional_id FROM auth_user_profile())
  );

CREATE POLICY "devices_admin_only" ON devices FOR ALL TO authenticated
  USING (
    (SELECT user_perfil FROM auth_user_profile()) IN ('ADMINISTRADOR', 'SUPER_ADMIN')
  );

-- Service Role Bypass: Para rotas backend seguras
ALTER TABLE audit_products FORCE ROW LEVEL SECURITY;
ALTER TABLE lots FORCE ROW LEVEL SECURITY;
ALTER TABLE devices FORCE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

