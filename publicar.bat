@echo off
cd /d "%~dp0"
(
  echo first commit
  echo.
  echo Co-Authored-By: Claude Opus 5.5 ^<noreply@anthropic.com^>
  echo Claude-Session: https://claude.ai/code/session_01MYCeijgeTPNjoMaE41FQBM
) > "%TEMP%\vetrina-commit.txt"
(
  git --version
  git init
  git add .
  git commit -F "%TEMP%\vetrina-commit.txt"
  git branch -M main
  git remote add origin https://github.com/euAllanDev/Vetrina.git
  git push -u origin main
  echo EXITCODE %ERRORLEVEL%
) > git.log 2>&1
