# Auditoría de reglas en una partida larga

Script: `scripts/playtest/rules-audit.mjs` (datos crudos en `research/playtest/rules-audit-data.json`).
Se ejecuta con `node scripts/playtest/rules-audit.mjs` (3 semillas en paralelo, unos 3 minutos) o con `--seed 101 [--seasons 6]` para una sola. Requiere `npm run build`.

## Qué se jugó

- 3 semillas: **101, 202 y 303**, 6 temporadas cada una (2026 a 2031), con playoffs, mundo creado con `initialWorld` y los mismos datos que usa `npm run build` (`mergeResearch` + `addClubExtras`).
- Tres clubes con manager (`keep`): Regatas Bella Vista (Top 14), Lomas Athletic (Primera A) y Delta (Primera B). Sus acciones: tácticas, plan juvenil, plan de entrenamiento, XV a mano, sesión individual, reconversión, promoción M19, cambio de categoría del plantel superior y **un contacto de mercado por fecha** (70 % de las fechas).
- Antes de **cada fecha** el mundo pasa por `JSON.parse(JSON.stringify(...))`; al empezar cada temporada se llama a `migrateWorld`, y en 2027 y 2030 además a una liga con `dataVersion = 15` (migración vieja). Cada cambio de temporada también parte de un mundo recargado.
- Determinismo: en las fechas 1, 13, 27 y 28 (y en cada cambio de temporada) se avanza el mundo en memoria y el recargado y se comparan los JSON byte a byte.
- Resumen: 3 × 6 = 18 temporadas, unas 480 fechas con 21 partidos y 18 cambios de temporada. **Ningún error lanzado.** Las tablas, los playoffs y los ascensos se recalculan de forma independiente del motor.

## Resumen

| Grado | Hallazgos |
| --- | --- |
| Roto | 2 (uno sistemático, uno raro) |
| Sospechoso | 9 |
| Bien | todo el resto (lista abajo) |

## ROTO

### 1. Un contacto de mercado de la temporada anterior bloquea el contacto de esta (sistemático)

- **Qué pasa:** `world.transfers.contacts[clubId]` guarda el número de fecha del último contacto y **no se reinicia al cambiar de temporada**. Si en la fecha N de la temporada nueva el manager contacta, el servidor responde «Ya hiciste un contacto en esta fecha» sin haber contactado nunca en esa fecha.
- **Cuándo:** pasó 3 veces en cada semilla, sin haber contactado antes: semilla 101, 2028 fecha 7 (Regatas, `contacts = {regatas: 7, ...}` heredado de 2027); semilla 202, 2028 fecha 13; semilla 303, 2028 fecha 12.
- **Responsable:** `contactPlayer` / `advanceSeasonWorld` (no limpia `transfers.contacts`; `E.advanceSeason` solo reinicia `trainingRounds`).
- **Arreglo posible:** al cambiar de temporada dejar `transfers: {log: viejo, contacts: {}, refused: {}}`. Con ese mismo cambio se resuelve el sospechoso 2.

### 2. XV con un jugador fuera de puesto cuando no queda nadie sano del puesto (raro: 1 caso en 18 temporadas)

- **Dónde:** semilla 101, 2031, fechas 16 (control del XV) y 17 (partido `primera-b-17-san-patricio-vicentinos`): Vicentinos jugó con un medio scrum de centro (dorsal 13).
- **Causa:** Vicentinos tenía 5 jugadores que pueden jugar de centro, 4 lesionados (8 lesionados en el plantel superior) y el XV guardado. `selection` rellena con «cualquiera» cuando no queda nadie del puesto (`?? senior.find(...)`, igual que el último recurso de `autoLineup`).
- **Responsable:** `selection` / `effectiveLineup` / `autoLineup` en `src/engine/index.ts`. Contradice la regla «nadie juega fuera de puesto», aunque solo con el plantel casi sin centros. En los otros 17 mundos no se repitió.

## SOSPECHOSO

| # | Qué | Cuántos | Dónde / responsable |
| --- | --- | --- | --- |
| 1 | **El mercado ignora la promesa de rol y rearma todo el plantel del comprador.** Se ofrece «XV» y el jugador queda en «Pre B»; además cambia de categoría un promedio de 30 jugadores del club (las asignaciones manuales de `assign-senior` se pierden). | Casi todos los fichajes: 97, 96 y 82 casos de 20–107 aceptados por semilla; entre 33 y 39 jugadores cambian de categoría por fichaje (ej. semilla 101, 2026 fecha 1, Regatas ← Vicentinos). | `contactPlayer` llama a `assignSeniorGroups` sobre todo el club, que pisa `seniorSquad` y la promesa (`player.promise` se guarda pero no se cumple). |
| 2 | **Los rechazos y `contacts` no se limpian al cambiar de temporada.** «Un rechazo vale toda la temporada» queda vetado para siempre: 31–34 pares vetados tras 2026, 129–147 tras 2031. El registro `transfers.log` también crece sin límite (20 → 103–107 entradas). | Todas las semillas, todas las temporadas. | `advanceSeasonWorld` (`transfers`). |
| 3 | **Las categorías Intermedia / Pre A / Pre B no siempre pueden armar 15 con puesto.** Con 60–64 jugadores en el plantel superior no alcanza para cuatro equipos de 15 y las lesiones lo agravan. En Pre B, 28–32 de 42 clubes tienen al menos un puesto sin jugador a mitad de temporada (entre 32 y 96 puestos de 630); en Pre A hay entre 3 y 20 jugadores fuera de puesto. Con M19 hubo 6–9 puestos sin nadie en 2026–2028. El motor lo tapa con un relleno de nivel −10 (`categoryTeams`), así que no se rompe. | Todas las semillas. | `categoryTeams` / `playParallelRound`; el reparto en tercios de `assignSeniorGroups` deja grupos propios de 5–13 jugadores (Pre A de Hindú: 5–7). |
| 4 | **El plantel superior se desborda en los clubes con muchas reservas reales.** Alumni 153, BA C&RC 148 y Atlético del Rosario 133 al crear la liga (límite de mercado: 130); a partir de 2028 llegan a 177–180 (BA C&RC, Alumni, Champagnat 159–164). Hay 3 clubes sobre 130 en 2026–27 y 5–7 en 2028–31. El plantel medio pasa de 77,7 a 84; el total de jugadores del mundo de 4.584 a 6.049 (+32 %). Los clubes chicos se quedan en 59–64. | Todas las semillas. | `squadTurnover` solo da de baja a ficticios; los documentados casi nunca se retiran (sin edad conocida, solo desde 9 temporadas en Primera). Contradice el «~64 estable» de AGENTS.md, que es anterior a las reservas reales. Mercado: los managers chocan con el tope («Tu plantel superior está completo (130)»: 79–92 veces por semilla). |
| 5 | **Banco con hueco.** Si no hay otro jugador sano del puesto del pilar izquierdo (o de la segunda línea) el suplente queda vacío (`''` en `homeLineup`/`awayLineup`). | 5 partidos de un mismo club (semilla 101, 2027 fecha 26: `top-14-26-hindu-curupayti`, visitante) y 1 (semilla 303, 2029 fecha 3, `primera-a-3-champagnat-deportiva-francesa`, visitante). | `simulateFixture` (`bench = [slot 0, slot 3]` por puesto). No hay error: las estadísticas lo ignoran. |
| 6 | **Atributos por encima del `potential`.** El campo `potential` no cambia nunca (0 cambios en 18 temporadas) y no limita nada: 7 % de los jugadores lo tienen superado al crear la liga (307 de 4.424) y 32 % a la sexta temporada (≈1.720 de 5.413). El tope real de crecimiento es el techo de `developmentProfile`. | Todas las semillas. | `potential` es un campo heredado; la interfaz lo muestra como «potencial». |
| 7 | **El declive crece cada año.** Los atributos que bajan en el cambio de temporada (físico de los 33+/Veteranos) pasan de ≈350 a ≈1.150 por temporada; los que suben son ≈100. Se debe a que los jugadores documentados sin edad pasan a «Veterano» (7 temporadas en Primera) y bajan 1 punto de ritmo, aceleración y resistencia por año hasta retirarse. | Todas las semillas. | `advanceSeasonWorld` (`careerStage === 'declining'`). |
| 8 | **El objetivo del club usa `club.strength`, que se desfasa del plantel real.** La correlación de Spearman entre fuerza y nivel del XV por división en el Top 14 va de 0,82 al crear la liga a 0,63–0,98 según la temporada y la semilla (mínimo 0,63, semilla 303, 2030). Ejemplos: Deportiva Francesa, 5.º por fuerza y 1.º por XV en Primera B (objetivo «Alta» en vez de «Máxima»); Curupaytí 4.º por fuerza y 8.º por XV en Primera A. Los objetivos tienen siempre el mismo reparto (2 Máxima, 3 Alta, 5 Media, 4 Baja), lo que es razonable. | Todas las semillas. | `clubObjective` (usa `strength` y no el nivel de la plantilla). |
| 9 | **Tamaño y tiempo** (ver abajo): el mundo llega a 14 MB; es el número a vigilar para R2 y el Worker. | — | — |

## Bien (sin una sola violación en las 3 semillas × 6 temporadas)

**Calendario y tabla**
- Todos los partidos jugados en cada fecha (21 por fecha regular, 26 fechas + semifinales y final).
- Tabla recalculada de forma independiente = `getStandings`; cada club juega 26 partidos, 13 de local y 13 de visitante; cada cruce una vez de local y otra de visitante; puntos a favor = puntos en contra.

**Playoffs y ascensos**
- Semifinales Top 14: 1.º vs 4.º y 2.º vs 3.º, de local el mejor ubicado.
- Semifinales Primera A y B: 2.º vs 5.º y 3.º vs 4.º; final en cancha neutral entre los ganadores; los playoffs no suman en la tabla.
- Los empates se resolvieron por tries y luego por ubicación (hubo playoffs empatados en la semilla 101, 2026, y en la 303, 2026 a 2028; el resultado coincide con `playoffWinner`).
- Después de cada cambio de temporada hay exactamente 14 clubes por división (42 en total) y los clubes que se movieron son los esperados:
  - Top 14: bajan el 13.º y el 14.º.
  - Primera A: sube el 1.º y el ganador de la final, y bajan los dos últimos.
  - Primera B: suben el 1.º y el ganador de la final.
- Calendario nuevo de 546 partidos, ninguno jugado.

**Planteles y jugadores**
- Ids únicos en el mundo; ningún jugador en dos clubes ni en un club y en el exterior a la vez.
- Todos los XV (de cada club, antes de cada fecha y en cada partido) tienen 15 distintos, sin lesionados y en puesto, salvo el caso raro de arriba (ver ROTO 2). El XV guardado por el manager se respeta cuando es válido.
- Atributos: 26 por jugador, enteros entre 1 y 20, sin `NaN` ni `Infinity` en todo el mundo; físico entre 0 y 100.
- Edades: las conocidas suman +1 por temporada (≈75–120 por temporada), las ficticias suman +1, las desconocidas siguen desconocidas (≈2.100), y las fechas de nacimiento acreditadas o estimadas no cambian.
- Categorías paralelas: las cinco juegan cada fecha regular, no juegan playoffs y se reinician al cambiar de temporada; hay 15 campeones paralelos archivados por temporada (tope 300), y coinciden con la tabla.
- Tamaños M19 y M17: 15–40 y 15–30. El M17 de 2026 es 15 y sube a 30 cuando conviven dos camadas.
- Altas y bajas: todas las bajas por retiro o tope tienen aviso en Novedades (160–630 por temporada). Los ids de las camadas nuevas no reutilizan los del archivo de estadísticas.

**Estadísticas y archivo**
- `world.playerStats`: las temporadas anteriores se conservan intactas (hash por temporada), la actual se completa con las fechas y una vuelta por JSON no duplica nada (`recordPlayerStats` es idempotente).
- Una entrada por partido jugado (incluidos playoffs); índices contiguos; tries y puntos de los jugadores suman el marcador de cada lado y siempre hay 15 titulares. Sin valores desconocidos.

**Serialización**
- El resultado de avanzar es idéntico entre el mundo en memoria y el recargado desde JSON (fechas 1, 13, 27, 28 y cada cambio de temporada). `migrateWorld` no toca una liga actual; migrar desde la versión 15 en 2027 y 2030 no duplica ids ni cambia el número de jugadores.

**Palmarés y Novedades**
- `world.honours` suma 3 por temporada y el campeón coincide con la final del Top 14 y la tabla de Primera A y B.
- Las novedades quedan en 2.000 y las lesiones por club se mantienen estables: 87–108 lesionados en toda la liga en promedio (2–3 por club) y un máximo de 106–135.

**Mercado**
- 51–248 contactos por semilla (17–107 aceptados): cada traspaso aceptado mueve al jugador exactamente una vez (comprador +1, vendedor −1, id único, registro `from`/`to` correcto, sin quedar en el XV guardado del vendedor).
- Un rechazo no mueve al jugador y queda registrado; la contraoferta del mismo jugador en la misma temporada se bloquea; un segundo contacto en la misma fecha se rechaza.
- No se pueden contactar jugadores de otros clubes con manager.
- Acciones de manager aceptadas sin errores inesperados: 72 tácticas, 72 planes juveniles, 72 planes de entrenamiento, 126 XV, 468 sesiones individuales, 90 reconversiones, 90 promociones, 90 cambios de categoría por semilla.

## Tamaño y tiempo

Medido con tres clubes con manager (`keep`), el resto sin repetición.

**Tamaño del mundo**

| Temporada | Inicio (MB) | Mitad | Fin (MB) |
| --- | --- | --- | --- |
| 2026 | 3,39 | 6,6 | 9,7 |
| 2027 | 5,06 | 8,1 | 11,0 |
| 2028 | 5,9 | 8,9 | 11,8 |
| 2029 | 6,7 | 9,6 | 12,5 |
| 2030 | 7,4 | 10,4 | 13,3–13,5 |
| 2031 | 8,0 | 11,0 | 14,0 |

- Crece ≈ 0,8 MB por temporada de partida, y dentro de una temporada ≈ 6 MB (fixtures con repetición de los 3 clubes: 5,2 MB estables).
- Al final de la sexta temporada: clubes 5,7 MB, fixtures 5,2 MB, `playerStats` 2,65 MB (0,46 MB a la primera), novedades 0,35 MB, paralelas 0,08 MB.
- Los jugadores del mundo pasan de 4.584 a 6.049.

**Tiempo** (una fecha de 21 partidos con repetición de 3 clubes, sin contar el recargado JSON)

| Medida | Valor |
| --- | --- |
| Primera pasada | 245–300 ms por fecha, máximo 400 ms, 7–8 s por temporada, cambio de temporada 0,28–0,36 s |
| Segunda pasada (otra carga de la máquina) | 310 → 580 ms por fecha; la diferencia es ruido de la máquina, no del código |
| Temporada completa con auditoría | 15–36 s |
| Partida de 6 temporadas, 3 semillas en paralelo | 100–208 s |

Aviso: el Worker guarda un objeto por liga; a 14 MB la serialización de cada acción ya es notoria, y cada acción reescribe el objeto entero.

## Riesgos que quedaron sin cubrir

- La repetición 2D y la interfaz no se tocaron (esto es solo el modelo).
- Las acciones de los managers de otros clubes (hay tres) y las aportaciones de la comunidad no se simularon en conjunto.
- El «ida y vuelta por JSON» corre en memoria: no pasa por el Worker ni R2, ni por el límite de tamaño de cada escritura condicional.
- La mezcla de datos reales ocurre solo en 2026; las edades estimadas solo se comparan con sus mismas fechas.

## Cómo reproducir

```sh
npm run build
node scripts/playtest/rules-audit.mjs --seed 101      # roto 2: 2031 fecha 16/17; roto 1: 2028 fecha 7; banco vacío: 2027 fecha 26
node scripts/playtest/rules-audit.mjs --seed 202      # roto 1: 2028 fecha 13
node scripts/playtest/rules-audit.mjs --seed 303      # roto 1: 2028 fecha 12; banco vacío: 2029 fecha 3
```

Cada semilla escribe `/tmp/rules-audit-<semilla>.json` con todos los números por temporada.
