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
5. **Tipografía compartida.** `src/ui/typography.css` es la única fuente de
   familia de fuente, escala de tamaño, escala de encabezados, interlineado,
   espaciado de párrafo y sangría de listas, consumida por el visor y, desde
   la fase 2, por el editor. Ninguno de los dos modos redefine estas reglas;
   lo específico de cada modo (caret, selección, toolbar en el editor; HTML
   crudo en el visor) vive en hojas de estilo locales como
   `src/reader/reader.css`. Desde la fase 3, los bloques que ambos modos
   renderizan (tareas, citas, código, reglas) también se estilan en
   `typography.css`, y desde la fase 5 también las tablas y las imágenes.

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

## IA e indexado: estado implementado

- Los comandos sobre selección generan Markdown y lo vuelven a introducir por el
  parser y el mapping del core. La propuesta se revisa antes de aplicar una única
  transacción de ProseMirror.
- No hay proveedor activo por defecto. La preferencia de proveedor y modelo es
  única por dispositivo, por lo que los comandos sobre una selección funcionan
  también con un documento suelto. RAG continúa ligado a un workspace. La
  configuración remota requiere
  consentimiento explícito; las credenciales viven en el almacén del sistema
  operativo. Las preferencias de proveedor no contienen secretos.
- El proveedor local de generación se conecta a un servidor llama.cpp en una
  dirección IP loopback literal. El runtime/modelo generativo lo instala y ejecuta
  el usuario; Markflow no lo empaqueta.
- El proveedor OpenCode V2 es un puente Beta y opcional. Descubre el catálogo a
  través del CLI oficial y genera en un workspace temporal vacío mediante un
  agente `markflow` que deniega todas las herramientas y permisos. El prompt se
  entrega por `stdin`, nunca como argumento del proceso; la sesión temporal se
  elimina después de obtener el texto. OpenCode conserva en exclusiva sus cuentas
  OAuth/API: Markflow no lee su base de credenciales, cookies ni tokens. El puente
  expone al webview solo estado/modelos, prueba sintética, generación y cancelación.
- FastEmbed calcula embeddings localmente. El modelo all-MiniLM-L6-v2 (~91 MB) se
  descarga explícitamente; SQLite y los metadatos del índice viven en el directorio
  de datos de la aplicación, no en el workspace. Un worker Rust de baja prioridad
  procesa la cola incremental del watcher.
- Las respuestas de RAG citan archivo y ruta de headings; las citas abren el
  documento y reportan secciones obsoletas. El estado conversacional es periférico
  y no se serializa en Markdown.
- La migración desde configuraciones antiguas copia credenciales entre identidades
  del almacén del sistema exclusivamente en Rust. El destino está fijado al scope
  del dispositivo; la UI no recibe ni persiste el secreto.

## Apertura desde el sistema operativo

El instalador de Windows registra `.md`. La ruta recibida al arrancar o desde una
segunda invocación se canonicaliza y valida como fichero `.md` existente; el
backend añade **solo ese fichero** al scope del plugin `fs` antes de entregarla al
frontend. Los eventos se encolan hasta que el listener está listo y la instancia
existente recupera el foco. El acceso posterior a imágenes hermanas se amplía por
separado mediante `allow_document_directory`; no existe un comando que permita al
frontend autorizar una ruta inicial arbitraria. `UserChoice` se consulta solo para
informar y nunca se reescribe.

## Arranque

El backend y el webview publican marcadores monotónicos locales: backend listo,
render React, primer paint, autorización del fichero, parseo y documento visible.
Solo se escriben a un JSONL si el proceso de validación define
`MARKFLOW_STARTUP_METRICS_FILE`; no se transmiten. La restauración de IA ocurre
después del primer render y Tiptap no se monta para documentos que solo se leen;
una vez que un documento entra en edición, su editor permanece montado para
conservar caret e historial.

## Presentación y edición

Dark es el tema inicial; Light y Sepia se guardan como preferencia local. La barra
superior concentra apertura, modos, IA y apariencia con iconos accesibles. La
navegación del documento vive a la izquierda y se colapsa desde su borde. La barra
del editor expone el esquema Markdown (incluidos H1–H6, listas, código y tablas),
manteniendo ProseMirror como única fuente del documento. Los avisos usan
`> [!WARNING]`, no HTML de color, y conservan esa sintaxis al serializar.

El evaluador local actual y sus mediciones están registrados en
`openspec/changes/archive/2026-09-24-ai-assistance/evaluation.md`.

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

## Registro de mapeo: resultado de la fase 3

La fase 3 (`inline-block-formatting`) era la primera prueba real del registro
de pares de manejadores. Se añadieron cinco marcas (`strong`, `emphasis`,
`strikethrough`, `inlineCode`, `link`) y cinco tipos de bloque (`list`,
`listItem`, `blockquote`, `codeBlock`, `thematicBreak`).

**El registro aguantó sin tocar el núcleo.** Bajo `src/core/mapping/` solo
cambiaron el punto de composición (`index.ts`) y módulos de `handlers/`; ni
`registry.ts`, ni `types.ts`, ni los recorredores `mdastToPm.ts`/`pmToMdast.ts`
se modificaron. Aun así, la prueba reveló dos límites del diseño que conviene
dejar escritos:

1. **El registro es uno a uno entre tipos mdast y tipos ProseMirror.** mdast
   tiene un único `list` con `ordered`; dos tipos ProseMirror (`bulletList`,
   `orderedList`) no podrían mapear de vuelta al mismo tipo mdast sin cambiar el
   registro. Se resolvió modelando un solo nodo `list` con atributo `ordered`,
   igual que mdast (decisión D9 del cambio). Si una fase futura necesita de
   verdad una relación varios-a-uno, habrá que ampliar el registro.
2. **Las marcas no son nodos en ProseMirror.** La dirección mdast → ProseMirror
   funciona por nodo sin cambios: el manejador de `strong` convierte sus hijos y
   les añade la marca. La inversa no puede ser por nodo, porque el anidamiento
   hay que reconstruirlo a partir de la secuencia de hermanos. Se resolvió dentro
   de `handlers/`: los manejadores de bloques de texto (`paragraph`, `heading`)
   pasaron a ser fábricas que reciben una búsqueda en el registro, y convierten
   su contenido en línea con `handlers/phrasing.ts`, que llama al manejador
   registrado de cada marca. El punto de composición inyecta esa búsqueda.

Las marcas que cubren exactamente el mismo tramo no tienen orden de anidamiento
propio en ProseMirror; se anidan según el rango del esquema (link, emphasis,
strong, strikethrough, inlineCode), elegido para coincidir con lo que remark
produce en `***x***` y `[**x**](url)`. En consecuencia `**[x](url)**` vuelve
como `[**x**](url)`: se renderiza igual, pero el árbol es distinto. Es la única
pérdida estructural conocida del mapeo y no aparece en el corpus.

## Criterio de migración a Rust

El core de Markdown vive en TypeScript. Se migra a Rust **solo si se mide** que
el parseo o la serialización de un documento típico supera los 16 ms (un frame a
60 fps), o si el indexado del workspace bloquea el hilo de UI. Medir antes de mover.
La primera línea base y sus limitaciones están en
[`docs/performance-baseline.md`](performance-baseline.md).
