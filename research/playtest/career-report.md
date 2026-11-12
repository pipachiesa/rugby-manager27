# Prueba de carrera: ¿puede un club chico escalar y pelear con los grandes?

Fecha: 12/11/2026. Datos: `research/playtest/raw/*.jsonl` (240 carreras) y `raw2/*.jsonl` (80 de ablación). Scripts: `scripts/playtest/career-sim.mjs` (simulador, política documentada en su cabecera) y `scripts/playtest/career-aggregate.mjs` (tablas). No se tocó `web/`, `src/`, `server/` ni `tests/`.

## Método

- Mundo nuevo de 2026 con semilla `seed*101`; **5 temporadas encadenadas** con `advanceWorld` (playoffs incluidos) y `advanceSeasonWorld`. El club con manager va en `keep = new Set([clubId])`, como en la interfaz.
- Clubes: **Champagnat** (Top 14, el más débil: fuerza 10,26), **GEBA** (Primera A, 7º de 14) y **Delta** (Primera B, 12º de 14). **40 carreras por club y política** (240 en total), más 20 por club en las ablaciones. Tiempo: ~2 s por temporada, ~11 s por carrera; todo se corrió en 10 procesos en paralelo en unos 15 minutos.
- **Pasiva:** no hace nada (el XV y las tácticas quedan en automático).
- **Activa** (manager razonable): cada fecha usa el único contacto del mercado (blanco: el jugador que mejora el XV en 1,5 o más, ordenado por mejora × probabilidad de aceptar, mínimo 20 %, ofreciendo «XV»), la única sesión individual (titulares con 90 o más de físico, o los 6 mejores suplentes; atributo con más peso en su puesto), el mejor XV, tácticas según forwards contra backs, plan juvenil (Contacto si hay mayoría de forwards, si no Técnica) y hasta 2 promociones de M19 por temporada. No usa reconversión.
- «XV» = promedio de valoración de los 15 titulares. «XV top-4» = promedio de los 4 mejores XV del Top 14 de ese año.
- Limitaciones: el manager activo es una política simple, no el techo de un humano; los otros 13 clubes no hacen nada (no hay otro manager); 5 temporadas es poco para el Top 14.

## Resultados por club y política

Las tablas muestran, por temporada, cuántas de las carreras jugaron en cada división (T14 / PA / PB = Top 14 / Primera A / Primera B), el puesto medio en la división que jugaron y la brecha de XV con el top-4.


#### Champagnat (Top 14, 14º en fuerza) — passive (40 carreras)

| Temporada | Div. jugada (T14/PA/PB) | Puesto medio | % Top 14 | % playoffs | % título (Top 14) | XV del club | XV top-4 | XV propio - top-4 |
|---|---|---|---|---|---|---|---|---|
| 2026 | T14 40 / PA 0 / PB 0 | 13.9 | 100% | 0% | 0% | 56.4 | 66.9 | -10.5 |
| 2027 | T14 0 / PA 40 / PB 0 | 4.5 | 0% | 0% | 0% | 56.2 | 66.5 | -10.3 |
| 2028 | T14 8 / PA 32 / PB 0 | 6.7 | 20% | 0% | 0% | 56.2 | 66.0 | -9.8 |
| 2029 | T14 9 / PA 31 / PB 0 | 6.3 | 23% | 0% | 0% | 56.0 | 65.4 | -9.5 |
| 2030 | T14 9 / PA 31 / PB 0 | 7.3 | 23% | 0% | 0% | 55.6 | 64.8 | -9.2 |

P(jugar Top 14 en alguna de las 5 temporadas) = 100%; P(estar en Top 14 en la 5ª o ascender al cierre) = 100%; P(Top 14 en la 5ª) = 23%
P(algún playoff del Top 14) = 0%; P(título URBA) = 0%; P(finalista) = 0%; P(campeón/ascenso de A o B) = 65%
Ascensos medios por carrera = 0.8; descensos medios = 1.5; plantel superior al final = 68.1; fichajes aceptados en 5 temporadas = 0.0 de 0.0 contactos; sesiones = 0.0; promovidos = 0.0

#### Champagnat (Top 14, 14º en fuerza) — active (40 carreras)

| Temporada | Div. jugada (T14/PA/PB) | Puesto medio | % Top 14 | % playoffs | % título (Top 14) | XV del club | XV top-4 | XV propio - top-4 |
|---|---|---|---|---|---|---|---|---|
| 2026 | T14 40 / PA 0 / PB 0 | 13.5 | 100% | 0% | 0% | 59.3 | 66.8 | -7.5 |
| 2027 | T14 4 / PA 36 / PB 0 | 3.6 | 10% | 0% | 0% | 60.3 | 66.5 | -6.2 |
| 2028 | T14 22 / PA 18 / PB 0 | 7.2 | 55% | 0% | 0% | 61.5 | 65.9 | -4.4 |
| 2029 | T14 25 / PA 15 / PB 0 | 6.4 | 63% | 5% | 0% | 62.2 | 65.4 | -3.2 |
| 2030 | T14 32 / PA 8 / PB 0 | 6.5 | 80% | 20% | 3% | 62.9 | 64.8 | -1.9 |

P(jugar Top 14 en alguna de las 5 temporadas) = 100%; P(estar en Top 14 en la 5ª o ascender al cierre) = 100%; P(Top 14 en la 5ª) = 80%
P(algún playoff del Top 14) = 23%; P(título URBA) = 3%; P(finalista) = 8%; P(campeón/ascenso de A o B) = 95%
Ascensos medios por carrera = 1.1; descensos medios = 1.3; plantel superior al final = 83.2; fichajes aceptados en 5 temporadas = 18.4 de 66.0 contactos; sesiones = 132.7; promovidos = 8.7

#### GEBA (Primera A, 7º) — passive (40 carreras)

| Temporada | Div. jugada (T14/PA/PB) | Puesto medio | % Top 14 | % playoffs | % título (Top 14) | XV del club | XV top-4 | XV propio - top-4 |
|---|---|---|---|---|---|---|---|---|
| 2026 | T14 0 / PA 40 / PB 0 | 7.6 | 0% | 0% | 0% | 55.0 | 66.9 | -11.9 |
| 2027 | T14 0 / PA 39 / PB 1 | 7.4 | 0% | 0% | 0% | 55.5 | 66.5 | -11.1 |
| 2028 | T14 1 / PA 39 / PB 0 | 7.5 | 3% | 0% | 0% | 55.9 | 66.0 | -10.2 |
| 2029 | T14 0 / PA 40 / PB 0 | 7.2 | 0% | 0% | 0% | 56.2 | 65.4 | -9.3 |
| 2030 | T14 0 / PA 40 / PB 0 | 6.2 | 0% | 0% | 0% | 56.4 | 64.8 | -8.4 |

P(jugar Top 14 en alguna de las 5 temporadas) = 3%; P(estar en Top 14 en la 5ª o ascender al cierre) = 5%; P(Top 14 en la 5ª) = 0%
P(algún playoff del Top 14) = 0%; P(título URBA) = 0%; P(finalista) = 0%; P(campeón/ascenso de A o B) = 8%
Ascensos medios por carrera = 0.1; descensos medios = 0.1; plantel superior al final = 64.0; fichajes aceptados en 5 temporadas = 0.0 de 0.0 contactos; sesiones = 0.0; promovidos = 0.0

#### GEBA (Primera A, 7º) — active (40 carreras)

| Temporada | Div. jugada (T14/PA/PB) | Puesto medio | % Top 14 | % playoffs | % título (Top 14) | XV del club | XV top-4 | XV propio - top-4 |
|---|---|---|---|---|---|---|---|---|
| 2026 | T14 0 / PA 40 / PB 0 | 4.9 | 0% | 0% | 0% | 57.8 | 66.8 | -9.0 |
| 2027 | T14 4 / PA 36 / PB 0 | 4.8 | 10% | 0% | 0% | 59.3 | 66.5 | -7.2 |
| 2028 | T14 13 / PA 27 / PB 0 | 6.0 | 33% | 0% | 0% | 61.1 | 65.9 | -4.8 |
| 2029 | T14 14 / PA 26 / PB 0 | 4.9 | 35% | 0% | 0% | 62.3 | 65.4 | -3.1 |
| 2030 | T14 30 / PA 10 / PB 0 | 6.5 | 75% | 3% | 0% | 63.8 | 64.9 | -1.2 |

P(jugar Top 14 en alguna de las 5 temporadas) = 88%; P(estar en Top 14 en la 5ª o ascender al cierre) = 100%; P(Top 14 en la 5ª) = 75%
P(algún playoff del Top 14) = 3%; P(título URBA) = 0%; P(finalista) = 0%; P(campeón/ascenso de A o B) = 100%
Ascensos medios por carrera = 1.4; descensos medios = 0.4; plantel superior al final = 68.2; fichajes aceptados en 5 temporadas = 19.4 de 77.1 contactos; sesiones = 133.2; promovidos = 7.8

#### Delta (Primera B, 12º) — passive (40 carreras)

| Temporada | Div. jugada (T14/PA/PB) | Puesto medio | % Top 14 | % playoffs | % título (Top 14) | XV del club | XV top-4 | XV propio - top-4 |
|---|---|---|---|---|---|---|---|---|
| 2026 | T14 0 / PA 0 / PB 40 | 10.6 | 0% | 0% | 0% | 45.9 | 66.9 | -21.0 |
| 2027 | T14 0 / PA 0 / PB 40 | 10.1 | 0% | 0% | 0% | 46.2 | 66.5 | -20.3 |
| 2028 | T14 0 / PA 0 / PB 40 | 10.2 | 0% | 0% | 0% | 46.5 | 66.0 | -19.6 |
| 2029 | T14 0 / PA 0 / PB 40 | 10.9 | 0% | 0% | 0% | 46.7 | 65.4 | -18.7 |
| 2030 | T14 0 / PA 0 / PB 40 | 10.0 | 0% | 0% | 0% | 46.9 | 64.8 | -17.9 |

P(jugar Top 14 en alguna de las 5 temporadas) = 0%; P(estar en Top 14 en la 5ª o ascender al cierre) = 0%; P(Top 14 en la 5ª) = 0%
P(algún playoff del Top 14) = 0%; P(título URBA) = 0%; P(finalista) = 0%; P(campeón/ascenso de A o B) = 0%
Ascensos medios por carrera = 0.0; descensos medios = 0.0; plantel superior al final = 64.0; fichajes aceptados en 5 temporadas = 0.0 de 0.0 contactos; sesiones = 0.0; promovidos = 0.0

#### Delta (Primera B, 12º) — active (40 carreras)

| Temporada | Div. jugada (T14/PA/PB) | Puesto medio | % Top 14 | % playoffs | % título (Top 14) | XV del club | XV top-4 | XV propio - top-4 |
|---|---|---|---|---|---|---|---|---|
| 2026 | T14 0 / PA 0 / PB 40 | 6.0 | 0% | 0% | 0% | 50.3 | 66.9 | -16.6 |
| 2027 | T14 0 / PA 8 / PB 32 | 4.0 | 0% | 0% | 0% | 53.2 | 66.5 | -13.3 |
| 2028 | T14 0 / PA 26 / PB 14 | 5.9 | 0% | 0% | 0% | 56.6 | 66.0 | -9.4 |
| 2029 | T14 1 / PA 37 / PB 2 | 5.5 | 3% | 0% | 0% | 58.4 | 65.4 | -7.0 |
| 2030 | T14 5 / PA 35 / PB 0 | 4.3 | 13% | 0% | 0% | 60.3 | 64.8 | -4.5 |

P(jugar Top 14 en alguna de las 5 temporadas) = 15%; P(estar en Top 14 en la 5ª o ascender al cierre) = 57%; P(Top 14 en la 5ª) = 13%
P(algún playoff del Top 14) = 0%; P(título URBA) = 0%; P(finalista) = 0%; P(campeón/ascenso de A o B) = 100%
Ascensos medios por carrera = 1.7; descensos medios = 0.1; plantel superior al final = 70.3; fichajes aceptados en 5 temporadas = 35.8 de 123.0 contactos; sesiones = 133.3; promovidos = 7.0

#### Deriva de la liga (XV medio por división y de los grandes, promedio de todas las carreras)

| Política | Temporada | Top 14 | Primera A | Primera B | Newman | CASI | SIC | Alumni | Hindú |
|---|---|---|---|---|---|---|---|---|---|
| passive | 2026 | 63.1 | 55.0 | 47.1 | 68.5 | 66.7 | 66.5 | 64.8 | 65.1 |
| passive | 2027 | 62.7 | 55.1 | 47.6 | 68.4 | 66.7 | 66.3 | 64.0 | 63.9 |
| passive | 2028 | 62.4 | 55.4 | 47.8 | 67.7 | 66.2 | 66.0 | 63.6 | 62.8 |
| passive | 2029 | 62.0 | 55.5 | 48.1 | 67.6 | 65.1 | 65.3 | 63.2 | 61.6 |
| passive | 2030 | 61.6 | 55.6 | 48.5 | 67.2 | 63.7 | 64.5 | 62.9 | 60.7 |
| active | 2026 | 63.2 | 55.1 | 47.2 | 68.4 | 66.7 | 66.5 | 64.8 | 65.1 |
| active | 2027 | 62.7 | 55.3 | 47.8 | 68.3 | 66.8 | 66.2 | 63.9 | 63.8 |
| active | 2028 | 62.5 | 55.7 | 48.0 | 67.5 | 66.3 | 65.9 | 63.6 | 62.8 |
| active | 2029 | 62.0 | 55.8 | 48.3 | 67.5 | 65.0 | 65.4 | 63.2 | 61.5 |
| active | 2030 | 61.7 | 56.0 | 48.6 | 67.0 | 63.6 | 64.4 | 62.9 | 60.7 |


## Ablaciones: ¿qué palanca pesa? (20 carreras por celda, XV al cabo de 5 temporadas)

| Club | Pasiva | Solo entrenamiento (sesión, cantera, promociones) | Solo mercado | Activa (todo) |
|---|---|---|---|---|
| Champagnat: XV año 5 (año 1 con la política) | 55,5 | 60,9 | 59,4 | 63,0 |
| Champagnat: en Top 14 en el año 5 | 15 % | 55 % | 50 % | 85 % |
| Delta: XV año 5 | 46,9 | 50,7 | 57,2 | 60,3 |
| Delta: en Top 14 en el año 5 | 0 % | 0 % | 0 % | 5 % |
| Fichajes aceptados en 5 temporadas | 0 | 0 | 23 (Champ.) / 41 (Delta) | 19 / 36 |

El mercado es la palanca más fuerte para un club de abajo (Delta +10 puntos de XV solo con fichajes); el entrenamiento y la cantera aportan unos +4 a +5 a lo largo de 5 temporadas. Se suman casi sin solaparse.

## Cómo evolucionan los grandes

(Ver la última tabla.) **Todo el mundo se achata:** el XV medio del Top 14 baja de 63,1 a 61,6 en 5 temporadas y el top-4 de 66,9 a 64,8 (-2,1). Newman casi se mantiene (68,5 a 67,2), pero CASI cae 3,0, SIC 2,0, Alumni 1,9 y Hindú 4,4. Primera A sube 0,6 y Primera B 1,4. Es igual con política pasiva o activa: los fichajes del club activo (36 en 5 años en Delta) no se notan en el promedio de los grandes, porque salen repartidos. La deriva viene de los clubes sin manager, que envejecen, retiran jugadores (`squadTurnover`) y no recompran; no verificado a fondo qué parte es retiro de reales mayores y qué parte falta de reposición. Consecuencia: con los años subir se vuelve más fácil sin que el manager haga nada.

## Datos clave

| Pregunta | Champagnat (T14) | GEBA (Pr. A) | Delta (Pr. B) |
|---|---|---|---|
| Año 1 sin hacer nada: puesto | 13,9º (desciende el 100 %) | 7,6º | 10,6º |
| Año 1 activo: puesto medio | 13,5º (desciende el 100 %) | 4,9º | 6,0º |
| Activa: título o ascenso de A/B en algún año | 95 % | 100 % | 100 % |
| Activa: juega Top 14 en el año 5 | 80 % | 75 % | 13 % |
| Activa: llega a algún playoff del Top 14 en 5 años | 23 % | 3 % | 0 % |
| Activa: finalista / campeón URBA | 8 % / 3 % (1 de 40) | 0 % / 0 % | 0 % / 0 % |
| Mejor puesto en el Top 14 (activa): mediana de la mejor temporada | 7º (mejor: 3º, 8 carreras entre 3º y 4º) | 8º (mejor: 4º) | 10º (mejor: 8º) |
| Pasiva: juega Top 14 en el año 5 | 23 % | 0 % | 0 % |
| Pasiva: playoffs / título | 0 % / 0 % | 0 % / 0 % | 0 % / 0 % |
| Brecha de XV con el top-4 al cabo de 5 años, activa (pasiva) | -1,9 (-9,2) | -1,1 (-8,4) | -4,5 (-17,9) |

P(llegar a jugar Top 14 en la 5ª temporada con política activa): Champagnat 80 %, GEBA 75 %, Delta 13 % (57 % de Delta ya ascendió a Primera A y es de los dos primeros al cerrar la 5ª, así que entra al Top 14 en la 6ª).

## Observaciones sobre cosas rotas o explotables

1. **Mercado demasiado generoso para un club que sube de nivel.** 29 % de aceptación sobre 123 contactos en Delta (36 fichajes en 5 temporadas, 7 por año). Un contacto por fecha son 26 intentos por año y el tope de probabilidad es 0,85, así que un humano constante arma un XV nuevo en 2 o 3 temporadas. El plantel superior pasa de 64 a 83–85 (Champagnat con mercado) porque no hay acción para dar de baja: `SQUAD_LIMIT` = 130 nunca se alcanza.
2. **El club activo mejora +2,5 puntos de XV por año,** contra +0,1 del pasivo. Con 3,4 puntos de margen por punto de XV, eso es ~8 puntos de margen en 3 años: suficiente para pasar de Primera B a Primera A (Delta: 10,6º pasivo contra 6,0º activo en el año 1, y 4,0º en Primera A al año siguiente).
3. **El Top 14 se achata solo** (ver arriba): la barra a superar baja unos 2 puntos en 5 años.
4. **Champagnat desciende en el año 1 el 100 % de las veces,** incluso activo (13,5º; XV 59,3 contra 66,8 del top-4). Es esperable (el último de la fuerza) pero hace que arrancar con el último sea «ascensor» seguro; el objetivo del club («Evitar el descenso») es incumplible en la práctica en el año 1.
5. **No se vio nada roto en las reglas:** sin errores, sin XV con lesionados, plantel estable. Las promociones de M19 y el plan juvenil funcionan y aportan poco (unas 7–9 promociones en 5 años).
6. Entrenamiento: una sesión por fecha (+1 atributo) vale unos +3,5 de XV en 5 años; no se ve exagerado.

## Veredicto

**Es posible y es difícil, y está cerca de lo que se pidió, con un matiz.**

- **Subir de división, sí, bastante fácil si se juega bien:** con política activa, un club de Primera A llega al Top 14 en 3–4 años (75 % en el año 5) y uno de Primera B asciende a Primera A en 1–2 años (100 % en los 5), pero tarda 6 o más años en el Top 14 (13 % en el año 5).
- **Pelear con los grandes, difícil:** un recién ascendido a Top 14 termina en 6º–10º. Llegar a playoffs en 5 años: 23 % para Champagnat, 3 % GEBA, 0 % Delta. **Título URBA: 3 % en 5 años** (1 de 40 carreras). Sin hacer nada, 0 %.
- **El mérito del manager importa:** la diferencia entre pasivo y activo es enorme (Champagnat en Top 14 en el año 5: 23 % contra 80 %), no es «imposible» ni «automático».
- Lo que lo vuelve algo más fácil de lo debido es el mercado y el achatamiento de los grandes: el club activo recorre 10 puntos de XV en 5 años.

### Ajustes sugeridos (no aplicados)

1. **Mercado** (`web/domain.js`, `transferInterest`): bajar el tope `Math.min(.85, ...)` a ~0,6 y/o `PLAY`/`roleF` más estrictos, o limitar los fichajes aceptados a ~4 por temporada (hoy ~7). Meta: +6 de XV en 5 años por mercado en vez de +10.
2. **Reposición de los clubes sin manager** (`web/domain.js`, `squadTurnover`, `GROWTH_EVERY`, y `src/engine/index.ts` `advanceSeason`): hacer que cada club reponga bajas con juveniles que suban cerca del nivel perdido, para que el top-4 no baje 2 puntos en 5 años. Medir antes con `scripts/playtest/career-sim.mjs` pasivo.
3. **Dar de baja jugadores** (acción nueva) o mantener un tope blando más bajo que `SQUAD_LIMIT` = 130 (hoy 83–85 por mercado).
4. Opcional: el objetivo del club «Evitar el descenso» (`clubObjective`) para el último de la fuerza debería ser realista o avisar que es el rol de ascensor.

Si se prefiere un recorrido más largo hacia el título, no tocar `HOME_EDGE`/`STRENGTH_SLOPE` (calibrados contra datos reales); las palancas son mercado y reposición.

