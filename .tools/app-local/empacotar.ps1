#Requires -Version 5.1
<#
.SYNOPSIS
    Monta a pasta portátil do Rebeca — o app inteiro, pronto para copiar para outra máquina Windows.

.DESCRIPTION
    Compatibilidade: roda no **Windows PowerShell 5.1** (o que existe na máquina do dono — verificado) e
    no **PowerShell 7**. Sem construção exclusiva da 7, e sem BOM nos arquivos que o servidor lê.

    Executa a construção (`pnpm run build:app`), junta a casca (`dist/`), o servidor compilado
    (`build/`), a política de segurança (`vercel.json`) e os dados que **não** são regeneráveis
    (`.rebeca/canais/`) numa pasta só, com o atalho `Rebeca.cmd` e o `LEIA-ME.txt`.

    O que este script deliberadamente **não** faz:

    - **Não copia segredo nenhum.** `.rebeca/segredos/` sai vazio, e o `.env` não é gerado aqui. Chave
      de IA e lista de acesso são da máquina de destino: copiar a chave daqui seria mover credencial
      de um computador para outro por pasta compartilhada (ver `rebeca-seguranca`).
    - **Não copia ativo nem histórico de custo.** `.rebeca/assets/` e as linhas de `.rebeca/custos.csv`
      são o trabalho e o gasto *desta* máquina. O pacote leva só o cabeçalho do livro, para o destino
      começar o próprio registro.
    - **Não apaga a pasta de destino.** Rodar duas vezes é seguro: os artefatos de build são
      atualizados e o que é dado do usuário (`.env`, `.rebeca/assets`, `.rebeca/segredos`, linhas do
      livro) fica onde está.

.PARAMETER Destino
    Onde montar o pacote. Padrão: `<raiz do repositório>\dist-app`.

.PARAMETER ComRuntime
    Também baixa o Node e o ffmpeg portáteis para `runtime/` dentro do pacote. Sem isto, a máquina de
    destino precisa ter Node 22+ (e ffmpeg, para o pipeline de mídia) no PATH — ou você roda o
    `instalar.ps1` lá, que baixa.

.PARAMETER Zip
    Compacta a pasta em `<Destino>\Rebeca-<data>.zip` depois de montar.

.EXAMPLE
    pwsh -NoProfile -File .\.tools\app-local\empacotar.ps1
    pwsh -NoProfile -File .\.tools\app-local\empacotar.ps1 -Destino D:\entrega -ComRuntime -Zip
#>
[CmdletBinding()]
param(
    # Vazio de propósito: `$PSScriptRoot` **não** está preenchido durante a ligação de parâmetros no
    # Windows PowerShell 5.1 (medido: `Split-Path -Parent $PSScriptRoot` recebe string vazia e o script
    # nem começa a rodar). O valor padrão é calculado no corpo, onde a variável já existe.
    [Parameter()][string]$Destino = '',
    [Parameter()][switch]$ComRuntime,
    [Parameter()][switch]$Zip
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$raizRepo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $Destino) { $Destino = Join-Path $raizRepo 'dist-app' }
$pastaApp = Join-Path $Destino 'Rebeca'

function Escrever([string]$mensagem) {
    Write-Information $mensagem -InformationAction Continue
}

# Compara o hash gravado com o do arquivo. Usado pelo instalador; mantido aqui também porque o pacote
# é montado com o mesmo ffmpeg que a máquina já validou.
function Copiar-SeMudou([string]$origem, [string]$destinoCompleto) {
    $destinoDir = Split-Path -Parent $destinoCompleto
    if (-not (Test-Path -LiteralPath $destinoDir)) {
        New-Item -ItemType Directory -Path $destinoDir -Force | Out-Null
    }
    Copy-Item -LiteralPath $origem -Destination $destinoCompleto -Force
}

try {
    Escrever "Empacotando o Rebeca a partir de $raizRepo"

    if (-not (Test-Path -LiteralPath (Join-Path $raizRepo 'package.json'))) {
        throw "Não achei package.json em $raizRepo. Rode este script de dentro do repositório."
    }

    # --- 1. Construção ------------------------------------------------------
    # `build:app` = casca (vite) + servidor (tsc). Não usar `tsc` sozinho: sem a casca o pacote sobe e
    # responde 404 em tudo.
    Escrever 'Construindo (pnpm run build:app)...'
    Push-Location $raizRepo
    try {
        & pnpm run build:app
        if ($LASTEXITCODE -ne 0) { throw "A construção falhou (exit $LASTEXITCODE)." }
    }
    finally {
        Pop-Location
    }

    foreach ($obrigatorio in @('dist\index.html', 'build\server\local\cli.js', 'vercel.json')) {
        if (-not (Test-Path -LiteralPath (Join-Path $raizRepo $obrigatorio))) {
            throw "A construção não produziu '$obrigatorio'. O pacote sairia quebrado."
        }
    }

    # --- 2. Montagem da pasta ----------------------------------------------
    if (-not (Test-Path -LiteralPath $pastaApp)) {
        New-Item -ItemType Directory -Path $pastaApp -Force | Out-Null
    }
    Escrever "Montando $pastaApp"

    # Artefatos de build: substituídos a cada execução (são derivados, não dado do usuário).
    foreach ($pasta in @('dist', 'build')) {
        $alvo = Join-Path $pastaApp $pasta
        if (Test-Path -LiteralPath $alvo) { Remove-Item -LiteralPath $alvo -Recurse -Force }
        Copy-Item -LiteralPath (Join-Path $raizRepo $pasta) -Destination $alvo -Recurse -Force
    }

    # `vercel.json` NÃO é configuração de deploy aqui: é de onde o servidor local lê os cabeçalhos de
    # segurança (CSP com o hash do script de tema, COOP, noindex). Sem ele o app sobe sem política.
    Copiar-SeMudou (Join-Path $raizRepo 'vercel.json') (Join-Path $pastaApp 'vercel.json')

    # Launcher e leia-me.
    Copiar-SeMudou (Join-Path $PSScriptRoot 'Rebeca.cmd') (Join-Path $pastaApp 'Rebeca.cmd')
    Copiar-SeMudou (Join-Path $PSScriptRoot 'LEIA-ME.txt') (Join-Path $pastaApp 'LEIA-ME.txt')

    # O instalador viaja dentro do pacote: é o que a outra máquina roda para baixar runtime e criar o
    # atalho. Sem ele, a pessoa que recebe a pasta teria de saber o que fazer por conta própria.
    New-Item -ItemType Directory -Path (Join-Path $pastaApp 'ferramentas') -Force | Out-Null
    Copiar-SeMudou (Join-Path $PSScriptRoot 'instalar.ps1') (Join-Path $pastaApp 'ferramentas\instalar.ps1')

    # --- 3. Dados que não são regeneráveis ---------------------------------
    # `.rebeca/canais/` é fonte: spec de mídia e allow-list de fornecedor por canal. Sem ela, o
    # pipeline recusa gerar ("canal não configurado") — foi verificado lendo o código, não suposto.
    $canais = Join-Path $raizRepo '.rebeca\canais'
    if (-not (Test-Path -LiteralPath $canais)) { throw "Não achei .rebeca\canais — o pacote sairia sem a configuração de canal." }
    $destinoCanais = Join-Path $pastaApp '.rebeca\canais'
    if (Test-Path -LiteralPath $destinoCanais) { Remove-Item -LiteralPath $destinoCanais -Recurse -Force }
    Copy-Item -LiteralPath $canais -Destination $destinoCanais -Recurse -Force

    # Livro de custos: só o cabeçalho. As linhas são o gasto desta máquina, e misturar históricos de
    # duas máquinas estragaria a resposta a "esse conteúdo valeu a pena?".
    $destinoCustos = Join-Path $pastaApp '.rebeca\custos.csv'
    if (-not (Test-Path -LiteralPath $destinoCustos)) {
        $cabecalho = (Get-Content -LiteralPath (Join-Path $raizRepo '.rebeca\custos.csv') -TotalCount 1)
        New-Item -ItemType Directory -Path (Split-Path -Parent $destinoCustos) -Force | Out-Null
        # UTF-8 sem BOM: `Set-Content -Encoding UTF8` na 5.1 escreve BOM, e o cabeçalho do livro de
        # custos é lido por um parser de CSV que não espera BOM na primeira coluna.
        $utf8SemBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
        [System.IO.File]::WriteAllLines($destinoCustos, @($cabecalho), $utf8SemBom)
        Escrever '  livro de custos: cabeçalho copiado, histórico não'
    }
    else {
        Escrever '  livro de custos: já existe no destino, preservado'
    }

    # Pastas de dado vazio: criadas mas nunca populadas por este script.
    foreach ($pasta in @('.rebeca\segredos', '.rebeca\assets')) {
        $alvo = Join-Path $pastaApp $pasta
        if (-not (Test-Path -LiteralPath $alvo)) {
            New-Item -ItemType Directory -Path $alvo -Force | Out-Null
        }
    }

    # --- 4. Runtime portátil (opcional) ------------------------------------
    if ($ComRuntime) {
        Escrever 'Baixando o runtime portátil (Node + ffmpeg)...'
        & (Join-Path $PSScriptRoot 'instalar.ps1') -DestinoApp $pastaApp -SomenteRuntime
        if ($LASTEXITCODE -ne 0) { throw "O download do runtime falhou (exit $LASTEXITCODE)." }
    }

    # --- 5. Relatório -------------------------------------------------------
    $tamanho = (Get-ChildItem -LiteralPath $pastaApp -Recurse -File | Measure-Object -Property Length -Sum).Sum
    Escrever ''
    Escrever "Pronto: $pastaApp  ($([math]::Round($tamanho / 1MB, 1)) MB)"
    Escrever "  Copie essa pasta para a outra máquina e dê duplo clique em Rebeca.cmd."

    if ($Zip) {
        $arquivo = Join-Path $Destino ("Rebeca-" + (Get-Date -Format 'yyyy-MM-dd') + ".zip")
        if (Test-Path -LiteralPath $arquivo) { Remove-Item -LiteralPath $arquivo -Force }
        Escrever "Compactando em $arquivo ..."
        Compress-Archive -Path (Join-Path $pastaApp '*') -DestinationPath $arquivo -CompressionLevel Optimal
        Escrever "  $([math]::Round((Get-Item -LiteralPath $arquivo).Length / 1MB, 1)) MB"
    }

    exit 0
}
catch {
    Write-Error "Falha ao empacotar: $($_.Exception.Message)"
    exit 1
}
