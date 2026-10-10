@echo off
title Sistema de Pase de Inventario Colaborativo
color 0F
cd /d "%~dp0"

echo ==========================================================
echo       SISTEMA DE PASE DE INVENTARIO COLABORATIVO
echo ==========================================================
echo.
echo  Iniciando servidor en tiempo real...
echo  URL: http://localhost:3000
echo.

:: Verificar que node_modules exista
if not exist "node_modules" (
    echo  [!] Instalando dependencias por primera vez...
    call npm.cmd install
    call npm.cmd run build
    echo.
)

:: Abrir navegador en http://localhost:3000 tras 2 segundos
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: Iniciar servidor en tiempo real con WebSockets
echo  [OK] Servidor iniciado con sincronizacion multiusuario.
echo  (Para apagar el servidor simplemente cierra esta ventana)
echo ==========================================================
echo.

node server.js

pause
