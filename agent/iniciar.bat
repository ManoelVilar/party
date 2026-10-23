@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js ^(versao LTS^) em https://nodejs.org, feche esta janela e abra de novo.
  pause
  exit /b 1
)
where claude >nul 2>nul
if errorlevel 1 (
  echo O comando "claude" nao foi encontrado. Instale e entre com: claude auth login
  pause
  exit /b 1
)
if not exist node_modules call npm install
if not exist ..\credencial.json (
  echo Falta o arquivo credencial.json na pasta do projeto ^(%~dp0..^). Salve a credencial do Party nele.
  pause
  exit /b 1
)
node claude-agent.mjs ..\credencial.json %*
pause
