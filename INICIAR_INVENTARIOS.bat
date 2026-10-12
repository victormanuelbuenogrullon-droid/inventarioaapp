@echo off
title Sistema de Pase de Inventario Colaborativo en Tiempo Real
color 0F
cd /d "%~dp0"

echo ======================================================================
echo       SISTEMA DE PASE DE INVENTARIO COLABORATIVO EN TIEMPO REAL
echo ======================================================================
echo.

:: Verificar que node_modules exista
if not exist "node_modules" (
    echo  [!] Instalando dependencias necesarias...
    call npm.cmd install
    echo.
)

:: Compilar la aplicacion web si no existe dist
if not exist "dist" (
    echo  [*] Compilando aplicacion web optimizada...
    call npm.cmd run build
    echo.
)

:: Abrir navegador en http://localhost:3000 tras 3 segundos
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

:: Iniciar servidor central
echo  Iniciando servidor central multiusuario...
echo  (Para apagar el servidor simplemente cierra esta ventana)
echo ======================================================================
echo.

node server.js

pause
