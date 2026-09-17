# SISTEMA DE AUDITORIA GRUPO SOLUTIONS - SAMSUNG
*Versão 1.2.0 — Produção e Staging*

Sistema corporativo desktop e web para controle, conferência física, inspeção e rastreabilidade de produtos **Samsung** pelo setor de auditoria do **Grupo Solutions**.

---

## 🌟 Arquitetura e Principais Recursos

- 🛡️ **Arquitetura Offline-First Confiável**: A estação opera sem depender de conexão contínua com a internet. Os dados são persistidos localmente no **IndexedDB (Dexie)** com snapshots transacionais em **SQLite Wasm (sql.js)**.
- ⚡ **Bipagem Contínua de Alta Velocidade**: Foco automático permanente, salvamento em milissegundos com feedback sonoro instantâneo e suporte a leitores de código de barras USB/Bluetooth.
- 🔒 **Validação de Seriais e Anti-Duplicidade**: Bloqueio sonoro e visual imediato caso um serial/IMEI já tenha sido registrado na estação local ou na base oficial central.
- 📦 **Controle Rigoroso de Lacre e Acessórios**: Obrigatoriedade de checagem física de Kit Completo, Marcas de Uso e fotos de evidência para aparelhos abertos.
- 🔄 **Sincronização Delta Idempotente (Outbox Engine)**: Sincronização em lote e em segundo plano com a API Central PostgreSQL (com Row Level Security e tratamento de concorrência).
- 📄 **Gerador Automático de Espelhos de Caixa**: Emissão de espelhos oficiais com logotipos oficiais Samsung e Grupo Solutions, com exportação para PDF, Excel e impressão direta.
- 📊 **Dashboard Executivo e Métricas em Tempo Real**: Indicadores de produtividade por regional, caixas ativas, modelos e contadores agregados O(n).
- 👥 **Autenticação, RBAC e Gestão de Dispositivos**: Controle estrito de perfis (`SUPER_ADMIN`, `ADMINISTRADOR`, `SUPERVISOR_REGIONAL`, `OPERADOR`) e registro de hardware das estações de bipagem.
- 💾 **Backup & Restore Criptográfico Transacional**: Criação de pacotes integrais com manifesto SHA-256 e snapshots pré-restore de segurança contra perda de dados.
- 📜 **Trilha de Auditoria Append-Only**: Registro central imutável de mutações administrativas com trigger de banco de dados que proíbe alterações e exclusões.

---

## 🚀 Como Executar

### Pré-requisitos
- **Node.js**: v20.x ou superior (LTS).
- **NPM**: v10.x ou superior.
- **Sistema Operacional**: Windows 10/11 ou Linux.

### Inicialização no Windows
Basta dar um duplo-clique no arquivo:
```cmd
iniciar-sistema.bat
```

Ou pelo terminal:
```bash
npm install
npm run dev
```
O sistema abrirá automaticamente em `http://localhost:5173`.

---

## 🔑 Autenticação e Primeiro Acesso (Bootstrap Seguro)

O sistema **não utiliza senhas padrão em código**:
- No primeiro acesso de qualquer colaborador (`ADMIN` ou operadores regionais), o sistema exige a definição imediata de uma nova senha forte (mínimo de 6 caracteres).
- As credenciais são criptografadas com hash seguro SHA-256 e salt exclusivo.
- Novos usuários e permissões regionais são configurados pelo Administrador na tela **Gestão de Usuários**.

---

## ⌨️ Atalhos de Teclado Industriais

- `[F1]`: Bipagem Rápida
- `[F2]`: Consulta & Filtros
- `[F3]`: Gerador de Espelhos
- `[F4]`: Dashboard & Indicadores
- `[Enter]`: Salvar e liberar para próxima bipagem
- `[Esc]`: Fechar modais, confirmações e visualizadores

---

## 📚 Documentação Técnica e Runbooks

A documentação operacional e de engenharia detalhada está disponível no diretório `docs/`:

- [Arquitetura Geral e Fluxo Offline-First](docs/RUNBOOKS.md#1-arquitetura-do-sistema)
- [Setup de Desenvolvimento](docs/RUNBOOKS.md#2-setup-de-desenvolvimento-setup-dev)
- [Variáveis de Ambiente (.env.example)](docs/RUNBOOKS.md#3-variáveis-de-ambiente-sem-secrets)
- [Runbook de Backup e Restore Transacional](docs/RUNBOOKS.md#4-runbook-de-backup-e-restore-transacional)
- [Runbook de Sincronização Delta e Conflitos](docs/RUNBOOKS.md#5-runbook-de-sincronização-delta-e-resolução-de-conflitos)
- [Runbook de Compilação do App Desktop](docs/RUNBOOKS.md#6-runbook-de-atualização-do-aplicativo-desktop)
- [Pipeline de CI/CD e Supply Chain Security](docs/RUNBOOKS.md#7-política-de-release-e-cicd)
- [Matriz de Permissões (RBAC)](docs/RUNBOOKS.md#8-matriz-de-permissões-rbac)
- [Plano de Rollback e Contingência](docs/RUNBOOKS.md#9-plano-de-rollback-e-contingência)

---

## 📁 Estrutura do Repositório

```
├── .github/workflows/ci.yml       # Pipeline CI/CD de 14 etapas (Quality, SCA, Build, E2E, Sign)
├── docs/RUNBOOKS.md               # Runbooks operacionais completos e arquitetura técnica
├── iniciar-sistema.bat            # Launcher Windows autônomo
├── MANUAL_DO_SISTEMA.md           # Manual operacional do colaborador
├── package.json                   # Dependências e scripts do ecossistema
├── scripts/
│   ├── build-windows-installer.ps1# Compilação C#, empacotamento, assinatura e hashing SHA-256
│   └── supply-chain-check.cjs     # Verificador de integridade, secret scan e lint
├── src/
│   ├── assets/                    # Identidade visual oficial Samsung e Grupo Solutions
│   ├── components/                # Componentes acessíveis (ARIA, touch-targets >= 44px)
│   ├── db/                        # IndexedDB (Dexie), SQLite Wasm, DDL Central PostgreSQL + RLS
│   ├── pages/                     # Módulos operacionais (Bipagem, Espelhos, Dashboard, etc.)
│   ├── services/                  # Outbox Engine, Observabilidade, Ciclo de Vida, Storage
│   └── types/                     # Interfaces TypeScript estritas
```

---
*Grupo Solutions — Tecnologia, Qualidade e Rastreabilidade Samsung*
