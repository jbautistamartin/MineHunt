@echo off
rem ======================================================================
rem  MineHunt - limpiar.cmd
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

echo [MineHunt] Borrando lo compilado del motor...
echo.
call npm run limpiar --workspace @minehunt/game-engine
if errorlevel 1 goto :error

echo [MineHunt] Listo. Recompila con compilar.cmd o arrancar-web.cmd.

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
echo  MineHunt - limpiar.cmd
echo ======================================================================
echo.
echo  QUE HACE
echo    Borra lo que el motor deja compilado, su dist/ y el tsbuildinfo,
echo    para forzar una compilacion desde cero la proxima vez.
echo    No toca node_modules.
echo.
echo  CUANDO USARLO
echo    Cuando el build se comporte de forma rara: errores que no cuadran
echo    con el codigo, cambios que no se ven, tipos que deberian existir.
echo    Casi siempre es un dist/ viejo.
echo.
echo  EQUIVALE A
echo    npm run limpiar --workspace @minehunt/game-engine
echo.
echo  Otros scripts en la raiz: arrancar-web, arrancar-servidor, arrancar-online,
echo  verificar, compilar, verificar-tipos, probar, probar-motor, probar-web,
echo  probar-servidor, android-apk, android-abrir y limpiar.
echo ======================================================================
echo.
goto :eof
