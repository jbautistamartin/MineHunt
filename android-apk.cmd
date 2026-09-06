@echo off
rem ======================================================================
rem  MineHunt - android-apk.cmd
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

if "%ANDROID_HOME%"=="" (
  if exist "%LOCALAPPDATA%\Android\Sdk" (
    echo [MineHunt] ANDROID_HOME no estaba puesta; uso el SDK de %LOCALAPPDATA%\Android\Sdk
    set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
    echo.
  ) else (
    echo [MineHunt] ERROR: no encuentro el SDK de Android. Instalalo con Android
    echo            Studio o pon ANDROID_HOME apuntando a donde este.
    goto :fin
  )
)

echo [MineHunt] Compilando la web, sincronizando el proyecto nativo y montando el APK...
echo            La primera vez Gradle se descarga solo y tarda un buen rato.
echo.
call npm run apk-android --workspace @minehunt/web
if errorlevel 1 goto :error

echo.
echo [MineHunt] Terminado con exito. El APK esta en:
echo            apps\web\android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo            Para instalarlo en un movil con depuracion USB:
echo            adb install -r apps\web\android\app\build\outputs\apk\debug\app-debug.apk
goto :fin

:error
echo.
echo [MineHunt] ERROR: el paso anterior ha fallado. Mira el detalle arriba.
echo            Si se queja del JDK: hace falta el 21, no el 25. Pon JAVA_HOME
echo            apuntando a un JDK 21 y vuelve a lanzarlo.

:fin
echo.
pause
endlocal
goto :eof

:documentacion
echo ======================================================================
echo  MineHunt - android-apk.cmd
echo ======================================================================
echo.
echo  QUE HACE
echo    Compila la web, la mete dentro del proyecto Android con Capacitor y
echo    genera el APK de depuracion, listo para instalar en un movil.
echo.
echo  CUANDO USARLO
echo    Para probar el juego en un telefono de verdad.
echo.
echo  QUE HACE FALTA
echo    JDK 21 (con el 25 falla Gradle) y el SDK de Android con la
echo    plataforma 36. Detalles en documentos\MineHunt-android.md.
echo.
echo  EQUIVALE A
echo    npm run apk-android --workspace @minehunt/web
echo    ...que es: ng build + cap sync android + gradlew assembleDebug
echo.
echo  Otros scripts en la raiz: arrancar-web, arrancar-servidor, arrancar-online,
echo  verificar, compilar, verificar-tipos, probar, probar-motor, probar-web,
echo  probar-servidor, android-apk, android-abrir y limpiar.
echo ======================================================================
echo.
goto :eof
