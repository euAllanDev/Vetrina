@echo off
REM Executa o teste de ponta a ponta (scripts\smoke-test.ps1). Resultado em smoke.log, logs da API em app.log.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\smoke-test.ps1 > smoke.log 2>&1
echo EXITCODE %ERRORLEVEL% >> smoke.log
docker compose logs app --tail 200 > app.log 2>&1
