param(
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " SISTEMA DE AUDITORIA GRUPO SOLUTIONS - SAMSUNG" -ForegroundColor Cyan
Write-Host " Compilador do Instalador e Aplicativo Windows (.EXE)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$baseDir = Split-Path -Parent $PSScriptRoot
Set-Location $baseDir

# 1. Compila o Frontend (dist/)
if (-not $SkipBuild) {
    Write-Host "[1/5] Compilando frontend e verificando tipos (npm run build)..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Falha no build do projeto."
        exit 1
    }
}

# 2. Gera ícone app.ico se não existir
Write-Host "[2/5] Gerando ícone oficial Windows (app.ico)..." -ForegroundColor Yellow
$icoDir = "$baseDir\src-desktop"
if (-not (Test-Path $icoDir)) { New-Item -ItemType Directory -Path $icoDir | Out-Null }
$icoPath = "$icoDir\app.ico"

try {
    Add-Type -AssemblyName System.Drawing
    $pngPath = "$baseDir\src\assets\logo-solutions.png"
    if (Test-Path $pngPath) {
        $bmp = [System.Drawing.Bitmap]::FromFile($pngPath)
        $thumb = [System.Drawing.Bitmap]::new($bmp, 64, 64)
        $hIcon = $thumb.GetHicon()
        $icon = [System.Drawing.Icon]::FromHandle($hIcon)
        $fs = [System.IO.FileStream]::new($icoPath, [System.IO.FileMode]::Create)
        $icon.Save($fs)
        $fs.Close()
        $icon.Dispose()
        $thumb.Dispose()
        $bmp.Dispose()
    }
} catch {
    Write-Warning "Não foi possível gerar app.ico: $_"
}

# 3. Compila o executável da aplicação: SistemaAuditoriaSolutions.exe
Write-Host "[3/5] Compilando executável desktop (SistemaAuditoriaSolutions.exe)..." -ForegroundColor Yellow
$cscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $cscPath)) {
    $cscPath = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
}

$appExe = "$baseDir\src-desktop\SistemaAuditoriaSolutions.exe"
$appSource = "$baseDir\src-desktop\SistemaAuditoriaApp.cs"

$iconArg = if (Test-Path $icoPath) { "/win32icon:`"$icoPath`"" } else { "" }

& $cscPath /nologo /target:winexe /optimize+ /platform:anycpu `
    $iconArg `
    /r:System.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Management.dll `
    /out:"$appExe" "$appSource"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Falha ao compilar SistemaAuditoriaSolutions.exe."
    exit 1
}
Write-Host " -> Executável compilado: $appExe" -ForegroundColor Green

# 4. Prepara o pacote com os arquivos da aplicação e comprime em ZIP embutido
Write-Host "[4/5] Empacotando arquivos de distribuição e runtime..." -ForegroundColor Yellow
$buildDir = "$baseDir\build-installer"
if (Test-Path $buildDir) { Remove-Item -Recurse -Force $buildDir }
New-Item -ItemType Directory -Path "$buildDir\package" | Out-Null

Copy-Item -Recurse -Force "$baseDir\dist" "$buildDir\package\dist"
Copy-Item -Force $appExe "$buildDir\package\SistemaAuditoriaSolutions.exe"
if (Test-Path $icoPath) {
    Copy-Item -Force $icoPath "$buildDir\package\app.ico"
}
if (Test-Path "$baseDir\iniciar-sistema.bat") {
    Copy-Item -Force "$baseDir\iniciar-sistema.bat" "$buildDir\package\iniciar-sistema.bat"
}

# Cria o arquivo ZIP que será embutido diretamente dentro do .EXE
$payloadZip = "$buildDir\app_payload.zip"
Write-Host " -> Comprimindo payload embutido ($payloadZip)..." -ForegroundColor Yellow
Compress-Archive -Path "$buildDir\package\*" -DestinationPath $payloadZip -Force

# 5. Compila o Assistente de Instalação: Sistema-Auditoria-Solutions-Setup.exe
Write-Host "[5/5] Compilando Assistente de Instalação Autônomo com Payload Embutido..." -ForegroundColor Yellow
$installerSource = "$baseDir\src-desktop\InstallerWizard.cs"
$installerExe = "$buildDir\Sistema-Auditoria-Solutions-Setup.exe"

& $cscPath /nologo /target:winexe /optimize+ /platform:anycpu `
    $iconArg `
    /resource:"$payloadZip,Payload.zip" `
    /r:System.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll `
    /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll `
    /out:"$installerExe" "$installerSource"


# Copia para as pastas de downloads acessíveis pelo navegador
$downloadsPublic = "$baseDir\public\downloads"
$downloadsDist = "$baseDir\dist\downloads"
if (-not (Test-Path $downloadsPublic)) { New-Item -ItemType Directory -Path $downloadsPublic | Out-Null }
if (-not (Test-Path $downloadsDist)) { New-Item -ItemType Directory -Path $downloadsDist | Out-Null }

Copy-Item -Force $installerExe "$downloadsPublic\Sistema-Auditoria-Solutions-Setup.exe"
Copy-Item -Force $installerExe "$downloadsDist\Sistema-Auditoria-Solutions-Setup.exe"

# 6. Assinatura Digital e Hashing Criptográfico de Artefatos (Gate 14 - Supply Chain)
Write-Host "[6/6] Calculando integridade criptográfica SHA-256 e manifesto de release..." -ForegroundColor Yellow

# Assinatura digital Authenticode se certificado estiver configurado
if ($env:CSC_CERT_BASE64 -or $env:CODE_SIGN_CERT_THUMBPRINT) {
    Write-Host " -> Assinando digitalmente binários com certificado corporativo..." -ForegroundColor Cyan
    try {
        # Se thumbprint estiver no store
        if ($env:CODE_SIGN_CERT_THUMBPRINT) {
            $cert = Get-Item "Cert:\CurrentUser\My\$($env:CODE_SIGN_CERT_THUMBPRINT)" -ErrorAction SilentlyContinue
            if ($cert) {
                Set-AuthenticodeSignature -FilePath $appExe -Certificate $cert -TimestampServer "http://timestamp.digicert.com"
                Set-AuthenticodeSignature -FilePath $installerExe -Certificate $cert -TimestampServer "http://timestamp.digicert.com"
                Set-AuthenticodeSignature -FilePath "$downloadsPublic\Sistema-Auditoria-Solutions-Setup.exe" -Certificate $cert -TimestampServer "http://timestamp.digicert.com"
                Set-AuthenticodeSignature -FilePath "$downloadsDist\Sistema-Auditoria-Solutions-Setup.exe" -Certificate $cert -TimestampServer "http://timestamp.digicert.com"
                Write-Host " -> Binários assinados com sucesso." -ForegroundColor Green
            }
        }
    } catch {
        Write-Warning "Aviso: Não foi possível assinar com certificado: $_"
    }
} else {
    Write-Host " -> Modo Staging/Local: Certificado de produção não informado. Assinatura Authenticode simulada/pendente." -ForegroundColor Gray
}

# Cálculo dos hashes SHA-256
$hashApp = (Get-FileHash -Algorithm SHA256 -Path $appExe).Hash.ToLower()
$hashInstaller = (Get-FileHash -Algorithm SHA256 -Path $installerExe).Hash.ToLower()

$manifestJson = @{
    generated_at = (Get-Date).ToString("o")
    version = "1.3.1"
    app_executable = @{
        name = "SistemaAuditoriaSolutions.exe"
        sha256 = $hashApp
        sizeBytes = (Get-Item $appExe).Length
    }
    setup_installer = @{
        name = "Sistema-Auditoria-Solutions-Setup.exe"
        sha256 = $hashInstaller
        sizeBytes = (Get-Item $installerExe).Length
    }
} | ConvertTo-Json -Depth 5

$sumsContent = "$hashInstaller  Sistema-Auditoria-Solutions-Setup.exe`n$hashApp  SistemaAuditoriaSolutions.exe"

Set-Content -Path "$buildDir\manifest.json" -Value $manifestJson -Encoding UTF8
Set-Content -Path "$downloadsPublic\manifest.json" -Value $manifestJson -Encoding UTF8
Set-Content -Path "$downloadsDist\manifest.json" -Value $manifestJson -Encoding UTF8

Set-Content -Path "$buildDir\SHA256SUMS.txt" -Value $sumsContent -Encoding UTF8
Set-Content -Path "$downloadsPublic\SHA256SUMS.txt" -Value $sumsContent -Encoding UTF8
Set-Content -Path "$downloadsDist\SHA256SUMS.txt" -Value $sumsContent -Encoding UTF8

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " SUCESSO! INSTALADOR WINDOWS GERADO COM ÊXITO" -ForegroundColor Green
Write-Host " Arquivo: $downloadsPublic\Sistema-Auditoria-Solutions-Setup.exe" -ForegroundColor Cyan
$fileSize = [math]::Round((Get-Item "$downloadsPublic\Sistema-Auditoria-Solutions-Setup.exe").Length / 1KB, 1)
Write-Host " Tamanho: $fileSize KB" -ForegroundColor Cyan
Write-Host " SHA256 : $hashInstaller" -ForegroundColor Cyan
Write-Host " O download já está disponível no botão da tela de login!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green


