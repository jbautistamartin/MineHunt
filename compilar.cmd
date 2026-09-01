@echo off
rem ======================================================================
rem  MineHunt - compilar.cmd
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

echo [MineHunt] Compilando los tres paquetes...
echo.
call npm run compilar
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
echo  MineHunt - compilar.cmd
echo ======================================================================
echo.
echo  QUE HACE
echo    Compila los tres paquetes: el motor con tsc, el servidor con nest
echo    y la web con ng build.
echo.
echo  CUANDO USARLO
echo    Cuando solo quieras saber si todo compila, sin esperar a las
echo    pruebas. Tambien deja al dia el dist/ del motor, que es lo que
echo    consumen la web y el servidor.
echo.
echo  EQUIVALE A
echo    npm run compilar
echo.
echo  Otros scripts en la raiz: arrancar-web, arrancar-servidor, verificar, compilar,
echo  verificar-tipos, probar, probar-motor, probar-web, probar-servidor y limpiar.
echo ======================================================================
echo.
goto :eof
