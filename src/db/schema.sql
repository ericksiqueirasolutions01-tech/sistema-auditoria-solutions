-- ===================================================================
-- SISTEMA DE AUDITORIA GRUPO SOLUTIONS - SAMSUNG
-- Esquema Oficial do Banco de Dados SQLite (100% Offline)
-- Preparado para sincronização online futura (Campos UUID e Sync)
-- ===================================================================

PRAGMA foreign_keys = ON;

-- 1. TABELA PRINCIPAL DE AUDITORIA DE PRODUTOS
CREATE TABLE IF NOT EXISTS PRODUTOS_AUDITORIA (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    UUID TEXT UNIQUE NOT NULL,
    Fabricante TEXT NOT NULL DEFAULT 'SAMSUNG',
    Modelo_Produto TEXT NOT NULL,
    EAN TEXT NOT NULL,
    Serial TEXT NOT NULL UNIQUE,
    Data_Auditoria TEXT NOT NULL,
    Numero_Caixa TEXT NOT NULL,
    Produto_Lacrado TEXT NOT NULL CHECK(Produto_Lacrado IN ('SIM', 'NÃO')),
    Kit_Completo TEXT NULL CHECK(Kit_Completo IN ('SIM', 'NÃO', NULL)),
    Aparelho_Marcas_Uso TEXT NULL CHECK(Aparelho_Marcas_Uso IN ('SIM', 'NÃO', NULL)),
    Observacao TEXT NULL,
    Data_Cadastro TEXT NOT NULL,
    Usuario_Cadastro TEXT NOT NULL,
    Data_Alteracao TEXT NULL,
    Sync_Status TEXT DEFAULT 'PENDENTE' CHECK(Sync_Status IN ('PENDENTE', 'SINCRONIZADO')),
    Sync_Timestamp TEXT NULL
);

-- Índices para busca em alta velocidade (bipagem contínua e filtros)
CREATE INDEX IF NOT EXISTS idx_produtos_serial ON PRODUTOS_AUDITORIA(Serial);
CREATE INDEX IF NOT EXISTS idx_produtos_caixa ON PRODUTOS_AUDITORIA(Numero_Caixa);
CREATE INDEX IF NOT EXISTS idx_produtos_modelo ON PRODUTOS_AUDITORIA(Modelo_Produto);
CREATE INDEX IF NOT EXISTS idx_produtos_data ON PRODUTOS_AUDITORIA(Data_Auditoria);
CREATE INDEX IF NOT EXISTS idx_produtos_sync ON PRODUTOS_AUDITORIA(Sync_Status);
CREATE INDEX IF NOT EXISTS idx_produtos_lote ON PRODUTOS_AUDITORIA(Numero_Lote);
CREATE INDEX IF NOT EXISTS idx_produtos_caixa_lote ON PRODUTOS_AUDITORIA(Numero_Caixa, Numero_Lote);

-- 2. TABELA DE USUÁRIOS DO SISTEMA
CREATE TABLE IF NOT EXISTS USUARIOS (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Nome TEXT NOT NULL,
    Login TEXT UNIQUE NOT NULL,
    SenhaHash TEXT NOT NULL,
    Perfil TEXT NOT NULL CHECK(Perfil IN ('ADMINISTRADOR', 'OPERADOR')),
    Ativo INTEGER NOT NULL DEFAULT 1,
    CriadoEm TEXT NOT NULL
);

-- 3. TABELA DE HISTÓRICO E RASTREABILIDADE (AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS HISTORICO_AUDITORIA (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Usuario TEXT NOT NULL,
    Acao TEXT NOT NULL,
    Detalhes TEXT NOT NULL,
    DataHora TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_historico_data ON HISTORICO_AUDITORIA(DataHora);

-- 4. TABELA DE CONFIGURAÇÕES LOCAIS DO SISTEMA
CREATE TABLE IF NOT EXISTS CONFIGURACOES (
    Chave TEXT PRIMARY KEY,
    Valor TEXT NOT NULL,
    AtualizadoEm TEXT NOT NULL
);

-- ===================================================================
-- SEED INICIAL DE USUÁRIOS (Sem senhas hardcoded em conformidade com Gate 1)
-- ===================================================================
INSERT OR IGNORE INTO USUARIOS (ID, Nome, Login, SenhaHash, Perfil, Ativo, CriadoEm)
VALUES 
(1, 'Administrador Solutions', 'admin', '', 'ADMINISTRADOR', 1, datetime('now')),
(2, 'Operador Bipagem', 'operador', '', 'OPERADOR', 1, datetime('now'));

