# SISTEMA DE AUDITORIA GRUPO SOLUTIONS - SAMSUNG

Sistema desktop profissional corporativo para controle, conferência e rastreabilidade de produtos **Samsung** pelo setor de auditoria do **Grupo Solutions**.

---

## 🌟 Principais Recursos

- ✅ **100% Offline**: Sem dependência de conexão com a internet, dados gravados localmente em SQLite.
- ⚡ **Bipagem Contínua de Alta Velocidade**: Foco automático permanente, auto-save para produtos lacrados e feedback sonoro instantâneo.
- 🛡️ **Validação de Seriais em Tempo Real**: Bloqueio sonoro e visual imediato de seriais duplicados com histórico da auditoria anterior.
- 📦 **Controle Rigoroso de Lacre e Integridade Física**: Validação de acessórios (Kit Completo) e marcas de uso para aparelhos não lacrados.
- 📄 **Gerador Automático de Espelhos de Auditoria**: Agrupamento por caixa com logos oficiais Samsung e Grupo Solutions, exportação em PDF, Excel e impressão direta.
- 📊 **Dashboard Executivo**: Indicadores consolidados em tempo real e gráficos de distribuição por caixa e modelo Samsung.
- 👥 **Controle de Acesso e Histórico**: Perfis de Administrador e Operador com trilha de auditoria completa.
- 💾 **Backup & Restauração**: Cópia de segurança com um clique.

---

## 🚀 Como Executar

### Pré-requisitos
- Node.js 18+ instalado.

### Inicialização Rápida no Windows
Basta dar um duplo-clique no arquivo:
```cmd
iniciar-sistema.bat
```

Ou manualmente pelo terminal:
```bash
npm install
npm run dev
```
O sistema abrirá automaticamente em `http://localhost:5173`.

---

## 🔑 Credenciais Padrão de Acesso

| Perfil | Login | Senha | Permissões |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin` | `admin123` | Acesso total: Bipagem, Espelhos, Consulta, Edição, Exclusão, Importação, Backup e Gestão de Usuários. |
| **Operador** | `operador` | `operador123` | Bipagem contínua, Consulta e Geração de Espelhos de Auditoria. |

---

## ⌨️ Atalhos de Teclado Industriais

- `[F1]`: Bipagem Rápida
- `[F2]`: Consulta & Filtros
- `[F3]`: Gerador de Espelhos
- `[F4]`: Dashboard & Indicadores
- `[Enter]`: Salvar e liberar para próxima bipagem

---

## 📁 Estrutura do Repositório

```
├── iniciar-sistema.bat       # Launcher de inicialização Windows com 1 clique
├── MANUAL_DO_SISTEMA.md      # Manual operacional completo do sistema
├── package.json              # Dependências e scripts do projeto
├── vite.config.ts            # Configuração do Vite e Tailwind v4
├── src/
│   ├── assets/               # Logos oficiais (Grupo Solutions e Samsung)
│   ├── components/           # Header, Navigation, Logos, LoginModal
│   ├── db/                   # Camada de banco SQLite local (schema.sql e storage)
│   ├── pages/                # BipagemRapida, GeradorEspelhos, Dashboard, Consulta, etc.
│   ├── types/                # Definições TypeScript
│   └── utils/                # Gerador de áudio sintético para bipagens
```

---
*Grupo Solutions - Tecnologia, Qualidade e Rastreabilidade Samsung*

