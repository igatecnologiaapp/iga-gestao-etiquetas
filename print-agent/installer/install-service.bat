@echo off
REM Lovable Print Agent — instalador Windows (executar como Administrador).
REM Registra o PrintAgent.exe como serviço Windows iniciado automaticamente.

setlocal
set "INSTALL_DIR=%ProgramFiles%\LovablePrintAgent"
set "EXE_SRC=%~dp0..\dist\PrintAgent.exe"
set "EXE_DST=%INSTALL_DIR%\PrintAgent.exe"
set "SERVICE_NAME=LovablePrintAgent"

echo === Lovable Print Agent — Instalacao ===

net session >nul 2>&1
if errorlevel 1 (
  echo ERRO: execute este instalador como Administrador.
  pause
  exit /b 1
)

if not exist "%EXE_SRC%" (
  echo ERRO: %EXE_SRC% nao encontrado.
  echo       Rode antes:  cd print-agent ^&^& npm install ^&^& npm run build:win
  pause
  exit /b 1
)

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
copy /Y "%EXE_SRC%" "%EXE_DST%" >nul

sc query %SERVICE_NAME% >nul 2>&1
if not errorlevel 1 (
  echo Servico ja existe — atualizando binario e reiniciando...
  sc stop %SERVICE_NAME% >nul 2>&1
  timeout /t 2 >nul
) else (
  echo Criando servico %SERVICE_NAME%...
  sc create %SERVICE_NAME% binPath= "\"%EXE_DST%\" start" start= auto DisplayName= "Lovable Print Agent"
  sc description %SERVICE_NAME% "Recebe comandos de impressao do painel Lovable e envia para as impressoras locais."
)

sc start %SERVICE_NAME%

echo.
echo === Pareamento ===
echo Para parear esta estacao, abra um terminal como Administrador e rode:
echo     "%EXE_DST%" pair 123456
echo (substitua 123456 pelo codigo de 6 digitos gerado no painel)
echo.
pause
endlocal
