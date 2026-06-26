@echo off
REM Lovable Print Agent — instalador Windows (executar como Administrador).
REM 1) Copia o PrintAgent.exe para Program Files.
REM 2) Registra o serviço Windows (autostart).
REM 3) Cria atalhos "Parear Print Agent" no Desktop e Menu Iniciar (GUI).

setlocal
set "INSTALL_DIR=%ProgramFiles%\LovablePrintAgent"
set "EXE_SRC=%~dp0..\dist\PrintAgent.exe"
set "EXE_DST=%INSTALL_DIR%\PrintAgent.exe"
set "SERVICE_NAME=LovablePrintAgent"
set "SHORTCUT_NAME=Parear Print Agent.lnk"

echo === Lovable Print Agent - Instalacao ===

net session >nul 2>&1
if errorlevel 1 (
  echo ERRO: execute este instalador como Administrador.
  pause
  exit /b 1
)

if not exist "%EXE_SRC%" (
  echo ERRO: %EXE_SRC% nao encontrado.
  pause
  exit /b 1
)

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
copy /Y "%EXE_SRC%" "%EXE_DST%" >nul

sc query %SERVICE_NAME% >nul 2>&1
if not errorlevel 1 (
  echo Servico ja existe - atualizando binario e reiniciando...
  sc stop %SERVICE_NAME% >nul 2>&1
  timeout /t 2 >nul
) else (
  echo Criando servico %SERVICE_NAME%...
  sc create %SERVICE_NAME% binPath= "\"%EXE_DST%\" start" start= auto DisplayName= "Lovable Print Agent"
  sc description %SERVICE_NAME% "Recebe comandos de impressao do painel Lovable e envia para as impressoras locais."
)

sc start %SERVICE_NAME%

echo Criando atalho "Parear Print Agent"...
set "PS_CMD=$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%PUBLIC%\Desktop\%SHORTCUT_NAME%'); $s.TargetPath='%EXE_DST%'; $s.Arguments='pair-ui'; $s.IconLocation='%EXE_DST%'; $s.Description='Parear esta estacao com o painel Lovable'; $s.Save()"
powershell -NoProfile -Command "%PS_CMD%" >nul 2>&1

set "START_MENU=%ProgramData%\Microsoft\Windows\Start Menu\Programs\Lovable Print Agent"
if not exist "%START_MENU%" mkdir "%START_MENU%"
set "PS_CMD2=$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%START_MENU%\%SHORTCUT_NAME%'); $s.TargetPath='%EXE_DST%'; $s.Arguments='pair-ui'; $s.IconLocation='%EXE_DST%'; $s.Save()"
powershell -NoProfile -Command "%PS_CMD2%" >nul 2>&1

echo.
echo === Instalacao concluida ===
echo.
echo PROXIMO PASSO - PAREAMENTO:
echo   1) No painel Lovable, abra Impressoras e gere o codigo de 6 digitos.
echo   2) Va ate a area de trabalho e DE DUPLO CLIQUE em "Parear Print Agent".
echo   3) Digite o codigo na janela que abrir e clique OK.
echo.
echo Voce tambem encontra o atalho em: Menu Iniciar - Lovable Print Agent.
echo.
pause
endlocal
