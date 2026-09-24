# Baseline de rendimiento del MVP

Medición realizada el 24 de septiembre de 2026 en Windows 10 Home 19045, Intel
Core i7-6700 (4 núcleos/8 procesadores lógicos) y 15,9 GiB de RAM.

## Cargas reproducibles

`npm run perf:generate` crea, por defecto, en el directorio temporal del sistema:

- un documento de 10.000 secciones repetibles (829.414 bytes de Markdown y
  10.500 bloques renderizados en esta ejecución);
- un workspace de 5.000 ficheros Markdown más 100 directorios.

Los tamaños se pueden cambiar con `MARKFLOW_PERF_BLOCKS` y
`MARKFLOW_PERF_FILES`. La prueba de navegador es opt-in:

```powershell
$env:MARKFLOW_RUN_PERF='1'
npm run test:e2e -- tests/e2e/performance.spec.ts
```

La medición Rust del escaneo usa el workspace generado:

```powershell
$env:MARKFLOW_PERF_WORKSPACE="$env:TEMP\markflow-perf-workloads\workspace"
cargo test measure_large_workspace_scan --manifest-path src-tauri/Cargo.toml -- --ignored --nocapture
```

## Resultados

| Operación | Resultado observado |
|---|---:|
| Documento, carga hasta render (navegador, 10.500 bloques) | 3.476 ms |
| Workspace en memoria, construcción de scan/árbol (5.000 ficheros) | 63,4 ms |
| Retraso máximo del event loop durante esa operación | 63,4 ms |
| Escaneo Rust de disco en debug (5.100 entradas, 11 lotes) | 488 ms |

### Arranque empaquetado

Medición añadida el 25 de septiembre de 2026 con el ejecutable release. Cada fase
se registra localmente solo cuando `MARKFLOW_STARTUP_METRICS_FILE` está definido;
no existe telemetría de red. El tiempo aproximado desde proceso hasta contenido se
obtiene sumando `backend-ready` y el marcador relativo del webview.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/perf/measure-startup.ps1
```

El script rechaza la medición si Markflow ya está abierto, ejecuta tres muestras
vacías y tres con fichero, termina únicamente los procesos que creó y comprueba el
SHA-256 del documento al finalizar.

| Operación | Resultado observado |
|---|---:|
| Primera apertura vacía tras build (proceso → primer paint) | ~1.710 ms |
| Apertura vacía caliente, 2 repeticiones | ~638–654 ms |
| `.md` asociado caliente, proceso → documento visible, 5 repeticiones | ~652–754 ms |

El fixture asociado contenía espacios y `ñ`; las tres ejecuciones llegaron a
`startup-document-visible` y conservaron el SHA-256 byte por byte. Una segunda
invocación con Markflow ya abierto terminó en menos de 5 s, mantuvo el primer
proceso y produjo los marcadores de parseo y documento visible en esa instancia.
La selección literal por doble clic continúa dependiendo de que Windows cambie
su `UserChoice` a Markflow.

La barra, Quick Open y la navegación vuelven a responder después del lote, pero
63,4 ms supera claramente un frame de 16 ms. El documento grande también tiene
una espera visible. No se justifica aún mover el core a Rust: esta prueba mide el
pipeline y el render completo, no separa parseo/serialización de creación del DOM.

## Umbrales de seguimiento

- Medir parseo y serialización aisladamente; mantener cada operación por debajo
  de 16 ms para documentos habituales antes de considerar una migración a Rust.
- Reducir el bloqueo del hilo principal durante incorporación del árbol por
  debajo de 50 ms y, preferiblemente, repartirlo en lotes menores de 16 ms.
- Llevar el render caliente del fixture grande por debajo de 1 segundo mediante
  virtualización/progresividad antes de describirlo como apertura rápida.
- Mantener el arranque caliente vacío y con fichero por debajo de 1.000 ms en la
  máquina de referencia; investigar cualquier mediana que lo supere.

## Limitaciones

Playwright usa el fixture web y datos deterministas en memoria; no incluye el
arranque de WebView2, antivirus, latencia de disco ni el diálogo nativo. La prueba
Rust se ejecutó en perfil debug. Los números son una línea base de esta máquina,
 no garantías universales. El primer arranque está afectado por caché de disco,
 WebView2 y antivirus; las repeticiones calientes no equivalen a limpiar la caché
 del sistema. Se deben conservar los mismos parámetros al comparar optimizaciones.
