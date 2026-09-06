@echo off
rem ======================================================================
rem  MineHunt - verificar-tipos.cmd
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

echo [MineHunt] Comprobando tipos en los tres paquetes...
echo.
call npm run verificar-tipos
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
echo  MineHunt - verificar-tipos.cmd
echo ======================================================================
echo.
echo  QUE HACE
echo    Pasa el comprobador de tipos por los tres paquetes sin generar
echo    ningun fichero: tsc --noEmit.
echo.
echo  CUANDO USARLO
echo    Es la comprobacion mas rapida de todas. Va bien mientras editas,
echo    para cazar errores de tipos sin esperar al build ni a las pruebas.
echo.
echo  EQUIVALE A
echo    npm run verificar-tipos
echo.
echo  Otros scripts en la raiz: arrancar-web, arrancar-servidor, arrancar-online,
echo  verificar, compilar, verificar-tipos, probar, probar-motor, probar-web,
echo  probar-servidor, android-apk, android-abrir y limpiar.
echo ======================================================================
echo.
goto :eof
