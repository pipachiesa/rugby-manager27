# Progreso del Rugby Manager

**Actualización:** 12 de noviembre de 2026  
**Nombre provisional:** Tercer Tiempo  
**Proyecto:** RM26

## Objetivo y alcance

Juego web de gestión de rugby argentino para una liga privada con amigos, con clubes reales desiguales y Regatas Bella Vista como club prioritario. La base jugable incluye Top 14, Primera A y Primera B de URBA; Interior y otras regiones siguen como ampliación. La entrega buscada es web, no una aplicación de escritorio.

El agente principal coordina y delega. La preferencia registrada es Sol con razonamiento medio para tareas complejas y Terra con razonamiento alto para integración, tareas repetitivas y validación.

## Estado funcional

- La base contiene 42 clubes URBA jugables y 58 en catálogo. El calendario inicial reproduce 26 fechas URBA 2026; temporadas posteriores generan fixture. Hay playoffs de Primera y ascensos/descensos. El Interior se muestra como referencia, sin liga jugable.
- Primera, Intermedia, Pre A y Pre B comparten plantel superior; M19 y M17 tienen sus propias categorías. Las categorías paralelas disputan partidos de equipo con un modelo simplificado sin replay ni estadísticas individuales. Sus asignaciones son decisiones del juego, no nóminas oficiales.
- La convocatoria oficial URBA M17 2026 aporta 28 jugadores reales de 12 clubes: son 28 incorporaciones nuevas, sin coincidencias previas detectadas. Los cuatro de Regatas son Baltazar Estrada (pilar izquierdo), Facundo Moreira (hooker), Ramiro Santa Ana y Juan Segundo Fresca (alas). Las posiciones proceden de los códigos oficiales de puesto y no se presentan como números de camiseta. Sus edades permanecen desconocidas sin fecha acreditada; la selección aumenta la proyección inicial solo dos puntos sobre 100, sin garantizar un resultado ni modificar sus atributos actuales.
- En cada temporada ingresa una nueva camada de 15 juveniles M17 (pueden coexistir con la camada anterior), se cubren puestos faltantes y los jugadores progresan de categoría. Para jugadores documentados sin edad se usa permanencia en categoría como regla de juego, sin inventar una fecha de nacimiento.
- Los reservas ficticios nuevos respetan la jerarquía inicial; en partidas guardadas se reorganizan por nivel al migrar sin bajar atributos ganados. Esto no impide que un jugador mejore y ascienda luego.
- Hay 26 atributos por puesto, formación, entrenamiento, fatiga, lesiones, táctica, reconversión de posiciones y retiros. El potencial es una proyección flexible y puede superarse de forma limitada según edad, entrenamiento y evidencia de partidos; la mejora no está garantizada.
- Los jugadores destacados pueden salir al exterior en una carrera simulada y, más adelante, negociar un regreso al club de origen. Se conserva su identidad y su historial. Los candidatos reales documentados y los movimientos ficticios se distinguen.
- Primera usa un motor determinista por semilla, puntuación de rugby y replay 2D. La reproducción inicia en 0–0, con marcador y relato sincronizados; resultados y estadísticas de una fecha pendiente se ocultan hasta terminar o saltar la repetición.
- Las estadísticas individuales se guardan por partido y temporada, antes de compactar replays y antes de cambiar de temporada. Incluyen las acciones respaldadas por eventos, minutos, puntos y tarjetas cuando corresponden. Los partidos antiguos incompletos conservan datos desconocidos como tales; no se reconstruyen estadísticas individuales ficticias para torneos paralelos.
- La interfaz se renovó hacia un diseño tipo manager con navegación y perfil de jugador. Una revisión inicial en Chrome verificó el portal, el perfil, tácticas, mercado y replay en escritorio, y el perfil en móvil; aún conviene ampliar las pruebas con distintas pantallas y sesiones.

## Datos y honestidad de las fuentes

El catálogo actual registra 1.052 identidades en `research/catalog.json`, 40 con fecha de nacimiento allí documentada, 282 registros en `research/youth.json` y 46 perfiles elegibles documentados de argentinos en el exterior. Son registros parciales: una aparición histórica en una planilla no garantiza afiliación actual. No se debe inventar puesto o edad para completar huecos.

La fecha de juego inicial es el 10/11/2026. Fechas de nacimiento documentadas y edades aproximadas se distinguen; la comunidad puede sugerir datos y la edad estimada se marca como tal. No usar padrones electorales ni perfiles privados para completar edades. Matías Medrano está documentado como transferido a Benetton; evitar duplicarlo en un plantel local y el mercado exterior. Las ilustraciones de camisetas no son fotografías oficiales.

Archivos de fuentes: `research/catalog.json`, `age-verification.json`, `returns.json`, `youth.json`, `names.json` y `research/history/`. Las cifras y fuentes están sujetas a revisión, y las valoraciones y contactos siempre son estimaciones de juego.

## Arquitectura y persistencia

| Ruta | Función |
| --- | --- |
| `src/engine/index.ts` | Simulación, formación, calendario, reproducción, proyección de desarrollo, cantera, salidas y regresos. |
| `web/domain.js` | Reglas de temporada, ligas, categorías paralelas, lesiones, entrenamiento, migraciones y estadísticas. |
| `web/player-stats.js` | Historial individual por fixture/temporada y agregados con corte anti-spoiler. |
| `web/app.js`, `web/index.html`, `web/style.css` | Interfaz web y perfil del jugador. |
| `server/worker.js` | API de ligas, cuentas/sesiones, aportes comunitarios, control de acceso y persistencia R2 con ETag. |
| `server/local.mjs` | Servidor de desarrollo local; no es publicación online. |
| `scripts/build.mjs`, `scripts/build-standalone.mjs` | Empaquetan el Worker y la versión web autónoma. |
| `tests/`, `src/engine/index.test.ts` | Pruebas de motor, estadísticas, migración, datos, servidor y temporada. |

La migración a `DATA_VERSION=18` incorpora la convocatoria URBA M17 2026 en ligas de 2026/27 sin borrar progreso ni duplicar identidades; en 2027 conserva un año de permanencia y no inventa trayectorias para ausentes en 2028+. La migración previa completa camadas parciales anteriores de ocho a quince y registra datos recuperables de los partidos antes de modificar fixtures y reorganiza los equipos superiores sin borrar atributos, IDs, formación, historial ni resultados. Los registros incompletos no se rellenan con cifras inventadas. La escritura de la liga conserva control de versión y ETag para evitar avances concurrentes.

## Calibración y pendientes

`research/history/engine-weights-report.md` documenta el ajuste del 12/11/2026 y la simulación de 1.000 temporadas. Se ajustaron fuerzas de 36 clubes y el efecto de Rush; el reporte da Newman–CASI cerca de 70 % para Newman local y margen +10,3, todavía superior al margen empírico estimado de +5/+6. Hay que seguir revisando la dispersión y los enfrentamientos contra datos históricos, sin imponer una probabilidad arbitraria. Las categorías paralelas no están calibradas con resultados históricos de sus categorías.

Otros pendientes: mejorar cobertura y contraste de planteles; ampliar el rugby del Interior; revisar más temporadas y la evolución de una carrera completa; probar ligas con varias personas y condiciones de red reales; evaluar y perfeccionar la interfaz en escritorio y móvil.

## Pruebas y publicación

La integración ejecutó compilación y 64 pruebas automáticas de motor, datos, estadísticas, persistencia, temporadas, permisos, servidor y empaquetado. En Chrome se revisaron el portal a 1280×800, el perfil, tácticas, mercado y replay, y el perfil a 390 px sin desbordamiento horizontal. Un smoke con DOM simulado recorrió el HTML autónomo de la versión previa y comprobó el ocultamiento de resultados hasta el final o salto confirmado; el empaquetado de v18 también pasó la prueba automatizada de sintaxis. Quedan por probar más sesiones reales y dispositivos.

La versión web privada aún debe verificarse como desplegada antes de presentarla como online. El proyecto Sites existente es `appgprj_6af32ed16b2c81918a7191a06dd1d8a7`; no crear otro ni cambiar su audiencia sin instrucción. El bloqueo anterior fue DNS al sincronizar el código; una dirección esperada no prueba publicación. Un servidor local disponible solo funciona en el equipo donde se ejecuta y no permite que amigos entren desde fuera.

Los archivos de Biblioteca con IDs `libfile_32fcdab15e8881919a4be31a97aba201` (demo HTML) y `libfile_11488f6a2f30819183dd98f7bdd0ac57` (fuente ZIP) corresponden a la versión anterior v17: **todavía no incorporan los 28 juveniles de v18**. El código local v18 compiló y pasó las pruebas; se generaron copias temporales HTML y ZIP, pero no se han guardado en esos dos archivos. Ninguno de ellos demuestra un despliegue online.

## Próximos pasos

1. Completar QA de la interfaz real y probar perfil, estadísticas con fecha pendiente, entrenamiento y replay en escritorio y móvil.
2. Confirmar con una liga guardada la migración idempotente, el desarrollo flexible, el archivo de temporadas y un regreso al mismo club e identidad.
3. Seguir calibrando con resultados históricos y ampliar datos con fuentes verificables.
4. Si se autoriza/permite el despliegue, sincronizar exactamente el código validado al sitio existente, publicar conservando su audiencia privada y comprobar el resultado real. Resolver acceso de amigos por separado.
