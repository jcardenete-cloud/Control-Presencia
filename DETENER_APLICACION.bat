@echo off
echo Deteniendo procesos de Control de Presencia...
taskkill /F /IM node.exe /T
echo.
echo Aplicacion detenida.
timeout /t 2
