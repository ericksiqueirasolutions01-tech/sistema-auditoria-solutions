@echo off
title SISTEMA DE AUDITORIA GRUPO SOLUTIONS - SAMSUNG
color 0B

echo ==============================================================================
echo        SISTEMA DE AUDITORIA GRUPO SOLUTIONS - SAMSUNG
echo             Controle, Conferencia e Rastreabilidade
echo ==============================================================================
echo.
echo [1/2] Verificando ambiente e banco de dados local...

if not exist node_modules (
    echo [INFO] Instalando dependencias essenciais pela primeira vez...
    call npm install
)

echo.
echo [2/2] Inicializando Sistema Desktop Offline...
echo [INFO] Abrindo interface no navegador local padrao em http://localhost:5173
echo.
echo Para encerrar o sistema, feche esta janela do prompt de comando.
echo.

start http://localhost:5173
call npx vite --host 0.0.0.0 --port 5173
pause

