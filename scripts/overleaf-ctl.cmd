@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0overleaf-ctl.ps1" %*
exit /b %ERRORLEVEL%
