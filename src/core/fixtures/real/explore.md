# Inkforge — Documento de exploración

> Nombre provisional. Sustituir en todo el documento si se decide otro.

**Estado:** exploración / pre-implementación
**Autor:** Nahuel
**Última actualización:** 2026-08-31

---

## 1. Qué es esto

Un editor de documentos de escritorio con experiencia de escritura tipo Word/Notion,
que guarda el resultado como Markdown plano.

La distinción es importante y define todo el resto del documento:

- **No** es un editor de Markdown con vista previa al lado (split view).
- **Sí** es un visor de Markdown: abrir un `.md` y leerlo formateado, rápido,
  sin entrar en modo edición, es una función de primera clase.
- **Sí** es un editor de documentos donde `.md` es el formato de persistencia,
  no la experiencia de edición.

Son dos modos del mismo producto, no dos productos:

```
        abrir un .md
             │
      ┌──────┴──────┐
      ▼             ▼
  Modo lectura ⇄ Modo edición
      │             │
      └──── mismo ──┘
          documento
```

Se alterna entre ambos con un atajo. El modo lectura es el que se abre por
defecto al hacer clic en un fichero desde el explorador o al abrir un `.md`
desde el sistema operativo.

Mientras escribes nunca ves sintaxis Markdown. Ves el documento formateado.
Al guardar, el fichero en disco es Markdown limpio, legible y versionable en git.

### El pitch en una frase

> Write documents visually — headings, tables, images — and get clean,
> git-friendly Markdown files.

### Por qué existe

Los editores actuales obligan a elegir:

| Enfoque | Ejemplo | Problema |
|---|---|---|
| Markdown crudo | VS Code, Vim | Ves sintaxis, no documento |
| Split view | Typora (parcial), MarkText | Duplica la atención en dos paneles |
| WYSIWYG con formato propietario | Notion, Obsidian (parcial) | El fichero deja de ser Markdown limpio |

El hueco: experiencia de edición completa **y** ficheros Markdown que puedas
meter en un repo sin avergonzarte del diff.

### Caso de uso propio

Documentación de videojuegos: GDDs, specs de sistemas, tablas de balanceo,
notas de diseño. Todo eso vive en repos junto al código. Un editor que produzca
Markdown limpio y que además entienda el contenido (capa de IA, sección 6)
resuelve un problema real que tengo cada semana.

---

## 2. Alcance del MVP

El MVP es **completo**, no mínimo. Se considera terminado cuando funciona todo esto:

### Edición
- [ ] Párrafos y headings (H1–H6)
- [ ] Negrita, cursiva, tachado, código inline
- [ ] Listas con viñetas, numeradas y de tareas (`- [ ]`)
- [ ] Enlaces
- [ ] Citas (blockquote)
- [ ] Bloques de código con lenguaje
- [ ] Separadores horizontales
- [ ] Tablas: insertar, añadir/eliminar filas y columnas, redimensionar, seleccionar celdas
- [ ] Imágenes: insertar, arrastrar y soltar, redimensionar
- [ ] Undo / redo
- [ ] Atajos de teclado (`Ctrl+B`, `Ctrl+I`, etc.)
- [ ] Input rules: escribir `# ` + espacio convierte en heading, `**texto**` en negrita, etc.
- [ ] Slash commands (`/`) con menú de inserción de bloques

### Lectura / visor
- [ ] Modo lectura: documento formateado, sin caret ni toolbar de edición
- [ ] Alternar lectura ⇄ edición con atajo
- [ ] Vista de Markdown crudo como tercer modo (para inspeccionar el fichero real)
- [ ] Índice del documento (outline) navegable a partir de los headings
- [ ] Asociación de ficheros: doble clic en un `.md` del sistema lo abre en modo lectura
- [ ] Apertura rápida: de clic a documento renderizado sin esperas perceptibles
- [ ] Pestañas para varios documentos abiertos

### Ficheros
- [ ] Abrir `.md`
- [ ] Guardar `.md`
- [ ] Guardado automático
- [ ] Round-trip verificado (ver sección 5)

### Explorador de archivos
- [ ] Árbol de directorios sobre una carpeta-workspace
- [ ] Quick open con búsqueda difusa (`Ctrl+P`)
- [ ] Vista previa rápida de `.md` sin abrir el editor completo
- [ ] Detección de cambios externos en disco

### IA
- [ ] Ver sección 6

### Explícitamente fuera del MVP
- Edición colaborativa en tiempo real
- Sincronización en la nube
- Plugins de terceros
- Exportar a PDF/DOCX/HTML
- Móvil o web
- Multi-ventana

---

## 3. Stack

```
Tauri (shell Rust)
  │
  └─ React + TypeScript + Vite
       ├─ Tiptap / ProseMirror        → motor de edición
       ├─ unified / remark (mdast)    → parser + serializador
       ├─ Zustand                     → estado de aplicación
       ├─ Tailwind                    → estilos
       ├─ Vitest + Playwright         → tests
       └─ capa IA                     → sección 6
```

### Decisiones y por qué

**Tauri en lugar de Electron.**
Binario de unos pocos MB frente a más de 100, y consumo de memoria notablemente
menor. Contrapartida: el webview es el del sistema operativo (WebView2 en Windows,
WebKitGTK en Linux), no Chromium, así que hay diferencias de renderizado entre
plataformas. Como el desarrollo es en Windows y el objetivo inicial es Windows,
es asumible. Además el backend en Rust da un sitio natural donde poner trabajo
pesado más adelante.

**Tiptap / ProseMirror en lugar de construir el editor desde cero.**
ProseMirror resuelve el problema difícil: modelo de documento con esquema
validado, transacciones, mapeo de posiciones al aplicar cambios, decoraciones,
gestión del caret y la selección. Implementar eso a mano son años de trabajo.
Tiptap es una capa de conveniencia encima con integración de React.

**Descartado: C# + Avalonia.**
Avalonia no tiene componente de texto enriquecido; su `TextBox` es texto plano.
Habría que implementar a mano layout de texto, caret, selección multi-nodo, IME,
tablas redimensionables y undo transaccional. El argumento de "ya sé C# por Unity"
no compensa la escala del problema.

**Descartado: split view / editor Markdown crudo.**
Contradice el objetivo del producto.

---

## 4. Dónde va el core de Markdown: TypeScript

**Decisión: todo en TypeScript con `unified`/`remark`. Rust queda como refactor
opcional posterior, no como punto de partida.**

Justificación:

1. **El puente cruza en cada operación.** El mapeo entre el AST de Markdown y el
   documento de ProseMirror no se ejecuta solo al abrir y guardar. Se toca en
   pegar contenido, en input rules, en la vista de código, en la previsualización
   del explorador. Si el core vive en Rust, cada una de esas operaciones cruza el
   puente IPC de Tauri con serialización JSON en ambos sentidos. La latencia por
   llamada es baja pero no cero, y se nota en operaciones ligadas a la escritura.

2. **ProseMirror ya vive en TypeScript.** El destino del parseo es una estructura
   de datos de ProseMirror. Parsear en Rust obliga a definir el AST dos veces
   (una en cada lenguaje) y a mantener ambas definiciones sincronizadas. Eso es
   coste permanente a cambio de nada.

3. **El ecosistema está en `unified`.** `remark-gfm` da tablas, tachado y listas
   de tareas. `remark-frontmatter` da YAML. Escribir plugins propios de `mdast`
   está documentado y probado. En Rust el equivalente es más pobre.

4. **Rust como refactor cuenta mejor que Rust como decisión inicial.** Un README
   que dice "el core empezó en TypeScript; al llegar a X documentos el parseo del
   índice bloqueaba el hilo de UI, así que lo moví a Rust y aquí están las
   mediciones antes/después" demuestra criterio de ingeniería. Elegir Rust el día 1
   sin medir nada es una preferencia estética.

**Dónde sí tiene sentido Rust desde el principio:** operaciones de sistema de
ficheros que no tocan el documento activo. El escaneo de la carpeta-workspace, el
watcher, el indexado en segundo plano para la búsqueda y los embeddings. Eso ya va
en Rust por definición porque es donde vive Tauri, y no cruza el puente en caliente.

**Criterio explícito para migrar el core a Rust más adelante:**
si el parseo o la serialización de un documento típico supera los 16 ms
(un frame a 60 fps) o si el indexado del workspace bloquea la UI.
Medir antes de mover.

---

## 5. Arquitectura

```
                    fichero .md en disco
                            │
                            ▼
              ┌─────────────────────────┐
              │  remark (parse)         │
              └───────────┬─────────────┘
                          ▼
                       mdast  ◄── AST canónico
                          │
              ┌───────────┴─────────────┐
              │  mdast → PM  (mapeo)    │
              └───────────┬─────────────┘
                          ▼
              ProseMirror Document (estado vivo)
                          │
              ┌───────────┴─────────────┐
              │  PM → mdast  (mapeo)    │
              └───────────┬─────────────┘
                          ▼
                       mdast
                          │
              ┌───────────┴─────────────┐
              │  remark (stringify)     │
              └───────────┬─────────────┘
                          ▼
                    fichero .md en disco
```

### La regla que no se rompe

**El estado del documento vive en ProseMirror, no en React ni en Zustand.**

Duplicar el documento en estado de React es el error clásico: rompe el undo,
desincroniza el caret y destruye el rendimiento en documentos largos. React
renderiza la UI alrededor del editor; el editor gestiona su propio estado.

Zustand se usa solo para lo periférico: workspace abierto, pestañas, tema,
ajustes, estado del panel de IA.

### Round-trip: el requisito no negociable

El mapeo `mdast ↔ ProseMirror` en ambas direcciones es la pieza central del
proyecto. Debe estar cerrada **desde el primer día**, aunque solo soporte
párrafos y headings.

Motivo: si la serialización se deja para el final, se descubre tarde que el
esquema de ProseMirror no puede representar construcciones que sí estaban en el
Markdown original, y hay que rehacer el esquema entero. Es el fallo más común en
este tipo de proyectos.

Invariantes a verificar con tests:

```
serialize(parse(md))           == md        (para Markdown normalizado)
parse(serialize(doc))          == doc       (round-trip de documento)
```

Abrir un fichero, no tocar nada y guardar debe producir un diff vacío en git.

### Estructura de carpetas

```
inkforge/
├── src/
│   ├── core/              ← sin dependencias de React ni de UI
│   │   ├── markdown/      ← parse, stringify, configuración de remark
│   │   ├── schema/        ← esquema de ProseMirror
│   │   ├── mapping/       ← mdast ↔ PM, en ambas direcciones
│   │   └── __tests__/     ← round-trip, fixtures, property tests
│   ├── editor/            ← Tiptap: extensiones, input rules, slash commands
│   ├── explorer/          ← árbol, quick open, preview
│   ├── ai/                ← sección 6
│   ├── ui/                ← toolbar, menús, diálogos, layout
│   └── store/             ← Zustand
├── src-tauri/
│   └── src/               ← fs, watcher, indexado, comandos
├── docs/
│   └── architecture.md
├── tests/e2e/
└── README.md
```

`src/core/` no importa nada de React. Eso lo hace testeable en aislamiento y
convierte una futura migración a Rust en una operación acotada.

---

## 6. Capa de IA

Entra **desde el inicio**, no como fase posterior. Es la parte diferenciadora del
proyecto y la que conecta con los objetivos de portfolio: RAG, function calling,
MCP, prompt engineering.

### Principio de diseño

La IA opera sobre el **AST**, no sobre texto plano. Esa es la diferencia entre
"otro wrapper de un chat" y una integración real. Cuando el modelo reestructura
una sección, devuelve nodos que se aplican como una transacción de ProseMirror
—con su undo, su mapeo de posiciones y su validación de esquema— en lugar de
sustituir una cadena de texto y esperar que cuadre.

### Funcionalidades del MVP

**1. Comandos sobre selección.** Seleccionas contenido y pides una operación:
reescribir, resumir, expandir, convertir en tabla, convertir en lista.
La respuesta se aplica como transacción, con diff visible y opción de rechazar.

**2. RAG sobre el workspace.** La carpeta abierta se indexa en segundo plano
(troceado por secciones del AST, no por caracteres —los límites de heading son
fronteras semánticas naturales y esto es una ventaja de tener el AST). Los
embeddings se guardan en SQLite local. Permite preguntar sobre el conjunto de
documentos y que las respuestas citen ficheros y secciones concretas.

**3. Slash commands con IA.** El menú `/` incluye acciones generativas junto a
las de inserción de bloques.

### Decisiones abiertas

- **Proveedor:** API remota (Anthropic/OpenAI) frente a modelo local vía Ollama.
  Local encaja mejor con "editor de escritorio que no manda tus documentos a
  ningún sitio", que además es un buen argumento de producto. Remoto da mejor
  calidad. Probablemente ambos, con la elección en ajustes.
- **Embeddings:** locales en cualquier caso, para que el indexado del workspace
  no dependa de red ni tenga coste por documento.
- **MCP:** exponer el workspace como servidor MCP es un candidato natural para
  después del MVP. Permitiría que agentes externos lean y escriban documentos a
  través del mismo modelo de documento.

---

## 7. Explorador de archivos

Inspirado en el acceso rápido a ficheros de Warp.

| Pieza | Implementación |
|---|---|
| Árbol de directorios | Virtualizado con `@tanstack/react-virtual` — debe aguantar miles de ficheros |
| Watcher | Plugin de watch del sistema de ficheros de Tauri, eventos nativos, sin polling |
| Quick open (`Ctrl+P`) | Búsqueda difusa con el port de `fzf` a JS, o `uFuzzy` |
| Vista previa | Parsea a mdast y renderiza en modo lectura, sin montar el editor |
| Cambios externos | El watcher detecta modificaciones y avisa o recarga |

La vista previa reutiliza el parser del core. No hay un segundo camino de
renderizado.

### Por qué el modo lectura es más barato de lo que parece

Renderizar mdast a React es una función pura de unas pocas decenas de líneas por
tipo de nodo. No necesita ProseMirror, ni caret, ni transacciones, ni undo. Eso
tiene dos consecuencias buenas:

- **Es rápido.** Abrir un `.md` grande en modo lectura no monta el motor de
  edición. La diferencia se nota al saltar entre ficheros desde el explorador.
- **Se puede tener en la fase 1**, en cuanto el parser produzca mdast, mucho antes
  de que exista el editor. Da un producto usable desde el principio.

El coste: los estilos de lectura y de edición deben coincidir visualmente, o el
salto entre modos se ve raro. Se resuelve compartiendo la misma hoja de estilos
tipográficos entre el renderizador y el editor.

---

## 8. Plan por fases

Cada fase termina con algo funcionando y commiteable.

**Fase 0 — Esqueleto**
Proyecto Tauri + React + TS + Vite. Estructura de carpetas. CI en GitHub Actions
(lint, typecheck, tests). README y licencia.

**Fase 1 — El core**
Esquema de ProseMirror con párrafos y headings. Mapeo mdast ↔ PM en ambas
direcciones. Tests de round-trip verdes. **Sin UI todavía.** Esta fase es la que
determina si el proyecto se sostiene.

**Fase 1.5 — Visor**
Renderizador de mdast a React. Abrir un `.md` y leerlo formateado. Índice del
documento. Vista de Markdown crudo. Es el primer entregable con el que se puede
hacer algo útil, y no depende de ProseMirror.

**Fase 2 — Editor básico**
Tiptap montado sobre el esquema. Abrir y guardar ficheros. Round-trip verificado
de extremo a extremo con ficheros reales.

**Fase 3 — Formato inline y bloques**
Negrita, cursiva, tachado, código, enlaces, listas, citas, bloques de código,
separadores. Input rules y atajos. Cada elemento nuevo amplía el mapeo y sus tests.

**Fase 4 — Explorador**
Árbol, quick open, vista previa, watcher.

**Fase 5 — Tablas e imágenes**
Las dos piezas con más complejidad de interacción. Van juntas y al final porque
tensionan el mapeo más que ninguna otra cosa.

**Fase 6 — Slash commands**
Menú `/` para inserción de bloques.

**Fase 7 — IA**
Comandos sobre selección primero, RAG después. Ver sección 6.

> Nota: la IA es prioritaria como objetivo, pero depende del AST y de un mapeo
> estable. Aplicarla antes de la fase 3 significaría construirla sobre cimientos
> que aún cambian.

---

## 9. Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| El esquema de PM no representa algo del Markdown original | Round-trip cerrado desde fase 1; corpus de `.md` reales como fixtures |
| Tablas rompen el mapeo | Dejarlas para fase 5, cuando el mapeo esté maduro |
| Diferencias de webview entre plataformas | Windows primero; probar Linux antes de prometer multiplataforma |
| Extensiones de pago de Tiptap | Las de colaboración, comentarios e historial son propietarias — no depender de ellas |
| Rendimiento en documentos largos | Medir antes de optimizar; criterio de migración a Rust en sección 4 |
| Alcance excesivo del MVP | Las fases son entregables independientes; se puede parar en cualquiera |

---

## 10. Primer paso concreto

Fase 0 y Fase 1. En concreto:

1. `npm create tauri-app` con plantilla React + TypeScript
2. Estructura de `src/core/` con las cuatro subcarpetas
3. Esquema de ProseMirror: `doc`, `paragraph`, `heading`, `text`
4. `mdastToPm()` y `pmToMdast()` para esos cuatro nodos
5. Tests de round-trip con Vitest, incluyendo casos límite
   (heading vacío, párrafos consecutivos, líneas en blanco al final del fichero)
6. CI que ejecute esos tests en cada push

7. Renderizador de mdast a React para esos nodos, y una pantalla que abra un
   `.md` y lo muestre formateado

Cuando los tests de round-trip estén en verde y el visor abra un fichero, el
resto del proyecto es incremental.
