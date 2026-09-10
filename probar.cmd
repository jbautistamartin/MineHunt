@echo off
rem ======================================================================
rem  MineHunt - probar.cmd
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

echo [MineHunt] Pasando las pruebas de los tres paquetes...
echo.
call npm run probar
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
echo  MineHunt - probar.cmd
echo ======================================================================
echo.
echo  QUE HACE
echo    Pasa las pruebas de los tres paquetes. Recompila el motor primero.
echo.
echo  CUANDO USARLO
echo    Cuando quieras las pruebas pero no necesites el build completo de
echo    la web ni el chequeo de tipos que hace verificar.cmd.
echo.
echo  EQUIVALE A
echo    npm run probar
echo.
echo  LA TRAMPA DEL MONOREPO
echo    La web y el servidor NO consumen el codigo fuente del motor, sino su
echo    dist/ ya compilado. Por eso este script compila el motor antes de nada:
echo    si no, se probaria contra la version anterior y los fallos no tendrian
echo    ningun sentido.
echo.
echo  Otros scripts en la raiz: arrancar-web, arrancar-servidor, arrancar-online,
echo  verificar, compilar, verificar-tipos, probar, probar-motor, probar-web,
echo  probar-servidor, docker-arrancar, docker-humo, android-apk, android-abrir
echo  y limpiar.
echo ======================================================================
echo.
goto :eof
