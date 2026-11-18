# Rodada

App web (PWA) de ciclismo: GPS en tiempo real, sensores Bluetooth, pendiente, ClimbPro y actividades guardadas en el dispositivo.

## Qué hace
- **Tiempo real:** velocidad, distancia, altitud, desnivel acumulado y pendiente (%) calculada sobre ~50 m.
- **Sensores BLE (Web Bluetooth):** pulso cardíaco, velocidad/cadencia (CSC) y potencia. Reconexión automática.
- **ClimbPro:** carga un GPX con elevación; detecta subidas (≥500 m, ≥3 % prom., ≥25 m de desnivel) y muestra distancia y desnivel restantes, pendiente promedio restante y perfil coloreado por pendiente.
- **Pantallas personalizables (estilo Magene/Garmin):** la pantalla principal tiene varias páginas (desliza o usa ‹ ›). Cada página son filas de 1 a 4 campos que eliges tú: velocidad, promedio, máxima, tiempo, distancia, pendiente, altitud, desnivel, pulso, cadencia, potencia, hora, ruta restante, llegada en, **Mapa** y **ClimbPro**. Menú ☰ → Pantallas → Personalizar: cambia campos, agrega/quita campos y filas, agrega/borra pantallas o restablece.
- **Mapa y navegación:** el campo Mapa gira con tu rumbo (hacia arriba), con flecha de posición, ruta, zoom y botón para seguir. Busca un destino desde ☰ o mantén presionado el mapa; calcula ruta en bicicleta, muestra el banner de giro arriba (flecha, distancia al giro, km y minutos restantes), avisa por voz a 200 m y 50 m, y recalcula si te sales más de 15 s. Las rutas calculadas traen elevación, así que ClimbPro funciona en ellas.
- **Rutas GPX:** los giros se estiman a partir de la geometría del trazado (sin nombres de calles).
- **Actividades:** guardado local (IndexedDB), detalle con perfil, subidas detectadas, promedios y exportación a GPX.
- **Offline:** instalable desde Chrome ("Añadir a pantalla de inicio").

## Versión web (GitHub Pages)
1. Crea un repositorio y sube todo el contenido de esta carpeta.
2. Settings → Pages → Deploy from a branch → `main` / `/docs`.
3. Abre `https://TU_USUARIO.github.io/NOMBRE_REPO/` en Chrome (Android). Bluetooth y GPS exigen HTTPS.

## Limitaciones
- Web Bluetooth funciona en Chrome/Edge (Android y escritorio). iOS Safari no lo soporta (alternativa: navegador Bluefy).
- En la versión web los navegadores pausan el GPS con la pantalla bloqueada; la versión nativa lo resuelve.
- La altitud viene del GPS (no hay barómetro en la web), por eso la pendiente es aproximada.
- Para velocidad por sensor, ajusta la circunferencia de rueda (700x25c ≈ 2105 mm).

## Siguientes pasos
Mapa de la ruta, segmentos, zonas de pulso/potencia, sincronización con Strava (API) y empaquetado nativo con Capacitor.

## Versión nativa Android (APK)
Usa Capacitor: Bluetooth LE nativo (`@capacitor-community/bluetooth-le`) y GPS en segundo plano con notificación (`@capacitor-community/background-geolocation`). El código web es el mismo (`docs/`); `app.js` detecta si corre en modo nativo.

**Con GitHub Actions (sin instalar nada):** sube el repo, ve a Actions → *APK Android* → Run workflow, y descarga `rodada-apk` (app-debug.apk). Instálalo en el celular permitiendo orígenes desconocidos.

**Local:** `npm ci && npm run build:native && npx cap add android && node scripts/patch-android.js && npx cap sync android && npx cap open android`.

**iOS:** requiere Mac + Xcode: `npx cap add ios`, y añadir en Info.plist `NSBluetoothAlwaysUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription` y el modo de fondo *Location updates*.

## Servicios externos de la navegación
Búsqueda: Nominatim; rutas: routing.openstreetmap.de (perfil bicicleta); elevación: Open-Meteo; mapa: tiles de OpenStreetMap. Son servicios públicos gratuitos con límites de uso razonable: para uso intensivo conviene una clave propia (p. ej. OpenRouteService o MapTiler). Requiere internet; no hay mapas offline.

## Novedades
- **Pantalla apagada:** en la versión nativa (APK) el GPS corre como servicio en primer plano. Además, el tiempo se calcula con el reloj (no con temporizadores) y la actividad se guarda sola cada 20 s; si la app se cierra, al abrirla ofrece recuperarla. En el navegador la pantalla se mantiene encendida, porque los navegadores suspenden el GPS al apagarla.
- **Usuarios:** menú ☰ → Usuario. Cada usuario tiene su FC máx, FTP, peso, edad y sexo, y sus propias actividades, pantallas y rutinas.
- **Análisis por actividad:** resumen, energía estimada, potencia normalizada, gráficos (elevación/velocidad y pulso/potencia/cadencia), zonas de pulso y de potencia, parciales por km, subidas, y resumen de 7 y 30 días.
- **Indicaciones dentro del mapa:** el banner de giro va sobre el mapa. En pantallas sin mapa aparece arriba.
- **ClimbPro automático:** sin cargar ruta, detecta que estás subiendo (≥300 m con ≥3 %) y muestra distancia, desnivel y pendiente de la subida en curso, con su perfil. Sin ruta no puede saber cuánto falta; con ruta cargada sí.
- **Deporte y bicicleta:** Ciclismo o Correr (ritmo en min/km) y tipo de bici (ruta, MTB, gravel, urbana, eléctrica), que ajusta la circunferencia de rueda.

- **Alertas visuales y sonoras:** menú ☰ → Alertas. Reglas por métrica (pulso, cadencia, velocidad, potencia, pendiente; mayor o menor que un valor, sostenido 5 s), recordatorios de hidratación y comida cada X minutos, y aviso por kilómetro con tiempo y ritmo. Muestran un cartel en pantalla, suenan, vibran y hablan. Se guardan por usuario.
- **Filtro de GPS:** se descartan saltos imposibles (más de 28 m/s en bici, 9 m/s corriendo) y, si la posición nueva se mantiene 5 lecturas seguidas, se acepta como un tramo nuevo sin sumar distancia. El mapa y el GPX no dibujan líneas rectas entre tramos, y las actividades antiguas se reparan solas al abrir la lista.
- **Energía estimada:** con potencia si hay medidor; si no, con pulso (fórmula de Keytel, usa edad, sexo y peso); si no, por velocidad (METs) o distancia al correr. El análisis indica la fuente.
- Los módulos de fuerza en casa y de postura con cámara se quitaron a pedido.
