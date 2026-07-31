# ATLAS — Documentación completa de la aplicación

> Nota de arquitectura (versión 5.0): este documento conserva la descripción
> funcional acumulada de Atlas. Para construir, mantener o publicar la versión
> actual deben utilizarse [ARCHITECTURE.md](ARCHITECTURE.md),
> [DATA_MODEL.md](DATA_MODEL.md), [MANAGER_GUIDE.md](MANAGER_GUIDE.md) y
> [DEPLOY_GITHUB_PAGES.md](DEPLOY_GITHUB_PAGES.md). Las menciones posteriores a
> endpoints `/api/*` describen el funcionamiento histórico: la PWA pública usa
> snapshots estáticos y no necesita un servidor Node.

## 1. Qué es Atlas

Atlas es el portal documental, visual e interactivo de las inteligencias
artificiales especializadas de Mercabá. Parte de cuatro bibliotecas principales:

1. Doctrina, teología y moral.
2. CanonIA.
3. HistorIA de la Iglesia y los Padres.
4. LiturgIA.

La aplicación no intenta responder en lugar de estas IA. Su función es permitir
que el usuario descubra:

- qué documentos contiene cada cuaderno;
- qué materias cubre;
- qué tipo de autoridad tiene cada fuente;
- qué limitaciones documentales existen;
- qué preguntas pueden formularse;
- qué documentos están relacionados por autor, categoría o presencia compartida;
- qué cuaderno de Notebook debe abrirse.

Atlas combina cuatro tipos de producto:

- catálogo documental;
- biblioteca digital;
- explorador del conocimiento;
- aplicación de formación y descubrimiento diario.

Las bibliotecas no están limitadas a esas cuatro. Al arrancar, el servicio busca
carpetas con el formato `NN_IA_Nombre`, las registra de forma automática y
reconstruye las vistas. Una IA vacía puede aparecer como contenedor preparado
para recibir sus primeros Markdown.

### 1.1. Incorporación y ayuda

La primera ejecución abre un recorrido guiado por Inicio, Navegador,
Bibliotecas, Lector, Descubrir, Explorar, Comparar y Guardados. Cada paso navega
a la pantalla correspondiente, desplaza el elemento a la vista y dibuja un halo
animado alrededor del botón o bloque explicado. El recorrido se guarda
localmente y puede repetirse desde `?` o preguntando cómo usar Atlas.

El Navegador usa un clasificador local y explicable: detecta intención
doctrinal, canónica, histórica o litúrgica, la contrasta con títulos, temas y
preguntas del catálogo, y propone una biblioteca principal y alternativas. Su
misión es orientar hacia fuentes, no responder doctrinalmente.

### 1.2. Bibliotecas actuales

Atlas 3.5 integra nueve bibliotecas: Doctrina y Moral, CanonIA, HistorIA,
LiturgIA, OrtodoxIA, CinePilot, BibliotecarIA, Los Clásicos y San JosemarIA.
Los documentos no necesitan comenzar por un número: cualquier `.md` válido de
la carpeta se incorpora directamente. Los índices `0000_…` siguen siendo útiles
para añadir mapas y metadatos editoriales, pero ya no son un requisito para que
una obra aparezca.

### 1.3. Personalización

El orden relativo de «Atlas Hoy» y «Explora las IA» es configurable. Los doce
accesos de Explorar también se pueden reordenar y colorear de forma individual.
Todas estas elecciones se conservan en `localStorage`, sin modificar el
catálogo compartido.

Desde la versión 3.6, Inicio permite ordenar todos sus bloques disponibles:
Atlas Hoy, bibliotecas, lecturas en curso y actividad reciente. El control se
presenta de forma discreta bajo la búsqueda principal.

### 1.4. Descubrir audiovisual

El feed combina 700 frases importadas desde `frases.md`, 90 preguntas
editoriales, contenido documental, actualidad y YouTube Shorts. El endpoint
`/api/youtube-shorts` consulta cada treinta minutos las pestañas Shorts definidas
en `content/youtube-shorts.json`, mantiene una caché y pagina nuevos resultados
cuando el usuario desliza. Al pulsar una tarjeta se abre el reproductor oficial
embebido dentro de Atlas. Los vídeos permanecen siempre en YouTube: no se
descargan ni se redistribuyen.

### 1.5. Grafos de conocimiento

El grafo jerárquico representa tres niveles —IA, categorías y fuentes— y permite
cambiar de biblioteca. El grafo documental parte de una fuente concreta y
muestra relaciones verificables del catálogo. Ambos ofrecen zoom, desplazamiento
y navegación directa desde sus nodos.

## 2. Principios del producto

### 2.1. No inventar

Los documentos, categorías, recuentos, mapas y advertencias proceden de los
cuatro índices `0000_Indice_y_mapa_de_fuentes.md`.

Cuando un dato no está disponible, la interfaz muestra una fórmula equivalente
a «No consignado en el índice».

Atlas no presupone que un documento sea vigente por no estar marcado como
histórico. El estado visible es:

- histórico o sustituido, cuando lo declara el índice;
- incompleto o parcial, cuando lo declara el índice;
- no consignado, en el resto de los casos.

### 2.2. Móvil primero

La interfaz se ha diseñado inicialmente para:

- iPhone pequeño;
- Android;
- enlaces abiertos desde WhatsApp;
- navegación con una sola mano;
- sesiones breves.

En móvil utiliza una barra inferior con cinco destinos:

1. Inicio.
2. Explorar.
3. Descubrir.
4. Buscar.
5. Guardados.

En escritorio esa navegación se transforma en una cabecera horizontal.

### 2.3. Privacidad local

No hay registro, cuenta ni analítica. Las búsquedas normales se ejecutan en el
navegador. Los favoritos, historial y progreso se guardan en el dispositivo.

## 3. Arquitectura de archivos

```text
atlas/
├── index.html
├── styles/
│   ├── tokens.css
│   ├── base.css
│   ├── components.css
│   ├── themes.css
│   └── responsive.css
├── scripts/
│   ├── storage.js
│   ├── search.js
│   ├── share.js
│   ├── statistics.js
│   ├── library.js
│   ├── compare.js
│   ├── reels.js
│   ├── router.js
│   └── app.js
├── data/
│   ├── catalog.js
│   ├── catalog.json
│   ├── doctrine.json
│   ├── canon.json
│   ├── history.json
│   ├── liturgy.json
│   ├── collections.json
│   ├── routes.json
│   ├── shorts.json
│   ├── fulltext-index.js
│   ├── metadata-overrides.json
│   ├── import-report.json
│   ├── version.json
│   └── changelog.json
├── generators/
│   ├── build-data.mjs
│   ├── build-fulltext.mjs
│   ├── build-data.ps1
│   └── README.md
├── assets/icons/
├── manifest.webmanifest
├── service-worker.js
├── offline.html
└── README.md
```

La aplicación no emplea frameworks. Los scripts clásicos permiten abrir
`index.html` directamente mediante `file://`.

## 4. Responsabilidad de cada módulo

### `storage.js`

Gestiona `localStorage`:

- documentos favoritos;
- Shorts guardados;
- colecciones;
- preguntas;
- historial;
- búsquedas recientes;
- pasos completados;
- resultados de preguntas;
- tema;
- alto contraste;
- preferencias del feed.

También permite exportar e importar los datos locales.

### `search.js`

Construye el índice rápido de metadatos y ofrece dos motores:

1. búsqueda inmediata en títulos y metadatos;
2. búsqueda diferida dentro del texto completo.

### `share.js`

Proporciona:

- Web Share API;
- copia al portapapeles;
- alternativa para navegadores antiguos;
- apertura de WhatsApp con texto preparado.

### `statistics.js`

Genera las visualizaciones documentales sin librerías externas.

### `library.js`

Construye:

- cabecera de cada IA;
- catálogo;
- tarjetas y listas;
- biblioteca visual;
- mapas temáticos;
- autores;
- preguntas;
- fichas documentales.

### `compare.js`

Compara entre dos y cuatro bibliotecas mediante títulos normalizados.

### `reels.js`

Construye el feed vertical de Shorts verificados.

### `router.js`

Interpreta las rutas situadas después de `#`.

### `app.js`

Coordina navegación, eventos, paneles, estados y PWA.

## 5. Rutas profundas

Las rutas principales son:

```text
#/
#/explore
#/discover
#/compare
#/saved
#/updates
#/library/doctrine/documents
#/library/canon/stats
#/library/history/topics
#/library/liturgy/shelf
#/document/{id}
#/collection/{id}
#/route/{id}
#/short/{id}
#/author/{nombre}
```

Ejemplo con filtro:

```text
#/library/history/documents?category=Patrística
```

La sección de bibliotecas de Explorar utiliza:

```text
#/explore?section=libraries
```

El enrutador abre Explorar y después desplaza la pantalla hasta
`#explore-libraries`. Se evita así el conflicto anterior entre el hash de la SPA
y un ancla HTML convencional.

## 6. Pantalla de inicio

La portada contiene:

- identidad de Atlas;
- buscador principal;
- Atlas Hoy;
- tarjetas de las cuatro IA;
- actividad reciente.

### Atlas Hoy

La selección se obtiene de manera determinista usando el día del año. Todos los
usuarios ven la misma selección diaria sin servidor.

Puede mostrar:

- documento del día;
- Short del día;
- pregunta para identificar una biblioteca.

## 7. Bibliotecas

Cada biblioteca dispone de:

- nombre e identidad cromática;
- descripción y finalidad;
- acceso al Notebook;
- documentos;
- palabras;
- categorías;
- autores identificados;
- idiomas extranjeros indicados.

### Colores

- Doctrina: ámbar.
- CanonIA: azul.
- HistorIA: arcilla o granate.
- LiturgIA: violeta.

## 8. Explorador documental

### Tarjetas

Muestran:

- categoría;
- título;
- autor o número original;
- palabras;
- estado histórico o incompleto;
- guardado.

### Lista

Es la alternativa compacta y accesible.

### Biblioteca visual

Representa documentos como libros:

- el grosor depende del número de palabras;
- la altura depende del volumen;
- el color corresponde a la biblioteca.

Para proteger el rendimiento, se muestran como máximo cien libros en la
estantería principal.

## 9. Buscador de metadatos

Se abre mediante:

- el buscador de la portada;
- el botón de la cabecera;
- la barra móvil;
- `Ctrl + K`.

Busca instantáneamente por:

- título;
- archivo;
- número original;
- autor identificado;
- categoría;
- biblioteca;
- idioma;
- año;
- estado;
- colección;
- ruta;
- pregunta preparada.

### Equivalencias

Los alias se encuentran en `metadata-overrides.json`.

Ejemplos:

- Misal → Missale.
- Romano → Romanum.
- Código → Codex.
- Agustín → Augustin.
- Derecho → Iuris.
- Canónico → Canonici.

## 10. Búsqueda dentro del texto documental

La búsqueda textual no se carga al abrir la aplicación. El índice pesa
aproximadamente 14 MB y contiene ochenta mil términos.

Flujo:

1. el usuario escribe una consulta;
2. pulsa **Buscar este texto dentro de los documentos**;
3. Atlas carga `data/fulltext-index.js`;
4. normaliza la consulta;
5. aplica equivalencias;
6. intersecta las listas de documentos;
7. ordena por número de apariciones;
8. muestra documentos y recuentos.

El índice es invertido:

```text
término → documento → número de apariciones
```

No contiene los textos completos ni fragmentos, por lo que resulta mucho más
pequeño que duplicar los 39 millones de palabras.

### Limitaciones

- Se eliminan palabras vacías frecuentes.
- Los términos deben tener al menos tres caracteres.
- Se indexan los ochenta mil términos más relevantes con tres o más apariciones.
- Se buscan palabras normalizadas, no expresiones regulares.
- El número mostrado es un recuento de términos, no una referencia de página.

### Regenerar el índice

```powershell
node .\atlas\generators\build-fulltext.mjs
```

Se debe ejecutar cuando cambien los documentos fuente, no solo sus índices.

## 11. Ficha documental

La ficha muestra:

- título;
- archivo;
- número de catálogo;
- números originales;
- biblioteca;
- categoría;
- autor;
- fecha;
- idioma;
- palabras;
- autoridad orientativa;
- estado;
- preguntas sugeridas;
- documentos de la misma categoría;
- acceso al Notebook.

En móvil ocupa toda la pantalla. En escritorio se abre como panel lateral.

## 12. Compartir

El antiguo intento directo se ha sustituido por un panel estable.

Opciones:

1. menú de compartir del dispositivo;
2. WhatsApp;
3. copiar enlace;
4. copiar texto y enlace.

Los documentos y Shorts utilizan enlaces profundos. Si Atlas está publicado en
HTTPS, el destinatario abre directamente la ficha compartida.

Cuando se abre mediante `file://`, el texto puede copiarse, pero el enlace local
solo funciona en el mismo ordenador. Para compartir con otras personas debe
utilizarse la URL pública.

## 13. Estadísticas

Cada biblioteca dispone de doce visualizaciones:

1. barras por categoría;
2. gráfico de anillo;
3. mapa de burbujas;
4. nube de autores y temas;
5. distribución por extensión;
6. distribución por autoridad orientativa;
7. estados documentales;
8. ranking de documentos más extensos;
9. treemap;
10. fechas explícitas;
11. biblioteca estadística;
12. mapa de conexiones.

El comparador añade una matriz global de coincidencias.

Todas las visualizaciones tienen una representación textual, botones o tablas.

## 14. Mapa de nodos

El mapa emplea tres niveles:

```text
Biblioteca
└── Categoría
    └── Documento
```

Las conexiones se basan en relaciones verificables:

- el documento pertenece a la biblioteca;
- el documento está clasificado en la categoría.

No se generan relaciones doctrinales, históricas o jurídicas nuevas.

Los nodos son enlaces:

- el centro abre la biblioteca;
- una categoría filtra el catálogo;
- un documento abre su ficha.

El tamaño de los nodos documentales se adapta suavemente al volumen.

## 15. Comparador

Permite seleccionar entre dos y cuatro IA.

Compara:

- documentos;
- palabras;
- categorías;
- autores;
- documentos históricos;
- idiomas;
- áreas principales;
- documentos con títulos compartidos.

Las coincidencias se calculan normalizando títulos, no mediante IA generativa.

## 16. Colecciones y rutas

Las colecciones proceden de los mapas temáticos.

Las rutas utilizan:

1. fuentes principales;
2. fuentes complementarias;
3. orden de catálogo.

El progreso se guarda localmente. La aplicación no afirma que el orden sea un
programa académico oficial.

## 17. Shorts

Solo aparecen elementos con:

```json
"verified": true
```

Cada Short contiene:

- tipo;
- texto;
- biblioteca;
- documento cuando procede;
- referencia;
- fecha de revisión.

Los tipos actuales son:

- documento en treinta segundos;
- advertencia del índice;
- pregunta basada en un mapa temático.

No se publican citas textuales sin referencia verificada.

## 18. PWA y modo offline

Archivos:

- `manifest.webmanifest`;
- `service-worker.js`;
- iconos de 192 y 512 píxeles;
- icono maskable;
- `apple-touch-icon`;
- `offline.html`.

La instalación requiere:

- HTTPS en producción; o
- `localhost` durante las pruebas.

El service worker mantiene dos cachés:

```text
atlas-app-v2.0.0
atlas-data-v2.0.0
```

La estructura usa `cache first`. Los datos utilizan actualización en segundo
plano. El gran índice textual se descarga y almacena solo cuando se solicita.

## 19. Tema y accesibilidad

Atlas respeta:

- `prefers-color-scheme`;
- `prefers-reduced-motion`;
- `prefers-contrast`.

Incluye:

- claro, oscuro y sistema;
- alto contraste;
- foco visible;
- navegación por teclado;
- botones táctiles;
- etiquetas ARIA;
- lista alternativa a visualizaciones;
- ausencia de información transmitida solo mediante color.

## 20. Modelo de datos

### Biblioteca

```json
{
  "id": "history",
  "short": "HistorIA",
  "notebookUrl": "...",
  "topics": [],
  "warnings": [],
  "documents": [],
  "stats": {}
}
```

### Documento

```json
{
  "id": "history-0146_Agustin_Confesiones",
  "catalogId": "0146",
  "file": "0146_Agustin_Confesiones.md",
  "title": "Agustin Confesiones",
  "originals": "0146",
  "category": "Patrística / fuente eclesiástica antigua",
  "words": 153426,
  "author": "San Agustín",
  "year": null,
  "language": null,
  "status": "not-stated",
  "authority": "Padre de la Iglesia / fuente antigua"
}
```

## 21. Generador de datos

`build-data.mjs`:

1. lee los cuatro índices;
2. extrae secciones;
3. procesa mapas;
4. procesa advertencias;
5. extrae documentos;
6. construye categorías;
7. identifica autores conservadoramente;
8. construye colecciones;
9. construye rutas;
10. crea Shorts verificables;
11. valida;
12. publica JSON y JavaScript.

Las personalizaciones permanecen en `metadata-overrides.json`.

## 22. Publicación

Atlas puede publicarse en:

- GitHub Pages;
- Cloudflare Pages;
- Vercel;
- Firebase Hosting;
- cualquier servidor estático.

Debe publicarse toda la carpeta `atlas`, incluido
`data/fulltext-index.js`.

## 23. Pruebas recomendadas

Antes de publicar:

1. abrir Inicio;
2. pulsar Bibliotecas en Explorar;
3. buscar `Misal`;
4. buscar `Agustín`;
5. buscar `Código`;
6. buscar `0348`;
7. ejecutar una búsqueda textual;
8. abrir una ficha;
9. comprobar el enlace de Notebook;
10. compartir mediante copia y WhatsApp;
11. guardar el documento;
12. recorrer Shorts;
13. completar una ruta;
14. abrir doce estadísticas;
15. utilizar el mapa de nodos;
16. comparar dos bibliotecas;
17. probar móvil sin desplazamiento horizontal;
18. probar la PWA en `localhost`;
19. activar el modo offline;
20. revisar la consola.

## 24. Límites conocidos

- La búsqueda textual localiza documentos y el lector navega por todas las
  coincidencias, pero no crea respuestas ni interpretaciones automáticas.
- El mapa de nodos muestra una selección para conservar legibilidad.
- El autor solo se identifica cuando el título permite hacerlo con seguridad.
- Las fechas se muestran únicamente cuando aparecen explícitamente.
- El mapa mundial relaciona lugares por referencias textuales explícitas; no es
  una geolocalización exhaustiva de cada fuente.
- Noticias, opinión, oración y novedades editoriales son accesos a sitios
  externos. Atlas no copia sus artículos ni simula titulares en tiempo real.
- Sin un servicio de _push_, los avisos programados dependen del navegador y
  funcionan mejor con Atlas instalado como PWA.
- Los enlaces locales no pueden compartirse con otros dispositivos.
- La instalación PWA no funciona mediante `file://`; necesita HTTPS o localhost.

## 25. Criterio de evolución

Las ampliaciones deben conservar esta separación:

```text
datos extraídos
≠ enriquecimiento editorial
≠ estado personal del usuario
```

De este modo Atlas puede crecer sin confundir información factual, decisiones
editoriales y actividad local.

## 26. Funciones de Atlas 3.0

### Lector documental

Cada uno de los 476 Markdown dispone de una ruta propia:

```text
#/reader/{id}
#/reader/{id}?q=matrimonio
```

Los contenidos se preprocesan en `data/documents/` y se cargan bajo demanda en
fragmentos de unos 90.000 caracteres. Así el catálogo inicial sigue siendo
ligero aunque el corpus completo supere los 39 millones de palabras.

El lector incorpora:

- tipografía editorial y modo oscuro coordinado con Atlas;
- índice lateral generado desde los encabezados;
- tiempo estimado, número de palabras y barra de progreso;
- tamaño de letra y ancho de columna configurables;
- lectura por fragmentos o continua;
- restauración del punto de lectura;
- búsqueda literal, resaltado, contador y navegación anterior/siguiente;
- favoritos, subrayados, notas y marcadores almacenados localmente;
- panel contextual con autor, fecha, documentos, colecciones, Shorts y
  preguntas relacionadas.

Las referencias cruzadas solo se crean mediante relaciones justificables:
título normalizado, autor identificado, categoría, colección y biblioteca. Atlas
no atribuye citas si el índice no permite hacerlo con seguridad.

### Modo estudio y continuidad

`storage.js` conserva progreso, tiempo de sesión, documentos y colecciones
consultados por día. La portada muestra «Continúa leyendo» y «Tu Atlas» resume la
actividad diaria. Salir del lector guarda la posición y el tiempo acumulado.

### Exploradores

- `#/timeline`: línea temporal interactiva a partir de fechas explícitas.
- `#/map`: seis lugares históricos con fuentes relacionadas.
- `#/graph`: grafo general o centrado en un documento mediante `?focus={id}`.
- `#/guide`: orientador «¿Dónde debería buscar esto?»; no responde
  doctrinalmente y permite lanzar la búsqueda textual completa.

### Shorts

Atlas genera 507 piezas verificables con varios tratamientos visuales:
documento, autor, cronología, curiosidad, pregunta, quiz y advertencia. El feed
solo mantiene lotes pequeños en el DOM, añade más al acercarse al final y rota el
orden diariamente. Los elementos vistos se registran localmente para permitir
el filtro de contenido nuevo.

### Canales editoriales

`#/sources` reúne cuatro pestañas: noticias, opinión y recursos, oración, y
novedades editoriales. Cada tarjeta identifica claramente que se abandona Atlas
y abre el sitio original en una pestaña separada.

### Notificaciones

`#/notifications` permite activar por separado selección diaria, continuidad de
lectura, fuentes editoriales, rutas y actualizaciones. Los permisos se solicitan
solo al activar una opción. La selección diaria puede crear una notificación del
navegador una vez por fecha; el resto queda preparado como preferencia local
para una futura infraestructura de _push_.

### Nombres oficiales y preguntas

La interfaz utiliza:

- Doctrina y Moral;
- CanonIA;
- HistorIA de la Iglesia y los Padres;
- LiturgIA.

Cada biblioteca contiene 20 preguntas editoriales sugeridas. Estas preguntas
orientan la consulta y también alimentan la guía de navegación, pero no se
presentan como respuestas.

## 27. Atlas 3.1: base documental y tarjetas editoriales

### La carpeta es la base de datos

`build-data.mjs` enumera directamente todos los `.md` de las cuatro carpetas IA.
El índice conserva su utilidad para categorías, advertencias y mapas temáticos,
pero un Markdown nuevo aparece automáticamente aunque todavía no figure en él.

Se excluyen únicamente los archivos de índice, instrucciones de personalización
y listas de incorporaciones futuras. Si se elimina un documento de la carpeta,
deja de formar parte de la siguiente generación.

Un documento nuevo puede declarar:

```yaml
---
title: "Título"
category: "Categoría"
author: "Autor opcional"
year: 2026
language: "Español"
status: "not-stated"
authority: "Según género documental"
---
```

Todos los campos son opcionales. Sin ellos, Atlas deriva el título del primer
encabezado o del nombre de archivo, cuenta las palabras y utiliza la categoría
«Nuevos documentos».

### Actualizador único

[`ACTUALIZAR_ATLAS.cmd`](../ACTUALIZAR_ATLAS.cmd) ejecuta
`generators/update-all.mjs`, que coordina catálogo, lector, búsqueda de texto
completo y tarjetas externas. Nunca es necesario copiar un documento a
`atlas/data/documents`: esa carpeta es una salida generada.

### Base editorial externa

`content/external-items.json` es la base sencilla para noticias, oración y
nuevas lecturas. Cada registro necesita una URL, un tipo y un nombre de fuente.
`build-external-content.mjs` intenta obtener automáticamente título, entradilla,
imagen, autor y fecha mediante los metadatos de la página original.

La salida permite mostrar tarjetas con imagen, categoría, título, entradilla,
autor, fecha y enlace. Si un sitio bloquea la consulta o no publica fotografía,
Atlas presenta una cubierta editorial identificada, sin atribuir una imagen que
no proceda de la fuente.

### Feed mixto

Descubrir intercala una tarjeta externa cada cinco piezas documentales. Incluye
filtros para noticias, lecturas, oración, frases, hechos, anécdotas, documentos,
autores, cronologías y las cuatro IA. Las frases y hechos editoriales declaran
su referencia; las tarjetas generadas se limitan a metadatos verificables.

## 28. Atlas 3.2: servicio local y Gestor Atlas

### Arquitectura

Atlas funciona ahora con una arquitectura equivalente a una aplicación y un
SGBD documental:

```text
carpetas Markdown
        ↓
atlas/server.mjs
        ↓
generadores e índices derivados
        ↓
API local /api/*
        ↓
Atlas + Gestor Atlas
```

Los Markdown siguen siendo la única fuente documental. Los JSON, índices y
fragmentos del lector son vistas derivadas que pueden reconstruirse.

### Arranque

`INICIAR_ATLAS.cmd` inicia `server.mjs` en `127.0.0.1:8765`. El servicio calcula
una huella con nombres, tamaños y fechas de modificación de todos los Markdown,
el registro de bibliotecas y los enriquecimientos editoriales. Solo reconstruye
los 39 millones de palabras cuando la huella cambia. Las fuentes externas se
consultan en cada arranque.

Mientras se está reconstruyendo, la portada muestra una pantalla de espera y se
recarga automáticamente. El Gestor permanece accesible.

### Gestor Atlas

`GESTOR_ATLAS.cmd` abre `http://127.0.0.1:8765/gestor/`. Sus módulos son:

- Documentos: carga Markdown, añade metadatos, asigna el siguiente número y
  genera un nombre seguro.
- Duplicados: compara títulos normalizados y hashes SHA-256.
- Bibliotecas IA: registra una IA, crea su carpeta numerada y un índice base.
- Shorts y frases: edita el enriquecimiento editorial.
- Noticias y lecturas: mantiene URLs y fuerza una consulta de metadatos.

Las eliminaciones requieren confirmación y no permiten borrar índices ni
instrucciones protegidas.

### API local

Las rutas principales son:

```text
GET  /api/status
GET  /api/files?library={id}
GET  /api/duplicates
POST /api/upload
POST /api/delete
GET  /api/libraries
POST /api/libraries
GET  /api/shorts
POST /api/shorts
GET  /api/external
POST /api/external
POST /api/rebuild
POST /api/refresh-external
```

El servidor escucha únicamente en la interfaz local. No expone la gestión
documental a la red.

### Bibliotecas dinámicas

`content/libraries.json` contiene identidad, carpeta, inicial, color, enlace de
NotebookLM y descripción. Las carpetas adicionales con patrón `NN_IA_*` se
descubren aunque aún no estén registradas. La portada, el explorador, el
comparador, las estadísticas, el grafo y los filtros de Shorts consumen el
catálogo generado, no una lista HTML fija.

### Actualidad aleatoria

`content/external-feeds.json` define fuentes RSS. Al arrancar, Atlas descarga el
feed, baraja sus entradas y selecciona la cantidad configurada. Después consulta
los artículos elegidos para obtener título, entradilla, autor, fecha e imagen.
`external-items.json` conserva oración, editoriales o enlaces manuales que deben
permanecer disponibles.

### Esquema lector y orientación

El índice del lector convierte los niveles `#`, `##`, `###` y `####` en un árbol
de ramas desplegables. El buscador incorpora «¿A qué IA debería preguntar?»:
traslada el texto escrito al navegador de Atlas, pondera documentos y preguntas
editoriales y recomienda dónde comenzar sin formular doctrina.

## 29. Modo administrador de bibliotecas IA

El apartado **Bibliotecas IA** del Gestor permite administrar el registro sin
editar manualmente archivos JSON:

- crear una IA, su carpeta numerada y su índice documental;
- cambiar el nombre visible, inicial, color, descripción y enlace de NotebookLM;
- consultar el nombre físico de la carpeta y su número de documentos;
- eliminar una IA y su carpeta cuando ya no deba formar parte de Atlas.

El identificador interno y el nombre físico de una biblioteca existente no se
renombran al editarla. De este modo, los enlaces, documentos y datos locales
siguen apuntando a la misma entidad.

La eliminación es deliberadamente estricta:

1. muestra cuántos documentos se van a borrar;
2. exige escribir el nombre visible completo;
3. solicita una segunda confirmación;
4. el servidor vuelve a validar el nombre y la autorización;
5. Atlas impide eliminar la última biblioteca disponible.

Después de crear, editar o eliminar una IA, el Gestor reconstruye las vistas
derivadas y vuelve a cargar los selectores y recuentos. Las rutas administrativas
correspondientes son:

```text
POST   /api/libraries
PATCH  /api/libraries/{id}
DELETE /api/libraries/{id}
```

## 30. Carga múltiple y feed editorial 3.3

El selector del Gestor acepta hasta 100 Markdown simultáneos. Todos reciben la
misma biblioteca y los metadatos comunes que indique el administrador, pero
mantienen su título individual a partir del frontmatter o del nombre original.

`POST /api/upload-batch` elimina frontmatter, comentarios y diferencias
irrelevantes de espacios antes de calcular la huella del contenido. Compara
títulos y huellas tanto con las fuentes existentes como entre las obras del
propio lote. Devuelve por separado `created` y `rejected` y ejecuta una única
reconstrucción al terminar.

`GET /api/files` consulta directamente los Markdown de la carpeta seleccionada.
Por ello, una obra recién subida aparece en el Gestor antes de regenerar el
catálogo general.

El lector 3.3 interpreta tablas, encabezados Setext, imágenes remotas, tareas,
citas de varias líneas, tachado, negrita, cursiva, enlaces, saltos y código
cercado. El HTML incluido dentro de un Markdown no se ejecuta.

## 31. Frases, infografías, vídeo y música 3.7

`generators/build-quotes.mjs` une `frases.md` y `frases copy.md`, normaliza y
elimina duplicados. Las exclusiones se revisan en
`content/quote-policy.json`; el criterio no descarta autores por su identidad.

Las tarjetas explican «¿Para qué sirve?» cada IA y ofrecen ejemplos. El
tutorial muestra las nueve infografías completas desde la ruta segura
`/infografias/`.

`content/youtube-shorts.json` distingue canales `main` y `reserve`. La reserva
está apagada por defecto y, al activarla, se limita a dos incorporaciones por
lote. `GET /api/youtube-shorts` devuelve primero la caché y actualiza en segundo
plano, con siete conexiones simultáneas como máximo.

`content/youtube-music.json` define nueve canales. `GET /api/music` alimenta la
sección `#/music` y el filtro Música de Descubrir usando el reproductor oficial
integrado. `generators/build-youtube-music.mjs` mantiene una reserva local.

EUNSA y Encuentro disponen de extracción específica de novedades. San Pablo y
Alianza se incorporan como fuentes enriquecibles. Si una web falla, el
generador conserva imágenes y metadatos válidos de la generación anterior.

El observador de Shorts anima la tarjeta activa y transfiere gradualmente su
color luminoso al fondo. El service worker no almacena rutas `/api/`, de modo
que vídeo, música y actualidad no quedan congelados.

## 32. Guías visuales y mezcla dinámica 3.8

`generators/sync-infographics.mjs` copia de forma mecánica las nueve piezas de
`infografiasfinal` a `assets/infografias`. Esto permite mostrarlas en el
tutorial, Inicio y `#/infographics` sin depender de una ruta externa al
directorio de Atlas. La actualización general vuelve a sincronizarlas.

El tutorial incorpora 29 pasos, barra de progreso, capítulos específicos para
cada IA, galería visual y música. Las vistas previas se acompañan de un resumen
operativo y ejemplos; el enlace completo conserva el HTML original.

Las frases de `frases copy.md` toman el autor del encabezado y la obra de la
atribución. El generador elimina sintaxis Markdown y referencias auxiliares,
por lo que los Shorts muestran autor y obra sin asteriscos.

Las APIs de vídeo y música aceptan `seed`. Cada apertura genera una semilla
nueva y mantiene un orden aleatorio coherente durante la paginación. La música
prefiere el feed de publicaciones de cada uno de los nueve canales y actualiza
en segundo plano cuando solo existe la reserva local.

Las transiciones usan View Transitions cuando están disponibles y una animación
CSS breve como alternativa. En Descubrir, el texto de la tarjeta anterior sale
hacia arriba, el siguiente entra desde abajo y el foco luminoso cambia de color
y posición.

## 33. Compatibilidad musical y composición visual 3.9

La interfaz intenta primero `GET /api/music`. Si el proceso local aún corresponde
a una versión anterior y devuelve 404, carga inmediatamente
`data/youtube-music-cache.json`. Así la sección, los 19 temas de reserva y los
nueve canales permanecen habilitados sin exigir reiniciar el servidor. Al
reiniciarlo más adelante, la API dinámica sustituye progresivamente esa reserva.

El desplazamiento de Descubrir calcula continuamente la fracción entre la
tarjeta actual y la siguiente. Con ella interpola RGB, posición X/Y y escala de
dos manchas luminosas desenfocadas. Seis geometrías de tarjeta aportan variedad
sin romper la continuidad. La inserción de vídeos y canciones utiliza el mismo
lote ya barajado que se representa en pantalla.

El tutorial ya no incrusta la pieza vertical completa dentro de un paso. Cada IA
dispone de un resumen compacto con identidad propia, finalidad, ejemplos y
volumen documental. «Componer infografía completa» abre una capa cinematográfica:
seis fragmentos coloreados convergen, aparece la marca de la IA y la composición
se aparta para revelar el HTML original a pantalla completa.

`content/external-feeds.json` configura RSS de actualidad, Recursos de Omnes,
libros individuales de Rialp y Palabra y puntos aleatorios en español de la API
de escriva.org. `content/prayer-series.json` mantiene la serie «Como en una
película». Todo se mezcla al azar en cada apertura de Descubrir.
