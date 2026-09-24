# Markflow — Hoja de ruta

Traduce las fases de [`Context/EXPLORE.md`](../Context/EXPLORE.md) a *changes* de
OpenSpec. Cada *change* se implementa con `/opsx:apply` y se archiva al terminar.

| Fase (EXPLORE.md) | Change de OpenSpec | Estado | Depende de |
|---|---|---|---|
| 0 — Esqueleto | — | Hecho | — |
| 1 — El core | `markdown-core-roundtrip` | Hecho | — |
| 1.5 — Visor | `markdown-reader` | Hecho | fase 1 |
| 2 — Editor básico | `document-editor-base` | Hecho | fases 1, 1.5 |
| 3 — Formato inline y bloques | `inline-block-formatting` | Hecho | fase 2 |
| 4 — Explorador | `workspace-explorer` | Hecho | fases 1.5, 2 |
| 5 — Tablas e imágenes | `tables-and-images` | Hecho | fases 3, 4 |
| 6 — Slash commands | `slash-commands` | Hecho | fases 3, 5 |
| 7 — IA | `ai-assistance` | Hecho | fases 4, 5, 6 |
| Validación MVP y usabilidad | `usability-themes-and-mvp-validation` | En verificación final | fases 1–7 |

Los ocho changes de las fases 1–7 están archivados en `openspec/changes/archive/`;
las capacidades de IA también están sincronizadas en `openspec/specs/`. Las
comprobaciones automatizadas actuales (lint, typecheck, build, tests y Clippy)
están verdes. Esto completa el alcance de las fases, pero quedan verificaciones
de producto en una instalación empaquetada y una excepción de MVP anotada abajo.

## Verificación de alcance del MVP

- **Asociación de `.md` con la aplicación:** el instalador NSIS registra la
  asociación y la ruta de arranque obtiene acceso al scope `fs`. Windows conserva
  la elección `UserChoice` existente; el usuario debe elegir Markflow como app
  predeterminada o usar “Abrir con” para que Explorer la aplique.
- **Apertura y lectura rápidas:** la línea base reproducible está en
  [`performance-baseline.md`](performance-baseline.md). El workspace se entrega en
  lotes, pero el fixture extremo bloquea ~63 ms y el documento de 829 KB tarda
  ~3,48 s en renderizar; virtualización/progresividad queda como optimización
  medida posterior al MVP.
- **Usabilidad del editor:** tema Dark/Light/Sepia, navegación lateral, modos
  visibles, barra Markdown completa, ayuda de atajos y callouts portables están
  expuestos sin depender de conocer `Ctrl+E` o el menú `/`.
- **Instalación de embeddings:** el modelo local de ~91 MB se descarga desde los
  ajustes de IA cuando el usuario lo solicita; no está incluido en el instalador.
- **MCP, nube, colaboración, exportación y multi-ventana:** siguen fuera del MVP,
  como especifica `Context/EXPLORE.md`.

`Context/EXPLORE.md` conserva sus casillas sin marcar porque es el documento de
exploración original, no el registro del estado de implementación. Esta hoja de
ruta y los changes archivados reflejan el estado actual.

## Fase 0 — qué quedó hecho

Fuera de OpenSpec, por ser andamiaje y no comportamiento especificable:

- Proyecto Tauri 2 + React 19 + TypeScript + Vite 7, renombrado a Markflow.
- Dependencias del stack de `EXPLORE.md` sección 3 instaladas.
- Estructura de carpetas de `EXPLORE.md` sección 5.
- Tailwind v4, alias `@/`, Vitest, Playwright, ESLint.
- Plugins de Tauri `fs` (con `watch`), `dialog` y `opener` registrados.
- CI en GitHub Actions: lint, typecheck y tests en Node; `fmt` y `clippy` en Rust.
- `docs/architecture.md` con las invariantes del proyecto.

## Cadena de dependencias (completada)

```
markdown-core-roundtrip          ← la que decide si el proyecto se sostiene
        │
        ├─► markdown-reader      ← primer entregable útil
        │        │
        │        ▼
        └─► document-editor-base
                 │
                 ▼
            inline-block-formatting ──┐
                 │                    │
                 ▼                    │
            workspace-explorer ───────┤
                                      ▼
                              tables-and-images
                                      │
                                      ▼
                                slash-commands
                                      │
                                      ▼
                                 ai-assistance
```

`markdown-reader` y `workspace-explorer` no bloquean la cadena principal: el visor
puede ir en paralelo al editor una vez cerrado el core, y el explorador puede ir en
paralelo a `inline-block-formatting`.

## Decisiones y trabajo posterior al MVP

Las decisiones de implementación de las fases están resueltas en sus `design.md`.
El trabajo posterior al MVP incluye:

- **Migración del core a Rust.** No se decide por gusto: solo si se mide que el
  parseo o la serialización de un documento típico supera los 16 ms, o si el
  indexado bloquea la UI. Criterio en `docs/architecture.md`.
- **Forma normal del serializador.** Fijada en `markdown-core-roundtrip` y
  vinculante para todas las fases posteriores. Cambiarla invalida el corpus de
  fixtures.
- **MCP.** Exponer el workspace como servidor MCP sigue siendo candidato posterior
  al MVP; no forma parte de `ai-assistance`.
