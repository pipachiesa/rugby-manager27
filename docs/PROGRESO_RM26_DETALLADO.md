# Progreso del Rugby Manager

**Fecha de corte:** 10 de noviembre de 2026  
**Última actualización:** 12 de noviembre de 2026 (versión de datos 18)  
**Nombre provisional:** Tercer Tiempo  
**Proyecto:** RM26

## Objetivo

Crear un juego **web** de gestión de rugby argentino para jugar una liga privada online con amigos. Cada manager dirige un club real, con planteles y niveles diferentes. El foco inicial son el Top 14, Primera A y Primera B de la URBA; Regatas Bella Vista es un club prioritario. El rugby del Interior y otras regiones son una ampliación deseada.

La experiencia debe combinar preparación del plantel y táctica con una simulación de partidos y una repetición 2D. No se solicitó una aplicación para Mac: la entrega buscada es el sitio web.

## Forma de trabajo acordada

El agente principal coordina y delega, sin implementar directamente. Se prefiere Sol con razonamiento medio para tareas complejas y Terra con razonamiento alto para integración, trabajo repetitivo y validación. Esta distribución es una preferencia del proyecto para el trabajo futuro.

## Decisiones de diseño

- **Clubes y competencia:** usar clubes reales desiguales, con fixture 2026 de ida y vuelta de 26 fechas en las tres divisiones URBA.
- **Plantel superior:** Primera, Intermedia, Pre A y Pre B comparten jugadores. Las asignaciones a esos grupos en el juego son simuladas y no se presentan como nóminas oficiales.
- **Juveniles:** incluir M19 y M17; los juveniles ficticios usan nombres y apellidos ponderados por la información disponible de cada club.
- **Jugadores:** 26 atributos entre 1 y 20, perfiles según el puesto, potencial, entrenamiento y físico. Las valoraciones y el potencial son estimaciones de juego.
- **Identidades y edades:** utilizar jugadores reales solo con evidencia identificable. La edad se calcula para la fecha del mundo a partir de una fecha de nacimiento acreditada. Si no se conoce, se guarda como `null` y se muestra como desconocida; no se infiere por la categoría.
- **Edades estimadas (decisión del 10/11/2026):** cuando no hay fecha acreditada, se puede usar una fecha no acreditada como `estimatedBirthDate` (hoy: planteles ESPN/Datafactory, 76 jugadores). Se muestra como «~N», con `ageEstimated: true` y `ageKnown: false`, y nunca reemplaza una fecha acreditada. ESPN tuvo 7 discrepancias en 32 cruces con fuentes oficiales, por lo que no cuenta como acreditada. Ver `research/espn-planteles-2026.json`.
- **Trayectoria en Primera (decisión del 10/11/2026, corregida el 11/11/2026):** cada jugador documentado tiene `trajectory`, que cuenta las temporadas en Primera (Top 12/14 o Primera A) con formación publicada en 2019 y 2021–2026: siete temporadas posibles, porque 2020 no se jugó y 2016–2018 solo tienen playoffs de cinco clubes, así que ya no cuentan. Lo genera `scripts/apply-trajectory.mjs` con `research/history/player-trajectory.json`, `urba-lineups-primera-a.json` y el índice oficial de divisiones de la API del fixture URBA. Rótulos: 1 Debutante, 2–3 Joven, 4–5 Jugador de Primera, 6 Experimentado, 7 Veterano. Una temporada en la que el club jugó Primera A sin formaciones publicadas, o cuya división se desconoce, es «sin datos» (`unknownSeasons`) y no una ausencia; si esas temporadas pudieran cambiar el rótulo, se muestra «Historial incompleto» (hoy 491 de 1.052: casi todo La Plata, Los Tilos, Champagnat, Los Matreros, Atlético del Rosario y Primera A). Las temporadas de Primera B no cuentan como Primera: de 255 jugadores de Primera B, solo 8 tienen trayectoria. La etapa de carrera usa la edad (acreditada o estimada) si existe y, si no, la trayectoria completa: define el crecimiento durante la temporada y el declive físico (Veterano o 33+ años). `gameSeasons` guarda las temporadas ganadas en la partida. Es un piso: 2019 y 2022 cubren ~40 % de los partidos del Top 14. Cada trayectoria indica cuántas temporadas están confirmadas en planillas oficiales (URBA/ESPN) y cuántas solo por formaciones de prensa (Rugby Champagne); ver `research/history/player-trajectory-sources.md` y `primera-ab-sources-report.md`. Quedan sin sumar, a la espera de revisión manual, «A. Lamensa» (BA C&RC 2019, solo inicial) y Simón Prince (Primera B 2023 con Ciudad de Buenos Aires). Pablo/Paul Cardinal (Newman) y Juan Pedro/Juan Pablo Garoby (CUBA) se unificaron como alias el 10/11/2026.
- **Valoración individual (decisión del 11/11/2026):** las valoraciones ya no son el nivel del club más azar.
  - **Qué usa:** `scripts/apply-player-quality.mjs` escribe `players[].quality` en el catálogo, a partir de:
    - titularidades y dorsales en formaciones 2019–2026 (`numbersBySeason` de `player-trajectory.json`);
    - eventos ESPN 2024–25 (`scripts/build-player-stats.mjs` → `research/history/player-stats.json`, con el caché ya descargado): tries, patadas y tarjetas;
    - historial en selecciones y en el profesionalismo (`research/player-pedigree.json`: Pumas, Pumas 7, Argentina XV, Pampas y Super Rugby Americas, Jaguares, Europa, Pumitas).
  - **Cómo influye:**
    - las titularidades y la experiencia corren el nivel;
    - los eventos dan forma a los atributos: quien hace más tries gana velocidad y evasión, el pateador gana patada a los palos y quien acumula tarjetas pierde disciplina;
    - el historial fija un piso que mira el presente (Puma establecido 82, Puma con menos de 10 partidos 79; Jaguares 78; Europa 76; Pampas 72; Argentina XV 71; otro equipo del Super Rugby Americas y Pumas 7, 70). Baja 1,5 puntos por año:
      - desde la última vez en ese nivel; para los Pumas cuenta la última convocatoria (`research/pumas-last-caps.json`), y retirarse de los Pumas suma un año;
      - después de los 30 años.
    - una lesión larga en 2025–26 resta 3 puntos más, o 2 si ya volvió a jugar.
    - Ejemplos: Cordero 76, por su retiro de los Pumas en julio de 2025 y una lesión en octubre de 2025; Gutiérrez Taboada 75. En el mercado de regresos, el nivel de carrera baja 1,5 por año después de los 30 (Julián Montoya 82).
  - **Reparto en el club:** el club se queda con el 75 % de lo que suman los pisos (`PEDIGREE_SHARE`), porque en los resultados reales esos jugadores se perdían fechas con su franquicia; el resto se descuenta de sus compañeros.
  - **Puestos:** cada jugador juega solo en sus puestos; los secundarios salen de los dorsales (al menos 2 titularidades y 15 %). No hay penalización por jugar fuera de puesto porque no se permite. El XV automático elige al mejor de cada puesto (`autoLineup`).
  - **Ligas guardadas:** las versiones de datos 8 y 9 rehacen a los jugadores documentados, que pierden lo que mejoraron con el entrenamiento. La 9 también actualiza las fuerzas de los clubes y el mercado de regresos.
  - **Recalibración (11/11/2026):** nuevas fuerzas del Top 14: Newman 89, CASI 87, Alumni 82, SIC 82, Hindú 80, Los Tilos 78, Belgrano 78, Regatas 78, CUBA 78, BA C&RC 77, La Plata 76, Atlético del Rosario 69, Matreros 68, Champagnat 63. Resultado: localía +2,2, error medio 1,95, Newman–CASI 60 % y +5,5, SIC–CASI 57 % (real 43–56 %). Newman–Regatas da 78 % y CASI–Regatas 67 %, ambos debajo de lo real (82–96 % y 74–88 %). Detalle en `research/history/engine-check-quality.json`.
  - **Pendiente:** no se consultó www.espn.com.ar porque su robots.txt excluye a agentes de IA.
- **Lesiones y centro médico (decisión del 11/11/2026):**
  - **Frecuencia:** tras cada fecha, cada jugador que jugó puede lesionarse según 30 lesiones cada 1.000 horas de partido. La cifra sale del rugby amateur argentino (30,9) y del amateur inglés (CRISP, 29,2).
  - **Exposición y riesgo:** un titular cuenta 80 minutos y un suplente 25. El cansancio sube el riesgo.
  - **Tipos y bajas:** se toman de `research/injuries.json`. Solo están respaldadas las tasas generales y la proporción de conmociones; el resto son estimaciones documentadas.
  - **Reproducibilidad:** el resultado es determinista por semilla.
  - **Disponibilidad:** un lesionado no puede jugar. Si estaba en el XV, lo reemplaza el mejor disponible de su puesto (`effectiveLineup`), y `setLineup` lo rechaza. El receso cura 16 semanas.
  - **Novedades:** `world.news` guarda lesiones y altas. Se ven en Inicio («Novedades») y en la pantalla Médico, sin anticipar fechas cuya repetición está pendiente.
  - **Resultado medido:** unas 18–20 lesiones por club y temporada, con 3 lesionados a la vez de media.
- **Estado físico semanal (decisión del 11/11/2026):** entre fechas hay 7 días de descanso. Un partido cuesta 12 puntos (un suplente, 4) y la semana recupera el 60 % de lo que falta: quien juega todas las fechas queda cerca del 92 % (`simulateFixture`). Resultado medido: unas 17 lesiones por club y temporada.
- **Torneos paralelos (decisión del 11/11/2026):**
  - **Qué juegan:** Intermedia, Pre A, Pre B, M19 y M17 disputan cada fecha el mismo fixture que Primera: mismo rival y misma localía. Se simulan con la fuerza del plantel, sin motor ni repetición (`PARALLEL_CATEGORIES`, `playParallelRound` y `parallelStandings` en `web/domain.js`).
  - **Cómo se arma cada equipo:** en cada puesto juega el mejor disponible de su categoría. Quien queda fuera de los convocados de Primera baja a Intermedia, y a una categoría corta la completan las de abajo.
  - **Marcador:** la diferencia de nivel define los tries esperados (Poisson), con unos 48 puntos por partido.
  - **Datos:** los resultados se guardan en `world.parallel.results[fixtureId][categoría]`. Al cambiar de temporada se archivan los campeones (`world.parallel.champions`) y la tabla vuelve a cero.
  - **Reparto del plantel superior:** `assignSeniorGroups` pone el XV y a los 23 mejores en Primera, y reparte al resto en tercios entre Intermedia, Pre A y Pre B. Se aplica en las ligas nuevas, en la migración y en cada temporada; el manager puede mover jugadores a mano.
  - **Ligas guardadas:** la versión de datos 10 completa las fechas ya jugadas con los planteles actuales.
  - **Interfaz:**
    - Torneo tiene pestañas por categoría, con tabla y fixture.
    - Inicio muestra «Otras categorías» con el último resultado del club y su puesto en cada tabla.
    - No se muestran resultados de fechas cuya repetición está pendiente.
- **Cantera (decisión del 11/11/2026):**
  - **Plan juvenil propio:** `YOUTH_PLANS` en `web/domain.js`: Integral, Técnica, Física, Contacto y Juego.
  - **Progresión:** después de cada fecha, un M17 tiene 45 % de chance (un M19, 40 %) de sumar +1 en un atributo del plan, sin pasar su potencial. Los lesionados no progresan.
  - **Resultado por temporada:** Integral da unos +4 de valoración para todos. Contacto da +6,7 en forwards y +2,6 en backs. Técnica y Juego dan alrededor de +5 en backs y +1 a +2 en forwards.
  - **Plantel superior:** su plan ya no afecta a los juveniles.
  - **Pantalla:** Cantera muestra el puesto en los torneos M19 y M17, las promesas con mayor techo y la tabla juvenil.
  - **Planteles M19 reales:** salen de Ovalados (`research/ovalados-planteles-m19-2026.json`; un agente leyó las 14 fichas públicas, sin /data/*.json). Hay lista en 7 clubes: Regatas, SIC, Alumni, Belgrano, La Plata, Champagnat y BA C&RC.
    - Newman, CASI, Hindú, CUBA, Los Tilos y Los Matreros muestran la pestaña M19 sin formación cargada; Atlético del Rosario no tiene esa pestaña.
    - `scripts/import-ovalados-m19.mjs` suma a `research/youth.json` los equipos A y B: 159 juveniles nuevos y 6 vinculados con convocatorias de la UAR. El informe queda en `research/ovalados-import-report-m19.json`.
    - Ovalados no publica el puesto en M19: sale del dorsal de la formación, igual que en Primera A/B.
    - El equipo B empieza con un punto menos en cada atributo.
    - Solo aparecen en ligas nuevas.
  - **Juveniles reales sin edad:** no se les infiere edad. Por regla de juego, después de dos temporadas en la categoría suben: de M17 a M19, y de M19 al plantel superior (Pre B).
- **Centro de entrenamiento (decisión del 11/11/2026):**
  - **Pantalla Entrenamiento:** está en el menú y reúne el plan del plantel superior (antes estaba en Cantera), la sesión individual y la reconversión de puestos.
  - **Sesión individual:** una por fecha: +1 a un atributo hasta el potencial (`trainPlayer`, que ya existía sin interfaz).
  - **Reconversión:** solo entre puestos parecidos y tarda de 4 a 8 fechas (`RETRAIN_WEEKS` y `retrainOptions` en `web/domain.js`).
    - Puestos permitidos: primera línea entre sí, segunda línea y tercera línea, medio scrum y apertura, centros y tres cuartos. Nunca de pilar a apertura.
    - Hay hasta 3 a la vez.
    - Un jugador lesionado al empezar la semana no avanza.
    - La pretemporada completa lo pendiente.
    - Al terminar, el puesto se suma a `positions` y el jugador se puede elegir ahí. Se avisa en Novedades.
    - Acciones: `retrain` y `cancel-retrain`.
- **Nombres ficticios (versión de datos 11):** un jugador ficticio no puede llamarse igual que un jugador documentado ni que un compañero de club: se le cambia el nombre de pila (`uniqueFictionalNames`). Había 16 casos, por ejemplo un «Juan Akemeier» ficticio en CASI.
- **Prueba de temporadas completas (11/11/2026):** se simularon tres temporadas seguidas con acciones de manager: tácticas, plan juvenil, sesiones individuales y reconversiones. No hubo errores de reglas: ningún lesionado ni jugador fuera de puesto en el XV, todos los partidos y categorías jugados, edades +1 por temporada y las desconocidas siguen desconocidas. Se encontraron dos problemas, ya corregidos:
  - **Tamaño de la liga:** cada partido guardaba unos 38 KB (eventos y repetición), así que la liga pasaba de 2,7 MB a 24 MB en una temporada.
    - Ahora `slimMatches` guarda la repetición completa solo de los partidos de clubes con manager: el Worker pasa los clubes de los miembros a `advanceWorld`, y la demo, el club elegido.
    - Del resto quedan el resultado, los tries, las formaciones, el análisis y los eventos de tanteo. La interfaz los muestra como «Sin repetición».
    - Resultado: unos 7,7 MB por temporada con tres clubes con manager. Las ligas guardadas se recortan en el siguiente avance.
  - **Plantel superior sin límite:** los juveniles subían y nadie se iba, así que el plantel pasaba de 60 a 78 de media en dos temporadas. Ahora `squadTurnover`, al cambiar de temporada:
    - retira a los mayores de 32 años (15 % por año de más, hasta 90 %);
    - retira con 20 % anual a los documentados sin edad que llegan a 9 temporadas en Primera;
    - con más de 66 jugadores, da de baja a los ficticios de menor nivel fuera del XV hasta llegar a 64, siempre dejando 4 jugadores por puesto.
    - Avisa en Novedades. Resultado: plantel estable en ~64 (máximo 71).
  - **Observaciones sin cambiar:**
    - el estado físico del XV queda casi fijo en ~93 %, así que rotar importa poco;
    - lesiones: ~15 por club y temporada;
    - los juveniles suben ~+4 por temporada y el plantel superior ~0;
    - un club que asciende de Primera A puede quedar muy abajo (Lomas Athletic hizo 7 puntos en 2027), antes de recalibrar Primera A y B (ya corregido).
- **Recalibración de Primera A y B (decisión del 11/11/2026, versión de datos 12):**
  - **Escala:** las fuerzas del catálogo son relativas a cada división, y `DIVISION_BASELINE` (motor) fija la distancia entre divisiones.
  - **Contra qué se calibró:** sin resultados publicados de Primera A/B, la referencia son los ascendidos reales a su primera temporada en el torneo mayor (`urba-results.json`, 2018–2026, 15 casos): ganaron el 26 % de los partidos, con una diferencia media de −11.
  - **Antes y después:** con las bases anteriores (A 9,8; B 8,8), un ascendido simulado ganaba el 14 % con −16,9; Lomas Athletic llegó a hacer 7 puntos. Con A 10,15 y B 9,2 gana el 29 % con −10,5 (16 casos simulados).
  - **Primera B:** mantiene una distancia parecida con Primera A, sin datos propios.
  - **Descendidos:** un club que baja del Top 14 gana el 76 % en Primera A.
  - **Ligas guardadas (versión 12):** los clubes de Primera A/B, según su división en el catálogo y no la actual, suben la diferencia de base en todos sus jugadores por igual. Se conservan el entrenamiento y el orden del plantel; el Top 14 no cambia.
  - **Medición:** `node scripts/promotion-check.mjs [A] [B] [semillas]` (requiere `npm run build`).
- **Aportes de la comunidad (decisión del 11/11/2026, ampliada):** cualquier manager con sesión puede aportar, desde la ficha de un jugador real («Editar datos del jugador», también en la partida de prueba con servidor), nombre y apellido, edad aproximada, si sigue en el club, puesto y un comentario de estadísticas con nivel sugerido opcional (30–95). El nombre reemplaza al del juego; los últimos cinco comentarios se muestran en la ficha y la mediana de los niveles sugeridos mueve la valoración a mitad de camino (máximo ±2 por atributo, una vez por valor). No se exige fuente: se confía en la comunidad privada. El servidor los guarda en `community/contributions` (R2), con la identidad cifrada (hash), un límite de 60 aportes por día y escritura condicional; valen para todas las ligas y gana el último. La edad se guarda como fecha aproximada (1 de julio) y se muestra «~N»: reemplaza una estimación de ESPN, nunca una fecha documentada, y descongela la evolución del jugador. El puesto reemplaza al del juego. «Ya no juega en el club» solo marca al jugador en las ligas en curso y lo deja afuera de las ligas nuevas. Funciones en `web/domain.js`: `validateContribution`, `applyCommunity`, `catalogWithCommunity`; API `GET/POST /api/community`. No hay moderación ni deshacer: un dato incorrecto se corrige con otro aporte.
- **Investigación de edades:** priorizar perfiles deportivos oficiales, fuentes públicas de clubes o declaraciones públicas explícitas del jugador. No consultar padrones electorales ni raspar perfiles privados.
- **Regresos desde el exterior:** mercado con jugadores reales activos en el exterior y club de origen documentado; la predisposición y cualquier fichaje son simulados. No se presentan como activos en el exterior quienes ya regresaron o se retiraron.
- **Tácticas (ampliadas el 11/11/2026):**
  - **Plan de juego:** mentalidad (Ofensiva / Equilibrada / Defensiva), ataque 1-3-3-1 o 2-4-2, defensa Drift o Rush, juego con el pie y ruck.
  - **Pelota parada:** scrum, lineout, maul y penales (Palos / Touch / Según marcador). «Según marcador» es el plan base calibrado: en los últimos 20 minutos va al touch si pierde por más de 7 y a los palos si gana o empata.
  - **Mentalidades:** Ofensiva juega más a lo ancho, con más quiebres y errores y menos patadas; Defensiva hace lo contrario.
  - **Coeficientes:** están en `TACTIC_TUNING`. Ninguna opción nueva mueve más de ±1,2 puntos contra un rival parejo (`node scripts/engine-calibration-check.mjs`; detalle en `research/history/engine-check-tactics.json`).
  - **Tácticas guardadas antes de esta versión:** las que no tienen estos campos usan los valores base, sin migración.
  - **Calibración después del cambio:** localía +2,2, error medio 1,99 y Newman–CASI 62 % y +6,1.
- **Escala de valoraciones:** objetivo aproximado de 82 para un Puma medio, 85–86 para uno destacado y 95 para una figura mundial. La valoración sobre 100 pondera atributos según el puesto.

## Estado implementado

- Hay **42 clubes URBA jugables** y **58 clubes en el catálogo**, incluidos 16 del Interior como referencia. El catálogo reúne **1.052 registros de jugadores** observados en fuentes de 2026: 499 del Top 14 y 553 de Primera A y B. Incluye los planteles 2026 de Ovalados, importados con `scripts/import-ovalados-2026.mjs`; para Primera A y B se usa `--file research/ovalados-planteles-primera-ab-2026.json` y el informe queda en `research/ovalados-import-report-primera-ab.json`. Esa importación también fusionó 9 identidades duplicadas del Top 14 como alias. En Primera A/B no se cargaron Curupaytí, Monte Grande ni Manuel Belgrano: el plantel de Curupaytí repite el de San Fernando, Monte Grande solo usa iniciales y Manuel Belgrano no tiene plantel publicado. Tampoco se cargaron los nombres abreviados, los que son solo apellido ni los que figuran con nombre idéntico en dos clubes. Estos planteles solo aparecen en ligas nuevas: las guardadas conservan sus jugadores ficticios de Primera A/B; la unión actual de fuentes acredita **43 fechas de nacimiento** y hay **96 edades estimadas** (ESPN, no acreditadas). También hay 95 registros juveniles de referencia y 46 perfiles documentados de argentinos activos en el exterior.
- El fixture inicial usa 546 partidos URBA documentados. Las temporadas posteriores generan un calendario nuevo. El corte de datos y la fecha de referencia inicial del juego son el **10/11/2026**; el fixture 2026 es retrospectivo.
- Las planillas históricas no constituyen un padrón completo ni prueban por sí solas la afiliación actual. Matías Medrano está marcado como transferido a Benetton y no debe aparecer simultáneamente como jugador local activo y candidato desde el exterior. Los registros sin puesto comprobado no reciben uno inventado.
- Se implementaron selección del XV, categorías de plantel, promoción M19, entrenamiento, físico, cambios, tácticas, contactos de regreso desde el exterior y un mercado local de pases (ver «Mercado»). Los contactos de regreso tienen una probabilidad simulada y solo se puede fichar a un jugador elegible para su club de origen después de una respuesta favorable.
- El motor TypeScript es determinista por semilla. Genera fases, eventos, puntos, posiciones de los 30 jugadores y pelota, y reconstruye la repetición desde el registro guardado. La puntuación contempla tries, conversiones, penales y drops.
- La repetición empieza pausada en 0–0. El marcador y relato avanzan con el reloj; resultados y tabla de esa fecha se ocultan hasta el final o hasta confirmar el salto. Están implementados pausa, velocidad y salto explícito; desde la v3 (12/11) no hay barra de tiempo (ver «Repetición v3»).
- Las ligas guardadas anteriores se migran con una versión de datos: conservan IDs, alineaciones, resultados y progreso, recalibran atributos y corrigen edades desconocidas. La interfaz muestra un aviso. La migración es idempotente.
- La interfaz es web responsive en HTML/CSS/JavaScript sin framework. Las camisetas se dibujan en 2D (SVG) desde `research/club-kits.json` y los escudos son PNG locales.
- **Rediseño «FM limpio» (11/11/2026, elegido por el usuario; prioridad en el celular):**
  - **Estilo:** se mantiene la estructura de Football Manager: barra superior con el color del club, paneles densos con cabecera oscura y chips de valoración.
  - **Paleta:** fondo neutro, gris claro en el tema claro y carbón en el oscuro, con tokens en `:root` (capa «Clean FM skin» de `web/style.css`). Después el usuario pidió volver a la madera, que es hoy el aspecto por defecto (ver «Madera otra vez»).
  - **Celular (≤640 px):**
    - barra inferior fija con Inicio, Plantel, Tácticas, Torneo y «Más»; «Más» abre una hoja con el resto, y el menú superior se oculta;
    - la tabla del plantel muestra jugador, puesto abreviado, nivel y físico;
    - las tablas de posiciones muestran Pos., Club, PJ, Dif. y Pts;
    - los cambios sin guardar de Tácticas muestran una barra fija con «Guardar».
  - **Inicio en escritorio:** la columna derecha suma «Otras categorías».
  - **Verificación:** se revisó en el navegador a 375 px y 1280 px, en los dos temas.
- **Sin fuentes en la interfaz (decisión del 11/11/2026, pedido del usuario):** el juego ya no muestra fuentes ni notas sobre los datos. Se quitaron:
  - la página «Fuentes y datos» y su enlace en el pie;
  - los enlaces a fuentes en fichas, club, camisetas y mercado;
  - el bloque «sobre estos datos» del Plantel, la lista de convocatorias M19 documentadas y «Regresos y retiros documentados»;
  - las marcas «Ficticio», «Identidad documentada», «Ilustración aproximada» e «Historial incompleto», y las aclaraciones de edad acreditada o estimada (la edad aproximada sigue como «~N»).
  - Las fuentes siguen en `research/` y en el catálogo; las reglas de datos no cambian.
- **Inicio (11/11/2026):** arriba el próximo partido y cuatro números; abajo los paneles en columnas balanceadas (CSS `columns`) para que no queden huecos. Contenido: buzón (comisión directiva con el objetivo, cuerpo médico, preparador físico, coordinador de juveniles con el progreso semanal, mánager deportivo con los pases, análisis del segundo entrenador después de cada partido e informe del analista sobre el próximo rival), «Rival» con botón «Informe» (XV probable, cómo juegan según los últimos partidos o según el pack y los backs, y su plan si se conoce), «Próximas fechas», último resultado y «Figuras del plantel». A la derecha: tabla, «Esta semana» y «Otras categorías». Lo leído se guarda por navegador (`tt-read`). Se quitó el pie «Tercer Tiempo · rugby argentino».
- **Madera otra vez (11/11/2026):** el usuario quiso volver al fondo de madera. Es el aspecto por defecto (`data-skin="madera"`); el botón de capas de la barra superior cambia a fondo liso. Se guarda por navegador en `tt-skin`.
- **Club (11/11/2026, corregido):** «Datos del club» (sede, dirección, localidad, fundación, capitán, fuerza, división) y la temporada 2026 real, más objetivo de la temporada (`clubObjective`: exigencia según el ranking de fuerza en la división y si se está cumpliendo), palmarés (títulos URBA hasta 2025 de `research/club-honours.json`, tomados de es.wikipedia «Torneo de la URBA», más los ganados en la partida: `world.honours` archiva al campeón de cada división al cambiar de temporada) y camisetas.
- **Centro médico (11/11/2026):** toda la plantilla (pestañas Todos, Lesionados, M19, M17) con estado, lesiones de la temporada y totales; cada jugador se despliega con su historial. Cada lesión se guarda en `player.injuries` (últimas 20); las ligas anteriores se completan con las novedades.
- **Entrenamiento (11/11/2026):** la sesión individual cuesta `TRAINING_FATIGUE` = 10 puntos de físico; un lesionado no entrena. Pantalla con resumen arriba; la sesión es una lista de jugadores (nivel, físico, si es del XV) y una ficha con el físico antes y después y todos los atributos con barra hasta el potencial y botón «+1» (resaltados los que más pesan en su puesto). Plan del plantel y reconversión a la derecha.
- **Tácticas (11/11/2026):** pantalla «Formación» con cancha grande vertical y camisetas con los colores del club (número, apellido, nivel, puesto y físico), suplentes en fila (los de Primera fuera del XV) y «Resto del plantel». Se toca una camiseta y después otra o un suplente para cambiarlos (respeta los puestos). El botón «Tácticas» arriba a la derecha abre un panel lateral con el plan de juego y la pelota parada.
- **Repetición v2 (11/11/2026, reemplazada por la v3):** estadio visto desde arriba: tribunas con los colores de los dos clubes, carteles de publicidad (los clubes y sponsors inventados, sin marcas reales), cancha rayada con todas las líneas (in-goal, 5, 22, 10, mitad, guiones de 5 y 15 m, palos) y el nombre del local pintado. Marcador estilo TV con siglas y colores de cada club.
- **Mercado (11/11/2026, versión de datos 13):** «Regresos» pasó a «Mercado», con pestañas «Buscar jugadores» y «Regresos del exterior». Se buscan jugadores del plantel superior de clubes sin manager, con filtros por nombre, puesto, división, club, nivel, distancia y equipo en el que juega. Como no es profesional, el interés (`transferInterest`) depende de la cercanía entre sedes (`research/club-locations.json`, coordenadas aproximadas de conocimiento general: las de Primera A/B son de la localidad), de cuánto más jugaría (de Pre B en su club al XV del tuyo), de si sube de división, de la edad y de si es un jugador real (apego al club). Un contacto por fecha; si acepta se suma al plantel en el momento, si rechaza no se lo puede volver a contactar en la temporada. Límite del plantel superior: 130 (`SQUAD_LIMIT`; era 70 antes de sumar las reservas reales). Los clubes con manager quedan afuera (`world.managedClubs`, que pone el Worker en cada acción y `advanceWorld`).
- **Plantel y ficha (11/11/2026):** el cuadrado de cada jugador muestra el dorsal (XV 1–15 por puesto, el resto de Primera 16–23, después por nivel; juveniles por categoría) con los colores de la camiseta del club. Las columnas de la tabla se ordenan tocando el encabezado (jugador, equipo, puesto, edad, nivel, potencial, físico). La ficha tiene un recuadro «Editar jugador» y un botón «Editar» abajo: los reales usan los aportes de la comunidad; los inventados se editan solo en la partida (acción `edit-player`: nombre, edad, puesto).
- **Camisetas 2D (11/11/2026):** se dibujan planas en SVG a partir de `research/club-kits.json` (patrón liso, aros, bastones, mitades o cuarteles, colores, cuello, pantalón y medias), investigado en las páginas de clubes de urba.org.ar, Wikipedia y el estatuto de CUBA: 33 de confianza alta, 8 media y Vicentinos baja. Se usan en Club, Tácticas y los dorsales; reemplazan las ilustraciones PNG. La sesión con GPT había vuelto a mostrar las ilustraciones 3D en Club; el 12/11 se volvió a las 2D, a pedido del usuario.
- **Escudos locales (11/11/2026):** los 42 escudos se guardaron en `public/crests/<id>.png` (128 px, convertidos desde PNG, WebP o JPG de urba.org.ar) y se sirven desde el Worker; ya no se enlazan desde urba.org.ar.
- **Mercado con rol ofrecido (11/11/2026):** antes de contactar se elige el rol que se le ofrece (según su nivel, titular, Primera, Intermedia o Pre A). Ofrecer más de lo que jugaría sube el interés, pero solo se cree la mitad de la diferencia; el jugador llega a ese equipo y queda registrada la promesa (`player.promise`).
- **Repetición v3 (11/11/2026):** ocupa todo el ancho (limitada por la altura de la pantalla), se reproduce tocando la cancha (botón grande de play al pausar), velocidades 1×, 2× y 4× y sin barra de tiempo. Abajo, la línea de lo que pasa ahora (fase y portador) y el relato de los últimos eventos. Try y patadas a los palos (convertidas o erradas) muestran un cartel a toda la cancha con los colores del equipo. Carteles: nombre del juego (`GAME_NAME`), URBA en el centro, el club local y sponsors inventados; en el pasto, URBA y los números de las líneas (5, 22, 10). Movimiento con aceleración suave, y en los rucks los backs forman una línea diagonal y la defensa una línea plana (solo visual, `buildFrames`). Las tarjetas no existen en el motor: mostrarlas requiere simular expulsiones y recalibrar.
- **Reservas reales, primera carga (11/11/2026, reemplazada por la reimportación del 12/11):** un agente leyó en Ovalados las pestañas Intermedia y «Pre-Inter A…F» de los 14 clubes del Top 14 (`research/ovalados-planteles-reservas-2026.json`, sin /data/*.json). Ovalados muestra una sola lista por categoría con varios equipos mezclados. `scripts/import-ovalados-reserves.mjs` escribe `research/reserves.json` solo con Intermedia, Pre A y Pre B: 840 jugadores, con el puesto según el dorsal 1–15. Quedan afuera los suplentes (16+), los nombres abreviados (casi todo SIC, CUBA y Hindú), los que ya están en el plantel, las filas de texto de la página y 328 nombres con acentos ilegibles. Informe: `research/ovalados-import-report-reservas.json`. En ligas nuevas cada uno reemplaza a un inventado de su puesto (alternando categorías; Intermedia toma a los mejores inventados y Pre B a los más bajos) y empieza en su categoría publicada. No tienen edad. Las ligas guardadas no cambian.
- **Playoffs, ascensos y descensos (12/11/2026, versión de datos 14):**
  - **Top 14:** después de la fecha 26, del 1º al 4º juegan semifinales (1º contra 4º y 2º contra 3º, de local el mejor ubicado). La final URBA es en cancha neutral, sin ventaja de localía (`neutral`, parámetro de `generateMatch`). El campeón URBA es el ganador de la final (`world.honours`). Descienden el 13º y el 14º.
  - **Primera A y B:** el 1º asciende directo y del 2º al 5º juegan semifinales y una final neutral por el segundo ascenso. Descienden los dos últimos de Primera A.
  - **Reglas:** un playoff empatado lo gana el que hizo más tries y, si siguen iguales, el mejor ubicado. Los playoffs no suman en la tabla (`getStandings` ignora los `stage`) ni se juegan en las categorías paralelas.
  - **Dónde está:** `PLAYOFF_RULES`, `playoffState`, `schedulePlayoffs` y `seasonMoves` en `web/domain.js`; `advanceSeason` del motor recibe los movimientos en `nextDivisions`.
  - **Ligas guardadas:** las que ya terminaron la temporada programan los playoffs (v14); si se pasa de temporada sin jugarlos, se simulan.
  - **Interfaz:** zonas en las tablas (semifinales, ascenso directo, playoff, descenso, con leyenda), llave de playoffs en Torneo y en Inicio, y rótulos «Semifinal», «Final URBA» y «Final por el ascenso».
- **Escudos sin fondo (12/11/2026):** `scripts/clear-crest-background.py` (PIL) deja transparente el fondo blanco que toca el borde, sin tocar el blanco del escudo. Se aplicó a Lomas Athletic, Regatas Bella Vista y Vicentinos; los otros 39 ya eran transparentes.
- **Reservas reales, reimportadas (12/11/2026):** el agente volvió a leer Intermedia, Pre A y Pre B de Ovalados sin pasar por el portapapeles, porque antes se habían roto los acentos. Ahora hay 0 caracteres ilegibles y 1.044 jugadores importados; se controló contra una captura del usuario (Pre A de Regatas: todos presentes). La pestaña Intermedia de La Plata no tiene lista propia. Si un club no tiene lugares inventados libres de ese puesto, el plantel crece con un jugador nuevo: Intermedia toma de base al compañero medio del puesto, Pre A al más bajo y Pre B al más bajo con un punto menos. Ejemplos: Regatas pasa a 119 jugadores en el plantel superior y CASI a 121. SIC, CUBA y Hindú publican nombres abreviados y siguen casi sin reservas reales. El límite del plantel para el mercado subió a 130 (`SQUAD_LIMIT`).
- **Pesos del motor (12/11/2026, `research/history/engine-weights-report.md`):**
  - **Datos de calibración:** solo partidos del torneo mayor (Top 12/13/14 de la URBA, `urba-results.json`), sin Intermedia, Pre A, reservas ni juveniles. Las categorías paralelas usan un Poisson con constantes a mano.
  - **Cuánto mueve cada factor el margen:** 1 punto de valoración del XV ≈ +3,4 de margen; localía +2,8 (50,7 → 58,9 %); forma del día ≈ ±2,5 (no se pudo medir directamente); un XV al 92 % contra uno al 100 % −4,9; un titular lesionado −2,0; cada opción táctica entre −1,0 y +2,0.
  - **Reparto de la varianza del margen:** calidad del plantel 38,5 % y azar del partido 61,5 %; localía y tácticas, alrededor del 1 % cada una.
  - **Fuerza del club:** el club no tiene memoria propia. La fuerza del catálogo solo fija los atributos al crear la liga: 1 punto de fuerza ≈ 1,2 de margen.
  - **Rush:** valía +2,0, más que el tope de ±1,2 buscado; se corrigió en el ajuste del 12/11 (+0,8).
  - **Pendiente:** «Competir» en el lineout y la mentalidad «Defensiva» rondan +2 contra un rival parejo.
  - **Medición:** `node scripts/engine-weights-check.mjs`.
- **1.000 temporadas antes del ajuste (12/11/2026):** la temporada 2026 simulada 1.000 veces desde cero (10 procesos en paralelo, `scripts/season-monte-carlo.mjs` + `season-monte-carlo-merge.mjs`). Correlación de Spearman con la tabla real: Top 14 0,886, Primera A 0,943 y Primera B 0,965; error medio de puntos 11,4 / 7,9 / 4,5.
  - Newman sale 1º en el 43 % de las temporadas, pero promedia 89 puntos contra 110 reales.
  - Belgrano Athletic queda muy alto: 3,4º contra 7º real. Deportiva Francesa (Primera A) también: 7,9º contra 12º.
  - La tabla promedio era más pareja que la real. Pero el promedio de muchas temporadas siempre es más parejo que una temporada sola: la comparación justa es la dispersión de una temporada (`scripts/season-spread-check.mjs`), que ya era parecida a la real. Lo que fallaba eran clubes puntuales, y se corrigió con el ajuste de fuerzas.
  - Cada temporada tarda unos 2–3 minutos por proceso con 10 en paralelo; sola, alrededor de 1 segundo según el agente.
- **Ajuste de fuerzas (12/11/2026, versión de datos 15):** el usuario pidió acercar la simulación a la tabla 2026.
  - **Fuerzas:** `scripts/fit-club-strength.mjs` reajustó la fuerza del catálogo de 36 clubes contra la tabla 2026, descontada la suerte de una temporada (objetivo = media + 0,85 × (real − media)). Los cambios principales: Newman 89 → 95, CASI 87 → 91, Hindú 80 → 83, Alumni 82 → 84, SIC 82 → 85, Belgrano 78 → 70, Deportiva Francesa 60 → 54.
  - **Rush:** se suavizó de +3,3 a +0,8 de margen.
  - **Ligas guardadas (v15):** mueven a los jugadores de cada club según el mismo cambio (`STRENGTH_FIT_V15`).
  - **Resultado:** Spearman con la tabla real Top 14 0,938, Primera A 0,982 y Primera B 0,978; error de puntos 5,8 / 4,6 / 4,3 (antes 11,4 / 7,9 / 4,5). Cruces: Newman–CASI 70 % (margen +10, más alto que el real), Newman–Regatas 87 % y local 53,1 %.
  - **Escala:** `STRENGTH_SLOPE` (0,071) queda igual; subirla empeoraba el error contra el historial.
  - **Detalle:** `research/history/engine-weights-report.md` §5.
- **Cuentas (11/11/2026):** en Liga se crea una cuenta con usuario, mail y contraseña, o se entra con usuario o mail. El Worker guarda la contraseña con PBKDF2 y el mail solo como hash; la sesión es una cookie HttpOnly de 30 días (`/api/auth/register`, `/login`, `/logout`). La identidad de Sites sigue funcionando. Falta: recuperar la contraseña (no hay envío de mails) y limitar intentos fallidos.

- **Cambios de una sesión con GPT (12/11/2026, versiones de datos 16–18):** el usuario trabajó en paralelo con otro asistente; el resumen de esa sesión está en `rugby-manager/PROGRESO_RUGBY_MANAGER.md`.
  - **Qué agregó:**
    - estadísticas individuales por partido y temporada (`web/player-stats.js`);
    - 28 juveniles de la convocatoria URBA M17 2026;
    - camadas M17 de 15 por temporada;
    - salidas al exterior y regresos simulados;
    - potencial flexible;
    - una página de perfil del jugador (`#jugador/<id>/<pestaña>`) en lugar de la ficha en ventana;
    - navegación agrupada en Portal, Plantel, Tácticas, Desarrollo, Mercado, Competiciones y Club, con subpestañas.
  - **Pruebas:** quedaron 64 automáticas, y pasan.
  - **Diseño:** al usuario no le gustó cómo quedó: vio fallas y lo encontró «robotizado».
- **Diseño limpio (12/11/2026, pedido del usuario):** referencia, Football Manager 26 mezclado con lo anterior, «más simple, fluido, minimalista».
  - **Hoja de estilos:** `web/style.css` se reescribió desde cero (unas 900 líneas, antes 1.086 en varias capas superpuestas). Hay un solo juego de tokens: oscuro por defecto, claro y madera opcional.
  - **Estilo:**
    - barra superior con el color del club, con texto oscuro o claro según el color (`clubInk` en `shell`);
    - subpestañas subrayadas con el color del club;
    - tarjetas con bordes redondeados (10 px) y títulos sin mayúsculas forzadas;
    - pestañas en forma de píldora y botón «Continuar» blanco;
    - valores de atributos como números de color, sin bloques;
    - transiciones cortas al pasar el mouse.
  - **Contenido:** se volvieron a quitar las fuentes, «Identidad documentada», «Atributos estimados» y la nota de asignaciones simuladas que había repuesto la otra sesión. El botón de entrenamiento individual vuelve a decir «+1».
  - **Copia de la hoja anterior:** `/private/tmp/claude-501/-Users-felipechiesa-Desktop-RM26/553ae3ab-e2c6-4066-bfbd-fcc2046466ff/scratchpad/style.before-clean.css` (temporal).
  - **Revisión en el navegador:**
    - a 1366 px: Portal, Plantel, perfil, Tácticas, Entrenamiento, Mercado, Competiciones, Club y repetición;
    - a 375 px: todas las secciones, sin desborde horizontal.

- **Repetición: proporciones y jugadas (12/11/2026):**
  - **Cancha:** con las proporciones reales (116 × 70 m con los in-goals). Ocupa lo que permite la altura de la pantalla y el público llena los costados; en el celular, todo el ancho.
  - **Sin deformaciones:** las líneas tienen grosor fijo (`vector-effect: non-scaling-stroke`) y los números, «URBA» y los palos son HTML ubicado en %, así no se estiran.
  - **Jugadas armadas:** como el partido ya está simulado, `buildFrames` arma las jugadas según lo que va a pasar, sin cambiar el resultado:
    - en una patada a los palos, el pateador está sobre la pelota, su equipo atrás y la defensa en su in-goal;
    - en un try, el equipo rodea al que lo hizo y la defensa vuelve bajo los palos;
    - en la última corrida antes del try, la defensa persigue desde atrás;
    - la pelota del try queda apoyada dentro del in-goal.
  - **Efectos en pantalla:** el que va a hacer el try se ilumina mientras corre y se zambulle al apoyar. La pelota se agranda cuando está alta. Los palos se iluminan en las patadas al arco.
- **Estadísticas por temporada (12/11/2026):** se comprobó que el archivo de estadísticas (`world.playerStats`) conserva la temporada anterior al cambiar de temporada y sigue sumando la nueva, y que sobrevive a guardar y migrar. La ficha del jugador ahora muestra todas las temporadas en «Estadísticas de carrera», en lugar de solo la actual. Desde el 12/11 la partida de prueba también se guarda (ver «Partida de prueba guardada»).
- **Partida de prueba guardada (12/11/2026, pedido del usuario):** la partida sin liga se guarda sola en el navegador (IndexedDB `tercer-tiempo` → `saves/demo`: una temporada pesa varios MB, más que lo que admite localStorage) después de cada acción, fecha o cambio de club, y se recupera al abrir. La recuperación pasa por la migración de datos (`enrichRosterIdentities`). Las repeticiones ya vistas también se recuerdan en la partida de prueba (`tt-watched-v1:demo:…`). En Club → Liga hay un recuadro «Partida de prueba» con «Empezar de nuevo», que pide confirmación y borra la partida y las repeticiones vistas. Se probó en el navegador: después de jugar una fecha y recargar, el resultado sigue; después de «Empezar de nuevo» vuelve a la fecha 1.
- **Multijugador: todos listos (12/11/2026):** la fecha se juega sola cuando el último manager marca «Estoy listo». Ya no hace falta que el creador apriete «Avanzar». Lo mismo con la temporada siguiente al terminar los playoffs.
  - **Servidor:** un doble clic no la juega dos veces (escritura condicional por versión → 409). Mientras un manager está listo no puede editar su equipo (409, «Quitá tu estado de listo»). Las tácticas de los demás siguen ocultas.
  - **Interfaz:**
    - el botón de arriba dice «Estoy listo», «Esperando a N» o «Ver partido»;
    - la pantalla de la liga nombra a quiénes faltan;
    - al que completa la fecha se le abre su repetición; los demás reciben el aviso por la consulta cada 10 s.
  - **Prueba:** se probó contra el servidor local con tres managers (Regatas, Champagnat, Vicentinos) durante dos fechas. Esas tres identidades de prueba (`qa_ana`, `qa_beto`, `qa_caro`) dejaron una liga «QA multijugador» en `.local-data/`.
- **Prueba en el navegador (12/11/2026, `rugby-manager/research/playtest/ui-playtest.md`):** un agente jugó 10 fechas con Regatas.
  - **Roto, ya arreglado:** la repetición se colgaba (`TypeError` en `drawReplay`) y «Saltar al resultado» dejaba el marcador en 0–0. Pasaba en los partidos con tarjetas, que tienen momentos con menos de 30 jugadores (54 de 84 partidos medidos). Los puntos se ubicaban por posición en la lista; ahora van por camiseta (equipo + número) y el expulsado o amonestado se oculta.
  - **Arreglado también:**
    - botón «Editar jugador» en la cabecera del perfil;
    - suplentes con un jugador de cada línea (hooker, pilar, segunda, tercera, medio scrum, apertura o centro, tres cuartos y el mejor que quede);
    - el Mercado ordena por defecto por «Mejor opción» (interés × nivel);
    - fundación en formato dd/mm/aaaa y sin la marca «Ilustración aproximada»;
    - «Marcar todo como leído» en el buzón;
    - «Torneo» y «Portal» abreviados en la barra del celular;
    - el aviso se oculta al cambiar de pantalla;
    - la cancha de la repetición deja lugar a los controles (altura de la pantalla − 400 px).
  - **Sin cambiar:**
    - la repetición vuelve a 00:00 si se sale y se vuelve;
    - el panel de Tácticas tapa la barra «Cambios sin guardar», aunque tiene su propio «Guardar»;
    - seis Camerlinckx en el XV de Regatas es real.
- **Pruebas de juego con agentes (12/11/2026, `rugby-manager/research/playtest/`):**
  - **Carrera de un club chico** (`career-report.md`, 240 carreras de 5 temporadas):
    - escalar es posible pero difícil;
    - con manager activo, Champagnat juega el Top 14 en el año 5 en el 80 % de las carreras (pasivo 23 %), GEBA en el 75 % (0 %) y Delta en el 13 % (0 %);
    - playoffs del Top 14: Champagnat 23 %; título URBA, 1 de 40.
  - **Control de reglas** (`rules-audit.md`, 3 semillas × 6 temporadas guardando y cargando): playoffs, ascensos, ids, edades, estadísticas y migraciones correctos.
  - **Corregido después de las pruebas:**
    - el contacto del mercado de la temporada anterior bloqueaba el de la nueva: la clave ahora es temporada + fecha, y los rechazos vencen al cambiar de temporada;
    - el fichaje no respetaba el rol prometido y reordenaba las categorías del comprador; ahora el jugador va a su rol y el resto no se toca;
    - el mercado era demasiado generoso (36 fichajes en 5 años): interés máximo 60 % (`MAX_INTEREST`) y hasta 4 incorporaciones por temporada (`MAX_SIGNINGS`).
  - **Pendiente:**
    - los grandes del Top 14 bajan solos con los años (retiros sin reposición en los clubes sin manager);
    - planteles de 150–180 en clubes con reservas reales;
    - Pre B a veces no completa 15 con puesto;
    - en un caso raro, un XV con un jugador fuera de puesto cuando faltan todos los del puesto;
    - el potencial (1–20) ya no limita nada;
    - el objetivo del club no sigue el nivel real.
- **Repetición (12/11, a pedido):** se quitaron los movimientos armados (conversión, try, corrida) y los efectos (brillo, zambullida, pelota que crece, palos que se iluminan). Quedan los carteles «¡TRY!» y de patadas.
- **Portal:** se quitaron las subpestañas «Buzón» y «Próximo partido», que no hacían nada.
- **Multijugador sin conexión:** si la fecha se jugó mientras un manager no estaba, al entrar ve la pantalla previa al partido, sin el resultado, con «Continuar». Al apretarlo se abre la repetición. La fecha no vista sigue en «Próximas fechas», no aparece el aviso «La liga actualizó la fecha» y en Torneo no hay nota de partido pendiente. Se probó con la liga «QA multijugador» como Beto.
- **Convocados URBA M17 (12/11, versión de datos 19, pedido del usuario):** antes proyectaban 41–54, debajo del M17 promedio (48). Ahora arrancan cerca de 44 (subida de hasta 5 puntos por atributo) y proyectan 74–80 (`SELECTED_M17_NOW`, `SELECTED_M17_PROJECTION` en `web/domain.js`). Las ligas guardadas se actualizan una sola vez. Más abajo, el nivel de los juveniles según las tablas reales.
- **Juveniles según las tablas reales (12/11, versión de datos 20):**
  - **Fuente:** `research/urba-youth-tables-2026.json`, sacado de la API pública del fixture de urba.org.ar (Menores de 17 y de 19, Grupo II, temporada 2026 completa al 1/11). Cubre 31 clubes en M17 y 36 en M19.
  - **Campeones:** M17, Regatas Bella Vista (1º en Ganadores, 47 puntos; el sitio del club lo confirma); M19, Newman (48 puntos). No hubo final aparte: el campeón es el líder de la ronda Ganadores.
  - **Cómo se usa:** `levelYouthByTables` en `web/domain.js` lleva el promedio de los 15 mejores de cada categoría al objetivo de su puesto (`youthTarget`: M17 1º ≈ 44 y M19 1º ≈ 50, bajando por puesto; después Intermedia y los niveles de abajo), con el mismo corrimiento para todos los del club. Los clubes que no figuran en las tablas no cambian.
  - **Ligas guardadas:** las de 2026 se ajustan una vez (v20).
  - **Comprobación:** en una temporada simulada, M17 termina Regatas 1º, CUBA 2º y BA C&RC 3º; M19 termina Newman 1º, Belgrano 2º y SIC 3º, como en la realidad.
## Arquitectura y archivos

| Ruta | Función |
| --- | --- |
| `src/engine/index.ts` | Motor, modelos, calendarios, simulación, replay, mercado, entrenamiento y progresión. |
| `web/domain.js` | Integra catálogo y motor; migración, fechas, acciones de club y avance de temporada. |
| `web/app.js`, `web/index.html`, `web/style.css` | Interfaz, navegación, perfil del jugador y repetición. `style.css` es la hoja limpia del 12/11 (tokens arriba, componentes y responsive abajo). |
| `web/player-stats.js` | Estadísticas individuales por partido y temporada, sin mostrar las de una fecha cuya repetición está pendiente. |
| `server/worker.js` | API de liga, autenticación mediante Sites o cuentas propias (usuario, mail y contraseña), aportes de la comunidad, pertenencia, versiones y escritura condicional en R2. |
| `server/local.mjs` | Servidor de desarrollo de loopback con identidad y datos locales de prueba. |
| `research/catalog.json` | Clubes, fixture, fuentes, identidades y cobertura documental. |
| `research/age-verification.json` | Evidencia independiente de nacimientos y participación en 2026. |
| `research/returns.json` | Jugadores en el exterior, fuentes y perfiles históricos separados. |
| `research/youth.json`, `research/names.json` | Referencias juveniles y pesos de nombres para generación ficticia. |
| `research/calibration-report.md` | Definición de la escala, fórmulas y resultados de simulaciones de calibración. |
| `scripts/merge-research.mjs` | Combina evidencia por identificador y club, sin sobrescribir los archivos de investigación. |
| `scripts/build.mjs`, `scripts/build-standalone.mjs` | Construyen el Worker y el HTML web autónomo; suman ubicaciones, palmarés, camisetas, escudos y reservas (`addClubExtras` en `merge-research.mjs`). |
| `research/club-locations.json`, `research/club-honours.json`, `research/club-kits.json` | Coordenadas de las sedes (mercado), títulos URBA hasta 2025 y diseño de camisetas por club. |
| `research/reserves.json` | Jugadores reales de Intermedia, Pre A y Pre B (Ovalados), generado por `scripts/import-ovalados-reserves.mjs`. |
| `public/crests/` | Escudos de los 42 clubes URBA en PNG de 128 px con fondo transparente (`scripts/clear-crest-background.py`). |
| `scripts/engine-weights-check.mjs`, `season-monte-carlo.mjs`, `season-monte-carlo-merge.mjs`, `season-spread-check.mjs`, `fit-club-strength.mjs` | Peso de cada factor, temporadas simuladas en masa, dispersión de una temporada y ajuste de fuerzas. Informe en `research/history/engine-weights-report.md`. |
| `tests/` y `src/engine/index.test.ts` | Pruebas de datos, temporada, servidor y motor. |

El servidor usa un objeto R2 por liga con control de versiones y escritura condicional por ETag para evitar avances simultáneos. La identidad la suministra Sites; la membresía y la autorización de cada acción se verifican del lado del servidor. La lista para una liga no expone las tácticas actuales de otros clubes.

## Calibración actual

El motor se calibró el 10/11/2026 con 1.347 partidos del torneo mayor URBA 2016–2026 (`research/history/`, solo Top 12/13/14: sin Intermedia ni reservas), y se ajustó el 12/11/2026 contra la tabla 2026 (ver «Ajuste de fuerzas»). Detalle en `research/history/calibration-history-report.md` §7 y `research/history/engine-weights-report.md`; medición con `node scripts/engine-calibration-check.mjs` (requiere `npm run build`).

- **Constantes:** localía `HOME_EDGE = 0,62` (sin efecto en finales neutrales), forma del día `DAY_FORM = 0,02`, coeficientes tácticos en `TACTIC_TUNING` y escala de fuerzas `STRENGTH_SLOPE = 0,071` (`src/engine/index.ts`). `levelClubSquad` quita el sesgo de la generación aleatoria.
- **Partido a partido (12/11/2026):**
  - local 53,1 % (real 53,1 %), ventaja local +2,85 (real 2,0–2,8);
  - Newman–CASI 70 % y +10,3 (real 62–80 %, +5 a +6: el margen queda alto);
  - Newman–Regatas 87 % (real 82–96 %), Newman–Hindú 76 % (63–81 %), CASI–Regatas 74 % (74–88 %), SIC–CASI 55 % (43–56 %), Newman–Champagnat 99,5 % (97–99 %).
- **Temporada:** 1.000 temporadas 2026 desde cero. Spearman con la tabla real: Top 14 0,938, Primera A 0,982 y Primera B 0,978. Error medio de puntos 5,8 / 4,6 / 4,3. La dispersión de una temporada es parecida a la real (desvío de puntos 23,6 contra 25,8 en el Top 14).
- **Pesos:** calidad del plantel 38,5 % de la varianza del margen y azar del partido 61,5 %. Localía y tácticas, alrededor del 1 % cada una.
- **Pendiente estructural:**
  - el motor tiene más azar por partido que la realidad (σ 16,6 contra 14,3) y menos partidos cerrados (28 % contra 42 %), y anota unos 4 puntos y 1 try menos por partido;
  - las tácticas no se pueden medir con datos históricos y se acotaron por diseño;
  - las categorías paralelas no tienen calibración propia;
  - Primera A y B se calibraron con los ascendidos reales (11/11) y con su tabla 2026 (12/11).

## Verificación realizada

- La última compilación del Worker terminó correctamente.
- Pasaron **64 pruebas automatizadas** (12/11/2026, después de la sesión con GPT y del diseño limpio). Además de las de antes (integridad de fuentes, edades desconocidas, migraciones, formación, permisos, concurrencia, temporada completa y marcador), cubren:
  - torneos paralelos, tácticas, cantera, reconversión, nombres únicos, recorte de partidos y rotación del plantel;
  - migraciones v12 y v15;
  - mercado local con rol ofrecido, cansancio del entrenamiento y objetivos del club;
  - editor de la comunidad (nombre y estadísticas), cuentas propias y playoffs con ascensos y descensos.
- Revisión visual en el navegador integrado (11 y 12/11/2026) a 1280, 1024 y 375 px: Inicio, Plantel, Tácticas, Entrenamiento, Médico, Mercado, Club, Torneo con zonas y repetición. No se vio la animación de la repetición corriendo, porque el panel del navegador estaba oculto. Tampoco se probó en pantalla la llave de playoffs ni el formulario de cuentas: los cubren pruebas automáticas.
- Una prueba de interfaz con DOM simulado verificó inicio en 0–0, ausencia de spoilers, pausa, búsqueda, salto, reproducción completa a 4× y mercado documentado.
- Se comprobó la integridad del ZIP y se reconstruyó una versión empaquetada en un directorio limpio. **Esto no reemplaza una prueba visual en navegador real.** La apertura del HTML por `file://` fue rechazada por la política del entorno, y quedó pendiente la revisión visual.

## Publicación y entregables

El sitio de Sites existente tiene ID `appgprj_6af32ed16b2c81918a7191a06dd1d8a7`. Es privado para el propietario y **todavía no está publicado**. La URL esperada `https://tercer-tiempo-rm26.felipechiesa05.chatgpt.site` no demuestra que esté activa.

La sincronización de código con el repositorio remoto falló porque no se pudo resolver `git.chatgpt-team.site`. Un intento acotado de vista previa local también falló con `EPERM` al escuchar en `127.0.0.1:4173`. No se eludieron esas restricciones. Por lo tanto, la liga online existe en código, pero **no está disponible para jugar con amigos desde distintos dispositivos**. Aunque se publique en privado, cada amigo necesitará acceso al sitio además del código de la liga.

Los archivos locales más recientes son:

- `/tmp/Tercer-Tiempo-web-actualizado.html`: demo web autónoma; la partida de prueba se reinicia al recargar.
- `/tmp/Tercer-Tiempo-web-fuente-actualizado.zip`: código fuente, datos y pruebas; no incluye un lanzador de aplicación Mac.

Ambos archivos están en una ubicación temporal y pueden desaparecer. Los archivos previos de la Biblioteca con IDs `libfile_32fcdab15e8881919a4be31a97aba201` y `libfile_11488f6a2f30819183dd98f7bdd0ac57` son **versiones antiguas**, no las actualizadas: el intento de reemplazo falló antes de transferirlas. No presentar esos enlaces como la versión actual.

## Limitaciones y próximos pasos

1. **Publicar sin cambiar permisos:** recuperar el acceso de escritura al repositorio del sitio existente, sincronizar exactamente el código validado y publicar una versión privada mediante el flujo de Sites. Confirmar el resultado real; no crear otro sitio ni afirmar que está online antes de verlo desplegado.
2. **Habilitar el juego con amigos:** una vez publicado, resolver el acceso de las personas que el propietario indique. Las cuentas propias permiten registrarse, pero el sitio sigue privado.
3. **Probar en navegador real:** recorrer creación/unión de liga, cuentas, acciones concurrentes, tácticas, avance, playoffs y repetición en escritorio y móvil, con la animación corriendo.
4. **Motor y repetición:**
   - no hay tarjetas amarillas ni rojas; mostrarlas requiere simular expulsiones y recalibrar;
   - las jugadas de la repetición (pases, quiebres, el pilar que se tira cerca del ingoal) salen de la secuencia del motor y solo se mejoró la ubicación visual;
   - Newman–CASI da +10 de margen contra +5/+6 real;
   - «Competir» en el lineout y la mentalidad «Defensiva» valen alrededor de +2.
5. **Datos:**
   - completar fechas de nacimiento con fuentes acreditadas sin inferir edades por categoría;
   - SIC, CUBA y Hindú publican sus reservas con nombres abreviados;
   - la camiseta de Vicentinos es de confianza baja;
   - las coordenadas de Primera A/B son de la localidad.
6. **Competencias:** Primera se juega con el motor; Intermedia, Pre A, Pre B, M19 y M17 se simulan en paralelo con el mismo fixture, sin playoffs. El Interior es catálogo de consulta; faltan sus torneos y otras regiones.
7. **Reglas y gestión:** faltan economía, negociaciones y promesas con consecuencias (`player.promise` solo se registra). Las cuentas no tienen recuperación de contraseña ni límite de intentos.

## Comandos de desarrollo

Se requiere Node 26. No hay paquetes que instalar para esta versión:

```sh
npm run build
npm test
npm run dev
```

El servidor de desarrollo usa únicamente loopback, identidad de prueba y datos locales en `.local-data/`; no es un sitio online compartido. Antes de publicar, volver a ejecutar las pruebas y comprobar que el Worker, los datos y el HTML correspondan al mismo código fuente.
