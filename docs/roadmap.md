# Markflow — Hoja de ruta

Traduce las fases de [`Context/EXPLORE.md`](../Context/EXPLORE.md) a *changes* de
OpenSpec. Cada *change* se implementa con `/opsx:apply` y se archiva al terminar.

| Fase (EXPLORE.md) | Change de OpenSpec | Estado | Depende de |
|---|---|---|---|
| 0 — Esqueleto | — | Hecho (fuera de OpenSpec) | — |
| 1 — El core | `markdown-core-roundtrip` | Planificado | — |
| 1.5 — Visor | `markdown-reader` | Planificado | fase 1 |
| 2 — Editor básico | `document-editor-base` | Planificado | fases 1, 1.5 |
| 3 — Formato inline y bloques | `inline-block-formatting` | Planificado | fase 2 |
| 4 — Explorador | `workspace-explorer` | Planificado | fases 1.5, 2 |
| 5 — Tablas e imágenes | `tables-and-images` | Planificado | fases 3, 4 |
| 6 — Slash commands | `slash-commands` | Planificado | fases 3, 5 |
| 7 — IA | `ai-assistance` | Planificado | fases 4, 5, 6 |

## Fase 0 — qué quedó hecho

Fuera de OpenSpec, por ser andamiaje y no comportamiento especificable:

- Proyecto Tauri 2 + React 19 + TypeScript + Vite 7, renombrado a Markflow.
- Dependencias del stack de `EXPLORE.md` sección 3 instaladas.
- Estructura de carpetas de `EXPLORE.md` sección 5.
- Tailwind v4, alias `@/`, Vitest, Playwright, ESLint.
- Plugins de Tauri `fs` (con `watch`), `dialog` y `opener` registrados.
- CI en GitHub Actions: lint, typecheck y tests en Node; `fmt` y `clippy` en Rust.
- `docs/architecture.md` con las invariantes del proyecto.

## Cadena de dependencias

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

## Puntos de decisión pendientes

Cada `design.md` termina con sus propias preguntas abiertas. Las que afectan a más
de una fase:

- **Migración del core a Rust.** No se decide por gusto: solo si se mide que el
  parseo o la serialización de un documento típico supera los 16 ms, o si el
  indexado bloquea la UI. Criterio en `docs/architecture.md`.
- **Forma normal del serializador.** Fijada en `markdown-core-roundtrip` y
  vinculante para todas las fases posteriores. Cambiarla invalida el corpus de
  fixtures.
- **Contrato del registro de comandos.** Definido en `slash-commands` y consumido
  por `ai-assistance`. Por eso el menú se construye antes que la IA.
