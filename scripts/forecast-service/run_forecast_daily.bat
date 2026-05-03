@echo off
setlocal

cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" "run_daily_forecast.py" %*
) else (
  python "run_daily_forecast.py" %*
)

endlocal
