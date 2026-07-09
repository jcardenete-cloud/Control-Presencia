@echo off
TITLE Control de Presencia - Iniciando...
SETLOCAL

:: Obtener la ruta del directorio donde se encuentra el script
SET "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

echo ==========================================
echo    INICIANDO CONTROL DE CONTROL DE PRESENCIA
echo ==========================================
echo.

:: Verificar si existe node_modules
IF NOT EXIST "node_modules\" (
    echo [INFO] Instalando dependencias por primera vez...
    call npm install
)

:: Arrancar la aplicacion (Frontend y Backend)
echo [INFO] Arrancando servidores...
echo [HINT] La aplicacion sera accesible en http://192.168.145.122:3002
echo [HINT] Cierra esta ventana para detener la aplicacion.
echo.

:: Abrir el navegador despues de unos segundos
start /b cmd /c "timeout /t 5 >nul && start http://192.168.145.122:3002"

:: Ejecutar el comando de desarrollo
call npm run dev:all
