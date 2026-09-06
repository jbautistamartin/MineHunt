@echo off
rem ======================================================================
rem  MineHunt - arrancar-online.cmd
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

echo [MineHunt] Compilando el motor de juego...
call npm run compilar --workspace @minehunt/game-engine
if errorlevel 1 goto :error

echo.
echo [MineHunt] Abriendo el servidor en su propia ventana...
start "MineHunt - servidor" cmd /k npm run arrancar:dev --workspace @minehunt/server

echo [MineHunt] Abriendo la web en su propia ventana...
start "MineHunt - web" cmd /k npm run arrancar --workspace @minehunt/web

echo.
echo [MineHunt] Listo. Para jugar contra ti mismo abre dos ventanas del
echo            navegador en http://localhost:4200/online, pero que una sea
echo            de incognito: las dos pestanas de la misma ventana comparten
echo            el almacenamiento y se pisarian la credencial de la sala.
echo.
echo [MineHunt] Para jugar desde el movil, esta es la direccion de este PC
echo            en la red local. Ponla en "Cambiar de servidor" dentro de la
echo            aplicacion, con el puerto 3000:
echo.
for /f "tokens=2 delims=:" %%d in ('ipconfig ^| findstr /c:"IPv4"') do echo            http://%%d:3000
echo.
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
echo  MineHunt - arrancar-online.cmd
echo ======================================================================
echo.
echo  QUE HACE
echo    Compila el motor y levanta las dos cosas que hacen falta para el
echo    Multijugador Online, cada una en su ventana: el servidor NestJS en
echo    el puerto 3000 y la web de Angular en el 4200.
echo.
echo  CUANDO USARLO
echo    Para probar el Multijugador Online. Los otros dos modos de juego no
echo    necesitan servidor: van con el motor dentro del navegador.
echo.
echo  EQUIVALE A
echo    npm run compilar --workspace @minehunt/game-engine
echo    npm run arrancar:dev --workspace @minehunt/server   (una ventana)
echo    npm run arrancar --workspace @minehunt/web          (otra ventana)
echo.
echo  DESDE EL MOVIL
echo    La aplicacion de Android lleva la web dentro, asi que solo necesita
echo    llegar al servidor. Hay que decirle a que direccion: boton "Cambiar
echo    de servidor" de la pantalla del Multijugador Online. Si el movil no
echo    conecta, casi siempre es el cortafuegos de Windows bloqueando el
echo    puerto 3000: hay que permitirlo para la red privada.
echo.
echo  Otros scripts en la raiz: arrancar-web, arrancar-servidor, arrancar-online,
echo  verificar, compilar, verificar-tipos, probar, probar-motor, probar-web,
echo  probar-servidor, android-apk, android-abrir y limpiar.
echo ======================================================================
echo.
goto :eof
