@echo off
rem ======================================================================
rem  MineHunt - arrancar-web.cmd
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

set "PUERTO=%~1"
if "%PUERTO%"=="" set "PUERTO=4200"

echo [MineHunt] Compilando el motor de juego...
call npm run compilar --workspace @minehunt/game-engine
if errorlevel 1 goto :error

echo.
echo [MineHunt] Arrancando la web en http://localhost:%PUERTO%
echo [MineHunt] El navegador se abrira solo. Ctrl+C para parar.
echo.
call npm run arrancar --workspace @minehunt/web -- --port %PUERTO% --open
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
echo  MineHunt - arrancar-web.cmd
echo ======================================================================
echo.
echo  QUE HACE
echo    Compila el motor de juego y levanta la web de Angular en modo
echo    desarrollo. Abre la pagina en el navegador cuando esta lista.
echo    Se queda corriendo y recompila al guardar. Ctrl+C para parar.
echo.
echo  CUANDO USARLO
echo    Para jugar y validar los cambios a ojo.
echo    Es el punto de entrada habitual del proyecto.
echo.
echo  EQUIVALE A
echo    npm run compilar --workspace @minehunt/game-engine
echo    npm run arrancar --workspace @minehunt/web -- --port 4200 --open
echo.
echo  PUERTO
echo    Por defecto el 4200. Se puede pasar otro:  arrancar-web.cmd 4300
echo    Util si el 4200 se quedo ocupado por un arranque anterior.
echo.
echo  Otros scripts en la raiz: arrancar-web, arrancar-servidor, arrancar-online,
echo  verificar, compilar, verificar-tipos, probar, probar-motor, probar-web,
echo  probar-servidor, docker-arrancar, docker-humo, android-apk, android-abrir
echo  y limpiar.
echo ======================================================================
echo.
goto :eof
