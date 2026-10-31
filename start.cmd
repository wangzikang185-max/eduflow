@echo off
setlocal
set "XUEXU_NODE=node.exe"
where.exe node.exe >nul 2>nul
if errorlevel 1 (
  if exist "D:\Node\node.exe" (
    set "XUEXU_NODE=D:\Node\node.exe"
  ) else (
    echo Node.js was not found. Install Node.js 22.6 or newer and reopen this window.
    if "%~1"=="" pause
    exit /b 1
  )
)
"%XUEXU_NODE%" "%~dp0tools\start-local.mjs" %*
set "XUEXU_EXIT=%ERRORLEVEL%"
if not "%XUEXU_EXIT%"=="0" if "%~1"=="" pause
exit /b %XUEXU_EXIT%
