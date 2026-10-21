@echo off
rem ---------------------------------------------------------------------------------------------------
rem  Rebeca — atalho de partida do app instalado.
rem
rem  Faz tres coisas, nesta ordem, e para se qualquer uma falhar:
rem
rem   1. Vai para a pasta onde ESTE arquivo esta. Um atalho na area de trabalho abre com o diretorio do
rem      sistema; sem o `cd /d "%~dp0"`, o servidor subiria com a raiz errada.
rem   2. Prefere o runtime portatil (runtime\node\node.exe) e, se ele nao existir, usa o Node do PATH.
rem      E isso que faz a MESMA pasta funcionar nas duas formas: com runtime embutido (nao depende de
rem      nada instalado) ou leve (usa o Node que a maquina ja tem).
rem   3. Poe o ffmpeg portatil (runtime\ffmpeg\bin) na frente do PATH quando ele existe, para o pipeline
rem      de midia achar o binario sem instalacao nenhuma.
rem
rem  A janela fica aberta enquanto o app roda: e nela que aparecem a URL, os avisos de configuracao e o
rem  log de erro. Fechar a janela encerra o app — por isso o `pause` em qualquer caminho de falha.
rem ---------------------------------------------------------------------------------------------------
setlocal
cd /d "%~dp0"

set "PATH=%~dp0runtime\node;%~dp0runtime\ffmpeg\bin;%PATH%"
set "REBECA_OPEN_BROWSER=1"

if exist "%~dp0runtime\node\node.exe" (
  "%~dp0runtime\node\node.exe" "%~dp0build\server\local\cli.js"
  goto :fim
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [rebeca] Nao encontrei o Node nem em runtime\node nem no PATH.
  echo            Rode o instalar.ps1 desta pasta para baixar o runtime portatil,
  echo            ou instale o Node 22 ou superior ^(https://nodejs.org^).
  echo.
  pause
  exit /b 1
)

node "%~dp0build\server\local\cli.js"

:fim
if errorlevel 1 (
  echo.
  echo   [rebeca] O app terminou com erro. A mensagem esta acima.
  echo.
  pause
)
endlocal
