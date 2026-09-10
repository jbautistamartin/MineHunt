@echo off
rem ======================================================================
rem  MineHunt - probar-servidor.cmd
rem
rem  Lo que hace este script se imprime al ejecutarlo: esta en el
rem  bloque :documentacion del final, que es lo que se ve en pantalla.
rem
rem  Catalogo completo (todos estos .cmd estan en la raiz del repo):
rem
rem    arrancar-web.cmd       La app Angular en modo desarrollo, con navegador.
rem    arrancar-servidor.cmd  El servidor NestJS con recarga en caliente.
rem    arrancar-online.cmd    Servidor + web a la vez, para el multijugador.
rem    verificar.cmd          Compilar + tipos + pruebas de los tres paquetes.
rem    compilar.cmd           Solo compilar los tres paquetes.
rem    verificar-tipos.cmd    Solo comprobar tipos, sin generar nada.
rem    probar.cmd             Todas las pruebas de los tres paquetes.
rem    probar-motor.cmd       Pruebas del motor de juego.      [arg: ver]
rem    probar-web.cmd         Pruebas de la web.               [arg: ver]
rem    probar-servidor.cmd    Pruebas del servidor.            [arg: ver | e2e]
rem    docker-arrancar.cmd    El servidor en Docker, como en produccion.
rem    docker-humo.cmd        Comprueba que lo desplegado juega de verdad.
rem    android-apk.cmd        Compila el APK de prueba para Android.
rem    android-abrir.cmd      Abre el proyecto Android en Android Studio.
rem    limpiar.cmd            Borra lo compilado del motor.
rem
rem  Cada uno explica al ejecutarse lo que hace. Este comentario es solo para
rem  quien abra el fichero.
rem ======================================================================

setlocal
cd /d "%~dp0"

call :documentacion

echo [MineHunt] Compilando el motor de juego...
call npm run compilar --workspace @minehunt/game-engine
if errorlevel 1 goto :error
echo.

if /i "%~1"=="ver" (
  echo [MineHunt] Pruebas del servidor en modo watch. Ctrl+C para salir.
  echo.
  call npm run probar:ver --workspace @minehunt/server
) else if /i "%~1"=="e2e" (
  echo [MineHunt] Pasando las pruebas de punta a punta del servidor...
  echo.
  call npm run probar:e2e --workspace @minehunt/server
) else (
  echo [MineHunt] Pasando las pruebas del servidor...
  echo.
  call npm run probar --workspace @minehunt/server
)
if errorlevel 1 goto :error

echo.
echo [MineHunt] Terminado con exito.
goto :fin

:error
echo.
echo [MineHunt] ERROR: el paso anterior ha fallado. Mira el detalle arriba.

:fin
echo.
pause
endlocal
goto :eof

:documentacion
echo ======================================================================
echo  MineHunt - probar-servidor.cmd
echo ======================================================================
echo.
echo  QUE HACE
echo    Compila el motor y pasa las pruebas del servidor NestJS.
echo.
echo  CUANDO USARLO
echo    Mientras se trabaje el servidor, que hoy es solo el esqueleto de la
echo    Fase 0. El multijugador llega en la Fase 6.
echo.
echo  EQUIVALE A
echo    npm run compilar --workspace @minehunt/game-engine
echo    npm run probar --workspace @minehunt/server
echo    npm run probar:ver --workspace @minehunt/server        modo watch
echo    npm run probar:e2e --workspace @minehunt/server        end to end
echo.
echo  ARGUMENTOS
echo    probar-servidor.cmd ver   modo watch, se relanza al guardar.
echo    probar-servidor.cmd e2e   pruebas de punta a punta: arrancan la
echo                              aplicacion entera y la llaman de verdad.
echo.
echo  Otros scripts en la raiz: arrancar-web, arrancar-servidor, arrancar-online,
echo  verificar, compilar, verificar-tipos, probar, probar-motor, probar-web,
echo  probar-servidor, docker-arrancar, docker-humo, android-apk, android-abrir
echo  y limpiar.
echo ======================================================================
echo.
goto :eof
