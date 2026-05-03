@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] Python venv not found at .venv\Scripts\python.exe
  echo Create it first:
  echo   python -m venv .venv
  echo   .venv\Scripts\activate
  echo   pip install -r requirements.txt
  pause
  exit /b 1
)

if not exist ".env" (
  echo [ERROR] .env not found.
  echo Copy .env.example to .env and configure values.
  pause
  exit /b 1
)

echo Starting Google Sheet ingestor...
".venv\Scripts\python.exe" app.py

endlocal
