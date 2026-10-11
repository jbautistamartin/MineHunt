package com.minehunt.app;

import android.Manifest;
import android.content.Context;
import android.location.LocationManager;
import android.os.Build;
import android.util.Log;

import androidx.core.location.LocationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.nearby.Nearby;
import com.google.android.gms.nearby.connection.AdvertisingOptions;
import com.google.android.gms.nearby.connection.ConnectionInfo;
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback;
import com.google.android.gms.nearby.connection.ConnectionResolution;
import com.google.android.gms.nearby.connection.ConnectionsClient;
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo;
import com.google.android.gms.nearby.connection.DiscoveryOptions;
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback;
import com.google.android.gms.nearby.connection.Payload;
import com.google.android.gms.nearby.connection.PayloadCallback;
import com.google.android.gms.nearby.connection.PayloadTransferUpdate;
import com.google.android.gms.nearby.connection.Strategy;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Las radios del telefono para jugar con los de al lado, sin servidor.
 *
 * Envuelve **Nearby Connections** de Google Play Services en estrategia
 * {@code P2P_STAR}, que es exactamente la forma que ya tiene el Multijugador
 * Online: uno anuncia y manda, y de uno a tres se conectan a el. Nearby negocia
 * solo el medio —Bluetooth, BLE, Wi-Fi Direct o un punto de acceso temporal— y
 * se ocupa del descubrimiento, asi que aqui no hay ninguna IP ni ninguna red
 * comun que configurar.
 *
 * <p>No existe plugin oficial de Capacitor para esto, de ahi que sea del
 * proyecto. Se registra en {@link MainActivity} igual que el de vibracion.
 *
 * <p><b>Aqui no hay ni una regla del juego.</b> Por la radio van los mensajes
 * del protocolo tal cual los serializa la web, en texto; esta clase solo los
 * lleva y los trae. Quien los entiende es el motor, que corre dentro del
 * WebView del anfitrion.
 *
 * <p><b>Los payloads van en bytes y no se parten aqui.</b> Nearby admite 32 KB
 * por payload de bytes y el estado de un tablero grande no cabe, pero el
 * troceado lo hace la web (`transporte-local.ts`), que es donde se puede
 * probar sin dos telefonos en la mano.
 */
@CapacitorPlugin(
    name = "Cercanos",
    permissions = {
        @Permission(
            alias = CercanosPlugin.PERMISO_BLUETOOTH,
            strings = {
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_ADVERTISE,
                Manifest.permission.BLUETOOTH_CONNECT
            }
        ),
        @Permission(
            alias = CercanosPlugin.PERMISO_UBICACION,
            strings = { Manifest.permission.ACCESS_FINE_LOCATION }
        ),
        @Permission(
            alias = CercanosPlugin.PERMISO_WIFI_CERCANO,
            strings = { Manifest.permission.NEARBY_WIFI_DEVICES }
        )
    }
)
public class CercanosPlugin extends Plugin {

    static final String PERMISO_BLUETOOTH = "bluetooth";
    static final String PERMISO_UBICACION = "ubicacion";
    static final String PERMISO_WIFI_CERCANO = "wifiCercano";

    private static final String ETIQUETA = "MineHuntCercanos";

    /**
     * El identificador del servicio: solo se ven entre si los que lo comparten.
     *
     * Va atado al paquete de la aplicacion a proposito, para no tropezar con
     * ninguna otra que use Nearby en el mismo telefono.
     */
    private static final String SERVICIO = "com.minehunt.app.partida";

    /**
     * Uno anuncia y varios se conectan a el, que es la forma de una sala.
     *
     * {@code P2P_CLUSTER} dejaria a todos hablando con todos y no hace falta:
     * la sala tiene un dueño —el que la monto— y los demas solo hablan con el.
     * {@code P2P_POINT_TO_POINT} daria mas ancho de banda pero solo admite un
     * invitado, y aqui son hasta tres.
     */
    private static final Strategy ESTRATEGIA = Strategy.P2P_STAR;

    /** Con lo que se anuncia quien no dijo como se llama. */
    private static final String NOMBRE_POR_DEFECTO = "MineHunt";

    /**
     * Lo que Android deja anunciar como nombre sin cortarlo.
     *
     * El nombre viaja dentro del anuncio de BLE, que es diminuto. El juego ya
     * limita el nombre del jugador a 16, pero mas vale cortarlo aqui que
     * quedarse sin anunciar.
     */
    private static final int NOMBRE_MAXIMO = 24;

    /** El nombre con el que se presento cada extremo, para poder decirlo. */
    private final Map<String, String> nombres = new ConcurrentHashMap<>();

    private ConnectionsClient conexiones;

    private ConnectionsClient conexiones() {
        if (conexiones == null) {
            conexiones = Nearby.getConnectionsClient(getContext());
        }
        return conexiones;
    }

    // ---------------------------------------------------------------- permisos

    @PluginMethod
    public void comprobarPermisos(PluginCall llamada) {
        llamada.resolve(informeDePermisos());
    }

    /**
     * Pide lo que falte, y solo lo que falte.
     *
     * Los permisos de Nearby cambian con la version de Android y **pedir el que
     * no toca es peor que no pedirlo**: un permiso que el manifest declara con
     * {@code maxSdkVersion} por debajo de la del aparato se deniega solo, sin
     * enseñar ningun dialogo, y desde fuera parece que el jugador dijo que no.
     */
    @PluginMethod
    public void pedirPermisos(PluginCall llamada) {
        String[] alias = aliasNecesarios();
        if (alias.length == 0 || faltan(alias).isEmpty()) {
            llamada.resolve(informeDePermisos());
            return;
        }
        requestPermissionForAliases(alias, llamada, "alResponderPermisos");
    }

    @PermissionCallback
    private void alResponderPermisos(PluginCall llamada) {
        llamada.resolve(informeDePermisos());
    }

    /**
     * Que alias hay que pedir en este Android.
     *
     * <ul>
     *   <li>33 y posteriores: los tres de Bluetooth y el de los aparatos Wi-Fi
     *       cercanos, que es el que sustituyo a la ubicacion.
     *   <li>31 y 32: los tres de Bluetooth y la ubicacion precisa, porque
     *       NEARBY_WIFI_DEVICES todavia no existe.
     *   <li>Por debajo de 31: solo la ubicacion; los de Bluetooth de entonces
     *       son normales y Android los concede al instalar.
     * </ul>
     */
    private String[] aliasNecesarios() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return new String[] { PERMISO_BLUETOOTH, PERMISO_WIFI_CERCANO };
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return new String[] { PERMISO_BLUETOOTH, PERMISO_UBICACION };
        }
        return new String[] { PERMISO_UBICACION };
    }

    private List<String> faltan(String[] alias) {
        List<String> sinConceder = new ArrayList<>();
        for (String uno : alias) {
            if (getPermissionState(uno) != PermissionState.GRANTED) {
                sinConceder.add(uno);
            }
        }
        return sinConceder;
    }

    /**
     * Como estan los permisos, y de paso si la ubicacion del sistema esta
     * encendida.
     *
     * Lo segundo no es un permiso pero se cuenta entre lo que falta porque
     * impide exactamente lo mismo: por debajo de Android 12, Nearby no
     * descubre nada con la ubicacion apagada, y el jugador ve una lista vacia
     * sin ningun error que lo explique.
     */
    private JSObject informeDePermisos() {
        List<String> sinConceder = faltan(aliasNecesarios());
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S && !ubicacionEncendida()) {
            sinConceder.add("SERVICIO_DE_UBICACION");
        }

        JSObject informe = new JSObject();
        informe.put("concedidos", sinConceder.isEmpty());
        informe.put("faltan", new JSArray(sinConceder));
        return informe;
    }

    private boolean ubicacionEncendida() {
        Context contexto = getContext();
        if (contexto == null) {
            return false;
        }
        LocationManager gestor = (LocationManager) contexto.getSystemService(Context.LOCATION_SERVICE);
        return gestor != null && LocationManagerCompat.isLocationEnabled(gestor);
    }

    // ------------------------------------------------------------------ radio

    /** Anuncia una partida para que la encuentren los de al lado. */
    @PluginMethod
    public void anunciar(PluginCall llamada) {
        AdvertisingOptions opciones = new AdvertisingOptions.Builder().setStrategy(ESTRATEGIA).build();

        conexiones()
            .startAdvertising(nombreDe(llamada), SERVICIO, cicloDeConexion, opciones)
            .addOnSuccessListener(nada -> {
                Log.i(ETIQUETA, "Anunciando la partida.");
                llamada.resolve();
            })
            .addOnFailureListener(fallo -> rechazar(llamada, "No se pudo anunciar la partida", fallo));
    }

    /** Busca partidas anunciandose cerca. */
    @PluginMethod
    public void buscar(PluginCall llamada) {
        DiscoveryOptions opciones = new DiscoveryOptions.Builder().setStrategy(ESTRATEGIA).build();

        conexiones()
            .startDiscovery(SERVICIO, descubrimiento, opciones)
            .addOnSuccessListener(nada -> {
                Log.i(ETIQUETA, "Buscando partidas cerca.");
                llamada.resolve();
            })
            .addOnFailureListener(fallo -> rechazar(llamada, "No se pudo buscar partidas", fallo));
    }

    /** Pide linea con una de las partidas encontradas. */
    @PluginMethod
    public void conectar(PluginCall llamada) {
        String id = llamada.getString("id");
        if (id == null || id.isEmpty()) {
            llamada.reject("Hace falta el id de la partida a la que conectarse.");
            return;
        }

        conexiones()
            .requestConnection(nombreDe(llamada), id, cicloDeConexion)
            .addOnSuccessListener(nada -> llamada.resolve())
            .addOnFailureListener(fallo -> rechazar(llamada, "No se pudo pedir conexion", fallo));
    }

    /** Manda un mensaje a los extremos que se digan. */
    @PluginMethod
    public void enviar(PluginCall llamada) {
        JSArray ids = llamada.getArray("ids");
        String texto = llamada.getString("texto");
        if (ids == null || texto == null) {
            llamada.reject("Hace falta a quien mandarlo y que mandar.");
            return;
        }

        List<String> destinos;
        try {
            destinos = ids.toList();
        } catch (Exception fallo) {
            llamada.reject("La lista de destinos no valia.", fallo);
            return;
        }
        if (destinos.isEmpty()) {
            llamada.resolve();
            return;
        }

        Payload carga = Payload.fromBytes(texto.getBytes(StandardCharsets.UTF_8));
        conexiones()
            .sendPayload(destinos, carga)
            .addOnSuccessListener(nada -> llamada.resolve())
            .addOnFailureListener(fallo -> rechazar(llamada, "No se pudo mandar el mensaje", fallo));
    }

    /**
     * Deja de buscar, sin soltar nada de lo que ya este conectado.
     *
     * Existe aparte de {@link #parar} porque son cosas distintas: en cuanto hay
     * linea con una partida, seguir barriendo la radio solo gasta bateria, pero
     * cortar la conexion seria salirse de la partida.
     */
    @PluginMethod
    public void dejarDeBuscar(PluginCall llamada) {
        if (conexiones != null) {
            conexiones.stopDiscovery();
        }
        llamada.resolve();
    }

    /** Apaga el anuncio, la busqueda y todas las conexiones abiertas. */
    @PluginMethod
    public void parar(PluginCall llamada) {
        apagarlo();
        llamada.resolve();
    }

    /**
     * Cerrar la aplicacion tiene que soltar la radio.
     *
     * Sin esto, el anuncio y las conexiones siguen vivos despues de salir del
     * juego: gasta bateria y deja a los demas viendo una partida que ya no
     * esta.
     */
    @Override
    protected void handleOnDestroy() {
        apagarlo();
        super.handleOnDestroy();
    }

    private void apagarlo() {
        if (conexiones == null) {
            return;
        }
        try {
            conexiones.stopAdvertising();
            conexiones.stopDiscovery();
            conexiones.stopAllEndpoints();
        } catch (Exception fallo) {
            Log.w(ETIQUETA, "Algo no se pudo apagar; se sigue igualmente.", fallo);
        }
        nombres.clear();
    }

    private String nombreDe(PluginCall llamada) {
        String nombre = llamada.getString("nombre", NOMBRE_POR_DEFECTO);
        if (nombre == null || nombre.trim().isEmpty()) {
            return NOMBRE_POR_DEFECTO;
        }
        nombre = nombre.trim();
        return nombre.length() > NOMBRE_MAXIMO ? nombre.substring(0, NOMBRE_MAXIMO) : nombre;
    }

    // -------------------------------------------------------------- callbacks

    private final ConnectionLifecycleCallback cicloDeConexion = new ConnectionLifecycleCallback() {

        /**
         * Se acepta sin pedir confirmacion a nadie.
         *
         * Nearby ofrece un codigo de cuatro cifras para que las dos personas lo
         * comparen, y para un juego es un peaje: quien toca una partida de la
         * lista ya dijo que queria entrar en ella, y lo que se manda por aqui
         * son clics en un tablero.
         */
        @Override
        public void onConnectionInitiated(String id, ConnectionInfo informacion) {
            nombres.put(id, informacion.getEndpointName());
            conexiones().acceptConnection(id, recepcion);
        }

        @Override
        public void onConnectionResult(String id, ConnectionResolution resolucion) {
            if (resolucion.getStatus().isSuccess()) {
                JSObject datos = new JSObject();
                datos.put("id", id);
                String nombre = nombres.get(id);
                datos.put("nombre", nombre == null ? "" : nombre);
                notifyListeners("conectada", datos);
                return;
            }

            nombres.remove(id);
            Log.w(ETIQUETA, "Conexion con " + id + " fallida: " + resolucion.getStatus());
            avisarDeFallo("CONEXION_FALLIDA");
        }

        @Override
        public void onDisconnected(String id) {
            nombres.remove(id);
            JSObject datos = new JSObject();
            datos.put("id", id);
            notifyListeners("desconectada", datos);
        }
    };

    private final EndpointDiscoveryCallback descubrimiento = new EndpointDiscoveryCallback() {

        @Override
        public void onEndpointFound(String id, DiscoveredEndpointInfo informacion) {
            if (!SERVICIO.equals(informacion.getServiceId())) {
                return;
            }
            JSObject datos = new JSObject();
            datos.put("id", id);
            datos.put("nombre", informacion.getEndpointName());
            notifyListeners("encontrada", datos);
        }

        @Override
        public void onEndpointLost(String id) {
            JSObject datos = new JSObject();
            datos.put("id", id);
            notifyListeners("perdida", datos);
        }
    };

    private final PayloadCallback recepcion = new PayloadCallback() {

        @Override
        public void onPayloadReceived(String id, Payload carga) {
            byte[] bytes = carga.asBytes();
            if (bytes == null) {
                // Solo se mandan payloads de bytes; lo que llegue de otra clase
                // no es de este juego.
                return;
            }

            JSObject datos = new JSObject();
            datos.put("id", id);
            datos.put("texto", new String(bytes, StandardCharsets.UTF_8));
            notifyListeners("mensaje", datos);
        }

        @Override
        public void onPayloadTransferUpdate(String id, PayloadTransferUpdate avance) {
            // Los mensajes van en bytes y llegan de una pieza: no hay progreso
            // que contar. Los trozos los junta la web, que es quien sabe de
            // que mensaje son.
        }
    };

    private void avisarDeFallo(String motivo) {
        JSObject datos = new JSObject();
        datos.put("motivo", motivo);
        notifyListeners("fallo", datos);
    }

    private void rechazar(PluginCall llamada, String queNoSePudo, Exception fallo) {
        Log.e(ETIQUETA, queNoSePudo, fallo);
        llamada.reject(queNoSePudo + ": " + fallo.getMessage(), fallo);
    }
}
