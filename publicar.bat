@echo off
cd /d "%~dp0"
(
  echo Corrige catalogo: coluna atualizacao_auto com default no banco
  echo.
  echo Co-Authored-By: Claude Opus 5.5 ^<noreply@anthropic.com^>
  echo Claude-Session: https://claude.ai/code/session_01MYCeijgeTPNjoMaE41FQBM
) > "%TEMP%\vetrina-commit.txt"
(
  git add .
  git commit -F "%TEMP%\vetrina-commit.txt"
  git push
  echo EXITCODE %ERRORLEVEL%
) > git.log 2>&1
