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

call :asegurar_jdk21
if errorlevel 1 goto :fin

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

:fin
echo.
pause
endlocal
goto :eof

rem ======================================================================
rem  El JDK: hace falta el 21
rem
rem  Gradle 8.14 y el plugin de Android 8.13 no admiten el 25, y con el la
rem  compilacion revienta nada mas empezar con un "Unsupported class file major
rem  version 69" que no dice de que va. Como Java se actualiza solo y deja
rem  JAVA_HOME apuntando a la version nueva (o a un JRE, que tampoco sirve),
rem  aqui se busca un JDK 21 instalado en vez de pedirselo a quien lo lance.
rem
rem  Solo vale para esta ventana: no se toca la variable del sistema.
rem ======================================================================
:asegurar_jdk21
if defined JAVA_HOME (
  call :es_jdk21 "%JAVA_HOME%" && goto :eof
  echo [MineHunt] JAVA_HOME no apunta a un JDK 21; busco uno instalado...
) else (
  echo [MineHunt] JAVA_HOME no esta puesta; busco un JDK 21 instalado...
)

for %%B in (
  "%ProgramFiles%\Eclipse Adoptium"
  "%ProgramFiles%\Java"
  "%ProgramFiles%\Microsoft"
  "%ProgramFiles%\Amazon Corretto"
  "%LOCALAPPDATA%\Programs\Eclipse Adoptium"
) do (
  if exist %%B (
    for /d %%J in ("%%~B\jdk-21*") do (
      call :usar_jdk "%%~fJ" && goto :eof
    )
  )
)

rem El JDK que trae Android Studio, que hoy tambien es un 21.
call :usar_jdk "%ProgramFiles%\Android\Android Studio\jbr" && goto :eof

echo.
echo [MineHunt] ERROR: no encuentro ningun JDK 21, y Gradle no admite el 25.
echo            Instala el JDK 21 (Eclipse Temurin, por ejemplo) o pon
echo            JAVA_HOME apuntando a uno. Detalles en
echo            documentos\MineHunt-android.md.
exit /b 1

rem Deja JAVA_HOME en ese JDK si de verdad es un 21. Devuelve 1 si no lo es.
:usar_jdk
call :es_jdk21 "%~1" || exit /b 1
set "JAVA_HOME=%~1"
echo [MineHunt] Uso el JDK 21 de "%~1"
echo.
exit /b 0

rem Un JDK (no un JRE: se mira javac) y de la version 21.
rem
rem El "call" delante del javac no sobra: un ejecutable entrecomillado al frente
rem de una tuberia lo vuelve a entrecomillar cmd y deja de encontrarlo, asi que
rem sin el esta comprobacion fallaba siempre y ningun JDK valia.
:es_jdk21
if not exist "%~1\bin\javac.exe" exit /b 1
call "%~1\bin\javac.exe" -version 2>&1 | findstr /b /c:"javac 21." >nul
exit /b %errorlevel%

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
echo    plataforma 36. El JDK 21 lo busca este script solo si JAVA_HOME
echo    apunta a otra cosa. Detalles en documentos\MineHunt-android.md.
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
