@echo off
rem ======================================================================
rem  MineHunt - arrancar-servidor.cmd
rem
rem  Lo que hace este script se imprime al ejecutarlo: esta en el
rem  bloque :documentacion del final, que es lo que se ve en pantalla.
rem
rem  Catalogo completo (todos estos .cmd estan en la raiz del repo):
rem
rem    arrancar-web.cmd       La app Angular en modo desarrollo, con navegador.
rem    arrancar-servidor.cmd  El servidor NestJS con recarga en caliente.
rem    verificar.cmd          Compilar + tipos + pruebas de los tres paquetes.
rem    compilar.cmd           Solo compilar los tres paquetes.
rem    verificar-tipos.cmd    Solo comprobar tipos, sin generar nada.
rem    probar.cmd             Todas las pruebas de los tres paquetes.
rem    probar-motor.cmd       Pruebas del motor de juego.      [arg: ver]
rem    probar-web.cmd         Pruebas de la web.               [arg: ver]
rem    probar-servidor.cmd    Pruebas del servidor.            [arg: ver | e2e]
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
echo [MineHunt] Arrancando el servidor. Ctrl+C para parar.
echo.
call npm run arrancar:dev --workspace @minehunt/server
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
echo  MineHunt - arrancar-servidor.cmd
echo ======================================================================
echo.
echo  QUE HACE
echo    Compila el motor y levanta el servidor NestJS con recarga en
echo    caliente. Se queda corriendo hasta que lo pares con Ctrl+C.
echo.
echo  CUANDO USARLO
echo    Solo hace falta cuando se trabaje el multijugador. Hoy el servidor
echo    es el esqueleto de la Fase 0: responde, pero no hay partidas en red
echo    hasta la Fase 6 del plan maestro.
echo.
echo  EQUIVALE A
echo    npm run compilar --workspace @minehunt/game-engine
echo    npm run arrancar:dev --workspace @minehunt/server
echo.
echo  LA TRAMPA DEL MONOREPO
echo    La web y el servidor NO consumen el codigo fuente del motor, sino su
echo    dist/ ya compilado. Por eso este script compila el motor antes de nada:
echo    si no, se probaria contra la version anterior y los fallos no tendrian
echo    ningun sentido.
echo.
echo  Otros scripts en la raiz: arrancar-web, arrancar-servidor, verificar, compilar,
echo  verificar-tipos, probar, probar-motor, probar-web, probar-servidor y limpiar.
echo ======================================================================
echo.
goto :eof
