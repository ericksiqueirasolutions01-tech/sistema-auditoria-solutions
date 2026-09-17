# RUNBOOKS OPERACIONAIS E ARQUITETURA TÉCNICA
## SISTEMA DE AUDITORIA GRUPO SOLUTIONS - SAMSUNG
*Versão 1.2.0 — Produção e Staging*

---

# 1. ARQUITETURA DO SISTEMA

O **Sistema de Auditoria Solutions** foi desenhado segundo a arquitetura **Offline-First com Centralização Transacional**:

```
+-----------------------------------------------------------------------------------+
|                            ESTAÇÕES OPERACIONAIS (DESKTOP)                        |
|                                                                                   |
|  [ Leitor USB/BT ] ---> [ UI React / TypeScript / Vite ]                          |
|                                 |                                                 |
|                 +---------------+---------------+                                 |
|                 |                               |                                 |
|                 v                               v                                 |
|      [ IndexedDB / Dexie.js ]        [ sql.js SQLite Wasm ]                       |
|      (Armazenamento Principal)       (Snapshots Transacionais)                    |
|                 |                                                                 |
|                 v                                                                 |
|      [ Fila Outbox Delta ] <----+ (Detecção de Conexão Online)                    |
+-----------------|-----------------------------------------------------------------+
                  | (HTTPS / TLS 1.3 - Idempotent Sync)
                  v
+-----------------------------------------------------------------------------------+
|                        INFRAESTRUTURA CENTRAL TRANSACIONAL                        |
|                                                                                   |
|  [ API Central / Edge Routes ] <---> [ Verificador de Idempotência & Revisões ]   |
|                                                |                                  |
|                                                v                                  |
|                     [ PostgreSQL Central com Row Level Security (RLS) ]          |
|                     - Tabela audit_products (Seriais/IMEIs Únicos)                |
|                     - Tabela lots & lot_photos (Evidências WebP Reais)            |
|                     - Tabela audit_log (Trilha Estritamente Append-Only)          |
|                     - Tabela devices (RBAC & Hardware Whitelist)                  |
+-----------------------------------------------------------------------------------+
```

### Características Centrais da Arquitetura:
1. **Source of Truth Local**: O banco IndexedDB local gerencia o estado operacional da estação com zero latência. Nenhum travamento de rede bloqueia o operador na linha de bipagem.
2. **Motor de Sincronização Delta / Outbox**: Eventos de criação, edição e tombstone (exclusão lógica) são enfileirados localmente e sincronizados de forma idempotente (`event_id` UUID v4).
3. **Integridade de Dados e Anti-Colisão**: Validação estrita de duplicidade de IMEI contra a base histórica central e regras anti-concorrência.
4. **Trilha Append-Only**: `audit_log` central protegido por trigger de banco que rejeita operações de `UPDATE` e `DELETE`.

---

# 2. SETUP DE DESENVOLVIMENTO (SETUP DEV)

### Pré-requisitos
- **Node.js**: v20.x ou superior (LTS).
- **NPM**: v10.x ou superior.
- **PowerShell 5.1+**: para execução dos scripts de empacotamento desktop no Windows.
- **Compilador C# (.NET Framework 4.8 / csc.exe)**: nativo do Windows em `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`.

### Instalação Passo a Passo

```bash
# 1. Clonar repositório
git clone https://github.com/grupo-solutions/sistema-auditoria-solutions.git
cd sistema-auditoria-solutions

# 2. Instalação limpa de dependências
npm ci

# 3. Configurar variáveis locais a partir do modelo
cp .env.example .env.local

# 4. Executar suíte de testes unitários e de integração
npm test

# 5. Iniciar servidor de desenvolvimento Vite
npm run dev
```

O sistema estará acessível no navegador em `http://localhost:5173`.

---

# 3. VARIÁVEIS DE AMBIENTE (SEM SECRETS)

Nenhum segredo, senha ou token deve ser configurado no repositório. As variáveis operacionais disponíveis em `.env.example` são:

| Variável | Tipo | Padrão | Descrição |
| :--- | :--- | :--- | :--- |
| `VITE_APP_TITLE` | String | `SISTEMA DE AUDITORIA GRUPO SOLUTIONS - SAMSUNG` | Título da janela e relatórios |
| `VITE_APP_VERSION` | String | `1.2.0` | Versão semântica oficial da release |
| `VITE_CENTRAL_API_URL` | URL | `http://localhost:3000` | URL do gateway da API Central |
| `VITE_DESKTOP_LOCAL_PORT` | Inteiro | `3000` | Porta TCP para serviço loopback do app desktop |
| `VITE_NETWORK_TIMEOUT_MS` | Inteiro | `15000` | Limite de espera para operações remotas de rede |
| `VITE_OUTBOX_RETENTION_DAYS`| Inteiro | `30` | Dias de retenção de eventos sincronizados na outbox |
| `VITE_LOG_LEVEL` | String | `INFO` | Nível mínimo de log (`DEBUG`, `INFO`, `WARN`, `ERROR`) |

---

# 4. RUNBOOK DE BACKUP E RESTORE TRANSACIONAL

### 4.1 Criação de Backup
1. **Pela Interface Web/Desktop**:
   - Faça login com perfil `ADMINISTRADOR` ou `SUPER_ADMIN`.
   - Acesse o menu **Backup & Restauração** (ícone de cofre/banco).
   - Clique em **Gerar Backup Criptográfico**.
   - O sistema gera um arquivo compactado `.json` ou pacote assinado acompanhado de manifesto SHA-256 contendo:
     - `produtos`: histórico de auditorias e seriais.
     - `lotes`: metadados de abertura e fechamento de lotes.
     - `fotos`: evidências reais compactadas (WebP).
     - `usuarios`: perfis com hashes de senha (sem texto plano).
     - `audit_log`: trilha local de eventos.
     - `manifest`: resumo de integridade, contagens e hash SHA-256.

2. **Linha de Comando / Automação Local**:
   - Os backups são exportados automaticamente no encerramento do turno ou via API de backup.

### 4.2 Restauração Segura (Restore Transacional)
> **Atenção**: O processo de restore é atômico. Se qualquer validação de integridade falhar, o sistema desfaz as alterações e reverte para o snapshot anterior.

1. Na tela de **Backup & Restauração**, clique em **Selecionar Arquivo de Backup**.
2. O sistema realiza as seguintes etapas automáticas:
   - **Validação de Assinatura/SHA-256**: Compara o digest do arquivo com o manifesto.
   - **Criação de Snapshot Pré-Restore**: Grava um ponto de restauração imediato da base ativa.
   - **Aplicação Transacional**: Substitui ou mescla os dados sob transação ACID.
   - **Verificação Pós-Restore**: Valida a contagem de registros e a consistência das chaves.
3. Se houver falha durante o processo, o rollback restaura automaticamente o snapshot pré-restore.

---

# 5. RUNBOOK DE SINCRONIZAÇÃO DELTA E RESOLUÇÃO DE CONFLITOS

### 5.1 Fluxo Normal de Sincronização
1. A estação detecta sinal de internet e dispara o motor Outbox em segundo plano.
2. Cada evento possui um `uuid` único e número de `revisao`.
3. A API Central valida idempotência: se o evento já foi processado anteriormente, retorna confirmação imediata sem duplicar dados.
4. Os produtos recebem carimbo `status_sincronizacao = 'ENVIADO'` e `id_servidor`.

### 5.2 Resolução de Conflitos e Duplicidade Concorrente
- **Regra de Unicidade Estrita**: Nenhum IMEI/Serial pode ser aceito duas vezes na mesma regional ou lote.
- **Cenário de Concorrência (Race Condition)**:
  - Se duas estações submeterem o mesmo serial simultaneamente:
    - O banco central aceita a primeira transação que concluir com sucesso.
    - A segunda transação é rejeitada com código `409 Conflict` e status `DUPLICADO NO SERVIDOR`.
    - Um registro de conflito é gravado na tabela `central_tentativas_duplicadas` com carimbo de data, estação e operador.
    - A estação rejeitada marca o item como `ERRO_DUPLICADO` e apresenta alerta sonoro e visual para o operador físico separar o aparelho na caixa de divergência.

---

# 6. RUNBOOK DE ATUALIZAÇÃO DO APLICATIVO DESKTOP

### 6.1 Compilação do Instalador
Para gerar uma nova versão compilada e empacotada do instalador Windows:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/build-windows-installer.ps1
```

O script realiza:
1. Compilação do frontend Vite com `npm run build`.
2. Compilação do executável C# `SistemaAuditoriaSolutions.exe` via `csc.exe`.
3. Empacotamento do payload ZIP com runtime embutido.
4. Compilação do instalador autônomo `Sistema-Auditoria-Solutions-Setup.exe`.
5. Cálculo criptográfico dos digests SHA-256 e gravação de `manifest.json` e `SHA256SUMS.txt`.

### 6.2 Validação de Assinatura e Integridade
- Antes de executar qualquer instalador ou pacote de atualização baixado:
  - O sistema compara o hash SHA-256 do arquivo baixado com o valor oficial do manifesto assinado.
  - Em produção, binários sem assinatura corporativa Authenticode válida são rejeitados pelo sistema operacional.

---

# 7. POLÍTICA DE RELEASE E CI/CD

### Pipeline de 14 Etapas Obrigatórias (GitHub Actions)
O arquivo `.github/workflows/ci.yml` governa o ciclo de liberação:

1. `npm ci`: Instalação determinística de pacotes.
2. `secret scan`: Varredura estrita de segredos (chaves privadas, tokens, strings de banco com senha).
3. `typecheck`: Verificação estática com `npx tsc -b`.
4. `lint`: Análise estática de diretrizes de código e segurança.
5. `unit tests`: Execução de testes de unidade com Vitest.
6. `integration tests`: Validação de esquema PostgreSQL central, RLS e concorrência outbox.
7. `build`: Geração de chunks otimizados de produção.
8. `E2E`: Execução do fluxo de 13 passos operacionais.
9. `SCA / dependency audit`: Análise de vulnerabilidades em dependências (`npm audit`).
10. `build desktop`: Compilação de binários e assistente de instalação Windows.
11. `sign artifacts`: Assinatura digital Authenticode com carimbo de tempo.
12. `hash artifacts`: Emissão de `manifest.json` e `SHA256SUMS.txt`.
13. `publish staging`: Deploy automatizado em ambiente de homologação com smoke tests.
14. `publish production`: **Bloqueado por aprovação humana formal obrigatória**.

---

# 8. MATRIZ DE PERMISSÕES (RBAC)

O controle de acesso é aplicado de forma redundante no cliente e estritamente no servidor (via PostgreSQL RLS e middleware de autenticação):

| Ação / Funcionalidade | SUPER_ADMIN | ADMINISTRADOR | SUPERVISOR_REGIONAL | OPERADOR |
| :--- | :---: | :---: | :---: | :---: |
| Bipagem de Seriais / IMEI | ✅ | ✅ | ✅ | ✅ (Apenas sua regional) |
| Abertura e Fechamento de Lote | ✅ | ✅ | ✅ | ✅ (Apenas sua regional) |
| Captura de Fotos de Evidência | ✅ | ✅ | ✅ | ✅ |
| Consulta de Produtos | ✅ (Todas) | ✅ (Todas) | ✅ (Sua regional) | ✅ (Sua regional) |
| Gerador de Espelhos de Caixa | ✅ | ✅ | ✅ | ✅ |
| Importação de Planilhas Excel | ✅ | ✅ | ❌ | ❌ |
| Edição com Justificativa | ✅ | ✅ | ✅ (Sua regional) | ❌ |
| Exclusão com Tombstone | ✅ | ✅ | ❌ | ❌ |
| Gestão de Usuários e Senhas | ✅ | ✅ | ❌ | ❌ |
| Configurações e Backup Geral | ✅ | ✅ | ❌ | ❌ |
| Consulta de Trilha de Auditoria | ✅ | ✅ | ✅ (Sua regional) | ❌ |

---

# 9. PLANO DE ROLLBACK E CONTINGÊNCIA

Caso uma versão ou migração apresente inconformidade em produção:

### 9.1 Rollback de Aplicação Desktop
1. O executável anterior permanece arquivado na pasta de instalação em `%LOCALAPPDATA%\SistemaAuditoriaSolutions\backup-previous\`.
2. Para reverter uma estação, execute o script de reversão:
   ```cmd
   iniciar-sistema.bat --rollback
   ```
3. O instalador reinstala a versão homologada estável anterior preservando o banco local IndexedDB e arquivos de log.

### 9.2 Rollback de Banco de Dados Local
1. Todo restore ou migração gera um arquivo `snapshot_pre_migration_<timestamp>.json`.
2. Se houver divergência, acione a restauração do snapshot através do menu de Backup.
3. O motor do sistema valida as contagens de seriais auditados antes de liberar a estação para nova bipagem.

### 9.3 Rollback Central
1. As tabelas do banco PostgreSQL central utilizam versionamento por migrações incrementais numeradas.
2. Em caso de inconsistência na API, o tráfego é roteado para a réplica de staging enquanto o script de rollback DDL correspondente é executado.

