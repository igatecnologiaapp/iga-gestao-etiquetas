@echo off
REM Remove o serviço Lovable Print Agent (executar como Administrador).

setlocal
set "SERVICE_NAME=LovablePrintAgent"
set "INSTALL_DIR=%ProgramFiles%\LovablePrintAgent"

net session >nul 2>&1
if errorlevel 1 (
  echo ERRO: execute como Administrador.
  pause
  exit /b 1
)

sc stop %SERVICE_NAME% >nul 2>&1
sc delete %SERVICE_NAME%

if exist "%INSTALL_DIR%" rmdir /S /Q "%INSTALL_DIR%"

echo Servico removido. O perfil de pareamento em %%ProgramData%%\LovablePrintAgent foi mantido.
pause
endlocal
