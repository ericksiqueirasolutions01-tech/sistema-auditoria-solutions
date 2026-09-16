# MANUAL OPERACIONAL - SISTEMA DE AUDITORIA GRUPO SOLUTIONS
## Controle, Conferência e Rastreabilidade de Produtos Samsung

---

## 1. APRESENTAÇÃO E OBJETIVO
O **SISTEMA DE AUDITORIA GRUPO SOLUTIONS** é uma solução corporativa desenvolvida para o setor de auditoria de qualidade e logística, substituindo planilhas manuais e garantindo máxima velocidade, precisão e rastreabilidade na conferência de produtos **Samsung**.

### Principais Características:
- **100% Offline**: Funciona com banco local sem necessidade de conexão com a internet.
- **Bipagem Contínua de Alta Velocidade**: Foco automático, auto-save e compatibilidade com qualquer leitor de código de barras (USB ou Bluetooth).
- **Validação Instantânea de Duplicidade**: Bloqueio sonoro e visual caso um número de série já tenha sido auditado.
- **Controle Rigoroso de Lacre e Integridade Física**: Validação de acessórios e avarias estéticas para produtos abertos.
- **Emissão Automática de Espelhos de Auditoria**: Relatórios por caixa com logotipos oficiais Samsung e Grupo Solutions prontos para impressão, PDF e Excel.
- **Arquitetura Pronta para Sincronização Online**: Estrutura com UUIDs e status de sincronização para futura centralização na nuvem.

---

## 2. INICIALIZAÇÃO E ACESSO AO SISTEMA

### Como Iniciar:
1. No computador Windows da estação de auditoria, navegue até a pasta do sistema:
   `c:\Users\User\.cline\data\workspaces\chat\sistema-auditoria-solutions`
2. Dê um duplo-clique no arquivo **`iniciar-sistema.bat`**.
3. O sistema será iniciado e abrirá automaticamente no navegador da estação em `http://localhost:5173`.

### Procedimento de Primeiro Acesso (Bootstrap Seguro):
Em atendimento às normas de segurança do sistema:
- O sistema **não utiliza senhas padrão**.
- Ao selecionar qualquer usuário pela primeira vez (`ADMIN`, `ADMINISTRADOR` ou operadores regionais), informe uma nova senha com no mínimo 6 caracteres.
- A senha será criptografada com hash SHA-256 e gravada para os próximos acessos.
- Novos colaboradores e operadores podem ser adicionados no menu **Gestão de Usuários**.

---

## 3. CONFIGURAÇÃO DO LEITOR DE CÓDIGO DE BARRAS
O sistema foi projetado para funcionar de forma plug-and-play com qualquer leitor de código de barras USB ou sem fio (Bluetooth):
1. Certifique-se de que o leitor esteja configurado para enviar a tecla **ENTER (CR/LF)** após cada leitura (configuração padrão de fábrica da maioria dos leitores).
2. Conecte o leitor à porta USB do computador.
3. Ao entrar na tela de **Bipagem Rápida**, o cursor já estará posicionado no campo **SERIAL**.

---

## 4. GUIA PASSO A PASSO DA OPERAÇÃO

### Módulo Principal: Bipagem Rápida (Atalho: `F1`)
1. **Defina a Caixa**: No topo da tela, confirme o nome da caixa ativa (ex: `CAIXA 01`). Para iniciar uma nova caixa, clique em *Próxima Caixa*.
2. **Selecione o Modelo**: Escolha o modelo Samsung (ex: `Galaxy A55 5G`, `Galaxy S24 Ultra`). O código EAN oficial será preenchido automaticamente.
3. **Selecione o Status do Lacre**:
   - **PRODUTO LACRADO = SIM (Padrão)**:
     - Bipe o serial do produto.
     - O sistema valida a duplicidade e salva o registro em milissegundos.
     - Um sinal sonoro de confirmação é emitido, o campo serial é limpo e o foco permanece pronto para o próximo bip.
   - **PRODUTO LACRADO = NÃO (Aparelho Aberto)**:
     - O sistema abrirá os campos obrigatórios de inspeção física:
       - **Kit Completo?**: Selecione `SIM` (com todos os cabos/acessórios) ou `NÃO` (falta item).
       - **Marcas de Uso?**: Selecione `NÃO` (perfeito) ou `SIM` (com riscos/avarias).
       - **Observação (Opcional)**: Digite qualquer detalhe relevante (ex: *"risco na tampa traseira"*).
     - Bipe o serial e confirme o salvamento. O sistema **não permite salvar produtos abertos sem o preenchimento desses campos**.
4. **Contadores em Tempo Real**:
   - O painel superior atualiza instantaneamente o total de produtos auditados, quantidade de lacrados, abertos e pendências da caixa ativa.

### Alerta de Serial Duplicado:
Se um serial já cadastrado for bipado:
- Um sinal sonoro duplo de alerta é emitido.
- Uma faixa vermelha de bloqueio é exibida indicando:
  - *Caixa onde foi auditado anteriormente.*
  - *Data da primeira auditoria.*
  - *Auditor que realizou o cadastro.*
- O cadastro é bloqueado, evitando duplicidades nas planilhas.

---

## 5. GERADOR DE ESPELHOS DE AUDITORIA (Atalho: `F3`)
Permite gerar as folhas de rosto e espelhos de conferência de cada caixa auditada:
1. Clique na aba **Gerador de Espelhos**.
2. Selecione a caixa desejada nas abas superiores (ex: `📄 Espelho CAIXA 01`).
3. O sistema renderiza o espelho oficial contendo:
   - Logos oficiais **Samsung** e **Grupo Solutions**.
   - Identificação do Fabricante (`SAMSUNG`), Modelo, EAN e Quantidade Total.
   - Resumo de Lacrados vs. Abertos e Avarias.
   - Tabela detalhada com todos os seriais, status de kit e marcas.
   - Campos formais de assinatura do auditor e da supervisão de qualidade.
4. Clique em:
   - **Exportar PDF**: Gera o arquivo `.pdf` formatado para envio ou arquivamento.
   - **Exportar Excel**: Exporta a listagem da caixa em planilha `.xlsx`.
   - **Imprimir**: Envia diretamente para a impressora A4 local.

---

## 6. CONSULTA E FILTROS (Atalho: `F2`)
- Permite pesquisar em toda a base por Serial, Modelo, Caixa, Data ou Status de Lacre.
- Exportação dos resultados filtrados para planilha Excel.
- Administradores podem editar caixas/observações ou excluir registros com rastreamento no log.

---

## 7. IMPORTAÇÃO EM LOTE VIA EXCEL
Para cargas em lote vindas de outros sistemas:
1. Acesse **Importar Planilha**.
2. Baixe o modelo padrão clicando em *Baixar Planilha Modelo*.
3. Preencha as colunas: `Modelo`, `EAN`, `Serial`, `Caixa`, `Data`, `Lacrado`.
4. Arraste ou selecione o arquivo para processamento automático.
5. O sistema valida os seriais e relata individualmente itens importados com sucesso e duplicidades bloqueadas.

---

## 8. BACKUP E SEGURANÇA DOS DADOS
Por ser um sistema 100% offline, os dados residem na máquina local:
- **Rotina de Backup**: Acesse **Backup do Sistema** e clique em *Gerar e Salvar Backup*. Guarde o arquivo em um pendrive ou pasta compartilhada de rede ao final de cada turno.
- **Restauração**: Em caso de troca de máquina, basta selecionar o arquivo de backup para restaurar toda a base instantaneamente.

---

## 9. ATALHOS DE TECLADO INDUSTRIAIS
Para agilizar o trabalho do auditor no chão de fábrica:
- **`F1`**: Abrir Bipagem Rápida
- **`F2`**: Abrir Consulta & Rastreabilidade
- **`F3`**: Abrir Gerador de Espelhos
- **`F4`**: Abrir Dashboard & Indicadores
- **`Enter`**: Salvar bipagem na tela de leitura contínua

---
*Grupo Solutions - Tecnologia, Qualidade e Rastreabilidade Samsung*

