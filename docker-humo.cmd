@echo off
rem ======================================================================
rem  MineHunt - docker-humo.cmd
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

set "DESTINO=%~1"
if "%DESTINO%"=="" set "DESTINO=http://localhost:3000"

echo [MineHunt] Jugando una partida completa contra %DESTINO% ...
echo.
call npm run humo --workspace @minehunt/server -- "%DESTINO%"
if errorlevel 1 goto :error

echo.
echo [MineHunt] El servidor desplegado juega. Todo correcto.
goto :fin

:error
echo.
echo [MineHunt] ERROR: la comprobacion ha fallado. Mira el detalle arriba.

:fin
echo.
pause
exit /b

:documentacion
echo ======================================================================
echo  MineHunt - docker-humo.cmd            [arg: direccion del servidor]
echo.
echo  QUE HACE
echo    Conecta dos clientes de verdad por Socket.IO, juega con ellos una
echo    partida entera contra el servidor que se le diga y comprueba que
echo    el limite de ritmo corta una rafaga. Que el proceso responda no
echo    dice nada; esto si.
echo.
echo  CUANDO USARLO
echo    Despues de cada despliegue, y despues de docker-arrancar.cmd.
echo.
echo  EJEMPLOS
echo    docker-humo.cmd                             va a localhost:3000
echo    docker-humo.cmd https://minehunt.example    va al servidor de verdad
echo.
echo  EQUIVALE A
echo    npm run humo --workspace @minehunt/server -- ^<direccion^>
echo.
echo  Otros scripts en la raiz: arrancar-web, arrancar-servidor, arrancar-online,
echo  verificar, compilar, verificar-tipos, probar, probar-motor, probar-web,
echo  probar-servidor, docker-arrancar, docker-humo, android-apk, android-abrir
echo  y limpiar.
echo ======================================================================
echo.
goto :eof
