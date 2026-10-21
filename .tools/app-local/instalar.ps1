#Requires -Version 5.1
<#
.SYNOPSIS
    Instala o Rebeca numa máquina Windows — runtime portátil, configuração de acesso, atalho e teste.

.DESCRIPTION
    Compatibilidade: escrito para rodar tanto no **Windows PowerShell 5.1** (o que já vem no Windows e o
    único presente na máquina do dono — verificado: `$PSVersionTable.PSVersion` devolve 5.1 e não há
    `pwsh` instalado) quanto no **PowerShell 7**. Por isso o script evita construção exclusiva da 7
    (nada de `utf8NoBOM`, nada de `??`), usa `Invoke-RestMethod` para texto e `Invoke-WebRequest -OutFile`
    para binário — e grava arquivo com `UTF8Encoding($false)` para **não** pôr BOM no `.env`.

    Por que BOM importa aqui: o leitor de `.env` do servidor (`server/dev-env.ts`) valida o nome da
    chave com `^[A-Za-z_][A-Za-z0-9_]*$`. Com BOM, a primeira linha vira `\ufeffGOOGLE_CLIENT_ID` e é
    **descartada em silêncio** — o app abriria com "nada configurado" e o arquivo pareceria certo.

    Roda **dentro da pasta do app** (a que veio do `empacotar.ps1`). Faz, em ordem, só o que falta —
    cada passo verifica antes de agir, então rodar duas vezes não duplica nada:

    1. Confere que o pacote está completo (`dist/index.html`, `build/server/local/cli.js`, `vercel.json`).
    2. Garante o runtime: se `runtime\node` não existe, baixa o Node portátil; se `runtime\ffmpeg` não
       existe, baixa o ffmpeg portátil. Os dois com **conferência de checksum** do próprio release.
       Falha de rede não é fatal: cai para o Node/ffmpeg do PATH e diz o que ficou faltando.
    3. Cria o `.env` (só se não existir) com `GOOGLE_CLIENT_ID` e `REBECA_ALLOWED_SUBS` — por parâmetro
       ou perguntando. **Nunca sobrescreve** um `.env` existente.
    4. Cria o atalho na área de trabalho (pulado com `-SemAtalho`).
    5. Faz um teste de fumaça de verdade: sobe o servidor, pede `GET /`, confere HTTP 200 e derruba.

    O que ele **não** faz, de propósito: não grava chave de provedor de IA. A chave entra depois, dentro
    do app (Configurações → Inteligência artificial), e fica só nesta máquina.

.PARAMETER DestinoApp
    Pasta do app. Por padrão é deduzida da posição deste script (aceita tanto o pacote montado quanto a
    pasta `dist-app\Rebeca`).

.PARAMETER SomenteRuntime
    Baixa o runtime e para. Usado pelo `empacotar.ps1 -ComRuntime`.

.PARAMETER SemDownload
    Não baixa nada; usa só o que já existe (útil em máquina sem internet que já tem Node no PATH).

.PARAMETER NodeVersion
    Versão do Node a baixar (ex.: `22.12.0`). Sem isto, o script usa a LTS mais recente publicada.

.PARAMETER SemFfmpeg
    Pula o ffmpeg. O app funciona (IA, revisão, custos), mas o pipeline de mídia recusa gerar.

.PARAMETER GoogleClientId
    Client ID público do OAuth. **Não é segredo** — é o `aud` que o servidor confere e vai no bundle do
    navegador de qualquer forma.

.PARAMETER AllowedSubs
    Lista de `sub`s autorizados, separados por vírgula. **É o controle de acesso.**

.PARAMETER SemAtalho
    Não cria o atalho na área de trabalho.

.PARAMETER Porta
    Porta do teste de fumaça. Padrão 8787.

.EXAMPLE
    pwsh -NoProfile -File .\ferramentas\instalar.ps1
    pwsh -NoProfile -File .\ferramentas\instalar.ps1 -GoogleClientId 123.apps.googleusercontent.com -AllowedSubs 1020304050
#>
[CmdletBinding()]
param(
    [Parameter()][string]$DestinoApp = '',
    [Parameter()][switch]$SomenteRuntime,
    [Parameter()][switch]$SemDownload,
    [Parameter()][string]$NodeVersion = '',
    [Parameter()][string]$FfmpegArquivo = 'ffmpeg-n8.1-latest-win64-gpl-8.1.zip',
    [Parameter()][switch]$SemFfmpeg,
    [Parameter()][string]$GoogleClientId = '',
    [Parameter()][string]$AllowedSubs = '',
    [Parameter()][switch]$SemAtalho,
    [Parameter()][ValidateRange(1, 65535)][int]$Porta = 8787
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$NODE_INDEX = 'https://nodejs.org/dist/index.json'
$FFMPEG_BASE = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest'

function Escrever([string]$mensagem) { Write-Information $mensagem -InformationAction Continue }
function Avisar([string]$mensagem) { Write-Warning $mensagem }

<#
    Grava texto em UTF-8 **sem BOM**, funcionando na 5.1 e na 7.

    `Set-Content -Encoding UTF8` na 5.1 escreve BOM; na 7, `utf8NoBOM` é o nome do enum. Nenhuma das
    duas formas serve para os dois. E BOM num `.env` faz a primeira chave ser descartada em silêncio.
#>
function Escrever-SemBom([string]$Caminho, [string[]]$Linhas) {
    $utf8SemBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
    [System.IO.File]::WriteAllLines($Caminho, $Linhas, $utf8SemBom)
}

function Resolver-DestinoApp([string]$Informado) {
    if ($Informado) { return (Resolve-Path -LiteralPath $Informado).Path }

    # Caso 1: este script está em `<app>\ferramentas\` (pacote montado).
    $pai = Split-Path -Parent $PSScriptRoot
    if (Test-Path -LiteralPath (Join-Path $pai 'dist\index.html')) { return $pai }

    # Caso 2: está na raiz do pacote.
    if (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'dist\index.html')) { return $PSScriptRoot }

    throw "Não achei a pasta do app a partir de $PSScriptRoot. Passe -DestinoApp explicitamente."
}

<#
    Baixa com conferência de checksum.

    Por que o checksum não é opcional: isto baixa **binário executável** e o coloca no PATH do app. Um
    download interrompido, um proxy que devolve página de erro ou um comprometimento do release virariam
    execução de código nesta máquina. O hash vem do mesmo release, então não protege contra o release
    inteiro comprometido — mas protege contra todo o resto, que é o caso comum.
#>
function Baixar-ComHash {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Url,
        [Parameter(Mandatory)][string]$UrlDoHash,
        [Parameter(Mandatory)][string]$NomeArquivo,
        [Parameter(Mandatory)][string]$DestinoZip
    )

    $temp = Join-Path ([System.IO.Path]::GetTempPath()) ("rebeca-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $temp -Force | Out-Null
    try {
        Escrever "  baixando $NomeArquivo ..."
        Invoke-WebRequest -Uri $Url -OutFile $DestinoZip

        Escrever '  conferindo checksum ...'
        $textoHash = Invoke-RestMethod -Uri $UrlDoHash -Method Get
        $linha = ($textoHash -split "`n") | Where-Object { $_ -match [regex]::Escape($NomeArquivo) } | Select-Object -First 1
        if (-not $linha) { throw "O arquivo de checksums não lista $NomeArquivo — não dá para conferir o download." }

        $esperado = ($linha -split '\s+')[0].Trim().ToLowerInvariant()
        $obtido = (Get-FileHash -LiteralPath $DestinoZip -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($esperado -ne $obtido) {
            throw "Checksum não confere para $NomeArquivo (esperado $esperado, obtido $obtido). Download descartado."
        }
        Escrever '  checksum confere'
    }
    finally {
        Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Instalar-Node([string]$RuntimeDir, [string]$Versao) {
    $destino = Join-Path $RuntimeDir 'node'
    if (Test-Path -LiteralPath (Join-Path $destino 'node.exe')) {
        Escrever "  node portátil já existe em runtime\node"
        return $true
    }

    try {
        if (-not $Versao) {
            Escrever '  descobrindo a LTS mais recente...'
            $indice = Invoke-RestMethod -Uri $NODE_INDEX -Method Get
            $lts = $indice | Where-Object { $_.lts -and $_.lts -ne $false } | Select-Object -First 1
            if (-not $lts) { throw 'Não consegui identificar a LTS no índice do nodejs.org.' }
            $Versao = $lts.version.TrimStart('v')
        }
        Escrever "  Node $Versao (win-x64)"

        $arquivo = "node-v$Versao-win-x64.zip"
        $zip = Join-Path ([System.IO.Path]::GetTempPath()) $arquivo
        Baixar-ComHash -Url "https://nodejs.org/dist/v$Versao/$arquivo" `
            -UrlDoHash "https://nodejs.org/dist/v$Versao/SHASUMS256.txt" `
            -NomeArquivo $arquivo -DestinoZip $zip

        $extraido = Join-Path ([System.IO.Path]::GetTempPath()) ("node-extraido-" + [guid]::NewGuid().ToString('N'))
        Expand-Archive -LiteralPath $zip -DestinationPath $extraido -Force
        $pastaInterna = Get-ChildItem -LiteralPath $extraido -Directory | Select-Object -First 1
        if (-not $pastaInterna) { throw 'O zip do Node não trouxe pasta interna.' }

        New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null
        if (Test-Path -LiteralPath $destino) { Remove-Item -LiteralPath $destino -Recurse -Force }
        Move-Item -LiteralPath $pastaInterna.FullName -Destination $destino
        Remove-Item -LiteralPath $zip, $extraido -Recurse -Force -ErrorAction SilentlyContinue
        return $true
    }
    catch {
        Avisar "  não consegui instalar o Node portátil: $($_.Exception.Message)"
        return $false
    }
}

function Instalar-Ffmpeg([string]$RuntimeDir, [string]$Arquivo) {
    $destino = Join-Path $RuntimeDir 'ffmpeg'
    if (Test-Path -LiteralPath (Join-Path $destino 'bin\ffmpeg.exe')) {
        Escrever '  ffmpeg portátil já existe em runtime\ffmpeg'
        return $true
    }

    try {
        Escrever "  ffmpeg ($Arquivo)"
        $zip = Join-Path ([System.IO.Path]::GetTempPath()) $Arquivo
        Baixar-ComHash -Url "$FFMPEG_BASE/$Arquivo" -UrlDoHash "$FFMPEG_BASE/checksums.sha256" `
            -NomeArquivo $Arquivo -DestinoZip $zip

        $extraido = Join-Path ([System.IO.Path]::GetTempPath()) ("ffmpeg-extraido-" + [guid]::NewGuid().ToString('N'))
        Expand-Archive -LiteralPath $zip -DestinationPath $extraido -Force
        $pastaInterna = Get-ChildItem -LiteralPath $extraido -Directory | Select-Object -First 1
        if (-not $pastaInterna) { throw 'O zip do ffmpeg não trouxe pasta interna.' }

        New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null
        if (Test-Path -LiteralPath $destino) { Remove-Item -LiteralPath $destino -Recurse -Force }
        Move-Item -LiteralPath $pastaInterna.FullName -Destination $destino
        Remove-Item -LiteralPath $zip, $extraido -Recurse -Force -ErrorAction SilentlyContinue
        return $true
    }
    catch {
        Avisar "  não consegui instalar o ffmpeg portátil: $($_.Exception.Message)"
        return $false
    }
}

# Escreve o `.env` **só** quando ele não existe. Reescrever apagaria o acesso já configurado — e a
# pessoa descobriria isso como "o app parou de abrir", sem ligar uma coisa à outra.
function Garantir-Env([string]$AppDir) {
    # `$arquivoEnv`, e não `$env`: `$env` é o nome da unidade de variáveis de ambiente do PowerShell, e
    # reutilizá-lo como variável comum é o tipo de coisa que só falha na hora errada.
    $arquivoEnv = Join-Path $AppDir '.env'
    if (Test-Path -LiteralPath $arquivoEnv) {
        Escrever "  .env já existe — não mexi nele"
        return
    }

    $clientId = $GoogleClientId
    $subs = $AllowedSubs

    if (-not $clientId) {
        $clientId = (Read-Host 'GOOGLE_CLIENT_ID (Enter para pular)').Trim()
    }
    if (-not $subs) {
        $subs = (Read-Host 'REBECA_ALLOWED_SUBS — subs autorizados, separados por vírgula (Enter para pular)').Trim()
    }

    if (-not $clientId) {
        Avisar '  .env NÃO criado (sem GOOGLE_CLIENT_ID). O app vai abrir e responder 503 em tudo.'
        Avisar '  Rode de novo com -GoogleClientId, ou edite o .env depois.'
        return
    }

    $linhas = @(
        "# Configuração desta máquina. Criado por ferramentas\instalar.ps1 — ver .env.example do repositório.",
        "GOOGLE_CLIENT_ID=$clientId",
        "REBECA_ALLOWED_SUBS=$subs"
    )
    Escrever-SemBom -Caminho $arquivoEnv -Linhas $linhas
    Escrever '  .env criado'
    if (-not $subs) {
        Avisar '  REBECA_ALLOWED_SUBS está vazio: ninguém entra ainda. Faça o primeiro login, veja o sub na tela e rode de novo ou edite o .env.'
    }
}

function Criar-Atalho([string]$AppDir) {
    $alvo = Join-Path $AppDir 'Rebeca.cmd'
    $areaTrabalho = [Environment]::GetFolderPath('Desktop')
    if (-not $areaTrabalho) { Avisar '  não localizei a área de trabalho; atalho não criado.'; return }
    $lnk = Join-Path $areaTrabalho 'Rebeca.lnk'

    try {
        $shell = New-Object -ComObject WScript.Shell
        $atalho = $shell.CreateShortcut($lnk)
        $atalho.TargetPath = $alvo
        $atalho.WorkingDirectory = $AppDir
        $atalho.Description = 'Rebeca — app local'
        $atalho.Save()
        Escrever "  atalho criado: $lnk"
    }
    catch {
        Avisar "  não consegui criar o atalho ($($_.Exception.Message)). Use Rebeca.cmd na pasta do app."
    }
}

function Teste-DeFumaca([string]$AppDir, [string]$NodeExe, [int]$PortaTeste) {
    $cli = Join-Path $AppDir 'build\server\local\cli.js'
    $anterior = $env:REBECA_PORT
    $env:REBECA_PORT = [string]$PortaTeste
    $processo = $null
    try {
        $processo = Start-Process -FilePath $NodeExe -ArgumentList @($cli) -WorkingDirectory $AppDir -PassThru -WindowStyle Hidden
        $limite = (Get-Date).AddSeconds(30)
        while ((Get-Date) -lt $limite) {
            Start-Sleep -Milliseconds 400
            if ($processo.HasExited) { throw "o servidor encerrou na subida (código $($processo.ExitCode))." }
            try {
                # `WebClient` em vez de `Invoke-WebRequest`: na 5.1 o IWR sem `-UseBasicParsing` usa o
                # motor do Internet Explorer para interpretar HTML, e depende de configuração da máquina
                # para responder. Isto aqui é uma requisição HTTP local e um `-match` sobre o corpo.
                $cliente = New-Object System.Net.WebClient
                $html = $cliente.DownloadString("http://127.0.0.1:$PortaTeste/")
                $cliente.Dispose()
                if ($html -match 'id="root"') {
                    Escrever "  teste de fumaça: HTTP 200 na porta $PortaTeste, casca servida"
                    return $true
                }
            }
            catch { }
        }
        throw 'o servidor subiu mas não respondeu a casca em 30 segundos.'
    }
    catch {
        Avisar "  teste de fumaça falhou: $($_.Exception.Message)"
        return $false
    }
    finally {
        if ($processo -and -not $processo.HasExited) { Stop-Process -Id $processo.Id -Force -ErrorAction SilentlyContinue }
        if ($anterior) { $env:REBECA_PORT = $anterior } else { Remove-Item Env:\REBECA_PORT -ErrorAction SilentlyContinue }
    }
}

try {
    $app = Resolver-DestinoApp $DestinoApp
    Escrever "Instalando o Rebeca em $app"

    # --- 1. O pacote está completo? ----------------------------------------
    foreach ($obrigatorio in @('dist\index.html', 'build\server\local\cli.js', 'vercel.json', 'Rebeca.cmd')) {
        if (-not (Test-Path -LiteralPath (Join-Path $app $obrigatorio))) {
            throw "Pacote incompleto: falta '$obrigatorio'. Copie a pasta inteira, não só parte dela."
        }
    }

    $runtimeDir = Join-Path $app 'runtime'

    # --- 2. Runtime ---------------------------------------------------------
    Escrever 'Runtime:'
    $nodePortatil = $false
    $ffmpegPortatil = $false

    if ($SemDownload) {
        Escrever '  -SemDownload: não vou baixar nada'
    }
    else {
        New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
        $nodePortatil = Instalar-Node -RuntimeDir $runtimeDir -Versao $NodeVersion
        if (-not $SemFfmpeg) { $ffmpegPortatil = Instalar-Ffmpeg -RuntimeDir $runtimeDir -Arquivo $FfmpegArquivo }
        else { Escrever '  ffmpeg pulado (-SemFfmpeg)' }
    }

    # Quem vai executar o servidor: runtime portátil, senão o Node do PATH.
    $nodeExe = Join-Path $runtimeDir 'node\node.exe'
    if (-not (Test-Path -LiteralPath $nodeExe)) {
        $noPath = Get-Command node -ErrorAction SilentlyContinue
        if (-not $noPath) {
            throw 'Sem Node: nem runtime\node nem node no PATH. Rode sem -SemDownload (precisa de internet) ou instale o Node 22+.'
        }
        $nodeExe = $noPath.Source
        Escrever "  usando o Node do PATH: $nodeExe"
    }
    else {
        Escrever "  Node portátil pronto: $nodeExe"
    }

    $ffmpegNoPath = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if ($ffmpegPortatil) { Escrever '  ffmpeg portátil pronto' }
    elseif ($ffmpegNoPath) { Escrever "  usando o ffmpeg do PATH: $($ffmpegNoPath.Source)" }
    else { Avisar '  sem ffmpeg: o pipeline de mídia (imagem, voz, render) vai recusar gerar' }

    if ($SomenteRuntime) {
        Escrever 'Somente runtime (-SomenteRuntime): parando aqui.'
        exit 0
    }

    # --- 3. Configuração de acesso -----------------------------------------
    Escrever 'Configuração de acesso:'
    Garantir-Env -AppDir $app

    # --- 4. Atalho ----------------------------------------------------------
    if (-not $SemAtalho) {
        Escrever 'Atalho:'
        Criar-Atalho -AppDir $app
    }

    # --- 5. Teste de fumaça -------------------------------------------------
    Escrever 'Teste:'
    $ok = Teste-DeFumaca -AppDir $app -NodeExe $nodeExe -PortaTeste $Porta

    Escrever ''
    if ($ok) {
        Escrever "Pronto. Abra o Rebeca pelo atalho ou por $app\Rebeca.cmd"
    }
    else {
        Avisar 'A instalação terminou, mas o teste de fumaça falhou. Rode Rebeca.cmd e leia a mensagem na janela.'
    }
    Escrever "  Dados desta máquina (backup = copiar esta pasta): $(Join-Path $app '.rebeca')"
    exit $(if ($ok) { 0 } else { 1 })
}
catch {
    Write-Error "Falha na instalação: $($_.Exception.Message)"
    exit 1
}
