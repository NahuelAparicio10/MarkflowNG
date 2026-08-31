# Markflow — Arquitectura

Documento vivo. La fuente de la decisión original es [`Context/EXPLORE.md`](../Context/EXPLORE.md);
este fichero registra el estado real de la implementación.

## Pipeline

```
fichero .md ──remark parse──> mdast ──mapping──> ProseMirror doc
fichero .md <──remark stringify── mdast <──mapping── ProseMirror doc
```

`mdast` es el AST canónico. Toda transformación pasa por él: lectura, edición,
vista previa del explorador y la capa de IA.

## Reglas invariantes

1. **El estado del documento vive en ProseMirror.** Nunca se duplica en React ni
   en Zustand. Zustand solo guarda estado periférico (workspace, pestañas, tema,
   ajustes, panel de IA).
2. **`src/core/` no importa React ni nada de UI.** Es testeable en aislamiento y
   convierte una futura migración a Rust en una operación acotada.
3. **Round-trip cerrado.** Abrir un fichero, no tocar nada y guardar produce un
   diff vacío en git. Cada nodo nuevo del esquema amplía el mapeo y sus tests.
4. **Un solo camino de renderizado.** El visor y la vista previa del explorador
   reutilizan el mismo parser del core.

## Capas

| Carpeta | Responsabilidad | Depende de |
|---|---|---|
| `src/core/markdown` | Configuración de `unified`/`remark`, parse y stringify | — |
| `src/core/schema` | Esquema de ProseMirror | `@tiptap/pm` |
| `src/core/mapping` | `mdast ↔ ProseMirror`, en ambas direcciones | schema, markdown |
| `src/reader` | Renderizador de mdast a React (modo lectura) | core |
| `src/editor` | Tiptap: extensiones, input rules, slash commands | core |
| `src/explorer` | Árbol, quick open, vista previa, watcher | core, Tauri |
| `src/ai` | Comandos sobre selección, RAG | core |
| `src/ui` | Toolbar, menús, diálogos, layout | store |
| `src/store` | Zustand | — |
| `src-tauri/src` | fs, watcher, indexado, comandos | — |

## Forma normal del serializador

Fijada en `src/core/markdown/options.ts` y vinculante para todo el proyecto:
viñetas `-`, énfasis `*`, negrita `**`, vallas de código con acentos graves,
regla horizontal `-`, sangría de lista `one`, marcador de lista incremental.
Ningún punto de llamada puede pasar sus propias opciones; `serializeMarkdown`
no acepta parámetro de opciones. Cambiar cualquiera de estos valores invalida el
corpus de *fixtures*.

**Salto de línea final** (pregunta abierta resuelta en `markdown-core-roundtrip`):
se mantiene el comportamiento por defecto de remark, verificado contra el corpus:
un documento no vacío termina en exactamente un `\n`; un documento vacío
serializa a cadena vacía. Coincide con la convención POSIX y produce *diffs* de
git limpios, así que no se añade normalización propia.

## Nodos de preservación

Todo nodo mdast sin manejador registrado viaja en un nodo opaco de ProseMirror
que transporta el subárbol original. Abrir y guardar nunca destruye contenido.

Hay **dos** tipos, `preserved` y `preservedInline`, no uno. La distinción
bloque/línea de ProseMirror es una propiedad del tipo de nodo —un nodo no puede
ser ambas cosas—, así que una tabla no soportada y un fragmento de énfasis no
soportado no pueden compartir tipo. Se comportan igual en todo lo demás y ambos
devuelven su subárbol literal al convertir de vuelta a mdast.

## Criterio de migración a Rust

El core de Markdown vive en TypeScript. Se migra a Rust **solo si se mide** que
el parseo o la serialización de un documento típico supera los 16 ms (un frame a
60 fps), o si el indexado del workspace bloquea el hilo de UI. Medir antes de mover.
