@echo off
rem ======================================================================
rem  MineHunt - docker-arrancar.cmd
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

echo [MineHunt] Comprobando que Docker responde...
docker version >nul 2>&1
if errorlevel 1 (
  echo.
  echo [MineHunt] ERROR: Docker no responde. Abre Docker Desktop y espera a
  echo            que su motor arranque; la primera vez tarda un rato.
  goto :fin
)

echo [MineHunt] Construyendo la imagen y levantando el servidor...
docker compose up -d --build
if errorlevel 1 goto :error

echo.
echo [MineHunt] En marcha. El juego y el panel:
echo.
echo            http://localhost:3000          el juego
echo            http://localhost:3000/panel    el panel de salas
echo.
echo [MineHunt] Para ver lo que hace:  docker compose logs -f
echo            Para pararlo:          docker compose down
echo            Para comprobarlo:      docker-humo.cmd
goto :fin

:error
echo.
echo [MineHunt] ERROR: el paso anterior ha fallado. Mira el detalle arriba.

:fin
echo.
pause
exit /b

:documentacion
echo ======================================================================
echo  MineHunt - docker-arrancar.cmd
echo.
echo  QUE HACE
echo    Construye la imagen del servidor y la levanta con docker compose,
echo    igual que en el servidor de verdad. La imagen lleva dentro las dos
echo    cosas: el servidor NestJS y el cliente web, que sirve el propio
echo    Nest, asi que el juego sale en la raiz y el panel en /panel.
echo.
echo  CUANDO USARLO
echo    Para probar en local exactamente lo que se va a desplegar. Para el
echo    dia a dia sigue siendo mas comodo arrancar-online.cmd, que recarga
echo    en caliente al tocar el codigo.
echo.
echo  QUE HACE FALTA
echo    Docker Desktop abierto y con su motor arrancado.
echo.
echo  EQUIVALE A
echo    docker compose up -d --build
echo.
echo  Otros scripts en la raiz: arrancar-web, arrancar-servidor, arrancar-online,
echo  verificar, compilar, verificar-tipos, probar, probar-motor, probar-web,
echo  probar-servidor, docker-arrancar, docker-humo, android-apk, android-abrir
echo  y limpiar.
echo ======================================================================
echo.
goto :eof
