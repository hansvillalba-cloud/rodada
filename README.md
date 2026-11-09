# Rodada

App web (PWA) de ciclismo: GPS en tiempo real, sensores Bluetooth, pendiente, ClimbPro y actividades guardadas en el dispositivo.

## Qué hace
- **Tiempo real:** velocidad, distancia, altitud, desnivel acumulado y pendiente (%) calculada sobre ~50 m.
- **Sensores BLE (Web Bluetooth):** pulso cardíaco, velocidad/cadencia (CSC) y potencia. Reconexión automática.
- **ClimbPro:** carga un GPX con elevación; detecta subidas (≥500 m, ≥3 % prom., ≥25 m de desnivel) y muestra distancia y desnivel restantes, pendiente promedio restante y perfil coloreado por pendiente.
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
