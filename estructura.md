# Estructura y funcionamiento actual de Atlas

## 1. Qué es Atlas

Atlas es una aplicación web documental que reúne varias bibliotecas especializadas asociadas a distintas IA de NotebookLM. Permite descubrir las bibliotecas, consultar sus fuentes, leer documentos completos, buscar dentro del corpus, estudiar relaciones, recorrer cronologías y consumir contenidos breves en formato Shorts.

La aplicación tiene dos ámbitos relacionados:

1. **Atlas público**, destinado a consultar, leer y descubrir contenido.
2. **Gestor de Atlas**, destinado a incorporar, revisar y eliminar documentos, administrar bibliotecas y reconstruir los datos publicados.

Atlas está construido principalmente con HTML, CSS, JavaScript y scripts Node.js. No utiliza actualmente un framework de frontend ni un gestor de dependencias mediante `package.json`.

---

## 2. Visión general de la arquitectura

El sistema actual sigue este flujo:

```text
Carpetas de bibliotecas Markdown
              │
              ▼
      Generadores Node.js
              │
              ▼
 Catálogos, índices y documentos
       generados en atlas/data
              │
              ▼
       Aplicación web Atlas
```

El Gestor añade una segunda vía:

```text
Gestor web
   │
   ▼
API local de server.mjs
   │
   ├── modifica carpetas y configuraciones
   ├── detecta duplicados
   ├── consulta proveedores externos
   └── ejecuta los generadores
              │
              ▼
       Atlas reconstruido
```

Las carpetas documentales son la fuente principal de verdad. Los archivos de `atlas/data` son resultados derivados y deberían poder regenerarse.

---

## 3. Estructura principal del proyecto

```text
Mercaba/
├── 01_IA_Doctrina_Teologia_Moral/
├── 02_IA_Derecho_Canonico/
├── 03_IA_Historia_Iglesia_Padres/
├── 04_IA_Liturgia/
├── 05_IA_OrtodoxIA/
├── 06_IA_CinePilot/
├── 07_IA_BibliotecarIA/
├── 08_IA_Los_Clásicos/
├── 09_IA_San_JosemarIA/
└── atlas/
    ├── assets/
    ├── content/
    ├── data/
    ├── generators/
    ├── gestor/
    ├── scripts/
    ├── styles/
    ├── index.html
    ├── manifest.webmanifest
    ├── service-worker.js
    └── server.mjs
```

### Carpetas `NN_IA_*`

Cada carpeta representa una biblioteca. Contiene:

- documentos Markdown;
- un posible `0000_Indice_y_mapa_de_fuentes.md`;
- metadatos documentales incluidos en el nombre, índice o frontmatter.

El prefijo numérico determina el orden. El patrón `_IA_` permite que Atlas detecte una biblioteca nueva automáticamente.

### `atlas/assets`

Contiene los recursos visuales:

- iconos de la PWA;
- imágenes;
- retratos y fondos;
- infografías HTML.

### `atlas/content`

Contiene configuración editorial que sí se considera fuente editable:

- `libraries.json`: registro y configuración de bibliotecas;
- `library-prompts.json`: preguntas y orientación de las IA;
- `youtube-shorts.json`: canales y vídeos;
- `youtube-music.json`: canales musicales;
- `instagram.json`: cuentas de Instagram;
- `external-feeds.json`: fuentes de noticias, lecturas y otros proveedores;
- `external-items.json`: tarjetas externas administradas;
- `quote-policy.json`: política editorial para las frases;
- `prayer-series.json`: series y fuentes de oración;
- `PLANTILLA_DOCUMENTO.md`: formato recomendado para documentos.

### `atlas/data`

Contiene los resultados generados que consume la web:

- catálogo global;
- catálogos individuales por biblioteca;
- colecciones y rutas;
- Shorts;
- frases;
- contenidos externos;
- cachés de YouTube, música e Instagram;
- índice de búsqueda textual;
- documentos preparados para el lector;
- informes de importación;
- estado de la última construcción;
- versión y registro de cambios.

Parte de los datos existe simultáneamente como `.json` y como `.js`. Los archivos JavaScript asignan su contenido a variables globales del navegador.

### `atlas/generators`

Contiene los scripts Node.js que transforman las fuentes en datos publicables.

### `atlas/gestor`

Contiene la interfaz administrativa. No funciona de forma autónoma: depende de las rutas `/api/*` ofrecidas por `server.mjs`.

### `atlas/scripts`

Contiene los módulos funcionales del frontend público.

### `atlas/styles`

Contiene tokens visuales, estilos base, componentes, temas y reglas adaptativas.

---

## 4. Las bibliotecas y los documentos

La configuración de las bibliotecas está en:

```text
atlas/content/libraries.json
```

Cada entrada contiene aproximadamente:

```json
{
  "id": "history",
  "folder": "03_IA_Historia_Iglesia_Padres",
  "short": "HistorIA de la Iglesia y los Padres",
  "mark": "H",
  "tone": "clay",
  "notebookUrl": "https://notebooklm.google.com/...",
  "description": "..."
}
```

El campo `folder` relaciona la biblioteca lógica con su carpeta física. El `id` se utiliza en rutas, filtros, relaciones, estadísticas y almacenamiento local.

### Detección automática

Al reconstruir Atlas, `server.mjs` busca en la carpeta `Mercaba` directorios cuyo nombre cumpla:

```text
NN_IA_Nombre
```

Si encuentra una carpeta no registrada:

1. genera un identificador;
2. obtiene un nombre visible;
3. asigna una marca y un color;
4. añade la biblioteca a `content/libraries.json`;
5. permite que los generadores incorporen sus Markdown.

### Metadatos documentales

Atlas intenta obtener los datos de cada documento desde:

1. el índice `0000_Indice_y_mapa_de_fuentes.md`;
2. el frontmatter del Markdown;
3. el encabezado principal `#`;
4. el nombre del archivo;
5. reglas heurísticas de autores, categorías y fechas.

Ejemplo de frontmatter:

```yaml
---
title: "Título del documento"
category: "Magisterio"
author: "Autor"
year: 1965
---
```

### Identidad

Actualmente el identificador de un documento suele derivarse de:

```text
id de biblioteca + nombre del archivo
```

El contenido para el lector recibe además un nombre basado en un hash.

---

## 5. Proceso de construcción

El punto de entrada general es:

```text
atlas/generators/update-all.mjs
```

También se puede ejecutar mediante:

```text
ACTUALIZAR_ATLAS.cmd
```

El proceso llama secuencialmente a varios generadores.

### `build-data.mjs`

Es el generador principal:

- descubre bibliotecas;
- lee los índices y documentos;
- genera metadatos;
- calcula autores, categorías y estadísticas;
- construye relaciones temáticas;
- incorpora rutas, colecciones y contenido editorial;
- escribe el catálogo general y catálogos por biblioteca.

### `build-reader-content.mjs`

Prepara los Markdown para el lector:

1. lee el documento;
2. detecta encabezados;
3. genera un índice jerárquico;
4. divide el contenido en fragmentos;
5. escribe un archivo JavaScript en `data/documents`.

Cada archivo asigna temporalmente su contenido a:

```js
window.ATLAS_READER_PAYLOAD
```

### `build-fulltext.mjs`

Construye el buscador literal:

1. recorre todos los documentos;
2. normaliza palabras y elimina términos vacíos;
3. calcula la frecuencia;
4. selecciona términos;
5. vuelve a recorrer el corpus;
6. construye un índice invertido;
7. escribe `data/fulltext-index.js`.

Este índice relaciona cada término con los documentos en los que aparece y el número de coincidencias.

### Generadores editoriales y externos

Otros scripts generan:

- frases;
- vídeos;
- música;
- catálogo de canales;
- contenidos externos;
- infografías sincronizadas.

### Huella de cambios

`server.mjs` calcula una huella de las fuentes. Si detecta cambios, ejecuta la reconstrucción documental completa. Si no los detecta, puede limitarse a regenerar determinados contenidos editoriales o externos.

El estado queda registrado en:

```text
data/source-state.json
```

---

## 6. Aplicación pública

El punto de entrada es:

```text
atlas/index.html
```

Carga:

- hojas de estilo;
- catálogos generados;
- módulos JavaScript;
- navegación principal;
- contenedores de modales y elementos globales.

### Organización de los módulos

#### `scripts/app.js`

Coordina la aplicación:

- construye las pantallas;
- enlaza eventos generales;
- muestra Inicio, Guardados y Configuración;
- controla tutoriales y actualizaciones;
- conecta los distintos módulos.

#### `scripts/router.js`

Gestiona la navegación mediante rutas con hash:

```text
#/
#/explore
#/library/...
#/reader/...
#/discover
#/saved
```

Las rutas con hash son compatibles con un alojamiento estático porque el servidor siempre entrega el mismo `index.html`.

#### `scripts/library.js`

Genera componentes relacionados con:

- bibliotecas;
- documentos;
- iconos;
- estados vacíos;
- fichas documentales.

#### `scripts/search.js`

Ofrece dos niveles de búsqueda:

1. búsqueda rápida sobre metadatos del catálogo;
2. búsqueda textual dentro de los documentos mediante el índice invertido.

El índice completo solo se descarga cuando el usuario solicita búsqueda entre documentos.

#### `scripts/reader.js`

Controla el lector documental:

- carga dinámica del documento;
- tabla de contenido;
- fragmentos o lectura continua;
- tamaño de letra;
- ancho de columna;
- progreso;
- búsqueda literal;
- navegación entre coincidencias;
- anotaciones;
- subrayados;
- favoritos;
- documentos relacionados.

#### `scripts/reels.js`

Construye la experiencia de Shorts:

- mezcla contenido editorial y externo;
- aplica filtros;
- carga más elementos;
- consulta vídeos, música e Instagram;
- controla reproducción;
- guarda y comparte;
- anima fondos e iluminación;
- aplica el desplazamiento imantado.

#### `scripts/extras.js`

Agrupa funciones complementarias, incluidas algunas vistas y contenidos externos.

#### `scripts/statistics.js`

Calcula y presenta estadísticas de las bibliotecas.

#### `scripts/compare.js`

Compara documentos, categorías o bibliotecas.

#### `scripts/storage.js`

Gestiona el estado local del usuario.

#### `scripts/share.js`

Gestiona acciones de compartir y copiar enlaces.

---

## 7. Funcionamiento del lector

Cuando el usuario abre un documento:

1. Atlas localiza sus metadatos en el catálogo.
2. Lee el campo `contentFile`.
3. Inserta dinámicamente un `<script>` con el archivo correspondiente.
4. El archivo establece `window.ATLAS_READER_PAYLOAD`.
5. El lector comprueba que el ID coincide.
6. Renderiza el fragmento guardado o el primero.
7. Restaura configuración y progreso.

El Markdown se convierte en HTML directamente en el navegador. El lector reconoce:

- encabezados;
- párrafos;
- listas;
- tareas;
- tablas;
- citas;
- bloques de código;
- enlaces;
- énfasis.

El documento puede verse por fragmentos o en lectura continua.

---

## 8. Búsqueda

### Búsqueda por catálogo

Está disponible inmediatamente y compara la consulta con:

- título;
- archivo;
- autor;
- categoría;
- biblioteca;
- año;
- estado;
- idioma;
- colecciones;
- rutas;
- preguntas.

### Búsqueda en el texto de los documentos

Cuando el usuario activa esta opción:

1. se descarga `data/fulltext-index.js`;
2. la consulta se normaliza;
3. se buscan los términos en el índice;
4. se cruzan sus listas de documentos;
5. se ordenan los resultados por apariciones;
6. al abrir un documento se busca el texto dentro de sus fragmentos;
7. el lector resalta las coincidencias.

---

## 9. Shorts y contenidos externos

El feed combina:

- frases;
- hechos;
- anécdotas;
- preguntas;
- documentos;
- autores;
- cronología;
- vídeos;
- música;
- Instagram;
- noticias;
- lecturas;
- oración.

### Fuentes locales

Se generan desde:

- `frases.md`;
- `frases copy.md`;
- `content/external-items.json`;
- datos editoriales del catálogo;
- archivos generados de Shorts.

### Fuentes dinámicas

Durante la ejecución local, `reels.js` consulta:

```text
/api/youtube-shorts
/api/music
/api/instagram-shorts
/api/josemaria-quote
```

Si no están disponibles, algunos proveedores utilizan archivos de caché en `data`.

### Actualización y caché

El servidor conserva snapshots para reducir consultas y ofrecer contenido cuando el proveedor falla. YouTube, música e Instagram aplican actualmente una ventana de caché aproximada de 30 minutos.

Por ello, refrescar la aplicación cambia normalmente el orden del feed, pero no garantiza que todos los proveedores externos sean consultados de nuevo en ese instante.

### Orden del feed

Los elementos se barajan dentro de grupos y se aplican límites por tipo. La implementación actual puede concatenar grupos completos, causando secuencias con muchos vídeos u otros elementos similares.

---

## 10. Gestor de Atlas

El Gestor se abre en:

```text
http://127.0.0.1:8765/gestor/
```

Necesita que `server.mjs` esté ejecutándose.

### Funciones actuales

El Gestor permite:

- consultar el estado de Atlas;
- ver bibliotecas y documentos;
- subir varios Markdown;
- asignar categoría, autor y fecha;
- numerar archivos automáticamente;
- evitar duplicados;
- forzar una importación;
- eliminar documentos;
- detectar títulos o contenidos repetidos;
- crear bibliotecas;
- editar bibliotecas;
- eliminar bibliotecas y carpetas;
- editar Shorts como JSON;
- editar tarjetas externas como JSON;
- actualizar fuentes externas;
- reconstruir Atlas.

### Subida documental

Cuando se sube un lote:

1. el navegador lee los Markdown;
2. envía su contenido a `/api/upload-batch`;
3. el servidor calcula título y hash canónico;
4. comprueba duplicidades;
5. obtiene el siguiente número disponible;
6. añade frontmatter si falta;
7. escribe los Markdown en la biblioteca;
8. el Gestor solicita una reconstrucción;
9. recarga el estado.

### Duplicados

Se comparan:

- títulos normalizados;
- hashes del contenido canónico.

La canonicalización elimina frontmatter, comentarios y diferencias superficiales antes de calcular el hash.

### Creación de bibliotecas

Al crear una biblioteca:

1. el servidor genera el ID y el nombre de carpeta;
2. crea la carpeta `NN_IA_*`;
3. crea un índice inicial;
4. registra la biblioteca;
5. reconstruye Atlas.

### Sincronización

No todas las acciones siguen exactamente el mismo flujo:

- subir documentos solicita reconstrucción;
- crear o editar bibliotecas solicita reconstrucción;
- guardar determinados JSON puede requerir pulsar después “Actualizar Atlas”;
- eliminar un documento actualiza la carpeta, pero el catálogo puede seguir mostrando datos antiguos hasta la siguiente reconstrucción.

---

## 11. Servidor local

`server.mjs` cumple dos funciones:

1. servir los archivos de Atlas;
2. proporcionar la API administrativa y los adaptadores externos.

### API de gestión

Incluye rutas para:

- estado;
- archivos;
- bibliotecas;
- duplicados;
- subidas;
- eliminaciones;
- Shorts;
- contenidos externos;
- reconstrucción.

### API externa

Incluye adaptadores para:

- YouTube;
- música;
- Instagram;
- frases aleatorias de escriva.org.

El servidor consulta, normaliza, mezcla y almacena temporalmente estos resultados.

### Seguridad local

El servidor valida:

- bibliotecas conocidas;
- rutas de archivo;
- extensiones Markdown;
- límites de tamaño;
- confirmaciones de eliminación.

Está concebido como herramienta local. No debe exponerse directamente a Internet sin autenticación, control de permisos y medidas adicionales.

---

## 12. Almacenamiento del usuario

Atlas guarda en `localStorage`:

- favoritos;
- historial;
- progreso de lectura;
- anotaciones;
- subrayados;
- marcadores;
- tiempo de estudio;
- configuración visual;
- preferencias del feed;
- canales desactivados;
- estado del tutorial.

Esta información:

- permanece en el dispositivo;
- no necesita cuenta;
- no se sincroniza entre dispositivos;
- puede perderse al borrar los datos del navegador.

---

## 13. PWA y funcionamiento sin conexión

Atlas incluye:

- `manifest.webmanifest`;
- iconos instalables;
- `service-worker.js`;
- página offline.

El Service Worker:

- precarga el shell principal;
- almacena estilos y scripts;
- guarda determinados catálogos;
- actualiza algunos datos desde la red;
- conserva recursos ya consultados;
- elimina cachés de versiones antiguas.

Los documentos del lector se almacenan cuando se solicitan, no todos durante la instalación.

La aplicación puede instalarse como PWA, pero la actualización externa y el Gestor necesitan conexión y, en la arquitectura actual, el servidor local.

---

## 14. Versionado

La versión aparece actualmente en varios sitios:

- `scripts/app.js`;
- `index.html`;
- `service-worker.js`;
- `data/version.json`;
- `data/metadata-overrides.json`;
- `data/catalog.json`;
- validador de publicación.

Los parámetros `?v=` de CSS y JavaScript ayudan a invalidar la caché. El nombre de las cachés del Service Worker también incluye la versión.

El sistema funciona, pero exige mantener manualmente sincronizados todos esos valores.

---

## 15. Estado actual de los datos

Durante la auditoría se observaron aproximadamente:

- 9 bibliotecas registradas;
- 975 documentos activos declarados por el catálogo;
- 1.207 archivos en `data/documents`;
- 678,7 MB de contenido generado para el lector;
- 33 MB de índice textual;
- 1,25 MB de catálogo JSON;
- 0,92 MB de catálogo JavaScript.

La diferencia entre los 975 documentos activos y los 1.207 archivos del lector indica que el generador añade o sobrescribe archivos, pero no elimina automáticamente todos los documentos generados que han dejado de existir.

---

## 16. Dependencias entre componentes

| Componente | Depende de | Produce o modifica |
|---|---|---|
| Carpetas `NN_IA_*` | Markdown y estructura de nombres | Fuentes documentales |
| `content/libraries.json` | Configuración manual o Gestor | Registro de bibliotecas |
| Generadores | Carpetas, configuración y datos editoriales | `data` |
| Aplicación pública | `index.html`, scripts, estilos y `data` | Interfaz de consulta |
| Lector | Catálogo y `data/documents` | Lectura y progreso local |
| Buscador | Catálogo e índice textual | Resultados |
| Shorts | Catálogo, frases, cachés y API | Feed dinámico |
| Gestor | `server.mjs` | Fuentes y configuraciones |
| `server.mjs` | Sistema de archivos y red | API, cachés y reconstrucción |
| Service Worker | Shell y datos publicados | Caché offline |

---

## 17. Fortalezas actuales

- Las carpetas documentales ya actúan como fuente principal.
- Se pueden detectar bibliotecas nuevas por su nombre.
- El contenido está separado parcialmente de la interfaz.
- El lector trabaja con carga diferida.
- Existe búsqueda literal sobre todo el corpus.
- Hay detección de duplicados por título y contenido.
- El Gestor admite cargas múltiples.
- Las preferencias del usuario permanecen localmente.
- Los contenidos externos disponen de fallback.
- La navegación por hash facilita el alojamiento estático.
- Los generadores pueden reconstruir gran parte de la aplicación.

---

## 18. Limitaciones estructurales actuales

### Dependencia del servidor

El Gestor y los contenidos externos en directo dependen de Node. GitHub Pages no puede ejecutar `server.mjs`.

### Duplicación de datos

Parte del catálogo se publica simultáneamente como JSON y JavaScript.

### Salidas antiguas

El contenido del lector no se limpia completamente antes de regenerarse.

### Peso

El lector y el índice pueden exigir descargas y almacenamiento importantes.

### Versionado manual

Una actualización visual obliga a modificar varios archivos.

### Sincronización desigual

Algunas acciones reconstruyen inmediatamente y otras solo modifican las fuentes.

### Rutas absolutas

Las rutas `/api` y algunas rutas `/data` están pensadas para la raíz de un servidor, no para el subdirectorio de GitHub Pages.

### Gestión editorial

Parte de la edición del Gestor consiste en modificar JSON completo dentro de un área de texto, lo que resulta poco seguro para un usuario no técnico.

### Proveedores externos

YouTube, Instagram, medios y editoriales no tienen las mismas garantías de acceso. Algunos contenidos pueden fallar por CORS, cambios de HTML, cuotas o bloqueos.

### Aleatoriedad de Shorts

El sistema actual baraja elementos, pero no asegura una alternancia equilibrada entre tipos.

---

## 19. Diferencia entre la app local y una publicación estática

### En ejecución local

```text
Navegador ↔ server.mjs ↔ archivos locales y proveedores externos
```

Están disponibles:

- Gestor;
- escritura en carpetas;
- reconstrucción;
- consultas dinámicas;
- cachés actualizadas por el servidor.

### En GitHub Pages

```text
Navegador → archivos estáticos publicados
```

No están disponibles por sí solos:

- Node;
- escritura en el repositorio;
- `/api/rebuild`;
- subida directa a carpetas;
- scraping desde servidor;
- protección de claves privadas.

Por eso la futura arquitectura deberá separar la PWA pública, el Gestor, la construcción y la actualización externa.

---

## 20. Resumen

Atlas ya funciona como una aplicación documental rica, con una fuente principal basada en carpetas Markdown y una capa generada para consulta rápida. Su arquitectura actual es adecuada para ejecución local, porque `server.mjs` conecta la interfaz gestora con el sistema de archivos y los proveedores externos.

La principal dificultad no está en la interfaz pública, sino en trasladar esta dinámica a GitHub Pages. Para hacerlo correctamente habrá que:

- conservar las carpetas y configuraciones como fuentes de verdad;
- automatizar la construcción;
- limpiar y segmentar los datos generados;
- desacoplar el Gestor del sitio público;
- sustituir las API locales por datos estáticos, Actions o un proxy;
- centralizar versión y rutas;
- mantener una sincronización verificable entre fuentes, catálogo, lector e índice.

El plan detallado para realizar esa reforma se encuentra en:

```text
promptrefactor.md
```
