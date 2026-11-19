@echo off
REM Compila e sobe o banco + API em segundo plano. Logs da build em build.log.
cd /d "%~dp0"
echo INICIO %DATE% %TIME% > build.log
docker compose up --build -d >> build.log 2>&1
echo EXITCODE %ERRORLEVEL% >> build.log
echo Pronto. API em http://localhost:8080/swagger-ui.html
