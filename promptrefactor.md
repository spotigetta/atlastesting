# Prompt maestro para refactorizar Atlas como PWA dinámica en GitHub Pages

Actúa como arquitecto de software y desarrollador principal de Atlas. Trabaja sobre la aplicación local existente y adapta su arquitectura para que GitHub Pages sea el servidor público de la PWA y GitHub Actions construya, actualice los datos externos y despliegue cada nueva versión.

No rediseñes Atlas ni sustituyas la aplicación por otra. Conserva sus funcionalidades, contenidos, estilo visual, animaciones, rutas, navegación, lector, buscador, Shorts, mapas, estadísticas, infografías, tutorial, configuración, guardados y comportamiento general. La intervención debe concentrarse en la arquitectura, el esqueleto, las rutas, la construcción, los datos, la sincronización, la caché y el despliegue.

No hagas una reescritura ciega. Antes de modificar archivos, inspecciona el repositorio, documenta el flujo actual y crea un plan de migración incremental. Implementa después el plan completo, valida la paridad visual y funcional en cada fase y no des por terminada la tarea mientras queden rutas rotas, datos duplicados, archivos huérfanos o funciones públicas que dependan del servidor local.

### Límite de actuación

Todo el trabajo debe realizarse exclusivamente en la copia local del proyecto.

La IA debe:

- reorganizar y adaptar los archivos locales;
- crear scripts, configuración, workflows y documentación;
- construir y validar localmente;
- simular o comprobar el despliegue sin publicarlo;
- dejar el proyecto listo para que su propietario lo suba.

La IA no debe:

- iniciar sesión en GitHub;
- crear o configurar el repositorio remoto;
- crear ramas remotas;
- hacer `commit`, `push`, pull requests o releases;
- activar GitHub Pages;
- ejecutar un despliegue público;
- solicitar tokens o credenciales;
- subir ningún archivo fuera del equipo local.

El propietario será quien suba el proyecto preparado a GitHub. Después de esa primera subida, los workflows incluidos podrán construir y desplegar automáticamente si el propietario habilita GitHub Pages y concede los permisos necesarios.

## 1. Contexto actual que debes tener en cuenta

Atlas consta actualmente de:

- una SPA/PWA sin framework, servida desde `atlas/index.html`;
- módulos JavaScript en `atlas/scripts`;
- estilos en `atlas/styles`;
- fuentes documentales Markdown situadas en carpetas hermanas con formato `NN_IA_Nombre`;
- configuración editorial en `atlas/content`;
- datos derivados en `atlas/data`;
- generadores Node en `atlas/generators`;
- un servidor local `atlas/server.mjs`;
- un Gestor en `atlas/gestor` que consume rutas `/api/*` del servidor;
- un lector que carga un archivo JavaScript generado por documento;
- un índice invertido de texto completo generado como un único JavaScript;
- contenidos externos obtenidos desde YouTube, música, Instagram, medios, editoriales y escriva.org.

La carpeta documental debe seguir siendo la fuente de verdad. Añadir, modificar o quitar una carpeta `NN_IA_Nombre` o un Markdown válido debe reflejarse automáticamente en Atlas después de validar y construir.

Problemas conocidos que debes resolver:

- GitHub Pages no ejecuta Node ni admite endpoints `/api/*`.
- El Gestor actual solo funciona junto a `server.mjs` y escribe directamente en el disco.
- Hay datos derivados duplicados en `.json` y `.js`.
- La versión se repite manualmente en varios archivos.
- `data/documents` conserva archivos antiguos: hay más archivos generados que documentos activos.
- El índice de texto completo es un único archivo de unos 33 MB.
- Los documentos de lectura suman cientos de MB y más de mil archivos.
- Las rutas absolutas `/api/...` y `/data/...` fallan cuando la app se publica en el subdirectorio de un repositorio de GitHub Pages.
- El Service Worker mezcla estrategias de caché y provoca riesgo de datos obsoletos.
- El código del Gestor contiene cadenas con problemas de codificación.
- El feed de Shorts agrupa elementos por tipo y concatena los grupos, lo que produce rachas de muchos vídeos.
- Los proveedores externos tienen CORS, cuotas, bloqueos y requisitos de autenticación diferentes.

## 2. Objetivo

Adaptar la aplicación local actual a una PWA publicada directamente desde GitHub Pages, de manera que:

1. el proyecto local quede preparado para que el código fuente y los contenidos editables vivan en una rama principal;
2. la documentación explique cómo abrir una rama de refactorización sin alterar la versión estable;
3. cada mejora futura pueda desarrollarse en su propia rama después de que el propietario suba el repositorio;
4. al fusionar posteriormente una actualización en la rama principal, GitHub Actions valide y construya Atlas;
5. GitHub Actions despliegue el resultado en la rama `gh-pages`;
6. GitHub Pages sirva esa rama como aplicación pública;
7. los usuarios reciban la última versión publicada mediante el mecanismo de actualización de la PWA;
8. la aplicación pueda seguir ejecutándose localmente con uno o dos comandos claros;
9. exista una única fuente de verdad para cada clase de contenido;
10. las bibliotecas y documentos nuevos se detecten automáticamente;
11. el Gestor permita actualizar las fuentes sin editar archivos generados;
12. los datos estáticos sean optimizados y reproducibles;
13. GitHub Actions consulte y actualice los contenidos externos;
14. el feed sea aleatorio, equilibrado y sin rachas;
15. se conserven todas las funcionalidades y el estilo actuales.

### Condición de paridad estricta

Antes de refactorizar, crea un inventario de:

- todas las rutas y pantallas;
- todos los botones y acciones;
- configuración disponible;
- comportamiento de escritorio y móvil;
- animaciones y transiciones;
- fuentes de datos;
- funciones del lector;
- funciones del Gestor;
- estados offline;
- apariencia de los Shorts;
- integraciones externas.

Captura referencias visuales de las pantallas principales y crea pruebas de paridad. La nueva arquitectura no autoriza a simplificar, eliminar o rediseñar funciones. Si una función necesita otra implementación para funcionar en GitHub Pages, conserva su interfaz y resultado observable.

## 3. Restricción fundamental de GitHub Pages

GitHub Pages será el servidor web público de Atlas. Servirá HTML, CSS, JavaScript, imágenes, manifiestos, catálogos, documentos e índices generados desde la rama `gh-pages`.

GitHub Pages no ejecuta Node en cada petición ni ofrece una base de datos o endpoints propios. Por eso, usa GitHub Actions como backend de construcción y actualización diferida. Separa:

- **Rama principal:** código fuente, configuración y contenidos editables.
- **Ramas de trabajo:** refactorización y mejoras futuras.
- **GitHub Actions:** validación, generación, consulta de APIs, construcción y despliegue.
- **Rama `gh-pages`:** resultado público generado; nunca se edita manualmente.
- **GitHub Pages:** servidor estático de la PWA.
- **Gestor:** modifica las fuentes de verdad localmente o mediante commits/pull requests.
- **PWA pública:** consume los artefactos de `gh-pages` y actualiza su caché cuando cambia el manifiesto de versión.

El flujo principal de contenidos externos será:

```text
GitHub Action programada o manual
→ consulta API/feed
→ normaliza y valida
→ conserva el último snapshot válido
→ construye Atlas
→ despliega en gh-pages
→ GitHub Pages sirve la actualización
→ la PWA detecta una versión nueva
```

Configura Actions programadas y también ejecutables mediante `workflow_dispatch`. Si una API admite CORS, no necesita secretos y aporta valor en directo, la PWA puede consultarla adicionalmente, pero siempre debe disponer del snapshot publicado por Actions como respaldo.

Nunca expongas claves privadas en el navegador. “Actualizar al refrescar” debe significar que la PWA solicita sin caché el manifiesto y los snapshots más recientes que GitHub Pages tenga publicados. GitHub Actions no se ejecuta por cada visita pública: se ejecuta por horario, manualmente o tras un cambio en el repositorio. Documenta con claridad esta diferencia.

## 4. Arquitectura de destino

Organiza el repositorio con responsabilidades claras. Puedes adaptar nombres si justificas el cambio:

```text
/
├─ source/
│  ├─ libraries/                 # Carpetas NN_IA_Nombre o enlaces a ellas
│  ├─ editorial/                 # Shorts, frases, preguntas, rutas, colecciones
│  ├─ providers/                 # Canales, feeds, cuentas y políticas
│  └─ assets/
├─ schemas/                      # JSON Schema o validadores equivalentes
├─ app/                          # Código fuente de la PWA pública
├─ manager/                      # Interfaz gestora
├─ tools/                        # Importación, reparación, migración y validación
├─ generated/                    # Trabajo temporal ignorado por Git
├─ dist/                         # Salida estática reproducible, no editada a mano
├─ tests/
└─ .github/workflows/
```

Mantén las carpetas originales si moverlas introduce demasiado riesgo, pero aplica la misma separación conceptual.

### Estrategia de ramas preparada para el propietario

Prepara el proyecto y documenta esta estrategia, pero no crees ni publiques ramas remotas:

```text
main
├─ fuente estable y editable de Atlas
├─ contenidos
├─ Gestor
└─ configuración

refactor/github-pages-pwa
└─ adaptación inicial de arquitectura, revisable antes de fusionar

feature/*
└─ mejoras futuras aisladas

gh-pages
└─ salida pública generada automáticamente desde dist
```

Proceso de actualización:

1. el propietario sube inicialmente el proyecto preparado;
2. el propietario configura GitHub Pages y los permisos indicados en la guía;
3. para una mejora posterior, crea una rama `feature/...`;
4. realiza cambios o añade contenidos;
5. valida mediante Actions;
6. revisa y fusiona en `main`;
7. Actions construye automáticamente;
8. Actions despliega `dist` en `gh-pages`;
9. GitHub Pages publica la actualización;
10. se incrementa automáticamente la versión o hash de construcción;
11. las PWA instaladas reciben el aviso de actualización.

No copies manualmente toda la aplicación para crear una versión nueva. Git conserva el historial mediante commits, ramas, pull requests y etiquetas. La rama `gh-pages` debe reflejar siempre la última versión pública válida.

### Fuente de verdad

Define una sola fuente editable para:

- bibliotecas;
- documentos;
- metadatos;
- frases;
- Shorts editoriales;
- proveedores y canales;
- colecciones;
- rutas;
- preguntas;
- infografías;
- ajustes de publicación.

Los archivos de `dist` y los catálogos derivados nunca deben editarse desde el Gestor.

### Modelo de datos

Diseña un esquema normalizado y documentado con identificadores estables:

- `Library`
- `Document`
- `DocumentChunk`
- `Author`
- `Category`
- `Collection`
- `Route`
- `Short`
- `ExternalProvider`
- `ExternalItem`
- `Relation`
- `Infographic`
- `BuildManifest`

Cada entidad debe incluir `id`, versión de esquema, fechas relevantes, procedencia y estado de validación cuando corresponda.

No uses el nombre del archivo completo como identidad permanente. Genera un ID estable y conserva por separado la ruta física.

### SGBD sencillo

Implementa una capa de repositorio con una API interna común, por ejemplo:

```js
repository.libraries.list()
repository.documents.search(query, filters)
repository.documents.get(id)
repository.shorts.sample(options)
repository.providers.status()
repository.maintenance.findDuplicates()
```

La implementación editable puede usar SQLite local en las herramientas y el Gestor, siempre que:

- los Markdown continúen siendo portables y recuperables;
- exista importación y exportación determinista;
- la base no se convierta en una caja negra;
- las migraciones estén versionadas;
- se puedan reparar índices y regenerar todo desde las fuentes.

Para la PWA estática, exporta datos optimizados y segmentados. No obligues al navegador a descargar una base de cientos de MB al arrancar.

Usa:

- un manifiesto pequeño inicial;
- catálogos por biblioteca;
- índices de búsqueda segmentados por biblioteca o por prefijo;
- carga diferida del documento solicitado;
- caché en IndexedDB para datos grandes;
- Cache Storage para el shell y recursos pequeños.

Evita un único índice de 33 MB y evita un archivo JavaScript global por cada documento si existe una alternativa JSON/Markdown más limpia. Si conservas un archivo por documento, que sea una decisión medida y no una limitación del diseño.

## 5. Pipeline único de construcción

Crea un comando principal, por ejemplo:

```bash
npm install
npm run dev
npm run build
npm run validate
npm run manager
```

Añade `package.json` y fija versiones de dependencias. El comando `build` debe:

1. descubrir las carpetas `NN_IA_*`;
2. validar nombres, frontmatter y codificación UTF-8;
3. normalizar metadatos;
4. detectar duplicados exactos, títulos similares y IDs repetidos;
5. construir relaciones, colecciones, rutas, estadísticas y cronología;
6. generar contenido del lector;
7. generar índices de búsqueda segmentados;
8. incorporar snapshots externos válidos;
9. copiar recursos e infografías;
10. crear un único manifiesto de versión;
11. eliminar primero la salida temporal anterior;
12. construir en un directorio temporal;
13. validar;
14. sustituir `dist` de forma atómica.

La construcción debe ser determinista: con las mismas fuentes debe producir el mismo contenido, salvo campos explícitos de fecha de construcción.

Nunca dejes archivos huérfanos. Incluye una comprobación que compare exactamente:

- documentos del catálogo;
- documentos de lectura generados;
- entradas del índice;
- archivos físicos publicados.

Falla la construcción si los recuentos o IDs no coinciden.

## 6. GitHub Actions y despliegue

Prepara localmente:

- workflow de validación para cada `push` y `pull_request`;
- workflow de construcción al fusionar o hacer `push` en `main`;
- workflow de despliegue automático de `dist` en la rama `gh-pages`;
- configuración de GitHub Pages para servir la rama `gh-pages`;
- workflow programado para consultar APIs y actualizar snapshots externos;
- ejecución manual `workflow_dispatch`;
- caché de dependencias;
- publicación del contenido de `dist`, no del árbol de trabajo completo.

No ejecutes estos workflows contra GitHub ni intentes publicar el proyecto. Valida localmente su sintaxis, rutas, permisos declarados y comandos. Entrega instrucciones exactas para que el propietario:

1. cree o elija su repositorio;
2. suba el proyecto;
3. habilite Actions;
4. habilite GitHub Pages;
5. seleccione la fuente o workflow adecuado;
6. compruebe el primer despliegue;
7. revierta una publicación si fuera necesario.

El workflow externo debe poder:

1. consultar proveedores;
2. actualizar únicamente snapshots válidos;
3. crear un commit automático identificable;
4. reconstruir Atlas;
5. validar el resultado;
6. desplegarlo en `gh-pages`;
7. conservar el despliegue anterior si falla cualquier fase.

Evita bucles de workflows producidos por commits automáticos. Usa permisos mínimos y separa los trabajos de actualización, construcción y despliegue.

El despliegue público debe funcionar directamente bajo:

```text
https://USUARIO.github.io/REPOSITORIO/
```

Centraliza el `basePath`. No debe quedar ninguna ruta de aplicación dependiente de `/api`, `/data` o `/assets` desde la raíz del dominio.

Todos los recursos deben resolverse con respecto al subdirectorio del repositorio. El mismo código debe funcionar:

- en desarrollo local;
- en una vista previa de una rama;
- en `https://USUARIO.github.io/REPOSITORIO/`;
- como PWA instalada.

Incluye un informe de construcción descargable con:

- versión;
- bibliotecas;
- documentos;
- tamaño;
- duplicados;
- advertencias;
- proveedores externos;
- elementos añadidos, modificados y eliminados.

## 7. Gestor de Atlas

Conserva una interfaz visual sencilla, pero sepárala de la app pública.

Debe ofrecer:

- panel general y estado de publicación;
- crear, editar, reordenar, activar, desactivar y eliminar bibliotecas;
- detección automática de una carpeta `NN_IA_*`;
- subida múltiple mediante arrastrar y soltar;
- previsualización del nombre final y del frontmatter;
- numeración automática sin colisiones;
- editor de metadatos;
- validación antes de guardar;
- detección de duplicados exactos y similares;
- comparación entre dos documentos;
- renombrado seguro conservando el ID;
- mover documentos entre bibliotecas;
- eliminación con papelera o posibilidad de deshacer;
- edición estructurada de Shorts, frases, preguntas y contenido externo;
- gestión de canales y proveedores;
- activar o desactivar canales, series y cuentas;
- consulta manual de proveedores;
- vista previa del feed resultante;
- informe de errores y reparaciones propuestas;
- botón “Construir”;
- botón “Validar”;
- botón “Publicar” con confirmación;
- historial de cambios;
- exportación y copia de seguridad.

Implementa dos modos si resulta necesario:

### Modo local recomendado

Una pequeña aplicación Node local o una PWA con File System Access API abre la carpeta del repositorio y escribe directamente en las fuentes. Debe funcionar sin copiar archivos manualmente.

### Modo GitHub opcional

Deja preparado, pero no conectado, un modo futuro en el que el Gestor pueda autenticarse mediante un mecanismo seguro y crear una rama, commits o pull requests mediante GitHub. No solicites ni configures tokens durante esta refactorización. No almacenes tokens en el repositorio ni los envíes a la app pública. Prioriza pull requests revisables frente a escrituras destructivas directas.

El Gestor no debe escribir en `gh-pages`. Debe modificar las fuentes de una rama de trabajo o de `main`; GitHub Actions será el único responsable de generar y publicar `gh-pages`.

El Gestor debe mostrar claramente si un cambio está:

- solo en borrador;
- guardado en fuentes;
- validado;
- pendiente de construir;
- publicado.

## 8. Proveedores y actualización externa

Crea una interfaz común:

```js
provider.fetch()
provider.normalize()
provider.validate()
provider.dedupe()
provider.snapshot()
provider.health()
```

Implementa adaptadores separados para:

- YouTube;
- música de YouTube;
- Instagram;
- noticias;
- editoriales y lecturas;
- oración;
- frases de san Josemaría.

Cada elemento externo debe guardar:

- ID estable del proveedor;
- URL canónica;
- tipo;
- título;
- autor o canal;
- imagen;
- fecha de publicación;
- fecha de consulta;
- biblioteca relacionada;
- estado;
- hash para duplicados;
- snapshot de procedencia.

Requisitos:

- actualización programada mediante GitHub Actions;
- actualización manual desde Actions o desde una operación autorizada del Gestor;
- consulta directa al recargar solo cuando el proveedor permita CORS y no requiera secretos;
- descarga sin caché del último snapshot publicado al refrescar la PWA;
- parámetro de refresco real, sin depender de la caché HTTP;
- timeout corto;
- actualización en segundo plano;
- fallback inmediato al último snapshot;
- no bloquear la interfaz;
- no repetir elementos;
- respetar canales desactivados;
- registrar errores por proveedor;
- conservar el último snapshot válido si una consulta devuelve cero elementos por error;
- límites de concurrencia y reintentos con backoff;
- indicador visible de frescura.

No presentes Instagram scraping como una API garantizada. Implementa degradación elegante y documenta sus límites.

## 9. Shorts aleatorios y equilibrados

Sustituye la agrupación y concatenación por un mezclador con restricciones.

El algoritmo debe:

- crear una semilla nueva en cada recarga manual;
- aleatorizar también cada lote infinito;
- mezclar tipos, no solo elementos dentro de cada tipo;
- impedir más de dos tarjetas consecutivas del mismo tipo;
- impedir más de dos tarjetas consecutivas del mismo proveedor o canal;
- evitar repetir un ID durante la sesión;
- recordar localmente una ventana de elementos recientes;
- reducir el peso de obras y vídeos;
- aumentar variedad de frases, hechos, anécdotas, preguntas, oración, noticias y lecturas;
- admitir pesos configurables desde el Gestor;
- seguir funcionando cuando un tipo tenga pocos elementos;
- insertar contenidos en directo sin añadirlos como un bloque al final;
- aplicar una mezcla incremental compatible con feed infinito.

Usa un “constrained weighted shuffle” o bolsas ponderadas por tipo. Añade pruebas estadísticas:

- distribución por tipo en 100, 1.000 y 10.000 selecciones;
- longitud máxima de racha;
- ausencia de duplicados en una sesión;
- respeto de canales desactivados;
- variación entre dos recargas.

## 10. PWA, caché y actualización

Usa un único origen de versión generado automáticamente.

El Service Worker debe:

- precachear solo el shell mínimo;
- no intentar precachear cientos de MB;
- usar `stale-while-revalidate` para catálogos pequeños;
- usar `cache-first` con versionado de contenido para documentos inmutables;
- usar `network-first` con timeout para manifiestos de datos;
- limpiar versiones antiguas y documentos que ya no existan;
- soportar el subdirectorio de GitHub Pages;
- mostrar una actualización disponible sin recargar en bucle;
- mantener una experiencia offline útil.

IndexedDB debe almacenar:

- documentos abiertos recientemente;
- índices segmentados utilizados;
- favoritos;
- progreso;
- anotaciones;
- configuración;
- historial reciente del feed.

Incluye migraciones de almacenamiento local para no perder datos del usuario al cambiar de versión.

## 11. Calidad y seguridad

Añade:

- schemas y validación estricta;
- pruebas unitarias del parser, IDs, duplicados, mezcla y rutas;
- pruebas de integración del pipeline;
- prueba end-to-end de lectura, búsqueda y Gestor;
- auditoría de enlaces y assets;
- control de tamaños máximos;
- sanitización segura del Markdown;
- protección frente a path traversal;
- escrituras atómicas;
- copias de seguridad antes de operaciones destructivas;
- codificación UTF-8 comprobada;
- logs legibles;
- errores mostrados al usuario sin bloquear indefinidamente.

No uses esperas ciegas ni servidores que puedan dejar el proceso colgado. Todo proceso externo debe tener timeout, salida progresiva y cancelación.

## 12. Migración incremental

Ejecuta la reforma en fases:

1. conservar intacta una copia local estable y documentar cómo podría crearse después la rama `refactor/github-pages-pwa`;
2. documentar y congelar el comportamiento actual;
3. introducir schemas y repositorios sin cambiar la interfaz;
4. crear el pipeline único y limpiar salidas;
5. migrar rutas y base path;
6. segmentar lector e índice;
7. desacoplar el Gestor de la aplicación pública;
8. crear adaptadores externos y snapshots gestionados por Actions;
9. reemplazar internamente el mezclador de Shorts sin alterar su diseño;
10. configurar la PWA, `gh-pages` y GitHub Actions;
11. construir una vista previa exclusivamente local y comprobar paridad;
12. preparar las instrucciones de subida y activación;
13. no fusionar, subir ni desplegar nada;
14. eliminar compatibilidad antigua solo después de verificar localmente la salida preparada.

En cada fase:

- conserva una ruta de reversión;
- ejecuta pruebas;
- documenta archivos modificados;
- mide tamaño y rendimiento;
- no borres fuentes originales.

## 13. Criterios de aceptación

La tarea solo está completa si:

- `npm run build` genera Atlas desde cero;
- `npm run validate` termina sin errores;
- la salida no contiene archivos huérfanos;
- el número de documentos coincide en catálogo, lector e índice;
- existe documentación para que el propietario cree una rama de refactorización revisable;
- el proyecto queda preparado para mejoras futuras mediante ramas `feature/*`;
- los workflows están listos para que un futuro `push` o fusión en `main` active validación, construcción y despliegue;
- el workflow está preparado para publicar `dist` en `gh-pages`;
- la salida local simula correctamente lo que GitHub Pages servirá desde `gh-pages`;
- la PWA pública detecta y aplica una versión nueva;
- todas las rutas funcionan bajo el subdirectorio del repositorio;
- la app pública no necesita `server.mjs`;
- el aspecto y las funcionalidades públicas coinciden con la aplicación anterior;
- el Gestor puede añadir una biblioteca y varios Markdown sin editar JSON o HTML manualmente;
- el siguiente build incorpora y elimina esos cambios;
- los duplicados se detectan antes de publicar;
- el feed no presenta rachas superiores a dos elementos del mismo tipo cuando existe diversidad suficiente;
- dos recargas producen órdenes diferentes;
- los contenidos externos se actualizan mediante GitHub Actions y snapshots publicados, con consulta directa opcional cuando sea segura;
- la caída de un proveedor no rompe Descubrir;
- lectura, búsqueda literal, anotaciones, guardados y modo offline siguen funcionando;
- existe documentación para usuario, administrador y desarrollador;
- se entrega un informe final con arquitectura anterior, arquitectura nueva, migraciones, riesgos pendientes y comandos de uso.
- no se ha realizado ninguna subida, autenticación, publicación ni cambio remoto.

## 14. Entregables

Entrega:

1. código refactorizado;
2. `ARCHITECTURE.md`;
3. `DATA_MODEL.md`;
4. `MANAGER_GUIDE.md`;
5. `DEPLOY_GITHUB_PAGES.md`;
6. schemas y migraciones;
7. workflows de GitHub Actions;
8. pruebas;
9. informe de auditoría de tamaños y huérfanos;
10. registro de decisiones arquitectónicas;
11. plan de reversión;
12. resumen final, breve y verificable;
13. una guía `SUBIR_A_GITHUB.md` con los únicos pasos que debe realizar el propietario;
14. una lista de comprobación previa a la subida;
15. una lista de comprobación posterior al primer despliegue.

Antes de comenzar a editar, presenta el diagnóstico, el inventario de paridad y el plan de preparación local. Después implementa de forma autónoma, comprobando cada fase. La prioridad es adaptar la aplicación anterior, no crear otra distinta. Si una operación dinámica no puede ejecutarse durante una visita porque GitHub Pages es estático, prepárala para ejecutarse mediante GitHub Actions y servirse desde `gh-pages`, sin eliminar ni falsear la funcionalidad visible. Finaliza cuando la carpeta local esté lista y documentada para que el propietario sea la única persona que realice la subida.
