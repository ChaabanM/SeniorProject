$TaskName = "DSS Demand Forecast Daily"
$ServiceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Runner = Join-Path $ServiceDir "run_forecast_daily.bat"
$LogDir = Join-Path $ServiceDir "logs"
$LogFile = Join-Path $LogDir "forecast-task.log"

if (-not (Test-Path $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir | Out-Null
}

$Action = New-ScheduledTaskAction `
  -Execute "cmd.exe" `
  -Argument "/c `"`"$Runner`" >> `"$LogFile`" 2>>&1`""

$Trigger = New-ScheduledTaskTrigger -Daily -At 2:00am
$Settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 4)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Description "Runs DSS active-dataset demand forecasting every day." `
  -Force | Out-Null

Write-Output "Installed scheduled task: $TaskName"
Write-Output "Daily run time: 2:00 AM"
Write-Output "Log file: $LogFile"
